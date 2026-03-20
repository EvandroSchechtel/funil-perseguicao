import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, badRequest, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { buscarDemanda, atualizarDemanda } from "@/lib/services/demandas.service"
import { StatusDemanda, PrioridadeDemanda } from "@/generated/prisma/client"

const atualizarDemandaSchema = z.object({
  status: z.nativeEnum(StatusDemanda).optional(),
  prioridade: z.nativeEnum(PrioridadeDemanda).optional(),
  atribuido_a: z.string().nullable().optional(),
  titulo: z.string().min(1).max(200).optional(),
  descricao: z.string().min(1).optional(),
})

type Ctx = { params: Promise<{ id: string }> }

// GET /api/admin/demandas/[id]
export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "demandas:read")) return forbidden("Sem permissão.")

    const { id } = await params
    const result = await buscarDemanda(id)
    return ok(result)
  } catch (error) {
    console.error("[GET /api/admin/demandas/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}

// PUT /api/admin/demandas/[id]
export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "demandas:manage")) return forbidden("Sem permissão.")

    const { id } = await params
    const body = await request.json()
    const parsed = atualizarDemandaSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const result = await atualizarDemanda(id, { ...parsed.data, usuarioId: user.id })
    return ok(result)
  } catch (error) {
    console.error("[PUT /api/admin/demandas/[id]]", error)
    return handleServiceError(error) ?? serverError()
  }
}
