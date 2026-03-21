"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Search, Users2, RefreshCw, ChevronDown, ChevronUp, ExternalLink, Download, Loader2, PlayCircle } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { hasPermission } from "@/lib/auth/rbac"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Header } from "@/components/layout/Header"
import { toast } from "sonner"

interface Lead {
  id: string
  nome: string
  telefone: string
  email: string | null
  status: "pendente" | "processando" | "sucesso" | "falha" | "sem_optin" | "aguardando"
  erro_msg: string | null
  tentativas: number
  grupo_entrou_at: string | null
  processado_at: string | null
  created_at: string
  webhook: { id: string; nome: string }
  campanha: { id: string; nome: string } | null
}

interface WebhookOption {
  id: string
  nome: string
}

interface CampanhaOption {
  id: string
  nome: string
}

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos os status" },
  { value: "aguardando", label: "Aguardando" },
  { value: "pendente", label: "Pendente" },
  { value: "processando", label: "Processando" },
  { value: "sucesso", label: "Sucesso" },
  { value: "falha", label: "Falha" },
  { value: "sem_optin", label: "Sem Opt-in" },
]

function statusBadge(status: string) {
  const variants: Record<string, { label: string; class: string }> = {
    aguardando: { label: "Aguardando", class: "bg-[#1A1500] text-[#F59E0B] border-[#F59E0B]/40" },
    pendente: { label: "Pendente", class: "bg-[#2A2A1E] text-[#F59E0B] border-[#F59E0B]/30" },
    processando: { label: "Processando", class: "bg-[#1E1E2A] text-[#60A5FA] border-[#60A5FA]/30" },
    sucesso: { label: "Sucesso", class: "bg-[#162516] text-[#25D366] border-[#25D366]/30" },
    falha: { label: "Falha", class: "bg-[#2A1616] text-[#F87171] border-[#F87171]/30" },
    sem_optin: { label: "Sem Opt-in", class: "bg-[#2A2010] text-[#F59E0B] border-[#F59E0B]/30" },
  }
  const v = variants[status] || variants.pendente
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${v.class}`}>
      {v.label}
    </span>
  )
}

export default function LeadsPage() {
  const { accessToken, user } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("todos")
  const [webhookFilter, setWebhookFilter] = useState("")
  const [campanhaFilter, setCampanhaFilter] = useState("")
  const [webhooks, setWebhooks] = useState<WebhookOption[]>([])
  const [campanhas, setCampanhas] = useState<CampanhaOption[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [bulkReprocessing, setBulkReprocessing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reprocessingSelected, setReprocessingSelected] = useState(false)

  const canReprocess = user ? hasPermission(user.role, "leads:reprocess") : false
  const canExport = user ? hasPermission(user.role, "dados:export") : false

  useEffect(() => {
    if (!accessToken) return
    fetch("/api/admin/webhooks?per_page=100", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => setWebhooks(data.webhooks || []))
      .catch(() => {})
    fetch("/api/admin/campanhas?per_page=100", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => setCampanhas(data.data || []))
      .catch(() => {})
  }, [accessToken])

  const fetchLeads = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "20",
        ...(search && { q: search }),
        ...(statusFilter && statusFilter !== "todos" && { status: statusFilter }),
        ...(webhookFilter && { webhook_id: webhookFilter }),
        ...(campanhaFilter && { campanha_id: campanhaFilter }),
      })
      const res = await fetch(`/api/admin/leads?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLeads(data.leads || [])
      setTotalPages(data.pagination?.total_pages || 1)
      setTotal(data.pagination?.total || 0)
      setSelected(new Set()) // clear selection on reload
    } catch {
      toast.error("Erro ao carregar leads.")
    } finally {
      setLoading(false)
    }
  }, [accessToken, page, search, statusFilter, webhookFilter, campanhaFilter])

  useEffect(() => { setPage(1) }, [search, statusFilter, webhookFilter, campanhaFilter])
  useEffect(() => {
    const timer = setTimeout(fetchLeads, search ? 400 : 0)
    return () => clearTimeout(timer)
  }, [fetchLeads, search])

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === leads.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(leads.map((l) => l.id)))
    }
  }

  async function handleReprocessSelected() {
    if (selected.size === 0) return
    setReprocessingSelected(true)
    try {
      const res = await fetch("/api/admin/leads/reprocessar-selecionados", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selected) }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || `${selected.size} lead(s) reenfileirado(s).`)
        fetchLeads()
      } else {
        toast.error(data.message || "Erro ao reprocessar leads.")
      }
    } catch {
      toast.error("Erro ao reprocessar leads.")
    } finally {
      setReprocessingSelected(false)
    }
  }

  async function handleBulkReprocess() {
    if (!window.confirm(`Reprocessar todos os leads com falha${webhookFilter ? " deste webhook" : ""}?`)) return
    setBulkReprocessing(true)
    try {
      const params = new URLSearchParams()
      if (webhookFilter) params.set("webhook_id", webhookFilter)
      const res = await fetch(`/api/admin/leads/reprocessar-falhas?${params}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Leads reenfileirados com sucesso.")
        fetchLeads()
      } else {
        toast.error(data.message || "Erro ao reprocessar leads.")
      }
    } catch {
      toast.error("Erro ao reprocessar leads.")
    } finally {
      setBulkReprocessing(false)
    }
  }

  async function handleExportCsv() {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("q", search)
      if (statusFilter && statusFilter !== "todos") params.set("status", statusFilter)
      if (webhookFilter) params.set("webhook_id", webhookFilter)
      const res = await fetch(`/api/admin/leads/export?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) { toast.error("Erro ao exportar leads."); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("CSV exportado com sucesso.")
    } catch {
      toast.error("Erro ao exportar leads.")
    } finally {
      setExporting(false)
    }
  }

  function formatDate(str: string | null) {
    if (!str) return "—"
    return new Date(str).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    })
  }

  const allSelected = leads.length > 0 && selected.size === leads.length
  const someSelected = selected.size > 0

  return (
    <div className="flex flex-col h-full">
      <Header breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Leads" }]} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[#F1F1F3] text-2xl font-bold">Leads</h1>
            <p className="text-[#8B8B9E] text-sm mt-1">
              {total > 0 ? `${total} lead${total !== 1 ? "s" : ""} no total` : "Acompanhe o pipeline de processamento"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canReprocess && (
              <Button
                variant="outline"
                className="h-9 text-sm text-[#F87171] border-[#F87171]/30 hover:bg-[#2A1616] hover:text-[#F87171]"
                onClick={handleBulkReprocess}
                disabled={bulkReprocessing}
              >
                {bulkReprocessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Reprocessar Falhas
              </Button>
            )}
            {canExport && (
              <Button variant="outline" className="h-9 text-sm" onClick={handleExportCsv} disabled={exporting}>
                {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Exportar CSV
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Buscar por nome ou telefone..."
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
          {campanhas.length > 0 && (
            <select
              value={campanhaFilter}
              onChange={(e) => setCampanhaFilter(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#F1F1F3] focus:outline-none focus:border-[#25D366] transition-colors"
            >
              <option value="">Todas as campanhas</option>
              {campanhas.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          )}
          {webhooks.length > 0 && (
            <select
              value={webhookFilter}
              onChange={(e) => setWebhookFilter(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#F1F1F3] focus:outline-none focus:border-[#25D366] transition-colors"
            >
              <option value="">Todos os webhooks</option>
              {webhooks.map((w) => (
                <option key={w.id} value={w.id}>{w.nome}</option>
              ))}
            </select>
          )}
        </div>

        {/* Selection action bar */}
        {someSelected && canReprocess && (
          <div className="mb-3 flex items-center gap-3 bg-[#1C1C28] border border-[#25D366]/30 rounded-xl px-4 py-2.5">
            <span className="text-[#25D366] text-sm font-medium">{selected.size} selecionado{selected.size !== 1 ? "s" : ""}</span>
            <Button
              size="sm"
              onClick={handleReprocessSelected}
              loading={reprocessingSelected}
              className="h-8"
            >
              <PlayCircle className="w-3.5 h-3.5 mr-1.5" />
              Executar Novamente
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              className="ml-auto text-xs text-[#5A5A72] hover:text-[#F1F1F3] transition-colors"
            >
              Limpar seleção
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#1E1E2A] flex items-center justify-center">
                <Users2 className="w-8 h-8 text-[#25D366]" />
              </div>
              <div className="text-center">
                <p className="text-[#F1F1F3] font-semibold text-lg">
                  {search || statusFilter !== "todos" || webhookFilter || campanhaFilter ? "Nenhum lead encontrado" : "Nenhum lead ainda"}
                </p>
                <p className="text-[#8B8B9E] text-sm mt-1">
                  {search || statusFilter !== "todos" || webhookFilter || campanhaFilter
                    ? "Tente ajustar os filtros"
                    : "Leads aparecerão aqui após os primeiros webhooks serem recebidos"}
                </p>
              </div>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1E1E2A]">
                    {canReprocess && (
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-[#3A3A52] bg-[#111118] accent-[#25D366] cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Nome / Contato</th>
                    <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Campanha / Webhook</th>
                    <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Tentativas</th>
                    <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Grupo WA</th>
                    <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Recebido</th>
                    <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Processado</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <React.Fragment key={lead.id}>
                      <tr className={`border-b border-[#1E1E2A] last:border-0 hover:bg-[#1C1C28] transition-colors ${selected.has(lead.id) ? "bg-[#1C1C28]" : ""}`}>
                        {canReprocess && (
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selected.has(lead.id)}
                              onChange={() => toggleSelect(lead.id)}
                              className="w-4 h-4 rounded border-[#3A3A52] bg-[#111118] accent-[#25D366] cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-5 py-3">
                          <Link href={`/admin/leads/${lead.id}`} className="group">
                            <p className="text-[#F1F1F3] text-sm font-medium group-hover:text-[#25D366] transition-colors">{lead.nome}</p>
                            <p className="text-[#5A5A72] text-xs mt-0.5">{lead.telefone}</p>
                            {lead.email && <p className="text-[#5A5A72] text-xs">{lead.email}</p>}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          {lead.campanha && (
                            <p className="text-[#C4C4D4] text-sm">{lead.campanha.nome}</p>
                          )}
                          <p className="text-[#5A5A72] text-xs mt-0.5">{lead.webhook.nome}</p>
                        </td>
                        <td className="px-5 py-3">{statusBadge(lead.status)}</td>
                        <td className="px-5 py-3">
                          <span className="text-[#8B8B9E] text-sm">{lead.tentativas}</span>
                        </td>
                        <td className="px-5 py-3">
                          {lead.grupo_entrou_at ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#25D366]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] shrink-0" />
                              {formatDate(lead.grupo_entrou_at)}
                            </span>
                          ) : (
                            <span className="text-[#5A5A72] text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[#8B8B9E] text-sm">{formatDate(lead.created_at)}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[#8B8B9E] text-sm">{formatDate(lead.processado_at)}</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Link
                              href={`/admin/leads/${lead.id}`}
                              className="inline-flex items-center justify-center h-8 px-2 rounded-md text-[#5A5A72] hover:text-[#F1F1F3] hover:bg-[#1E1E2A] transition-colors"
                              title="Ver detalhe"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                            {lead.status === "falha" && lead.erro_msg && (
                              <Button
                                variant="ghost"
                                className="h-8 px-2"
                                onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                                title={expandedId === lead.id ? "Ocultar erro" : "Ver erro"}
                              >
                                {expandedId === lead.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedId === lead.id && lead.erro_msg && (
                        <tr className="border-b border-[#1E1E2A] bg-[#1C1C28]">
                          <td colSpan={canReprocess ? 9 : 8} className="px-5 py-3">
                            <div className="bg-[#2A1616] border border-[#F87171]/20 rounded-lg px-4 py-3">
                              <p className="text-xs font-semibold text-[#F87171] mb-1">Erro</p>
                              <p className="text-xs text-[#F1A1A1] font-mono break-all">{lead.erro_msg}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-[#1E1E2A]">
                  <p className="text-[#5A5A72] text-sm">Página {page} de {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="h-8 px-3 text-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                      Anterior
                    </Button>
                    <Button variant="outline" className="h-8 px-3 text-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
