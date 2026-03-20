import { prisma } from "@/lib/db/prisma"
import { addWebhookJob } from "@/lib/queue/queues"
import { ServiceError } from "./errors"
import type { LeadStatus } from "@/generated/prisma/client"

export interface ListLeadsParams {
  page?: number
  perPage?: number
  search?: string
  status?: string
  webhookId?: string
  campanhaId?: string
}

export async function listarLeads(params: ListLeadsParams = {}) {
  const { page = 1, perPage = 20, search = "", status = "", webhookId = "", campanhaId = "" } = params

  const where = {
    ...(search && {
      OR: [
        { nome: { contains: search, mode: "insensitive" as const } },
        { telefone: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(status && status !== "todos" && { status: status as LeadStatus }),
    ...(webhookId && { webhook_id: webhookId }),
    ...(campanhaId && { campanha_id: campanhaId }),
  }

  const [total, leads] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      select: {
        id: true,
        nome: true,
        telefone: true,
        email: true,
        status: true,
        erro_msg: true,
        tentativas: true,
        subscriber_id: true,
        flow_executado: true,
        conta_nome: true,
        grupo_entrou_at: true,
        processado_at: true,
        created_at: true,
        webhook: { select: { id: true, nome: true } },
        campanha: { select: { id: true, nome: true } },
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ])

  return {
    leads,
    pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
  }
}

export async function buscarLead(id: string) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      telefone: true,
      email: true,
      status: true,
      erro_msg: true,
      tentativas: true,
      subscriber_id: true,
      flow_executado: true,
      conta_nome: true,
      grupo_entrou_at: true,
      processado_at: true,
      created_at: true,
      updated_at: true,
      webhook: { select: { id: true, nome: true } },
      campanha: { select: { id: true, nome: true } },
      webhook_flow: {
        select: {
          id: true,
          flow_ns: true,
          flow_nome: true,
          conta: { select: { id: true, nome: true } },
        },
      },
      tentativas_hist: {
        orderBy: { numero: "asc" },
        select: {
          id: true,
          numero: true,
          status: true,
          erro_msg: true,
          subscriber_id: true,
          flow_ns: true,
          conta_nome: true,
          executado_at: true,
        },
      },
    },
  })

  if (!lead) throw new ServiceError("not_found", "Lead não encontrado.")
  return { lead }
}

export async function reprocessarLead(id: string) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      webhook: { select: { id: true, status: true, deleted_at: true } },
      webhook_flow: {
        include: { conta: { select: { id: true, api_key: true, status: true } } },
      },
    },
  })

  if (!lead) throw new ServiceError("not_found", "Lead não encontrado.")
  if (lead.status === "processando") {
    throw new ServiceError("bad_request", "Lead já está sendo processado.")
  }
  if (!lead.webhook || lead.webhook.deleted_at) {
    throw new ServiceError("bad_request", "O webhook associado a este lead foi removido.")
  }
  if (!lead.webhook_flow) {
    throw new ServiceError("bad_request", "Este lead não possui flow associado para reprocessamento.")
  }

  await prisma.lead.update({
    where: { id },
    data: { status: "pendente", erro_msg: null },
  })

  await addWebhookJob({
    leadId: lead.id,
    webhookId: lead.webhook_id,
    contaId: lead.webhook_flow.conta_id,
    flowNs: lead.webhook_flow.flow_ns,
    nome: lead.nome,
    telefone: lead.telefone,
    email: lead.email || undefined,
  }, { forceNew: true })

  return { message: "Lead reenfileirado para reprocessamento." }
}

export async function reprocessarSelecionados(leadIds: string[]) {
  const leads = await prisma.lead.findMany({
    where: {
      id: { in: leadIds },
      status: { not: "processando" },
      webhook: { deleted_at: null },
      webhook_flow_id: { not: null },
    },
    include: {
      webhook_flow: { select: { id: true, conta_id: true, flow_ns: true } },
    },
  })

  if (leads.length === 0) {
    return { reprocessados: 0, message: "Nenhum lead elegível para reprocessamento." }
  }

  await prisma.lead.updateMany({
    where: { id: { in: leads.map((l) => l.id) } },
    data: { status: "pendente", erro_msg: null },
  })

  let enqueued = 0
  for (const lead of leads) {
    if (!lead.webhook_flow) continue
    addWebhookJob({
      leadId: lead.id,
      webhookId: lead.webhook_id,
      contaId: lead.webhook_flow.conta_id,
      flowNs: lead.webhook_flow.flow_ns,
      nome: lead.nome,
      telefone: lead.telefone,
      email: lead.email || undefined,
    }, { forceNew: true }).catch((err) => console.error(`[reprocessarSelecionados] lead ${lead.id}:`, err))
    enqueued++
  }

  return {
    reprocessados: enqueued,
    message: `${enqueued} lead${enqueued !== 1 ? "s" : ""} reenfileirado${enqueued !== 1 ? "s" : ""}.`,
  }
}

