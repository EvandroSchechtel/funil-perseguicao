import { NextRequest } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db/prisma"
import { validatePasswordResetToken, markPasswordResetTokenUsed } from "@/lib/auth/password-reset"
import { revokeAllUserTokens } from "@/lib/auth/refresh-token"
import { sendEmail } from "@/lib/email"
import { senhaRedefinidaTemplate } from "@/lib/email/templates/senha-redefinida"
import { ok, badRequest, serverError } from "@/lib/api/response"

const schema = z.object({
  token: z.string().min(1, "Token é obrigatório"),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
  passwordConfirm: z.string(),
}).refine((d) => d.password === d.passwordConfirm, {
  message: "As senhas não coincidem",
  path: ["passwordConfirm"],
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { token, password } = parsed.data

    const record = await validatePasswordResetToken(token)
    if (!record) {
      return badRequest("Token inválido ou expirado. Solicite um novo link de recuperação.")
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await prisma.usuario.update({
      where: { id: record.usuario_id },
      data: {
        senha: hashedPassword,
        force_password_change: false,
      },
    })

    await markPasswordResetTokenUsed(token)
    await revokeAllUserTokens(record.usuario_id)

    const template = senhaRedefinidaTemplate({ nome: record.usuario.nome })
    await sendEmail({
      to: record.usuario.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })

    return ok({ message: "Senha redefinida com sucesso." })
  } catch (error) {
    console.error("[POST /api/auth/redefinir-senha]", error)
    return serverError()
  }
}

// GET — validate token (used by the reset page to check validity before rendering form)
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")
    if (!token) return badRequest("Token é obrigatório")

    const record = await validatePasswordResetToken(token)
    if (!record) {
      return ok({ valid: false, message: "Token inválido ou expirado." })
    }

    return ok({ valid: true })
  } catch (error) {
    console.error("[GET /api/auth/redefinir-senha]", error)
    return serverError()
  }
}
