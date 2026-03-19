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
      flow_ns: true,
      flow_nome: true,
      ordem: true,
      total_enviados: true,
      status: true,
      created_at: true,
      updated_at: true,
      conta: { select: { id: true, nome: true, page_name: true } },
    },
    orderBy: { ordem: "asc" },
  })

  return { data: flows }
}

export interface AdicionarFlowParams {
  conta_id: string
  flow_ns: string
  flow_nome?: string
  ordem?: number
}

export async function adicionarFlow(webhookId: string, params: AdicionarFlowParams) {
  const webhook = await prisma.webhook.findFirst({ where: { id: webhookId, deleted_at: null } })
  if (!webhook) throw new ServiceError("not_found", "Webhook não encontrado.")

  const conta = await prisma.contaManychat.findFirst({
    where: { id: params.conta_id, status: "ativo", deleted_at: null },
  })
  if (!conta) throw new ServiceError("bad_request", "Conta Manychat não encontrada ou inativa.")

  let ordem = params.ordem
  if (ordem === undefined) {
    const last = await prisma.webhookFlow.findFirst({
      where: { webhook_id: webhookId, deleted_at: null },
      orderBy: { ordem: "desc" },
      select: { ordem: true },
    })
    ordem = last ? last.ordem + 1 : 0
  }

  const flow = await prisma.webhookFlow.create({
    data: {
      webhook_id: webhookId,
      conta_id: params.conta_id,
      flow_ns: params.flow_ns,
      flow_nome: params.flow_nome || null,
      ordem,
    },
    select: {
      id: true,
      webhook_id: true,
      flow_ns: true,
      flow_nome: true,
      ordem: true,
      total_enviados: true,
      status: true,
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
      flow_ns: true,
      flow_nome: true,
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
