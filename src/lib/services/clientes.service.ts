import { prisma } from "@/lib/db/prisma"
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

export interface CriarClienteParams {
  nome: string
  email?: string
  telefone?: string
  userId: string
}

export async function criarCliente({ nome, email, telefone, userId }: CriarClienteParams) {
  const cliente = await prisma.cliente.create({
    data: {
      nome,
      email: email || null,
      telefone: telefone || null,
      created_by: userId,
    },
    select: { id: true, nome: true, email: true, telefone: true, created_at: true },
  })

  return { data: cliente, message: "Cliente criado com sucesso." }
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
