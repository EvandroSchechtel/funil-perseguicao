"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Loader2, Copy, Check, AlertTriangle, Tag, Building2, RefreshCw, Info,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type GrupoMonitoramento } from "@/components/admin/campanha/types"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ManychatTag {
  id: number
  name: string
}

interface ContaTagState {
  conta_manychat_id: string
  conta_nome: string
  tag_manychat_id: number
  tag_manychat_nome: string
  tags: ManychatTag[]
  loadingTags: boolean
}

export interface EditGrupoDialogProps {
  open: boolean
  grupo: GrupoMonitoramento | null
  accessToken: string | null
  onClose: () => void
  onSuccess: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EditGrupoDialog({
  open, grupo, accessToken, onClose, onSuccess,
}: EditGrupoDialogProps) {
  // Form fields
  const [nomeFiltro, setNomeFiltro] = useState("")
  const [grupoWaId, setGrupoWaId] = useState("")
  const [autoExpand, setAutoExpand] = useState(true)
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo")

  // Tag per conta
  const [contasTags, setContasTags] = useState<ContaTagState[]>([])

  // UI states
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ── Initialize form when grupo changes ──────────────────────────────────────

  useEffect(() => {
    if (open && grupo) {
      setNomeFiltro(grupo.nome_filtro)
      setGrupoWaId(grupo.grupo_wa_id || "")
      setAutoExpand(grupo.auto_expand ?? true)
      setStatus(grupo.status === "inativo" ? "inativo" : "ativo")
      setErrors({})
      setCopied(false)

      // Initialize contas from contas_monitoramento, fallback to single conta
      const contas = grupo.contas_monitoramento.length > 0
        ? grupo.contas_monitoramento.map((cm) => ({
            conta_manychat_id: cm.conta_manychat_id,
            conta_nome: cm.conta_manychat.nome,
            tag_manychat_id: cm.tag_manychat_id,
            tag_manychat_nome: cm.tag_manychat_nome,
            tags: [],
            loadingTags: false,
          }))
        : [{
            conta_manychat_id: grupo.conta_manychat.id,
            conta_nome: grupo.conta_manychat.nome,
            tag_manychat_id: 0,
            tag_manychat_nome: grupo.tag_manychat_nome,
            tags: [],
            loadingTags: false,
          }]
      setContasTags(contas)
    }
  }, [open, grupo])

  // ── Fetch tags for a specific conta ─────────────────────────────────────────

  const fetchTagsForConta = useCallback(async (contaId: string) => {
    if (!accessToken || !contaId) return
    setContasTags((prev) =>
      prev.map((c) => c.conta_manychat_id === contaId ? { ...c, loadingTags: true } : c)
    )
    try {
      const res = await fetch(`/api/admin/contas/${contaId}/tags`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        toast.error("Erro ao buscar tags.")
        return
      }
      const data = await res.json()
      const tags: ManychatTag[] = data.data?.tags || data.tags || []
      setContasTags((prev) =>
        prev.map((c) => c.conta_manychat_id === contaId ? { ...c, tags, loadingTags: false } : c)
      )
    } catch {
      toast.error("Erro de conexão ao buscar tags.")
      setContasTags((prev) =>
        prev.map((c) => c.conta_manychat_id === contaId ? { ...c, loadingTags: false } : c)
      )
    }
  }, [accessToken])

  // Fetch tags for all contas on mount
  useEffect(() => {
    if (open && contasTags.length > 0 && contasTags[0].tags.length === 0 && !contasTags[0].loadingTags) {
      contasTags.forEach((c) => fetchTagsForConta(c.conta_manychat_id))
    }
  }, [open, contasTags.length, fetchTagsForConta]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Copy grupo_wa_id to clipboard ───────────────────────────────────────────

  function handleCopy() {
    if (!grupoWaId) return
    navigator.clipboard.writeText(grupoWaId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Update tag for a conta ──────────────────────────────────────────────────

  function handleTagChange(contaId: string, tagIdStr: string) {
    setContasTags((prev) =>
      prev.map((c) => {
        if (c.conta_manychat_id !== contaId) return c
        const tag = c.tags.find((t) => String(t.id) === tagIdStr)
        return {
          ...c,
          tag_manychat_id: tag ? tag.id : c.tag_manychat_id,
          tag_manychat_nome: tag ? tag.name : c.tag_manychat_nome,
        }
      })
    )
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!grupo || !accessToken) return

    // Validation
    const errs: Record<string, string> = {}
    if (!nomeFiltro.trim()) errs.nome_filtro = "Nome do filtro obrigatório"
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSaving(true)
    try {
      // Build the primary tag from first conta (backward compat)
      const primaryConta = contasTags[0]

      const body: Record<string, unknown> = {
        nome_filtro: nomeFiltro.trim(),
        grupo_wa_id: grupoWaId.trim() || null,
        auto_expand: autoExpand,
        status,
      }

      // Include tag fields if they changed
      if (primaryConta) {
        body.tag_manychat_id = primaryConta.tag_manychat_id
        body.tag_manychat_nome = primaryConta.tag_manychat_nome
      }

      const res = await fetch(
        `/api/admin/zapi/instancias/${grupo.instancia.id}/grupos/${grupo.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(body),
        }
      )
      const data = await res.json()

      if (res.ok) {
        toast.success(data.message || "Grupo atualizado.")
        onSuccess()
        onClose()
      } else {
        toast.error(data.message || "Erro ao atualizar grupo.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!grupo) return null

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Grupo</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">

          {/* Nome filtro */}
          <Input
            label="Nome do filtro"
            placeholder="Ex: PRINCESA POP"
            value={nomeFiltro}
            onChange={(e) => { setNomeFiltro(e.target.value); setErrors((prev) => ({ ...prev, nome_filtro: "" })) }}
            error={errors.nome_filtro}
            required
          />

          {/* Grupo WA ID */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#F1F1F3]">
              ID do grupo WhatsApp
            </label>
            <div className="flex gap-2">
              <input
                value={grupoWaId}
                onChange={(e) => setGrupoWaId(e.target.value)}
                placeholder="Preenchido automaticamente"
                className="flex-1 h-10 rounded-lg border border-[#1E1E2A] bg-[#111118] px-3 py-2 text-sm text-[#F1F1F3] placeholder:text-[#5A5A72] font-mono focus:border-[#25D366] focus:outline-none focus:shadow-[0_0_0_2px_rgba(37,211,102,0.15)] transition-colors"
              />
              <button
                type="button"
                onClick={handleCopy}
                disabled={!grupoWaId}
                className="h-10 w-10 flex items-center justify-center rounded-lg border border-[#1E1E2A] bg-[#111118] text-[#8B8B9E] hover:text-[#25D366] hover:border-[#25D366] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                title="Copiar ID"
              >
                {copied
                  ? <Check className="w-4 h-4 text-[#25D366]" />
                  : <Copy className="w-4 h-4" />
                }
              </button>
            </div>
            <p className="text-xs text-[#5A5A72]">
              Identificador Z-API do grupo. Geralmente preenchido automaticamente.
            </p>
          </div>

          {/* Auto-expand toggle */}
          <div className="flex items-center justify-between gap-3 p-3 bg-[#111118] border border-[#1E1E2A] rounded-lg">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-[#F1F1F3]">Auto-expand</p>
                <button
                  type="button"
                  className="w-4 h-4 rounded-full border border-[#3F3F58] text-[#3F3F58] hover:border-[#25D366] hover:text-[#25D366] transition-colors flex items-center justify-center text-[9px] font-bold shrink-0"
                  title="Quando ativado, grupos com nomes similares são vinculados automaticamente"
                  onClick={() => toast.info("Quando ativado, grupos com nomes similares são vinculados automaticamente.")}
                >
                  ?
                </button>
              </div>
              <p className="text-xs text-[#5A5A72] mt-0.5">
                Vincular automaticamente grupos com nomes similares
              </p>
            </div>
            <Switch
              checked={autoExpand}
              onCheckedChange={setAutoExpand}
            />
          </div>

          {/* Status toggle */}
          <div className="flex items-center justify-between gap-3 p-3 bg-[#111118] border border-[#1E1E2A] rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#F1F1F3]">Status</p>
              <p className="text-xs text-[#5A5A72] mt-0.5">
                {status === "ativo" ? "Grupo ativo — monitorando entradas" : "Grupo inativo — entradas não monitoradas"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${status === "ativo" ? "text-[#25D366]" : "text-[#8B8B9E]"}`}>
                {status === "ativo" ? "Ativo" : "Inativo"}
              </span>
              <Switch
                checked={status === "ativo"}
                onCheckedChange={(checked) => setStatus(checked ? "ativo" : "inativo")}
              />
            </div>
          </div>

          {/* Warning when inativo */}
          {status === "inativo" && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2 bg-[#1C1508] border border-[#F59E0B]/30 text-xs text-[#F59E0B]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Entradas neste grupo n&atilde;o ser&atilde;o monitoradas enquanto estiver inativo.</span>
            </div>
          )}

          {/* Tags per conta */}
          {contasTags.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Tags por conta Manychat
              </p>
              {contasTags.map((ct) => (
                <div
                  key={ct.conta_manychat_id}
                  className="p-3 bg-[#111118] border border-[#1E1E2A] rounded-lg space-y-2"
                >
                  <div className="flex items-center gap-2 text-sm text-[#F1F1F3]">
                    <Building2 className="w-3.5 h-3.5 text-[#8B8B9E] shrink-0" />
                    <span className="font-medium truncate">{ct.conta_nome}</span>
                    {ct.loadingTags && <Loader2 className="w-3 h-3 animate-spin text-[#25D366] ml-auto" />}
                    {!ct.loadingTags && ct.tags.length > 0 && (
                      <button
                        type="button"
                        onClick={() => fetchTagsForConta(ct.conta_manychat_id)}
                        className="ml-auto text-[#3F3F58] hover:text-[#25D366] transition-colors"
                        title="Atualizar tags"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {ct.loadingTags ? (
                    <div className="flex items-center gap-2 text-xs text-[#5A5A72]">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Buscando tags...
                    </div>
                  ) : ct.tags.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-[#5A5A72]">
                      <Info className="w-3 h-3" />
                      <span>
                        Tag atual: <span className="text-[#F1F1F3]">{ct.tag_manychat_nome}</span>
                        <span className="ml-1 text-[#3F3F58]">(tags n&atilde;o carregadas)</span>
                      </span>
                    </div>
                  ) : (
                    <Select
                      value={String(ct.tag_manychat_id)}
                      onValueChange={(v) => handleTagChange(ct.conta_manychat_id, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar tag..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ct.tags.map((tag) => (
                          <SelectItem key={tag.id} value={String(tag.id)}>
                            {tag.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
