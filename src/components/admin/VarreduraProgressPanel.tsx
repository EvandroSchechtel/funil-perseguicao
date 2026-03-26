"use client"

import React, { useState } from "react"
import { X, ChevronUp, ChevronDown, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle, Eye } from "lucide-react"
import { useVarredura, type GrupoProgress } from "@/contexts/VarreduraContext"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"

// ── Status icon for each grupo ──────────────────────────────────────────────

function GrupoStatusIcon({ status }: { status: GrupoProgress["status"] }) {
  switch (status) {
    case "aguardando":
      return <Clock className="w-3.5 h-3.5 text-[#5A5A72]" />
    case "buscando":
      return <Loader2 className="w-3.5 h-3.5 text-[#60A5FA] animate-spin" />
    case "ok":
      return <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366]" />
    case "erro":
      return <XCircle className="w-3.5 h-3.5 text-[#F87171]" />
  }
}

function GrupoStatusText({ grupo }: { grupo: GrupoProgress }) {
  switch (grupo.status) {
    case "aguardando":
      return <span className="text-[#5A5A72]">Aguardando</span>
    case "buscando":
      return <span className="text-[#60A5FA]">Buscando membros...</span>
    case "ok":
      return (
        <span className="text-[#25D366]">
          {grupo.membros ?? 0} membros{grupo.tagsAplicadas ? `, ${grupo.tagsAplicadas} tags` : ""}
        </span>
      )
    case "erro":
      return <span className="text-[#F87171]">Erro ao buscar</span>
  }
}

// ── Result dialog ───────────────────────────────────────────────────────────

