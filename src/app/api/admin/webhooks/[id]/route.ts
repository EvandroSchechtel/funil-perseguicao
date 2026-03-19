import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, badRequest, forbidden, notFound, serverError } from "@/lib/api/response"

const updateWebhookSchema = z.object({
  nome: z.string().min(1).max(100).optional(),
  flow_ns: z.string().min(1).optional(),
  flow_nome: z.string().max(200).optional(),
  status: z.enum(["ativo", "inativo"]).optional(),
})

// GET /api/admin/webhooks/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "webhooks:write")) return forbidden("Sem permissão.")

    const { id } = await params

    const webhook = await prisma.webhook.findFirst({
      where: { id, deleted_at: null },
      select: {
        id: true,
        nome: true,
        token: true,
        flow_ns: true,
        flow_nome: true,
        status: true,
        created_at: true,
        updated_at: true,
        conta: { select: { id: true, nome: true, page_name: true } },
        usuario: { select: { nome: true } },
        _count: { select: { leads: true } },
      },
    })

    if (!webhook) return notFound("Webhook não encontrado.")

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
    return ok({
      webhook: {
        ...webhook,
        url_publica: `${appUrl}/api/webhook/${webhook.token}`,
        leads_count: webhook._count.leads,
        _count: undefined,
      },
    })
  } catch (error) {
    console.error("[GET /api/admin/webhooks/[id]]", error)
    return serverError()
  }
}

// PUT /api/admin/webhooks/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "webhooks:write")) return forbidden("Sem permissão.")

    const { id } = await params

    const existing = await prisma.webhook.findFirst({ where: { id, deleted_at: null } })
    if (!existing) return notFound("Webhook não encontrado.")

    const body = await request.json()
    const parsed = updateWebhookSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { nome, flow_ns, flow_nome, status } = parsed.data

    const webhook = await prisma.webhook.update({
      where: { id },
      data: {
        ...(nome && { nome }),
        ...(flow_ns && { flow_ns }),
        ...(flow_nome !== undefined && { flow_nome }),
        ...(status && { status }),
      },
      select: {
        id: true,
        nome: true,
        token: true,
        flow_ns: true,
        flow_nome: true,
        status: true,
        updated_at: true,
      },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
    return ok({
      webhook: { ...webhook, url_publica: `${appUrl}/api/webhook/${webhook.token}` },
      message: "Webhook atualizado com sucesso.",
    })
  } catch (error) {
    console.error("[PUT /api/admin/webhooks/[id]]", error)
    return serverError()
  }
}

// DELETE /api/admin/webhooks/[id] — soft delete
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "webhooks:delete")) return forbidden("Sem permissão.")

    const { id } = await params

    const existing = await prisma.webhook.findFirst({ where: { id, deleted_at: null } })
    if (!existing) return notFound("Webhook não encontrado.")

    await prisma.webhook.update({ where: { id }, data: { deleted_at: new Date() } })

    return ok({ message: "Webhook removido com sucesso." })
  } catch (error) {
    console.error("[DELETE /api/admin/webhooks/[id]]", error)
    return serverError()
  }
}
