import { NextRequest } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getAuthContext } from "@/lib/api/auth-guard"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { getQueueStats } from "@/lib/queue/queues"
import { ok, forbidden, serverError } from "@/lib/api/response"

const QUEUE_STATS_FALLBACK = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, total: 0 }

async function safeGetQueueStats() {
  try {
    return await Promise.race([
      getQueueStats(),
      new Promise<typeof QUEUE_STATS_FALLBACK>((resolve) =>
        setTimeout(() => resolve(QUEUE_STATS_FALLBACK), 2000)
      ),
    ])
  } catch {
    return QUEUE_STATS_FALLBACK
  }
}

// GET /api/admin/dashboard
export async function GET(request: NextRequest) {
  try {
    const ctxResult = await getAuthContext(request)
    if ("error" in ctxResult) return ctxResult.error
    const { user } = ctxResult.context

    if (!hasPermission(user.role as Role, "dashboard:read")) return forbidden("Sem permissão.")

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - 7)

    const [
      leadsHoje,
      leadsSemana,
      sucessoSemana,
      falhasSemana,
      queueStats,
      ultimosLeads,
    ] = await Promise.all([
      prisma.lead.count({ where: { created_at: { gte: startOfToday } } }),
      prisma.lead.count({ where: { created_at: { gte: startOfWeek } } }),
      prisma.lead.count({ where: { status: "sucesso", created_at: { gte: startOfWeek } } }),
      prisma.lead.count({ where: { status: "falha", created_at: { gte: startOfWeek } } }),
      safeGetQueueStats(),
      prisma.lead.findMany({
        take: 10,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          nome: true,
          telefone: true,
          status: true,
          created_at: true,
          webhook: { select: { nome: true } },
        },
      }),
    ])

    const processadosSemana = sucessoSemana + falhasSemana
    const taxaSucesso = processadosSemana > 0
      ? Math.round((sucessoSemana / processadosSemana) * 1000) / 10
      : 0

    return ok({
      leads_hoje: leadsHoje,
      leads_semana: leadsSemana,
      sucesso_semana: sucessoSemana,
      falhas_semana: falhasSemana,
      taxa_sucesso: taxaSucesso,
      em_fila: queueStats.waiting + queueStats.active,
      ultimos_leads: ultimosLeads,
    })
  } catch (error) {
    console.error("[GET /api/admin/dashboard]", error)
    return serverError()
  }
}
