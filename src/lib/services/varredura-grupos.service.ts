import { prisma } from "@/lib/db/prisma"
import { addTag } from "@/lib/manychat/tags"
import { getGroupMetadata, normalizePhone } from "@/lib/zapi/client"
import { ServiceError } from "./errors"

const LOCK_HOURS = 24

export interface VarreduraResult {
  grupos_varridos: number
  grupos_sem_id: number       // grupos sem grupo_wa_id (ainda não vinculados ao WA)
  total_membros: number       // participantes únicos lidos do Z-API
  leads_encontrados: number   // membros que têm Lead nesta campanha
  ja_processados: number      // leads com tag_aplicada=true (skip)
  tags_aplicadas: number      // leads que receberam tag agora
  erros: number               // falhas de getGroupMetadata ou outras
  proxima_varredura_em: string // ISO8601
}

/**
 * Varredura retroativa de grupos: percorre todos os membros atuais dos grupos
 * WhatsApp vinculados à campanha e aplica tags Manychat para leads que ainda
 * não foram processados.
 *
 * Regras:
 * - Só pode rodar uma vez a cada 24h por campanha (trava via ultima_varredura_at)
 * - Só processa leads já existentes na campanha (não cria leads novos)
 * - Aplica tags em todas as contas Manychat vinculadas ao grupo (multi-conta)
 * - Usa ContatoConta(contato_id, conta_id) — nunca Lead.subscriber_id
 */
