"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { Plus, Trash2, ToggleLeft, ToggleRight, GripVertical, Info } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Header } from "@/components/layout/Header"
import { WebhookForm } from "@/components/admin/WebhookForm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"

interface Flow {
  id: string
  flow_ns: string
  flow_nome: string | null
  ordem: number
  total_enviados: number
  status: "ativo" | "inativo"
  conta: { id: string; nome: string; page_name: string | null }
}

interface Conta {
  id: string
  nome: string
  page_name: string | null
  status: "ativo" | "inativo"
}

interface WebhookData {
  id: string
  nome: string
  status: "ativo" | "inativo"
  url_publica: string
  leads_count: number
  campanha: { id: string; nome: string } | null
  webhook_flows: Flow[]
}

export default function EditarWebhookPage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken } = useAuth()
  const [webhook, setWebhook] = useState<WebhookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Flows state
  const [flows, setFlows] = useState<Flow[]>([])
  const [showAddFlow, setShowAddFlow] = useState(false)
  const [contas, setContas] = useState<Conta[]>([])
  const [loadingContas, setLoadingContas] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [flowContaId, setFlowContaId] = useState("")
  const [flowNs, setFlowNs] = useState("")
  const [flowNome, setFlowNome] = useState("")
  const [flowErrors, setFlowErrors] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteFlowDialog, setDeleteFlowDialog] = useState<Flow | null>(null)

  const fetchWebhook = useCallback(async () => {
    if (!accessToken || !id) return
    setLoading(true)
    fetch(`/api/admin/webhooks/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Webhook não encontrado")
        return res.json()
      })
      .then((data) => {
        setWebhook(data.webhook)
        setFlows(data.webhook.webhook_flows || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [accessToken, id])

  useEffect(() => {
    fetchWebhook()
  }, [fetchWebhook])

  const fetchContas = useCallback(async () => {
    if (!accessToken) return
    setLoadingContas(true)
    try {
      const res = await fetch("/api/admin/contas?per_page=100&status=ativo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setContas(data.contas || [])
    } catch {
      // silently fail
    } finally {
      setLoadingContas(false)
    }
  }, [accessToken])

  function handleOpenAddFlow() {
    setShowAddFlow(true)
    setFlowContaId("")
    setFlowNs("")
    setFlowNome("")
    setFlowErrors({})
    if (contas.length === 0) fetchContas()
  }

  async function handleAddFlow() {
    const newErrors: Record<string, string> = {}
    if (!flowContaId) newErrors.conta_id = "Selecione uma conta"
    if (!flowNs.trim()) newErrors.flow_ns = "Flow NS é obrigatório"
    if (Object.keys(newErrors).length > 0) {
      setFlowErrors(newErrors)
      return
    }

    setAddLoading(true)
    try {
      const res = await fetch(`/api/admin/webhooks/${id}/flows`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          conta_id: flowContaId,
          flow_ns: flowNs.trim(),
          flow_nome: flowNome.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        setShowAddFlow(false)
        fetchWebhook()
      } else {
        toast.error(data.message || "Erro ao adicionar flow.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setAddLoading(false)
    }
  }

  async function handleToggleFlow(flow: Flow) {
    setActionLoading(flow.id + "-toggle")
    try {
      const res = await fetch(`/api/admin/webhooks/${id}/flows/${flow.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: flow.status === "ativo" ? "inativo" : "ativo" }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        fetchWebhook()
      } else {
        toast.error(data.message || "Erro ao alterar status.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeleteFlow(flow: Flow) {
    setActionLoading(flow.id + "-delete")
    try {
      const res = await fetch(`/api/admin/webhooks/${id}/flows/${flow.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        setDeleteFlowDialog(null)
        fetchWebhook()
      } else {
        toast.error(data.message || "Erro ao remover flow.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Webhooks", href: "/admin/webhooks" },
          { label: loading ? "..." : webhook?.nome || "Editar Webhook" },
        ]}
      />

      <div className="p-6 max-w-2xl space-y-6">
        {/* Webhook Form */}
        <div>
          <div className="mb-4">
            <h1 className="text-[#F1F1F3] text-2xl font-bold">Editar Webhook</h1>
            <p className="text-[#8B8B9E] text-sm mt-1">Atualize as configurações do webhook</p>
          </div>

          <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-6">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
              </div>
            ) : error ? (
              <div className="text-center py-10">
                <p className="text-[#F87171] text-sm">{error}</p>
              </div>
            ) : webhook ? (
              <WebhookForm mode="edit" initialData={webhook} />
            ) : null}
          </div>
        </div>

        {/* Flows Section */}
        {!loading && !error && webhook && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[#F1F1F3] text-lg font-semibold">Flows Manychat</h2>
                <p className="text-[#8B8B9E] text-sm mt-0.5">
                  Leads são distribuídos em round-robin entre os flows ativos
                </p>
              </div>
              <Button size="sm" onClick={handleOpenAddFlow}>
                <Plus className="w-4 h-4 mr-1.5" />
                Adicionar Flow
              </Button>
            </div>

            <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
              {flows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#1E1E2A] flex items-center justify-center">
                    <Info className="w-6 h-6 text-[#5A5A72]" />
                  </div>
                  <div className="text-center">
                    <p className="text-[#C4C4D4] font-medium text-sm">Nenhum flow configurado</p>
                    <p className="text-[#5A5A72] text-xs mt-1">
                      Adicione pelo menos um flow para este webhook receber leads
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleOpenAddFlow}>
                    <Plus className="w-4 h-4 mr-1.5" />
                    Adicionar Flow
                  </Button>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1E1E2A]">
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Conta / Flow</th>
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Status</th>
                      <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Enviados</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {flows.map((flow) => (
                      <tr key={flow.id} className="border-b border-[#1E1E2A] last:border-0 hover:bg-[#1C1C28] transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <GripVertical className="w-4 h-4 text-[#2A2A3A] shrink-0" />
                            <div>
                              <p className="text-[#C4C4D4] text-sm font-medium">{flow.conta.nome}</p>
                              <p className="text-[#5A5A72] text-xs font-mono mt-0.5">
                                {flow.flow_nome || flow.flow_ns.slice(0, 30) + (flow.flow_ns.length > 30 ? "…" : "")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={flow.status === "ativo" ? "ativo" : "inativo"}>
                            {flow.status === "ativo" ? "Ativo" : "Inativo"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[#8B8B9E] text-sm">{flow.total_enviados}</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => handleToggleFlow(flow)}
                              disabled={actionLoading === flow.id + "-toggle"}
                              className="p-1.5 text-[#5A5A72] hover:text-[#25D366] transition-colors disabled:opacity-50"
                              title={flow.status === "ativo" ? "Desativar" : "Ativar"}
                            >
                              {flow.status === "ativo" ? (
                                <ToggleRight className="w-5 h-5 text-[#25D366]" />
                              ) : (
                                <ToggleLeft className="w-5 h-5" />
                              )}
                            </button>
                            <button
                              onClick={() => setDeleteFlowDialog(flow)}
                              className="p-1.5 text-[#5A5A72] hover:text-[#F87171] transition-colors"
                              title="Remover flow"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Flow Dialog */}
      <Dialog open={showAddFlow} onOpenChange={setShowAddFlow}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Flow</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Conta Select */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#C4C4D4]">
                Conta Manychat <span className="text-[#F87171]">*</span>
              </label>
              {loadingContas ? (
                <div className="h-10 rounded-lg border border-[#1E1E2A] bg-[#111118] flex items-center px-3">
                  <span className="text-[#5A5A72] text-sm">Carregando contas...</span>
                </div>
              ) : contas.length === 0 ? (
                <div className="h-10 rounded-lg border border-[#F87171]/30 bg-[#2A1616] flex items-center px-3 gap-2">
                  <Info className="w-4 h-4 text-[#F87171] shrink-0" />
                  <span className="text-[#F87171] text-sm">Nenhuma conta ativa. Crie em Manychat primeiro.</span>
                </div>
              ) : (
                <select
                  value={flowContaId}
                  onChange={(e) => setFlowContaId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#F1F1F3] focus:outline-none focus:border-[#25D366] transition-colors"
                >
                  <option value="">Selecione uma conta...</option>
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}{c.page_name ? ` — ${c.page_name}` : ""}
                    </option>
                  ))}
                </select>
              )}
              {flowErrors.conta_id && (
                <p className="text-xs text-[#F87171]">{flowErrors.conta_id}</p>
              )}
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
              helperText="Apenas para referência interna"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFlow(false)} disabled={addLoading}>
              Cancelar
            </Button>
            <Button onClick={handleAddFlow} loading={addLoading}>
              Adicionar Flow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Flow Dialog */}
      <Dialog open={!!deleteFlowDialog} onOpenChange={() => setDeleteFlowDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Flow</DialogTitle>
          </DialogHeader>
          <p className="text-[#8B8B9E] text-sm">
            Tem certeza que deseja remover o flow{" "}
            <span className="text-[#F1F1F3] font-semibold">
              {deleteFlowDialog?.flow_nome || deleteFlowDialog?.flow_ns}
            </span>{" "}
            da conta <span className="text-[#F1F1F3] font-semibold">{deleteFlowDialog?.conta.nome}</span>?
            Leads já processados não serão afetados.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFlowDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteFlowDialog && handleDeleteFlow(deleteFlowDialog)}
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