function ResultDialog({
  open,
  onClose,
  resultado,
}: {
  open: boolean
  onClose: () => void
  resultado: NonNullable<ReturnType<typeof useVarredura>["resultado"]>
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {resultado.erros === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-[#25D366]" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
            )}
            Varredura Concluida
          </DialogTitle>
          <DialogDescription>
            Resultado detalhado da verificacao de membros.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {resultado.aviso_24h && (
            <div className="flex items-start gap-2 p-3 bg-[#1A1500] border border-[#F59E0B]/30 rounded-lg text-xs text-[#F59E0B]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <p>{resultado.aviso_24h}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <KpiMini label="Grupos varridos" value={resultado.grupos_varridos} color="text-[#EEEEF5]" />
            <KpiMini label="Membros lidos" value={resultado.total_membros} color="text-[#EEEEF5]" />
            <KpiMini label="Leads encontrados" value={resultado.leads_encontrados} color="text-[#60A5FA]" />
            <KpiMini label="Tags aplicadas" value={resultado.tags_aplicadas} color="text-[#25D366]" />
            {resultado.ja_processados > 0 && (
              <KpiMini label="Ja processados" value={resultado.ja_processados} color="text-[#5A5A72]" />
            )}
            {resultado.grupos_sem_id > 0 && (
              <KpiMini label="Grupos sem ID WA" value={resultado.grupos_sem_id} color="text-[#F59E0B]" />
            )}
            {resultado.erros > 0 && (
              <KpiMini label="Erros" value={resultado.erros} color="text-[#F87171]" />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function KpiMini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[#0A0A12] border border-[#1C1C2C] rounded-lg p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[#5A5A72] text-[10px] uppercase tracking-wider mt-1">{label}</p>
    </div>
  )
}

// ── Close confirmation dialog ───────────────────────────────────────────────

function CloseConfirmDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
            Varredura em andamento
          </DialogTitle>
          <DialogDescription>
            A verificacao ainda esta em progresso. Fechar o painel nao interrompe a varredura no servidor, mas voce perdera o acompanhamento do progresso.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Fechar mesmo assim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Panel ──────────────────────────────────────────────────────────────

const MAX_VISIBLE_GRUPOS = 5

export function VarreduraProgressPanel() {
  const varredura = useVarredura()
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [showResultDialog, setShowResultDialog] = useState(false)

  // Don't render if nothing is happening and no result to show
  const isVisible = varredura.isRunning || varredura.resultado || varredura.error
  if (!isVisible) return null

  const {
    isRunning,
    campanhaNome,
    grupoStatuses,
    grupoTotal,
    gruposConcluidos,
    totalMembros,
    totalTags,
    totalErros,
    collapsed,
    resultado,
    error,
    dismiss,
    toggleCollapsed,
  } = varredura

  const progressPercent = grupoTotal > 0 ? Math.round((gruposConcluidos / grupoTotal) * 100) : 0
  const isComplete = !!resultado
  const isError = !!error && !resultado

  function handleClose() {
    if (isRunning) {
      setShowCloseConfirm(true)
    } else {
      dismiss()
    }
  }

  function handleConfirmClose() {
    setShowCloseConfirm(false)
    dismiss()
  }

  // Sort grupos: completed/error first, then in-progress, then waiting
  const sortedGrupos = [...grupoStatuses].sort((a, b) => {
    const order: Record<string, number> = { buscando: 0, ok: 1, erro: 2, aguardando: 3 }
    return (order[a.status] ?? 4) - (order[b.status] ?? 4)
  })

  const visibleGrupos = sortedGrupos.slice(0, MAX_VISIBLE_GRUPOS)
  const hiddenCount = Math.max(0, sortedGrupos.length - MAX_VISIBLE_GRUPOS)

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 w-[420px] bg-[#12121A] border border-[#1E1E2A] rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer select-none bg-[#16161E] border-b border-[#1E1E2A]"
          onClick={toggleCollapsed}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isRunning ? (
              <Loader2 className="w-4 h-4 text-[#25D366] animate-spin shrink-0" />
            ) : isComplete ? (
              <CheckCircle2 className="w-4 h-4 text-[#25D366] shrink-0" />
            ) : isError ? (
              <XCircle className="w-4 h-4 text-[#F87171] shrink-0" />
            ) : null}
            <span className="text-sm font-semibold text-[#F1F1F3] truncate">
              {isRunning
                ? "Verificando Membros"
                : isComplete
                  ? "Verificacao Concluida"
                  : "Erro na Verificacao"}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {collapsed ? (
              <ChevronUp className="w-4 h-4 text-[#5A5A72]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#5A5A72]" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleClose()
              }}
              className="p-1 rounded hover:bg-[#1E1E2A] transition-colors"
            >
              <X className="w-4 h-4 text-[#5A5A72]" />
            </button>
          </div>
        </div>

        {/* ── Collapsed: just show progress bar ──────────────────────────── */}
        {collapsed && (
          <div className="px-4 py-2">
            <div className="flex items-center justify-between text-xs text-[#8B8B9E] mb-1">
              <span className="truncate">{campanhaNome}</span>
              <span className="shrink-0 ml-2">
                {isComplete
                  ? `${resultado?.tags_aplicadas ?? 0} tags aplicadas`
                  : `${gruposConcluidos}/${grupoTotal} grupos`}
              </span>
            </div>
            <div className="w-full h-1.5 bg-[#1C1C2C] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isComplete ? "bg-[#25D366]" : isError ? "bg-[#F87171]" : "bg-[#25D366]"
                }`}
                style={{ width: `${isComplete ? 100 : progressPercent}%` }}
              />
            </div>
            {isComplete && (
              <div className="mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowResultDialog(true)
                  }}
                  className="text-xs text-[#25D366] hover:text-[#2ee87a] transition-colors flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  Ver resultado
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Expanded: full detail view ─────────────────────────────────── */}
        {!collapsed && (
          <div className="px-4 py-3 space-y-3">
            {/* Campaign name */}
            <p className="text-xs text-[#8B8B9E] truncate">{campanhaNome}</p>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between text-xs text-[#8B8B9E] mb-1.5">
                <span>Progresso</span>
                <span>{gruposConcluidos}/{grupoTotal} grupos</span>
              </div>
              <div className="w-full h-2 bg-[#1C1C2C] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isComplete ? "bg-[#25D366]" : isError ? "bg-[#F87171]" : "bg-[#25D366]"
                  }`}
                  style={{ width: `${isComplete ? 100 : progressPercent}%` }}
                />
              </div>
            </div>

            {/* Error message */}
            {isError && (
              <div className="flex items-start gap-2 p-2.5 bg-[#1A0000] border border-[#F87171]/30 rounded-lg text-xs text-[#F87171]">
                <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* Per-group status lines */}
            {grupoStatuses.length > 0 && (
              <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                {visibleGrupos.map((grupo, i) => (
                  <div
                    key={`${grupo.index}-${i}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#0F0F1A] text-xs"
                  >
                    <GrupoStatusIcon status={grupo.status} />
                    <span className="text-[#C4C4D4] truncate flex-1 min-w-0">{grupo.nome}</span>
                    <span className="shrink-0">
                      <GrupoStatusText grupo={grupo} />
                    </span>
                  </div>
                ))}
                {hiddenCount > 0 && (
                  <p className="text-[10px] text-[#5A5A72] pl-2 pt-1">
                    ...mais {hiddenCount} grupo{hiddenCount > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}

            {/* Running totals */}
            <div className="border-t border-[#1E1E2A] pt-2">
              <p className="text-[10px] text-[#5A5A72] uppercase tracking-wider mb-2">Totais em tempo real</p>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-[#C4C4D4]">
                  <span className="text-[#EEEEF5] font-semibold">{totalMembros}</span> membros
                </span>
                <span className="text-[#1E1E2A]">|</span>
                <span className="text-[#C4C4D4]">
                  <span className="text-[#25D366] font-semibold">{totalTags}</span> tags
                </span>
                {totalErros > 0 && (
                  <>
                    <span className="text-[#1E1E2A]">|</span>
                    <span className="text-[#C4C4D4]">
                      <span className="text-[#F87171] font-semibold">{totalErros}</span> erro{totalErros > 1 ? "s" : ""}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Action buttons for completed state */}
            {isComplete && resultado && (
              <div className="pt-1">
                <button
                  onClick={() => setShowResultDialog(true)}
                  className="w-full text-xs text-center py-2 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Ver resultado completo
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}
      <CloseConfirmDialog
        open={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        onConfirm={handleConfirmClose}
      />

      {resultado && (
        <ResultDialog
          open={showResultDialog}
          onClose={() => setShowResultDialog(false)}
          resultado={resultado}
        />
      )}
    </>
  )
}
