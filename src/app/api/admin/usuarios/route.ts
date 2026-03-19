import { NextRequest } from "next/server"
import { z } from "zod"
import { requireRoles } from "@/lib/api/auth-guard"
import { ok, created, badRequest, serverError, handleServiceError } from "@/lib/api/response"
import { listarUsuarios, criarUsuario } from "@/lib/services/usuarios.service"

// GET — list users
export async function GET(request: NextRequest) {
  try {
    const result = await requireRoles(request, "super_admin")
    if ("error" in result) return result.error

    const { searchParams } = request.nextUrl
    const data = await listarUsuarios({
      page: parseInt(searchParams.get("page") || "1", 10),
      perPage: parseInt(searchParams.get("per_page") || "20", 10),
      search: searchParams.get("q") || "",
      role: searchParams.get("role") || "",
    })

    return ok(data)
  } catch (error) {
    console.error("[GET /api/admin/usuarios]", error)
    return handleServiceError(error) ?? serverError()
  }
}

const createSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  senha: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
  role: z.enum(["super_admin", "admin", "operador", "viewer"]),
  status: z.enum(["ativo", "inativo"]).optional().default("ativo"),
  force_password_change: z.boolean().optional().default(true),
})

// POST — create user
export async function POST(request: NextRequest) {
  try {
    const result = await requireRoles(request, "super_admin")
    if ("error" in result) return result.error

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const data = await criarUsuario(parsed.data)
    return created(data)
  } catch (error) {
    console.error("[POST /api/admin/usuarios]", error)
    return handleServiceError(error) ?? serverError()
  }
}
