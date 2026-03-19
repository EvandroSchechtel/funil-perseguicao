import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { ok, created, badRequest, forbidden, serverError } from "@/lib/api/response"

const createWebhookSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(100),
  conta_id: z.string().uuid("Conta inválida"),
  flow_ns: z.string().min(1, "Flow NS é obrigatório"),
  flow_nome: z.string().max(200).optional(),
  status: z.enum(["ativo", "inativo"]).optional().default("ativo"),
})

// GET /api/admin/webhooks
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "webhooks:write")) return forbidden("Sem permissão.")

    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get("page") || "1", 10)
    const perPage = parseInt(searchParams.get("per_page") || "20", 10)
    const search = searchParams.get("q") || ""

    const where = {
      deleted_at: null,
      ...(search && {
        OR: [
          { nome: { contains: search, mode: "insensitive" as const } },
          { flow_ns: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    }

    const [total, webhooks] = await Promise.all([
      prisma.webhook.count({ where }),
      prisma.webhook.findMany({
        where,
        select: {
          id: true,
          nome: true,
          token: true,
          flow_ns: true,
          flow_nome: true,
          status: true,
          created_at: true,
          conta: { select: { id: true, nome: true, page_name: true } },
          usuario: { select: { nome: true } },
          _count: { select: { leads: true } },
        },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ])

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
    const webhooksSafe = webhooks.map((w) => ({
      ...w,
      url_publica: `${appUrl}/api/webhook/${w.token}`,
      leads_count: w._count.leads,
      _count: undefined,
    }))

    return ok({
      webhooks: webhooksSafe,
      pagination: { page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
    })
  } catch (error) {
    console.error("[GET /api/admin/webhooks]", error)
    return serverError()
  }
}

// POST /api/admin/webhooks
export async function POST(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "webhooks:write")) return forbidden("Sem permissão.")

    const body = await request.json()
    const parsed = createWebhookSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { nome, conta_id, flow_ns, flow_nome, status } = parsed.data

    // Validate conta exists and is active
    const conta = await prisma.contaManychat.findFirst({
      where: { id: conta_id, status: "ativo", deleted_at: null },
    })
    if (!conta) return badRequest("Conta Manychat não encontrada ou inativa.")

    const webhook = await prisma.webhook.create({
      data: {
        nome,
        conta_id,
        flow_ns,
        flow_nome: flow_nome || null,
        status,
        created_by: user.id,
      },
      select: {
        id: true,
        nome: true,
        token: true,
        flow_ns: true,
        flow_nome: true,
        status: true,
        created_at: true,
        conta: { select: { id: true, nome: true } },
      },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
    return created({
      webhook: { ...webhook, url_publica: `${appUrl}/api/webhook/${webhook.token}` },
      message: "Webhook criado com sucesso.",
    })
  } catch (error) {
    console.error("[POST /api/admin/webhooks]", error)
    return serverError()
  }
}
