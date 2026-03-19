import { NextRequest } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError } from "@/lib/api/response"

// GET /api/admin/leads
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "leads:read")) return forbidden("Sem permissão.")

    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get("page") || "1", 10)
    const perPage = parseInt(searchParams.get("per_page") || "20", 10)
    const search = searchParams.get("q") || ""
    const status = searchParams.get("status") || ""
    const webhookId = searchParams.get("webhook_id") || ""

    const where = {
      ...(search && {
        OR: [
          { nome: { contains: search, mode: "insensitive" as const } },
          { telefone: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(status && status !== "todos" && { status: status as "pendente" | "processando" | "sucesso" | "falha" }),
      ...(webhookId && { webhook_id: webhookId }),
    }

    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        select: {
          id: true,
          nome: true,
          telefone: true,
          email: true,
          status: true,
          erro_msg: true,
          tentativas: true,
          processado_at: true,
          created_at: true,
          webhook: { select: { id: true, nome: true } },
        },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ])

    return ok({
      leads,
      pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
    })
  } catch (error) {
    console.error("[GET /api/admin/leads]", error)
    return serverError()
  }
}
