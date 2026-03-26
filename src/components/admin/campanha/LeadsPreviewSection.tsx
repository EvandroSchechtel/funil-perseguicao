"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Search, Users2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { type LeadItem, fmtDt, leadStatusStyle } from "./types"

const PER_PAGE = 20

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "sucesso", label: "Sucesso" },
  { value: "falha", label: "Falha" },
  { value: "sem_optin", label: "Sem opt-in" },
  { value: "pendente", label: "Pendente" },
  { value: "processando", label: "Processando" },
  { value: "aguardando", label: "Aguardando" },
]

const STATUS_PILL_STYLES: Record<string, string> = {
  sucesso: "bg-[#162516] text-[#25D366] border-[#25D366]/30",
  falha: "bg-[#2A1616] text-[#F87171] border-[#F87171]/30",
  sem_optin: "bg-[#2A2010] text-[#F59E0B] border-[#F59E0B]/30",
  pendente: "bg-[#1C1C28] text-[#8B8B9E] border-[#8B8B9E]/30",
  processando: "bg-[#1E1E2A] text-[#60A5FA] border-[#60A5FA]/30",
  aguardando: "bg-[#1A1500] text-[#F59E0B] border-[#F59E0B]/40",
}

const STATUS_LABELS: Record<string, string> = {
  sucesso: "Sucesso",
  falha: "Falha",
  sem_optin: "Sem opt-in",
  pendente: "Pendente",
  processando: "Processando",
  aguardando: "Aguardando",
}

interface LeadsSectionProps {
  campanhaId: string
  accessToken: string | null
  canReprocess?: boolean
}

