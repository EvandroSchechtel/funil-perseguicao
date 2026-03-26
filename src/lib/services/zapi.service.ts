import { prisma } from "@/lib/db/prisma"
import { testZApiConnection, configureWebhook } from "@/lib/zapi/client"
import { groupNameSimilarity, SIMILARITY_THRESHOLD } from "@/lib/utils/name-similarity"
import { ServiceError } from "./errors"

// ── Instâncias ─────────────────────────────────────────────────────────────────

export async function listarInstancias(userId: string, clienteId?: string) {
  return prisma.instanciaZApi.findMany({
    where: { deleted_at: null, ...(clienteId && { cliente_id: clienteId }) },
    include: {
      cliente: { select: { id: true, nome: true } },
      _count: { select: { grupos: true } },
    },
    orderBy: { created_at: "desc" },
  })
}

export async function buscarInstancia(id: string) {
  const inst = await prisma.instanciaZApi.findFirst({
    where: { id, deleted_at: null },
    include: {
      cliente: { select: { id: true, nome: true } },
      grupos: {
        include: {
          campanha: { select: { id: true, nome: true } },
          conta_manychat: { select: { id: true, nome: true } },
          _count: { select: { entradas: true } },
        },
        orderBy: { created_at: "desc" },
      },
    },
  })
  if (!inst) throw new ServiceError("not_found", "Instância Z-API não encontrada.")
  return inst
}

export interface CriarInstanciaParams {
  nome: string
  instance_id: string
  token: string
  client_token: string
  cliente_id: string  // obrigatório — imutável após criação
  userId: string
  appBaseUrl: string  // for constructing the webhook URL
}

export async function criarInstancia(params: CriarInstanciaParams) {
  const { nome, instance_id, token, client_token, cliente_id, userId, appBaseUrl } = params

  // Test connection before saving
  const conn = await testZApiConnection(instance_id, token, client_token)
  if (!conn.ok) {
    throw new ServiceError("bad_request", conn.error || "Falha ao conectar ao Z-API.")
  }

  const inst = await prisma.instanciaZApi.create({
    data: { nome, instance_id, token, client_token, cliente_id, created_by: userId },
    select: { id: true, nome: true, webhook_token: true },
  })

  // Configure webhook on Z-API (best-effort — don't fail if this errors)
  const webhookUrl = `${appBaseUrl}/api/webhook/zapi/${inst.webhook_token}`
  configureWebhook(instance_id, token, client_token, webhookUrl).catch((err) => {
    console.warn("[ZApi] configureWebhook failed:", err)
  })

  return {
    instancia: inst,
    webhook_url: webhookUrl,
    message: "Instância conectada com sucesso.",
  }
}

export interface AtualizarInstanciaParams {
  nome?: string
  instance_id?: string
  token?: string
  client_token?: string
  // cliente_id é IMUTÁVEL após criação — não aceito aqui
  status?: "ativo" | "inativo"
}

export async function atualizarInstancia(id: string, data: AtualizarInstanciaParams) {
  const existing = await prisma.instanciaZApi.findFirst({ where: { id, deleted_at: null } })
  if (!existing) throw new ServiceError("not_found", "Instância não encontrada.")

  // If credentials changed, re-test
  const newInstanceId = data.instance_id ?? existing.instance_id
  const newToken = data.token ?? existing.token
  const newClientToken = data.client_token ?? existing.client_token

  if (data.instance_id || data.token || data.client_token) {
    const conn = await testZApiConnection(newInstanceId, newToken, newClientToken)
    if (!conn.ok) throw new ServiceError("bad_request", conn.error || "Falha ao conectar ao Z-API.")
  }

  const inst = await prisma.instanciaZApi.update({
    where: { id },
    data: {
      ...(data.nome && { nome: data.nome }),
      ...(data.instance_id && { instance_id: data.instance_id }),
      ...(data.token && { token: data.token }),
      ...(data.client_token && { client_token: data.client_token }),
      ...(data.status && { status: data.status }),
      // cliente_id nunca atualizado aqui — imutável
    },
    select: { id: true, nome: true, webhook_token: true, status: true },
  })

  return { instancia: inst, message: "Instância atualizada." }
}

export async function deletarInstancia(id: string) {
  const existing = await prisma.instanciaZApi.findFirst({ where: { id, deleted_at: null } })
  if (!existing) throw new ServiceError("not_found", "Instância não encontrada.")

  // Check for active grupos
  const grupos = await prisma.grupoMonitoramento.count({ where: { instancia_id: id, status: "ativo" } })
  if (grupos > 0) {
    throw new ServiceError("bad_request", `Existem ${grupos} grupo(s) ativo(s) vinculados a esta instância. Desative-os antes de remover.`)
  }

  await prisma.instanciaZApi.update({ where: { id }, data: { deleted_at: new Date() } })
  return { message: "Instância removida." }
}

