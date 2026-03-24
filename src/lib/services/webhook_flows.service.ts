import { prisma } from "@/lib/db/prisma"
import { ServiceError } from "./errors"

export async function listarWebhookFlows(webhookId: string) {
  const webhook = await prisma.webhook.findFirst({ where: { id: webhookId, deleted_at: null } })
  if (!webhook) throw new ServiceError("not_found", "Webhook não encontrado.")

  const flows = await prisma.webhookFlow.findMany({
    where: { webhook_id: webhookId, deleted_at: null },
    select: {
      id: true,
      webhook_id: true,
      tipo: true,
      flow_ns: true,
      flow_nome: true,
      webhook_url: true,
      ordem: true,
      total_enviados: true,
      status: true,
      created_at: true,
      updated_at: true,
      conta: { select: { id: true, nome: true, page_name: true } },
      tag_manychat_id: true,
      tag_manychat_nome: true,
    },
    orderBy: { ordem: "asc" },
  })

  return { data: flows }
}

export interface AdicionarFlowParams {
  tipo?: "manychat" | "webhook" // default "manychat"
  conta_id?: string
  flow_ns?: string
  flow_nome?: string
  ordem?: number
  tag_manychat_id?: number
  tag_manychat_nome?: string
  webhook_url?: string
}

export async function adicionarFlow(webhookId: string, params: AdicionarFlowParams) {
  const webhook = await prisma.webhook.findFirst({ where: { id: webhookId, deleted_at: null } })
  if (!webhook) throw new ServiceError("not_found", "Webhook não encontrado.")

  const tipo = params.tipo ?? "manychat"

  let ordem = params.ordem
  if (ordem === undefined) {
    const last = await prisma.webhookFlow.findFirst({
      where: { webhook_id: webhookId, deleted_at: null },
      orderBy: { ordem: "desc" },
      select: { ordem: true },
    })
    ordem = last ? last.ordem + 1 : 0
  }

  if (tipo === "manychat") {
    if (!params.conta_id) throw new ServiceError("bad_request", "conta_id é obrigatório para flows Manychat.")
    if (!params.flow_ns) throw new ServiceError("bad_request", "flow_ns é obrigatório para flows Manychat.")

    const conta = await prisma.contaManychat.findFirst({
      where: { id: params.conta_id, status: "ativo", deleted_at: null },
    })
    if (!conta) throw new ServiceError("bad_request", "Conta Manychat não encontrada ou inativa.")

    // Prevent duplicate: same conta + same flow_ns on the same webhook
    const duplicate = await prisma.webhookFlow.findFirst({
      where: { webhook_id: webhookId, conta_id: params.conta_id, flow_ns: params.flow_ns, deleted_at: null },
      select: { id: true },
    })
    if (duplicate) throw new ServiceError("conflict", "Este flow já está adicionado a este webhook nesta conta.")

    const flow = await prisma.webhookFlow.create({
      data: {
        webhook_id: webhookId,
        tipo: "manychat",
        conta_id: params.conta_id,
        flow_ns: params.flow_ns,
        flow_nome: params.flow_nome || null,
        ordem,
        tag_manychat_id: params.tag_manychat_id ?? null,
        tag_manychat_nome: params.tag_manychat_nome ?? null,
      },
      select: {
        id: true,
        webhook_id: true,
        tipo: true,
        flow_ns: true,
        flow_nome: true,
        webhook_url: true,
        ordem: true,
        total_enviados: true,
        status: true,
        tag_manychat_id: true,
        tag_manychat_nome: true,
        created_at: true,
        conta: { select: { id: true, nome: true, page_name: true } },
      },
    })

    return { data: flow, message: "Flow adicionado com sucesso." }
  }

  // tipo === "webhook"
  if (!params.webhook_url) throw new ServiceError("bad_request", "webhook_url é obrigatório para flows do tipo webhook.")

  // Prevent duplicate: same webhook_url on the same webhook
  const duplicate = await prisma.webhookFlow.findFirst({
    where: { webhook_id: webhookId, webhook_url: params.webhook_url, deleted_at: null },
    select: { id: true },
  })
  if (duplicate) throw new ServiceError("conflict", "Esta URL já está adicionada a este webhook.")

  const flow = await prisma.webhookFlow.create({
    data: {
      webhook_id: webhookId,
      tipo: "webhook",
      webhook_url: params.webhook_url,
      flow_nome: params.flow_nome || null,
      ordem,
    },
    select: {
      id: true,
      webhook_id: true,
      tipo: true,
      flow_ns: true,
      flow_nome: true,
      webhook_url: true,
      ordem: true,
      total_enviados: true,
      status: true,
      tag_manychat_id: true,
      tag_manychat_nome: true,
      created_at: true,
      conta: { select: { id: true, nome: true, page_name: true } },
    },
  })

  return { data: flow, message: "Flow adicionado com sucesso." }
}

export interface AtualizarFlowParams {
  flow_ns?: string
  flow_nome?: string | null
  ordem?: number
  status?: "ativo" | "inativo"
}

export async function atualizarFlow(id: string, params: AtualizarFlowParams) {
  const existing = await prisma.webhookFlow.findFirst({ where: { id, deleted_at: null } })
  if (!existing) throw new ServiceError("not_found", "Flow não encontrado.")

  const { flow_ns, flow_nome, ordem, status } = params

  const flow = await prisma.webhookFlow.update({
    where: { id },
    data: {
      ...(flow_ns !== undefined && { flow_ns }),
      ...(flow_nome !== undefined && { flow_nome }),
      ...(ordem !== undefined && { ordem }),
      ...(status !== undefined && { status }),
    },
    select: {
      id: true,
      webhook_id: true,
      tipo: true,
      flow_ns: true,
      flow_nome: true,
      webhook_url: true,
      ordem: true,
      total_enviados: true,
      status: true,
      updated_at: true,
      conta: { select: { id: true, nome: true, page_name: true } },
    },
  })

  return { data: flow, message: "Flow atualizado com sucesso." }
}

export async function removerFlow(id: string) {
  const existing = await prisma.webhookFlow.findFirst({ where: { id, deleted_at: null } })
  if (!existing) throw new ServiceError("not_found", "Flow não encontrado.")

  await prisma.webhookFlow.update({ where: { id }, data: { deleted_at: new Date() } })

  return { message: "Flow removido com sucesso." }
}

export async function reordenarFlows(webhookId: string, flowIds: string[]) {
  const webhook = await prisma.webhook.findFirst({ where: { id: webhookId, deleted_at: null } })
  if (!webhook) throw new ServiceError("not_found", "Webhook não encontrado.")

  await Promise.all(
    flowIds.map((flowId, index) =>
      prisma.webhookFlow.updateMany({
        where: { id: flowId, webhook_id: webhookId, deleted_at: null },
        data: { ordem: index },
      })
    )
  )

  return { message: "Flows reordenados com sucesso." }
}
