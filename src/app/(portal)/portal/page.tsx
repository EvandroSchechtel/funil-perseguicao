"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import {
  Users2,
  CheckCircle2,
  TrendingUp,
  FileText,
  Loader2,
  ArrowRight,
  Activity,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardData {
  kpis: {
    total_leads_7d: number
    sucesso_7d: number
    taxa_sucesso: number
    demandas_abertas: number
    demandas_em_execucao: number
  }
  demandas_recentes: {
    id: string
    titulo: string
    tipo: string
    status: string
    created_at: string
  }[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const tipoLabels: Record<string, string> = {
  nova_campanha: "Nova Campanha",
  ajuste_funil: "Ajuste de Funil",
  relatorio_customizado: "Relatório",
  suporte_tecnico: "Suporte",
  outro: "Outro",
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  aberta: { label: "Aberta", color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
  em_analise: { label: "Em Análise", color: "#FBBF24", bg: "rgba(251,191,36,0.12)" },
  em_execucao: { label: "Em Execução", color: "#25D366", bg: "rgba(37,211,102,0.12)" },
  aguardando_cliente: { label: "Aguardando", color: "#F97316", bg: "rgba(249,115,22,0.12)" },
  concluida: { label: "Concluída", color: "#5A5A72", bg: "rgba(90,90,114,0.12)" },
  cancelada: { label: "Cancelada", color: "#F87171", bg: "rgba(248,113,113,0.12)" },
}

function formatDate(str: string): string {
  return new Date(str).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { label: status, color: "#8B8B9E", bg: "rgba(139,139,158,0.12)" }
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.label}
    </span>
  )
}

function TipoBadge({ tipo }: { tipo: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#111118] text-[#8B8B9E] border border-[#1E1E2A]">
      {tipoLabels[tipo] ?? tipo}
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
  color = "text-[#F1F1F3]",
  icon,
}: {
  label: string
  value: number | string
  suffix?: string
  color?: string
  icon: React.ReactNode
}) {
  return (
    <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <p className="text-[#8B8B9E] text-sm font-medium">{label}</p>
        <div className="w-9 h-9 rounded-lg bg-[#111118] flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className={`text-3xl font-bold ${color}`}>
        {value}
        {suffix && <span className="text-lg ml-0.5 font-semibold">{suffix}</span>}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-7 h-7 animate-spin text-[#25D366]" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PortalDashboardPage() {
  const { accessToken, user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    if (!accessToken || !user) return
    setLoading(true)
    try {
      const [dashRes, demandasRes, demandasAllRes] = await Promise.all([
        fetch(`/api/admin/dashboard?section=geral&from=${encodeURIComponent(new Date(Date.now() - 7 * 86400000).toISOString())}&to=${encodeURIComponent(new Date().toISOString())}&clienteId=${user.cliente_id ?? ""}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch("/api/portal/demandas?per_page=5", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch("/api/portal/demandas?per_page=200", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ])

      let kpis = { total_leads_7d: 0, sucesso_7d: 0, taxa_sucesso: 0, demandas_abertas: 0, demandas_em_execucao: 0 }
      let demandas_recentes: DashboardData["demandas_recentes"] = []

      if (dashRes.ok) {
        const dashData = await dashRes.json()
        if (dashData?.kpis) {
          kpis = {
            total_leads_7d: dashData.kpis.total ?? 0,
            sucesso_7d: dashData.kpis.sucesso ?? 0,
            taxa_sucesso: dashData.kpis.taxa_sucesso ?? 0,
            demandas_abertas: 0,
            demandas_em_execucao: 0,
          }
        }
      }

      if (demandasRes.ok) {
        const dem = await demandasRes.json()
        demandas_recentes = dem.demandas ?? []
      }

      if (demandasAllRes.ok) {
        const allDem = await demandasAllRes.json()
        const all = allDem.demandas ?? []
        kpis.demandas_abertas = all.filter((d: { status: string }) => d.status === "aberta").length
        kpis.demandas_em_execucao = all.filter((d: { status: string }) => d.status === "em_execucao").length
      }

      setData({ kpis, demandas_recentes })
    } catch {
      toast.error("Erro ao carregar dashboard.")
    } finally {
      setLoading(false)
    }
  }, [accessToken, user])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top bar */}
      <header className="h-16 bg-[#0B0B0F] border-b border-[#1E1E2A] flex items-center px-6 sticky top-0 z-20">
        <h1 className="text-[#F1F1F3] font-semibold text-sm">Dashboard</h1>
      </header>

      <div className="flex-1 p-6 space-y-6">
        {/* Welcome */}
        <div>
          <h1 className="text-[#F1F1F3] text-2xl font-bold">
            Olá, {user?.nome?.split(" ")[0] ?? ""}!
          </h1>
          <p className="text-[#8B8B9E] text-sm mt-1">
            Aqui está um resumo das suas métricas e demandas.
          </p>
        </div>

        {loading ? (
          <Spinner />
        ) : data ? (
          <>
            {/* KPI Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                label="Total Leads (7d)"
                value={data.kpis.total_leads_7d.toLocaleString("pt-BR")}
                color="text-[#F1F1F3]"
                icon={<Users2 className="w-5 h-5 text-[#60A5FA]" />}
              />
              <KpiCard
                label="Sucesso (7d)"
                value={data.kpis.sucesso_7d.toLocaleString("pt-BR")}
                color="text-[#25D366]"
                icon={<CheckCircle2 className="w-5 h-5 text-[#25D366]" />}
              />
              <KpiCard
                label="Taxa de Sucesso"
                value={data.kpis.taxa_sucesso}
                suffix="%"
                color="text-[#FBBF24]"
                icon={<TrendingUp className="w-5 h-5 text-[#FBBF24]" />}
              />
            </div>

            {/* KPI Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <KpiCard
                label="Demandas Abertas"
                value={data.kpis.demandas_abertas}
                color="text-[#60A5FA]"
                icon={<FileText className="w-5 h-5 text-[#60A5FA]" />}
              />
              <KpiCard
                label="Demandas em Execução"
                value={data.kpis.demandas_em_execucao}
                color="text-[#25D366]"
                icon={<Activity className="w-5 h-5 text-[#25D366]" />}
              />
            </div>

            {/* Recent demands */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1E1E2A] flex items-center justify-between">
                <h2 className="text-[#F1F1F3] font-semibold">Demandas Recentes</h2>
                <Link
                  href="/portal/demandas"
                  className="flex items-center gap-1 text-sm text-[#25D366] hover:text-[#1EBD5A] transition-colors font-medium"
                >
                  Ver todas
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {data.demandas_recentes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <FileText className="w-10 h-10 text-[#2A2A3A]" />
                  <p className="text-[#5A5A72] text-sm">Nenhuma demanda ainda.</p>
                  <Link
                    href="/portal/demandas/nova"
                    className="mt-1 text-sm text-[#25D366] hover:underline font-medium"
                  >
                    Criar primeira demanda →
                  </Link>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1E1E2A]">
                      {["Título", "Tipo", "Status", "Data"].map((h) => (
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
                    {data.demandas_recentes.map((d) => (
                      <tr
                        key={d.id}
                        className="border-b border-[#1E1E2A] last:border-0 hover:bg-[#1C1C28] transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/portal/demandas/${d.id}`}
                            className="text-[#F1F1F3] text-sm font-medium hover:text-[#25D366] transition-colors"
                          >
                            {d.titulo}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <TipoBadge tipo={d.tipo} />
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={d.status} />
                        </td>
                        <td className="px-5 py-3 text-[#8B8B9E] text-sm whitespace-nowrap">
                          {formatDate(d.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
