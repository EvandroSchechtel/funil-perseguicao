"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { FileText, Eye, Loader2, AlertTriangle } from "lucide-react"
import { Header } from "@/components/layout/Header"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Cliente {
  id: string
  nome: string
}

interface DemandaRow {
  id: string
  titulo: string
  tipo: string
  status: string
  prioridade: string
  cliente: { id: string; nome: string }
  atribuido_a: { nome: string } | null
  created_at: string
  updated_at: string
}

interface KpiData {
  total: number
  abertas: number
  em_execucao: number
  atrasadas: number
}

// ---------------------------------------------------------------------------
// Constants
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

const prioridadeConfig: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "#5A5A72" },
  normal: { label: "Normal", color: "#8B8B9E" },
  alta: { label: "Alta", color: "#FBBF24" },
  urgente: { label: "Urgente", color: "#F87171" },
}

const statusOptions = [
  { value: "", label: "Todos os status" },
  { value: "aberta", label: "Aberta" },
  { value: "em_analise", label: "Em Análise" },
  { value: "em_execucao", label: "Em Execução" },
  { value: "aguardando_cliente", label: "Aguardando Cliente" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
]

const prioridadeOptions = [
  { value: "", label: "Todas as prioridades" },
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(str: string): string {
  return new Date(str).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function isAtrasada(demanda: DemandaRow): boolean {
  if (["concluida", "cancelada"].includes(demanda.status)) return false
  const lastUpdate = new Date(demanda.updated_at || demanda.created_at)
  const hoursAgo = (Date.now() - lastUpdate.getTime()) / 3600000
  return hoursAgo > 48
}

// ---------------------------------------------------------------------------
// Badge components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { label: status, color: "#8B8B9E", bg: "rgba(139,139,158,0.12)" }
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.label}
    </span>
  )
}

