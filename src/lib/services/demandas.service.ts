import { prisma } from "@/lib/db/prisma"
import { ServiceError } from "./errors"
import { TipoDemanda, StatusDemanda, PrioridadeDemanda } from "@/generated/prisma/client"
import {
  notificarNovaDemanda,
  notificarStatusDemanda,
  notificarComentarioDemanda,
} from "./notificacao-wa.service"

export interface ListarDemandasParams {
  clienteId?: string
  status?: string
  tipo?: string
  page?: number
  perPage?: number
}

const demandaSelect = {
  id: true,
  titulo: true,
  descricao: true,
  tipo: true,
  status: true,
  prioridade: true,
  cliente_id: true,
  cliente: { select: { id: true, nome: true } },
  criado_por: true,
  criador: { select: { id: true, nome: true, role: true } },
  atribuido_a: true,
  responsavel: { select: { id: true, nome: true } },
  grupo_wa_id: true,
  wa_msg_id_inicio: true,
  agente_ativo: true,
  resolvido_at: true,
  created_at: true,
  updated_at: true,
  _count: { select: { comentarios: true } },
} as const

// ── Helpers ────────────────────────────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  aberta: "Aberta",
  em_analise: "Em Análise",
  em_execucao: "Em Execução",
  aguardando_cliente: "Aguardando Cliente",
  concluida: "Concluída",
  cancelada: "Cancelada",
}

const prioridadeLabels: Record<string, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
}

async function registrarEvento(params: {
  demandaId: string
  tipo: string
  descricao: string
  usuarioId?: string | null
  meta?: Record<string, unknown>
}) {
  try {
    await prisma.demandaEvento.create({
      data: {
        demanda_id: params.demandaId,
        tipo: params.tipo,
        descricao: params.descricao,
        usuario_id: params.usuarioId ?? null,
        meta: params.meta ? (params.meta as import("@/generated/prisma/client").Prisma.InputJsonValue) : undefined,
      },
    })
  } catch {
    // best-effort — never throw
  }
}

// ── List / Detail ──────────────────────────────────────────────────────────────

