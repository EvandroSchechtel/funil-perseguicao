import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { testManychatConnection, maskApiKey } from "@/lib/manychat/client"
import { ok, badRequest, forbidden, notFound, serverError } from "@/lib/api/response"

const updateContaSchema = z.object({
  nome: z.string().min(1).max(100).optional(),
  api_key: z.string().min(1).optional(),
  status: z.enum(["ativo", "inativo"]).optional(),
})

// GET /api/admin/contas/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "contas:read")) return forbidden("Sem permissão.")

    const { id } = await params

    const conta = await prisma.contaManychat.findFirst({
      where: { id, deleted_at: null },
      select: {
        id: true,
        nome: true,
        api_key: true,
        page_id: true,
        page_name: true,
        status: true,
        ultimo_sync: true,
        created_at: true,
        updated_at: true,
        usuario: { select: { id: true, nome: true } },
      },
    })

    if (!conta) return notFound("Conta não encontrada.")

    return ok({
      conta: {
        ...conta,
        api_key: undefined,
        api_key_hint: maskApiKey(conta.api_key),
      },
    })
  } catch (error) {
    console.error("[GET /api/admin/contas/[id]]", error)
    return serverError()
  }
}

// PUT /api/admin/contas/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "contas:write")) return forbidden("Sem permissão.")

    const { id } = await params

    const existing = await prisma.contaManychat.findFirst({ where: { id, deleted_at: null } })
    if (!existing) return notFound("Conta não encontrada.")

    const body = await request.json()
    const parsed = updateContaSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { nome, api_key, status } = parsed.data
    let page_id = existing.page_id
    let page_name = existing.page_name
    let ultimo_sync = existing.ultimo_sync

    // If api_key changed, re-test connection
    if (api_key && api_key !== existing.api_key) {
      const connection = await testManychatConnection(api_key)
      if (!connection.ok) {
        return badRequest(connection.error || "Falha ao conectar com a nova API Key.")
      }
      page_id = connection.page_id ?? null
      page_name = connection.page_name ?? null
      ultimo_sync = new Date()
    }

    const conta = await prisma.contaManychat.update({
      where: { id },
      data: {
        ...(nome && { nome }),
        ...(api_key && { api_key }),
        ...(status && { status }),
        page_id,
        page_name,
        ultimo_sync,
      },
      select: {
        id: true,
        nome: true,
        page_id: true,
        page_name: true,
        status: true,
        ultimo_sync: true,
        updated_at: true,
      },
    })

    return ok({ conta, message: "Conta atualizada com sucesso." })
  } catch (error) {
    console.error("[PUT /api/admin/contas/[id]]", error)
    return serverError()
  }
}

// DELETE /api/admin/contas/[id] — soft delete
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "contas:write")) return forbidden("Sem permissão.")

    const { id } = await params

    const existing = await prisma.contaManychat.findFirst({ where: { id, deleted_at: null } })
    if (!existing) return notFound("Conta não encontrada.")

    await prisma.contaManychat.update({
      where: { id },
      data: { deleted_at: new Date() },
    })

    return ok({ message: "Conta removida com sucesso." })
  } catch (error) {
    console.error("[DELETE /api/admin/contas/[id]]", error)
    return serverError()
  }
}
