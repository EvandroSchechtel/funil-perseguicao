import { NextRequest } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db/prisma"
import { getAuthContext } from "@/lib/api/auth-guard"
import { revokeAllUserTokens } from "@/lib/auth/refresh-token"
import { signAccessToken } from "@/lib/auth/jwt"
import { sendEmail } from "@/lib/email"
import { senhaRedefinidaTemplate } from "@/lib/email/templates/senha-redefinida"
import { ok, badRequest, forbidden, serverError } from "@/lib/api/response"

const schema = z.object({
  senhaAtual: z.string().optional(), // Optional for force_password_change flow
  novaSenha: z.string().min(8, "A nova senha deve ter no mínimo 8 caracteres"),
  confirmarSenha: z.string(),
}).refine((d) => d.novaSenha === d.confirmarSenha, {
  message: "As senhas não coincidem",
  path: ["confirmarSenha"],
})

export async function PUT(request: NextRequest) {
  try {
    const result = await getAuthContext(request)
    if ("error" in result) return result.error

    const { user } = result.context

    const body = await request.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { senhaAtual, novaSenha } = parsed.data

    const usuario = await prisma.usuario.findFirst({
      where: { id: user.id, deleted_at: null },
    })

    if (!usuario) return forbidden("Usuário não encontrado")

    // If NOT in force_password_change mode, require current password
    if (!usuario.force_password_change) {
      if (!senhaAtual) {
        return badRequest("Senha atual é obrigatória")
      }
      const passwordMatch = await bcrypt.compare(senhaAtual, usuario.senha)
      if (!passwordMatch) {
        return forbidden("Senha atual incorreta", "wrong_password")
      }
    }

    const hashedPassword = await bcrypt.hash(novaSenha, 12)

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        senha: hashedPassword,
        force_password_change: false,
      },
    })

    // Revoke all other tokens
    await revokeAllUserTokens(usuario.id)

    // Send confirmation email
    const template = senhaRedefinidaTemplate({ nome: usuario.nome })
    await sendEmail({
      to: usuario.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })

    // Issue new access token with force_password_change = false
    const newAccessToken = await signAccessToken({
      id: usuario.id,
      email: usuario.email,
      role: usuario.role,
      force_password_change: false,
    })

    return ok({
      message: "Senha alterada com sucesso.",
      access_token: newAccessToken,
    })
  } catch (error) {
    console.error("[PUT /api/admin/perfil/senha]", error)
    return serverError()
  }
}