export async function listarDemandas(params: ListarDemandasParams = {}) {
  const { clienteId, status, tipo, page = 1, perPage = 20 } = params

  const where: Record<string, unknown> = {}

  if (clienteId) where.cliente_id = clienteId
  if (status && Object.values(StatusDemanda).includes(status as StatusDemanda)) {
    where.status = status as StatusDemanda
  }
  if (tipo && Object.values(TipoDemanda).includes(tipo as TipoDemanda)) {
    where.tipo = tipo as TipoDemanda
  }

  const [total, demandas] = await Promise.all([
    prisma.demanda.count({ where }),
    prisma.demanda.findMany({
      where,
      select: demandaSelect,
      orderBy: [{ updated_at: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ])

  return {
    demandas,
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
  }
}

export async function buscarDemanda(id: string, clienteId?: string) {
  const demanda = await prisma.demanda.findFirst({
    where: {
      id,
      ...(clienteId ? { cliente_id: clienteId } : {}),
    },
    select: {
      ...demandaSelect,
      comentarios: {
        where: clienteId ? { interno: false } : {},
        select: {
          id: true,
          autor_id: true,
          texto: true,
          interno: true,
          created_at: true,
        },
        orderBy: { created_at: "asc" },
      },
    },
  })

  if (!demanda) throw new ServiceError("not_found", "Demanda não encontrada.")

  return { demanda }
}

export async function listarEventos(demandaId: string, clienteId?: string) {
  // If scoped to client, verify demanda belongs to them
  if (clienteId) {
    const demanda = await prisma.demanda.findFirst({
      where: { id: demandaId, cliente_id: clienteId },
      select: { id: true },
    })
    if (!demanda) throw new ServiceError("not_found", "Demanda não encontrada.")
  }

  const eventos = await prisma.demandaEvento.findMany({
    where: {
      demanda_id: demandaId,
      // For client view, hide internal comment events
      ...(clienteId
        ? {
            NOT: {
              AND: [{ tipo: "comentario" }, { meta: { path: ["interno"], equals: true } }],
            },
          }
        : {}),
    },
    select: {
      id: true,
      tipo: true,
      descricao: true,
      meta: true,
      usuario_id: true,
      usuario: { select: { id: true, nome: true } },
      created_at: true,
    },
    orderBy: { created_at: "asc" },
  })

  return { eventos }
}

// ── Create ─────────────────────────────────────────────────────────────────────

export interface CriarDemandaParams {
  titulo: string
  descricao: string
  tipo: TipoDemanda
  prioridade?: PrioridadeDemanda
  clienteId: string
  criadoPor: string
}

export async function criarDemanda(params: CriarDemandaParams) {
  const { titulo, descricao, tipo, prioridade, clienteId, criadoPor } = params

  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, deleted_at: null },
    select: { id: true },
  })
  if (!cliente) throw new ServiceError("not_found", "Cliente não encontrado.")

  const demanda = await prisma.demanda.create({
    data: {
      titulo,
      descricao,
      tipo,
      ...(prioridade ? { prioridade } : {}),
      cliente_id: clienteId,
      criado_por: criadoPor,
    },
    select: demandaSelect,
  })

  await registrarEvento({
    demandaId: demanda.id,
    tipo: "criada",
    descricao: "Demanda criada",
    usuarioId: criadoPor,
  })

  notificarNovaDemanda(demanda.id).catch(() => {})

  return { demanda, message: "Demanda criada com sucesso." }
}

// ── Update ─────────────────────────────────────────────────────────────────────

export interface AtualizarDemandaParams {
  status?: StatusDemanda
  prioridade?: PrioridadeDemanda
  atribuido_a?: string | null
  titulo?: string
  descricao?: string
  usuarioId?: string
}

export async function atualizarDemanda(id: string, data: AtualizarDemandaParams) {
  const existing = await prisma.demanda.findFirst({
    where: { id },
    select: { id: true, status: true, prioridade: true, atribuido_a: true, responsavel: { select: { nome: true } } },
  })
  if (!existing) throw new ServiceError("not_found", "Demanda não encontrada.")

  const isTerminal =
    data.status === StatusDemanda.concluida || data.status === StatusDemanda.cancelada

  const demanda = await prisma.demanda.update({
    where: { id },
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.prioridade !== undefined ? { prioridade: data.prioridade } : {}),
      ...(data.atribuido_a !== undefined ? { atribuido_a: data.atribuido_a } : {}),
      ...(data.titulo !== undefined ? { titulo: data.titulo } : {}),
      ...(data.descricao !== undefined ? { descricao: data.descricao } : {}),
      ...(isTerminal ? { resolvido_at: new Date() } : {}),
    },
    select: { ...demandaSelect, responsavel: { select: { id: true, nome: true } } },
  })

  // Log events for each change
  const eventPromises: Promise<void>[] = []

  if (data.status && data.status !== existing.status) {
    eventPromises.push(
      registrarEvento({
        demandaId: id,
        tipo: "status_alterado",
        descricao: `Status alterado de "${statusLabels[existing.status] ?? existing.status}" para "${statusLabels[data.status] ?? data.status}"`,
        usuarioId: data.usuarioId,
        meta: { de: existing.status, para: data.status },
      })
    )
    notificarStatusDemanda(demanda.id, data.status).catch(() => {})
  }

  if (data.prioridade && data.prioridade !== existing.prioridade) {
    eventPromises.push(
      registrarEvento({
        demandaId: id,
        tipo: "prioridade_alterada",
        descricao: `Prioridade alterada para "${prioridadeLabels[data.prioridade] ?? data.prioridade}"`,
        usuarioId: data.usuarioId,
        meta: { de: existing.prioridade, para: data.prioridade },
      })
    )
  }

  if (data.atribuido_a !== undefined && data.atribuido_a !== existing.atribuido_a) {
    const nomeNovo = demanda.responsavel?.nome ?? "ninguém"
    eventPromises.push(
      registrarEvento({
        demandaId: id,
        tipo: "atribuido",
        descricao: data.atribuido_a
          ? `Demanda atribuída a ${nomeNovo}`
          : "Atribuição removida",
        usuarioId: data.usuarioId,
        meta: { usuario_id: data.atribuido_a, nome: nomeNovo },
      })
    )
  }

  await Promise.all(eventPromises)

  return { demanda, message: "Demanda atualizada com sucesso." }
}

// ── Comment ────────────────────────────────────────────────────────────────────

export interface AdicionarComentarioParams {
  demandaId: string
  autorId: string
  texto: string
  interno?: boolean
}

export async function adicionarComentario(params: AdicionarComentarioParams) {
  const { demandaId, autorId, texto, interno = false } = params

  const demanda = await prisma.demanda.findFirst({
    where: { id: demandaId },
    select: { id: true },
  })
  if (!demanda) throw new ServiceError("not_found", "Demanda não encontrada.")

  const comentario = await prisma.comentarioDemanda.create({
    data: {
      demanda_id: demandaId,
      autor_id: autorId,
      texto,
      interno,
    },
    select: {
      id: true,
      demanda_id: true,
      autor_id: true,
      texto: true,
      interno: true,
      created_at: true,
    },
  })

  await registrarEvento({
    demandaId,
    tipo: "comentario",
    descricao: interno ? "Comentário interno adicionado" : texto.slice(0, 120),
    usuarioId: autorId,
    meta: { comentario_id: comentario.id, interno },
  })

  if (!interno) {
    notificarComentarioDemanda(demandaId, comentario.id).catch(() => {})
  }

  return { comentario }
}
