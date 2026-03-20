import { prisma } from "@/lib/db/prisma"
import { addTag } from "@/lib/manychat/tags"
import { normalizePhone, type ZApiWebhookPayload } from "@/lib/zapi/client"
import { tentarAutoVincularGrupo } from "@/lib/services/grupo-auto-vincular.service"

/**
 * Core logic: processes a Z-API GROUP_PARTICIPANT_ADD event.
 *
 * Steps:
 * 1. Find active GrupoMonitoramento matching chatName (case-insensitive contains)
 * 2. Normalize participant phone
 * 3. Find Contato by phone
 * 4. Find Lead by contato + campanha
 * 5. Find subscriber_id from ContatoConta
 * 6. Apply Manychat tag (best-effort)
 * 7. Upsert EntradaGrupo
 * 8. Update Lead.grupo_entrou_at
 */
export async function processarEntradaGrupo(
  instanciaId: string,
  payload: ZApiWebhookPayload
): Promise<void> {
  const {
    phone: groupWaId = "",
    chatName = "",
    participantPhone = "",
    senderName,
  } = payload

  const telefoneNorm = normalizePhone(participantPhone)
  if (!telefoneNorm) {
    console.warn("[Entradas] participantPhone vazio — ignorando")
    return
  }

  // 1. Find all active grupos for this instância that match the group name
  const grupos = await prisma.grupoMonitoramento.findMany({
    where: {
      instancia_id: instanciaId,
      status: "ativo",
      campanha: { pausado_at: null },
    },
    include: {
      conta_manychat: { select: { id: true, api_key: true } },
    },
  })

  const matched = grupos.filter((g) =>
    chatName.toLowerCase().includes(g.nome_filtro.toLowerCase())
  )

  if (matched.length === 0) {
    // Try to auto-link the group by semantic name similarity
    const auto = await tentarAutoVincularGrupo(instanciaId, groupWaId, chatName)
    if (auto.criado && auto.grupoId) {
      console.log(`[Entradas] Grupo auto-vinculado "${chatName}" (score=${auto.score.toFixed(2)}) — reprocessando entrada`)
      // Reload the newly created group and process
      const novoGrupo = await prisma.grupoMonitoramento.findUnique({
        where: { id: auto.grupoId },
        include: { conta_manychat: { select: { id: true, api_key: true } } },
      })
      if (novoGrupo) {
        await processarEntradaParaGrupo({ grupo: novoGrupo, groupWaId, groupWaName: chatName, telefoneNorm, senderName })
      }
    } else {
      console.log(`[Entradas] Nenhum grupo monitorado corresponde a "${chatName}"`)
    }
    return
  }

  console.log(`[Entradas] ${matched.length} grupo(s) correspondem a "${chatName}" para telefone ${telefoneNorm}`)

  for (const grupo of matched) {
    try {
      await processarEntradaParaGrupo({
        grupo,
        groupWaId,
        groupWaName: chatName,
        telefoneNorm,
        senderName,
      })
    } catch (err) {
      console.error(`[Entradas] Erro processando grupo ${grupo.id}:`, err)
    }
  }
}

async function processarEntradaParaGrupo({
  grupo,
  groupWaId,
  groupWaName,
  telefoneNorm,
  senderName,
}: {
  grupo: {
    id: string
    campanha_id: string
    tag_manychat_id: number
    grupo_wa_id: string | null
    conta_manychat: { id: string; api_key: string }
  }
  groupWaId: string
  groupWaName: string
  telefoneNorm: string
  senderName?: string
}): Promise<void> {
  // Save grupo_wa_id on first match (for future reference)
  if (!grupo.grupo_wa_id && groupWaId) {
    await prisma.grupoMonitoramento.update({
      where: { id: grupo.id },
      data: { grupo_wa_id: groupWaId },
    }).catch(() => {})
  }

  // 2. Find Contato by phone (try with and without country code variants)
  const contato = await prisma.contato.findFirst({
    where: {
      OR: [
        { telefone: telefoneNorm },
        { telefone: `+${telefoneNorm}` },
        // strip country code 55 for local format
        ...(telefoneNorm.startsWith("55") ? [{ telefone: telefoneNorm.slice(2) }] : []),
      ],
    },
  })

  // 3. Find Lead by contato + campanha
  let lead: { id: string; subscriber_id: string | null } | null = null
  if (contato) {
    lead = await prisma.lead.findFirst({
      where: {
        contato_id: contato.id,
        campanha_id: grupo.campanha_id,
      },
      select: { id: true, subscriber_id: true },
    })
  }

  // 4. Find subscriber_id — prefer lead's own, fallback to ContatoConta
  let subscriberId = lead?.subscriber_id ?? null
  if (!subscriberId && contato) {
    const cc = await prisma.contatoConta.findFirst({
      where: {
        contato_id: contato.id,
        conta_id: grupo.conta_manychat.id,
        subscriber_id: { not: null },
      },
      select: { subscriber_id: true },
    })
    subscriberId = cc?.subscriber_id ?? null
  }

  // 5. Apply Manychat tag (best-effort)
  let tagAplicada = false
  let tagErro: string | null = null

  if (subscriberId) {
    const result = await addTag(grupo.conta_manychat.api_key, subscriberId, grupo.tag_manychat_id)
    tagAplicada = result.ok
    tagErro = result.error ?? null
    console.log(`[Entradas] addTag subscriber=${subscriberId} tag=${grupo.tag_manychat_id} → ${result.ok ? "ok" : result.error}`)
  } else {
    tagErro = "subscriber_id não encontrado — tag não aplicada"
    console.warn(`[Entradas] Sem subscriber_id para telefone ${telefoneNorm}`)
  }

  // 6. Upsert EntradaGrupo (re-entry updates timestamp + tag status)
  await prisma.entradaGrupo.upsert({
    where: { grupo_id_telefone: { grupo_id: grupo.id, telefone: telefoneNorm } },
    create: {
      grupo_id: grupo.id,
      lead_id: lead?.id ?? null,
      contato_id: contato?.id ?? null,
      telefone: telefoneNorm,
      nome_whatsapp: senderName ?? null,
      grupo_wa_id: groupWaId,
      grupo_wa_nome: groupWaName,
      subscriber_id: subscriberId,
      tag_aplicada: tagAplicada,
      tag_erro: tagErro,
    },
    update: {
      lead_id: lead?.id ?? null,
      contato_id: contato?.id ?? null,
      nome_whatsapp: senderName ?? null,
      grupo_wa_id: groupWaId,
      grupo_wa_nome: groupWaName,
      subscriber_id: subscriberId,
      tag_aplicada: tagAplicada,
      tag_erro: tagErro,
      entrou_at: new Date(),
    },
  })

  // 7. Update Lead.grupo_entrou_at
  if (lead?.id) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { grupo_entrou_at: new Date() },
    })
    console.log(`[Entradas] Lead ${lead.id} marcado como entrou_grupo`)
  }
}
