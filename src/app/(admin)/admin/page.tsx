"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { RefreshCw, Users2, CheckCircle2, XCircle, TrendingUp, Activity, Layers } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Header } from "@/components/layout/Header"
import { toast } from "sonner"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FilterOptions {
  clientes: { id: string; nome: string }[]
  campanhas: { id: string; nome: string; cliente_id: string }[]
  contas: { id: string; nome: string }[]
}

interface MetricasGeral {
  kpis: {
    total: number
    sucesso: number
    falha: number
    sem_optin: number
    grupos_entrados: number
    taxa_sucesso: number
    taxa_grupos: number
    em_fila: number
    adiados: number
  }
  comparativo: {
    total: number | null
    sucesso: number | null
    falha: number | null
    grupos: number | null
  }
  funil: { label: string; value: number; pct: number }[]
  diario: { dia: string; total: number; sucesso: number; falha: number }[]
}

interface MetricasOperacional {
  queue: { waiting: number; active: number; delayed: number; failed: number }
  leads_por_status: {
    pendente: number
    processando: number
    sucesso: number
    falha: number
    sem_optin: number
  }
  contas: {
    id: string
    nome: string
    uso_hoje: number
    limite_diario: number | null
    pct_uso: number | null
  }[]
  leads_com_falha_recente: {
    id: string
    nome: string
    telefone: string
    erro_msg: string | null
    created_at: string
  }[]
}

interface MetricasGrupos {
  kpis: {
    total_entradas: number
    rastreadas: number
    nao_rastreadas: number
    tag_aplicada: number
    taxa_rastreamento: number
    taxa_tag: number
  }
  por_grupo: {
    grupo_id: string
    nome: string
    instancia: string
    total: number
    rastreadas: number
    tag_aplicada: number
  }[]
  diario: { dia: string; total: number; rastreadas: number; tag_aplicada: number }[]
}

type Tab = "geral" | "operacional" | "grupos"
type Preset = "hoje" | "7d" | "30d" | "90d" | "custom"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfDayBRT(date: Date): Date {
  const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000)
  brt.setUTCHours(0, 0, 0, 0)
  return new Date(brt.getTime() + 3 * 60 * 60 * 1000)
}

function toLocalDateInput(date: Date): string {
  const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000)
  return brt.toISOString().slice(0, 16)
}

function formatDia(dia: string): string {
  const [, mm, dd] = dia.split("-")
  return `${dd}/${mm}`
}

