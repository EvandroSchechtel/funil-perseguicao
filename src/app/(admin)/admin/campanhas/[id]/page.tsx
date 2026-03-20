"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  Pencil, Webhook, Users2, Copy, CheckCircle2, XCircle, Loader2,
  Plus, Trash2, ToggleLeft, ToggleRight, Info, GripVertical, FlaskConical,
  Building2, Calendar, ChevronDown, ChevronRight, PauseCircle, PlayCircle,
  ListOrdered, ChevronsRight,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { hasPermission } from "@/lib/auth/rbac"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

interface CampanhaData {
  id: string
  nome: string
  descricao: string | null
  status: "ativo" | "inativo"
  pausado_at: string | null
  data_inicio: string | null
  data_fim: string | null
  created_at: string
  updated_at: string
  webhooks_count: number
  leads_count: number
  aguardando_count: number
  usuario: { nome: string }
  cliente: { id: string; nome: string } | null
}

interface Flow {
  id: string
  flow_ns: string
  flow_nome: string | null
  ordem: number
  total_enviados: number
  status: "ativo" | "inativo"
  conta: { id: string; nome: string; page_name: string | null }
}

interface WebhookItem {
  id: string
  nome: string
  token: string
  status: "ativo" | "inativo"
  url_publica: string
  leads_count: number
  webhook_flows: Flow[]
}

interface Conta {
  id: string
  nome: string
  page_name: string | null
  status: "ativo" | "inativo"
}

interface LeadItem {
  id: string
  nome: string
  telefone: string
  status: string
  created_at: string
  webhook: { nome: string } | null
}

