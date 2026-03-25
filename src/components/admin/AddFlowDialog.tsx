"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Plus, Trash2, Loader2, CheckCircle2, RefreshCw, Tag, Link2, Send, XCircle,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchableSelect, FieldInfo } from "@/components/admin/AddGrupoForm"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Conta {
  id: string
  nome: string
  page_name: string | null
}

interface ManychatTag {
  id: number
  name: string
}

type FlowTipo = "manychat" | "webhook"

interface PendingFlow {
  tipo: FlowTipo
  // Manychat
  contaId?: string
  contaNome?: string
  flowNs?: string
  flowNome: string
  tagId: number | null
  tagNome: string
  // Webhook externo
  webhookUrl?: string
}

export interface AddFlowDialogProps {
  open: boolean
  webhookId: string
  /** null = show all active contas; provide clienteId to filter by client */
  clienteId: string | null
  accessToken: string | null
  onClose: () => void
  onSuccess: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AddFlowDialog({
  open, webhookId, clienteId, accessToken, onClose, onSuccess,
}: AddFlowDialogProps) {
  // Tipo de flow
  const [tipo, setTipo] = useState<FlowTipo>("manychat")

  // Contas
  const [contas, setContas] = useState<Conta[]>([])
  const [loadingContas, setLoadingContas] = useState(false)

  // Manychat fields
  const [contaId, setContaId] = useState("")
  const [flowNs, setFlowNs] = useState("")
  const [flowNome, setFlowNome] = useState("")

  // Webhook externo fields
  const [webhookUrl, setWebhookUrl] = useState("")

  // Tags
  const [tags, setTags] = useState<ManychatTag[]>([])
  const [loadingTags, setLoadingTags] = useState(false)
  const [tagId, setTagId] = useState("")
  const [tagNome, setTagNome] = useState("")
  const [newTagName, setNewTagName] = useState("")
  const [creatingTag, setCreatingTag] = useState(false)

  // Pending flows list
  const [pendingFlows, setPendingFlows] = useState<PendingFlow[]>([])

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Webhook URL test
  const [testingUrl, setTestingUrl] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; status: number | null; error: string | null } | null>(null)

  // Saving
  const [saving, setSaving] = useState(false)

  // ── Fetch contas ────────────────────────────────────────────────────────────

