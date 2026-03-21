import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, serverError } from "@/lib/api/response"
import { prisma } from "@/lib/db/prisma"

// GET /api/admin/alertas — alertas ativos + últimos 10 resolvidos
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "leads:read")) return forbidden("Sem permissão.")

    const [ativos, resolvidos] = await Promise.all([
      prisma.alertaSistema.findMany({
        where: { resolvido_at: null },
        orderBy: { created_at: "desc" },
      }),
      prisma.alertaSistema.findMany({
        where: { resolvido_at: { not: null } },
        orderBy: { resolvido_at: "desc" },
        take: 10,
      }),
    ])

    return ok({ ativos, resolvidos })
  } catch (error) {
    console.error("[GET /api/admin/alertas]", error)
    return serverError()
  }
}