type Tab = "visao-geral" | "webhooks" | "leads"
type TesteResultado = { ok: true; lead_id: string } | { ok: false; message: string } | null

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(str: string | null) {
  if (!str) return "—"
  return new Date(str).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function statusColor(s: string) {
  if (s === "ok" || s === "enviado") return "text-[#25D366]"
  if (s === "falha" || s === "erro") return "text-[#F87171]"
  return "text-[#F59E0B]"
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CampanhaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken, user } = useAuth()
  const router = useRouter()

  const [tab, setTab] = useState<Tab>("visao-geral")
  const [campanha, setCampanha] = useState<CampanhaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Webhooks tab
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([])
  const [loadingWebhooks, setLoadingWebhooks] = useState(false)
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Add flow dialog
  const [showAddFlow, setShowAddFlow] = useState<string | null>(null) // webhookId
  const [contas, setContas] = useState<Conta[]>([])
  const [flowContaId, setFlowContaId] = useState("")
  const [flowNs, setFlowNs] = useState("")
  const [flowNome, setFlowNome] = useState("")
  const [flowErrors, setFlowErrors] = useState<Record<string, string>>({})
  const [addFlowLoading, setAddFlowLoading] = useState(false)

  // Test webhook dialog
  const [testeWebhook, setTesteWebhook] = useState<WebhookItem | null>(null)
  const [testeNome, setTesteNome] = useState("")
  const [testeTelefone, setTesteTelefone] = useState("")
  const [testeLoading, setTesteLoading] = useState(false)
  const [testeErrors, setTesteErrors] = useState<Record<string, string>>({})
  const [testeResultado, setTesteResultado] = useState<TesteResultado>(null)

  // Delete flow
  const [deleteFlow, setDeleteFlow] = useState<{ flow: Flow; webhookId: string } | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Leads tab
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [leadsTotal, setLeadsTotal] = useState(0)

  // Pause actions
  const [pauseLoading, setPauseLoading] = useState<string | null>(null)

  const canWrite = user ? hasPermission(user.role, "webhooks:write") : false

  // ── Fetch campanha ──────────────────────────────────────────────────────────

  const fetchCampanha = useCallback(async () => {
    if (!accessToken || !id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/campanhas/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error("Campanha não encontrada")
      const data = await res.json()
      setCampanha(data.data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar campanha")
    } finally {
      setLoading(false)
    }
  }, [accessToken, id])

  useEffect(() => { fetchCampanha() }, [fetchCampanha])

  // ── Fetch webhooks (lazy, on tab switch) ────────────────────────────────────

  const fetchWebhooks = useCallback(async () => {
    if (!accessToken || !id) return
    setLoadingWebhooks(true)
    try {
      const res = await fetch(`/api/admin/webhooks?campanha_id=${id}&per_page=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return
      const data = await res.json()
      // Fetch full data for each webhook (flows)
      const full = await Promise.all(
        (data.webhooks || []).map(async (w: { id: string }) => {
          const r = await fetch(`/api/admin/webhooks/${w.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          if (!r.ok) return w
          const d = await r.json()
          return d.webhook
        })
      )
      setWebhooks(full)
    } catch {
      toast.error("Erro ao carregar webhooks.")
    } finally {
      setLoadingWebhooks(false)
    }
  }, [accessToken, id])

  // ── Fetch leads (lazy) ──────────────────────────────────────────────────────

  const fetchLeads = useCallback(async () => {
    if (!accessToken || !id) return
    setLoadingLeads(true)
    try {
      const res = await fetch(`/api/admin/leads?campanha_id=${id}&per_page=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setLeads(data.data || [])
      setLeadsTotal(data.pagination?.total || 0)
    } catch {
      toast.error("Erro ao carregar leads.")
    } finally {
      setLoadingLeads(false)
    }
  }, [accessToken, id])

  useEffect(() => {
    if (tab === "webhooks" && webhooks.length === 0) fetchWebhooks()
    if (tab === "leads") fetchLeads()
  }, [tab])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch contas (for add flow) ─────────────────────────────────────────────

  const fetchContas = useCallback(async () => {
    if (!accessToken || contas.length > 0) return
    try {
      const res = await fetch("/api/admin/contas?per_page=100&status=ativo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setContas(data.contas || [])
    } catch { /* silent */ }
  }, [accessToken, contas.length])

  // ── Copy URL ────────────────────────────────────────────────────────────────

  async function handleCopy(url: string, wid: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(wid)
      setTimeout(() => setCopiedId(null), 2000)
      toast.success("URL copiada!")
    } catch {
      toast.error("Erro ao copiar.")
    }
  }

  // ── Toggle webhook ──────────────────────────────────────────────────────────

  async function handleToggleWebhook(w: WebhookItem) {
    setActionLoading(w.id + "-toggle")
    try {
      const res = await fetch(`/api/admin/webhooks/${w.id}/toggle`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        toast.success("Status alterado.")
        fetchWebhooks()
      }
    } catch { /* silent */ } finally {
      setActionLoading(null)
    }
  }

  // ── Add flow ────────────────────────────────────────────────────────────────

  function handleOpenAddFlow(webhookId: string) {
    setShowAddFlow(webhookId)
    setFlowContaId("")
    setFlowNs("")
    setFlowNome("")
    setFlowErrors({})
    fetchContas()
  }

  async function handleAddFlow() {
    const errs: Record<string, string> = {}
    if (!flowContaId) errs.conta_id = "Selecione uma conta"
    if (!flowNs.trim()) errs.flow_ns = "Flow NS é obrigatório"
    if (Object.keys(errs).length > 0) { setFlowErrors(errs); return }

    setAddFlowLoading(true)
    try {
      const res = await fetch(`/api/admin/webhooks/${showAddFlow}/flows`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ conta_id: flowContaId, flow_ns: flowNs.trim(), flow_nome: flowNome.trim() || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        setShowAddFlow(null)
        fetchWebhooks()
      } else {
        toast.error(data.message || "Erro ao adicionar flow.")
      }
    } catch { toast.error("Erro de conexão.") } finally { setAddFlowLoading(false) }
  }

  // ── Toggle flow ─────────────────────────────────────────────────────────────

  async function handleToggleFlow(flow: Flow, webhookId: string) {
    setActionLoading(flow.id + "-toggle")
    try {
      const res = await fetch(`/api/admin/webhooks/${webhookId}/flows/${flow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ status: flow.status === "ativo" ? "inativo" : "ativo" }),
      })
      if (res.ok) { toast.success("Status do flow alterado."); fetchWebhooks() }
    } catch { /* silent */ } finally { setActionLoading(null) }
  }

  // ── Delete flow ─────────────────────────────────────────────────────────────

  async function handleDeleteFlow() {
    if (!deleteFlow) return
    setActionLoading(deleteFlow.flow.id + "-delete")
    try {
      const res = await fetch(`/api/admin/webhooks/${deleteFlow.webhookId}/flows/${deleteFlow.flow.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        toast.success("Flow removido.")
        setDeleteFlow(null)
        fetchWebhooks()
      }
    } catch { /* silent */ } finally { setActionLoading(null) }
  }

  // ── Test webhook ────────────────────────────────────────────────────────────

  function handleOpenTeste(w: WebhookItem) {
    setTesteWebhook(w)
    setTesteNome("")
    setTesteTelefone("")
    setTesteErrors({})
    setTesteResultado(null)
  }

  async function handleEnviarTeste() {
    if (!testeWebhook) return
    const errs: Record<string, string> = {}
    if (!testeNome.trim()) errs.nome = "Nome é obrigatório"
    if (!testeTelefone.trim()) errs.telefone = "Telefone é obrigatório"
    if (Object.keys(errs).length > 0) { setTesteErrors(errs); return }

    setTesteLoading(true)
    setTesteResultado(null)
    try {
      const res = await fetch(`/api/webhook/${testeWebhook.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: testeNome.trim(), telefone: testeTelefone.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setTesteResultado({ ok: true, lead_id: data.lead_id })
        fetchWebhooks()
      } else {
        setTesteResultado({ ok: false, message: data.message || "Erro ao processar." })
      }
    } catch {
      setTesteResultado({ ok: false, message: "Erro de rede." })
    } finally {
      setTesteLoading(false)
    }
  }

  // ── Pause actions ───────────────────────────────────────────────────────────

  async function callPauseAction(action: "pausar" | "retomar" | "soltar-um" | "soltar-todos") {
    if (!accessToken || !id) return
    setPauseLoading(action)
    try {
      const res = await fetch(`/api/admin/campanhas/${id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        fetchCampanha()
      } else {
        toast.error(data.message || "Erro ao executar ação.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setPauseLoading(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Header breadcrumbs={[{ label: "Campanhas", href: "/admin/campanhas" }, { label: "..." }]} />
        <div className="flex items-center justify-center flex-1">
          <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  if (error || !campanha) {
    return (
      <div className="flex flex-col h-full">
        <Header breadcrumbs={[{ label: "Campanhas", href: "/admin/campanhas" }, { label: "Erro" }]} />
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <p className="text-[#F87171]">{error || "Campanha não encontrada"}</p>
          <Button variant="outline" onClick={() => router.push("/admin/campanhas")}>Voltar</Button>
        </div>
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "visao-geral", label: "Visão Geral" },
    { id: "webhooks", label: `Webhooks${campanha.webhooks_count > 0 ? ` (${campanha.webhooks_count})` : ""}` },
    { id: "leads", label: `Leads${campanha.leads_count > 0 ? ` (${campanha.leads_count})` : ""}` },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Campanhas", href: "/admin/campanhas" },
          { label: campanha.nome },
        ]}
        actions={
          canWrite ? (
            <div className="flex items-center gap-2">
              {campanha && !campanha.pausado_at && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => callPauseAction("pausar")}
                  loading={pauseLoading === "pausar"}
                >
                  <PauseCircle className="w-4 h-4 mr-1.5" />
                  Pausar
                </Button>
              )}
              <Link href={`/admin/campanhas/${id}/editar`}>
                <Button variant="outline" size="sm">
                  <Pencil className="w-4 h-4 mr-1.5" />
                  Editar
                </Button>
              </Link>
            </div>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-auto">
        {/* Page title + meta */}
        <div className="px-6 pt-6 pb-0">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-[#F1F1F3] text-2xl font-bold">{campanha.nome}</h1>
                {campanha.pausado_at ? (
                  <Badge variant="inativo" className="border-[#F59E0B]/40 bg-[#1A1500] text-[#F59E0B]">
                    Pausada
                  </Badge>
                ) : (
                  <Badge variant={campanha.status === "ativo" ? "ativo" : "inativo"}>
                    {campanha.status === "ativo" ? "Ativa" : "Inativa"}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-[#8B8B9E]">
                {campanha.cliente && (
                  <Link href={`/admin/clientes/${campanha.cliente.id}`} className="flex items-center gap-1.5 hover:text-[#25D366] transition-colors">
                    <Building2 className="w-3.5 h-3.5" />
                    {campanha.cliente.nome}
                  </Link>
                )}
                {(campanha.data_inicio || campanha.data_fim) && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(campanha.data_inicio)} → {formatDate(campanha.data_fim)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-[#1E1E2A]">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                  tab === t.id
                    ? "text-[#25D366] border-[#25D366]"
                    : "text-[#8B8B9E] border-transparent hover:text-[#F1F1F3]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab: Visão Geral ─────────────────────────────────────────────── */}
        {tab === "visao-geral" && (
          <div className="p-6 max-w-2xl space-y-5">

            {/* Pause banner */}
            {campanha.pausado_at && (
              <div className="bg-[#1A1500] border border-[#F59E0B]/30 rounded-xl px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <PauseCircle className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[#F59E0B] font-semibold text-sm">Campanha pausada</p>
                      <p className="text-[#A08030] text-xs mt-0.5">
                        {campanha.aguardando_count > 0
                          ? `${campanha.aguardando_count} lead(s) na fila de espera`
                          : "Nenhum lead na fila ainda"}
                        {" · "}Pausada em {formatDate(campanha.pausado_at)}
                      </p>
                    </div>
                  </div>
                </div>
                {canWrite && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Button
                      size="sm"
                      onClick={() => callPauseAction("retomar")}
                      loading={pauseLoading === "retomar"}
                      disabled={!!pauseLoading}
                    >
                      <PlayCircle className="w-4 h-4 mr-1.5" />
                      Retomar campanha
                    </Button>
                    {campanha.aguardando_count > 0 && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => callPauseAction("soltar-todos")}
                          loading={pauseLoading === "soltar-todos"}
                          disabled={!!pauseLoading}
                        >
                          <ChevronsRight className="w-4 h-4 mr-1.5" />
                          Soltar todos ({campanha.aguardando_count})
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => callPauseAction("soltar-um")}
                          loading={pauseLoading === "soltar-um"}
                          disabled={!!pauseLoading}
                        >
                          <ListOrdered className="w-4 h-4 mr-1.5" />
                          Soltar um
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Webhooks", value: campanha.webhooks_count, icon: <Webhook className="w-4 h-4 text-[#7F7F9E]" />, onClick: () => setTab("webhooks") },
                { label: "Leads recebidos", value: campanha.leads_count, icon: <Users2 className="w-4 h-4 text-[#7F7F9E]" />, onClick: () => setTab("leads") },
              ].map((s) => (
                <button
                  key={s.label}
                  onClick={s.onClick}
                  className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-xl px-5 py-4 flex items-center gap-3.5 hover:border-[#252535] transition-all text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#13131F] flex items-center justify-center shrink-0">
                    {s.icon}
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#EEEEF5] leading-none">{s.value}</p>
                    <p className="text-[#7F7F9E] text-[11px] mt-1">{s.label}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Details card */}
            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5 space-y-4">
              {campanha.descricao && (
                <div>
                  <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold mb-1">Descrição</p>
                  <p className="text-[#C4C4D4] text-sm">{campanha.descricao}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold mb-1">Criado por</p>
                  <p className="text-[#C4C4D4] text-sm">{campanha.usuario.nome}</p>
                </div>
                <div>
                  <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold mb-1">Criado em</p>
                  <p className="text-[#C4C4D4] text-sm">{formatDate(campanha.created_at)}</p>
                </div>
                {campanha.data_inicio && (
                  <div>
                    <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold mb-1">Início</p>
                    <p className="text-[#C4C4D4] text-sm">{formatDate(campanha.data_inicio)}</p>
                  </div>
                )}
                {campanha.data_fim && (
                  <div>
                    <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold mb-1">Fim</p>
                    <p className="text-[#C4C4D4] text-sm">{formatDate(campanha.data_fim)}</p>
                  </div>
                )}
              </div>
            </div>

            {canWrite && (
              <Link href={`/admin/campanhas/${id}/editar`}>
                <Button variant="outline" className="w-full">
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar Campanha
                </Button>
              </Link>
            )}
          </div>
        )}

        {/* ── Tab: Webhooks ────────────────────────────────────────────────── */}
        {tab === "webhooks" && (
          <div className="p-6 max-w-3xl space-y-4">
            {loadingWebhooks ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
              </div>
            ) : webhooks.length === 0 ? (
              <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#1E1E2A] flex items-center justify-center">
                  <Webhook className="w-6 h-6 text-[#5A5A72]" />
                </div>
                <div className="text-center">
                  <p className="text-[#C4C4D4] font-medium">Nenhum webhook nesta campanha</p>
                  <p className="text-[#5A5A72] text-sm mt-1">Webhooks são criados automaticamente ao criar uma campanha</p>
                </div>
              </div>
            ) : (
              webhooks.map((w) => {
                const expanded = expandedWebhook === w.id
                const activeFlows = w.webhook_flows?.filter((f) => f.status === "ativo") || []
                return (
                  <div key={w.id} className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
                    {/* Webhook header */}
                    <div
                      className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-[#1C1C28] transition-colors"
                      onClick={() => setExpandedWebhook(expanded ? null : w.id)}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${w.status === "ativo" ? "bg-[#25D366]" : "bg-[#3F3F58]"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[#F1F1F3] font-medium text-sm">{w.nome}</p>
                        <p className="text-[#5A5A72] text-xs font-mono mt-0.5 truncate">{w.url_publica}</p>
                      </div>
                      <Badge variant={w.status === "ativo" ? "ativo" : "inativo"} className="shrink-0">
                        {w.status === "ativo" ? "Ativo" : "Inativo"}
                      </Badge>
                      <div className="flex items-center gap-3 shrink-0 text-[#8B8B9E] text-xs">
                        <span>{activeFlows.length} flows</span>
                        <span>{w.leads_count} leads</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopy(w.url_publica, w.id) }}
                        className="p-1.5 text-[#5A5A72] hover:text-[#25D366] transition-colors shrink-0"
                        title="Copiar URL"
                      >
                        {copiedId === w.id ? <CheckCircle2 className="w-4 h-4 text-[#25D366]" /> : <Copy className="w-4 h-4" />}
                      </button>
                      {expanded ? <ChevronDown className="w-4 h-4 text-[#5A5A72] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[#5A5A72] shrink-0" />}
                    </div>

                    {/* Expanded: flows + actions */}
                    {expanded && (
                      <div className="border-t border-[#1E1E2A]">
                        {/* Flows list */}
                        <div className="px-5 py-3">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold">Flows Manychat</p>
                            <div className="flex gap-2">
                              {activeFlows.length > 0 && (
                                <Button size="sm" variant="outline" onClick={() => handleOpenTeste(w)}>
                                  <FlaskConical className="w-3.5 h-3.5 mr-1" />
                                  Testar
                                </Button>
                              )}
                              <Button size="sm" onClick={() => handleOpenAddFlow(w.id)}>
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Adicionar Flow
                              </Button>
                              <button
                                onClick={() => handleToggleWebhook(w)}
                                className="text-[#5A5A72] hover:text-[#25D366] transition-colors p-1.5"
                                title={w.status === "ativo" ? "Desativar webhook" : "Ativar webhook"}
                              >
                                {w.status === "ativo"
                                  ? <ToggleRight className="w-5 h-5 text-[#25D366]" />
                                  : <ToggleLeft className="w-5 h-5" />}
                              </button>
                            </div>
                          </div>

                          {!w.webhook_flows || w.webhook_flows.length === 0 ? (
                            <div className="flex items-center gap-2 py-4 text-center">
                              <Info className="w-4 h-4 text-[#5A5A72] shrink-0" />
                              <p className="text-[#5A5A72] text-sm">Nenhum flow. Adicione um flow para este webhook receber leads.</p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {w.webhook_flows.map((flow) => (
                                <div key={flow.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#111118] border border-[#1E1E2A]">
                                  <GripVertical className="w-4 h-4 text-[#2A2A3A] shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[#C4C4D4] text-sm font-medium">{flow.conta.nome}</p>
                                    <p className="text-[#5A5A72] text-xs font-mono">
                                      {flow.flow_nome || flow.flow_ns.slice(0, 40) + (flow.flow_ns.length > 40 ? "…" : "")}
                                    </p>
                                  </div>
                                  <Badge variant={flow.status === "ativo" ? "ativo" : "inativo"}>
                                    {flow.status === "ativo" ? "Ativo" : "Inativo"}
                                  </Badge>
                                  <span className="text-[#8B8B9E] text-xs shrink-0">{flow.total_enviados} enviados</span>
                                  <div className="flex gap-1 shrink-0">
                                    <button
                                      onClick={() => handleToggleFlow(flow, w.id)}
                                      disabled={actionLoading === flow.id + "-toggle"}
                                      className="p-1.5 text-[#5A5A72] hover:text-[#25D366] transition-colors disabled:opacity-50"
                                    >
                                      {flow.status === "ativo"
                                        ? <ToggleRight className="w-4 h-4 text-[#25D366]" />
                                        : <ToggleLeft className="w-4 h-4" />}
                                    </button>
                                    <button
                                      onClick={() => setDeleteFlow({ flow, webhookId: w.id })}
                                      className="p-1.5 text-[#5A5A72] hover:text-[#F87171] transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── Tab: Leads ───────────────────────────────────────────────────── */}
        {tab === "leads" && (
          <div className="p-6 max-w-3xl">
            {loadingLeads ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
              </div>
            ) : leads.length === 0 ? (
              <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl flex flex-col items-center justify-center py-16 gap-4">
                <Users2 className="w-10 h-10 text-[#5A5A72]" />
                <div className="text-center">
                  <p className="text-[#C4C4D4] font-medium">Nenhum lead nesta campanha</p>
                  <p className="text-[#5A5A72] text-sm mt-1">Os leads aparecerão aqui quando chegarem via webhook</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-[#8B8B9E]">
                    {leadsTotal} lead{leadsTotal !== 1 ? "s" : ""} recebido{leadsTotal !== 1 ? "s" : ""}
                  </p>
                  <Link href={`/admin/leads?campanha_id=${id}`}>
                    <Button variant="outline" size="sm">Ver todos em Leads</Button>
                  </Link>
                </div>
                <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#1E1E2A]">
                        <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Nome</th>
                        <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Telefone</th>
                        <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Status</th>
                        <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Webhook</th>
                        <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Recebido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((lead) => (
                        <tr key={lead.id} className="border-b border-[#1E1E2A] last:border-0 hover:bg-[#1C1C28] transition-colors">
                          <td className="px-5 py-3">
                            <Link href={`/admin/leads/${lead.id}`} className="text-[#F1F1F3] font-medium text-sm hover:text-[#25D366] transition-colors">
                              {lead.nome}
                            </Link>
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-[#C4C4D4] text-sm font-mono">{lead.telefone}</span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-medium capitalize ${statusColor(lead.status)}`}>
                              {lead.status}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-[#8B8B9E] text-xs">{lead.webhook?.nome || "—"}</span>
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-[#5A5A72] text-xs">{formatDate(lead.created_at)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Add Flow Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!showAddFlow} onOpenChange={() => setShowAddFlow(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Flow</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#C4C4D4]">
                Conta Manychat <span className="text-[#F87171]">*</span>
              </label>
              {contas.length === 0 ? (
                <div className="h-10 rounded-lg border border-[#F87171]/30 bg-[#2A1616] flex items-center px-3">
                  <span className="text-[#F87171] text-sm">Nenhuma conta ativa encontrada.</span>
                </div>
              ) : (
                <select
                  value={flowContaId}
                  onChange={(e) => setFlowContaId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#F1F1F3] focus:outline-none focus:border-[#25D366]"
                >
                  <option value="">Selecione uma conta...</option>
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}{c.page_name ? ` — ${c.page_name}` : ""}</option>
                  ))}
                </select>
              )}
              {flowErrors.conta_id && <p className="text-xs text-[#F87171]">{flowErrors.conta_id}</p>}
            </div>
            <Input
              label="Flow NS"
              placeholder="Ex: content20210501abc123..."
              value={flowNs}
              onChange={(e) => setFlowNs(e.target.value)}
              error={flowErrors.flow_ns}
              helperText="Automação → Flows → clique no flow → copie o NS da URL"
              required
            />
            <Input
              label="Nome do Flow (opcional)"
              placeholder="Ex: Flow Perseguição Produto X"
              value={flowNome}
              onChange={(e) => setFlowNome(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFlow(null)} disabled={addFlowLoading}>Cancelar</Button>
            <Button onClick={handleAddFlow} loading={addFlowLoading}>Adicionar Flow</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Flow Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!deleteFlow} onOpenChange={() => setDeleteFlow(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remover Flow</DialogTitle></DialogHeader>
          <p className="text-[#8B8B9E] text-sm">
            Remover <span className="text-[#F1F1F3] font-semibold">{deleteFlow?.flow.flow_nome || deleteFlow?.flow.flow_ns}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFlow(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteFlow} loading={actionLoading === deleteFlow?.flow.id + "-delete"}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Test Webhook Dialog ─────────────────────────────────────────────── */}
      <Dialog
        open={!!testeWebhook}
        onOpenChange={(open) => { if (!open) { setTesteWebhook(null); setTesteResultado(null) } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-[#25D366]" />
              Testar Webhook
            </DialogTitle>
          </DialogHeader>
          {testeResultado ? (
            <div className="py-4 space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                {testeResultado.ok ? (
                  <>
                    <div className="w-14 h-14 rounded-full bg-[rgba(37,211,102,0.15)] flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-[#25D366]" />
                    </div>
                    <div className="text-center">
                      <p className="text-[#F1F1F3] font-semibold">Lead enviado com sucesso!</p>
                      <p className="text-[#5A5A72] text-xs mt-1 font-mono">Lead ID: {testeResultado.lead_id}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full bg-[rgba(248,113,113,0.15)] flex items-center justify-center">
                      <XCircle className="w-8 h-8 text-[#F87171]" />
                    </div>
                    <div className="text-center">
                      <p className="text-[#F1F1F3] font-semibold">Falha no envio</p>
                      <p className="text-[#F87171] text-sm mt-1">{testeResultado.message}</p>
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTesteResultado(null)} className="flex-1">Testar novamente</Button>
                <Button onClick={() => { setTesteWebhook(null); setTesteResultado(null) }} className="flex-1">Fechar</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <Input label="Nome" placeholder="Ex: João Silva" value={testeNome} onChange={(e) => setTesteNome(e.target.value)} error={testeErrors.nome} required />
              <Input label="Telefone" placeholder="Ex: 11999999999" value={testeTelefone} onChange={(e) => setTesteTelefone(e.target.value)} error={testeErrors.telefone} required />
              <DialogFooter>
                <Button variant="outline" onClick={() => setTesteWebhook(null)} disabled={testeLoading}>Cancelar</Button>
                <Button onClick={handleEnviarTeste} disabled={testeLoading}>
                  {testeLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</> : <><FlaskConical className="w-4 h-4 mr-2" />Enviar Teste</>}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
