"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Smartphone, Loader2, Save, ScanSearch, AlertTriangle, CheckCircle2, XCircle, Users2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { type CampanhaData, type InstanciaOption, type VarreduraResult, fmtDt } from "./types"

interface InstanciaZApiSectionProps {
  campanha: CampanhaData
  accessToken: string | null
  canWrite: boolean
  instancias: InstanciaOption[]
  instanciaId: string | null
  onInstanciaChange: (id: string | null) => void
  onSaveInstancia: () => void
  savingInstancia: boolean
  varrendo: boolean
  varreduraResult: VarreduraResult | null
  onVarredura: () => void
}

// ── Progress steps for the animation ─────────────────────────────────────────

const PROGRESS_STEPS = [
  { label: "Conectando ao Z-API...", icon: Smartphone },
  { label: "Buscando membros dos grupos...", icon: Users2 },
  { label: "Identificando leads na campanha...", icon: ScanSearch },
  { label: "Aplicando tags no Manychat...", icon: CheckCircle2 },
]

export function InstanciaZApiSection({
  campanha,
  accessToken,
  canWrite,
  instancias,
  instanciaId,
  onInstanciaChange,
  onSaveInstancia,
  savingInstancia,
  varrendo,
  varreduraResult,
  onVarredura,
}: InstanciaZApiSectionProps) {
  const [showProgressDialog, setShowProgressDialog] = useState(false)
  const [showResultDialog, setShowResultDialog] = useState(false)
  const [progressStep, setProgressStep] = useState(0)
  const [localResult, setLocalResult] = useState<VarreduraResult | null>(null)

  // When varrendo starts, open the progress dialog
  useEffect(() => {
    if (varrendo) {
      setShowProgressDialog(true)
      setProgressStep(0)
      setLocalResult(null)
    }
  }, [varrendo])

  // Animate progress steps while varrendo
  useEffect(() => {
    if (!varrendo) return
    const interval = setInterval(() => {
      setProgressStep((prev) => {
        if (prev < PROGRESS_STEPS.length - 1) return prev + 1
        return prev
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [varrendo])

  // When result arrives, show result dialog
  useEffect(() => {
    if (varreduraResult && showProgressDialog) {
      setLocalResult(varreduraResult)
      setShowProgressDialog(false)
      setShowResultDialog(true)
    }
  }, [varreduraResult, showProgressDialog])

  // Block browser navigation while scanning (beforeunload)
  useEffect(() => {
    if (!varrendo) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = "A verificação de membros está em andamento. Tem certeza que deseja sair?"
      return e.returnValue
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [varrendo])

  function handleStartVarredura() {
    onVarredura()
  }

  const resultado = localResult

  return (
    <section className="space-y-3">
      <p className="text-xs text-[#5A5A72] uppercase tracking-wider font-semibold flex items-center gap-1.5">
        <Smartphone className="w-3.5 h-3.5" />
        Instância Z-API
      </p>
      <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-5">
        {!campanha?.cliente ? (
          <p className="text-[#5A5A72] text-sm">Vincule um cliente à campanha para selecionar uma instância Z-API.</p>
        ) : instancias.length === 0 ? (
          <p className="text-[#5A5A72] text-sm">Nenhuma instância Z-API encontrada para o cliente <span className="text-[#C4C4D4]">{campanha.cliente.nome}</span>.</p>
        ) : (
          <div className="flex items-center gap-3">
            <select
              value={instanciaId ?? ""}
              onChange={(e) => onInstanciaChange(e.target.value || null)}
              className="flex-1 bg-[#0F0F1A] border border-[#2E2E3E] text-[#EEEEF5] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#25D366]"
            >
              <option value="">— Nenhuma instância —</option>
              {instancias.map((inst) => (
                <option key={inst.id} value={inst.id} disabled={inst.status !== "ativo"}>
                  {inst.nome}{inst.status !== "ativo" ? " (inativa)" : ""}
                </option>
              ))}
            </select>
            {canWrite && (
              <Button
                size="sm"
                onClick={onSaveInstancia}
                disabled={savingInstancia || instanciaId === (campanha?.instancia_zapi?.id ?? null)}
              >
                {savingInstancia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span className="ml-1">Salvar</span>
              </Button>
            )}
          </div>
        )}
        {campanha?.instancia_zapi && (
          <p className="text-xs text-[#5A5A72] mt-2">
            Vinculada: <span className="text-[#25D366]">{campanha.instancia_zapi.nome}</span>
            {campanha.instancia_zapi.status !== "ativo" && <span className="text-[#F87171] ml-1">(inativa)</span>}
          </p>
        )}

        {/* Varredura trigger */}
        {campanha?.instancia_zapi && canWrite && (
          <div className="mt-4 pt-4 border-t border-[#1E1E2A]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#C4C4D4]">Verificar Membros</p>
                <p className="text-xs text-[#5A5A72] mt-0.5">
                  {campanha.ultima_varredura_at
                    ? `Última: ${fmtDt(campanha.ultima_varredura_at)}`
                    : "Verifica quem já está nos grupos e aplica tags"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={handleStartVarredura} disabled={varrendo}>
                <ScanSearch className="w-3.5 h-3.5 mr-1.5" />
                Verificar Membros
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Progress Dialog (blocks screen while scanning) ─────────────────── */}
      <Dialog open={showProgressDialog} onOpenChange={() => {/* prevent close while scanning */}}>
        <DialogContent
          className="max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          hideClose
        >
          <div className="flex flex-col items-center py-8 gap-6">
            {/* Animated scanner icon */}
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-[#25D366]/10 flex items-center justify-center">
                <ScanSearch className="w-10 h-10 text-[#25D366] animate-pulse" />
              </div>
              {/* Spinning ring */}
              <div className="absolute inset-0 w-20 h-20 rounded-full border-2 border-transparent border-t-[#25D366] animate-spin" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-[#F1F1F3] text-lg font-bold">Verificando Membros</h3>
              <p className="text-[#7F7F9E] text-sm">
                Buscando participantes dos grupos e aplicando tags...
              </p>
            </div>

            {/* Progress steps */}
            <div className="w-full space-y-2.5 px-2">
              {PROGRESS_STEPS.map((step, i) => {
                const StepIcon = step.icon
                const isActive = i === progressStep
                const isDone = i < progressStep
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-500 ${
                      isActive
                        ? "bg-[#25D366]/10 border border-[#25D366]/30"
                        : isDone
                          ? "opacity-50"
                          : "opacity-20"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      isDone ? "bg-[#25D366]/20" : isActive ? "bg-[#25D366]/15" : "bg-[#1C1C2C]"
                    }`}>
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366]" />
                      ) : isActive ? (
                        <Loader2 className="w-3.5 h-3.5 text-[#25D366] animate-spin" />
                      ) : (
                        <StepIcon className="w-3 h-3 text-[#3F3F58]" />
                      )}
                    </div>
                    <span className={`text-sm ${
                      isActive ? "text-[#EEEEF5] font-medium" : isDone ? "text-[#7F7F9E]" : "text-[#3F3F58]"
                    }`}>
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>

            <p className="text-[#F59E0B] text-xs flex items-center gap-1.5 mt-2">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              Não feche esta página durante a verificação
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Result Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {resultado && resultado.erros === 0 ? (
                <CheckCircle2 className="w-5 h-5 text-[#25D366]" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
              )}
              Verificação Concluída
            </DialogTitle>
            <DialogDescription>
              Resultado da verificação de membros dos grupos.
            </DialogDescription>
          </DialogHeader>

          {resultado && (
            <div className="space-y-4 py-2">
              {resultado.aviso_24h && (
                <div className="flex items-start gap-2 p-3 bg-[#1A1500] border border-[#F59E0B]/30 rounded-lg text-xs text-[#F59E0B]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <p>{resultado.aviso_24h}</p>
                </div>
              )}

              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-2.5">
                <KpiMini label="Grupos varridos" value={resultado.grupos_varridos} color="text-[#EEEEF5]" />
                <KpiMini label="Membros lidos" value={resultado.total_membros} color="text-[#EEEEF5]" />
                <KpiMini label="Leads encontrados" value={resultado.leads_encontrados} color="text-[#60A5FA]" />
                <KpiMini label="Tags aplicadas" value={resultado.tags_aplicadas} color="text-[#25D366]" />
                {resultado.ja_processados > 0 && (
                  <KpiMini label="Já processados" value={resultado.ja_processados} color="text-[#5A5A72]" />
                )}
                {resultado.grupos_sem_id > 0 && (
                  <KpiMini label="Grupos sem ID WA" value={resultado.grupos_sem_id} color="text-[#F59E0B]" />
                )}
                {resultado.erros > 0 && (
                  <KpiMini label="Erros" value={resultado.erros} color="text-[#F87171]" />
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowResultDialog(false)} className="w-full">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

// ── KPI Mini Card ────────────────────────────────────────────────────────────

function KpiMini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[#0A0A12] border border-[#1C1C2C] rounded-lg p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[#5A5A72] text-[10px] uppercase tracking-wider mt-1">{label}</p>
    </div>
  )
}
