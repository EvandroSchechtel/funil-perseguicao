import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { testManychatConnection, maskApiKey } from "@/lib/manychat/client"
import { ok, created, badRequest, forbidden, serverError } from "@/lib/api/response"

const createContaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(100),
  api_key: z.string().min(1, "API Key é obrigatória"),
  status: z.enum(["ativo", "inativo"]).optional().default("ativo"),
})

// GET /api/admin/contas — lista todas as contas (paginada)
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "contas:read")) return forbidden("Sem permissão.")

    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get("page") || "1", 10)
    const perPage = parseInt(searchParams.get("per_page") || "20", 10)
    const search = searchParams.get("q") || ""
    const statusParam = searchParams.get("status")

    const where = {
      deleted_at: null,
      ...(statusParam === "ativo" || statusParam === "inativo"
        ? { status: statusParam as "ativo" | "inativo" }
        : {}),
      ...(search && {
        OR: [
          { nome: { contains: search, mode: "insensitive" as const } },
          { page_name: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    }

    const [total, contas] = await Promise.all([
      prisma.contaManychat.count({ where }),
      prisma.contaManychat.findMany({
        where,
        select: {
          id: true,
          nome: true,
          api_key: true,
          page_id: true,
          page_name: true,
          status: true,
          ultimo_sync: true,
          created_at: true,
          usuario: { select: { nome: true } },
        },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ])

    // Mask api_key before returning
    const contasSafe = contas.map((c) => ({
      ...c,
      api_key: undefined,
      api_key_hint: maskApiKey(c.api_key),
    }))

    return ok({
      contas: contasSafe,
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    })
  } catch (error) {
    console.error("[GET /api/admin/contas]", error)
    return serverError()
  }
}

// POST /api/admin/contas — cria nova conta
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

    const { nome, api_key, status } = parsed.data

    // Test API connection and fetch page info
    const connection = await testManychatConnection(api_key)
    if (!connection.ok) {
      return badRequest(connection.error || "Falha ao conectar com a API Manychat.")
    }

    const conta = await prisma.contaManychat.create({
      data: {
        nome,
        api_key,
        page_id: connection.page_id,
        page_name: connection.page_name,
        status,
        ultimo_sync: new Date(),
        created_by: user.id,
      },
      select: {
        id: true,
        nome: true,
        page_id: true,
        page_name: true,
        status: true,
        ultimo_sync: true,
        created_at: true,
      },
    })

    return created({
      conta: { ...conta, api_key_hint: maskApiKey(api_key) },
      message: `Conta conectada com sucesso! Página: ${connection.page_name}`,
    })
  } catch (error) {
    console.error("[POST /api/admin/contas]", error)
    return serverError()
  }
}
