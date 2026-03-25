import { prisma } from "@/lib/db/prisma"

/**
 * Returns today's date at 00:00:00 in BRT (UTC-3).
 * Used as the `data` key in conta_uso_diario.
 */
export function todayBRT(): Date {
  const now = new Date()
  // BRT = UTC-3: subtract 3 hours then floor to day
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  brt.setUTCHours(0, 0, 0, 0)
  return brt
}

/**
 * Returns milliseconds until next 08:00 BRT (= 11:00 UTC).
 * Used to delay BullMQ jobs when all accounts are at their daily limit.
 * Jobs fire at 8am BRT so the lead receives the flow at a reasonable hour.
 */
export function msUntilMidnightBRT(): number {
  const now = new Date()
  // 08:00 BRT = 11:00 UTC
  const target = new Date(now)
  target.setUTCHours(11, 0, 0, 0)
  // If 11:00 UTC already passed today, schedule for tomorrow
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1)
  }
  return Math.max(0, target.getTime() - now.getTime()) + 60_000 // +1min buffer
}

/**
 * Returns today's send count for a conta.
 */
export async function getTodayUsage(contaId: string): Promise<number> {
  const row = await prisma.contaUsoDiario.findUnique({
    where: { conta_id_data: { conta_id: contaId, data: todayBRT() } },
    select: { total: true },
  })
  return row?.total ?? 0
}

/**
 * Returns today's usage for multiple contas in one query.
 * Returns a Map<contaId, total>.
 */
export async function getTodayUsageMap(contaIds: string[]): Promise<Map<string, number>> {
  if (contaIds.length === 0) return new Map()
  const rows = await prisma.contaUsoDiario.findMany({
    where: {
      conta_id: { in: contaIds },
      data: todayBRT(),
    },
    select: { conta_id: true, total: true },
  })
  const map = new Map<string, number>()
  for (const row of rows) map.set(row.conta_id, row.total)
  return map
}

/**
 * Atomically increments today's send count for a conta.
 */
export async function incrementUsage(contaId: string): Promise<void> {
  const today = todayBRT()
  await prisma.contaUsoDiario.upsert({
    where: { conta_id_data: { conta_id: contaId, data: today } },
    create: { id: crypto.randomUUID(), conta_id: contaId, data: today, total: 1 },
    update: { total: { increment: 1 } },
  })
}

/**
 * Returns true if the account has reached its daily limit.
 * If limiteDiario is null, the account is unlimited.
 */
export async function isLimitReached(
  contaId: string,
  limiteDiario: number | null
): Promise<boolean> {
  if (limiteDiario === null || limiteDiario <= 0) return false
  const usage = await getTodayUsage(contaId)
  return usage >= limiteDiario
}

/**
 * Returns today's successful send count for a webhook flow (BRT).
 * Uses Lead.processado_at which is only set on status="sucesso".
 */
export async function getFlowTodayUsage(flowId: string): Promise<number> {
  const todayStart = todayBRT()
  return prisma.lead.count({
    where: {
      webhook_flow_id: flowId,
      status: "sucesso",
      processado_at: { gte: todayStart },
    },
  })
}

/**
 * Returns true if the webhook flow has reached its daily limit.
 * If limiteDiario is null or 0, the flow is unlimited.
 */
export async function isFlowLimitReached(
  flowId: string,
  limiteDiario: number | null
): Promise<boolean> {
  if (!limiteDiario || limiteDiario <= 0) return false
  const usage = await getFlowTodayUsage(flowId)
  return usage >= limiteDiario
}
