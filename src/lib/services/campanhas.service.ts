import { prisma } from "@/lib/db/prisma"
import { ServiceError } from "./errors"

export interface ListCampanhasParams {
  page?: number
  perPage?: number
  search?: string
  status?: "ativo" | "inativo"
}

export async function listarCampanhas(params: ListCampanhasParams = {}) {
  const { page = 1, perPage = 20, search = "", status } = params

  const where = {
    deleted_at: null,
    ...(status && { status }),
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
        data_inicio: true,
        data_fim: true,
        created_at: true,
        usuario: { select: { nome: true } },
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
  const campanha = await prisma.campanha.findFirst({
    where: { id, deleted_at: null },
    select: {
      id: true,
      nome: true,
      descricao: true,
      status: true,
      data_inicio: true,
      data_fim: true,
      created_at: true,
      updated_at: true,
      usuario: { select: { nome: true } },
      _count: { select: { webhooks: true, leads: true } },
    },
  })

  if (!campanha) throw new ServiceError("not_found", "Campanha não encontrada.")

  return {
    data: {
      ...campanha,
      webhooks_count: campanha._count.webhooks,
      leads_count: campanha._count.leads,
      _count: undefined,
    },
  }
}

export interface CriarCampanhaParams {
  nome: string
  descricao?: string
  data_inicio?: Date
  data_fim?: Date
  userId: string
}

export async function criarCampanha({ nome, descricao, data_inicio, data_fim, userId }: CriarCampanhaParams) {
  const campanha = await prisma.campanha.create({
    data: {
      nome,
      descricao: descricao || null,
      data_inicio: data_inicio || null,
      data_fim: data_fim || null,
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

  return { data: campanha, message: "Campanha criada com sucesso." }
}

export interface AtualizarCampanhaParams {
  nome?: string
  descricao?: string | null
  data_inicio?: Date | null
  data_fim?: Date | null
  status?: "ativo" | "inativo"
}

export async function atualizarCampanha(id: string, params: AtualizarCampanhaParams) {
  const existing = await prisma.campanha.findFirst({ where: { id, deleted_at: null } })
  if (!existing) throw new ServiceError("not_found", "Campanha não encontrada.")

  const { nome, descricao, data_inicio, data_fim, status } = params

  const campanha = await prisma.campanha.update({
    where: { id },
    data: {
      ...(nome !== undefined && { nome }),
      ...(descricao !== undefined && { descricao }),
      ...(data_inicio !== undefined && { data_inicio }),
      ...(data_fim !== undefined && { data_fim }),
      ...(status !== undefined && { status }),
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
