"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Plus, Trash2, Loader2, CheckCircle2, RefreshCw, Tag,
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

interface PendingFlow {
  contaId: string
  contaNome: string
  flowNs: string
  flowNome: string
  tagId: number | null
  tagNome: string
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
  // Contas
  const [contas, setContas] = useState<Conta[]>([])
  const [loadingContas, setLoadingContas] = useState(false)

  // Form fields
  const [contaId, setContaId] = useState("")
  const [flowNs, setFlowNs] = useState("")
  const [flowNome, setFlowNome] = useState("")

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

  // ── Reset form ──────────────────────────────────────────────────────────────

  function resetForm() {
    setContaId(""); setFlowNs(""); setFlowNome("")
    setTags([]); setTagId(""); setTagNome(""); setNewTagName("")
    setErrors({})
  }

  // ── Add to pending list ─────────────────────────────────────────────────────

  function handleAddToPending() {
    const errs: Record<string, string> = {}
    if (!contaId) errs.conta = "Selecione uma conta Manychat"
    if (!flowNs.trim()) errs.flow_ns = "Flow NS é obrigatório"
    if (!tagId) errs.tag = "Selecione a tag de entrada no grupo"

    // Check for duplicates in pending list
    if (contaId && flowNs.trim()) {
      const dup = pendingFlows.find(
        (p) => p.contaId === contaId && p.flowNs === flowNs.trim()
      )
      if (dup) errs.flow_ns = "Este Flow NS já foi adicionado para esta conta"
    }

    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const conta = contas.find((c) => c.id === contaId)
    setPendingFlows((prev) => [
      ...prev,
      {
        contaId,
        contaNome: conta ? `${conta.nome}${conta.page_name ? ` — ${conta.page_name}` : ""}` : contaId,
        flowNs: flowNs.trim(),
        flowNome: flowNome.trim(),
        tagId: tagId ? Number(tagId) : null,
        tagNome,
      },
    ])
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
        const res = await fetch(`/api/admin/webhooks/${webhookId}/flows`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            conta_id: flow.contaId,
            flow_ns: flow.flowNs,
            flow_nome: flow.flowNome || undefined,
            tag_manychat_id: flow.tagId ?? undefined,
            tag_manychat_nome: flow.tagNome || undefined,
          }),
        })
        if (res.ok) {
          successCount++
        } else {
          const data = await res.json()
          toast.error(`Erro em "${flow.flowNs}": ${data.message || "falha"}`)
          failCount++
        }
      } catch {
        toast.error(`Erro de conexão ao salvar "${flow.flowNs}"`)
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
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Flow{pendingFlows.length > 0 ? `s (${pendingFlows.length} na lista)` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">

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
          {pendingFlows.length === 0 && selectedConta && (
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
