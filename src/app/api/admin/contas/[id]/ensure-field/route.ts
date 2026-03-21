import { NextRequest } from "next/server"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, forbidden, notFound, serverError } from "@/lib/api/response"
import { prisma } from "@/lib/db/prisma"
import { ensureWhatsappIdField } from "@/lib/manychat/client"

// POST /api/admin/contas/[id]/ensure-field
// Garante que [esc]whatsapp-id existe na conta Manychat.
// Cria o campo se necessário. Salva o field_id no banco de dados.
// Não expõe a api_key no frontend — busca pelo conta id.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "contas:write")) return forbidden("Sem permissão.")

    const { id } = await params

    const conta = await prisma.contaManychat.findUnique({
      where: { id },
      select: { api_key: true },
    })
    if (!conta) return notFound("Conta não encontrada.")

    const result = await ensureWhatsappIdField(conta.api_key)

    if (!result.ok) {
      return ok({ ok: false, message: result.error || "Erro ao criar o campo." })
    }

    // Save the field_id to the database
    if (result.fieldId) {
      await prisma.contaManychat.update({
        where: { id },
        data: { whatsapp_field_id: result.fieldId },
      })
    }

    return ok({
      ok: true,
      field_id: result.fieldId,
      already_existed: result.alreadyExisted,
      message: result.alreadyExisted
        ? `Campo já existe — ID: ${result.fieldId}`
        : `Campo criado com sucesso — ID: ${result.fieldId}`,
    })
  } catch (error) {
    console.error("[POST /api/admin/contas/[id]/ensure-field]", error)
    return serverError()
  }
}
