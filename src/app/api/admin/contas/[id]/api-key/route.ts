import { NextRequest } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, notFound, serverError } from "@/lib/api/response"

// GET /api/admin/contas/[id]/api-key — revela a API key completa (requer api_keys:reveal)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "api_keys:reveal")) return forbidden("Sem permissão para revelar API keys.")

    const { id } = await params

    const conta = await prisma.contaManychat.findFirst({
      where: { id, deleted_at: null },
      select: { id: true, nome: true, api_key: true },
    })

    if (!conta) return notFound("Conta não encontrada.")

    return ok({ api_key: conta.api_key })
  } catch (error) {
    console.error("[GET /api/admin/contas/[id]/api-key]", error)
    return serverError()
  }
}
