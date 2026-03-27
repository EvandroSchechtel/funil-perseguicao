"use client"

import React from "react"
import { X, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { useVarredura } from "@/contexts/VarreduraContext"
import { Button } from "@/components/ui/button"

// ── Stat box ─────────────────────────────────────────────────────────────────

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[#5A5A72] text-[10px] uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  )
}

// ── Main Panel ───────────────────────────────────────────────────────────────

export function VarreduraProgressPanel() {
  const { isRunning, campanhaNome, campanhaId, resultado, error, dismiss, startVarredura } = useVarredura()

  // Don't render if nothing is happening and no result to show
  if (!isRunning && !resultado && !error) return null

  const isComplete = !!resultado
  const isError = !!error && !resultado

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[380px] bg-[#12121A] border border-[#1E1E2A] rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#16161E] border-b border-[#1E1E2A]">
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
        <button
          onClick={dismiss}
          className="p-1 rounded hover:bg-[#1E1E2A] transition-colors shrink-0"
        >
          <X className="w-4 h-4 text-[#5A5A72]" />
        </button>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 space-y-3">
        {/* Campaign name */}
        <p className="text-xs text-[#8B8B9E] truncate uppercase tracking-wider">{campanhaNome}</p>

        {/* Running state */}
        {isRunning && (
          <>
            {/* Indeterminate progress bar */}
            <div className="w-full h-1.5 bg-[#1C1C2C] rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-[#25D366] rounded-full animate-indeterminate" />
            </div>
            <p className="text-xs text-[#5A5A72]">
              Verificando membros e aplicando tags...
              <br />
              Isso pode levar alguns minutos.
            </p>
          </>
        )}

        {/* Complete state */}
        {isComplete && resultado && (
          <>
            {resultado.aviso_24h && (
              <div className="flex items-start gap-2 p-2.5 bg-[#1A1500] border border-[#F59E0B]/30 rounded-lg text-xs text-[#F59E0B]">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <p>{resultado.aviso_24h}</p>
              </div>
            )}
            <div className="grid grid-cols-4 gap-2 py-1">
              <StatBox label="Grupos" value={resultado.grupos_varridos} color="text-[#EEEEF5]" />
              <StatBox label="Membros" value={resultado.total_membros} color="text-[#EEEEF5]" />
              <StatBox label="Tags" value={resultado.tags_aplicadas} color="text-[#25D366]" />
              <StatBox label="Erros" value={resultado.erros} color={resultado.erros > 0 ? "text-[#F87171]" : "text-[#5A5A72]"} />
            </div>
            <Button onClick={dismiss} variant="outline" className="w-full text-xs">
              Fechar
            </Button>
          </>
        )}

        {/* Error state */}
        {isError && (
          <>
            <div className="flex items-start gap-2 p-2.5 bg-[#1A0000] border border-[#F87171]/30 rounded-lg text-xs text-[#F87171]">
              <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
            <div className="flex gap-2">
              {campanhaId && (
                <Button
                  onClick={() => {
                    // We can't retry without the accessToken — dismiss instead
                    dismiss()
                  }}
                  variant="outline"
                  className="flex-1 text-xs"
                >
                  Fechar
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