export function LeadsPreviewSection({ campanhaId, accessToken, canReprocess }: LeadsSectionProps) {
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("todos")
  const [search, setSearch] = useState("")
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [reprocessingId, setReprocessingId] = useState<string | null>(null)

  // ── Fetch leads ────────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        campanha_id: campanhaId,
        page: String(page),
        per_page: String(PER_PAGE),
      })
      if (statusFilter && statusFilter !== "todos") params.set("status", statusFilter)
      if (search) params.set("q", search)

      const res = await fetch(`/api/admin/leads?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLeads(data.leads || [])
      setTotal(data.pagination?.total || 0)
      setTotalPages(data.pagination?.total_pages || 1)
      if (data.pagination?.status_counts) {
        setStatusCounts(data.pagination.status_counts)
      }
    } catch {
      toast.error("Erro ao carregar leads.")
    } finally {
      setLoading(false)
    }
  }, [accessToken, campanhaId, page, statusFilter, search])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [statusFilter, search])

  // Fetch with debounce for search
  useEffect(() => {
    const timer = setTimeout(fetchLeads, search ? 400 : 0)
    return () => clearTimeout(timer)
  }, [fetchLeads, search])

  // ── Reprocess a single lead ──────────────────────────────────────────────
  async function handleReprocess(leadId: string) {
    if (!accessToken) return
    setReprocessingId(leadId)
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/reprocessar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Lead reenfileirado com sucesso.")
        fetchLeads()
      } else {
        toast.error(data.message || "Erro ao reprocessar lead.")
      }
    } catch {
      toast.error("Erro ao reprocessar lead.")
    } finally {
      setReprocessingId(null)
    }
  }

  // ── Status breakdown bar ────────────────────────────────────────────────
  const statusKeys = ["sucesso", "falha", "sem_optin", "pendente", "processando", "aguardando"]
  const hasAnyCounts = statusKeys.some((k) => (statusCounts[k] ?? 0) > 0)

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold">
          Leads{total > 0 && <span className="text-[#3F3F58] normal-case ml-1">({total})</span>}
        </p>
        {total > 0 && (
          <Link
            href={`/admin/leads?campanha_id=${campanhaId}`}
            className="text-xs text-[#8B8B9E] hover:text-[#25D366] transition-colors"
          >
            Ver todos &rarr;
          </Link>
        )}
      </div>

      {/* Status breakdown pills */}
      {hasAnyCounts && (
        <div className="flex flex-wrap gap-2">
          {statusKeys.map((key) => {
            const count = statusCounts[key] ?? 0
            if (count === 0) return null
            return (
              <span
                key={key}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_PILL_STYLES[key] || ""}`}
              >
                {STATUS_LABELS[key] || key}: {count}
              </span>
            )
          })}
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[180px]">
          <Input
            placeholder="Buscar nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#F1F1F3] focus:outline-none focus:border-[#25D366] transition-colors"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin w-5 h-5 border-2 border-[#25D366] border-t-transparent rounded-full" />
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl flex flex-col items-center justify-center py-10 gap-3">
          <Users2 className="w-5 h-5 text-[#5A5A72]" />
          <p className="text-[#5A5A72] text-sm">
            {search || statusFilter !== "todos" ? "Nenhum lead encontrado com esses filtros" : "Nenhum lead nesta campanha"}
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E1E2A]">
                  <th className="text-left text-[10px] font-semibold text-[#5A5A72] uppercase tracking-wider px-4 py-2.5">Nome / Telefone</th>
                  <th className="text-left text-[10px] font-semibold text-[#5A5A72] uppercase tracking-wider px-4 py-2.5">Status</th>
                  <th className="text-left text-[10px] font-semibold text-[#5A5A72] uppercase tracking-wider px-4 py-2.5 hidden sm:table-cell">Flow / Conta</th>
                  <th className="text-left text-[10px] font-semibold text-[#5A5A72] uppercase tracking-wider px-4 py-2.5 hidden sm:table-cell">Tent.</th>
                  <th className="text-left text-[10px] font-semibold text-[#5A5A72] uppercase tracking-wider px-4 py-2.5 hidden md:table-cell">Grupo</th>
                  {canReprocess && <th className="px-4 py-2.5 w-10" />}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const style = leadStatusStyle(lead.status)
                  const isError = lead.status === "falha" || lead.status === "sem_optin"
                  return (
                    <tr
                      key={lead.id}
                      className="border-b border-[#1E1E2A] last:border-0 hover:bg-[#1C1C28] transition-colors"
                    >
                      {/* Nome + Telefone */}
                      <td className="px-4 py-3">
                        <Link href={`/admin/leads/${lead.id}`} className="group">
                          <p className="text-[#F1F1F3] text-sm font-medium group-hover:text-[#25D366] transition-colors truncate">
                            {lead.nome}
                          </p>
                          <p className="text-[#5A5A72] text-xs font-mono mt-0.5">{lead.telefone}</p>
                        </Link>
                        {/* Inline error for mobile */}
                        {isError && lead.erro_msg && (
                          <p className="text-[#F87171] text-[11px] mt-1 leading-snug truncate sm:hidden" title={lead.erro_msg}>
                            {lead.erro_msg}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase border ${style.badge}`}>
                          {lead.status === "sem_optin" ? "Sem opt-in" : lead.status}
                        </span>
                        {/* Error under status on desktop */}
                        {isError && lead.erro_msg && (
                          <p className="text-[#F87171] text-[11px] mt-1 leading-snug truncate max-w-[200px] hidden sm:block" title={lead.erro_msg}>
                            {lead.erro_msg}
                          </p>
                        )}
                      </td>

                      {/* Flow / Conta */}
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {lead.flow_executado && (
                          <p className="text-[#C4C4D4] text-xs font-mono truncate max-w-[160px]" title={lead.flow_executado}>
                            {lead.flow_executado}
                          </p>
                        )}
                        {lead.conta_nome && (
                          <p className="text-[#5A5A72] text-[11px] mt-0.5">{lead.conta_nome}</p>
                        )}
                        {!lead.flow_executado && !lead.conta_nome && (
                          <span className="text-[#5A5A72] text-xs">&mdash;</span>
                        )}
                      </td>

                      {/* Tentativas */}
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-[#8B8B9E] text-sm">{lead.tentativas}</span>
                      </td>

                      {/* Grupo entrou */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        {lead.grupo_entrou_at ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#25D366]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] shrink-0" />
                            {fmtDt(lead.grupo_entrou_at)}
                          </span>
                        ) : (
                          <span className="text-[#5A5A72] text-xs">&mdash;</span>
                        )}
                      </td>

                      {/* Reprocess button */}
                      {canReprocess && (
                        <td className="px-4 py-3">
                          {lead.status === "falha" && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleReprocess(lead.id)}
                              loading={reprocessingId === lead.id}
                              title="Reprocessar"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#1E1E2A]">
                <p className="text-[#5A5A72] text-xs">
                  P&aacute;gina {page} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Pr&oacute;xima
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
