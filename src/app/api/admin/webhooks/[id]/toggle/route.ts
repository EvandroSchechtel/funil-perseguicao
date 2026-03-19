import { NextRequest } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, notFound, serverError } from "@/lib/api/response"

// PATCH /api/admin/webhooks/[id]/toggle
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "webhooks:toggle")) return forbidden("Sem permissão.")

    const { id } = await params

    const existing = await prisma.webhook.findFirst({ where: { id, deleted_at: null } })
    if (!existing) return notFound("Webhook não encontrado.")

    const novoStatus = existing.status === "ativo" ? "inativo" : "ativo"

    const webhook = await prisma.webhook.update({
      where: { id },
      data: { status: novoStatus },
      select: { id: true, status: true },
    })

    return ok({
      webhook,
      message: `Webhook ${novoStatus === "ativo" ? "ativado" : "desativado"} com sucesso.`,
    })
  } catch (error) {
    console.error("[PATCH /api/admin/webhooks/[id]/toggle]", error)
    return serverError()
  }
}
