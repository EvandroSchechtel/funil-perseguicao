import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, created, badRequest, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { listarDemandas, criarDemanda } from "@/lib/services/demandas.service"
import { TipoDemanda, PrioridadeDemanda } from "@/generated/prisma/client"

const criarDemandaSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório").max(200),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  tipo: z.nativeEnum(TipoDemanda),
  prioridade: z.nativeEnum(PrioridadeDemanda).optional(),
})

// GET /api/portal/demandas
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "portal:read")) return forbidden("Sem permissão.")

    const clienteId = (user as { cliente_id?: string }).cliente_id
    if (!clienteId) return forbidden("Usuário sem cliente vinculado.")

    const { searchParams } = request.nextUrl
    const result = await listarDemandas({
      clienteId,
      status: searchParams.get("status") || undefined,
      tipo: searchParams.get("tipo") || undefined,
      page: parseInt(searchParams.get("page") || "1", 10),
      perPage: parseInt(searchParams.get("per_page") || "20", 10),
    })

    return ok(result)
  } catch (error) {
    console.error("[GET /api/portal/demandas]", error)
    return handleServiceError(error) ?? serverError()
  }
}

// POST /api/portal/demandas
export async function POST(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "portal:read")) return forbidden("Sem permissão.")

    const clienteId = (user as { cliente_id?: string }).cliente_id
    if (!clienteId) return forbidden("Usuário sem cliente vinculado.")

    const body = await request.json()
    const parsed = criarDemandaSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const result = await criarDemanda({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao,
      tipo: parsed.data.tipo,
      prioridade: parsed.data.prioridade,
      clienteId,
      criadoPor: user.id,
    })

    return created(result)
  } catch (error) {
    console.error("[POST /api/portal/demandas]", error)
    return handleServiceError(error) ?? serverError()
  }
}
