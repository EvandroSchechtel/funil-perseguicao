import { prisma } from "@/lib/db/prisma"
import { Prisma } from "@/generated/prisma/client"
import { getQueueStats } from "@/lib/queue/queues"
import { todayBRT, getTodayUsageMap } from "@/lib/services/uso-diario.service"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardFilters {
  from: Date
  to: Date
  clienteId?: string
  campanhaId?: string
  contaId?: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const QUEUE_FALLBACK = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0, total: 0 }

async function safeGetQueueStats() {
  try {
    return await Promise.race([
      getQueueStats(),
      new Promise<typeof QUEUE_FALLBACK>((resolve) =>
        setTimeout(() => resolve(QUEUE_FALLBACK), 2000)
      ),
    ])
  } catch {
    return QUEUE_FALLBACK
  }
}

function delta(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((curr - prev) / prev) * 1000) / 10
}

function prevPeriod(filters: DashboardFilters): { prevFrom: Date; prevTo: Date } {
  const duration = filters.to.getTime() - filters.from.getTime()
  const prevTo = new Date(filters.from.getTime())
  const prevFrom = new Date(filters.from.getTime() - duration)
  return { prevFrom, prevTo }
}

// ---------------------------------------------------------------------------
// getFilterOptions
// ---------------------------------------------------------------------------

