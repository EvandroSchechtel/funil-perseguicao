import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { created, badRequest, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { adicionarComentario } from "@/lib/services/demandas.service"

const comentarioSchema = z.object({
  texto: z.string().min(1, "Texto é obrigatório"),
  interno: z.boolean().optional(),
})

type Ctx = { params: Promise<{ id: string }> }

// POST /api/admin/demandas/[id]/comentarios
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "demandas:write")) return forbidden("Sem permissão.")

    const { id: demandaId } = await params
    const body = await request.json()
    const parsed = comentarioSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const result = await adicionarComentario({
      demandaId,
      autorId: user.id,
      texto: parsed.data.texto,
      interno: parsed.data.interno ?? false,
    })

    return created(result)
  } catch (error) {
    console.error("[POST /api/admin/demandas/[id]/comentarios]", error)
    return handleServiceError(error) ?? serverError()
  }
}
