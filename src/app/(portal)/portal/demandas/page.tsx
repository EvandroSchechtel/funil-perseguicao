"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { Plus, FileText, MessageSquare, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Demanda {
  id: string
  titulo: string
  descricao: string
  tipo: string
  status: string
  prioridade: string
  comentarios_count: number
  updated_at: string
  created_at: string
}

type StatusFilter = "todas" | "aberta" | "em_andamento" | "concluida"

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

const statusFilterMap: Record<StatusFilter, string[]> = {
  todas: [],
  aberta: ["aberta"],
  em_andamento: ["em_analise", "em_execucao", "aguardando_cliente"],
  concluida: ["concluida", "cancelada"],
}

const filterTabs: { key: StatusFilter; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "aberta", label: "Abertas" },
  { key: "em_andamento", label: "Em Andamento" },
  { key: "concluida", label: "Concluídas" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelative(str: string): string {
  const diff = Date.now() - new Date(str).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `há ${days}d`
  if (hours > 0) return `há ${hours}h`
  if (mins > 0) return `há ${mins}min`
  return "agora"
}

// ---------------------------------------------------------------------------
// Badge components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { label: status, color: "#8B8B9E", bg: "rgba(139,139,158,0.12)" }
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {status === "concluida" && "✓ "}
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

function PrioridadeBadge({ prioridade }: { prioridade: string }) {
  const cfg = prioridadeConfig[prioridade] ?? { label: prioridade, color: "#8B8B9E" }
  return (
    <span className="text-xs font-medium" style={{ color: cfg.color }}>
      ● {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Demand Card
// ---------------------------------------------------------------------------

function DemandaCard({ demanda }: { demanda: Demanda }) {
  return (
    <Link href={`/portal/demandas/${demanda.id}`}>
      <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5 hover:border-[#2A2A3A] hover:bg-[#1A1A24] transition-all cursor-pointer group">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <TipoBadge tipo={demanda.tipo} />
            <StatusBadge status={demanda.status} />
          </div>
          <PrioridadeBadge prioridade={demanda.prioridade} />
        </div>

        {/* Title */}
        <h3 className="text-[#F1F1F3] font-semibold text-base mb-1.5 group-hover:text-[#25D366] transition-colors line-clamp-1">
          {demanda.titulo}
        </h3>

        {/* Description preview */}
        <p className="text-[#8B8B9E] text-sm line-clamp-2 leading-relaxed mb-4">
          {demanda.descricao}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-[#5A5A72]">
          <div className="flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{demanda.comentarios_count ?? 0} comentários</span>
          </div>
          <span>Atualizado {formatRelative(demanda.updated_at || demanda.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PortalDemandasPage() {
  const { accessToken } = useAuth()
  const [demandas, setDemandas] = useState<Demanda[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("todas")

  const fetchDemandas = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await fetch("/api/portal/demandas?per_page=50", {
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
  }, [accessToken])

  useEffect(() => {
    fetchDemandas()
  }, [fetchDemandas])

  const filtered = demandas.filter((d) => {
    const allowed = statusFilterMap[activeFilter]
    if (allowed.length === 0) return true
    return allowed.includes(d.status)
  })

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top bar */}
      <header className="h-16 bg-[#0B0B0F] border-b border-[#1E1E2A] flex items-center justify-between px-6 sticky top-0 z-20">
        <h1 className="text-[#F1F1F3] font-semibold text-sm">Minhas Demandas</h1>
        <Link href="/portal/demandas/nova">
          <Button size="sm">
            <Plus className="w-4 h-4" />
            Nova Demanda
          </Button>
        </Link>
      </header>

      <div className="flex-1 p-6 space-y-5">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[#F1F1F3] text-2xl font-bold">Minhas Demandas</h1>
            <p className="text-[#8B8B9E] text-sm mt-1">
              Acompanhe o andamento de todas as suas solicitações
            </p>
          </div>
          <Link href="/portal/demandas/nova">
            <Button>
              <Plus className="w-4 h-4" />
              Nova Demanda
            </Button>
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 border-b border-[#1E1E2A]">
          {filterTabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                activeFilter === key
                  ? "text-[#25D366] border-[#25D366]"
                  : "text-[#8B8B9E] border-transparent hover:text-[#C4C4D4]"
              }`}
            >
              {label}
              {key !== "todas" && !loading && (
                <span className="ml-1.5 text-xs text-[#5A5A72]">
                  ({demandas.filter((d) => statusFilterMap[key].includes(d.status)).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-[#25D366]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#1E1E2A] flex items-center justify-center">
              <FileText className="w-8 h-8 text-[#2A2A3A]" />
            </div>
            <div className="text-center">
              <p className="text-[#F1F1F3] font-semibold text-lg">Nenhuma demanda ainda</p>
              <p className="text-[#8B8B9E] text-sm mt-1">
                {activeFilter === "todas"
                  ? "Crie sua primeira demanda para começar."
                  : "Nenhuma demanda nesta categoria."}
              </p>
            </div>
            {activeFilter === "todas" && (
              <Link href="/portal/demandas/nova">
                <Button>
                  <Plus className="w-4 h-4" />
                  Criar Demanda
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((d) => (
              <DemandaCard key={d.id} demanda={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
