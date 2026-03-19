import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, created, badRequest, forbidden, serverError, handleServiceError } from "@/lib/api/response"
import { listarClientes, criarCliente } from "@/lib/services/clientes.service"

const createClienteSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(200),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefone: z.string().max(30).optional(),
  primeira_conta: z.object({
    nome: z.string().min(1, "Nome da conta é obrigatório").max(200),
    api_key: z.string().min(1, "API Key é obrigatória"),
  }),
})

// GET /api/admin/clientes
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "clientes:read")) return forbidden("Sem permissão.")

    const { searchParams } = request.nextUrl
    const result = await listarClientes({
      page: parseInt(searchParams.get("page") || "1", 10),
      perPage: parseInt(searchParams.get("per_page") || "100", 10),
      search: searchParams.get("q") || "",
    })

    return ok(result)
  } catch (error) {
    console.error("[GET /api/admin/clientes]", error)
    return handleServiceError(error) ?? serverError()
  }
}

// POST /api/admin/clientes
export async function POST(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "clientes:write")) return forbidden("Sem permissão.")

    const body = await request.json()
    const parsed = createClienteSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const result = await criarCliente({
      nome: parsed.data.nome,
      email: parsed.data.email || undefined,
      telefone: parsed.data.telefone,
      userId: user.id,
      primeira_conta: parsed.data.primeira_conta,
    })
    return created(result)
  } catch (error) {
    console.error("[POST /api/admin/clientes]", error)
    return handleServiceError(error) ?? serverError()
  }
}
