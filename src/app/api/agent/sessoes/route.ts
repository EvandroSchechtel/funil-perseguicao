import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, serverError } from "@/lib/api/response"
import { prisma } from "@/lib/db/prisma"

// GET /api/agent/sessoes — histórico de sessões do usuário
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get("page") || "1", 10)
    const perPage = parseInt(searchParams.get("per_page") || "20", 10)

    const where = { usuario_id: user.id }

    const [total, sessoes] = await Promise.all([
      prisma.agentSessao.count({ where }),
      prisma.agentSessao.findMany({
        where,
        select: {
          id: true,
          prompt: true,
          resposta: true,
          status: true,
          created_at: true,
          updated_at: true,
          _count: { select: { acoes: true } },
        },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ])

    return ok({
      sessoes: sessoes.map((s) => ({ ...s, acoes_count: s._count.acoes, _count: undefined })),
      pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
    })
  } catch (error) {
    console.error("[GET /api/agent/sessoes]", error)
    return serverError()
  }
}
