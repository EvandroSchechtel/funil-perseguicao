import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, badRequest, serverError } from "@/lib/api/response"
import { reprocessarSelecionados } from "@/lib/services/leads.service"

const schema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(200),
})

// POST /api/admin/leads/reprocessar-selecionados
export async function POST(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "leads:reprocess")) return forbidden("Sem permissão.")

    const body = await request.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest("leadIds deve ser um array de UUIDs válidos.")

    const result = await reprocessarSelecionados(parsed.data.leadIds)
    return ok(result)
  } catch (error) {
    console.error("[POST /api/admin/leads/reprocessar-selecionados]", error)
    return serverError()
  }
}
