import { NextRequest } from "next/server"
import { verifyAccessToken, type JwtPayload } from "@/lib/auth/jwt"
import { prisma } from "@/lib/db/prisma"
import { forbidden, unauthorized } from "@/lib/api/response"
import type { Role } from "@/lib/auth/rbac"

export interface AuthContext {
  user: JwtPayload
}

/**
 * Extracts and validates the JWT from the request.
 * Returns the payload if valid, or a response to return early.
 */
export async function getAuthContext(
  request: NextRequest
): Promise<{ context: AuthContext } | { error: ReturnType<typeof unauthorized | typeof forbidden> }> {
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

  if (!token) {
    return { error: unauthorized("Token de acesso não fornecido") }
  }

  const payload = await verifyAccessToken(token)
  if (!payload) {
    return { error: unauthorized("Token inválido ou expirado", "token_expired") }
  }

  // Verify user still exists and is active (lightweight check)
  const user = await prisma.usuario.findFirst({
    where: { id: payload.id, deleted_at: null },
    select: { id: true, status: true, role: true, force_password_change: true },
  })

  if (!user || user.status === "inativo") {
    return { error: forbidden("Conta desativada", "account_disabled") }
  }

  return {
    context: {
      user: {
        ...payload,
        role: user.role,
        force_password_change: user.force_password_change,
      },
    },
  }
}

/**
 * Require specific roles. Throws a 403 response if the user doesn't have the required role.
 */
export async function requireRoles(
  request: NextRequest,
  ...roles: Role[]
): Promise<
  | { context: AuthContext }
  | { error: ReturnType<typeof unauthorized | typeof forbidden> }
> {
  const result = await getAuthContext(request)
  if ("error" in result) return result

  const { context } = result
  if (!roles.includes(context.user.role as Role)) {
    return { error: forbidden(`Requer perfil: ${roles.join(", ")}`) }
  }

  return { context }
}
