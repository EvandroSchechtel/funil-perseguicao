"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Loader2, Copy, Check, Tag, RefreshCw, Link2, Send, CheckCircle2, XCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchableSelect } from "@/components/admin/AddGrupoForm"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ManychatTag {
  id: number
  name: string
}

export interface EditableFlow {
  id: string
  tipo: string
  flow_ns: string | null
  flow_nome: string | null
  webhook_url: string | null
  ordem: number
  status: "ativo" | "inativo"
  limite_diario: number | null
  tag_manychat_id: number | null
  tag_manychat_nome: string | null
  conta: { id: string; nome: string; page_name: string | null } | null
}

export interface EditFlowDialogProps {
  open: boolean
  flow: EditableFlow | null
  webhookId: string
  accessToken: string | null
  onClose: () => void
  onSuccess: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EditFlowDialog({
  open, flow, webhookId, accessToken, onClose, onSuccess,
}: EditFlowDialogProps) {
  const [flowNome, setFlowNome] = useState("")
  const [flowNs, setFlowNs] = useState("")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [ordem, setOrdem] = useState(0)
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo")
  const [limiteDiario, setLimiteDiario] = useState<number | null>(null)
  const [tagId, setTagId] = useState("")
  const [tagNome, setTagNome] = useState("")

  const [tags, setTags] = useState<ManychatTag[]>([])
  const [loadingTags, setLoadingTags] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  // URL test
  const [testingUrl, setTestingUrl] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; status: number | null; error: string | null } | null>(null)

  // Populate fields when flow changes
  useEffect(() => {
    if (flow) {
      setFlowNome(flow.flow_nome ?? "")
      setFlowNs(flow.flow_ns ?? "")
      setWebhookUrl(flow.webhook_url ?? "")
      setOrdem(flow.ordem)
      setStatus(flow.status)
      setLimiteDiario(flow.limite_diario)
      setTagId(flow.tag_manychat_id ? String(flow.tag_manychat_id) : "")
      setTagNome(flow.tag_manychat_nome ?? "")
      setErrors({})
      setTestResult(null)
    }
  }, [flow])

