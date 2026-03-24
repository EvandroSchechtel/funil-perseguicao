"use client"

import React, { useEffect, useState, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Pencil, Copy, CheckCircle2, Plus, Trash2, ToggleLeft, ToggleRight,
  GripVertical, Info, RefreshCw, AlertTriangle, Tag, Clock, XCircle,
  Loader2, RotateCcw, ChevronLeft, ChevronRight, Users2,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { hasPermission, type Role } from "@/lib/auth/rbac"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AddFlowDialog } from "@/components/admin/AddFlowDialog"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Flow {
  id: string
  tipo: string
  flow_ns: string | null
  flow_nome: string | null
  webhook_url: string | null
  ordem: number
  total_enviados: number
  status: "ativo" | "inativo"
  tag_manychat_id: number | null
  tag_manychat_nome: string | null
  conta: { id: string; nome: string; page_name: string | null } | null
}

interface WebhookData {
  id: string
  nome: string
  token: string
  status: "ativo" | "inativo"
  url_publica: string
  leads_count: number
  created_at: string
  campanha: { id: string; nome: string; cliente: { id: string; nome: string } | null } | null
  webhook_flows: Flow[]
}

interface QueueJob {
  id: string | undefined
  state: string
  leadId: string
  nome: string
  telefone: string
  flowNs: string
  attemptsMade: number
  failedReason: string | null
  timestamp: number
  processedOn: number | null
  delay: number
}

interface QueueLead {
  id: string
  nome: string
  telefone: string
  email: string | null
  subscriber_id: string | null
  flow_executado: string | null
  conta_nome: string | null
  status: string
  erro_msg: string | null
  tentativas: number
  grupo_entrou_at: string | null
  processado_at: string | null
  created_at: string
  webhook_flow: { flow_nome: string | null; flow_ns: string | null; conta: { nome: string } | null } | null
}

interface QueueData {
  counts: { waiting: number; active: number; failed: number; delayed: number; completed: number }
  jobs: QueueJob[]
  leads: QueueLead[]
  redisOnline: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(s: string | null) {
  if (!s) return "—"
  return new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function formatRelative(ts: number | null) {
  if (!ts) return "—"
  const diffMs = Date.now() - ts
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "agora"
  if (mins < 60) return `${mins}min atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  return `${Math.floor(hrs / 24)}d atrás`
}

function formatDelay(delayMs: number, timestamp: number) {
  const executeAt = timestamp + delayMs
  const remaining = executeAt - Date.now()
  if (remaining <= 0) return "em breve"
  const mins = Math.ceil(remaining / 60000)
  if (mins < 60) return `em ${mins}min`
  return `em ${Math.ceil(mins / 60)}h`
}

function truncate(s: string | null, len = 30) {
  if (!s) return "—"
  return s.length > len ? s.slice(0, len) + "…" : s
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pendente:    { label: "Pendente",    className: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" },
  processando: { label: "Processando", className: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
  sucesso:     { label: "Sucesso",     className: "bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20" },
  falha:       { label: "Falha",       className: "bg-red-500/10 text-[#F87171] border border-red-500/20" },
  sem_optin:   { label: "Sem opt-in",  className: "bg-orange-500/10 text-orange-400 border border-orange-500/20" },
  aguardando:  { label: "Aguardando",  className: "bg-[#3F3F58]/40 text-[#8B8B9E] border border-[#3F3F58]/40" },
}

const JOB_STATE_BADGE: Record<string, string> = {
  waiting: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  active:  "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  failed:  "bg-red-500/10 text-[#F87171] border border-red-500/20",
  delayed: "bg-orange-500/10 text-orange-400 border border-orange-500/20",
}

const LEADS_PER_PAGE = 20

// ── Component ─────────────────────────────────────────────────────────────────

export default function WebhookDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, accessToken } = useAuth()

  const canWrite = user ? hasPermission(user.role as Role, "webhooks:write") : false
  const canReprocess = user ? hasPermission(user.role as Role, "leads:reprocess") : false

  const [webhook, setWebhook] = useState<WebhookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [queueData, setQueueData] = useState<QueueData | null>(null)
  const [queueLoading, setQueueLoading] = useState(true)

  const [showAddFlow, setShowAddFlow] = useState(false)
  const [deleteFlowDialog, setDeleteFlowDialog] = useState<Flow | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [reprocessLoading, setReprocessLoading] = useState<string | null>(null)

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"waiting" | "active" | "failed" | "delayed">("waiting")
  const [leadsPage, setLeadsPage] = useState(1)

  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // ── Fetch webhook ──────────────────────────────────────────────────────────

  const fetchWebhook = useCallback(async () => {
    if (!accessToken || !id) return
    try {
      const res = await fetch(`/api/admin/webhooks/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error("Webhook não encontrado")
      const data = await res.json()
      setWebhook(data.webhook)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [accessToken, id])

  // ── Fetch queue + leads ────────────────────────────────────────────────────

  const fetchQueue = useCallback(async () => {
    if (!accessToken || !id) return
    setQueueLoading(true)
    try {
      const res = await fetch(`/api/admin/webhooks/${id}/queue`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setQueueData(data)
      }
    } catch { /* silent */ } finally {
      setQueueLoading(false)
    }
  }, [accessToken, id])

  useEffect(() => {
    fetchWebhook()
    fetchQueue()
  }, [fetchWebhook, fetchQueue])

  // Auto-refresh queue every 15s while jobs are active/waiting
  useEffect(() => {
    if (!queueData) return
    const hasActive = (queueData.counts.waiting + queueData.counts.active) > 0
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    if (hasActive) {
      refreshIntervalRef.current = setInterval(fetchQueue, 15000)
    }
    return () => { if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current) }
  }, [queueData, fetchQueue])

