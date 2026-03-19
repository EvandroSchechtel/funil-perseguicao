import { prisma } from "@/lib/db/prisma"
import { testManychatConnection } from "@/lib/manychat/client"
import { ServiceError } from "./errors"

export interface ListClientesParams {
  page?: number
  perPage?: number
  search?: string
}

export async function listarClientes(params: ListClientesParams = {}) {
  const { page = 1, perPage = 20, search = "" } = params

  const where = {
    deleted_at: null,
    ...(search && {
      OR: [
        { nome: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  }

  const [total, clientes] = await Promise.all([
    prisma.cliente.count({ where }),
    prisma.cliente.findMany({
      where,
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        created_at: true,
        _count: { select: { contas_manychat: true, campanhas: true } },
      },
      orderBy: { nome: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ])

  const data = clientes.map((c) => ({
    ...c,
    contas_count: c._count.contas_manychat,
    campanhas_count: c._count.campanhas,
    _count: undefined,
  }))

  return {
    data,
    pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
  }
}

export async function buscarCliente(id: string) {
  const cliente = await prisma.cliente.findFirst({
    where: { id, deleted_at: null },
    select: {
      id: true,
      nome: true,
      email: true,
      telefone: true,
      created_at: true,
      updated_at: true,
      contas_manychat: {
        where: { deleted_at: null },
        select: { id: true, nome: true, page_name: true, status: true },
        orderBy: { nome: "asc" },
      },
      _count: { select: { campanhas: true } },
    },
  })

  if (!cliente) throw new ServiceError("not_found", "Cliente não encontrado.")

  return {
    data: {
      ...cliente,
      campanhas_count: cliente._count.campanhas,
      _count: undefined,
    },
  }
}

export interface PrimeiraContaParams {
  nome: string
  api_key: string
}

export interface CriarClienteParams {
  nome: string
  email?: string
  telefone?: string
  userId: string
  primeira_conta: PrimeiraContaParams
}

export async function criarCliente({ nome, email, telefone, userId, primeira_conta }: CriarClienteParams) {
  // Validate API key before touching the database
  const connection = await testManychatConnection(primeira_conta.api_key)
  if (!connection.ok) {
    throw new ServiceError("bad_request", connection.error || "Falha ao conectar com a API Manychat.")
  }

  const result = await prisma.$transaction(async (tx) => {
    const cliente = await tx.cliente.create({
      data: {
        nome,
        email: email || null,
        telefone: telefone || null,
        created_by: userId,
      },
    })

    const conta = await tx.contaManychat.create({
      data: {
        nome: primeira_conta.nome,
        api_key: primeira_conta.api_key,
        page_id: connection.page_id,
        page_name: connection.page_name,
        ultimo_sync: new Date(),
        created_by: userId,
        cliente_id: cliente.id,
      },
      select: { id: true, nome: true, page_name: true },
    })

    return { cliente, conta }
  })

  return {
    data: { id: result.cliente.id, nome: result.cliente.nome, email: result.cliente.email, telefone: result.cliente.telefone },
    conta: result.conta,
    message: `Cliente criado com sucesso. Conta Manychat conectada: ${connection.page_name || primeira_conta.nome}`,
  }
}

export async function adicionarContaAoCliente(clienteId: string, params: PrimeiraContaParams & { userId: string }) {
  const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, deleted_at: null } })
  if (!cliente) throw new ServiceError("not_found", "Cliente não encontrado.")

  const connection = await testManychatConnection(params.api_key)
  if (!connection.ok) {
    throw new ServiceError("bad_request", connection.error || "Falha ao conectar com a API Manychat.")
  }

  const conta = await prisma.contaManychat.create({
    data: {
      nome: params.nome,
      api_key: params.api_key,
      page_id: connection.page_id,
      page_name: connection.page_name,
      ultimo_sync: new Date(),
      created_by: params.userId,
      cliente_id: clienteId,
    },
    select: { id: true, nome: true, page_name: true, status: true },
  })

  return {
    data: conta,
    message: `Conta conectada: ${connection.page_name || params.nome}`,
  }
}

export interface AtualizarClienteParams {
  nome?: string
  email?: string | null
  telefone?: string | null
}

export async function atualizarCliente(id: string, params: AtualizarClienteParams) {
  const existing = await prisma.cliente.findFirst({ where: { id, deleted_at: null } })
  if (!existing) throw new ServiceError("not_found", "Cliente não encontrado.")

  const cliente = await prisma.cliente.update({
    where: { id },
    data: {
      ...(params.nome !== undefined && { nome: params.nome }),
      ...(params.email !== undefined && { email: params.email }),
      ...(params.telefone !== undefined && { telefone: params.telefone }),
    },
    select: { id: true, nome: true, email: true, telefone: true, updated_at: true },
  })

  return { data: cliente, message: "Cliente atualizado com sucesso." }
}

export async function deletarCliente(id: string) {
  const existing = await prisma.cliente.findFirst({
    where: { id, deleted_at: null },
    include: { _count: { select: { campanhas: true } } },
  })
  if (!existing) throw new ServiceError("not_found", "Cliente não encontrado.")

  if (existing._count.campanhas > 0) {
    throw new ServiceError("forbidden", "Não é possível excluir um cliente com campanhas vinculadas.")
  }

  await prisma.cliente.update({ where: { id }, data: { deleted_at: new Date() } })
  return { message: "Cliente removido com sucesso." }
}
