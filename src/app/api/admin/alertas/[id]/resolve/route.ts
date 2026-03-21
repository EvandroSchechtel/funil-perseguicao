import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, notFound, serverError } from "@/lib/api/response"
import { prisma } from "@/lib/db/prisma"

type Ctx = { params: Promise<{ id: string }> }

// POST /api/admin/alertas/:id/resolve — resolve an alert manually
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "leads:read")) return forbidden("Sem permissão.")

    const { id } = await params

    const alerta = await prisma.alertaSistema.findUnique({ where: { id }, select: { id: true, resolvido_at: true } })
    if (!alerta) return notFound("Alerta não encontrado.")

    if (alerta.resolvido_at) return ok({ message: "Alerta já estava resolvido." })

    await prisma.alertaSistema.update({
      where: { id },
      data: { resolvido_at: new Date() },
    })

    return ok({ message: "Alerta resolvido." })
  } catch (error) {
    console.error("[POST /api/admin/alertas/:id/resolve]", error)
    return serverError()
  }
}
