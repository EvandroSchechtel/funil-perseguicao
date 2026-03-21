import { prisma } from "@/lib/db/prisma"
import { ServiceError } from "./errors"

export interface ListWebhooksParams {
  page?: number
  perPage?: number
  search?: string
  campanhaId?: string
}

export async function listarWebhooks(params: ListWebhooksParams = {}) {
  const { page = 1, perPage = 20, search = "", campanhaId = "" } = params

  const where = {
    deleted_at: null,
    ...(search && {
      nome: { contains: search, mode: "insensitive" as const },
    }),
    ...(campanhaId && { campanha_id: campanhaId }),
  }

  const [total, webhooks] = await Promise.all([
    prisma.webhook.count({ where }),
    prisma.webhook.findMany({
      where,
      select: {
        id: true,
        nome: true,
        token: true,
        status: true,
        created_at: true,
        campanha: { select: { id: true, nome: true } },
        usuario: { select: { nome: true } },
        _count: { select: { leads: true, webhook_flows: true } },
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ])

  const appUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL || process.env.NEXT_PUBLIC_APP_URL || ""
  const webhooksSafe = webhooks.map((w) => ({
    ...w,
    url_publica: `${appUrl}/api/webhook/${w.token}`,
    leads_count: w._count.leads,
    flows_count: w._count.webhook_flows,
    _count: undefined,
  }))

  return {
    webhooks: webhooksSafe,
    pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
  }
}

export async function buscarWebhook(id: string) {
  const webhook = await prisma.webhook.findFirst({
    where: { id, deleted_at: null },
    select: {
      id: true,
      nome: true,
      token: true,
      status: true,
      campanha_id: true,
      created_at: true,
      updated_at: true,
      campanha: { select: { id: true, nome: true, cliente: { select: { id: true, nome: true } } } },
      usuario: { select: { nome: true } },
      webhook_flows: {
        where: { deleted_at: null },
        select: {
          id: true,
          flow_ns: true,
          flow_nome: true,
          ordem: true,
          total_enviados: true,
          status: true,
          tag_manychat_id: true,
          tag_manychat_nome: true,
          conta: { select: { id: true, nome: true, page_name: true } },
        },
        orderBy: { ordem: "asc" },
      },
      _count: { select: { leads: true } },
    },
  })

  if (!webhook) throw new ServiceError("not_found", "Webhook não encontrado.")

  const appUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL || process.env.NEXT_PUBLIC_APP_URL || ""
  return {
    webhook: {
      ...webhook,
      url_publica: `${appUrl}/api/webhook/${webhook.token}`,
      leads_count: webhook._count.leads,
      _count: undefined,
    },
  }
}

export interface CriarWebhookParams {
  nome: string
  campanha_id?: string
  status?: "ativo" | "inativo"
  userId: string
}

export async function criarWebhook({ nome, campanha_id, status = "ativo", userId }: CriarWebhookParams) {
  if (campanha_id) {
    const campanha = await prisma.campanha.findFirst({ where: { id: campanha_id, deleted_at: null } })
    if (!campanha) throw new ServiceError("bad_request", "Campanha não encontrada.")
  }

  const webhook = await prisma.webhook.create({
    data: { nome, campanha_id: campanha_id || null, status, created_by: userId },
    select: {
      id: true,
      nome: true,
      token: true,
      status: true,
      created_at: true,
      campanha: { select: { id: true, nome: true } },
    },
  })

  const appUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL || process.env.NEXT_PUBLIC_APP_URL || ""
  return {
    webhook: { ...webhook, url_publica: `${appUrl}/api/webhook/${webhook.token}` },
    message: "Webhook criado com sucesso.",
  }
}

export interface AtualizarWebhookParams {
  nome?: string
  campanha_id?: string | null
  status?: "ativo" | "inativo"
}

export async function atualizarWebhook(id: string, data: AtualizarWebhookParams) {
  const existing = await prisma.webhook.findFirst({ where: { id, deleted_at: null } })
  if (!existing) throw new ServiceError("not_found", "Webhook não encontrado.")

  const webhook = await prisma.webhook.update({
    where: { id },
    data: {
      ...(data.nome && { nome: data.nome }),
      ...(data.campanha_id !== undefined && { campanha_id: data.campanha_id }),
      ...(data.status && { status: data.status }),
    },
    select: { id: true, nome: true, token: true, status: true, updated_at: true },
  })

  const appUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL || process.env.NEXT_PUBLIC_APP_URL || ""
  return {
    webhook: { ...webhook, url_publica: `${appUrl}/api/webhook/${webhook.token}` },
    message: "Webhook atualizado com sucesso.",
  }
}

export async function deletarWebhook(id: string) {
  const existing = await prisma.webhook.findFirst({ where: { id, deleted_at: null } })
  if (!existing) throw new ServiceError("not_found", "Webhook não encontrado.")

  await prisma.webhook.update({ where: { id }, data: { deleted_at: new Date() } })
  return { message: "Webhook removido com sucesso." }
}

export async function toggleWebhook(id: string) {
  const existing = await prisma.webhook.findFirst({ where: { id, deleted_at: null } })
  if (!existing) throw new ServiceError("not_found", "Webhook não encontrado.")

  const novoStatus = existing.status === "ativo" ? "inativo" : "ativo"
  const webhook = await prisma.webhook.update({
    where: { id },
    data: { status: novoStatus },
    select: { id: true, status: true },
  })

  return {
    webhook,
    message: `Webhook ${novoStatus === "ativo" ? "ativado" : "desativado"} com sucesso.`,
  }
}
