"use client"

import React, { useState, useCallback } from "react"
import Link from "next/link"
import {
  MessageSquare, ExternalLink, Plus, ChevronDown, ChevronRight,
  Building2, Tag, Pencil, Trash2, Loader2, Copy, CheckCircle2, XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { type CampanhaData, type GrupoMonitoramento, fmtDt } from "./types"

interface EntradaRow {
  id: string
  telefone: string
  nome_whatsapp: string | null
  entrou_at: string
  tag_aplicada: boolean
}

interface GruposSectionProps {
  campanha: CampanhaData
  accessToken: string | null
  canWrite: boolean
  grupos: GrupoMonitoramento[]
  loadingGrupos: boolean
  onDeleteGrupo: (grupo: GrupoMonitoramento) => void
  deletingGrupo: string | null
  onEditGrupo: (grupo: GrupoMonitoramento) => void
  onRefresh: () => void
}

export function GruposSection({
  campanha,
  accessToken,
  canWrite,
  grupos,
  loadingGrupos,
  onDeleteGrupo,
  deletingGrupo,
  onEditGrupo,
  onRefresh,
}: GruposSectionProps) {
  const [expandedGrupo, setExpandedGrupo] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Entradas lazy-load state
  const [loadingEntradas, setLoadingEntradas] = useState(false)
  const [entradas, setEntradas] = useState<EntradaRow[]>([])
  const [entradasGrupoId, setEntradasGrupoId] = useState<string | null>(null)

  // Contas sub-section expanded state (per grupo)
  const [contasExpanded, setContasExpanded] = useState<string | null>(null)

  const fetchEntradas = useCallback(async (grupo: GrupoMonitoramento) => {
    if (!accessToken || !grupo.grupo_wa_id) return
    setLoadingEntradas(true)
    setEntradasGrupoId(grupo.id)
    try {
      const res = await fetch(
        `/api/admin/zapi/instancias/${grupo.instancia.id}/entradas?grupo_id=${grupo.id}&per_page=5`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      const data = await res.json()
      setEntradas(data.entradas || [])
    } catch {
      setEntradas([])
    } finally {
      setLoadingEntradas(false)
    }
  }, [accessToken])

  function handleToggleExpand(grupo: GrupoMonitoramento) {
    if (expandedGrupo === grupo.id) {
      setExpandedGrupo(null)
      setEntradasGrupoId(null)
      setEntradas([])
      setContasExpanded(null)
      return
    }
    setExpandedGrupo(grupo.id)
    setContasExpanded(null)
    if (grupo.grupo_wa_id) {
      fetchEntradas(grupo)
    } else {
      setEntradasGrupoId(null)
      setEntradas([])
    }
  }

  function handleCopyWaId(waId: string) {
    navigator.clipboard.writeText(waId)
    setCopiedId(waId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (!campanha?.instancia_zapi) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          Grupos WhatsApp{grupos.length > 0 && <span className="text-[#3F3F58] normal-case">({grupos.length})</span>}
        </p>
        <Link
          href={`/admin/zapi/${campanha.instancia_zapi.id}`}
          className="text-xs text-[#25D366] hover:text-[#1DB954] flex items-center gap-1 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Gerenciar na instância
        </Link>
      </div>

      {loadingGrupos ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-4 h-4 border-2 border-[#25D366] border-t-transparent rounded-full" />
        </div>
      ) : grupos.length === 0 ? (
        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl flex flex-col items-center justify-center py-8 gap-2">
          <MessageSquare className="w-5 h-5 text-[#3F3F58]" />
          <p className="text-[#5A5A72] text-sm">Nenhum grupo monitorado nesta campanha</p>
          <Link
            href={`/admin/zapi/${campanha.instancia_zapi.id}`}
            className="text-xs text-[#25D366] hover:text-[#1DB954] flex items-center gap-1 mt-1 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Adicionar grupo na instância Z-API
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {grupos.map((g) => {
            const expanded = expandedGrupo === g.id
            const contasExibir = g.contas_monitoramento.length > 0
              ? g.contas_monitoramento
              : [{ conta_manychat: g.conta_manychat, tag_manychat_id: 0, tag_manychat_nome: g.tag_manychat_nome, conta_manychat_id: g.conta_manychat.id }]
            return (
              <div key={g.id} className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
                {/* Header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#1C1C28] transition-colors"
                  onClick={() => handleToggleExpand(g)}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${g.status === "ativo" ? "bg-[#25D366]" : "bg-[#3F3F58]"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[#EEEEF5] text-sm font-medium truncate">{g.nome_filtro}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-[#5A5A72] text-xs flex items-center gap-1">
                        <Building2 className="w-2.5 h-2.5" />
                        {g.conta_manychat.nome}
                      </span>
                      <span className="text-[#5A5A72] text-xs flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5" />
                        {g.tag_manychat_nome}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right mr-1">
                    <p className="text-[#EEEEF5] text-sm font-bold">{g._count.entradas}</p>
                    <p className="text-[#3F3F58] text-[10px] uppercase">entradas</p>
                  </div>
                  {expanded ? <ChevronDown className="w-4 h-4 text-[#5A5A72] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[#5A5A72] shrink-0" />}
                </div>

                {/* Expanded area */}
                {expanded && (
                  <div className="border-t border-[#1E1E2A] px-4 py-3 space-y-4">
                    {/* 1. Group Info */}
                    <div className="space-y-2 text-xs">
                      {/* grupo_wa_id */}
                      <div className="flex items-center gap-2">
                        <span className="text-[#8B8B9E]">ID Z-API:</span>
                        {g.grupo_wa_id ? (
                          <button
                            type="button"
                            onClick={() => handleCopyWaId(g.grupo_wa_id!)}
                            className="flex items-center gap-1.5 text-[#EEEEF5] font-mono hover:text-[#25D366] transition-colors"
                            title="Copiar ID"
                          >
                            {g.grupo_wa_id}
                            {copiedId === g.grupo_wa_id ? (
                              <CheckCircle2 className="w-3 h-3 text-[#25D366]" />
                            ) : (
                              <Copy className="w-3 h-3 text-[#5A5A72]" />
                            )}
                          </button>
                        ) : (
                          <span className="text-[#5A5A72] italic">Aguardando primeiro match</span>
                        )}
                      </div>

                      {/* auto_expand + status badges */}
                      <div className="flex items-center gap-2">
                        {g.auto_expand ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#25D366]/15 text-[#25D366]">
                            Auto-expand
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#3F3F58]/30 text-[#8B8B9E]">
                            Manual
                          </span>
                        )}
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          g.status === "ativo"
                            ? "bg-[#25D366]/15 text-[#25D366]"
                            : "bg-[#3F3F58]/30 text-[#8B8B9E]"
                        }`}>
                          {g.status === "ativo" ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </div>

                    {/* 2. Recent Entries */}
                    <div className="space-y-2">
                      <p className="text-[#5A5A72] text-[10px] uppercase tracking-wider font-semibold">
                        Entradas recentes
                      </p>
                      {!g.grupo_wa_id ? (
                        <p className="text-xs text-[#5A5A72] italic">
                          Grupo ainda não detectado — entradas aparecerão após a primeira detecção
                        </p>
                      ) : loadingEntradas && entradasGrupoId === g.id ? (
                        <div className="flex items-center gap-2 py-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5A5A72]" />
                          <span className="text-xs text-[#5A5A72]">Carregando...</span>
                        </div>
                      ) : entradasGrupoId === g.id && entradas.length === 0 ? (
                        <p className="text-xs text-[#5A5A72] italic">Nenhuma entrada registrada</p>
                      ) : entradasGrupoId === g.id ? (
                        <div className="space-y-1">
                          {entradas.map((e) => (
                            <div key={e.id} className="flex items-center gap-3 py-1 text-xs">
                              <span className="font-mono text-[#EEEEF5] min-w-[100px]">{e.telefone}</span>
                              <span className="text-[#8B8B9E] flex-1 truncate">{e.nome_whatsapp || "—"}</span>
                              <span className="text-[#5A5A72] shrink-0">{fmtDt(e.entrou_at) || "—"}</span>
                              {e.tag_aplicada ? (
                                <span title="Tag aplicada"><CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] shrink-0" /></span>
                              ) : (
                                <span title="Tag não aplicada"><XCircle className="w-3.5 h-3.5 text-[#F87171] shrink-0" /></span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {/* 3. Monitored Accounts — collapsible sub-section */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setContasExpanded(contasExpanded === g.id ? null : g.id)}
                        className="flex items-center gap-1 text-xs text-[#8B8B9E] hover:text-[#EEEEF5] transition-colors"
                      >
                        {contasExpanded === g.id ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                        <span>{contasExibir.length} {contasExibir.length === 1 ? "conta monitorada" : "contas monitoradas"}</span>
                      </button>
                      {contasExpanded === g.id && (
                        <div className="mt-2 space-y-1.5 pl-4 text-xs text-[#8B8B9E]">
                          {contasExibir.map((cm, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Building2 className="w-3 h-3 shrink-0" />
                              <span>{cm.conta_manychat.nome}</span>
                              <Tag className="w-3 h-3 shrink-0 ml-1" />
                              <span className="text-[#EEEEF5]">{cm.tag_manychat_nome}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 4. Action Buttons */}
                    {canWrite && (
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); onEditGrupo(g) }}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1" />Editar
                        </Button>
                        <button
                          type="button"
                          onClick={() => onDeleteGrupo(g)}
                          disabled={deletingGrupo === g.id}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#3F3F58] hover:text-[#F87171] hover:bg-[#F87171]/10 transition-all disabled:opacity-50"
                        >
                          {deletingGrupo === g.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
