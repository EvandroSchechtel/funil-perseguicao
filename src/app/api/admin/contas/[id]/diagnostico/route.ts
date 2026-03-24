import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, notFound, serverError } from "@/lib/api/response"
import { prisma } from "@/lib/db/prisma"
import { testManychatConnection, verifyCustomFieldId } from "@/lib/manychat/client"

// GET /api/admin/contas/[id]/diagnostico
// Diagnóstico completo da conta Manychat:
// 1. Testa se a api_key é válida (getInfo)
// 2. Verifica se o whatsapp_field_id configurado existe nesta conta
// Retorna resultado detalhado para cada etapa.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "contas:read")) return forbidden("Sem permissão.")

    const { id } = await params

    const conta = await prisma.contaManychat.findUnique({
      where: { id, deleted_at: null },
      select: { nome: true, api_key: true, whatsapp_field_id: true },
    })
    if (!conta) return notFound("Conta não encontrada.")

    // Step 1 — test API key
    const connectionResult = await testManychatConnection(conta.api_key)

    // Step 2 — verify whatsapp_field_id (only if connection is ok)
    let fieldResult: { ok: boolean; message?: string; field?: { id: number; name: string; type: string } } | null = null
    if (connectionResult.ok && conta.whatsapp_field_id) {
      fieldResult = await verifyCustomFieldId(conta.api_key, conta.whatsapp_field_id)
    }

    const apiKeyOk = connectionResult.ok
    const fieldOk = fieldResult?.ok ?? null

    return ok({
      conta_nome: conta.nome,
      api_key: apiKeyOk
        ? { ok: true, page_name: connectionResult.page_name, page_id: connectionResult.page_id }
        : { ok: false, error: connectionResult.error },
      whatsapp_field: conta.whatsapp_field_id == null
        ? { ok: false, error: "whatsapp_field_id não configurado nesta conta." }
        : fieldResult == null
          ? { ok: false, error: "Não testado — api_key inválida." }
          : fieldOk
            ? { ok: true, field_id: conta.whatsapp_field_id, field: fieldResult.field }
            : { ok: false, field_id: conta.whatsapp_field_id, error: fieldResult.message },
      diagnostico:
        !apiKeyOk
          ? "FALHA: api_key inválida ou sem permissão. Atualize a api_key desta conta."
          : !conta.whatsapp_field_id
            ? "FALHA: whatsapp_field_id não configurado. Execute 'Garantir campo' na conta."
            : !fieldOk
              ? "FALHA: whatsapp_field_id configurado não existe nesta conta Manychat. O campo pode pertencer a outra conta. Execute 'Garantir campo' para recriar."
              : "OK: api_key válida e campo [esc]whatsapp-id encontrado nesta conta.",
    })
  } catch (error) {
    console.error("[GET /api/admin/contas/[id]/diagnostico]", error)
    return serverError()
  }
}
