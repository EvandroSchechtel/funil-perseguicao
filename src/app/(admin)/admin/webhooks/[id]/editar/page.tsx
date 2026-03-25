"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  Plus, Trash2, ToggleLeft, ToggleRight, GripVertical, Info,
  FlaskConical, CheckCircle2, XCircle, Loader2, Tag, Pencil,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Header } from "@/components/layout/Header"
import { WebhookForm } from "@/components/admin/WebhookForm"
import { AddFlowDialog } from "@/components/admin/AddFlowDialog"
import { EditFlowDialog } from "@/components/admin/EditFlowDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"

interface Flow {
  id: string
  tipo: string
  flow_ns: string | null
  flow_nome: string | null
  webhook_url: string | null
  ordem: number
  total_enviados: number
  status: "ativo" | "inativo"
  limite_diario: number | null
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
  campanha: { id: string; nome: string; cliente: { id: string; nome: string } | null } | null
  webhook_flows: Flow[]
}

type TesteResultado = { ok: true; lead_id: string } | { ok: false; message: string } | null

export default function EditarWebhookPage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken } = useAuth()
  const [webhook, setWebhook] = useState<WebhookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flows, setFlows] = useState<Flow[]>([])

  // Add flow dialog
  const [showAddFlow, setShowAddFlow] = useState(false)

  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteFlowDialog, setDeleteFlowDialog] = useState<Flow | null>(null)
  const [editFlowDialog, setEditFlowDialog] = useState<Flow | null>(null)

  // Test dialog
  const [showTeste, setShowTeste] = useState(false)
  const [testeNome, setTesteNome] = useState("")
  const [testeTelefone, setTesteTelefone] = useState("")
  const [testeLoading, setTesteLoading] = useState(false)
  const [testeErrors, setTesteErrors] = useState<Record<string, string>>({})
  const [testeResultado, setTesteResultado] = useState<TesteResultado>(null)

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

  async function handleToggleFlow(flow: Flow) {
    setActionLoading(flow.id + "-toggle")
    try {
      const res = await fetch(`/api/admin/webhooks/${id}/flows/${flow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
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

  function handleOpenTeste() {
    setShowTeste(true)
    setTesteNome("")
    setTesteTelefone("")
    setTesteErrors({})
    setTesteResultado(null)
  }

  async function handleEnviarTeste() {
    const newErrors: Record<string, string> = {}
    if (!testeNome.trim()) newErrors.nome = "Nome é obrigatório"
    if (!testeTelefone.trim()) newErrors.telefone = "Telefone é obrigatório"
    if (Object.keys(newErrors).length > 0) {
      setTesteErrors(newErrors)
      return
    }

    setTesteLoading(true)
    setTesteResultado(null)
    try {
      const res = await fetch(`/api/webhook/${webhook!.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: testeNome.trim(), telefone: testeTelefone.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setTesteResultado({ ok: true, lead_id: data.lead_id })
        fetchWebhook()
      } else {
        setTesteResultado({ ok: false, message: data.message || "Erro ao processar." })
      }
    } catch {
      setTesteResultado({ ok: false, message: "Erro de rede ao enviar." })
    } finally {
      setTesteLoading(false)
    }
  }

  const activeFlows = flows.filter((f) => f.status === "ativo")
  const clienteId = webhook?.campanha?.cliente?.id ?? null

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
                <h2 className="text-[#F1F1F3] text-lg font-semibold">Flows</h2>
                <p className="text-[#8B8B9E] text-sm mt-0.5">
                  Leads distribuídos em round-robin entre os flows ativos (Manychat ou Webhook externo)
                </p>
              </div>
              <div className="flex gap-2">
                {activeFlows.length > 0 && (
                  <Button size="sm" variant="outline" onClick={handleOpenTeste}>
                    <FlaskConical className="w-4 h-4 mr-1.5" />
                    Testar
                  </Button>
                )}
                <Button size="sm" onClick={() => setShowAddFlow(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Adicionar Flow
                </Button>
              </div>
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
                  <Button size="sm" variant="outline" onClick={() => setShowAddFlow(true)}>
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
                              <p
                                className="text-[#C4C4D4] text-sm font-medium cursor-pointer hover:text-[#F1F1F3] transition-colors"
                                onClick={() => setEditFlowDialog(flow)}
                              >
                                {flow.conta?.nome ?? (flow.flow_nome || "Webhook externo")}
                              </p>
                              <p className="text-[#5A5A72] text-xs font-mono mt-0.5">
                                {flow.tipo === "webhook"
                                  ? (flow.webhook_url ? flow.webhook_url.slice(0, 40) + (flow.webhook_url.length > 40 ? "…" : "") : "—")
                                  : (flow.flow_nome || (flow.flow_ns ? flow.flow_ns.slice(0, 30) + (flow.flow_ns.length > 30 ? "…" : "") : "—"))}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {flow.tag_manychat_nome && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-[#A78BFA]">
                                    <Tag className="w-2.5 h-2.5" />{flow.tag_manychat_nome}
                                  </span>
                                )}
                                {flow.limite_diario && (
                                  <span className="text-[10px] text-[#A78BFA] bg-[#1A1130] border border-[#2D1F54] px-1.5 py-0.5 rounded">
                                    lim. {flow.limite_diario}/dia
                                  </span>
                                )}
                              </div>
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
                              type="button"
                              onClick={() => setEditFlowDialog(flow)}
                              className="p-1.5 text-[#3F3F58] hover:text-[#A78BFA] transition-colors"
                              title="Editar flow"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
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

      {/* ── Add Flow Dialog ── */}
      <AddFlowDialog
        open={showAddFlow}
        webhookId={id}
        clienteId={clienteId}
        accessToken={accessToken}
        onClose={() => setShowAddFlow(false)}
        onSuccess={() => { setShowAddFlow(false); fetchWebhook() }}
      />

      {/* ── Edit Flow Dialog ── */}
      <EditFlowDialog
        open={!!editFlowDialog}
        flow={editFlowDialog}
        webhookId={id}
        accessToken={accessToken}
        onClose={() => setEditFlowDialog(null)}
        onSuccess={() => { setEditFlowDialog(null); fetchWebhook() }}
      />

      {/* ── Delete Flow Dialog ── */}
      <Dialog open={!!deleteFlowDialog} onOpenChange={() => setDeleteFlowDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Flow</DialogTitle>
          </DialogHeader>
          <p className="text-[#8B8B9E] text-sm">
            Tem certeza que deseja remover o flow{" "}
            <span className="text-[#F1F1F3] font-semibold">
              {deleteFlowDialog?.flow_nome || deleteFlowDialog?.webhook_url || deleteFlowDialog?.flow_ns || "—"}
            </span>{" "}
            {deleteFlowDialog?.conta && (
              <>da conta <span className="text-[#F1F1F3] font-semibold">{deleteFlowDialog.conta.nome}</span></>
            )}?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFlowDialog(null)}>Cancelar</Button>
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

      {/* ── Test Webhook Dialog ── */}
      <Dialog open={showTeste} onOpenChange={(open) => { setShowTeste(open); if (!open) setTesteResultado(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-[#25D366]" />
              Testar Webhook
            </DialogTitle>
          </DialogHeader>

          {testeResultado ? (
            <div className="py-4 space-y-4">
              {testeResultado.ok ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-14 h-14 rounded-full bg-[rgba(37,211,102,0.15)] flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-[#25D366]" />
                  </div>
                  <div className="text-center">
                    <p className="text-[#F1F1F3] font-semibold">Lead enviado com sucesso!</p>
                    <p className="text-[#8B8B9E] text-sm mt-1">
                      O flow será disparado pelo worker em instantes.
                    </p>
                    <p className="text-[#5A5A72] text-xs mt-2 font-mono">
                      Lead ID: {testeResultado.lead_id}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-14 h-14 rounded-full bg-[rgba(248,113,113,0.15)] flex items-center justify-center">
                    <XCircle className="w-8 h-8 text-[#F87171]" />
                  </div>
                  <div className="text-center">
                    <p className="text-[#F1F1F3] font-semibold">Falha no envio</p>
                    <p className="text-[#F87171] text-sm mt-1">{testeResultado.message}</p>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setTesteResultado(null)} className="flex-1">
                  Testar novamente
                </Button>
                <Button onClick={() => setShowTeste(false)} className="flex-1">
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-[#8B8B9E] text-sm">
                Preencha os dados abaixo. Um lead real será criado e o flow será disparado via Manychat.
              </p>

              {activeFlows.length > 0 && (
                <div className="bg-[#111118] border border-[#1E1E2A] rounded-lg px-4 py-3">
                  <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold mb-1">Flow que receberá</p>
                  <p className="text-[#C4C4D4] text-sm font-medium">
                    {activeFlows[0].conta?.nome ?? (activeFlows[0].flow_nome || "Webhook externo")}
                  </p>
                  <p className="text-[#5A5A72] text-xs font-mono mt-0.5">
                    {activeFlows[0].flow_nome || activeFlows[0].webhook_url || activeFlows[0].flow_ns || "—"}
                  </p>
                  {activeFlows.length > 1 && (
                    <p className="text-[#5A5A72] text-xs mt-1">
                      +{activeFlows.length - 1} flow(s) no round-robin
                    </p>
                  )}
                </div>
              )}

              <Input
                label="Nome"
                placeholder="Ex: João Silva"
                value={testeNome}
                onChange={(e) => setTesteNome(e.target.value)}
                error={testeErrors.nome}
                required
              />
              <Input
                label="Telefone"
                placeholder="Ex: 11999999999"
                value={testeTelefone}
                onChange={(e) => setTesteTelefone(e.target.value)}
                error={testeErrors.telefone}
                helperText="Número que será enviado ao Manychat"
                required
              />

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowTeste(false)} disabled={testeLoading}>
                  Cancelar
                </Button>
                <Button onClick={handleEnviarTeste} disabled={testeLoading}>
                  {testeLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <FlaskConical className="w-4 h-4 mr-2" />
                      Enviar Teste
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
