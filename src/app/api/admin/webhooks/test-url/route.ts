import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, badRequest, forbidden, serverError } from "@/lib/api/response"

const schema = z.object({
  url: z.string().url("URL inválida"),
})

// POST /api/admin/webhooks/test-url
// Sends a test HTTP POST to an external webhook URL and returns the result.
export async function POST(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!["super_admin", "admin", "operador"].includes(user.role)) return forbidden("Sem permissão.")

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return badRequest("URL inválida", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { url } = parsed.data

    const testPayload = {
      lead_id: "test-00000000-0000-0000-0000-000000000000",
      nome: "Lead de Teste",
      telefone: "+5511999999999",
      email: "teste@exemplo.com",
      campanha_id: null,
      _teste: true,
    }

    let status: number
    let responseBody: string
    let ok_: boolean

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10_000),
      })
      status = res.status
      responseBody = await res.text().catch(() => "")
      ok_ = res.ok
    } catch (err) {
      return ok({
        ok: false,
        status: null,
        error: String(err),
        response: null,
      })
    }

    return ok({
      ok: ok_,
      status,
      response: responseBody.slice(0, 500),
      error: ok_ ? null : `HTTP ${status}: ${responseBody.slice(0, 200)}`,
    })
  } catch (error) {
    console.error("[POST /api/admin/webhooks/test-url]", error)
    return serverError()
  }
}
