import { NextRequest } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, notFound, serverError } from "@/lib/api/response"

// GET /api/admin/leads/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "leads:read")) return forbidden("Sem permissão.")

    const { id } = await params

    const lead = await prisma.lead.findUnique({
      where: { id },
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
        updated_at: true,
        webhook: {
          select: {
            id: true,
            nome: true,
            flow_ns: true,
            conta: { select: { id: true, nome: true } },
          },
        },
      },
    })

    if (!lead) return notFound("Lead não encontrado.")

    return ok({ lead })
  } catch (error) {
    console.error("[GET /api/admin/leads/[id]]", error)
    return serverError()
  }
}