export async function getFilterOptions() {
  const [clientes, campanhas, contas] = await Promise.all([
    prisma.cliente.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
    prisma.campanha.findMany({
      select: { id: true, nome: true, cliente_id: true },
      orderBy: { nome: "asc" },
    }),
    prisma.contaManychat.findMany({
      where: { status: "ativo" },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ])
  return { clientes, campanhas, contas }
}

// ---------------------------------------------------------------------------
// getMetricasGeral
// ---------------------------------------------------------------------------

export async function getMetricasGeral(filters: DashboardFilters) {
  const { from, to, clienteId, campanhaId, contaId } = filters
  const { prevFrom, prevTo } = prevPeriod(filters)

  // Build base where clause for leads
  function buildLeadWhere(f: Date, t: Date) {
    const where: Prisma.LeadWhereInput = {
      created_at: { gte: f, lte: t },
    }
    if (campanhaId) {
      where.campanha_id = campanhaId
    } else if (clienteId) {
      where.campanha = { cliente_id: clienteId }
    }
    if (contaId) {
      where.webhook_flow = { conta_id: contaId }
    }
    return where
  }

  const currentWhere = buildLeadWhere(from, to)
  const prevWhere = buildLeadWhere(prevFrom, prevTo)

  const [
    total,
    sucesso,
    falha,
    sem_optin,
    grupos_entrados,
    prevTotal,
    prevSucesso,
    prevFalha,
    prevGrupos,
    emFila,
    adiados,
  ] = await Promise.all([
    prisma.lead.count({ where: currentWhere }),
    prisma.lead.count({ where: { ...currentWhere, status: "sucesso" } }),
    prisma.lead.count({ where: { ...currentWhere, status: "falha" } }),
    prisma.lead.count({ where: { ...currentWhere, status: "sem_optin" } }),
    prisma.lead.count({
      where: { ...currentWhere, grupo_entrou_at: { not: null } },
    }),
    prisma.lead.count({ where: prevWhere }),
    prisma.lead.count({ where: { ...prevWhere, status: "sucesso" } }),
    prisma.lead.count({ where: { ...prevWhere, status: "falha" } }),
    prisma.lead.count({
      where: { ...prevWhere, grupo_entrou_at: { not: null } },
    }),
    // queue stats fetched separately below
    Promise.resolve(0),
    Promise.resolve(0),
  ])

  const [queueStats, aguardandoTotal] = await Promise.all([
    safeGetQueueStats(),
    // Count ALL leads with status aguardando (paused campaigns) — no date filter
    prisma.lead.count({
      where: {
        status: "aguardando",
        ...(campanhaId ? { campanha_id: campanhaId } : clienteId ? { campanha: { cliente_id: clienteId } } : {}),
      },
    }),
  ])

  const processados = sucesso + falha
  const taxa_sucesso = processados > 0 ? Math.round((sucesso / processados) * 1000) / 10 : 0

  const kpis = {
    total,
    sucesso,
    falha,
    sem_optin,
    grupos_entrados,
    taxa_sucesso,
    taxa_grupos: total > 0 ? Math.round((grupos_entrados / total) * 1000) / 10 : 0,
    em_fila: queueStats.waiting + queueStats.active,
    adiados: queueStats.delayed,
    pausados: aguardandoTotal,
  }

  const comparativo = {
    total: delta(total, prevTotal),
    sucesso: delta(sucesso, prevSucesso),
    falha: delta(falha, prevFalha),
    grupos: delta(grupos_entrados, prevGrupos),
  }

  const funil = [
    { label: "Leads Recebidos", value: total, pct: 100 },
    {
      label: "Mensagens Enviadas",
      value: sucesso,
      pct: total > 0 ? Math.round((sucesso / total) * 1000) / 10 : 0,
    },
    {
      label: "Entradas nos Grupos",
      value: grupos_entrados,
      pct: total > 0 ? Math.round((grupos_entrados / total) * 1000) / 10 : 0,
    },
  ]

  // Daily series via raw SQL
  let dailySql: Prisma.Sql

  if (campanhaId) {
    if (contaId) {
      dailySql = Prisma.sql`
        SELECT DATE(created_at AT TIME ZONE 'America/Sao_Paulo') as dia,
               COUNT(*) as total,
               COUNT(*) FILTER (WHERE status = 'sucesso') as sucesso,
               COUNT(*) FILTER (WHERE status = 'falha') as falha
        FROM leads
        WHERE created_at >= ${from} AND created_at <= ${to}
          AND campanha_id = ${campanhaId}
          AND webhook_flow_id IN (SELECT id FROM webhook_flows WHERE conta_id = ${contaId})
        GROUP BY dia ORDER BY dia
      `
    } else {
      dailySql = Prisma.sql`
        SELECT DATE(created_at AT TIME ZONE 'America/Sao_Paulo') as dia,
               COUNT(*) as total,
               COUNT(*) FILTER (WHERE status = 'sucesso') as sucesso,
               COUNT(*) FILTER (WHERE status = 'falha') as falha
        FROM leads
        WHERE created_at >= ${from} AND created_at <= ${to}
          AND campanha_id = ${campanhaId}
        GROUP BY dia ORDER BY dia
      `
    }
  } else if (clienteId) {
    if (contaId) {
      dailySql = Prisma.sql`
        SELECT DATE(created_at AT TIME ZONE 'America/Sao_Paulo') as dia,
               COUNT(*) as total,
               COUNT(*) FILTER (WHERE status = 'sucesso') as sucesso,
               COUNT(*) FILTER (WHERE status = 'falha') as falha
        FROM leads
        WHERE created_at >= ${from} AND created_at <= ${to}
          AND campanha_id IN (SELECT id FROM campanhas WHERE cliente_id = ${clienteId}::uuid)
          AND webhook_flow_id IN (SELECT id FROM webhook_flows WHERE conta_id = ${contaId})
        GROUP BY dia ORDER BY dia
      `
    } else {
      dailySql = Prisma.sql`
        SELECT DATE(created_at AT TIME ZONE 'America/Sao_Paulo') as dia,
               COUNT(*) as total,
               COUNT(*) FILTER (WHERE status = 'sucesso') as sucesso,
               COUNT(*) FILTER (WHERE status = 'falha') as falha
        FROM leads
        WHERE created_at >= ${from} AND created_at <= ${to}
          AND campanha_id IN (SELECT id FROM campanhas WHERE cliente_id = ${clienteId}::uuid)
        GROUP BY dia ORDER BY dia
      `
    }
  } else if (contaId) {
    dailySql = Prisma.sql`
      SELECT DATE(created_at AT TIME ZONE 'America/Sao_Paulo') as dia,
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'sucesso') as sucesso,
             COUNT(*) FILTER (WHERE status = 'falha') as falha
      FROM leads
      WHERE created_at >= ${from} AND created_at <= ${to}
        AND webhook_flow_id IN (SELECT id FROM webhook_flows WHERE conta_id = ${contaId})
      GROUP BY dia ORDER BY dia
    `
  } else {
    dailySql = Prisma.sql`
      SELECT DATE(created_at AT TIME ZONE 'America/Sao_Paulo') as dia,
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'sucesso') as sucesso,
             COUNT(*) FILTER (WHERE status = 'falha') as falha
      FROM leads
      WHERE created_at >= ${from} AND created_at <= ${to}
      GROUP BY dia ORDER BY dia
    `
  }

  type DailyRow = { dia: Date; total: bigint; sucesso: bigint; falha: bigint }
  const rawDaily = await prisma.$queryRaw<DailyRow[]>(dailySql)

  const diario = rawDaily.map((row) => ({
    dia: row.dia.toISOString().slice(0, 10),
    total: Number(row.total),
    sucesso: Number(row.sucesso),
    falha: Number(row.falha),
  }))

  return { kpis, comparativo, funil, diario }
}

// ---------------------------------------------------------------------------
// getMetricasOperacional
// ---------------------------------------------------------------------------

export async function getMetricasOperacional(filters: DashboardFilters) {
  const { from, to, clienteId, campanhaId, contaId } = filters

  function buildLeadWhere(): Prisma.LeadWhereInput {
    const where: Prisma.LeadWhereInput = {
      created_at: { gte: from, lte: to },
    }
    if (campanhaId) {
      where.campanha_id = campanhaId
    } else if (clienteId) {
      where.campanha = { cliente_id: clienteId }
    }
    if (contaId) {
      where.webhook_flow = { conta_id: contaId }
    }
    return where
  }

  const baseWhere = buildLeadWhere()

  const [queueStats, leadStatusGroups, contasAtivas, leadsComFalha] = await Promise.all([
    safeGetQueueStats(),
    prisma.lead.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
    }),
    prisma.contaManychat.findMany({
      where: { status: "ativo" },
      select: { id: true, nome: true, limite_diario: true },
      orderBy: { nome: "asc" },
    }),
    prisma.lead.findMany({
      where: { ...baseWhere, status: "falha" },
      orderBy: { created_at: "desc" },
      take: 5,
      select: {
        id: true,
        nome: true,
        telefone: true,
        erro_msg: true,
        created_at: true,
      },
    }),
  ])

  const queue = {
    waiting: queueStats.waiting,
    active: queueStats.active,
    delayed: queueStats.delayed,
    failed: queueStats.failed,
  }

  const statusMap: Record<string, number> = {}
  for (const row of leadStatusGroups) {
    statusMap[row.status] = row._count._all
  }

  const leads_por_status = {
    pendente: statusMap["pendente"] ?? 0,
    processando: statusMap["processando"] ?? 0,
    sucesso: statusMap["sucesso"] ?? 0,
    falha: statusMap["falha"] ?? 0,
    sem_optin: statusMap["sem_optin"] ?? 0,
    aguardando: statusMap["aguardando"] ?? 0,
  }

  const contaIds = contasAtivas.map((c) => c.id)
  const usageMap = await getTodayUsageMap(contaIds)

  const contas = contasAtivas.map((conta) => {
    const uso_hoje = usageMap.get(conta.id) ?? 0
    const limite = conta.limite_diario ?? null
    const pct_uso = limite && limite > 0 ? Math.round((uso_hoje / limite) * 1000) / 10 : null
    return {
      id: conta.id,
      nome: conta.nome,
      uso_hoje,
      limite_diario: limite,
      pct_uso,
    }
  })

  const leads_com_falha_recente = leadsComFalha.map((l) => ({
    id: l.id,
    nome: l.nome,
    telefone: l.telefone,
    erro_msg: l.erro_msg,
    created_at: l.created_at,
  }))

  return { queue, leads_por_status, contas, leads_com_falha_recente }
}