  // ── Copy ──────────────────────────────────────────────────────────────────

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(key)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  // ── Flow actions ──────────────────────────────────────────────────────────

  async function handleToggleFlow(flow: Flow) {
    setActionLoading(flow.id + "-toggle")
    try {
      const res = await fetch(`/api/admin/webhooks/${id}/flows/${flow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ status: flow.status === "ativo" ? "inativo" : "ativo" }),
      })
      if (res.ok) { toast.success("Status do flow alterado."); fetchWebhook() }
    } catch { /* silent */ } finally { setActionLoading(null) }
  }

  async function handleDeleteFlow() {
    if (!deleteFlowDialog) return
    setActionLoading(deleteFlowDialog.id + "-delete")
    try {
      const res = await fetch(`/api/admin/webhooks/${id}/flows/${deleteFlowDialog.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        toast.success("Flow removido.")
        setDeleteFlowDialog(null)
        fetchWebhook()
      }
    } catch { /* silent */ } finally { setActionLoading(null) }
  }

  // ── Reprocess lead ────────────────────────────────────────────────────────

  async function handleReprocess(leadId: string) {
    setReprocessLoading(leadId)
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/reprocessar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Lead reenfileirado.")
        fetchQueue()
      } else {
        toast.error(data.message || "Erro ao reprocessar.")
      }
    } catch { toast.error("Erro de rede.") } finally { setReprocessLoading(null) }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const clienteId = webhook?.campanha?.cliente?.id ?? null
  const flows = webhook?.webhook_flows ?? []

  const jobsByState = {
    waiting: (queueData?.jobs ?? []).filter((j) => j.state === "waiting"),
    active:  (queueData?.jobs ?? []).filter((j) => j.state === "active"),
    failed:  (queueData?.jobs ?? []).filter((j) => j.state === "failed"),
    delayed: (queueData?.jobs ?? []).filter((j) => j.state === "delayed"),
  }

  const leads = queueData?.leads ?? []
  const totalLeadsPages = Math.ceil(leads.length / LEADS_PER_PAGE)
  const pagedLeads = leads.slice((leadsPage - 1) * LEADS_PER_PAGE, leadsPage * LEADS_PER_PAGE)