// ── Grupos ─────────────────────────────────────────────────────────────────────

export interface CriarGrupoParams {
  instancia_id: string
  campanha_id: string
  conta_manychat_id: string           // primeira conta (backward compat — required)
  nome_filtro: string
  grupo_wa_id?: string | null         // ID Z-API do grupo (phone) — preenchido na criação via form
  tag_manychat_id: number
  tag_manychat_nome: string
  auto_expand?: boolean               // default true
  contas?: Array<{                    // contas adicionais (opcional)
    conta_id: string
    tag_id: number
    tag_nome: string
  }>
}

export async function criarGrupo(data: CriarGrupoParams) {
  // Validate instancia exists
  const inst = await prisma.instanciaZApi.findFirst({ where: { id: data.instancia_id, deleted_at: null } })
  if (!inst) throw new ServiceError("not_found", "Instância não encontrada.")

  // Check for duplicate nome_filtro on the same instance
  const existing = await prisma.grupoMonitoramento.findFirst({
    where: {
      instancia_id: data.instancia_id,
      nome_filtro: { equals: data.nome_filtro, mode: "insensitive" },
    },
  })
  if (existing) {
    throw new ServiceError("conflict", "Já existe um grupo com este nome de filtro nesta instância.")
  }

  const { contas, auto_expand, ...grupoData } = data

  const grupo = await prisma.grupoMonitoramento.create({
    data: { ...grupoData, auto_expand: auto_expand ?? true },
    include: {
      campanha: { select: { id: true, nome: true } },
      conta_manychat: { select: { id: true, nome: true } },
    },
  })

  // Build the full list: primary conta + additional contas, deduped by conta_id
  const allContas = [
    { conta_id: data.conta_manychat_id, tag_id: data.tag_manychat_id, tag_nome: data.tag_manychat_nome },
    ...(contas ?? []),
  ]
  const dedupedContas = allContas.filter(
    (c, i, arr) => arr.findIndex((x) => x.conta_id === c.conta_id) === i
  )

  await prisma.grupoMonitoramentoConta.createMany({
    data: dedupedContas.map((c) => ({
      id: crypto.randomUUID(),
      grupo_id: grupo.id,
      conta_manychat_id: c.conta_id,
      tag_manychat_id: c.tag_id,
      tag_manychat_nome: c.tag_nome,
    })),
    skipDuplicates: true,
  })

  // ── Auto-link similar cached groups when auto_expand is enabled ──────────
  const autoVinculados: string[] = []
  const shouldAutoExpand = auto_expand ?? true
  if (shouldAutoExpand) {
    const cached = await prisma.grupoWaCache.findMany({
      where: { instancia_id: data.instancia_id },
    })

    for (const cg of cached) {
      const score = groupNameSimilarity(data.nome_filtro, cg.nome)
      if (score < SIMILARITY_THRESHOLD) continue

      // Skip if already monitored with this grupo_wa_id in this campaign
      const existing = await prisma.grupoMonitoramento.findFirst({
        where: {
          instancia_id: data.instancia_id,
          grupo_wa_id: cg.grupo_wa_id,
          campanha_id: data.campanha_id,
        },
      })
      if (existing) continue

      // Also skip if exact name already exists for this campaign
      const dupeName = await prisma.grupoMonitoramento.findFirst({
        where: {
          instancia_id: data.instancia_id,
          campanha_id: data.campanha_id,
          nome_filtro: { equals: cg.nome, mode: "insensitive" },
        },
      })
      if (dupeName) continue

      // Clone a new GrupoMonitoramento from the template
      const novo = await prisma.grupoMonitoramento.create({
        data: {
          instancia_id: data.instancia_id,
          campanha_id: data.campanha_id,
          conta_manychat_id: data.conta_manychat_id,
          nome_filtro: cg.nome,
          grupo_wa_id: cg.grupo_wa_id,
          tag_manychat_id: data.tag_manychat_id,
          tag_manychat_nome: data.tag_manychat_nome,
          auto_expand: false, // cloned groups don't auto-expand further
        },
      })

      // Copy contas to the cloned group
      if (dedupedContas.length > 0) {
        await prisma.grupoMonitoramentoConta.createMany({
          data: dedupedContas.map((c) => ({
            id: crypto.randomUUID(),
            grupo_id: novo.id,
            conta_manychat_id: c.conta_id,
            tag_manychat_id: c.tag_id,
            tag_manychat_nome: c.tag_nome,
          })),
          skipDuplicates: true,
        }).catch((err) => console.error("[AutoVincular] Erro ao copiar contas:", err))
      }

      autoVinculados.push(cg.nome)
      console.log(
        `[AutoVincular:criarGrupo] "${cg.nome}" vinculado automaticamente ` +
        `(score=${score.toFixed(2)}, template="${data.nome_filtro}")`
      )
    }
  }

  return { grupo, autoVinculados, message: "Grupo configurado com sucesso." }
}

