import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { createPasswordResetToken } from "@/lib/auth/password-reset"
import { sendEmail } from "@/lib/email"
import { recuperacaoSenhaTemplate } from "@/lib/email/templates/recuperacao-senha"
import { ok, badRequest, serverError } from "@/lib/api/response"

const schema = z.object({
  email: z.string().email("Email inválido"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return badRequest("Email inválido")
    }

    const { email } = parsed.data

    // Always return the same message regardless of whether user exists
    const usuario = await prisma.usuario.findFirst({
      where: { email: email.toLowerCase(), deleted_at: null, status: "ativo" },
    })

    if (usuario) {
      const token = await createPasswordResetToken(usuario.id)
      const template = recuperacaoSenhaTemplate({ nome: usuario.nome, token })
      await sendEmail({
        to: usuario.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      })
    }

    // Always return success to prevent email enumeration
    return ok({
      message: "Se o email estiver cadastrado, enviaremos um link de recuperação.",
    })
  } catch (error) {
    console.error("[POST /api/auth/esqueceu-senha]", error)
    return serverError()
  }
}
