import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { prisma } from "@/lib/db/prisma"
import { requireRoles } from "@/lib/api/auth-guard"
import { revokeAllUserTokens } from "@/lib/auth/refresh-token"
import { sendEmail } from "@/lib/email"
import { boasVindasTemplate } from "@/lib/email/templates/boas-vindas"
import { ok, notFound, serverError } from "@/lib/api/response"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const authResult = await requireRoles(request, "super_admin")
    if ("error" in authResult) return authResult.error

    const { id } = await params

    const usuario = await prisma.usuario.findFirst({
      where: { id, deleted_at: null },
    })

    if (!usuario) return notFound("Usuário não encontrado")

    // Generate temporary password
    const tempPassword = crypto.randomBytes(8).toString("base64url").slice(0, 12)
    const hashedPassword = await bcrypt.hash(tempPassword, 12)

    await prisma.usuario.update({
      where: { id },
      data: {
        senha: hashedPassword,
        force_password_change: true,
      },
    })

    await revokeAllUserTokens(id)

    const template = boasVindasTemplate({
      nome: usuario.nome,
      email: usuario.email,
      senhaTemporaria: tempPassword,
    })
    await sendEmail({
      to: usuario.email,
      subject: "Sua senha foi redefinida — Funil Perseguição",
      html: template.html,
      text: template.text,
    })

    return ok({ message: "Senha resetada. O usuário receberá um email com as novas credenciais." })
  } catch (error) {
    console.error("[POST /api/admin/usuarios/[id]/reset-senha]", error)
    return serverError()
  }
}
