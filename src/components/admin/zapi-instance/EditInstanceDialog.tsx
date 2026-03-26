"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { type ZApiInstance } from "./types"
import { toast } from "sonner"

interface EditInstanceDialogProps {
  open: boolean
  inst: ZApiInstance
  accessToken: string | null
  onClose: () => void
  onSuccess: () => void
}

export function EditInstanceDialog({ open, inst, accessToken, onClose, onSuccess }: EditInstanceDialogProps) {
  const [editForm, setEditForm] = useState({
    nome: "",
    instance_id: "",
    token: "",
    client_token: "",
    status: "ativo" as "ativo" | "inativo",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && inst) {
      setEditForm({
        nome: inst.nome,
        instance_id: inst.instance_id,
        token: "",
        client_token: "",
        status: inst.status,
      })
    }
  }, [open, inst])

  async function handleSave() {
    if (!editForm.nome.trim() || !editForm.instance_id.trim()) {
      toast.error("Nome e Instance ID são obrigatórios.")
      return
    }
    setSaving(true)
    try {
      const body: Record<string, string> = {
        nome: editForm.nome.trim(),
        instance_id: editForm.instance_id.trim(),
        status: editForm.status,
      }
      if (editForm.token.trim()) body.token = editForm.token.trim()
      if (editForm.client_token.trim()) body.client_token = editForm.client_token.trim()

      const res = await fetch(`/api/admin/zapi/instancias/${inst.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Instância atualizada.")
        onSuccess()
        onClose()
      } else {
        toast.error(data.message || "Erro ao atualizar.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Instância</DialogTitle>
          <DialogDescription>
            Token e Client Token só são alterados se preenchidos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#9898B0]">Nome *</label>
            <input
              value={editForm.nome}
              onChange={(e) => setEditForm((p) => ({ ...p, nome: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] placeholder-[#3F3F58] focus:outline-none focus:border-[#25D366]/50"
              placeholder="Nome da instância"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#9898B0]">Instance ID *</label>
            <input
              value={editForm.instance_id}
              onChange={(e) => setEditForm((p) => ({ ...p, instance_id: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] font-mono focus:outline-none focus:border-[#25D366]/50"
              placeholder="Instance ID"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#9898B0]">
              Token <span className="text-[#3F3F58] font-normal">(deixe em branco para manter)</span>
            </label>
            <input
              type="password"
              value={editForm.token}
              onChange={(e) => setEditForm((p) => ({ ...p, token: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] focus:outline-none focus:border-[#25D366]/50"
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#9898B0]">
              Client Token <span className="text-[#3F3F58] font-normal">(deixe em branco para manter)</span>
            </label>
            <input
              type="password"
              value={editForm.client_token}
              onChange={(e) => setEditForm((p) => ({ ...p, client_token: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] focus:outline-none focus:border-[#25D366]/50"
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#9898B0]">Status</label>
            <select
              value={editForm.status}
              onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as "ativo" | "inativo" }))}
              className="w-full h-9 px-3 rounded-lg border border-[#1C1C2C] bg-[#13131F] text-sm text-[#EEEEF5] focus:outline-none focus:border-[#25D366]/50"
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} loading={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