function formatDateTime(str: string): string {
  return new Date(str).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ---------------------------------------------------------------------------
// Delta Badge
// ---------------------------------------------------------------------------

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null
  const positive = delta >= 0
  return (
    <span className={`text-xs font-medium ${positive ? "text-[#25D366]" : "text-[#F87171]"}`}>
      {positive ? "↑" : "↓"} {Math.abs(delta)}%
    </span>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  suffix,
  delta,
  color = "text-[#F1F1F3]",
  icon,
}: {
  label: string
  value: number | string
  suffix?: string
  delta?: number | null
  color?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <p className="text-[#8B8B9E] text-sm font-medium">{label}</p>
        {icon && (
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#111118]">
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <p className={`text-3xl font-bold ${color}`}>
          {value}
          {suffix && <span className="text-lg ml-0.5 font-semibold">{suffix}</span>}
        </p>
        {delta !== undefined && <DeltaBadge delta={delta ?? null} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section skeleton / spinner
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-7 h-7 border-2 border-[#25D366] border-t-transparent rounded-full" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { accessToken } = useAuth()

  // --- Filter state ---
  const [preset, setPreset] = useState<Preset>("7d")
  const [fromDate, setFromDate] = useState<Date>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return startOfDayBRT(d)
  })
  const [toDate, setToDate] = useState<Date>(new Date())
  const [clienteId, setClienteId] = useState("")
  const [campanhaId, setCampanhaId] = useState("")
  const [contaId, setContaId] = useState("")

  // --- Filter options ---
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)

  // --- Tab ---
  const [tab, setTab] = useState<Tab>("geral")

  // --- Data ---
  const [geralData, setGeralData] = useState<MetricasGeral | null>(null)
  const [operacionalData, setOperacionalData] = useState<MetricasOperacional | null>(null)
  const [gruposData, setGruposData] = useState<MetricasGrupos | null>(null)

  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // --- Fetch filter options ---
  useEffect(() => {
    if (!accessToken) return
    fetch("/api/admin/dashboard/filters", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then(setFilterOptions)
      .catch(() => toast.error("Erro ao carregar filtros."))
  }, [accessToken])

  // --- Build query string ---
  function buildQs(section: Tab) {
    const params = new URLSearchParams()
    params.set("section", section)
    params.set("from", fromDate.toISOString())
    params.set("to", toDate.toISOString())
    if (clienteId) params.set("clienteId", clienteId)
    if (campanhaId) params.set("campanhaId", campanhaId)
    if (contaId) params.set("contaId", contaId)
    return params.toString()
  }

  // --- Fetch data for a section ---
  const fetchSection = useCallback(
    async (section: Tab, showLoading = true) => {
      if (!accessToken) return
      if (showLoading) setLoading(true)
      try {
        const res = await fetch(`/api/admin/dashboard?${buildQs(section)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (section === "geral") setGeralData(json)
        else if (section === "operacional") setOperacionalData(json)
        else setGruposData(json)
        setLastRefresh(new Date())
      } catch {
        toast.error("Erro ao carregar dados. Tente novamente.")
      } finally {
        if (showLoading) setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessToken, fromDate, toDate, clienteId, campanhaId, contaId]
  )

  // On tab or filter change, fetch current tab
  useEffect(() => {
    fetchSection(tab)
  }, [tab, fetchSection])

  // Auto-refresh only on operacional tab
  useEffect(() => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
    if (tab === "operacional") {
      autoRefreshRef.current = setInterval(() => {
        fetchSection("operacional", false)
      }, 30000)
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
    }
  }, [tab, fetchSection])

  // --- Preset helpers ---
  function applyPreset(p: Preset) {
    setPreset(p)
    const now = new Date()
    if (p === "hoje") {
      setFromDate(startOfDayBRT(now))
      setToDate(now)
    } else if (p === "7d") {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      setFromDate(startOfDayBRT(d))
      setToDate(now)
    } else if (p === "30d") {
      const d = new Date(now)
      d.setDate(d.getDate() - 30)
      setFromDate(startOfDayBRT(d))
      setToDate(now)
    } else if (p === "90d") {
      const d = new Date(now)
      d.setDate(d.getDate() - 90)
      setFromDate(startOfDayBRT(d))
      setToDate(now)
    }
  }

  // Filtered campanhas by selected cliente
  const campanhasFiltradas =
    clienteId && filterOptions
      ? filterOptions.campanhas.filter((c) => c.cliente_id === clienteId)
      : filterOptions?.campanhas ?? []

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full min-h-0">
      <Header breadcrumbs={[{ label: "Dashboard" }]} />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Page title + refresh */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[#F1F1F3] text-2xl font-bold">Dashboard</h1>
            <p className="text-[#8B8B9E] text-sm mt-0.5">
              Atualizado às{" "}
              {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <button
            onClick={() => fetchSection(tab)}
            className="flex items-center gap-2 text-[#8B8B9E] hover:text-[#F1F1F3] text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>

        {/* Filter bar */}
        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-4 space-y-3">
          {/* Date presets */}
          <div className="flex flex-wrap items-center gap-2">
            {(["hoje", "7d", "30d", "90d"] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  preset === p
                    ? "bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/40"
                    : "bg-[#111118] text-[#8B8B9E] border border-[#1E1E2A] hover:text-[#F1F1F3] hover:border-[#2A2A3A]"
                }`}
              >
                {p === "hoje" ? "Hoje" : p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias"}
              </button>
            ))}

            {/* Custom date inputs */}
            <div className="flex items-center gap-2 ml-2">
              <input
                type="datetime-local"
                value={toLocalDateInput(fromDate)}
                onChange={(e) => {
                  if (e.target.value) {
                    setFromDate(new Date(e.target.value))
                    setPreset("custom")
                  }
                }}
                className="bg-[#111118] border border-[#1E1E2A] text-[#C4C4D4] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#25D366]/50 focus:ring-1 focus:ring-[#25D366]/20"
              />
              <span className="text-[#5A5A72] text-sm">até</span>
              <input
                type="datetime-local"
                value={toLocalDateInput(toDate)}
                onChange={(e) => {
                  if (e.target.value) {
                    setToDate(new Date(e.target.value))
                    setPreset("custom")
                  }
                }}
                className="bg-[#111118] border border-[#1E1E2A] text-[#C4C4D4] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#25D366]/50 focus:ring-1 focus:ring-[#25D366]/20"
              />
            </div>
          </div>

          {/* Dropdowns */}
          <div className="flex flex-wrap gap-3">
            <select
              value={clienteId}
              onChange={(e) => {
                setClienteId(e.target.value)
                setCampanhaId("") // reset downstream
              }}
              className="bg-[#111118] border border-[#1E1E2A] text-[#C4C4D4] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#25D366]/50 min-w-[160px]"
            >
              <option value="">Todos os clientes</option>
              {filterOptions?.clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>

            <select
              value={campanhaId}
              onChange={(e) => setCampanhaId(e.target.value)}
              className="bg-[#111118] border border-[#1E1E2A] text-[#C4C4D4] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#25D366]/50 min-w-[160px]"
            >
              <option value="">Todas as campanhas</option>
              {campanhasFiltradas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>

            <select
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
              className="bg-[#111118] border border-[#1E1E2A] text-[#C4C4D4] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#25D366]/50 min-w-[180px]"
            >
              <option value="">Todas as contas</option>
              {filterOptions?.contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#1E1E2A]">
          {(
            [
              { key: "geral", label: "Visão Geral", icon: <TrendingUp className="w-4 h-4" /> },
              { key: "operacional", label: "Operacional", icon: <Activity className="w-4 h-4" /> },
              { key: "grupos", label: "Grupos WA", icon: <Layers className="w-4 h-4" /> },
            ] as { key: Tab; label: string; icon: React.ReactNode }[]
          ).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                tab === key
                  ? "text-[#25D366] border-[#25D366]"
                  : "text-[#8B8B9E] border-transparent hover:text-[#C4C4D4]"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {loading ? (
          <Spinner />
        ) : (
          <>
            {tab === "geral" && geralData && <TabGeral data={geralData} />}
            {tab === "operacional" && operacionalData && (
              <TabOperacional data={operacionalData} />
            )}
            {tab === "grupos" && gruposData && <TabGrupos data={gruposData} />}
            {!loading && (
              <>
                {tab === "geral" && !geralData && (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Users2 className="w-10 h-10 text-[#2A2A3A]" />
                    <p className="text-[#5A5A72] text-sm">Nenhum dado disponível.</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 1 — Visão Geral
// ---------------------------------------------------------------------------

function TabGeral({ data }: { data: MetricasGeral }) {
  const { kpis, comparativo, funil, diario } = data

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          label="Total Leads"
          value={kpis.total}
          delta={comparativo.total}
          icon={<Users2 className="w-5 h-5 text-[#60A5FA]" />}
          color="text-[#F1F1F3]"
        />
        <KpiCard
          label="Enviados c/ Sucesso"
          value={kpis.sucesso}
          delta={comparativo.sucesso}
          icon={<CheckCircle2 className="w-5 h-5 text-[#25D366]" />}
          color="text-[#25D366]"
        />
        <KpiCard
          label="Falhas"
          value={kpis.falha}
          delta={comparativo.falha}
          icon={<XCircle className="w-5 h-5 text-[#F87171]" />}
          color="text-[#F87171]"
        />
        <KpiCard
          label="Entradas nos Grupos"
          value={kpis.grupos_entrados}
          delta={comparativo.grupos}
          icon={<Layers className="w-5 h-5 text-[#25D366]" />}
          color="text-[#25D366]"
        />
        <KpiCard
          label="Taxa de Sucesso"
          value={kpis.taxa_sucesso}
          suffix="%"
          icon={<TrendingUp className="w-5 h-5 text-[#FBBF24]" />}
          color="text-[#FBBF24]"
        />
      </div>

      {/* Em fila pill */}
      {(kpis.em_fila > 0 || kpis.adiados > 0) && (
        <div className="flex items-center gap-3 flex-wrap">
          {kpis.em_fila > 0 && (
            <div className="flex items-center gap-2 text-sm text-[#60A5FA] bg-[#1E1E2A] border border-[#60A5FA]/20 rounded-lg px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-[#60A5FA] animate-pulse inline-block" />
              Em fila: {kpis.em_fila}
            </div>
          )}
          {kpis.adiados > 0 && (
            <div className="flex items-center gap-2 text-sm text-[#FBBF24] bg-[#1E1E2A] border border-[#FBBF24]/20 rounded-lg px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-[#FBBF24] inline-block" />
              Adiados: {kpis.adiados}
            </div>
          )}
        </div>
      )}

      {/* Funil */}
      <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
        <h2 className="text-[#F1F1F3] font-semibold mb-4">Funil de Conversão</h2>
        <div className="space-y-3">
          {funil.map((step, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[#C4C4D4] text-sm">{step.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[#F1F1F3] font-semibold tabular-nums">
                    {step.value.toLocaleString("pt-BR")}
                  </span>
                  <span className="text-[#8B8B9E] text-xs w-12 text-right">{step.pct}%</span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-[#111118] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${step.pct}%`,
                    backgroundColor:
                      i === 0 ? "#60A5FA" : i === 1 ? "#25D366" : "#FBBF24",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily chart */}
      <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
        <h2 className="text-[#F1F1F3] font-semibold mb-4">Evolução Diária</h2>
        {diario.length === 0 ? (
          <p className="text-[#5A5A72] text-sm text-center py-8">Sem dados no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={diario} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="dia"
                tickFormatter={formatDia}
                tick={{ fill: "#8B8B9E", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fill: "#8B8B9E", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#16161E",
                  border: "1px solid #1E1E2A",
                  borderRadius: "8px",
                  color: "#F1F1F3",
                  fontSize: "13px",
                }}
                labelFormatter={(label) => formatDia(String(label))}
              />
              <Bar dataKey="total" name="Total" fill="#60A5FA" radius={[3, 3, 0, 0]} maxBarSize={20} />
              <Bar dataKey="sucesso" name="Sucesso" fill="#25D366" radius={[3, 3, 0, 0]} maxBarSize={20} />
              <Bar dataKey="falha" name="Falha" fill="#F87171" radius={[3, 3, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 2 — Operacional
// ---------------------------------------------------------------------------

function TabOperacional({ data }: { data: MetricasOperacional }) {
  const { queue, contas, leads_com_falha_recente } = data

  const queueCards = [
    { label: "Aguardando", value: queue.waiting, color: "#60A5FA" },
    { label: "Em Processamento", value: queue.active, color: "#FBBF24" },
    { label: "Atrasados", value: queue.delayed, color: "#F59E0B" },
    { label: "Falhas na Fila", value: queue.failed, color: "#F87171" },
  ]

  return (
    <div className="space-y-6">
      {/* Queue cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {queueCards.map((c) => (
          <div
            key={c.label}
            className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-4 flex flex-col gap-1"
          >
            <p className="text-[#8B8B9E] text-xs font-medium uppercase tracking-wide">{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: c.color }}>
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* Contas table */}
      <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1E1E2A]">
          <h2 className="text-[#F1F1F3] font-semibold">Contas Manychat</h2>
        </div>
        {contas.length === 0 ? (
          <p className="text-[#5A5A72] text-sm text-center py-8">Nenhuma conta ativa.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1E1E2A]">
                {["Conta", "Enviados hoje", "Limite", "Uso", "Status"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contas.map((conta) => {
                const pct = conta.pct_uso ?? 0
                const barColor =
                  pct >= 100 ? "#F87171" : pct >= 80 ? "#FBBF24" : "#25D366"
                const statusLabel =
                  conta.limite_diario === null
                    ? "Ilimitada"
                    : pct >= 100
                    ? "Limite atingido"
                    : pct >= 80
                    ? "Quase no limite"
                    : "Normal"
                const statusColor =
                  conta.limite_diario === null
                    ? "text-[#60A5FA]"
                    : pct >= 100
                    ? "text-[#F87171]"
                    : pct >= 80
                    ? "text-[#FBBF24]"
                    : "text-[#25D366]"

                return (
                  <tr
                    key={conta.id}
                    className="border-b border-[#1E1E2A] last:border-0 hover:bg-[#1C1C28] transition-colors"
                  >
                    <td className="px-5 py-3 text-[#F1F1F3] text-sm font-medium">{conta.nome}</td>
                    <td className="px-5 py-3 text-[#C4C4D4] text-sm tabular-nums">
                      {conta.uso_hoje.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-5 py-3 text-[#C4C4D4] text-sm tabular-nums">
                      {conta.limite_diario !== null
                        ? conta.limite_diario.toLocaleString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-5 py-3 min-w-[140px]">
                      {conta.limite_diario !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-[#111118] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
                            />
                          </div>
                          <span className="text-xs tabular-nums" style={{ color: barColor }}>
                            {pct}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#5A5A72] text-xs">—</span>
                      )}
                    </td>
                    <td className={`px-5 py-3 text-xs font-medium ${statusColor}`}>{statusLabel}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Últimas falhas */}
      <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1E1E2A]">
          <h2 className="text-[#F1F1F3] font-semibold">Últimas Falhas</h2>
        </div>
        {leads_com_falha_recente.length === 0 ? (
          <p className="text-[#25D366] text-sm text-center py-8">Nenhuma falha recente.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1E1E2A]">
                {["Nome", "Telefone", "Erro", "Quando"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads_com_falha_recente.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-[#1E1E2A] last:border-0 hover:bg-[#1C1C28] transition-colors"
                >
                  <td className="px-5 py-3 text-[#F1F1F3] text-sm">{lead.nome}</td>
                  <td className="px-5 py-3 text-[#C4C4D4] text-sm tabular-nums">{lead.telefone}</td>
                  <td className="px-5 py-3 text-[#F87171] text-sm max-w-xs truncate">
                    {lead.erro_msg ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-[#8B8B9E] text-sm whitespace-nowrap">
                    {formatDateTime(lead.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 3 — Grupos WA
// ---------------------------------------------------------------------------

function TabGrupos({ data }: { data: MetricasGrupos }) {
  const { kpis, por_grupo, diario } = data

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Entradas"
          value={kpis.total_entradas}
          icon={<Layers className="w-5 h-5 text-[#60A5FA]" />}
          color="text-[#F1F1F3]"
        />
        <KpiCard
          label="Rastreadas"
          value={kpis.rastreadas}
          icon={<CheckCircle2 className="w-5 h-5 text-[#25D366]" />}
          color="text-[#25D366]"
        />
        <KpiCard
          label="Tag Aplicada"
          value={kpis.tag_aplicada}
          icon={<Activity className="w-5 h-5 text-[#FBBF24]" />}
          color="text-[#FBBF24]"
        />
        <KpiCard
          label="Taxa Rastreamento"
          value={kpis.taxa_rastreamento}
          suffix="%"
          icon={<TrendingUp className="w-5 h-5 text-[#60A5FA]" />}
          color="text-[#60A5FA]"
        />
      </div>

      {/* Por grupo table */}
      <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1E1E2A]">
          <h2 className="text-[#F1F1F3] font-semibold">Por Grupo</h2>
        </div>
        {por_grupo.length === 0 ? (
          <p className="text-[#5A5A72] text-sm text-center py-8">Nenhuma entrada no período.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1E1E2A]">
                {["Nome do Grupo", "Instância", "Total", "Rastreadas", "Tag Aplicada"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {por_grupo.map((g) => (
                <tr
                  key={g.grupo_id}
                  className="border-b border-[#1E1E2A] last:border-0 hover:bg-[#1C1C28] transition-colors"
                >
                  <td className="px-5 py-3 text-[#F1F1F3] text-sm font-medium">{g.nome}</td>
                  <td className="px-5 py-3 text-[#8B8B9E] text-sm">{g.instancia || "—"}</td>
                  <td className="px-5 py-3 text-[#F1F1F3] text-sm tabular-nums font-semibold">
                    {g.total}
                  </td>
                  <td className="px-5 py-3 text-[#25D366] text-sm tabular-nums">{g.rastreadas}</td>
                  <td className="px-5 py-3 text-[#FBBF24] text-sm tabular-nums">{g.tag_aplicada}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Daily chart */}
      <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
        <h2 className="text-[#F1F1F3] font-semibold mb-4">Entradas Diárias</h2>
        {diario.length === 0 ? (
          <p className="text-[#5A5A72] text-sm text-center py-8">Sem dados no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={diario} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="dia"
                tickFormatter={formatDia}
                tick={{ fill: "#8B8B9E", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fill: "#8B8B9E", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#16161E",
                  border: "1px solid #1E1E2A",
                  borderRadius: "8px",
                  color: "#F1F1F3",
                  fontSize: "13px",
                }}
                labelFormatter={(label) => formatDia(String(label))}
              />
              <Bar dataKey="total" name="Total" fill="#60A5FA" radius={[3, 3, 0, 0]} maxBarSize={24} />
              <Bar dataKey="rastreadas" name="Rastreadas" fill="#25D366" radius={[3, 3, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
