import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { created, badRequest, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { adicionarComentario } from "@/lib/services/demandas.service"

const comentarioSchema = z.object({
  texto: z.string().min(1, "Texto é obrigatório"),
})

type Ctx = { params: Promise<{ id: string }> }

// POST /api/portal/demandas/[id]/comentarios
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "demandas:write")) return forbidden("Sem permissão.")

    // Ensure portal clients can only comment on their own demands
    const clienteId = (user as { cliente_id?: string }).cliente_id
    if (user.role === "cliente" && !clienteId) return forbidden("Usuário sem cliente vinculado.")

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
      interno: false, // clientes nunca criam comentários internos
    })

    return created(result)
  } catch (error) {
    console.error("[POST /api/portal/demandas/[id]/comentarios]", error)
    return handleServiceError(error) ?? serverError()
  }
}