  // ── Loading / Error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header breadcrumbs={[{ label: "Webhooks", href: "/admin/webhooks" }, { label: "..." }]} />
        <div className="flex items-center justify-center flex-1">
          <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  if (error || !webhook) {
    return (
      <div className="flex flex-col h-full">
        <Header breadcrumbs={[{ label: "Webhooks", href: "/admin/webhooks" }, { label: "Erro" }]} />
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <p className="text-[#F87171]">{error || "Webhook não encontrado"}</p>
          <Link href="/admin/webhooks"><Button variant="outline">Voltar</Button></Link>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Webhooks", href: "/admin/webhooks" },
          { label: webhook.nome },
        ]}
        actions={
          canWrite ? (
            <Link href={`/admin/webhooks/${id}/editar`}>
              <Button variant="outline" size="sm">
                <Pencil className="w-4 h-4 mr-1.5" />Editar
              </Button>
            </Link>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">

          {/* ── Seção 1: Info ──────────────────────────────────────────────── */}
          <section className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[#F1F1F3] font-semibold">{webhook.nome}</h2>
              <Badge variant={webhook.status === "ativo" ? "ativo" : "inativo"}>
                {webhook.status === "ativo" ? "Ativo" : "Inativo"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm">
              {webhook.campanha && (
                <div className="flex items-start gap-2">
                  <span className="text-[#5A5A72] w-24 shrink-0">Campanha</span>
                  <Link href={`/admin/campanhas/${webhook.campanha.id}`} className="text-[#25D366] hover:underline">
                    {webhook.campanha.nome}
                    {webhook.campanha.cliente && <span className="text-[#5A5A72] ml-1">({webhook.campanha.cliente.nome})</span>}
                  </Link>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-[#5A5A72] w-24 shrink-0">URL pública</span>
                <span className="text-[#C4C4D4] font-mono text-xs truncate flex-1">{webhook.url_publica}</span>
                <button onClick={() => handleCopy(webhook.url_publica, "url")} className="p-1 text-[#5A5A72] hover:text-[#25D366] shrink-0">
                  {copiedId === "url" ? <CheckCircle2 className="w-4 h-4 text-[#25D366]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[#5A5A72] w-24 shrink-0">Token</span>
                <span className="text-[#C4C4D4] font-mono text-xs">{webhook.token.slice(0, 8)}…{webhook.token.slice(-4)}</span>
                <button onClick={() => handleCopy(webhook.token, "token")} className="p-1 text-[#5A5A72] hover:text-[#25D366] shrink-0">
                  {copiedId === "token" ? <CheckCircle2 className="w-4 h-4 text-[#25D366]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[#5A5A72] w-24 shrink-0">Criado em</span>
                <span className="text-[#C4C4D4]">{formatDate(webhook.created_at)}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[#5A5A72] w-24 shrink-0">Total leads</span>
                <span className="text-[#C4C4D4]">{webhook.leads_count}</span>
              </div>
            </div>
          </section>

          {/* ── Seção 2: Flows ──────────────────────────────────────────────── */}
          <section className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#1E1E2A]">
              <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold">Flows</p>
              {canWrite && (
                <Button size="sm" onClick={() => setShowAddFlow(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" />Adicionar Flow
                </Button>
              )}
            </div>

            {flows.length === 0 ? (
              <div className="flex items-center gap-2 px-5 py-6">
                <Info className="w-4 h-4 text-[#5A5A72] shrink-0" />
                <p className="text-[#5A5A72] text-sm">Nenhum flow configurado.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1E1E2A]">
                {flows.map((flow) => (
                  <div key={flow.id} className="flex items-center gap-3 px-5 py-3">
                    <GripVertical className="w-4 h-4 text-[#2A2A3A] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[#C4C4D4] text-sm font-medium">{flow.conta?.nome ?? "Webhook externo"}</p>
                      <p className="text-[#5A5A72] text-xs font-mono">
                        {flow.tipo === "webhook"
                          ? (flow.webhook_url ? truncate(flow.webhook_url, 50) : "—")
                          : (flow.flow_nome || truncate(flow.flow_ns ?? "", 50))}
                      </p>
                      {flow.tag_manychat_nome && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-[#A78BFA] mt-0.5">
                          <Tag className="w-2.5 h-2.5" />{flow.tag_manychat_nome}
                        </span>
                      )}
                    </div>
                    <Badge variant={flow.status === "ativo" ? "ativo" : "inativo"}>{flow.status === "ativo" ? "Ativo" : "Inativo"}</Badge>
                    <span className="text-[#8B8B9E] text-xs shrink-0">{flow.total_enviados} na fila</span>
                    {canWrite && (
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => handleToggleFlow(flow)} disabled={actionLoading === flow.id + "-toggle"} className="p-1.5 text-[#5A5A72] hover:text-[#25D366] disabled:opacity-50">
                          {flow.status === "ativo" ? <ToggleRight className="w-4 h-4 text-[#25D366]" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setDeleteFlowDialog(flow)} className="p-1.5 text-[#5A5A72] hover:text-[#F87171]">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Seção 3: Fila BullMQ ──────────────────────────────────────── */}
          <section className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#1E1E2A]">
              <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold">Fila de Processamento</p>
              <button onClick={() => fetchQueue()} disabled={queueLoading} className="p-1.5 text-[#5A5A72] hover:text-[#25D366] disabled:opacity-50" title="Atualizar">
                <RefreshCw className={`w-4 h-4 ${queueLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {!queueData?.redisOnline && !queueLoading && (
              <div className="flex items-center gap-2 px-5 py-3 bg-yellow-500/5 border-b border-yellow-500/10">
                <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                <p className="text-yellow-400 text-xs">Worker/Redis indisponível — fila não acessível. Leads do banco exibidos abaixo.</p>
              </div>
            )}

            {/* Counts */}
            {queueData && (
              <div className="px-5 py-3 border-b border-[#1E1E2A]">
                <div className="flex flex-wrap gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    Aguardando: {queueData.counts.waiting}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Ativos: {queueData.counts.active}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-[#F87171] border border-red-500/20">
                    Falha: {queueData.counts.failed}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                    Agendados: {queueData.counts.delayed}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20">
                    Concluídos: {queueData.counts.completed}
                  </span>
                </div>
                {(queueData.counts.waiting + queueData.counts.active) > 0 && (
                  <p className="text-[10px] text-[#5A5A72]">Atualiza automaticamente a cada 15s</p>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-[#1E1E2A]">
              {(["waiting", "active", "failed", "delayed"] as const).map((tab) => {
                const labels = { waiting: "Aguardando", active: "Ativos", failed: "Falha", delayed: "Agendados" }
                const count = queueData?.counts[tab] ?? 0
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
                      activeTab === tab
                        ? "border-[#25D366] text-[#25D366]"
                        : "border-transparent text-[#5A5A72] hover:text-[#C4C4D4]"
                    }`}
                  >
                    {labels[tab]} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
                  </button>
                )
              })}
            </div>

            {/* Job list */}
            <div className="divide-y divide-[#1E1E2A]">
              {queueLoading && jobsByState[activeTab].length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-[#5A5A72] animate-spin" />
                </div>
              ) : jobsByState[activeTab].length === 0 ? (
                <div className="flex items-center justify-center py-8 gap-2 text-[#5A5A72]">
                  <Info className="w-4 h-4" />
                  <span className="text-sm">Nenhum job neste estado</span>
                </div>
              ) : (
                jobsByState[activeTab].map((job, i) => (
                  <div key={job.id ?? i} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${JOB_STATE_BADGE[job.state]}`}>
                            {job.state === "waiting" ? "aguardando" : job.state === "active" ? "ativo" : job.state === "failed" ? "falha" : "agendado"}
                          </span>
                          <span className="text-[#C4C4D4] text-sm font-medium">{job.nome}</span>
                          <span className="text-[#5A5A72] text-xs">{job.telefone}</span>
                        </div>
                        <p className="text-[#5A5A72] text-xs font-mono">{truncate(job.flowNs, 60)}</p>
                        {job.state === "failed" && job.failedReason && (
                          <p className="text-[#F87171] text-xs mt-1 break-all">{job.failedReason}</p>
                        )}
                        {job.state === "delayed" && (
                          <p className="text-orange-400 text-xs mt-0.5">
                            <Clock className="w-3 h-3 inline mr-0.5" />
                            {formatDelay(job.delay, job.timestamp)}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-[#5A5A72]">Tentativas: {job.attemptsMade}</span>
                          <span className="text-[10px] text-[#5A5A72]">{formatRelative(job.timestamp)}</span>
                        </div>
                      </div>
                      {job.state === "failed" && canReprocess && (
                        <button
                          onClick={() => handleReprocess(job.leadId)}
                          disabled={reprocessLoading === job.leadId}
                          className="flex items-center gap-1 text-xs text-[#5A5A72] hover:text-[#25D366] disabled:opacity-50 transition-colors shrink-0 mt-0.5"
                        >
                          {reprocessLoading === job.leadId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          Reprocessar
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* ── Seção 4: Leads ────────────────────────────────────────────── */}
          <section className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#1E1E2A]">
              <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold">
                Leads{leads.length > 0 && <span className="text-[#3F3F58] normal-case ml-1">({leads.length}{leads.length === 100 ? "+" : ""})</span>}
              </p>
              <Users2 className="w-4 h-4 text-[#3F3F58]" />
            </div>

            {queueLoading && leads.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-[#5A5A72] animate-spin" />
              </div>
            ) : leads.length === 0 ? (
              <div className="flex items-center justify-center py-8 gap-2 text-[#5A5A72]">
                <Info className="w-4 h-4" />
                <span className="text-sm">Nenhum lead neste webhook</span>
              </div>
            ) : (
              <>
                <div className="divide-y divide-[#1E1E2A]">
                  {pagedLeads.map((lead) => {
                    const badge = STATUS_BADGE[lead.status] ?? STATUS_BADGE.pendente
                    const canReproc = canReprocess && (lead.status === "falha" || lead.status === "sem_optin")
                    return (
                      <div key={lead.id} className="px-5 py-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <Link href={`/admin/leads/${lead.id}`} className="text-[#C4C4D4] text-sm font-medium hover:text-[#25D366] transition-colors">{lead.nome}</Link>
                              <span className="text-[#5A5A72] text-xs">{lead.telefone}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badge.className}`}>{badge.label}</span>
                            </div>

                            {/* Flow / Conta */}
                            {lead.webhook_flow && (
                              <p className="text-[#5A5A72] text-xs">
                                {lead.webhook_flow.conta?.nome ?? "Webhook externo"}
                                {lead.webhook_flow.flow_nome && <span className="text-[#3F3F58]"> · {lead.webhook_flow.flow_nome}</span>}
                              </p>
                            )}

                            {/* Error */}
                            {lead.erro_msg && (
                              <p className="text-[#F87171] text-xs mt-0.5 break-all">{lead.erro_msg}</p>
                            )}

                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="text-[10px] text-[#5A5A72]">Tentativas: {lead.tentativas}</span>
                              {lead.subscriber_id && (
                                <span className="text-[10px] text-[#5A5A72] font-mono" title={lead.subscriber_id}>
                                  MC: {lead.subscriber_id.slice(0, 10)}…
                                </span>
                              )}
                              {lead.grupo_entrou_at && (
                                <span className="text-[10px] text-[#25D366]">✓ Entrou no grupo</span>
                              )}
                              <span className="text-[10px] text-[#3F3F58]">Recebido: {formatDate(lead.created_at)}</span>
                              {lead.processado_at && (
                                <span className="text-[10px] text-[#3F3F58]">Processado: {formatDate(lead.processado_at)}</span>
                              )}
                            </div>
                          </div>

                          {canReproc && (
                            <button
                              onClick={() => handleReprocess(lead.id)}
                              disabled={reprocessLoading === lead.id}
                              className="flex items-center gap-1 text-xs text-[#5A5A72] hover:text-[#25D366] disabled:opacity-50 transition-colors shrink-0 mt-0.5"
                            >
                              {reprocessLoading === lead.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                              Reprocessar
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Pagination */}
                {totalLeadsPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-[#1E1E2A]">
                    <span className="text-xs text-[#5A5A72]">
                      Pág. {leadsPage} de {totalLeadsPages}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setLeadsPage((p) => Math.max(1, p - 1))}
                        disabled={leadsPage === 1}
                        className="p-1.5 text-[#5A5A72] hover:text-[#C4C4D4] disabled:opacity-30"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setLeadsPage((p) => Math.min(totalLeadsPages, p + 1))}
                        disabled={leadsPage === totalLeadsPages}
                        className="p-1.5 text-[#5A5A72] hover:text-[#C4C4D4] disabled:opacity-30"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

        </div>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}

      <AddFlowDialog
        open={showAddFlow}
        webhookId={id}
        clienteId={clienteId}
        accessToken={accessToken}
        onClose={() => setShowAddFlow(false)}
        onSuccess={() => { setShowAddFlow(false); fetchWebhook() }}
      />

      <Dialog open={!!deleteFlowDialog} onOpenChange={() => setDeleteFlowDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Flow</DialogTitle>
          </DialogHeader>
          <p className="text-[#C4C4D4] text-sm">
            Tem certeza que deseja remover o flow <strong>{deleteFlowDialog?.flow_nome || deleteFlowDialog?.webhook_url || deleteFlowDialog?.flow_ns || "—"}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFlowDialog(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteFlow}
              loading={actionLoading === deleteFlowDialog?.id + "-delete"}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
