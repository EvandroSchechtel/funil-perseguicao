import { prisma } from "@/lib/db/prisma"
import crypto from "crypto"

export async function createPasswordResetToken(usuarioId: string): Promise<string> {
  // Invalidate any existing unused tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { usuario_id: usuarioId, used_at: null },
    data: { used_at: new Date() },
  })

  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 1) // 1 hour expiry

  await prisma.passwordResetToken.create({
    data: {
      token,
      usuario_id: usuarioId,
      expires_at: expiresAt,
    },
  })

  return token
}

export async function validatePasswordResetToken(token: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { usuario: true },
  })

  if (!record) return null
  if (record.used_at) return null
  if (record.expires_at < new Date()) return null

  return record
}

export async function markPasswordResetTokenUsed(token: string): Promise<void> {
  await prisma.passwordResetToken.update({
    where: { token },
    data: { used_at: new Date() },
  })
}
