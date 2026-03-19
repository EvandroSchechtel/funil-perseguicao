"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { TrendingUp, Users2, CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Header } from "@/components/layout/Header"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

interface DashboardData {
  leads_hoje: number
  leads_semana: number
  sucesso_semana: number
  falhas_semana: number
  taxa_sucesso: number
  em_fila: number
  ultimos_leads: Array<{
    id: string
    nome: string
    telefone: string
    status: "pendente" | "processando" | "sucesso" | "falha"
    created_at: string
    webhook: { nome: string }
  }>
}

function StatCard({
  label,
  value,
  icon,
  color,
  suffix,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
  suffix?: string
}) {
  return (
    <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[#8B8B9E] text-sm">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>
            {value}
            {suffix && <span className="text-lg ml-0.5">{suffix}</span>}
          </p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-opacity-10 ${color.replace("text-", "bg-").replace("[", "[").replace("]", "]")}`}
          style={{ backgroundColor: "rgba(37,211,102,0.08)" }}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function statusBadge(status: string) {
  const variants: Record<string, { label: string; class: string }> = {
    pendente: { label: "Pendente", class: "bg-[#2A2A1E] text-[#F59E0B] border-[#F59E0B]/30" },
    processando: { label: "Processando", class: "bg-[#1E1E2A] text-[#60A5FA] border-[#60A5FA]/30" },
    sucesso: { label: "Sucesso", class: "bg-[#162516] text-[#25D366] border-[#25D366]/30" },
    falha: { label: "Falha", class: "bg-[#2A1616] text-[#F87171] border-[#F87171]/30" },
  }
  const v = variants[status] || variants.pendente
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${v.class}`}>
      {v.label}
    </span>
  )
}

export default function DashboardPage() {
  const { accessToken } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchDashboard = useCallback(async () => {
    if (!accessToken) return
    try {
      const res = await fetch("/api/admin/dashboard", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json)
      setLastRefresh(new Date())
    } catch {
      toast.error("Erro ao carregar dashboard.")
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    fetchDashboard()
    const interval = setInterval(fetchDashboard, 30000)
    return () => clearInterval(interval)
  }, [fetchDashboard])

  function formatDate(str: string) {
    return new Date(str).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    })
  }

  return (
    <div className="flex flex-col h-full">
      <Header breadcrumbs={[{ label: "Dashboard" }]} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[#F1F1F3] text-2xl font-bold">Dashboard</h1>
            <p className="text-[#8B8B9E] text-sm mt-1">
              Atualizado às {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <button
            onClick={fetchDashboard}
            className="flex items-center gap-2 text-[#8B8B9E] hover:text-[#F1F1F3] text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
              <StatCard
                label="Leads Hoje"
                value={data?.leads_hoje ?? 0}
                icon={<Users2 className="w-5 h-5 text-[#25D366]" />}
                color="text-[#F1F1F3]"
              />
              <StatCard
                label="Leads (7 dias)"
                value={data?.leads_semana ?? 0}
                icon={<TrendingUp className="w-5 h-5 text-[#60A5FA]" />}
                color="text-[#F1F1F3]"
              />
              <StatCard
                label="Sucessos (7d)"
                value={data?.sucesso_semana ?? 0}
                icon={<CheckCircle2 className="w-5 h-5 text-[#25D366]" />}
                color="text-[#25D366]"
              />
              <StatCard
                label="Falhas (7d)"
                value={data?.falhas_semana ?? 0}
                icon={<XCircle className="w-5 h-5 text-[#F87171]" />}
                color="text-[#F87171]"
              />
              <StatCard
                label="Taxa de Sucesso"
                value={data?.taxa_sucesso ?? 0}
                icon={<Clock className="w-5 h-5 text-[#F59E0B]" />}
                color="text-[#25D366]"
                suffix="%"
              />
            </div>

            {/* Em fila badge */}
            {(data?.em_fila ?? 0) > 0 && (
              <div className="mb-5 flex items-center gap-2 text-sm text-[#60A5FA] bg-[#1E1E2A] border border-[#60A5FA]/20 rounded-lg px-4 py-2.5 w-fit">
                <div className="w-2 h-2 rounded-full bg-[#60A5FA] animate-pulse" />
                {data?.em_fila} lead{(data?.em_fila ?? 0) !== 1 ? "s" : ""} em processamento na fila
              </div>
            )}

            {/* Últimos Leads Table */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E1E2A]">
                <h2 className="text-[#F1F1F3] font-semibold">Últimos Leads</h2>
                <Link href="/admin/leads" className="text-[#25D366] text-sm hover:underline">
                  Ver todos →
                </Link>
              </div>

              {!data?.ultimos_leads?.length ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Users2 className="w-10 h-10 text-[#2A2A3A]" />
                  <p className="text-[#5A5A72] text-sm">Nenhum lead ainda</p>
                  <Link href="/admin/webhooks" className="text-[#25D366] text-sm hover:underline">
                    Criar um webhook →
                  </Link>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1E1E2A]">
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Nome</th>
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Webhook</th>
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Status</th>
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Recebido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ultimos_leads.map((lead) => (
                      <tr key={lead.id} className="border-b border-[#1E1E2A] last:border-0 hover:bg-[#1C1C28] transition-colors">
                        <td className="px-5 py-3">
                          <div>
                            <p className="text-[#F1F1F3] text-sm font-medium">{lead.nome}</p>
                            <p className="text-[#5A5A72] text-xs mt-0.5">{lead.telefone}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[#C4C4D4] text-sm">{lead.webhook.nome}</span>
                        </td>
                        <td className="px-5 py-3">{statusBadge(lead.status)}</td>
                        <td className="px-5 py-3">
                          <span className="text-[#8B8B9E] text-sm">{formatDate(lead.created_at)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
