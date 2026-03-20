"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, MessageSquare, CheckCircle2, XCircle, MoreHorizontal, Wifi } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { hasPermission } from "@/lib/auth/rbac"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
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

export default function ZApiPage() {
  const { accessToken, user } = useAuth()
  const [instancias, setInstancias] = useState<Instancia[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialog, setDeleteDialog] = useState<Instancia | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

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
    setActionLoading(inst.id + "-delete")
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

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
    })
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Z-API / Grupos WA" },
        ]}
      />

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[#F1F1F3] text-2xl font-bold">Z-API / Grupos WhatsApp</h1>
            <p className="text-[#8B8B9E] text-sm mt-1">
              Monitore entradas em grupos e aplique tags no Manychat automaticamente
            </p>
          </div>
          {canWrite && (
            <Link href="/admin/zapi/nova">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Instância
              </Button>
            </Link>
          )}
        </div>

        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
            </div>
          ) : instancias.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#1E1E2A] flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-[#25D366]" />
              </div>
              <div className="text-center">
                <p className="text-[#F1F1F3] font-semibold text-lg">Nenhuma instância Z-API</p>
                <p className="text-[#8B8B9E] text-sm mt-1">
                  Conecte sua primeira instância para monitorar grupos do WhatsApp
                </p>
              </div>
              {canWrite && (
                <Link href="/admin/zapi/nova">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Conectar Instância
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E1E2A]">
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Instância</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Instance ID</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Cliente</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Grupos</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Criado em</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {instancias.map((inst) => (
                  <tr key={inst.id} className="border-b border-[#1E1E2A] last:border-0 hover:bg-[#1C1C28] transition-colors">
                    <td className="px-5 py-4">
                      <Link href={`/admin/zapi/${inst.id}`} className="text-[#F1F1F3] font-medium text-sm hover:text-[#25D366] transition-colors">
                        {inst.nome}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[#8B8B9E] text-xs font-mono">{inst.instance_id}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[#C4C4D4] text-sm">{inst.cliente?.nome || <span className="text-[#5A5A72]">—</span>}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[#C4C4D4] text-sm">{inst._count.grupos}</span>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={inst.status === "ativo" ? "ativo" : "inativo"}>
                        {inst.status === "ativo" ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[#8B8B9E] text-sm">{formatDate(inst.created_at)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/zapi/${inst.id}`}>Ver detalhes</Link>
                          </DropdownMenuItem>
                          {canWrite && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                destructive
                                onClick={() => setDeleteDialog(inst)}
                              >
                                Excluir
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Instância</DialogTitle>
          </DialogHeader>
          <p className="text-[#8B8B9E] text-sm">
            Tem certeza que deseja excluir a instância{" "}
            <span className="text-[#F1F1F3] font-semibold">{deleteDialog?.nome}</span>?
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteDialog && handleDelete(deleteDialog)}
              loading={actionLoading === deleteDialog?.id + "-delete"}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
