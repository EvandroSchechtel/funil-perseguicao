import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { buscarInstancia, atualizarInstancia, deletarInstancia } from "@/lib/services/zapi.service"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()
    const { id } = await params
    const inst = await buscarInstancia(id)
    const webhookToken = (inst as { webhook_token: string }).webhook_token
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
    return ok({
      instancia: inst,
      webhook_url: `${appBaseUrl}/api/webhook/zapi/${webhookToken}`,
    })
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()
    const { id } = await params
    const body = await request.json()
    const result = await atualizarInstancia(id, body)
    return ok(result)
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const ctx = await getAuthContext(request)
    if ("error" in ctx) return ctx.error
    const { user } = ctx.context
    if (!["super_admin", "admin"].includes(user.role)) return forbidden()
    const { id } = await params
    const result = await deletarInstancia(id)
    return ok(result)
  } catch (error) {
    return handleServiceError(error) ?? serverError()
  }
}
