"use client"

import React, { useState, useEffect, useCallback } from "react"
import { CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, Activity, RefreshCw } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"

interface QueueStats {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: number
}

interface LeadCounts {
  pendente?: number
  processando?: number
  sucesso?: number
  falha?: number
  sem_optin?: number
}

interface FailedJob {
  jobId: string | undefined
  leadId: string | undefined
  nome: string | undefined
  telefone: string | undefined
  flowNs: string | undefined
  failedReason: string | undefined
  attemptsMade: number
  timestamp: number
}

interface QueueData {
  queue: QueueStats
  leads: LeadCounts
  recentFailed: FailedJob[]
}

function fmt(ts: number) {
  return new Date(ts).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
}

export default function FilaPage() {
  const { accessToken } = useAuth()
  const [data, setData] = useState<QueueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

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
    }
  }, [accessToken])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 10s
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 10_000)
    return () => clearInterval(interval)
  }, [fetchData])

  const queue = data?.queue
  const leads = data?.leads ?? {}
  const recentFailed = data?.recentFailed ?? []

  const totalLeads = Object.values(leads).reduce((a, b) => a + (b ?? 0), 0)

  return (
    <div className="flex flex-col h-full">
      <Header breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Fila de Processamento" },
      ]} />

      <div className="p-6 space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[#F1F1F3] text-2xl font-bold">Fila de Processamento</h1>
            <p className="text-[#8B8B9E] text-sm mt-0.5">BullMQ + status dos leads em tempo real (atualiza a cada 10s)</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchData(true)} loading={refreshing}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
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
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* BullMQ Queue Stats */}
            <div>
              <h2 className="text-[#8B8B9E] text-xs uppercase tracking-wider font-semibold mb-3">BullMQ — Fila de Jobs</h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {[
                  { label: "Aguardando", value: queue?.waiting ?? 0, color: "text-[#8B8B9E]" },
                  { label: "Ativo", value: queue?.active ?? 0, color: "text-[#60A5FA]" },
                  { label: "Concluído", value: queue?.completed ?? 0, color: "text-[#25D366]" },
                  { label: "Falhou", value: queue?.failed ?? 0, color: "text-[#F87171]" },
                  { label: "Atrasado", value: queue?.delayed ?? 0, color: "text-[#F59E0B]" },
                  { label: "Pausado", value: queue?.paused ?? 0, color: "text-[#8B8B9E]" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-4 text-center">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-[#5A5A72] text-xs mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Lead Status Counts */}
            <div>
              <h2 className="text-[#8B8B9E] text-xs uppercase tracking-wider font-semibold mb-3">
                Leads por Status — {totalLeads} total
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  { key: "pendente", label: "Pendente", icon: Clock, color: "text-[#8B8B9E]" },
                  { key: "processando", label: "Processando", icon: Loader2, color: "text-[#60A5FA]" },
                  { key: "sucesso", label: "Sucesso", icon: CheckCircle2, color: "text-[#25D366]" },
                  { key: "falha", label: "Falha", icon: XCircle, color: "text-[#F87171]" },
                  { key: "sem_optin", label: "Sem Opt-in", icon: AlertTriangle, color: "text-[#F59E0B]" },
                ].map(({ key, label, icon: Icon, color }) => (
                  <div key={key} className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <p className="text-[#5A5A72] text-xs">{label}</p>
                    </div>
                    <p className={`text-2xl font-bold ${color}`}>{leads[key as keyof LeadCounts] ?? 0}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Failed Jobs */}
            <div>
              <h2 className="text-[#8B8B9E] text-xs uppercase tracking-wider font-semibold mb-3">
                Últimas Falhas na Fila
              </h2>
              <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
                {recentFailed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Activity className="w-8 h-8 text-[#5A5A72]" />
                    <p className="text-[#5A5A72] text-sm">Nenhum job com falha recente</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#1E1E2A]">
                        <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Contato</th>
                        <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Flow</th>
                        <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Motivo</th>
                        <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Tentativas</th>
                        <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Quando</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentFailed.map((job, i) => (
                        <tr key={job.jobId ?? i} className="border-b border-[#1E1E2A] last:border-0">
                          <td className="px-5 py-3">
                            <p className="text-[#F1F1F3] text-sm">{job.nome ?? "—"}</p>
                            <p className="text-[#8B8B9E] text-xs font-mono">{job.telefone ?? "—"}</p>
                          </td>
                          <td className="px-5 py-3">
                            <p className="text-[#C4C4D4] text-xs font-mono truncate max-w-[160px]">{job.flowNs ?? "—"}</p>
                          </td>
                          <td className="px-5 py-3">
                            <p className="text-[#F87171] text-xs truncate max-w-[200px]">{job.failedReason ?? "—"}</p>
                          </td>
                          <td className="px-5 py-3">
                            <p className="text-[#8B8B9E] text-sm">{job.attemptsMade}</p>
                          </td>
                          <td className="px-5 py-3">
                            <p className="text-[#5A5A72] text-xs">{fmt(job.timestamp)}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