// ---------------------------------------------------------------------------
// getMetricasGrupos
// ---------------------------------------------------------------------------

export async function getMetricasGrupos(filters: DashboardFilters) {
  const { from, to, clienteId, campanhaId, contaId } = filters

  // Build EntradaGrupo where
  function buildEntradaWhere(): Prisma.EntradaGrupoWhereInput {
    const where: Prisma.EntradaGrupoWhereInput = {
      entrou_at: { gte: from, lte: to },
    }
    if (campanhaId) {
      where.grupo = { campanha_id: campanhaId }
    } else if (clienteId) {
      where.grupo = { campanha: { cliente_id: clienteId } }
    }
    if (contaId) {
      if (where.grupo) {
        // merge into existing grupo filter
        where.grupo = {
          ...where.grupo,
          conta_manychat_id: contaId,
        } as Prisma.GrupoMonitoramentoWhereInput
      } else {
        where.grupo = { conta_manychat_id: contaId }
      }
    }
    return where
  }

  const entradaWhere = buildEntradaWhere()

  const [entradas, gruposInfo] = await Promise.all([
    prisma.entradaGrupo.findMany({
      where: entradaWhere,
      select: {
        id: true,
        lead_id: true,
        tag_aplicada: true,
        grupo_id: true,
        entrou_at: true,
        grupo: {
          select: {
            id: true,
            nome_filtro: true,
            instancia_id: true,
          },
        },
      },
    }),
    prisma.grupoMonitoramento.findMany({
      select: {
        id: true,
        nome_filtro: true,
        instancia_id: true,
      },
    }),
  ])

  const total_entradas = entradas.length
  const rastreadas = entradas.filter((e) => e.lead_id !== null).length
  const nao_rastreadas = total_entradas - rastreadas
  const tag_aplicada = entradas.filter((e) => e.tag_aplicada === true).length

  const taxa_rastreamento =
    total_entradas > 0 ? Math.round((rastreadas / total_entradas) * 1000) / 10 : 0
  const taxa_tag = rastreadas > 0 ? Math.round((tag_aplicada / rastreadas) * 1000) / 10 : 0

  const kpis = {
    total_entradas,
    rastreadas,
    nao_rastreadas,
    tag_aplicada,
    taxa_rastreamento,
    taxa_tag,
  }

  // Aggregate por grupo
  const grupoMap = new Map<
    string,
    { nome: string; instancia: string; total: number; rastreadas: number; tag_aplicada: number }
  >()

  for (const e of entradas) {
    const gid = e.grupo_id
    if (!grupoMap.has(gid)) {
      grupoMap.set(gid, {
        nome: e.grupo?.nome_filtro ?? gid,
        instancia: e.grupo?.instancia_id ?? "",
        total: 0,
        rastreadas: 0,
        tag_aplicada: 0,
      })
    }
    const g = grupoMap.get(gid)!
    g.total++
    if (e.lead_id) g.rastreadas++
    if (e.tag_aplicada) g.tag_aplicada++
  }

  const por_grupo = Array.from(grupoMap.entries())
    .map(([grupo_id, v]) => ({ grupo_id, ...v }))
    .sort((a, b) => b.total - a.total)

  // Daily series
  const dailyMap = new Map<string, { total: number; rastreadas: number; tag_aplicada: number }>()
  for (const e of entradas) {
    const brtDate = new Date(e.entrou_at.getTime() - 3 * 60 * 60 * 1000)
    const dia = brtDate.toISOString().slice(0, 10)
    if (!dailyMap.has(dia)) {
      dailyMap.set(dia, { total: 0, rastreadas: 0, tag_aplicada: 0 })
    }
    const d = dailyMap.get(dia)!
    d.total++
    if (e.lead_id) d.rastreadas++
    if (e.tag_aplicada) d.tag_aplicada++
  }

  const diario = Array.from(dailyMap.entries())
    .map(([dia, v]) => ({ dia, ...v }))
    .sort((a, b) => a.dia.localeCompare(b.dia))

  // Aggregate por campanha (sem filtro de data — taxa sobre total histórico da campanha)
  const leadBaseWhere: Prisma.LeadWhereInput = {
    ...(campanhaId ? { campanha_id: campanhaId } : {}),
    ...(clienteId ? { campanha: { cliente_id: clienteId } } : {}),
  }

  const [totalPorCampanha, entradosPorCampanha] = await Promise.all([
    prisma.lead.groupBy({ by: ["campanha_id"], where: leadBaseWhere, _count: { id: true } }),
    prisma.lead.groupBy({
      by: ["campanha_id"],
      where: { ...leadBaseWhere, grupo_entrou_at: { not: null } },
      _count: { id: true },
    }),
  ])

  const campanhaIds = totalPorCampanha.map((r) => r.campanha_id).filter((id): id is string => id !== null)
  const campanhasInfo = await prisma.campanha.findMany({
    where: { id: { in: campanhaIds } },
    select: { id: true, nome: true, cliente: { select: { nome: true } } },
  })

  const campanhaMap = new Map(campanhasInfo.map((c) => [c.id, c]))
  const entradosMap = new Map(entradosPorCampanha.map((r) => [r.campanha_id, r._count.id]))

  const por_campanha = totalPorCampanha
    .filter((r) => r.campanha_id !== null)
    .map((r) => {
      const c = campanhaMap.get(r.campanha_id!)
      const grupos_entrados = entradosMap.get(r.campanha_id!) ?? 0
      const total = r._count.id
      return {
        campanha_id: r.campanha_id!,
        campanha_nome: c?.nome ?? r.campanha_id!,
        cliente_nome: c?.cliente?.nome ?? null,
        total_leads: total,
        grupos_entrados,
        taxa_entrada: total > 0 ? Math.round((grupos_entrados / total) * 1000) / 10 : 0,
      }
    })
    .sort((a, b) => b.taxa_entrada - a.taxa_entrada)

  return { kpis, por_grupo, por_campanha, diario }
}

// ---------------------------------------------------------------------------
// Legacy export — kept for backward-compat with agent executor
// ---------------------------------------------------------------------------

export async function getMetricas() {
  const now = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - 7)

  const filters: DashboardFilters = { from, to: now }
  const [geral, operacional] = await Promise.all([
    getMetricasGeral(filters),
    getMetricasOperacional(filters),
  ])

  return {
    leads_hoje: 0, // not tracked in new model; kept for shape compat
    leads_semana: geral.kpis.total,
    sucesso_semana: geral.kpis.sucesso,
    falhas_semana: geral.kpis.falha,
    taxa_sucesso: geral.kpis.taxa_sucesso,
    em_fila: geral.kpis.em_fila,
    ultimos_leads: operacional.leads_com_falha_recente,
  }
}
