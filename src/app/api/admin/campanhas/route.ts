import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, created, badRequest, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { listarCampanhas, criarCampanha } from "@/lib/services/campanhas.service"

const createCampanhaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(200),
  descricao: z.string().max(1000).optional().nullable(),
  data_inicio: z.coerce.date().optional().nullable(),
  data_fim: z.coerce.date().optional().nullable(),
  status: z.enum(["ativo", "inativo"]).optional().default("ativo"),
  cliente_id: z.string().uuid("Cliente inválido").optional().nullable(),
})

// GET /api/admin/campanhas
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "campanhas:read")) return forbidden("Sem permissão.")

    const { searchParams } = request.nextUrl
    const result = await listarCampanhas({
      page: parseInt(searchParams.get("page") || "1", 10),
      perPage: parseInt(searchParams.get("per_page") || "20", 10),
      search: searchParams.get("q") || "",
      status: (searchParams.get("status") as "ativo" | "inativo" | null) || undefined,
      clienteId: searchParams.get("cliente_id") || undefined,
    })

    return ok(result)
  } catch (error) {
    console.error("[GET /api/admin/campanhas]", error)
    return handleServiceError(error) ?? serverError()
  }
}

// POST /api/admin/campanhas
export async function POST(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "campanhas:write")) return forbidden("Sem permissão.")

    const body = await request.json()
    const parsed = createCampanhaSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const result = await criarCampanha({ ...parsed.data, userId: user.id })
    return created(result)
  } catch (error) {
    console.error("[POST /api/admin/campanhas]", error)
    return handleServiceError(error) ?? serverError()
  }
}
