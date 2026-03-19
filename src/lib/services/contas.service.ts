import { prisma } from "@/lib/db/prisma"
import { testManychatConnection, maskApiKey } from "@/lib/manychat/client"
import { ServiceError } from "./errors"

export interface ListContasParams {
  page?: number
  perPage?: number
  search?: string
  status?: string
}

export async function listarContas(params: ListContasParams = {}) {
  const { page = 1, perPage = 20, search = "", status } = params

  const where = {
    deleted_at: null,
    ...(status === "ativo" || status === "inativo" ? { status: status as "ativo" | "inativo" } : {}),
    ...(search && {
      OR: [
        { nome: { contains: search, mode: "insensitive" as const } },
        { page_name: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  }

  const [total, contas] = await Promise.all([
    prisma.contaManychat.count({ where }),
    prisma.contaManychat.findMany({
      where,
      select: {
        id: true,
        nome: true,
        api_key: true,
        page_id: true,
        page_name: true,
        status: true,
        ultimo_sync: true,
        created_at: true,
        usuario: { select: { nome: true } },
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ])

  const contasSafe = contas.map((c) => ({
    ...c,
    api_key: undefined,
    api_key_hint: maskApiKey(c.api_key),
  }))

  return {
    contas: contasSafe,
    pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
  }
}

export async function buscarConta(id: string) {
  const conta = await prisma.contaManychat.findFirst({
    where: { id, deleted_at: null },
    select: {
      id: true,
      nome: true,
      api_key: true,
      page_id: true,
      page_name: true,
      status: true,
      ultimo_sync: true,
      created_at: true,
      updated_at: true,
      usuario: { select: { id: true, nome: true } },
    },
  })

  if (!conta) throw new ServiceError("not_found", "Conta não encontrada.")

  return {
    conta: {
      ...conta,
      api_key: undefined,
      api_key_hint: maskApiKey(conta.api_key),
    },
  }
}

export interface CriarContaParams {
  nome: string
  api_key: string
  status?: "ativo" | "inativo"
  userId: string
}

export async function criarConta({ nome, api_key, status = "ativo", userId }: CriarContaParams) {
  const connection = await testManychatConnection(api_key)
  if (!connection.ok) {
    throw new ServiceError("bad_request", connection.error || "Falha ao conectar com a API Manychat.")
  }

  const conta = await prisma.contaManychat.create({
    data: {
      nome,
      api_key,
      page_id: connection.page_id,
      page_name: connection.page_name,
      status,
      ultimo_sync: new Date(),
      created_by: userId,
    },
    select: {
      id: true,
      nome: true,
      page_id: true,
      page_name: true,
      status: true,
      ultimo_sync: true,
      created_at: true,
    },
  })

  return {
    conta: { ...conta, api_key_hint: maskApiKey(api_key) },
    message: `Conta conectada com sucesso! Página: ${connection.page_name}`,
  }
}

export interface AtualizarContaParams {
  nome?: string
  api_key?: string
  status?: "ativo" | "inativo"
  whatsapp_field_id?: number | null
}

export async function atualizarConta(id: string, data: AtualizarContaParams) {
  const existing = await prisma.contaManychat.findFirst({ where: { id, deleted_at: null } })
  if (!existing) throw new ServiceError("not_found", "Conta não encontrada.")

  const { nome, api_key, status, whatsapp_field_id } = data
  let page_id = existing.page_id
  let page_name = existing.page_name
  let ultimo_sync = existing.ultimo_sync

  if (api_key && api_key !== existing.api_key) {
    const connection = await testManychatConnection(api_key)
    if (!connection.ok) {
      throw new ServiceError("bad_request", connection.error || "Falha ao conectar com a nova API Key.")
    }
    page_id = connection.page_id ?? null
    page_name = connection.page_name ?? null
    ultimo_sync = new Date()
  }

  const conta = await prisma.contaManychat.update({
    where: { id },
    data: {
      ...(nome && { nome }),
      ...(api_key && { api_key }),
      ...(status && { status }),
      ...(whatsapp_field_id !== undefined && { whatsapp_field_id }),
      page_id,
      page_name,
      ultimo_sync,
    },
    select: {
      id: true,
      nome: true,
      page_id: true,
      page_name: true,
      status: true,
      ultimo_sync: true,
      updated_at: true,
    },
  })

  return { conta, message: "Conta atualizada com sucesso." }
}

export async function deletarConta(id: string) {
  const existing = await prisma.contaManychat.findFirst({ where: { id, deleted_at: null } })
  if (!existing) throw new ServiceError("not_found", "Conta não encontrada.")

  await prisma.contaManychat.update({ where: { id }, data: { deleted_at: new Date() } })

  return { message: "Conta removida com sucesso." }
}

export async function toggleConta(id: string) {
  const existing = await prisma.contaManychat.findFirst({ where: { id, deleted_at: null } })
  if (!existing) throw new ServiceError("not_found", "Conta não encontrada.")

  const novoStatus = existing.status === "ativo" ? "inativo" : "ativo"

  const conta = await prisma.contaManychat.update({
    where: { id },
    data: { status: novoStatus },
    select: { id: true, status: true },
  })

  return {
    conta,
    message: `Conta ${novoStatus === "ativo" ? "ativada" : "desativada"} com sucesso.`,
  }
}

export async function testarConta(id: string) {
  const conta = await prisma.contaManychat.findFirst({ where: { id, deleted_at: null } })
  if (!conta) throw new ServiceError("not_found", "Conta não encontrada.")

  const result = await testManychatConnection(conta.api_key)

  if (result.ok) {
    await prisma.contaManychat.update({
      where: { id },
      data: { page_id: result.page_id, page_name: result.page_name, ultimo_sync: new Date() },
    })
  }

  return {
    ok: result.ok,
    page_name: result.page_name,
    page_id: result.page_id,
    error: result.error,
    message: result.ok
      ? `Conexão OK! Página: ${result.page_name}`
      : `Falha na conexão: ${result.error}`,
  }
}

export async function revelarApiKey(id: string) {
  const conta = await prisma.contaManychat.findFirst({
    where: { id, deleted_at: null },
    select: { id: true, nome: true, api_key: true },
  })

  if (!conta) throw new ServiceError("not_found", "Conta não encontrada.")

  return { api_key: conta.api_key }
}