function PrioridadeBadge({ prioridade }: { prioridade: string }) {
  const cfg = prioridadeConfig[prioridade] ?? { label: prioridade, color: "#8B8B9E" }
  return (
    <span className="text-xs font-medium" style={{ color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

function TipoBadge({ tipo }: { tipo: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#111118] text-[#8B8B9E] border border-[#1E1E2A] whitespace-nowrap">
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
  color = "text-[#F1F1F3]",
  icon,
}: {
  label: string
  value: number
  color?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <p className="text-[#8B8B9E] text-sm font-medium">{label}</p>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-[#111118] flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminDemandasPage() {
  const { accessToken } = useAuth()

  const [demandas, setDemandas] = useState<DemandaRow[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)

  const [filterCliente, setFilterCliente] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterPrioridade, setFilterPrioridade] = useState("")

  const fetchClientes = useCallback(async () => {
    if (!accessToken) return
    try {
      const res = await fetch("/api/admin/clientes?per_page=100", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setClientes(data.data ?? [])
    } catch {
      // silent
    }
  }, [accessToken])

  const fetchDemandas = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: "200" })
      if (filterCliente) params.set("clienteId", filterCliente)
      if (filterStatus) params.set("status", filterStatus)
      if (filterPrioridade) params.set("prioridade", filterPrioridade)

      const res = await fetch(`/api/admin/demandas?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDemandas(data.data ?? [])
    } catch {
      toast.error("Erro ao carregar demandas.")
    } finally {
      setLoading(false)
    }
  }, [accessToken, filterCliente, filterStatus, filterPrioridade])

  useEffect(() => {
    fetchClientes()
  }, [fetchClientes])

  useEffect(() => {
    fetchDemandas()
  }, [fetchDemandas])

  // Compute KPIs
  const kpis: KpiData = {
    total: demandas.length,
    abertas: demandas.filter((d) => d.status === "aberta").length,
    em_execucao: demandas.filter((d) => d.status === "em_execucao").length,
    atrasadas: demandas.filter(isAtrasada).length,
  }

  const selectCls =
    "bg-[#111118] border border-[#1E1E2A] text-[#C4C4D4] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#25D366]/50 min-w-[160px]"

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Demandas" },
        ]}
      />

      <div className="p-6 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-[#F1F1F3] text-2xl font-bold">Demandas</h1>
          <p className="text-[#8B8B9E] text-sm mt-1">
            Gerencie todas as solicitações dos clientes
          </p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total"
            value={kpis.total}
            icon={<FileText className="w-4 h-4 text-[#60A5FA]" />}
          />
          <KpiCard
            label="Abertas"
            value={kpis.abertas}
            color="text-[#60A5FA]"
            icon={<FileText className="w-4 h-4 text-[#60A5FA]" />}
          />
          <KpiCard
            label="Em Execução"
            value={kpis.em_execucao}
            color="text-[#25D366]"
            icon={<FileText className="w-4 h-4 text-[#25D366]" />}
          />
          <KpiCard
            label="Atrasadas (+48h)"
            value={kpis.atrasadas}
            color={kpis.atrasadas > 0 ? "text-[#F87171]" : "text-[#F1F1F3]"}
            icon={<AlertTriangle className="w-4 h-4 text-[#F87171]" />}
          />
        </div>

        {/* Filters */}
        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-4">
          <div className="flex flex-wrap gap-3">
            <select
              value={filterCliente}
              onChange={(e) => setFilterCliente(e.target.value)}
              className={selectCls}
            >
              <option value="">Todos os clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#111118]">
                  {c.nome}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={selectCls}
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value} className="bg-[#111118]">
                  {o.label}
                </option>
              ))}
            </select>

            <select
              value={filterPrioridade}
              onChange={(e) => setFilterPrioridade(e.target.value)}
              className={selectCls}
            >
              {prioridadeOptions.map((o) => (
                <option key={o.value} value={o.value} className="bg-[#111118]">
                  {o.label}
                </option>
              ))}
            </select>

            {(filterCliente || filterStatus || filterPrioridade) && (
              <button
                onClick={() => {
                  setFilterCliente("")
                  setFilterStatus("")
                  setFilterPrioridade("")
                }}
                className="text-sm text-[#8B8B9E] hover:text-[#F87171] transition-colors"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
            </div>
          ) : demandas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#1E1E2A] flex items-center justify-center">
                <FileText className="w-8 h-8 text-[#2A2A3A]" />
              </div>
              <div className="text-center">
                <p className="text-[#F1F1F3] font-semibold text-lg">Nenhuma demanda encontrada</p>
                <p className="text-[#8B8B9E] text-sm mt-1">Tente ajustar os filtros aplicados.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1E1E2A]">
                    {["Título", "Cliente", "Tipo", "Status", "Prioridade", "Responsável", "Criado em", ""].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {demandas.map((d) => {
                    const atrasada = isAtrasada(d)
                    return (
                      <tr
                        key={d.id}
                        className={`border-b border-[#1E1E2A] last:border-0 hover:bg-[#1C1C28] transition-colors ${
                          atrasada ? "border-l-2 border-l-[#F87171]" : ""
                        }`}
                      >
                        <td className="px-5 py-4 max-w-[200px]">
                          <div className="flex items-center gap-2">
                            {atrasada && (
                              <AlertTriangle className="w-3.5 h-3.5 text-[#F87171] shrink-0" aria-label="Atrasada +48h" />
                            )}
                            <Link
                              href={`/admin/demandas/${d.id}`}
                              className="text-[#F1F1F3] text-sm font-medium hover:text-[#25D366] transition-colors truncate block"
                            >
                              {d.titulo}
                            </Link>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <p className="text-[#C4C4D4] text-sm">{d.cliente?.nome ?? "—"}</p>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <TipoBadge tipo={d.tipo} />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <StatusBadge status={d.status} />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <PrioridadeBadge prioridade={d.prioridade} />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <p className="text-[#8B8B9E] text-sm">
                            {d.atribuido_a?.nome ?? <span className="text-[#5A5A72]">—</span>}
                          </p>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <p className="text-[#8B8B9E] text-sm">{formatDate(d.created_at)}</p>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <Link
                            href={`/admin/demandas/${d.id}`}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8B8B9E] hover:text-[#25D366] transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