export interface BatchCriarGruposParams extends Omit<CriarGrupoParams, "nome_filtro" | "grupo_wa_id"> {
  grupos: Array<{ nome: string; phone: string }>  // nome → nome_filtro, phone → grupo_wa_id
}

export async function batchCriarGrupos(params: BatchCriarGruposParams) {
  const { grupos, ...base } = params
  const results: Array<{ nome_filtro: string; status: "criado" | "duplicado" | "erro"; message?: string }> = []
  const allAutoVinculados: string[] = []

  for (const g of grupos) {
    try {
      const res = await criarGrupo({ ...base, nome_filtro: g.nome, grupo_wa_id: g.phone || null })
      results.push({ nome_filtro: g.nome, status: "criado" })
      if (res.autoVinculados?.length) {
        allAutoVinculados.push(...res.autoVinculados)
      }
    } catch (err) {
      const isConflict = err instanceof ServiceError && err.code === "conflict"
      const message = err instanceof ServiceError ? err.message : "Erro desconhecido"
      results.push({ nome_filtro: g.nome, status: isConflict ? "duplicado" : "erro", message })
    }
  }

  const criados = results.filter((r) => r.status === "criado").length
  return {
    results,
    criados,
    total: grupos.length,
    autoVinculados: allAutoVinculados,
    message: `${criados} de ${grupos.length} grupos criados.`,
  }
}

export async function atualizarGrupo(
  id: string,
  data: Partial<CriarGrupoParams> & { status?: "ativo" | "inativo" }
) {
  const existing = await prisma.grupoMonitoramento.findUnique({ where: { id } })
  if (!existing) throw new ServiceError("not_found", "Grupo não encontrado.")

  const grupo = await prisma.grupoMonitoramento.update({
    where: { id },
    data,
    include: {
      campanha: { select: { id: true, nome: true } },
      conta_manychat: { select: { id: true, nome: true } },
    },
  })

  return { grupo, message: "Grupo atualizado." }
}

export async function deletarGrupo(id: string) {
  const existing = await prisma.grupoMonitoramento.findUnique({ where: { id } })
  if (!existing) throw new ServiceError("not_found", "Grupo não encontrado.")

  await prisma.grupoMonitoramento.delete({ where: { id } })
  return { message: "Grupo removido." }
}

// ── Entradas ───────────────────────────────────────────────────────────────────

export async function listarSaidas(instanciaId: string, grupoId?: string) {
  return prisma.saidaGrupo.findMany({
    where: {
      grupo: { instancia_id: instanciaId },
      ...(grupoId ? { grupo_id: grupoId } : {}),
    },
    include: {
      grupo: { select: { nome_filtro: true } },
      lead: { select: { id: true, nome: true, status: true } },
    },
    orderBy: { saiu_at: "desc" },
    take: 200,
  })
}

// ── Cache de Grupos WhatsApp ────────────────────────────────────────────────────

/**
 * Persists the list of WhatsApp groups for an instance to the database cache.
 * Called after every Z-API fetch (detectar-grupos refresh or escanear-grupos).
 * Groups with empty/null names are discarded.
 */
export async function sincronizarGruposCache(
  instanciaId: string,
  grupos: Array<{ phone: string; name: string }>
) {
  const validos = grupos.filter((g) => g.name?.trim())
  await prisma.grupoWaCache.deleteMany({ where: { instancia_id: instanciaId } })
  if (validos.length === 0) return
  await prisma.grupoWaCache.createMany({
    data: validos.map((g) => ({
      id: crypto.randomUUID(),
      instancia_id: instanciaId,
      grupo_wa_id: g.phone,
      nome: g.name.trim(),
    })),
    skipDuplicates: true,
  })
}

export async function listarEntradas(instanciaId: string, grupoId?: string, perPage?: number) {
  return prisma.entradaGrupo.findMany({
    where: {
      grupo: { instancia_id: instanciaId },
      ...(grupoId ? { grupo_id: grupoId } : {}),
    },
    include: {
      grupo: { select: { nome_filtro: true, tag_manychat_nome: true } },
      lead: { select: { id: true, nome: true, status: true } },
    },
    orderBy: { entrou_at: "desc" },
    take: perPage ?? 200,
  })
}