export async function varredarGruposCampanha(campanhaId: string): Promise<VarreduraResult> {
  // 1. Busca campanha com credenciais da instância Z-API
  const campanha = await prisma.campanha.findFirst({
    where: { id: campanhaId, deleted_at: null },
    select: {
      id: true,
      ultima_varredura_at: true,
      instancia_zapi: {
        select: { id: true, instance_id: true, token: true, client_token: true },
      },
    },
  })
  if (!campanha) throw new ServiceError("not_found", "Campanha não encontrada.")
  if (!campanha.instancia_zapi) {
    throw new ServiceError("bad_request", "Campanha não tem instância Z-API vinculada. Vincule uma instância antes de varrer.")
  }

  // 2. Trava 24h
  if (campanha.ultima_varredura_at) {
    const diff = Date.now() - new Date(campanha.ultima_varredura_at).getTime()
    const restante = LOCK_HOURS * 3_600_000 - diff
    if (restante > 0) {
      const horas = Math.ceil(restante / 3_600_000)
      const label = horas === 1 ? "1 hora" : `${horas} horas`
      throw new ServiceError("conflict", `A última varredura foi há menos de 24h. Aguarde ${label} antes de varrer novamente.`)
    }
  }

  // 3. Grava trava imediatamente (evita runs concorrentes)
  await prisma.campanha.update({
    where: { id: campanhaId },
    data: { ultima_varredura_at: new Date() },
  })

  // 4. Busca todos os GrupoMonitoramento ativos da campanha
  const grupos = await prisma.grupoMonitoramento.findMany({
    where: { campanha_id: campanhaId, status: "ativo" },
    include: {
      conta_manychat: { select: { id: true, api_key: true } },
      contas_monitoramento: {
        include: { conta_manychat: { select: { id: true, api_key: true } } },
      },
    },
  })

  const inst = campanha.instancia_zapi
  const result: VarreduraResult = {
    grupos_varridos: 0,
    grupos_sem_id: 0,
    total_membros: 0,
    leads_encontrados: 0,
    ja_processados: 0,
    tags_aplicadas: 0,
    erros: 0,
    proxima_varredura_em: new Date(Date.now() + LOCK_HOURS * 3_600_000).toISOString(),
  }

  // 5. Para cada grupo: busca membros e processa
  for (const grupo of grupos) {
    if (!grupo.grupo_wa_id) {
      result.grupos_sem_id++
      continue
    }

    const metadata = await getGroupMetadata(inst.instance_id, inst.token, inst.client_token, grupo.grupo_wa_id)
    if (!metadata) {
      console.warn(`[Varredura] getGroupMetadata falhou para grupo ${grupo.id} (${grupo.grupo_wa_id})`)
      result.erros++
      continue
    }

    result.grupos_varridos++
    console.log(`[Varredura] Grupo "${metadata.name}" — ${metadata.participants.length} participantes`)

    // Contas a taggear: multi-conta ou fallback para conta principal
    const contasToTag = grupo.contas_monitoramento.length > 0
      ? grupo.contas_monitoramento
      : [{ conta_manychat: grupo.conta_manychat, tag_manychat_id: grupo.tag_manychat_id }]

    for (const participant of metadata.participants) {
      const telefoneNorm = normalizePhone(participant.phone)
      if (!telefoneNorm) continue

      result.total_membros++

      // Busca Contato (multi-formato: 5542xxx, +5542xxx, 42xxx)
      const contato = await prisma.contato.findFirst({
        where: {
          OR: [
            { telefone: telefoneNorm },
            { telefone: `+${telefoneNorm}` },
            ...(telefoneNorm.startsWith("55") ? [{ telefone: telefoneNorm.slice(2) }] : []),
          ],
        },
      })
      if (!contato) continue // não é um contato nosso

      // Busca Lead nesta campanha
      const lead = await prisma.lead.findFirst({
        where: { contato_id: contato.id, campanha_id: campanhaId },
        select: { id: true },
      })
      if (!lead) continue // não é um lead desta campanha

      result.leads_encontrados++

      // Verifica EntradaGrupo existente com tag já aplicada
      const entradaExistente = await prisma.entradaGrupo.findFirst({
        where: { grupo_id: grupo.id, telefone: telefoneNorm },
      })
      if (entradaExistente?.tag_aplicada) {
        result.ja_processados++
        continue
      }

      // Aplica tags em todas as contas (parallel por conta, best-effort)
      const tagResults = await Promise.allSettled(
        contasToTag.map(async (entry) => {
          const cc = await prisma.contatoConta.findFirst({
            where: {
              contato_id: contato.id,
              conta_id: entry.conta_manychat.id,
              subscriber_id: { not: null },
            },
            select: { subscriber_id: true },
          })
          if (!cc?.subscriber_id) return { ok: false, subscriberId: null, error: "sem subscriber_id" }
          const res = await addTag(entry.conta_manychat.api_key, cc.subscriber_id, entry.tag_manychat_id)
          return { ok: res.ok, subscriberId: cc.subscriber_id, error: res.error ?? null }
        })
      )

      const tagAplicada = tagResults.some((r) => r.status === "fulfilled" && r.value.ok)
      const tagErro = tagResults
        .filter((r) => r.status === "fulfilled" && !r.value.ok)
        .map((r) => (r as PromiseFulfilledResult<{ error: string | null }>).value.error)
        .filter(Boolean)
        .join("; ") || null

      const subscriberId = tagResults
        .map((r) => r.status === "fulfilled" ? r.value.subscriberId : null)
        .find((s) => s != null) ?? null

      if (tagAplicada) {
        result.tags_aplicadas++
      }

      console.log(`[Varredura] telefone=${telefoneNorm} tag=${tagAplicada ? "ok" : "falhou"} erro=${tagErro}`)

      // Upsert EntradaGrupo
      await prisma.entradaGrupo.upsert({
        where: { grupo_id_telefone: { grupo_id: grupo.id, telefone: telefoneNorm } },
        create: {
          grupo_id: grupo.id,
          lead_id: lead.id,
          contato_id: contato.id,
          telefone: telefoneNorm,
          nome_whatsapp: participant.name ?? null,
          grupo_wa_id: grupo.grupo_wa_id,
          grupo_wa_nome: metadata.name,
          subscriber_id: subscriberId,
          tag_aplicada: tagAplicada,
          tag_erro: tagErro,
        },
        update: {
          lead_id: lead.id,
          contato_id: contato.id,
          subscriber_id: subscriberId,
          tag_aplicada: tagAplicada,
          tag_erro: tagErro,
          entrou_at: new Date(),
        },
      })

      // Atualiza grupo_entrou_at no lead se ainda não preenchido
      await prisma.lead.updateMany({
        where: { id: lead.id, grupo_entrou_at: null },
        data: { grupo_entrou_at: new Date() },
      })
    }
  }

  console.log(`[Varredura] campanhaId=${campanhaId} result=`, result)
  return result
}
