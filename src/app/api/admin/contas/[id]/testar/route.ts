import { NextRequest } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { testManychatConnection } from "@/lib/manychat/client"
import { ok, forbidden, notFound, serverError } from "@/lib/api/response"

// POST /api/admin/contas/[id]/testar — testa conexão e sincroniza dados da página
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "contas:read")) return forbidden("Sem permissão.")

    const { id } = await params

    const conta = await prisma.contaManychat.findFirst({ where: { id, deleted_at: null } })
    if (!conta) return notFound("Conta não encontrada.")

    const result = await testManychatConnection(conta.api_key)

    if (result.ok) {
      // Update page info and last sync
      await prisma.contaManychat.update({
        where: { id },
        data: {
          page_id: result.page_id,
          page_name: result.page_name,
          ultimo_sync: new Date(),
        },
      })
    }

    return ok({
      ok: result.ok,
      page_name: result.page_name,
      page_id: result.page_id,
      error: result.error,
      message: result.ok
        ? `Conexão OK! Página: ${result.page_name}`
        : `Falha na conexão: ${result.error}`,
    })
  } catch (error) {
    console.error("[POST /api/admin/contas/[id]/testar]", error)
    return serverError()
  }
}
