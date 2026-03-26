"use client"

import React, { useState, useEffect, useRef } from "react"
import { Plus, Users, ScanSearch, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { type ZApiInstance, type ZApiGrupo, type EscanearResult } from "./types"
import { GrupoCard } from "./GrupoCard"
import { ScanResultDialog } from "./ScanResultDialog"
import { toast } from "sonner"

interface GruposListSectionProps {
  inst: ZApiInstance
  accessToken: string | null
  canWrite: boolean
  onRefresh: () => void
  onOpenAddDialog: () => void
  onEditGrupo: (grupo: ZApiGrupo) => void
  onViewEntradas: (grupoId: string) => void
}

export function GruposListSection({
  inst, accessToken, canWrite, onRefresh, onOpenAddDialog, onEditGrupo, onViewEntradas,
}: GruposListSectionProps) {
  const [scanning, setScanning] = useState(false)
  const [scanPhase, setScanPhase] = useState<"confirm" | "progress" | "done" | "error" | null>(null)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<EscanearResult | null>(null)
  const [deletingGrupo, setDeletingGrupo] = useState<string | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<ZApiGrupo | null>(null)
  const [deleting, setDeleting] = useState(false)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fake progress animation while waiting for API
  useEffect(() => {
    if (scanPhase === "progress") {
      setScanProgress(0)
      progressRef.current = setInterval(() => {
        setScanProgress((p) => {
          if (p >= 90) { clearInterval(progressRef.current!); return 90 }
          return p + Math.random() * 8 + 2
        })
      }, 500)
      return () => { if (progressRef.current) clearInterval(progressRef.current) }
    }
  }, [scanPhase])

  async function handleScanGrupos() {
    setScanning(true)
    setScanPhase("progress")
    setScanError(null)
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${inst.id}/escanear-grupos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = (data as { message?: string }).message || `Erro ao escanear grupos (HTTP ${res.status}).`
        setScanError(msg)
        setScanPhase("error")
        return
      }
      setScanProgress(100)
      setScanResult(data)
      setScanPhase("done")
      if (data.novos_vinculados > 0) onRefresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro de conexão"
      setScanError(msg)
      setScanPhase("error")
    } finally {
      setScanning(false)
      if (progressRef.current) clearInterval(progressRef.current)
    }
  }

  function closeScanDialog() {
    if (scanning) return // Prevent closing while scanning
    setScanPhase(null)
    setScanResult(null)
    setScanError(null)
    setScanProgress(0)
  }

  async function handleDeleteGrupo() {
    if (!deleteDialog) return
    setDeleting(true)
    setDeletingGrupo(deleteDialog.id)
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${inst.id}/grupos/${deleteDialog.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        setDeleteDialog(null)
        onRefresh()
      } else {
        toast.error(data.message || "Erro ao remover grupo.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setDeleting(false)
      setDeletingGrupo(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-[#7F7F9E] text-sm">
          Cada grupo monitora entradas e aplica uma tag no Manychat automaticamente.
        </p>
        <div className="flex items-center gap-2">
          {canWrite && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setScanPhase("confirm")}
              loading={scanning}
              title="Busca todos os grupos do Z-API e auto-vincula os similares"
            >
              <ScanSearch className="w-4 h-4" />
              Escanear e Vincular
            </Button>
          )}
          {canWrite && (
            <Button size="sm" onClick={onOpenAddDialog} className="shadow-md shadow-[#25D366]/10">
              <Plus className="w-4 h-4" />
              Adicionar Grupo
            </Button>
          )}
        </div>
      </div>

      {/* Groups list */}
      {inst.grupos.length === 0 ? (
        <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-2xl flex flex-col items-center justify-center py-16 gap-3 shadow-[0_2px_16px_rgba(0,0,0,0.3)]">
          <div className="w-12 h-12 rounded-xl bg-[#13131F] flex items-center justify-center">
            <Users className="w-5 h-5 text-[#3F3F58]" />
          </div>
          <p className="text-[#7F7F9E] text-sm">Nenhum grupo configurado</p>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={onOpenAddDialog}>
              <Plus className="w-4 h-4" />
              Adicionar Grupo
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {inst.grupos.map((g) => (
            <GrupoCard
              key={g.id}
              grupo={g}
              instanciaId={inst.id}
              accessToken={accessToken}
              canWrite={canWrite}
              onEdit={onEditGrupo}
              onDelete={setDeleteDialog}
              onViewEntradas={onViewEntradas}
              deleting={deletingGrupo === g.id}
            />
          ))}
        </div>
      )}

      {/* Scan unified dialog: confirm → progress → done/error */}
      <Dialog open={!!scanPhase} onOpenChange={(open) => { if (!open) closeScanDialog() }}>
        <DialogContent className="max-w-md" onInteractOutside={(e) => { if (scanning) e.preventDefault() }}>
          {scanPhase === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ScanSearch className="w-5 h-5 text-[#25D366]" />
                  Escanear e Vincular
                </DialogTitle>
                <DialogDescription>
                  Busca todos os grupos do WhatsApp e vincula automaticamente os similares aos grupos já configurados.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={closeScanDialog}>Cancelar</Button>
                <Button onClick={handleScanGrupos}>Iniciar</Button>
              </DialogFooter>
            </>
          )}

          {scanPhase === "progress" && (
            <div className="py-8 space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-[#1E1E2A]" />
                  <div
                    className="absolute inset-0 rounded-full border-4 border-[#25D366] border-t-transparent animate-spin"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ScanSearch className="w-6 h-6 text-[#25D366]" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[#F1F1F3] font-semibold">Escaneando grupos…</p>
                  <p className="text-[#5A5A72] text-xs mt-1">Buscando e vinculando grupos do WhatsApp</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mx-8">
                <div className="h-2 bg-[#1E1E2A] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#25D366] rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(scanProgress, 100)}%` }}
                  />
                </div>
                <p className="text-[#5A5A72] text-[10px] text-center mt-2">
                  {scanProgress < 30 ? "Conectando à Z-API…" : scanProgress < 60 ? "Buscando grupos…" : scanProgress < 90 ? "Vinculando similares…" : "Finalizando…"}
                </p>
              </div>
              <p className="text-[#3F3F58] text-[10px] text-center">
                Não feche esta janela durante o escaneamento
              </p>
            </div>
          )}

          {scanPhase === "done" && scanResult && (
            <div className="py-4 space-y-5">
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-[#25D366]/15 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-[#25D366]" />
                </div>
                <p className="text-[#F1F1F3] font-semibold text-lg">Escaneamento concluído</p>
              </div>
              {/* KPI Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-[#EEEEF5]">{scanResult.total_grupos_zapi}</p>
                  <p className="text-[#5A5A72] text-[10px] mt-0.5">Grupos encontrados</p>
                </div>
                <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-[#25D366]">{scanResult.novos_vinculados}</p>
                  <p className="text-[#5A5A72] text-[10px] mt-0.5">Novos vinculados</p>
                </div>
                <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-[#8B8B9E]">{scanResult.ja_configurados}</p>
                  <p className="text-[#5A5A72] text-[10px] mt-0.5">Já configurados</p>
                </div>
                <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-[#EEEEF5]">{scanResult.sem_match}</p>
                  <p className="text-[#5A5A72] text-[10px] mt-0.5">Sem match</p>
                </div>
              </div>
              {scanResult.aviso && (
                <div className="flex items-start gap-2 p-3 bg-[#1A1500] border border-[#F59E0B]/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                  <p className="text-[#F59E0B] text-xs">{scanResult.aviso}</p>
                </div>
              )}
              <DialogFooter>
                <Button onClick={closeScanDialog} className="w-full">Fechar</Button>
              </DialogFooter>
            </div>
          )}

          {scanPhase === "error" && (
            <div className="py-6 space-y-5">
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-[#F87171]/15 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-[#F87171]" />
                </div>
                <div className="text-center">
                  <p className="text-[#F1F1F3] font-semibold">Erro no escaneamento</p>
                  <p className="text-[#F87171] text-sm mt-2 max-w-xs">{scanError}</p>
                </div>
              </div>
              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={closeScanDialog} className="flex-1">Fechar</Button>
                <Button onClick={handleScanGrupos} className="flex-1">Tentar novamente</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete grupo dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover grupo monitorado</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover o grupo{" "}
              <strong className="text-[#EEEEF5]">{deleteDialog?.nome_filtro}</strong>?{" "}
              O histórico de entradas também será excluído.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteGrupo} loading={deleting}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
