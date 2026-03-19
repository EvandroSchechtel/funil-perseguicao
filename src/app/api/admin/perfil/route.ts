import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { getAuthContext } from "@/lib/api/auth-guard"
import { ok, badRequest, notFound, serverError } from "@/lib/api/response"

// GET — get own profile
export async function GET(request: NextRequest) {
  try {
    const result = await getAuthContext(request)
    if ("error" in result) return result.error

    const { user } = result.context

    const usuario = await prisma.usuario.findFirst({
      where: { id: user.id, deleted_at: null },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        avatar_url: true,
        status: true,
        force_password_change: true,
        ultimo_login: true,
        created_at: true,
      },
    })

    if (!usuario) return notFound("Usuário não encontrado")

    return ok({ data: usuario })
  } catch (error) {
    console.error("[GET /api/admin/perfil]", error)
    return serverError()
  }
}

const updateSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").optional(),
  avatar_url: z.string().url().optional().nullable(),
})

// PUT — update own profile
export async function PUT(request: NextRequest) {
  try {
    const result = await getAuthContext(request)
    if ("error" in result) return result.error

    const { user } = result.context

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { nome, avatar_url } = parsed.data
    const updateData: Record<string, unknown> = {}
    if (nome !== undefined) updateData.nome = nome
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url

    const updated = await prisma.usuario.update({
      where: { id: user.id },
      data: updateData,
      select: { id: true, nome: true, email: true, role: true, avatar_url: true },
    })

    return ok({ data: updated })
  } catch (error) {
    console.error("[PUT /api/admin/perfil]", error)
    return serverError()
  }
}
