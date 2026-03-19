import { NextRequest } from "next/server"
import { signAccessToken } from "@/lib/auth/jwt"
import { validateRefreshToken } from "@/lib/auth/refresh-token"
import { ok, unauthorized, serverError } from "@/lib/api/response"

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie") || ""
    const token = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("rt="))
      ?.split("=")
      .slice(1)
      .join("=")

    if (!token) {
      return unauthorized("Refresh token não encontrado")
    }

    const record = await validateRefreshToken(token)
    if (!record) {
      return unauthorized("Refresh token inválido ou expirado", "token_expired")
    }

    const accessToken = await signAccessToken({
      id: record.usuario.id,
      email: record.usuario.email,
      role: record.usuario.role,
      force_password_change: record.usuario.force_password_change,
    })

    return ok({ access_token: accessToken, expires_in: 900 })
  } catch (error) {
    console.error("[POST /api/auth/refresh]", error)
    return serverError()
  }
}
