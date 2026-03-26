"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Pencil, PauseCircle, Building2, Calendar } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { hasPermission } from "@/lib/auth/rbac"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import { AddFlowDialog } from "@/components/admin/AddFlowDialog"
import { EditGrupoDialog } from "@/components/admin/EditGrupoDialog"

import {
  type CampanhaData, type InstanciaOption, type WebhookItem, type Flow,
  type GrupoMonitoramento, type VarreduraResult,
  formatDate,
} from "@/components/admin/campanha/types"
import { PauseBanner } from "@/components/admin/campanha/PauseBanner"
import { VisaoGeralSection } from "@/components/admin/campanha/VisaoGeralSection"
import { InstanciaZApiSection } from "@/components/admin/campanha/InstanciaZApiSection"
import { GruposSection } from "@/components/admin/campanha/GruposSection"
import { WebhooksSection } from "@/components/admin/campanha/WebhooksSection"
import { LeadsPreviewSection } from "@/components/admin/campanha/LeadsPreviewSection"
import { TesteWebhookDialog } from "@/components/admin/campanha/TesteWebhookDialog"

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CampanhaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken, user } = useAuth()
  const router = useRouter()

  const [campanha, setCampanha] = useState<CampanhaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Webhooks
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([])
  const [loadingWebhooks, setLoadingWebhooks] = useState(false)

  // Add flow dialog
  const [showAddFlow, setShowAddFlow] = useState<string | null>(null)

  // Test webhook dialog
  const [testeWebhook, setTesteWebhook] = useState<WebhookItem | null>(null)

  // Delete flow
  const [deleteFlow, setDeleteFlow] = useState<{ flow: Flow; webhookId: string } | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Varredura de grupos
  const [varrendo, setVarrendo] = useState(false)
  const [varreduraResult, setVarreduraResult] = useState<VarreduraResult | null>(null)

  // Grupos monitoramento
  const [grupos, setGrupos] = useState<GrupoMonitoramento[]>([])
  const [loadingGrupos, setLoadingGrupos] = useState(false)
  const [deletingGrupo, setDeletingGrupo] = useState<string | null>(null)
  const [editGrupo, setEditGrupo] = useState<GrupoMonitoramento | null>(null)

  // Pause actions
  const [pauseLoading, setPauseLoading] = useState<string | null>(null)

  // Z-API instance linking
  const [instancias, setInstancias] = useState<InstanciaOption[]>([])
  const [instanciaId, setInstanciaId] = useState<string | null>(null)
  const [savingInstancia, setSavingInstancia] = useState(false)

  const canWrite = user ? hasPermission(user.role, "webhooks:write") : false
  const canReprocess = user ? hasPermission(user.role, "leads:reprocess") : false

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

  // ── Sync instanciaId and fetch client's instances when campanha loads ────────

  useEffect(() => {
    if (!campanha || !accessToken) return
    setInstanciaId(campanha.instancia_zapi?.id ?? null)
    if (!campanha.cliente?.id) return
    fetch(`/api/admin/zapi/instancias?cliente_id=${campanha.cliente.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((d) => setInstancias(d.instancias ?? []))
      .catch(() => {})
  }, [campanha, accessToken])

  const handleSaveInstancia = async () => {
    if (!accessToken || !id) return
    setSavingInstancia(true)
    try {
      const res = await fetch(`/api/admin/campanhas/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ instancia_zapi_id: instanciaId }),
      })
      if (!res.ok) throw new Error("Erro ao salvar")
      toast.success("Instância Z-API vinculada com sucesso.")
      fetchCampanha()
    } catch {
      toast.error("Erro ao vincular instância Z-API.")
    } finally {
      setSavingInstancia(false)
    }
  }

  // ── Fetch webhooks ────────────────────────────────────────────────────────

  const fetchWebhooks = useCallback(async () => {
    if (!accessToken || !id) return
    setLoadingWebhooks(true)
    try {
      const res = await fetch(`/api/admin/webhooks?campanha_id=${id}&per_page=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return
      const data = await res.json()
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

  // Fetch webhooks once campanha is loaded
  useEffect(() => {
    if (campanha) {
      fetchWebhooks()
    }
  }, [campanha?.id])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Webhook actions ────────────────────────────────────────────────────────

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

  // ── Grupos monitoramento ────────────────────────────────────────────────────

  const fetchGrupos = useCallback(async () => {
    if (!accessToken || !id) return
    setLoadingGrupos(true)
    try {
      const res = await fetch(`/api/admin/campanhas/${id}/grupos`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      setGrupos(data.grupos || [])
    } catch { /* silent */ }
    finally { setLoadingGrupos(false) }
  }, [accessToken, id])

  useEffect(() => { fetchGrupos() }, [fetchGrupos])

  async function handleDeleteGrupo(grupo: GrupoMonitoramento) {
    if (!accessToken) return
    setDeletingGrupo(grupo.id)
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${grupo.instancia.id}/grupos/${grupo.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) { toast.success(data.message || "Grupo removido."); fetchGrupos() }
      else toast.error(data.message || "Erro ao remover grupo.")
    } catch { toast.error("Erro de conexão.") }
    finally { setDeletingGrupo(null) }
  }


  // ── Varredura de grupos ─────────────────────────────────────────────────────

  async function handleVarredura() {
    if (!accessToken || !id) return
    setVarrendo(true)
    setVarreduraResult(null)
    try {
      const res = await fetch(`/api/admin/campanhas/${id}/varredura-grupos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        setVarreduraResult(data.resultado)
        fetchCampanha()
      } else {
        toast.error(data.message || "Erro na varredura.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setVarrendo(false)
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
          <div className="flex items-start gap-4 mb-6">
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
        </div>

        {/* ── Unified scrollable content ─────────────────────────────────── */}
        <div className="px-6 pb-10 max-w-3xl space-y-10">
          <PauseBanner campanha={campanha} canWrite={canWrite} pauseLoading={pauseLoading} onAction={callPauseAction} />
          <VisaoGeralSection campanha={campanha} />
          <InstanciaZApiSection
            campanha={campanha}
            accessToken={accessToken}
            canWrite={canWrite}
            instancias={instancias}
            instanciaId={instanciaId}
            onInstanciaChange={setInstanciaId}
            onSaveInstancia={handleSaveInstancia}
            savingInstancia={savingInstancia}
            varrendo={varrendo}
            varreduraResult={varreduraResult}
            onVarredura={handleVarredura}
          />
          <GruposSection
            campanha={campanha}
            accessToken={accessToken}
            canWrite={canWrite}
            grupos={grupos}
            loadingGrupos={loadingGrupos}
            onDeleteGrupo={handleDeleteGrupo}
            deletingGrupo={deletingGrupo}
            onEditGrupo={setEditGrupo}
            onRefresh={fetchGrupos}
          />
          <WebhooksSection
            webhooks={webhooks}
            loadingWebhooks={loadingWebhooks}
            accessToken={accessToken}
            canWrite={canWrite}
            onToggleWebhook={handleToggleWebhook}
            onToggleFlow={handleToggleFlow}
            onDeleteFlow={(flow, webhookId) => setDeleteFlow({ flow, webhookId })}
            onOpenTeste={setTesteWebhook}
            onShowAddFlow={setShowAddFlow}
            actionLoading={actionLoading}
            webhooksCount={campanha.webhooks_count}
          />
          <LeadsPreviewSection
            campanhaId={id}
            accessToken={accessToken}
            canReprocess={canReprocess}
          />
        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      <AddFlowDialog
        open={!!showAddFlow}
        webhookId={showAddFlow ?? ""}
        clienteId={campanha?.cliente?.id ?? null}
        accessToken={accessToken}
        onClose={() => setShowAddFlow(null)}
        onSuccess={() => { setShowAddFlow(null); fetchWebhooks() }}
      />

      {/* Delete Flow Dialog */}
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

      <TesteWebhookDialog
        webhook={testeWebhook}
        onClose={() => setTesteWebhook(null)}
        onSuccess={() => { fetchWebhooks() }}
      />

      <EditGrupoDialog
        open={!!editGrupo}
        grupo={editGrupo}
        accessToken={accessToken}
        onClose={() => setEditGrupo(null)}
        onSuccess={() => { setEditGrupo(null); fetchGrupos() }}
      />
    </div>
  )
}