  const fetchContas = useCallback(async () => {
    if (!accessToken) return
    setLoadingContas(true)
    try {
      const params = new URLSearchParams({ per_page: "100", status: "ativo" })
      if (clienteId) params.set("cliente_id", clienteId)
      const res = await fetch(`/api/admin/contas?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setContas(data.contas || [])
    } catch { /* silent */ } finally {
      setLoadingContas(false)
    }
  }, [accessToken, clienteId])

  useEffect(() => {
    if (open) {
      fetchContas()
      resetForm()
      setPendingFlows([])
      setTipo("manychat")
    }
  }, [open, fetchContas])

  // ── Fetch tags when conta changes ───────────────────────────────────────────

  const fetchTags = useCallback(async (cId: string) => {
    if (!cId || !accessToken) return
    setLoadingTags(true)
    setTags([])
    setTagId("")
    setTagNome("")
    try {
      const res = await fetch(`/api/admin/contas/${cId}/tags`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setTags(data.data?.tags || data.tags || [])
    } catch { toast.error("Erro ao buscar tags.") } finally {
      setLoadingTags(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (contaId) fetchTags(contaId)
    else { setTags([]); setTagId(""); setTagNome("") }
  }, [contaId, fetchTags])

  // ── Create tag inline ───────────────────────────────────────────────────────

  async function handleCreateTag() {
    if (!contaId || !newTagName.trim()) return
    setCreatingTag(true)
    try {
      const res = await fetch(`/api/admin/contas/${contaId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ nome: newTagName.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.data?.tag) {
        const newTag: ManychatTag = data.data.tag
        setTags((prev) => [...prev, newTag])
        setTagId(String(newTag.id))
        setTagNome(newTag.name)
        setNewTagName("")
        toast.success(`Tag "${newTag.name}" criada com sucesso.`)
      } else {
        toast.error(data.message || "Erro ao criar tag.")
      }
    } catch { toast.error("Erro de conexão.") } finally {
      setCreatingTag(false)
    }
  }

  // ── Test webhook URL ────────────────────────────────────────────────────────

  async function handleTestUrl() {
    if (!webhookUrl.trim()) return
    try { new URL(webhookUrl.trim()) } catch { setErrors((e) => ({ ...e, webhook_url: "URL inválida" })); return }

    setTestingUrl(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/admin/webhooks/test-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ url: webhookUrl.trim() }),
      })
      const data = await res.json()
      setTestResult({ ok: data.ok, status: data.status, error: data.error })
      if (data.ok) {
        toast.success(`Webhook respondeu com status ${data.status} — URL válida!`)
      } else {
        toast.error(`Erro: ${data.error || `HTTP ${data.status}`}`)
      }
    } catch {
      setTestResult({ ok: false, status: null, error: "Erro de conexão com o servidor" })
      toast.error("Erro ao testar URL.")
    } finally {
      setTestingUrl(false)
    }
  }

  // ── Reset form ──────────────────────────────────────────────────────────────

  function resetForm() {
    setContaId(""); setFlowNs(""); setFlowNome("")
    setWebhookUrl("")
    setTestResult(null)
    setTags([]); setTagId(""); setTagNome(""); setNewTagName("")
    setErrors({})
  }

  // ── Add to pending list ─────────────────────────────────────────────────────

  function handleAddToPending() {
    const errs: Record<string, string> = {}

    if (tipo === "manychat") {
      if (!contaId) errs.conta = "Selecione uma conta Manychat"
      if (!flowNs.trim()) errs.flow_ns = "Flow NS é obrigatório"
      if (!tagId) errs.tag = "Selecione a tag de entrada no grupo"

      if (contaId && flowNs.trim()) {
        const dup = pendingFlows.find(
          (p) => p.tipo === "manychat" && p.contaId === contaId && p.flowNs === flowNs.trim()
        )
        if (dup) errs.flow_ns = "Este Flow NS já foi adicionado para esta conta"
      }
    } else {
      if (!webhookUrl.trim()) {
        errs.webhook_url = "URL é obrigatória"
      } else {
        try { new URL(webhookUrl.trim()) } catch { errs.webhook_url = "URL inválida" }
      }
      if (!errs.webhook_url) {
        const dup = pendingFlows.find((p) => p.tipo === "webhook" && p.webhookUrl === webhookUrl.trim())
        if (dup) errs.webhook_url = "Esta URL já foi adicionada"
      }
    }

    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    if (tipo === "manychat") {
      const conta = contas.find((c) => c.id === contaId)
      setPendingFlows((prev) => [
        ...prev,
        {
          tipo: "manychat",
          contaId,
          contaNome: conta ? `${conta.nome}${conta.page_name ? ` — ${conta.page_name}` : ""}` : contaId,
          flowNs: flowNs.trim(),
          flowNome: flowNome.trim(),
          tagId: tagId ? Number(tagId) : null,
          tagNome,
        },
      ])
    } else {
      setPendingFlows((prev) => [
        ...prev,
        {
          tipo: "webhook",
          flowNome: flowNome.trim(),
          tagId: null,
          tagNome: "",
          webhookUrl: webhookUrl.trim(),
        },
      ])
    }

    resetForm()
  }

  // ── Save all pending flows ──────────────────────────────────────────────────

  async function handleSave() {
    if (pendingFlows.length === 0) return
    setSaving(true)
    let successCount = 0
    let failCount = 0

    for (const flow of pendingFlows) {
      try {
        const body =
          flow.tipo === "manychat"
            ? {
                tipo: "manychat",
                conta_id: flow.contaId,
                flow_ns: flow.flowNs,
                flow_nome: flow.flowNome || undefined,
                tag_manychat_id: flow.tagId ?? undefined,
                tag_manychat_nome: flow.tagNome || undefined,
              }
            : {
                tipo: "webhook",
                webhook_url: flow.webhookUrl,
                flow_nome: flow.flowNome || undefined,
              }

        const res = await fetch(`/api/admin/webhooks/${webhookId}/flows`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(body),
        })
        if (res.ok) {
          successCount++
        } else {
          const data = await res.json()
          const label = flow.tipo === "manychat" ? flow.flowNs : flow.webhookUrl
          toast.error(`Erro em "${label}": ${data.message || "falha"}`)
          failCount++
        }
      } catch {
        const label = flow.tipo === "manychat" ? flow.flowNs : flow.webhookUrl
        toast.error(`Erro de conexão ao salvar "${label}"`)
        failCount++
      }
    }

    setSaving(false)

    if (successCount > 0) {
      toast.success(`${successCount} flow${successCount !== 1 ? "s" : ""} adicionado${successCount !== 1 ? "s" : ""} com sucesso.`)
      onSuccess()
    }
    if (failCount === 0) onClose()
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const selectedConta = contas.find((c) => c.id === contaId)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Flow{pendingFlows.length > 0 ? `s (${pendingFlows.length} na lista)` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* Tipo de flow */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setTipo("manychat"); resetForm() }}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                tipo === "manychat"
                  ? "bg-[#0F2318] border-[#25D366] text-[#25D366]"
                  : "bg-[#111118] border-[#1E1E2A] text-[#5A5A72] hover:border-[#3F3F58]"
              }`}
            >
              Manychat
            </button>
            <button
              type="button"
              onClick={() => { setTipo("webhook"); resetForm() }}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                tipo === "webhook"
                  ? "bg-[#111827] border-[#6366F1] text-[#6366F1]"
                  : "bg-[#111118] border-[#1E1E2A] text-[#5A5A72] hover:border-[#3F3F58]"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                Webhook externo
              </span>
            </button>
          </div>

          {tipo === "manychat" ? (
            <>
              {/* Conta Manychat */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#C4C4D4] flex items-center gap-1.5">
                  Conta Manychat <span className="text-[#F87171]">*</span>
                  <FieldInfo title="Conta Manychat">
                    <p>Selecione a conta Manychat vinculada a este cliente. Apenas contas ativas deste cliente são exibidas.</p>
                  </FieldInfo>
                </label>
                <SearchableSelect
                  options={contas}
                  value={contaId}
                  onChange={(v) => { setContaId(v); setErrors((e) => ({ ...e, conta: "" })) }}
                  getKey={(c) => c.id}
                  getLabel={(c) => `${c.nome}${c.page_name ? ` — ${c.page_name}` : ""}`}
                  placeholder={loadingContas ? "Carregando contas…" : contas.length === 0 ? "Nenhuma conta ativa" : "Selecione uma conta…"}
                  searchPlaceholder="Buscar conta…"
                  loading={loadingContas}
                  error={errors.conta}
                />
              </div>

              {/* Flow NS */}
              <Input
                label="Flow NS"
                placeholder="Ex: content20210501abc123..."
                value={flowNs}
                onChange={(e) => { setFlowNs(e.target.value); setErrors((e2) => ({ ...e2, flow_ns: "" })) }}
                error={errors.flow_ns}
                helperText="Automação → Flows → clique no flow → copie o NS da URL"
                required
              />

              {/* Nome do Flow */}
              <Input
                label="Nome do Flow (opcional)"
                placeholder="Ex: [MAR26] PRINCESA POP - BOAS VINDAS"
                value={flowNome}
                onChange={(e) => setFlowNome(e.target.value)}
              />

              {/* Tag de entrada */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[#C4C4D4] flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#A78BFA]" />
                  Tag &ldquo;entrou no grupo&rdquo; <span className="text-[#F87171]">*</span>
                  {loadingTags && <Loader2 className="w-3 h-3 animate-spin text-[#25D366]" />}
                  {contaId && !loadingTags && tags.length > 0 && (
                    <button
                      type="button"
                      onClick={() => fetchTags(contaId)}
                      className="ml-auto text-[#3F3F58] hover:text-[#25D366] transition-colors"
                      title="Atualizar tags"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                  <FieldInfo title="Tag de entrada no grupo">
                    <p>Esta tag Manychat será aplicada ao subscriber quando o lead entrar no grupo de WhatsApp.</p>
                    <p className="mt-1">Selecione uma tag existente ou crie uma nova abaixo. A tag é usada para criar condicionais nos flows Manychat.</p>
                  </FieldInfo>
                </label>
                <SearchableSelect
                  options={tags}
                  value={tagId}
                  onChange={(v) => {
                    setTagId(v)
                    setTagNome(tags.find((t) => String(t.id) === v)?.name || "")
                    setErrors((e) => ({ ...e, tag: "" }))
                  }}
                  getKey={(t) => String(t.id)}
                  getLabel={(t) => t.name}
                  placeholder={
                    !contaId ? "Selecione a conta primeiro"
                    : loadingTags ? "Buscando tags…"
                    : tags.length === 0 ? "Nenhuma tag — crie abaixo"
                    : "Selecionar tag…"
                  }
                  searchPlaceholder="Buscar tag…"
                  loading={loadingTags}
                  disabled={!contaId || loadingTags}
                  error={errors.tag}
                />

                {/* Criar tag inline */}
                {contaId && !loadingTags && (
                  <div className="flex gap-2 mt-1">
                    <input
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateTag() } }}
                      placeholder="Nome da nova tag…"
                      className="flex-1 h-8 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-xs text-[#F1F1F3] placeholder-[#5A5A72] focus:outline-none focus:border-[#25D366] transition-colors"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs shrink-0"
                      disabled={!newTagName.trim() || creatingTag}
                      onClick={handleCreateTag}
                    >
                      {creatingTag ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Criar tag
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Webhook info block */}
              <div className="flex gap-3 p-3 bg-[#111118] border border-[#1E1E2A] rounded-lg text-xs text-[#8B8B9E]">
                <Link2 className="w-4 h-4 text-[#6366F1] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[#C4C4D4] font-medium">Webhook externo</p>
                  <p>Envia um HTTP POST com JSON ao sistema externo quando um lead é selecionado no rodízio.</p>
                  <p>Sem limite de conta — entre no rodízio normalmente. Retries automáticos em caso de falha.</p>
                </div>
              </div>

              {/* Webhook URL */}
              <Input
                label="URL do Webhook externo"
                placeholder="https://seu-sistema.com/webhook/lead"
                value={webhookUrl}
                onChange={(e) => { setWebhookUrl(e.target.value); setErrors((e2) => ({ ...e2, webhook_url: "" })); setTestResult(null) }}
                error={errors.webhook_url}
                helperText="HTTP POST com JSON: { lead_id, nome, telefone, email, campanha_id }"
                className="font-mono text-xs"
                required
              />

              {/* Test URL button + result */}
              {webhookUrl.trim() && (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-10 text-xs"
                    onClick={handleTestUrl}
                    disabled={testingUrl}
                  >
                    {testingUrl
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Testando…</>
                      : <><Send className="w-3.5 h-3.5 mr-1.5" /> Enviar Teste</>
                    }
                  </Button>
                  {testResult && (
                    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                      testResult.ok
                        ? "bg-[#0F2318] border border-[#25D366] text-[#25D366]"
                        : "bg-[#1C0E0E] border border-[#F87171] text-[#F87171]"
                    }`}>
                      {testResult.ok
                        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        : <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      }
                      <span>
                        {testResult.ok
                          ? `Sucesso (HTTP ${testResult.status}) — URL ativa e respondendo.`
                          : testResult.error || `Erro HTTP ${testResult.status}`
                        }
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Nome do Flow (opcional) */}
              <Input
                label="Nome do destino (opcional)"
                placeholder="Ex: ActiveCampaign, RD Station, Make..."
                value={flowNome}
                onChange={(e) => setFlowNome(e.target.value)}
              />
            </>
          )}

          {/* Add to list button */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleAddToPending}
            disabled={loadingContas}
          >
            <Plus className="w-4 h-4" />
            Adicionar à lista
          </Button>

          {/* Pending flows list */}
          {pendingFlows.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#5A5A72] uppercase tracking-widest">
                Flows a salvar ({pendingFlows.length})
              </p>
              {pendingFlows.map((f, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 bg-[#111118] border border-[#1E1E2A] rounded-lg"
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    {f.tipo === "manychat" ? (
                      <>
                        <p className="text-sm text-[#F1F1F3] font-medium truncate">{f.flowNome || f.flowNs}</p>
                        {f.flowNome && (
                          <p className="text-xs text-[#5A5A72] font-mono truncate">{f.flowNs}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-[#8B8B9E] flex-wrap">
                          <span className="truncate">{f.contaNome}</span>
                          {f.tagNome && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-1 text-[#A78BFA]">
                                <Tag className="w-3 h-3" />
                                {f.tagNome}
                              </span>
                            </>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-[#F1F1F3] font-medium truncate flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-[#6366F1] shrink-0" />
                          {f.flowNome || "Webhook externo"}
                        </p>
                        <p className="text-xs text-[#5A5A72] font-mono truncate">{f.webhookUrl}</p>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingFlows((prev) => prev.filter((_, j) => j !== i))}
                    className="w-6 h-6 flex items-center justify-center text-[#3F3F58] hover:text-[#F87171] transition-colors shrink-0 mt-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Validation summary when list is empty */}
          {pendingFlows.length === 0 && (tipo === "manychat" ? selectedConta : webhookUrl) && (
            <div className="flex items-center gap-2 text-xs text-[#5A5A72] bg-[#111118] border border-[#1E1E2A] rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366]" />
              Preencha os campos e clique em &ldquo;Adicionar à lista&rdquo; para continuar
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={pendingFlows.length === 0}
          >
            Salvar {pendingFlows.length > 0 ? `${pendingFlows.length} flow${pendingFlows.length !== 1 ? "s" : ""}` : "flow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
