"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import {
  CheckCircle2, XCircle, Clock, Loader2, AlertTriangle,
  Activity, RefreshCw, PauseCircle, Wifi, WifiOff,
  ArrowDownCircle, ArrowUpCircle, Users, Zap, ShieldAlert, CheckCheck,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"

// ── Types ────────────────────────────────────────────────────────────────────

interface AlertaSistema {
  id: string; tipo: string; nivel: string
  titulo: string; mensagem: string
  referencia_id?: string | null; referencia_nome?: string | null
  resolvido_at?: string | null; created_at: string
}

interface AlertasData { ativos: AlertaSistema[]; resolvidos: AlertaSistema[] }

interface RedisStatus { ok: boolean; latencyMs: number | null }

interface QueueStats {
  waiting: number; active: number; completed: number
  failed: number; delayed: number; paused: number; total: number
}

interface WebhookFailedJob {
  jobId?: string; leadId?: string; nome?: string; telefone?: string
  flowNs?: string; failedReason?: string; attemptsMade: number; timestamp: number
}

interface GrupoEventoFailedJob {
  jobId?: string; tipo?: "entrada" | "saida"; instanciaId?: string
  telefone?: string; chatName?: string; failedReason?: string
  attemptsMade: number; timestamp: number
}

interface QueuePageData {
  redis: RedisStatus
  webhooks: { queue: QueueStats; recentFailed: WebhookFailedJob[] }
  grupoEventos: {
    queue: QueueStats
    recentFailed: GrupoEventoFailedJob[]
    entradas_hoje: number; saidas_hoje: number
    entradas_total: number; saidas_total: number
  }
  leads: Record<string, number>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const AUTO_REFRESH_INTERVAL = 10

function fmt(ts: number) {
  return new Date(ts).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
}

function emptyQueue(): QueueStats {
  return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0, total: 0 }
}

function queueHealth(stats: QueueStats): "ok" | "warn" | "error" {
  if (stats.failed === 0) return "ok"
  if (stats.active > 0) return "warn"
  return "error"
}

// ── Sub-components ───────────────────────────────────────────────────────────

function RedisBadge({ redis }: { redis: RedisStatus | null }) {
  if (!redis) return null
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
      redis.ok
        ? "bg-[#0D2B0D] text-[#25D366] border-[#25D366]/30"
        : "bg-[#2A1616] text-[#F87171] border-[#F87171]/30"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
        redis.ok ? "bg-[#25D366] animate-pulse" : "bg-[#F87171]"
      }`} />
      {redis.ok
        ? <>Redis OK{redis.latencyMs !== null && <span className="opacity-70"> · {redis.latencyMs}ms</span>}</>
        : "Redis Indisponível"
      }
    </span>
  )
}

function StatChip({
  label, value, color, dim = false,
}: { label: string; value: number; color: string; dim?: boolean }) {
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-lg border ${
      dim ? "border-[#1A1A24] bg-[#12121A]" : "border-[#1E1E2A] bg-[#16161E]"
    }`}>
      <span className={`text-xl font-bold tabular-nums ${color} ${dim && value === 0 ? "opacity-30" : ""}`}>
        {value}
      </span>
      <span className="text-[10px] text-[#5A5A72] mt-0.5 whitespace-nowrap">{label}</span>
    </div>
  )
}

function HealthDot({ health }: { health: "ok" | "warn" | "error" }) {
  const cfg = {
    ok:    { cls: "bg-[#25D366] animate-pulse", label: "Saudável" },
    warn:  { cls: "bg-[#F59E0B] animate-pulse", label: "Com falhas" },
    error: { cls: "bg-[#F87171]",               label: "Parado" },
  }[health]
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-[#8B8B9E]">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.cls}`} />
      {cfg.label}
    </span>
  )
}