export async function reprocessarFalhas(webhookId?: string) {
  const leads = await prisma.lead.findMany({
    where: {
      status: { in: ["falha", "sem_optin"] },
      ...(webhookId ? { webhook_id: webhookId } : {}),
      webhook: { deleted_at: null },
      webhook_flow_id: { not: null },
    },
    include: {
      webhook_flow: { select: { id: true, conta_id: true, flow_ns: true } },
    },
    take: 500,
  })

  if (leads.length === 0) {
    return { reprocessados: 0, message: "Nenhum lead com falha encontrado." }
  }

  await prisma.lead.updateMany({
    where: { id: { in: leads.map((l) => l.id) } },
    data: { status: "pendente", erro_msg: null },
  })

  let enqueued = 0
  for (const lead of leads) {
    if (!lead.webhook_flow) continue
    addWebhookJob({
      leadId: lead.id,
      webhookId: lead.webhook_id,
      contaId: lead.webhook_flow.conta_id,
      flowNs: lead.webhook_flow.flow_ns,
      nome: lead.nome,
      telefone: lead.telefone,
      email: lead.email || undefined,
    }, { forceNew: true }).catch((err) => console.error(`[reprocessarFalhas] Failed to queue lead ${lead.id}:`, err))
    enqueued++
  }

  return {
    reprocessados: enqueued,
    message: `${enqueued} lead${enqueued !== 1 ? "s" : ""} reenfileirado${enqueued !== 1 ? "s" : ""} com sucesso.`,
  }
}

function escapeCsv(value: string | null | undefined): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export interface ExportLeadsParams {
  search?: string
  status?: string
  webhookId?: string
  campanhaId?: string
}

export async function exportarLeads(params: ExportLeadsParams = {}) {
  const { search = "", status, webhookId, campanhaId } = params
  const validStatuses: LeadStatus[] = ["pendente", "processando", "sucesso", "falha", "sem_optin"]
  const statusFilter =
    status && status !== "todos" && validStatuses.includes(status as LeadStatus)
      ? (status as LeadStatus)
      : undefined

  const where = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(webhookId ? { webhook_id: webhookId } : {}),
    ...(campanhaId ? { campanha_id: campanhaId } : {}),
    ...(search && {
      OR: [
        { nome: { contains: search, mode: "insensitive" as const } },
        { telefone: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  }

  const leads = await prisma.lead.findMany({
    where,
    select: {
      id: true,
      nome: true,
      telefone: true,
      email: true,
      status: true,
      tentativas: true,
      subscriber_id: true,
      flow_executado: true,
      conta_nome: true,
      created_at: true,
      processado_at: true,
      erro_msg: true,
      webhook: { select: { nome: true } },
      campanha: { select: { nome: true } },
    },
    orderBy: { created_at: "desc" },
    take: 10000,
  })

  const csvHeaders = [
    "id", "nome", "telefone", "email", "status", "webhook", "campanha",
    "conta_manychat", "flow_executado", "subscriber_id",
    "tentativas", "recebido_em", "processado_em", "erro_msg",
  ]

  const rows = leads.map((l) =>
    [
      escapeCsv(l.id),
      escapeCsv(l.nome),
      escapeCsv(l.telefone),
      escapeCsv(l.email),
      escapeCsv(l.status),
      escapeCsv(l.webhook.nome),
      escapeCsv(l.campanha?.nome),
      escapeCsv(l.conta_nome),
      escapeCsv(l.flow_executado),
      escapeCsv(l.subscriber_id),
      escapeCsv(String(l.tentativas)),
      escapeCsv(l.created_at.toISOString()),
      escapeCsv(l.processado_at?.toISOString()),
      escapeCsv(l.erro_msg),
    ].join(",")
  )

  return [csvHeaders.join(","), ...rows].join("\n")
}
