import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, badRequest, forbidden, serverError } from "@/lib/api/response"
import { testManychatConnection } from "@/lib/manychat/client"

const schema = z.object({
  api_key: z.string().min(1),
})

// POST /api/admin/contas/testar-key — testa uma API key sem criar conta
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
    if (!parsed.success) return badRequest("API Key inválida.")

    const result = await testManychatConnection(parsed.data.api_key)

    if (result.ok) {
      return ok({ ok: true, page_name: result.page_name, page_id: result.page_id })
    } else {
      return ok({ ok: false, message: result.error || "Falha na conexão com Manychat." })
    }
  } catch (error) {
    console.error("[POST /api/admin/contas/testar-key]", error)
    return serverError()
  }
}
