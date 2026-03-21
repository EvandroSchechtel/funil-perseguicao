import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { prisma } from "@/lib/db/prisma"

// GET /api/admin/clientes/[id]/contatos
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "campanhas:read")) return forbidden("Sem permissão.")

    const { id } = await params
    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get("page") || "1", 10)
    const perPage = parseInt(searchParams.get("per_page") || "20", 10)
    const search = searchParams.get("q") || ""

    const where = {
      leads: { some: { campanha: { cliente_id: id, deleted_at: null } } },
      ...(search && {
        OR: [
          { nome: { contains: search, mode: "insensitive" as const } },
          { telefone: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    }

    const [total, contatos] = await Promise.all([
      prisma.contato.count({ where }),
      prisma.contato.findMany({
        where,
        select: {
          id: true,
          nome: true,
          telefone: true,
          email: true,
          created_at: true,
          leads: {
            where: { campanha: { cliente_id: id, deleted_at: null } },
            select: {
              id: true,
              status: true,
              grupo_entrou_at: true,
              campanha: { select: { id: true, nome: true } },
            },
            orderBy: { created_at: "desc" },
          },
        },
        orderBy: { nome: "asc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ])

    return ok({
      contatos,
      pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
    })
  } catch (error) {
    console.error("[GET /api/admin/clientes/[id]/contatos]", error)
    return handleServiceError(error) ?? serverError()
  }
}
