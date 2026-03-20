"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, Wifi, Layers, ChevronRight, Circle } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { hasPermission } from "@/lib/auth/rbac"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Header } from "@/components/layout/Header"
import { toast } from "sonner"

interface Instancia {
  id: string
  nome: string
  instance_id: string
  status: "ativo" | "inativo"
  created_at: string
  cliente: { id: string; nome: string } | null
  _count: { grupos: number }
}

function groupByClient(list: Instancia[]) {
  const map = new Map<string, { label: string; items: Instancia[] }>()
  for (const inst of list) {
    const key = inst.cliente?.id ?? "__none"
    const label = inst.cliente?.nome ?? "Sem cliente vinculado"
    if (!map.has(key)) map.set(key, { label, items: [] })
    map.get(key)!.items.push(inst)
  }
  return Array.from(map.entries()).sort(([a], [b]) => {
    if (a === "__none") return 1
    if (b === "__none") return -1
    return 0
  })
}

export default function ZApiPage() {
  const { accessToken, user } = useAuth()
  const [instancias, setInstancias] = useState<Instancia[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialog, setDeleteDialog] = useState<Instancia | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [clienteFilter, setClienteFilter] = useState("all")

  const canWrite = user ? hasPermission(user.role, "contas:write") : false

  const fetchInstancias = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await fetch("/api/admin/zapi/instancias", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setInstancias(data.instancias || [])
    } catch {
      toast.error("Erro ao carregar instâncias Z-API.")
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => { fetchInstancias() }, [fetchInstancias])

  async function handleDelete(inst: Instancia) {
    setActionLoading(inst.id)
    try {
      const res = await fetch(`/api/admin/zapi/instancias/${inst.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        setDeleteDialog(null)
        fetchInstancias()
      } else {
        toast.error(data.message || "Erro ao excluir instância.")
      }
    } catch {
      toast.error("Erro ao excluir instância.")
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = clienteFilter === "all"
    ? instancias
    : instancias.filter((i) => (i.cliente?.id ?? "__none") === clienteFilter)

  const grouped = groupByClient(filtered)
  const totalAtivas = instancias.filter((i) => i.status === "ativo").length
  const totalGrupos = instancias.reduce((s, i) => s + i._count.grupos, 0)
  const clientes = Array.from(
    new Map(instancias.filter((i) => i.cliente).map((i) => [i.cliente!.id, i.cliente!.nome])).entries()
  )

  return (
    <div className="flex flex-col h-full">
      <Header breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Z-API / WhatsApp" }]} />

      <div className="p-6 space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[#EEEEF5] text-2xl font-bold tracking-tight">Z-API / WhatsApp</h1>
            <p className="text-[#7F7F9E] text-sm mt-1">
              Instâncias por cliente · Grupos monitorados · Tags automáticas no Manychat
            </p>
          </div>
          {canWrite && (
            <Link href="/admin/zapi/nova">
              <Button className="shadow-lg shadow-[#25D366]/10">
                <Plus className="w-4 h-4" />
                Nova Instância
              </Button>
            </Link>
          )}
        </div>

        {/* Stats strip */}
        {!loading && instancias.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Instâncias", value: instancias.length, icon: <Wifi className="w-4 h-4 text-[#7F7F9E]" />, color: "text-[#EEEEF5]" },
              { label: "Ativas", value: totalAtivas, icon: <Circle className="w-3.5 h-3.5 fill-[#22C55E] text-[#22C55E]" />, color: "text-[#22C55E]" },
              { label: "Grupos monitorados", value: totalGrupos, icon: <Layers className="w-4 h-4 text-[#7F7F9E]" />, color: "text-[#A78BFA]" },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-xl px-5 py-4 flex items-center gap-3.5 shadow-[0_2px_20px_rgba(0,0,0,0.4)]"
              >
                <div className="w-9 h-9 rounded-lg bg-[#13131F] flex items-center justify-center shrink-0">
                  {s.icon}
                </div>
                <div>
                  <p className={`text-2xl font-bold leading-none ${s.color}`}>{s.value}</p>
                  <p className="text-[#7F7F9E] text-[11px] mt-1">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Client filter pills */}
        {!loading && clientes.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {[{ id: "all", nome: "Todos os clientes" }, ...clientes.map(([id, nome]) => ({ id, nome }))].map(
              ({ id, nome }) => (
                <button
                  key={id}
                  onClick={() => setClienteFilter(id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                    clienteFilter === id
                      ? "bg-[#25D366]/12 text-[#25D366] border-[#25D366]/25"
                      : "text-[#7F7F9E] border-[#1C1C2C] hover:border-[#252535] hover:text-[#EEEEF5]"
                  }`}
                >
                  {nome}
                </button>
              )
            )}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-7 h-7 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#7F7F9E] text-sm">Carregando instâncias…</p>
          </div>
        ) : instancias.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="w-20 h-20 rounded-2xl bg-[#0F0F1A] border border-[#1C1C2C] flex items-center justify-center shadow-[0_4px_32px_rgba(0,0,0,0.5)]">
              <Wifi className="w-8 h-8 text-[#3F3F58]" />
            </div>
            <div className="text-center">
              <p className="text-[#EEEEF5] font-semibold text-lg">Nenhuma instância Z-API</p>
              <p className="text-[#7F7F9E] text-sm mt-1.5 max-w-xs">
                Conecte sua primeira instância para monitorar grupos e aplicar tags no Manychat automaticamente.
              </p>
            </div>
            {canWrite && (
              <Link href="/admin/zapi/nova">
                <Button className="shadow-lg shadow-[#25D366]/10">
                  <Plus className="w-4 h-4" />
                  Conectar Instância
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-7">
            {grouped.map(([key, { label, items }]) => (
              <div key={key}>
                {/* Client group header */}
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] shrink-0" />
                  <span className="text-[#EEEEF5] text-sm font-semibold">{label}</span>
                  <span className="text-[#3F3F58] text-xs">
                    {items.length} instância{items.length !== 1 ? "s" : ""}
                  </span>
                  <div className="flex-1 h-px bg-[#1C1C2C]" />
                </div>

                <div className="space-y-2">
                  {items.map((inst) => (
                    <Link key={inst.id} href={`/admin/zapi/${inst.id}`}>
                      <div className="group bg-[#0F0F1A] border border-[#1C1C2C] rounded-xl px-5 py-4 flex items-center gap-4 hover:border-[#252535] hover:bg-[#121220] transition-all duration-200 shadow-[0_1px_12px_rgba(0,0,0,0.3)] cursor-pointer">
                        {/* Status icon */}
                        <div className="relative shrink-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              inst.status === "ativo" ? "bg-[#22C55E]/10" : "bg-[#13131F]"
                            }`}
                          >
                            <Wifi
                              className={`w-[18px] h-[18px] ${
                                inst.status === "ativo" ? "text-[#22C55E]" : "text-[#3F3F58]"
                              }`}
                            />
                          </div>
                          {inst.status === "ativo" && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#22C55E] shadow-[0_0_8px_rgba(34,197,94,0.65)] ring-2 ring-[#0F0F1A]" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[#EEEEF5] font-semibold text-sm group-hover:text-white transition-colors">
                              {inst.nome}
                            </p>
                            {inst.status === "inativo" && (
                              <span className="text-[10px] font-medium text-[#3F3F58] bg-[#13131F] border border-[#1C1C2C] px-1.5 py-0.5 rounded">
                                Inativo
                              </span>
                            )}
                          </div>
                          <p className="text-[#3F3F58] text-xs font-mono mt-0.5 truncate">
                            {inst.instance_id}
                          </p>
                        </div>

                        {/* Groups */}
                        <div className="text-right shrink-0">
                          <p className="text-[#EEEEF5] text-sm font-semibold">{inst._count.grupos}</p>
                          <p className="text-[#3F3F58] text-[10px] uppercase tracking-wider">
                            {inst._count.grupos === 1 ? "grupo" : "grupos"}
                          </p>
                        </div>

                        {/* Delete */}
                        {canWrite && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setDeleteDialog(inst)
                            }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#3F3F58] hover:text-[#F87171] hover:bg-[#F87171]/10 transition-all opacity-0 group-hover:opacity-100 shrink-0 text-lg leading-none pb-0.5"
                            title="Excluir"
                          >
                            ×
                          </button>
                        )}

                        <ChevronRight className="w-4 h-4 text-[#3F3F58] group-hover:text-[#7F7F9E] transition-colors shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir instância</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir{" "}
              <strong className="text-[#EEEEF5]">{deleteDialog?.nome}</strong>? Todos os grupos e
              entradas vinculados serão removidos permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteDialog && handleDelete(deleteDialog)}
              loading={actionLoading === deleteDialog?.id}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
