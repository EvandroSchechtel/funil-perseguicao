"use client"

import React, { useState, useCallback } from "react"
import {
  ChevronDown, ChevronRight, Megaphone, Building2, Tag,
  Copy, CheckCircle2, XCircle, Loader2, Pencil, Trash2, ArrowRight, ExternalLink, RefreshCw, AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { type ZApiGrupo, fmtDt } from "./types"

interface EntradaRow {
  id: string
  telefone: string
  nome_whatsapp: string | null
  entrou_at: string
  tag_aplicada: boolean
}

interface GrupoCardProps {
  grupo: ZApiGrupo
  instanciaId: string
  accessToken: string | null
  canWrite: boolean
  onEdit: (grupo: ZApiGrupo) => void
  onDelete: (grupo: ZApiGrupo) => void
  onViewEntradas: (grupoId: string) => void
  deleting?: boolean
}

export function GrupoCard({
  grupo, instanciaId, accessToken, canWrite, onEdit, onDelete, onViewEntradas, deleting,
}: GrupoCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [entries, setEntries] = useState<EntradaRow[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [entriesLoaded, setEntriesLoaded] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)

  const g = grupo

  // Compute accounts to display
  const contasExibir = g.contas_monitoramento.length > 0
    ? g.contas_monitoramento
    : g.conta_manychat
      ? [{ id: "primary", conta_manychat_id: g.conta_manychat.id, conta_manychat: g.conta_manychat, tag_manychat_id: g.tag_manychat_id, tag_manychat_nome: g.tag_manychat_nome }]
      : []

  const accountCount = Math.max(contasExibir.length, 1)

  const fetchEntries = useCallback(async () => {
    if (!accessToken || !g.grupo_wa_id) return
    setLoadingEntries(true)
    try {
      const res = await fetch(
        `/api/admin/zapi/instancias/${instanciaId}/entradas?grupo_id=${g.id}&per_page=5`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      const data = await res.json()
      setEntries(data.entradas || [])
      setEntriesLoaded(true)
    } catch {
      setEntries([])
      setEntriesLoaded(true)
    } finally {
      setLoadingEntries(false)
    }
  }, [accessToken, instanciaId, g.id, g.grupo_wa_id])

  async function handleReprocessTags() {
    if (!accessToken) return
    setReprocessing(true)
    try {
      // Call varredura endpoint for the parent campaign to re-tag entries
      const res = await fetch(`/api/admin/zapi/instancias/${instanciaId}/escanear-grupos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        toast.success("Tags reprocessadas. Atualizando entradas...")
        // Refresh entries after a small delay to let the backend process
        setTimeout(() => fetchEntries(), 1500)
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error((data as { message?: string }).message || "Erro ao reprocessar tags.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setReprocessing(false)
    }
  }

  function handleToggleExpand() {
    const willExpand = !expanded
    setExpanded(willExpand)
    if (willExpand && !entriesLoaded && g.grupo_wa_id) {
      fetchEntries()
    }
  }

  function handleCopyWaId() {
    if (!g.grupo_wa_id) return
    navigator.clipboard.writeText(g.grupo_wa_id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  return (
    <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-xl overflow-hidden shadow-[0_1px_12px_rgba(0,0,0,0.3)]">
      {/* Collapsed header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-[#121220] transition-colors"
        onClick={handleToggleExpand}
      >
        {/* Status dot */}
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${g.status === "ativo" ? "bg-[#25D366]" : "bg-[#3F3F58]"}`} />

        {/* Title + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[#EEEEF5] text-sm font-semibold truncate">{g.nome_filtro}</p>
            {/* Vinculado / Aguardando badge */}
            {g.grupo_wa_id ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#25D366]/15 text-[#25D366]">
                Vinculado
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F59E0B]/15 text-[#F59E0B]">
                Aguardando
              </span>
            )}
            {g.auto_expand && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#A78BFA]/15 text-[#A78BFA]">
                Auto-expand
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-[#5A5A72] text-xs flex items-center gap-1">
              <Megaphone className="w-2.5 h-2.5" />
              {g.campanha?.nome ?? "—"}
            </span>
            <span className="text-[#5A5A72] text-xs flex items-center gap-1">
              <Building2 className="w-2.5 h-2.5" />
              {accountCount} {accountCount === 1 ? "conta" : "contas"}
            </span>
          </div>
        </div>

        {/* Entry count */}
        <div className="shrink-0 text-right mr-1">
          <p className="text-[#EEEEF5] text-sm font-bold">{g._count?.entradas ?? 0}</p>
          <p className="text-[#3F3F58] text-[10px] uppercase tracking-wider">entradas</p>
        </div>

        {/* Expand chevron */}
        {expanded
          ? <ChevronDown className="w-4 h-4 text-[#5A5A72] shrink-0" />
          : <ChevronRight className="w-4 h-4 text-[#5A5A72] shrink-0" />
        }
      </div>

      {/* Expanded area */}
      {expanded && (
        <div className="border-t border-[#1C1C2C] px-5 py-4 space-y-5">
          {/* 1. Tagging Preview */}
          <div className="space-y-2">
            <p className="text-[#5A5A72] text-[10px] uppercase tracking-wider font-semibold">
              Quando um lead entra neste grupo
            </p>
            <div className="space-y-1.5 pl-1">
              {contasExibir.map((cm, i) => (
                <div key={cm.conta_manychat_id + "-" + i} className="flex items-center gap-2 text-xs">
                  <Building2 className="w-3 h-3 text-[#8B8B9E] shrink-0" />
                  <span className="text-[#9898B0]">{cm.conta_manychat.nome}</span>
                  <ArrowRight className="w-3 h-3 text-[#3F3F58] shrink-0" />
                  <Tag className="w-3 h-3 text-[#A78BFA] shrink-0" />
                  <span className="text-[#EEEEF5] font-medium">{cm.tag_manychat_nome}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Recent Entries */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[#5A5A72] text-[10px] uppercase tracking-wider font-semibold">
                Entradas recentes
              </p>
              {g.grupo_wa_id && entriesLoaded && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fetchEntries() }}
                  className="text-[10px] text-[#5A5A72] hover:text-[#25D366] flex items-center gap-1 transition-colors"
                  title="Atualizar entradas"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingEntries ? "animate-spin" : ""}`} />
                  Atualizar
                </button>
              )}
            </div>
            {!g.grupo_wa_id ? (
              <div className="flex items-center gap-2 py-2 px-3 bg-[#1A1500]/50 border border-[#F59E0B]/20 rounded-lg">
                <XCircle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                <p className="text-xs text-[#F59E0B]">
                  Grupo ainda não encontrado no WhatsApp — execute &quot;Escanear e Vincular&quot; para detectar
                </p>
              </div>
            ) : loadingEntries ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5A5A72]" />
                <span className="text-xs text-[#5A5A72]">Carregando entradas...</span>
              </div>
            ) : entries.length === 0 ? (
              <p className="text-xs text-[#5A5A72] italic">Nenhuma entrada registrada</p>
            ) : (
              <div className="space-y-1">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 py-1.5 text-xs">
                    <span className="font-mono text-[#EEEEF5] min-w-[100px]">{e.telefone}</span>
                    <span className="text-[#8B8B9E] flex-1 truncate">{e.nome_whatsapp || "—"}</span>
                    <span className="text-[#5A5A72] shrink-0">{fmtDt(e.entrou_at) || "—"}</span>
                    {e.tag_aplicada ? (
                      <span className="flex items-center gap-1 text-[#25D366] shrink-0" title="Tag aplicada com sucesso">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-medium">Tag OK</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[#F59E0B] shrink-0" title="Tag ainda não aplicada — subscriber pode não estar no Manychat">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-medium">Pendente</span>
                      </span>
                    )}
                  </div>
                ))}
                {/* Reprocess button when there are pending tags */}
                {entries.some((e) => !e.tag_aplicada) && canWrite && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full"
                    onClick={(e) => { e.stopPropagation(); handleReprocessTags() }}
                    loading={reprocessing}
                    disabled={reprocessing}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Reprocessar tags pendentes
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* 3. grupo_wa_id */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#8B8B9E]">ID Z-API:</span>
            {g.grupo_wa_id ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleCopyWaId() }}
                className="flex items-center gap-1.5 text-[#EEEEF5] font-mono hover:text-[#25D366] transition-colors"
                title="Copiar ID"
              >
                {g.grupo_wa_id}
                {copiedId ? (
                  <CheckCircle2 className="w-3 h-3 text-[#25D366]" />
                ) : (
                  <Copy className="w-3 h-3 text-[#5A5A72]" />
                )}
              </button>
            ) : (
              <span className="text-[#5A5A72] italic">Aguardando primeiro match</span>
            )}
          </div>

          {/* 4. Actions */}
          <div className="flex items-center gap-2 pt-1">
            {canWrite && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onEdit(g) }}
              >
                <Pencil className="w-3.5 h-3.5 mr-1" />Editar
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); onViewEntradas(g.id) }}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1" />Ver Entradas
            </Button>
            {canWrite && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(g) }}
                disabled={deleting}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#3F3F58] hover:text-[#F87171] hover:bg-[#F87171]/10 transition-all disabled:opacity-50 ml-auto"
              >
                {deleting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
