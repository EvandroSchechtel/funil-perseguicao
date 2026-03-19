import { NextRequest } from "next/server"
import { revokeRefreshToken } from "@/lib/auth/refresh-token"
import { ok, serverError } from "@/lib/api/response"

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

    if (token) {
      await revokeRefreshToken(token)
    }

    const response = ok({ message: "Logout realizado com sucesso" })
    // Clear the cookie
    response.headers.set(
      "Set-Cookie",
      "rt=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0"
    )

    return response
  } catch (error) {
    console.error("[POST /api/auth/logout]", error)
    return serverError()
  }
}
