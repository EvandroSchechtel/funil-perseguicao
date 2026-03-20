import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, forbidden, serverError, handleServiceError, created } from "@/lib/api/response"
import { listarInstancias, criarInstancia } from "@/lib/services/zapi.service"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()
    const { searchParams } = request.nextUrl
    const clienteId = searchParams.get("cliente_id") || undefined
    const data = await listarInstancias(user.id, clienteId)
    return ok({ instancias: data })
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()

    const body = await request.json()
    const { nome, instance_id, token, client_token, cliente_id } = body

    if (!nome || !instance_id || !token || !client_token) {
      return (await import("@/lib/api/response")).badRequest("nome, instance_id, token e client_token são obrigatórios.")
    }

    // Segurança: cliente_id obrigatório e deve ser UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!cliente_id || !uuidRegex.test(cliente_id)) {
      return (await import("@/lib/api/response")).badRequest("Cliente é obrigatório para criar uma instância Z-API.")
    }

    const appBaseUrl = request.headers.get("x-forwarded-proto") && request.headers.get("host")
      ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("host")}`
      : process.env.NEXT_PUBLIC_ZAPI_URL || process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000"

    const result = await criarInstancia({ nome, instance_id, token, client_token, cliente_id, userId: user.id, appBaseUrl })
    return created(result)
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}
