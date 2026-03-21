import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, badRequest, forbidden, serverError } from "@/lib/api/response"
import { ensureWhatsappIdField } from "@/lib/manychat/client"

const schema = z.object({
  api_key: z.string().min(1),
})

// POST /api/admin/contas/ensure-field
// Garante que o custom field [esc]whatsapp-id existe na conta Manychat.
// Cria o campo se não existir. Retorna o field_id.
export async function POST(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!["super_admin", "admin", "operador"].includes(user.role)) {
      return forbidden("Sem permissão.")
    }

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest("API Key é obrigatória.")

    const result = await ensureWhatsappIdField(parsed.data.api_key)

    if (result.ok) {
      return ok({
        ok: true,
        field_id: result.fieldId,
        already_existed: result.alreadyExisted,
        message: result.alreadyExisted
          ? `Campo já existe — ID: ${result.fieldId}`
          : `Campo criado com sucesso — ID: ${result.fieldId}`,
      })
    } else {
      return ok({ ok: false, message: result.error || "Erro ao criar o campo." })
    }
  } catch (error) {
    console.error("[POST /api/admin/contas/ensure-field]", error)
    return serverError()
  }
}
