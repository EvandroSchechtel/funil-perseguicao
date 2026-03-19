import { prisma } from "@/lib/db/prisma"
import { ServiceError } from "./errors"

export interface ListWebhooksParams {
  page?: number
  perPage?: number
  search?: string
}

export async function listarWebhooks(params: ListWebhooksParams = {}) {
  const { page = 1, perPage = 20, search = "" } = params

  const where = {
    deleted_at: null,
    ...(search && {
      OR: [
        { nome: { contains: search, mode: "insensitive" as const } },
        { flow_ns: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  }

  const [total, webhooks] = await Promise.all([
    prisma.webhook.count({ where }),
    prisma.webhook.findMany({
      where,
      select: {
        id: true,
        nome: true,
        token: true,
        flow_ns: true,
        flow_nome: true,
        status: true,
        created_at: true,
        conta: { select: { id: true, nome: true, page_name: true } },
        usuario: { select: { nome: true } },
        _count: { select: { leads: true } },
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
  const webhooksSafe = webhooks.map((w) => ({
    ...w,
    url_publica: `${appUrl}/api/webhook/${w.token}`,
    leads_count: w._count.leads,
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
      flow_ns: true,
      flow_nome: true,
      status: true,
      created_at: true,
      updated_at: true,
      conta: { select: { id: true, nome: true, page_name: true } },
      usuario: { select: { nome: true } },
      _count: { select: { leads: true } },
    },
  })

  if (!webhook) throw new ServiceError("not_found", "Webhook não encontrado.")

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
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
  conta_id: string
  flow_ns: string
  flow_nome?: string
  status?: "ativo" | "inativo"
  userId: string
}

export async function criarWebhook({ nome, conta_id, flow_ns, flow_nome, status = "ativo", userId }: CriarWebhookParams) {
  const conta = await prisma.contaManychat.findFirst({
    where: { id: conta_id, status: "ativo", deleted_at: null },
  })
  if (!conta) throw new ServiceError("bad_request", "Conta Manychat não encontrada ou inativa.")

  const webhook = await prisma.webhook.create({
    data: {
      nome,
      conta_id,
      flow_ns,
      flow_nome: flow_nome || null,
      status,
      created_by: userId,
    },
    select: {
      id: true,
      nome: true,
      token: true,
      flow_ns: true,
      flow_nome: true,
      status: true,
      created_at: true,
      conta: { select: { id: true, nome: true } },
    },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
  return {
    webhook: { ...webhook, url_publica: `${appUrl}/api/webhook/${webhook.token}` },
    message: "Webhook criado com sucesso.",
  }
}

export interface AtualizarWebhookParams {
  nome?: string
  flow_ns?: string
  flow_nome?: string
  status?: "ativo" | "inativo"
}

export async function atualizarWebhook(id: string, data: AtualizarWebhookParams) {
  const existing = await prisma.webhook.findFirst({ where: { id, deleted_at: null } })
  if (!existing) throw new ServiceError("not_found", "Webhook não encontrado.")

  const { nome, flow_ns, flow_nome, status } = data

  const webhook = await prisma.webhook.update({
    where: { id },
    data: {
      ...(nome && { nome }),
      ...(flow_ns && { flow_ns }),
      ...(flow_nome !== undefined && { flow_nome }),
      ...(status && { status }),
    },
    select: {
      id: true,
      nome: true,
      token: true,
      flow_ns: true,
      flow_nome: true,
      status: true,
      updated_at: true,
    },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
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
