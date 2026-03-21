import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, badRequest, forbidden, notFound, serverError } from "@/lib/api/response"
import { prisma } from "@/lib/db/prisma"
import { createTag, getTags } from "@/lib/manychat/tags"

const createTagSchema = z.object({
  nome: z.string().min(1).max(100),
})

// GET /api/admin/contas/[id]/tags
// Lista todas as tags Manychat disponíveis nesta conta.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "contas:read")) return forbidden("Sem permissão.")

    const { id } = await params
    const conta = await prisma.contaManychat.findFirst({
      where: { id, deleted_at: null },
      select: { api_key: true },
    })
    if (!conta) return notFound("Conta não encontrada.")

    const tags = await getTags(conta.api_key)
    return ok({ tags })
  } catch (error) {
    console.error("[GET /api/admin/contas/[id]/tags]", error)
    return serverError()
  }
}

// POST /api/admin/contas/[id]/tags
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "contas:write")) return forbidden("Sem permissão.")

    const { id } = await params
    const body = await request.json()
    const parsed = createTagSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const conta = await prisma.contaManychat.findFirst({
      where: { id, deleted_at: null },
      select: { id: true, api_key: true },
    })
    if (!conta) return notFound("Conta não encontrada.")

    const result = await createTag(conta.api_key, parsed.data.nome)
    if (!result.ok || !result.tag) {
      return badRequest(result.error || "Erro ao criar tag no Manychat.")
    }

    return ok({ ok: true, tag: result.tag, message: `Tag "${result.tag.name}" criada com sucesso.` })
  } catch (error) {
    console.error("[POST /api/admin/contas/[id]/tags]", error)
    return serverError()
  }
}
