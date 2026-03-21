import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, created, badRequest, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { listarContas, criarConta } from "@/lib/services/contas.service"

const createContaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(100),
  api_key: z.string().min(1, "API Key é obrigatória"),
  status: z.enum(["ativo", "inativo"]).optional().default("ativo"),
})

// GET /api/admin/contas
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "contas:read")) return forbidden("Sem permissão.")

    const { searchParams } = request.nextUrl
    const result = await listarContas({
      page: parseInt(searchParams.get("page") || "1", 10),
      perPage: parseInt(searchParams.get("per_page") || "20", 10),
      search: searchParams.get("q") || "",
      status: searchParams.get("status") || undefined,
      clienteId: searchParams.get("cliente_id") || undefined,
    })

    return ok(result)
  } catch (error) {
    console.error("[GET /api/admin/contas]", error)
    return handleServiceError(error) ?? serverError()
  }
}

// POST /api/admin/contas
export async function POST(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "contas:write")) return forbidden("Sem permissão.")

    const body = await request.json()
    const parsed = createContaSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const result = await criarConta({ ...parsed.data, userId: user.id })
    return created(result)
  } catch (error) {
    console.error("[POST /api/admin/contas]", error)
    return handleServiceError(error) ?? serverError()
  }
}