function QueueCard({
  label, queueName, icon: Icon, stats, accentColor,
}: {
  label: string; queueName: string; icon: React.ElementType
  stats: QueueStats; accentColor: string
}) {
  const health = queueHealth(stats)
  return (
    <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentColor}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[#F1F1F3] text-sm font-semibold">{label}</p>
            <p className="text-[#5A5A72] text-[10px] font-mono">{queueName}</p>
          </div>
        </div>
        <HealthDot health={health} />
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        <StatChip label="Aguardando" value={stats.waiting} color="text-[#8B8B9E]" dim />
        <StatChip label="Ativo"      value={stats.active}  color="text-[#60A5FA]" />
        <StatChip label="Concluído"  value={stats.completed} color="text-[#25D366]" dim />
        <StatChip label="Falhou"     value={stats.failed}  color="text-[#F87171]" />
        <StatChip label="Atrasado"   value={stats.delayed} color="text-[#F59E0B]" dim />
        <StatChip label="Pausado"    value={stats.paused}  color="text-[#8B8B9E]" dim />
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function FilaPage() {
  const { accessToken } = useAuth()
  const [data, setData] = useState<QueuePageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(AUTO_REFRESH_INTERVAL)
  const [activeTab, setActiveTab] = useState<"leads" | "grupos">("leads")
  const [alertas, setAlertas] = useState<AlertasData | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const countdownRef = useRef(AUTO_REFRESH_INTERVAL)

  const fetchAlertas = useCallback(async () => {
    if (!accessToken) return
    try {
      const res = await fetch("/api/admin/alertas", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const json = await res.json()
        setAlertas(json.data)
      }
    } catch { /* silent */ }
  }, [accessToken])

  const resolverAlerta = useCallback(async (id: string) => {
    if (!accessToken) return
    setResolvingId(id)
    try {
      await fetch(`/api/admin/alertas/${id}/resolve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      await fetchAlertas()
    } finally {
      setResolvingId(null)
    }
  }, [accessToken, fetchAlertas])

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!accessToken) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch("/api/admin/queue", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const json = await res.json()
        setData(json.data)
        setApiError(null)
      } else {
        const err = await res.json().catch(() => ({}))
        setApiError(err?.error || `Erro ${res.status} ao carregar dados da fila`)
      }
    } catch {
      setApiError("Não foi possível conectar à API")
    } finally {
      setLoading(false)
      setRefreshing(false)
      countdownRef.current = AUTO_REFRESH_INTERVAL
      setCountdown(AUTO_REFRESH_INTERVAL)
    }
    await fetchAlertas()
  }, [accessToken, fetchAlertas])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 10s
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), AUTO_REFRESH_INTERVAL * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Countdown ticker
  useEffect(() => {
    const tick = setInterval(() => {
      countdownRef.current = Math.max(0, countdownRef.current - 1)
      setCountdown(countdownRef.current)
    }, 1000)
    return () => clearInterval(tick)
  }, [])

  const redis = data?.redis ?? null
  const webhooks = data?.webhooks ?? { queue: emptyQueue(), recentFailed: [] }
  const grupoEventos = data?.grupoEventos ?? {
    queue: emptyQueue(), recentFailed: [],
    entradas_hoje: 0, saidas_hoje: 0, entradas_total: 0, saidas_total: 0,
  }
  const leads = data?.leads ?? {}

  const totalLeads = Object.values(leads).reduce((a, b) => a + (b ?? 0), 0)
  const totalFailedLeads = webhooks.recentFailed.length
  const totalFailedGrupos = grupoEventos.recentFailed.length

  return (
    <div className="flex flex-col h-full">
      <Header breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Filas de Processamento" },
      ]} />

      <div className="p-6 space-y-6 max-w-5xl">

        {/* ── Page Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[#F1F1F3] text-2xl font-bold">Filas de Processamento</h1>
              <RedisBadge redis={redis} />
            </div>
            <p className="text-[#8B8B9E] text-sm mt-1">
              BullMQ · Redis · atualiza em{" "}
              <span className="text-[#F1F1F3] font-mono tabular-nums">{countdown}s</span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {apiError && (
          <div className="bg-[#16161E] border border-[#F87171]/30 rounded-xl p-4 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-[#F87171] shrink-0" />
            <div>
              <p className="text-[#F87171] text-sm font-medium">Erro ao carregar dados</p>
              <p className="text-[#8B8B9E] text-xs mt-0.5">{apiError}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* ── Filas Redis ──────────────────────────────────────────── */}
            <section className="space-y-3">
              <h2 className="text-[#8B8B9E] text-xs uppercase tracking-wider font-semibold flex items-center gap-2">
                {redis?.ok
                  ? <Wifi className="w-3.5 h-3.5 text-[#25D366]" />
                  : <WifiOff className="w-3.5 h-3.5 text-[#F87171]" />
                }
                Filas BullMQ
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <QueueCard
                  label="Leads Manychat"
                  queueName="webhooks"
                  icon={Zap}
                  stats={webhooks.queue}
                  accentColor="bg-[#25D366]/10 text-[#25D366]"
                />
                <QueueCard
                  label="Eventos de Grupo"
                  queueName="grupo-eventos"
                  icon={Users}
                  stats={grupoEventos.queue}
                  accentColor="bg-[#60A5FA]/10 text-[#60A5FA]"
                />
              </div>
            </section>

            {/* ── Resumo de Grupos ─────────────────────────────────────── */}
            <section className="space-y-3">
              <h2 className="text-[#8B8B9E] text-xs uppercase tracking-wider font-semibold">
                Grupos — Banco de Dados
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Entradas Hoje",  value: grupoEventos.entradas_hoje,  icon: ArrowDownCircle, color: "text-[#25D366]", bg: "bg-[#25D366]/10" },
                  { label: "Saídas Hoje",    value: grupoEventos.saidas_hoje,    icon: ArrowUpCircle,   color: "text-[#F87171]", bg: "bg-[#F87171]/10" },
                  { label: "Entradas Total", value: grupoEventos.entradas_total, icon: ArrowDownCircle, color: "text-[#8B8B9E]", bg: "bg-[#1E1E2A]" },
                  { label: "Saídas Total",   value: grupoEventos.saidas_total,   icon: ArrowUpCircle,   color: "text-[#8B8B9E]", bg: "bg-[#1E1E2A]" },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-4 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div>
                      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
                      <p className="text-[#5A5A72] text-[10px]">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Leads por Status ─────────────────────────────────────── */}
            <section className="space-y-3">
              <h2 className="text-[#8B8B9E] text-xs uppercase tracking-wider font-semibold">
                Leads por Status — {totalLeads.toLocaleString("pt-BR")} total
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { key: "pendente",    label: "Pendente",    icon: Clock,         color: "text-[#8B8B9E]" },
                  { key: "processando", label: "Processando", icon: Loader2,       color: "text-[#60A5FA]" },
                  { key: "sucesso",     label: "Sucesso",     icon: CheckCircle2,  color: "text-[#25D366]" },
                  { key: "falha",       label: "Falha",       icon: XCircle,       color: "text-[#F87171]" },
                  { key: "sem_optin",   label: "Sem Opt-in",  icon: AlertTriangle, color: "text-[#F59E0B]" },
                  { key: "aguardando",  label: "Pausados",    icon: PauseCircle,   color: "text-[#F59E0B]" },
                ].map(({ key, label, icon: Icon, color }) => (
                  <div key={key} className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <p className="text-[#5A5A72] text-xs">{label}</p>
                    </div>
                    <p className={`text-2xl font-bold tabular-nums ${color}`}>{leads[key] ?? 0}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Alertas do Sistema ───────────────────────────────────── */}
            {alertas && (alertas.ativos.length > 0 || alertas.resolvidos.length > 0) && (
              <section className="space-y-3">
                <h2 className="text-[#8B8B9E] text-xs uppercase tracking-wider font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#F87171]" />
                  Alertas do Sistema
                  {alertas.ativos.length > 0 && (
                    <span className="bg-[#F87171]/20 text-[#F87171] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {alertas.ativos.length} ativo{alertas.ativos.length > 1 ? "s" : ""}
                    </span>
                  )}
                </h2>

                {/* Ativos */}
                {alertas.ativos.length > 0 && (
                  <div className="bg-[#2A1616] border border-[#F87171]/30 rounded-xl divide-y divide-[#F87171]/10">
                    {alertas.ativos.map((a) => (
                      <div key={a.id} className="flex items-start justify-between gap-4 px-5 py-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <AlertTriangle className="w-4 h-4 text-[#F87171] shrink-0 mt-0.5 animate-pulse" />
                          <div className="min-w-0">
                            <p className="text-[#F1F1F3] text-sm font-medium">{a.titulo}</p>
                            <p className="text-[#8B8B9E] text-xs mt-0.5">{a.mensagem}</p>
                            <p className="text-[#5A5A72] text-[10px] mt-1">
                              {new Date(a.created_at).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}
                              {a.referencia_nome && <> · <span className="font-mono">{a.referencia_nome}</span></>}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 text-xs h-7 px-2.5 border-[#F87171]/30 text-[#F87171] hover:bg-[#F87171]/10"
                          disabled={resolvingId === a.id}
                          onClick={() => resolverAlerta(a.id)}
                        >
                          {resolvingId === a.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <CheckCheck className="w-3 h-3 mr-1" />
                              Resolver
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Resolvidos recentes */}
                {alertas.resolvidos.length > 0 && (
                  <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl divide-y divide-[#1E1E2A]">
                    <div className="px-5 py-3 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366]" />
                      <p className="text-[#5A5A72] text-xs font-semibold uppercase tracking-wider">Resolvidos recentemente</p>
                    </div>
                    {alertas.resolvidos.map((a) => (
                      <div key={a.id} className="px-5 py-3 flex items-start gap-3 opacity-60">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[#C4C4D4] text-xs font-medium">{a.titulo}</p>
                          <p className="text-[#5A5A72] text-[10px] mt-0.5">
                            Resolvido em{" "}
                            {a.resolvido_at
                              ? new Date(a.resolvido_at).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })
                              : "—"}
                            {a.referencia_nome && <> · <span className="font-mono">{a.referencia_nome}</span></>}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── Falhas Recentes ──────────────────────────────────────── */}
            <section className="space-y-3">
              <h2 className="text-[#8B8B9E] text-xs uppercase tracking-wider font-semibold">
                Falhas Recentes
              </h2>

              {/* Tabs */}
              <div className="flex gap-1 border border-[#1E1E2A] rounded-lg p-1 w-fit bg-[#0B0B0F]">
                {([
                  { key: "leads",  label: "Leads Manychat",  count: totalFailedLeads },
                  { key: "grupos", label: "Eventos de Grupo", count: totalFailedGrupos },
                ] as const).map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeTab === key
                        ? "bg-[#16161E] text-[#F1F1F3] border border-[#1E1E2A]"
                        : "text-[#5A5A72] hover:text-[#8B8B9E]"
                    }`}
                  >
                    {label}
                    {count > 0 && (
                      <span className="bg-[#F87171]/20 text-[#F87171] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
                {/* Tab: Leads */}
                {activeTab === "leads" && (
                  webhooks.recentFailed.length === 0 ? (
                    <EmptyState label="Nenhuma falha recente na fila de leads" />
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#1E1E2A]">
                          <Th>Contato</Th>
                          <Th>Flow</Th>
                          <Th>Motivo</Th>
                          <Th>Tent.</Th>
                          <Th>Quando</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {webhooks.recentFailed.map((job, i) => (
                          <tr key={job.jobId ?? i} className="border-b border-[#1E1E2A] last:border-0 hover:bg-[#1A1A24] transition-colors">
                            <td className="px-5 py-3">
                              <p className="text-[#F1F1F3] text-sm">{job.nome ?? "—"}</p>
                              <p className="text-[#8B8B9E] text-xs font-mono">{job.telefone ?? "—"}</p>
                            </td>
                            <td className="px-5 py-3">
                              <p className="text-[#C4C4D4] text-xs font-mono truncate max-w-[140px]">{job.flowNs ?? "—"}</p>
                            </td>
                            <td className="px-5 py-3">
                              <p className="text-[#F87171] text-xs truncate max-w-[180px]">{job.failedReason ?? "—"}</p>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className="text-[#8B8B9E] text-sm tabular-nums">{job.attemptsMade}</span>
                            </td>
                            <td className="px-5 py-3">
                              <p className="text-[#5A5A72] text-xs whitespace-nowrap">{fmt(job.timestamp)}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}

                {/* Tab: Grupos */}
                {activeTab === "grupos" && (
                  grupoEventos.recentFailed.length === 0 ? (
                    <EmptyState label="Nenhuma falha recente na fila de eventos de grupo" />
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#1E1E2A]">
                          <Th>Tipo</Th>
                          <Th>Telefone</Th>
                          <Th>Grupo</Th>
                          <Th>Motivo</Th>
                          <Th>Tent.</Th>
                          <Th>Quando</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupoEventos.recentFailed.map((job, i) => (
                          <tr key={job.jobId ?? i} className="border-b border-[#1E1E2A] last:border-0 hover:bg-[#1A1A24] transition-colors">
                            <td className="px-5 py-3">
                              {job.tipo === "entrada" ? (
                                <span className="inline-flex items-center gap-1 text-[#25D366] text-xs font-medium">
                                  <ArrowDownCircle className="w-3 h-3" /> Entrada
                                </span>
                              ) : job.tipo === "saida" ? (
                                <span className="inline-flex items-center gap-1 text-[#F87171] text-xs font-medium">
                                  <ArrowUpCircle className="w-3 h-3" /> Saída
                                </span>
                              ) : (
                                <span className="text-[#5A5A72] text-xs">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              <p className="text-[#C4C4D4] text-xs font-mono">{job.telefone ?? "—"}</p>
                            </td>
                            <td className="px-5 py-3">
                              <p className="text-[#8B8B9E] text-xs truncate max-w-[120px]">{job.chatName ?? "—"}</p>
                            </td>
                            <td className="px-5 py-3">
                              <p className="text-[#F87171] text-xs truncate max-w-[160px]">{job.failedReason ?? "—"}</p>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className="text-[#8B8B9E] text-sm tabular-nums">{job.attemptsMade}</span>
                            </td>
                            <td className="px-5 py-3">
                              <p className="text-[#5A5A72] text-xs whitespace-nowrap">{fmt(job.timestamp)}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

// ── Micro-components ──────────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left text-[10px] font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">
      {children}
    </th>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <Activity className="w-8 h-8 text-[#5A5A72]" />
      <p className="text-[#5A5A72] text-sm">{label}</p>
    </div>
  )
}
