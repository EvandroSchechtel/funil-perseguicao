import { prisma } from "@/lib/db/prisma"
import { ServiceError } from "./errors"
import { addWebhookJob } from "@/lib/queue/queues"
import { getTodayUsageMap, msUntilMidnightBRT } from "./uso-diario.service"

export interface ListCampanhasParams {
  page?: number
  perPage?: number
  search?: string
  status?: "ativo" | "inativo"
  clienteId?: string
}

export async function listarCampanhas(params: ListCampanhasParams = {}) {
  const { page = 1, perPage = 20, search = "", status, clienteId } = params

  const where = {
    deleted_at: null,
    ...(status && { status }),
    ...(clienteId && { cliente_id: clienteId }),
    ...(search && {
      OR: [
        { nome: { contains: search, mode: "insensitive" as const } },
        { descricao: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  }

  const [total, campanhas] = await Promise.all([
    prisma.campanha.count({ where }),
    prisma.campanha.findMany({
      where,
      select: {
        id: true,
        nome: true,
        descricao: true,
        status: true,
        pausado_at: true,
        data_inicio: true,
        data_fim: true,
        created_at: true,
        usuario: { select: { nome: true } },
        cliente: { select: { id: true, nome: true } },
        _count: { select: { webhooks: true, leads: true } },
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ])

  const data = campanhas.map((c) => ({
    ...c,
    webhooks_count: c._count.webhooks,
    leads_count: c._count.leads,
    _count: undefined,
  }))

  return {
    data,
    pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
  }
}

export async function buscarCampanha(id: string) {
  const [campanha, aguardando_count, grupos_entrados_count] = await Promise.all([
    prisma.campanha.findFirst({
      where: { id, deleted_at: null },
      select: {
        id: true,
        nome: true,
        descricao: true,
        status: true,
        pausado_at: true,
        data_inicio: true,
        data_fim: true,
        created_at: true,
        updated_at: true,
        usuario: { select: { nome: true } },
        cliente: { select: { id: true, nome: true } },
        _count: { select: { webhooks: true, leads: true } },
      },
    }),
    prisma.lead.count({ where: { campanha_id: id, status: "aguardando" } }),
    prisma.lead.count({ where: { campanha_id: id, grupo_entrou_at: { not: null } } }),
  ])

  if (!campanha) throw new ServiceError("not_found", "Campanha não encontrada.")

  return {
    data: {
      ...campanha,
      webhooks_count: campanha._count.webhooks,
      leads_count: campanha._count.leads,
      aguardando_count,
      grupos_entrados_count,
      _count: undefined,
    },
  }
}

export interface CriarCampanhaParams {
  nome: string
  descricao?: string | null
  data_inicio?: Date | null
  data_fim?: Date | null
  status?: "ativo" | "inativo"
  cliente_id?: string | null
  userId: string
}

export async function criarCampanha({ nome, descricao, data_inicio, data_fim, status, cliente_id, userId }: CriarCampanhaParams) {
  const appUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL || process.env.NEXT_PUBLIC_APP_URL || ""

  const result = await prisma.$transaction(async (tx) => {
    const campanha = await tx.campanha.create({
      data: {
        nome,
        descricao: descricao ?? null,
        data_inicio: data_inicio ?? null,
        data_fim: data_fim ?? null,
        status: status ?? "ativo",
        cliente_id: cliente_id ?? null,
        created_by: userId,
      },
      select: {
        id: true,
        nome: true,
        descricao: true,
        status: true,
        data_inicio: true,
        data_fim: true,
        created_at: true,
      },
    })

    const webhook = await tx.webhook.create({
      data: {
        nome,
        campanha_id: campanha.id,
        created_by: userId,
      },
      select: { id: true, token: true },
    })

    return { campanha, webhook }
  })

  return {
    data: result.campanha,
    webhook: {
      id: result.webhook.id,
      url_publica: `${appUrl}/api/webhook/${result.webhook.token}`,
    },
    message: "Campanha criada com sucesso.",
  }
}

export interface AtualizarCampanhaParams {
  nome?: string
  descricao?: string | null
  data_inicio?: Date | null
  data_fim?: Date | null
  status?: "ativo" | "inativo"
  cliente_id?: string | null
}

export async function atualizarCampanha(id: string, params: AtualizarCampanhaParams) {
  const existing = await prisma.campanha.findFirst({ where: { id, deleted_at: null } })
  if (!existing) throw new ServiceError("not_found", "Campanha não encontrada.")

  const { nome, descricao, data_inicio, data_fim, status, cliente_id } = params

  const campanha = await prisma.campanha.update({
    where: { id },
    data: {
      ...(nome !== undefined && { nome }),
      ...(descricao !== undefined && { descricao }),
      ...(data_inicio !== undefined && { data_inicio }),
      ...(data_fim !== undefined && { data_fim }),
      ...(status !== undefined && { status }),
      ...(cliente_id !== undefined && { cliente_id }),
    },
    select: {
      id: true,
      nome: true,
      descricao: true,
      status: true,
      data_inicio: true,
      data_fim: true,
      updated_at: true,
    },
  })

  return { data: campanha, message: "Campanha atualizada com sucesso." }
}

export async function deletarCampanha(id: string) {
  const existing = await prisma.campanha.findFirst({
    where: { id, deleted_at: null },
    include: { _count: { select: { webhooks: true } } },
  })
  if (!existing) throw new ServiceError("not_found", "Campanha não encontrada.")

  const activeWebhooks = await prisma.webhook.count({
    where: { campanha_id: id, status: "ativo", deleted_at: null },
  })
  if (activeWebhooks > 0) {
    throw new ServiceError("forbidden", "Não é possível excluir uma campanha com webhooks ativos.")
  }

  await prisma.campanha.update({ where: { id }, data: { deleted_at: new Date() } })

  return { message: "Campanha removida com sucesso." }
}

export async function toggleCampanha(id: string) {
  const existing = await prisma.campanha.findFirst({ where: { id, deleted_at: null } })
  if (!existing) throw new ServiceError("not_found", "Campanha não encontrada.")

  const novoStatus = existing.status === "ativo" ? "inativo" : "ativo"

  const campanha = await prisma.campanha.update({
    where: { id },
    data: { status: novoStatus },
    select: { id: true, status: true },
  })

  return {
    data: campanha,
    message: `Campanha ${novoStatus === "ativo" ? "ativada" : "desativada"} com sucesso.`,
  }
}

// ── Pause / Resume ─────────────────────────────────────────────────────────────

export async function pausarCampanha(id: string) {
  const existing = await prisma.campanha.findFirst({ where: { id, deleted_at: null } })
  if (!existing) throw new ServiceError("not_found", "Campanha não encontrada.")
  if (existing.pausado_at) throw new ServiceError("bad_request", "Campanha já está pausada.")

  await prisma.campanha.update({ where: { id }, data: { pausado_at: new Date() } })
  return { message: "Campanha pausada. Novos leads entrarão na fila de espera." }
}

export async function retomarCampanha(id: string) {
  const existing = await prisma.campanha.findFirst({ where: { id, deleted_at: null } })
  if (!existing) throw new ServiceError("not_found", "Campanha não encontrada.")
  if (!existing.pausado_at) throw new ServiceError("bad_request", "Campanha não está pausada.")

  // 1. Snapshot leads aguardando BEFORE the transaction
  const leads = await prisma.lead.findMany({
    where: { campanha_id: id, status: "aguardando" },
    select: {
      id: true,
      webhook_id: true,
      nome: true,
      telefone: true,
      email: true,
      webhook_flow: {
        select: {
          conta_id: true,
          flow_ns: true,
          conta: { select: { limite_diario: true } },
        },
      },
    },
  })

  // 2. Transaction first: clear pausado_at and promote leads to pendente
  await prisma.$transaction([
    prisma.campanha.update({ where: { id }, data: { pausado_at: null } }),
    prisma.lead.updateMany({ where: { campanha_id: id, status: "aguardando" }, data: { status: "pendente" } }),
  ])

  // 3. Enqueue snapshot leads (DB already committed — worker sees pendente status)
  const contaIds = [...new Set(leads.filter((l) => l.webhook_flow).map((l) => l.webhook_flow!.conta_id))]
  const usageMap = await getTodayUsageMap(contaIds)

  let enqueued = 0
  for (const lead of leads) {
    if (!lead.webhook_flow) continue
    const { conta_id, flow_ns, conta } = lead.webhook_flow
    const atLimit = conta.limite_diario !== null && (usageMap.get(conta_id) ?? 0) >= conta.limite_diario
    const delay = atLimit ? msUntilMidnightBRT() : undefined

    addWebhookJob(
      { leadId: lead.id, webhookId: lead.webhook_id, contaId: conta_id, flowNs: flow_ns, nome: lead.nome, telefone: lead.telefone, email: lead.email ?? undefined },
      { forceNew: true, delay }
    ).catch((err) => console.error("[retomarCampanha] addWebhookJob:", err))
    enqueued++
  }

  return { message: `Campanha retomada. ${enqueued} lead(s) reenfileirado(s).` }
}

export async function soltarTodosDaFila(id: string) {
  const existing = await prisma.campanha.findFirst({ where: { id, deleted_at: null } })
  if (!existing) throw new ServiceError("not_found", "Campanha não encontrada.")

  const count = await _enfileirarAguardando(id)
  await prisma.lead.updateMany({ where: { campanha_id: id, status: "aguardando" }, data: { status: "pendente" } })

  return { message: `${count} lead(s) liberado(s) da fila. Campanha continua pausada.` }
}

export async function soltarUmDaFila(id: string) {
  const lead = await prisma.lead.findFirst({
    where: { campanha_id: id, status: "aguardando" },
    orderBy: { created_at: "asc" },
    select: {
      id: true,
      webhook_id: true,
      nome: true,
      telefone: true,
      email: true,
      webhook_flow: {
        select: {
          conta_id: true,
          flow_ns: true,
          conta: { select: { limite_diario: true } },
        },
      },
    },
  })

  if (!lead) throw new ServiceError("not_found", "Nenhum lead aguardando na fila.")
  if (!lead.webhook_flow) throw new ServiceError("bad_request", "Lead sem flow atribuído.")

  const { conta_id, flow_ns, conta } = lead.webhook_flow
  const usageMap = await getTodayUsageMap([conta_id])
  const atLimit = conta.limite_diario !== null && (usageMap.get(conta_id) ?? 0) >= conta.limite_diario
  const delay = atLimit ? msUntilMidnightBRT() : undefined

  await prisma.lead.update({ where: { id: lead.id }, data: { status: "pendente" } })

  addWebhookJob(
    { leadId: lead.id, webhookId: lead.webhook_id, contaId: conta_id, flowNs: flow_ns, nome: lead.nome, telefone: lead.telefone, email: lead.email ?? undefined },
    { forceNew: true, delay }
  ).catch((err) => console.error("[soltarUmDaFila] addWebhookJob:", err))

  return { message: "Lead liberado da fila.", lead_id: lead.id }
}

async function _enfileirarAguardando(campanhaId: string): Promise<number> {
  const leads = await prisma.lead.findMany({
    where: { campanha_id: campanhaId, status: "aguardando" },
    select: {
      id: true,
      webhook_id: true,
      nome: true,
      telefone: true,
      email: true,
      webhook_flow: {
        select: {
          conta_id: true,
          flow_ns: true,
          conta: { select: { limite_diario: true } },
        },
      },
    },
  })

  const contaIds = [...new Set(leads.filter((l) => l.webhook_flow).map((l) => l.webhook_flow!.conta_id))]
  const usageMap = await getTodayUsageMap(contaIds)

  let enqueued = 0
  for (const lead of leads) {
    if (!lead.webhook_flow) continue
    const { conta_id, flow_ns, conta } = lead.webhook_flow
    const atLimit = conta.limite_diario !== null && (usageMap.get(conta_id) ?? 0) >= conta.limite_diario
    const delay = atLimit ? msUntilMidnightBRT() : undefined

    addWebhookJob(
      { leadId: lead.id, webhookId: lead.webhook_id, contaId: conta_id, flowNs: flow_ns, nome: lead.nome, telefone: lead.telefone, email: lead.email ?? undefined },
      { forceNew: true, delay }
    ).catch((err) => console.error("[_enfileirarAguardando] addWebhookJob:", err))
    enqueued++
  }

  return enqueued
}
