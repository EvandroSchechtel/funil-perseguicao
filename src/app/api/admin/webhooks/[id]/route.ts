import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, badRequest, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { buscarWebhook, atualizarWebhook, deletarWebhook } from "@/lib/services/webhooks.service"

const updateWebhookSchema = z.object({
  nome: z.string().min(1).max(100).optional(),
  flow_ns: z.string().min(1).optional(),
  flow_nome: z.string().max(200).optional(),
  status: z.enum(["ativo", "inativo"]).optional(),
})

// GET /api/admin/webhooks/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "webhooks:write")) return forbidden("Sem permissão.")

    const { id } = await params
    const result = await buscarWebhook(id)
    return ok(result)
  } catch (error) {
    console.error("[GET /api/admin/webhooks/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}

// PUT /api/admin/webhooks/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "webhooks:write")) return forbidden("Sem permissão.")

    const { id } = await params
    const body = await request.json()
    const parsed = updateWebhookSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const result = await atualizarWebhook(id, parsed.data)
    return ok(result)
  } catch (error) {
    console.error("[PUT /api/admin/webhooks/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}

// DELETE /api/admin/webhooks/[id] — soft delete
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "webhooks:delete")) return forbidden("Sem permissão.")

    const { id } = await params
    const result = await deletarWebhook(id)
    return ok(result)
  } catch (error) {
    console.error("[DELETE /api/admin/webhooks/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}
