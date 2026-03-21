import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, badRequest, forbidden, notFound, serverError } from "@/lib/api/response"
import { prisma } from "@/lib/db/prisma"
import { verifyCustomFieldId } from "@/lib/manychat/client"

const schema = z.object({
  field_id: z.number().int().positive(),
})

// POST /api/admin/contas/[id]/verify-field
// Verifica se um field_id existe na conta Manychat.
// Usa a api_key da conta (nunca exposta no frontend).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "contas:read")) return forbidden("Sem permissão.")

    const { id } = await params
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest("field_id deve ser um número inteiro positivo.")

    const conta = await prisma.contaManychat.findUnique({
      where: { id },
      select: { api_key: true },
    })
    if (!conta) return notFound("Conta não encontrada.")

    const result = await verifyCustomFieldId(conta.api_key, parsed.data.field_id)
    return ok(result)
  } catch (error) {
    console.error("[POST /api/admin/contas/[id]/verify-field]", error)
    return serverError()
  }
}
