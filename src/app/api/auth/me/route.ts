import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { prisma } from "@/lib/db/prisma"
import { ok, serverError } from "@/lib/api/response"

export async function GET(request: NextRequest) {
  try {
    const result = await getAuthContext(request)
    if ("error" in result) return result.error

    const { user } = result.context

    const usuario = await prisma.usuario.findFirst({
      where: { id: user.id, deleted_at: null },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        avatar_url: true,
        status: true,
        force_password_change: true,
        cliente_id: true,
        ultimo_login: true,
        created_at: true,
      },
    })

    if (!usuario) {
      return ok({ error: "not_found" }, 404)
    }

    return ok({ user: usuario })
  } catch (error) {
    console.error("[GET /api/auth/me]", error)
    return serverError()
  }
}