  const fetchTags = useCallback(async (contaId: string) => {
    if (!contaId || !accessToken) return
    setLoadingTags(true)
    try {
      const res = await fetch(`/api/admin/contas/${contaId}/tags`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setTags(data.data?.tags || data.tags || [])
    } catch { /* silent */ } finally {
      setLoadingTags(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (open && flow?.tipo === "manychat" && flow.conta?.id) {
      fetchTags(flow.conta.id)
    } else {
      setTags([])
    }
  }, [open, flow, fetchTags])

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
    } finally {
      setTestingUrl(false)
    }
  }

  async function handleSave() {
    if (!flow) return
    const errs: Record<string, string> = {}

    if (flow.tipo === "webhook") {
      if (!webhookUrl.trim()) {
        errs.webhook_url = "URL é obrigatória"
      } else {
        try { new URL(webhookUrl.trim()) } catch { errs.webhook_url = "URL inválida" }
      }
    }

    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        flow_nome: flowNome.trim() || null,
        ordem,
        status,
        limite_diario: limiteDiario,
      }

      if (flow.tipo === "manychat") {
        body.tag_manychat_id = tagId ? Number(tagId) : null
        body.tag_manychat_nome = tagNome || null
      } else {
        body.webhook_url = webhookUrl.trim()
      }

      const res = await fetch(`/api/admin/webhooks/${webhookId}/flows/${flow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Flow atualizado com sucesso.")
        onSuccess()
        onClose()
      } else {
        toast.error(data.message || "Erro ao atualizar flow.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setSaving(false)
    }
  }

  function handleCopyNs() {
    if (!flowNs) return
    navigator.clipboard.writeText(flowNs).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!flow) return null

  const isManychat = flow.tipo === "manychat"

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isManychat ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#25D366]" />
                Editar Flow Manychat
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4 text-[#6366F1]" />
                Editar Webhook Externo
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">

          {/* Manychat: Flow NS readonly */}
          {isManychat && flowNs && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-[#F1F1F3]">Flow NS</label>
              <div className="flex gap-2">
                <div className="flex-1 flex h-10 items-center px-3 rounded-lg border border-[#1E1E2A] bg-[#0D0D12] text-xs text-[#5A5A72] font-mono truncate">
                  {flowNs}
                </div>
                <button
                  type="button"
                  onClick={handleCopyNs}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-[#1E1E2A] bg-[#111118] text-[#5A5A72] hover:text-[#F1F1F3] transition-colors shrink-0"
                  title="Copiar NS"
                >
                  {copied ? <Check className="w-4 h-4 text-[#25D366]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-[#5A5A72]">O Flow NS não pode ser alterado — remova e adicione um novo flow se necessário.</p>
            </div>
          )}

          {/* Webhook: URL editável */}
          {!isManychat && (
            <>
              <Input
                label="URL do Webhook"
                placeholder="https://seu-sistema.com/webhook/lead"
                value={webhookUrl}
                onChange={(e) => { setWebhookUrl(e.target.value); setErrors((er) => ({ ...er, webhook_url: "" })); setTestResult(null) }}
                error={errors.webhook_url}
                className="font-mono text-xs"
                required
              />

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
                      ? <><Loader2 className="w-3 h-3 animate-spin mr-1.5" />Testando…</>
                      : <><Send className="w-3 h-3 mr-1.5" />Enviar Teste</>
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
            </>
          )}

          {/* Nome do flow */}
          <Input
            label={isManychat ? "Nome do Flow (opcional)" : "Nome do destino (opcional)"}
            placeholder={isManychat ? "Ex: [MAR26] PRINCESA POP - BOAS VINDAS" : "Ex: ActiveCampaign, RD Station, Make..."}
            value={flowNome}
            onChange={(e) => setFlowNome(e.target.value)}
          />

          {/* Manychat: tag */}
          {isManychat && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-[#F1F1F3] flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#A78BFA]" />
                Tag &ldquo;entrou no grupo&rdquo;
                {loadingTags && <Loader2 className="w-3 h-3 animate-spin text-[#25D366]" />}
                {flow.conta?.id && !loadingTags && tags.length > 0 && (
                  <button
                    type="button"
                    onClick={() => flow.conta?.id && fetchTags(flow.conta.id)}
                    className="ml-auto text-[#3F3F58] hover:text-[#25D366] transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </label>
              <SearchableSelect
                options={tags}
                value={tagId}
                onChange={(v) => {
                  setTagId(v)
                  setTagNome(tags.find((t) => String(t.id) === v)?.name || "")
                }}
                getKey={(t) => String(t.id)}
                getLabel={(t) => t.name}
                placeholder={
                  loadingTags ? "Buscando tags…"
                  : tags.length === 0 ? "Nenhuma tag disponível"
                  : "Selecionar tag…"
                }
                searchPlaceholder="Buscar tag…"
                loading={loadingTags}
              />
              {tagId && (
                <button
                  type="button"
                  onClick={() => { setTagId(""); setTagNome("") }}
                  className="text-xs text-[#5A5A72] hover:text-[#F87171] transition-colors"
                >
                  Remover tag
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Limite diário */}
            <Input
              label="Limite diário"
              type="number"
              min="1"
              placeholder="Sem limite"
              value={limiteDiario ?? ""}
              onChange={(e) => setLimiteDiario(e.target.value ? Number(e.target.value) : null)}
              helperText="Leads/dia — vazio = sem limite"
            />

            {/* Ordem */}
            <Input
              label="Ordem no rodízio"
              type="number"
              min="0"
              value={ordem}
              onChange={(e) => setOrdem(Number(e.target.value))}
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#F1F1F3]">Status</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStatus("ativo")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  status === "ativo"
                    ? "bg-[#0F2318] border-[#25D366] text-[#25D366]"
                    : "bg-[#111118] border-[#1E1E2A] text-[#5A5A72] hover:border-[#3F3F58]"
                }`}
              >
                Ativo
              </button>
              <button
                type="button"
                onClick={() => setStatus("inativo")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  status === "inativo"
                    ? "bg-[#1C1230] border-[#A78BFA] text-[#A78BFA]"
                    : "bg-[#111118] border-[#1E1E2A] text-[#5A5A72] hover:border-[#3F3F58]"
                }`}
              >
                Inativo
              </button>
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
