import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import type { LeadStatus } from "@/generated/prisma/client"

function escapeCsv(value: string | null | undefined): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// GET /api/admin/leads/export — download CSV with current filters
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "dados:export")) {
      return new NextResponse("Sem permissão.", { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const statusParam = searchParams.get("status")
    const webhookId = searchParams.get("webhook_id")
    const search = searchParams.get("q") || ""

    const validStatuses: LeadStatus[] = ["pendente", "processando", "sucesso", "falha"]
    const statusFilter =
      statusParam && statusParam !== "todos" && validStatuses.includes(statusParam as LeadStatus)
        ? (statusParam as LeadStatus)
        : undefined

    const where = {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(webhookId ? { webhook_id: webhookId } : {}),
      ...(search && {
        OR: [
          { nome: { contains: search, mode: "insensitive" as const } },
          { telefone: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    }

    const leads = await prisma.lead.findMany({
      where,
      select: {
        id: true,
        nome: true,
        telefone: true,
        email: true,
        status: true,
        tentativas: true,
        created_at: true,
        processado_at: true,
        erro_msg: true,
        webhook: { select: { nome: true } },
      },
      orderBy: { created_at: "desc" },
      take: 10000, // safety limit
    })

    const date = new Date().toISOString().slice(0, 10)
    const csvHeaders = [
      "id",
      "nome",
      "telefone",
      "email",
      "status",
      "webhook",
      "tentativas",
      "recebido_em",
      "processado_em",
      "erro_msg",
    ]

    const rows = leads.map((l) =>
      [
        escapeCsv(l.id),
        escapeCsv(l.nome),
        escapeCsv(l.telefone),
        escapeCsv(l.email),
        escapeCsv(l.status),
        escapeCsv(l.webhook.nome),
        escapeCsv(String(l.tentativas)),
        escapeCsv(l.created_at.toISOString()),
        escapeCsv(l.processado_at?.toISOString()),
        escapeCsv(l.erro_msg),
      ].join(",")
    )

    const csv = [csvHeaders.join(","), ...rows].join("\n")

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
      },
    })
  } catch (error) {
    console.error("[GET /api/admin/leads/export]", error)
    return new NextResponse("Erro interno.", { status: 500 })
  }
}
