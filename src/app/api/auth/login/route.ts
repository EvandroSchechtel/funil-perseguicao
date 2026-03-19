import { NextRequest } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db/prisma"
import { signAccessToken } from "@/lib/auth/jwt"
import { createRefreshToken } from "@/lib/auth/refresh-token"
import {
  isBlocked,
  recordFailedAttempt,
  clearAttempts,
  loginRateLimitKey,
} from "@/lib/auth/rate-limit"
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  tooManyRequests,
  serverError,
} from "@/lib/api/response"

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
  rememberMe: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { email, password, rememberMe } = parsed.data
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
    const rateLimitKey = loginRateLimitKey(ip, email)

    // Check rate limit before even touching DB
    if (isBlocked(rateLimitKey)) {
      return tooManyRequests("Muitas tentativas. Tente novamente em 5 minutos.")
    }

    const usuario = await prisma.usuario.findFirst({
      where: { email: email.toLowerCase(), deleted_at: null },
    })

    if (!usuario) {
      recordFailedAttempt(rateLimitKey)
      return unauthorized("Email ou senha incorretos.")
    }

    if (usuario.status === "inativo") {
      return forbidden("Sua conta foi desativada. Entre em contato com o administrador.", "account_disabled")
    }

    const passwordMatch = await bcrypt.compare(password, usuario.senha)
    if (!passwordMatch) {
      const { blocked } = recordFailedAttempt(rateLimitKey)
      if (blocked) {
        return tooManyRequests("Muitas tentativas. Tente novamente em 5 minutos.")
      }
      return unauthorized("Email ou senha incorretos.")
    }

    // Success — clear rate limit
    clearAttempts(rateLimitKey)

    // Update last login
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimo_login: new Date() },
    })

    // Generate tokens
    const accessToken = await signAccessToken({
      id: usuario.id,
      email: usuario.email,
      role: usuario.role,
      force_password_change: usuario.force_password_change,
    })

    const refreshToken = await createRefreshToken(usuario.id, rememberMe)

    const response = ok({
      access_token: accessToken,
      expires_in: 900,
      user: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
        avatar_url: usuario.avatar_url,
        force_password_change: usuario.force_password_change,
      },
    })

    // Set refresh token as HttpOnly cookie
    const cookieOptions = [
      `rt=${refreshToken}`,
      "HttpOnly",
      "Path=/",
      "SameSite=Strict",
      process.env.NODE_ENV === "production" ? "Secure" : "",
      rememberMe ? "Max-Age=2592000" : "Max-Age=604800", // 30 days or 7 days
    ]
      .filter(Boolean)
      .join("; ")

    response.headers.set("Set-Cookie", cookieOptions)

    return response
  } catch (error) {
    console.error("[POST /api/auth/login]", error)
    return serverError()
  }
}
