import { prisma } from "@/lib/db/prisma"
import { ServiceError } from "./errors"

export interface ListContatosParams {
  page?: number
  perPage?: number
  search?: string
}

export async function listarContatos(params: ListContatosParams = {}) {
  const { page = 1, perPage = 20, search = "" } = params

  const where = search
    ? {
        OR: [
          { telefone: { contains: search, mode: "insensitive" as const } },
          { nome: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {}

  const [total, contatos] = await Promise.all([
    prisma.contato.count({ where }),
    prisma.contato.findMany({
      where,
      select: {
        id: true,
        telefone: true,
        nome: true,
        email: true,
        created_at: true,
        updated_at: true,
        _count: { select: { leads: true, contas_vinculadas: true } },
        contas_vinculadas: {
          select: {
            subscriber_id: true,
            campanha_id: true,
            conta: { select: { id: true, nome: true, page_name: true } },
          },
        },
      },
      orderBy: { updated_at: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ])

  const data = contatos.map((c) => ({
    ...c,
    leads_count: c._count.leads,
    contas_count: c._count.contas_vinculadas,
    _count: undefined,
  }))

  return {
    data,
    pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
  }
}

export async function buscarContato(id: string) {
  const contato = await prisma.contato.findUnique({
    where: { id },
    select: {
      id: true,
      telefone: true,
      nome: true,
      email: true,
      created_at: true,
      updated_at: true,
      contas_vinculadas: {
        select: {
          id: true,
          subscriber_id: true,
          campanha_id: true,
          created_at: true,
          updated_at: true,
          conta: { select: { id: true, nome: true, page_name: true } },
        },
      },
      leads: {
        select: {
          id: true,
          status: true,
          tentativas: true,
          processado_at: true,
          created_at: true,
          flow_executado: true,
          conta_nome: true,
          erro_msg: true,
          webhook: { select: { id: true, nome: true } },
          campanha: { select: { id: true, nome: true } },
        },
        orderBy: { created_at: "desc" },
      },
    },
  })

  if (!contato) throw new ServiceError("not_found", "Contato não encontrado.")
  return { data: contato }
}

export async function exportarContatos(search?: string) {
  const where = search
    ? {
        OR: [
          { telefone: { contains: search, mode: "insensitive" as const } },
          { nome: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {}

  const contatos = await prisma.contato.findMany({
    where,
    select: {
      telefone: true,
      nome: true,
      email: true,
      created_at: true,
      leads: {
        select: {
          status: true,
          tentativas: true,
          processado_at: true,
          flow_executado: true,
          conta_nome: true,
          erro_msg: true,
          webhook: { select: { nome: true } },
          campanha: { select: { nome: true } },
        },
        orderBy: { created_at: "asc" },
      },
      contas_vinculadas: {
        select: {
          subscriber_id: true,
          conta: { select: { nome: true, page_name: true } },
        },
      },
    },
    orderBy: { updated_at: "desc" },
    take: 50000,
  })

  function esc(v: string | null | undefined): string {
    if (!v) return ""
    if (v.includes(",") || v.includes('"') || v.includes("\n")) return `"${v.replace(/"/g, '""')}"`
    return v
  }

  const headers = [
    "telefone", "nome", "email",
    "campanha", "webhook", "conta_manychat", "subscriber_id",
    "flow_executado", "status", "tentativas",
    "processado_em", "erro_msg", "cadastrado_em",
  ]

  const rows: string[] = []

  for (const c of contatos) {
    if (c.leads.length === 0) {
      // Contact exists but has no leads yet
      rows.push([
        esc(c.telefone), esc(c.nome), esc(c.email),
        "", "", "", "",
        "", "", "0",
        "", "", esc(c.created_at.toISOString()),
      ].join(","))
    } else {
      for (const lead of c.leads) {
        const vinculo = c.contas_vinculadas.find((cv) => cv.conta.nome === lead.conta_nome)
        rows.push([
          esc(c.telefone), esc(c.nome), esc(c.email),
          esc(lead.campanha?.nome), esc(lead.webhook.nome),
          esc(lead.conta_nome), esc(vinculo?.subscriber_id),
          esc(lead.flow_executado), esc(lead.status), String(lead.tentativas),
          esc(lead.processado_at?.toISOString()), esc(lead.erro_msg),
          esc(c.created_at.toISOString()),
        ].join(","))
      }
    }
  }

  return [headers.join(","), ...rows].join("\n")
}
