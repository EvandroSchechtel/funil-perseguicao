import { prisma } from "@/lib/db/prisma"
import { testZApiConnection, configureWebhook } from "@/lib/zapi/client"
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
  conta_manychat_id: string
  nome_filtro: string
  tag_manychat_id: number
  tag_manychat_nome: string
}

export async function criarGrupo(data: CriarGrupoParams) {
  // Validate instancia exists
  const inst = await prisma.instanciaZApi.findFirst({ where: { id: data.instancia_id, deleted_at: null } })
  if (!inst) throw new ServiceError("not_found", "Instância não encontrada.")

  // Check unique constraint
  const existing = await prisma.grupoMonitoramento.findFirst({
    where: { campanha_id: data.campanha_id, instancia_id: data.instancia_id },
  })
  if (existing) {
    throw new ServiceError("conflict", "Já existe um grupo monitorado para esta campanha nesta instância.")
  }

  const grupo = await prisma.grupoMonitoramento.create({
    data,
    include: {
      campanha: { select: { id: true, nome: true } },
      conta_manychat: { select: { id: true, nome: true } },
    },
  })

  return { grupo, message: "Grupo configurado com sucesso." }
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

export async function listarEntradas(instanciaId: string, grupoId?: string) {
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
    take: 200,
  })
}
