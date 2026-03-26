"use client"

import React, { useState } from "react"
import { Plus, Users, ScanSearch } from "lucide-react"
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
  const [confirmScan, setConfirmScan] = useState(false)
  const [scanResult, setScanResult] = useState<EscanearResult | null>(null)
  const [deletingGrupo, setDeletingGrupo] = useState<string | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<ZApiGrupo | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleScanGrupos() {
    setScanning(true)
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${inst.id}/escanear-grupos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = (data as { message?: string }).message || `Erro ao escanear grupos (HTTP ${res.status}).`
        toast.error(msg)
        return
      }
      setScanResult(data)
      if (data.novos_vinculados > 0) onRefresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro de conexão"
      toast.error(`Erro ao escanear grupos: ${msg}`)
    } finally {
      setScanning(false)
    }
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
              onClick={() => setConfirmScan(true)}
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

      {/* Scan confirmation dialog */}
      <Dialog open={confirmScan} onOpenChange={setConfirmScan}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Escanear grupos?</DialogTitle>
            <DialogDescription>
              Busca todos os grupos e comunidades do Z-API e vincula automaticamente os similares
              aos grupos já configurados. A operação pode levar alguns segundos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmScan(false)}>Cancelar</Button>
            <Button onClick={() => { setConfirmScan(false); handleScanGrupos() }} loading={scanning}>
              Escanear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scan result dialog */}
      <ScanResultDialog
        open={!!scanResult}
        result={scanResult}
        onClose={() => setScanResult(null)}
      />

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
