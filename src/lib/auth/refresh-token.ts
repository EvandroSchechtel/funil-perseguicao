import { prisma } from "@/lib/db/prisma"
import crypto from "crypto"

export async function createRefreshToken(
  usuarioId: string,
  rememberMe = false
): Promise<string> {
  const token = crypto.randomBytes(40).toString("hex")
  const days = rememberMe
    ? 30
    : parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || "7", 10)

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + days)

  await prisma.refreshToken.create({
    data: {
      token,
      usuario_id: usuarioId,
      expires_at: expiresAt,
    },
  })

  return token
}

export async function validateRefreshToken(token: string) {
  const record = await prisma.refreshToken.findUnique({
    where: { token },
    include: { usuario: true },
  })

  if (!record) return null
  if (record.revoked_at) return null
  if (record.expires_at < new Date()) return null
  if (record.usuario.deleted_at) return null
  if (record.usuario.status === "inativo") return null

  return record
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { token },
    data: { revoked_at: new Date() },
  })
}

export async function revokeAllUserTokens(usuarioId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { usuario_id: usuarioId, revoked_at: null },
    data: { revoked_at: new Date() },
  })
}
