import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, badRequest, forbidden, serverError } from "@/lib/api/response"
import { getWhatsappIdFieldId } from "@/lib/manychat/client"

const schema = z.object({
  api_key: z.string().min(1),
})

// POST /api/admin/contas/lookup-field
// Looks up the [esc]whatsapp-id custom field ID in a Manychat account.
// Read-only — does NOT create the field.
// Used in new account forms to pre-fill the field ID automatically.
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

    const fieldId = await getWhatsappIdFieldId(parsed.data.api_key)

    if (fieldId) {
      return ok({ ok: true, field_id: fieldId })
    } else {
      return ok({ ok: false, message: "Campo [esc]whatsapp-id não encontrado nesta conta." })
    }
  } catch (error) {
    console.error("[POST /api/admin/contas/lookup-field]", error)
    return serverError()
  }
}
