"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, Search, Zap, CheckCircle2, XCircle, MoreHorizontal, RefreshCw, AlertTriangle } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { hasPermission } from "@/lib/auth/rbac"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

interface Conta {
  id: string
  nome: string
  api_key_hint: string
  page_id: string | null
  page_name: string | null
  status: "ativo" | "inativo"
  cliente_id: string | null
  limite_diario: number | null
  uso_hoje: number
  ultimo_sync: string | null
  created_at: string
  usuario: { nome: string }
  _count: { webhook_flows: number; contatos_vinculados: number; grupos_monitoramento: number }
}

export default function ManychatPage() {
  const { accessToken, user } = useAuth()
  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [testingId, setTestingId] = useState<string | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<Conta | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const canWrite = user ? hasPermission(user.role, "contas:write") : false

  const fetchContas = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: "50", ...(search && { q: search }) })
      const res = await fetch(`/api/admin/contas?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setContas(data.contas || [])
    } catch {
      toast.error("Erro ao carregar contas.")
    } finally {
      setLoading(false)
    }
  }, [accessToken, search])

  useEffect(() => {
    const timer = setTimeout(fetchContas, search ? 400 : 0)
    return () => clearTimeout(timer)
  }, [fetchContas, search])

  async function handleTestar(conta: Conta) {
    setTestingId(conta.id)
    try {
      const res = await fetch(`/api/admin/contas/${conta.id}/testar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(data.message)
        fetchContas()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error("Erro ao testar conexão.")
    } finally {
      setTestingId(null)
    }
  }

  async function handleToggle(conta: Conta) {
    setActionLoading(conta.id + "-toggle")
    try {
      const res = await fetch(`/api/admin/contas/${conta.id}/toggle`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        fetchContas()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error("Erro ao alterar status.")
    } finally {
      setActionLoading(null)
    }
  }

  function closeDeleteDialog() {
    setDeleteDialog(null)
    setDeleteConfirmText("")
  }

  async function handleDelete(conta: Conta) {
    setActionLoading(conta.id + "-delete")
    try {
      const res = await fetch(`/api/admin/contas/${conta.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        closeDeleteDialog()
        fetchContas()
      } else {
        toast.error(data.message || "Erro ao excluir conta.")
      }
    } catch {
      toast.error("Erro ao excluir conta.")
    } finally {
      setActionLoading(null)
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—"
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Manychat" },
        ]}
      />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[#F1F1F3] text-2xl font-bold">Contas Manychat</h1>
            <p className="text-[#8B8B9E] text-sm mt-1">Gerencie as conexões com seus bots Manychat</p>
          </div>
          {canWrite && (
            <Link href="/admin/manychat/nova">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Conta
              </Button>
            </Link>
          )}
        </div>

        {/* Search */}
        <div className="mb-5">
          <Input
            placeholder="Buscar por nome ou página..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        {/* Table */}
        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
            </div>
          ) : contas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#1E1E2A] flex items-center justify-center">
                <Zap className="w-8 h-8 text-[#25D366]" />
              </div>
              <div className="text-center">
                <p className="text-[#F1F1F3] font-semibold text-lg">
                  {search ? "Nenhuma conta encontrada" : "Nenhuma conta conectada"}
                </p>
                <p className="text-[#8B8B9E] text-sm mt-1">
                  {search
                    ? "Tente ajustar os filtros de busca"
                    : "Conecte sua primeira conta Manychat para começar"}
                </p>
              </div>
              {!search && canWrite && (
                <Link href="/admin/manychat/nova">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Conectar Conta
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E1E2A]">
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Conta</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Página Manychat</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">API Key</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Envios hoje</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Último sync</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {contas.map((conta) => (
                  <tr key={conta.id} className="border-b border-[#1E1E2A] last:border-0 hover:bg-[#1C1C28] transition-colors">
                    <td className="px-5 py-4">
                      <div>
                        <p className="text-[#F1F1F3] font-medium text-sm">{conta.nome}</p>
                        <p className="text-[#5A5A72] text-xs mt-0.5">por {conta.usuario.nome}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {conta.page_name ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                          <span className="text-[#C4C4D4] text-sm">{conta.page_name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5 text-[#F87171] shrink-0" />
                          <span className="text-[#5A5A72] text-sm">Não conectado</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[#5A5A72] text-sm font-mono">{conta.api_key_hint}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="min-w-[100px]">
                        {conta.limite_diario ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className={conta.uso_hoje >= conta.limite_diario ? "text-[#F87171]" : "text-[#C4C4D4]"}>
                                {conta.uso_hoje} / {conta.limite_diario}
                              </span>
                            </div>
                            <div className="h-1.5 bg-[#1E1E2A] rounded-full overflow-hidden w-24">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, Math.round((conta.uso_hoje / conta.limite_diario) * 100))}%`,
                                  backgroundColor:
                                    conta.uso_hoje >= conta.limite_diario
                                      ? "#F87171"
                                      : conta.uso_hoje / conta.limite_diario > 0.8
                                      ? "#FBBF24"
                                      : "#25D366",
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#5A5A72] text-sm">
                            {conta.uso_hoje > 0 ? conta.uso_hoje : "0"}
                            <span className="text-[#3F3F58] text-xs ml-1">(sem limite)</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={conta.status === "ativo" ? "ativo" : "inativo"}>
                        {conta.status === "ativo" ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[#8B8B9E] text-sm">{formatDate(conta.ultimo_sync)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="ghost"
                          onClick={() => handleTestar(conta)}
                          disabled={testingId === conta.id}
                          title="Testar conexão"
                          className="h-8 px-2"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${testingId === conta.id ? "animate-spin" : ""}`} />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canWrite && (
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/manychat/${conta.id}/editar`}>Editar</Link>
                              </DropdownMenuItem>
                            )}
                            {canWrite && (
                              <DropdownMenuItem
                                onClick={() => handleToggle(conta)}
                                disabled={actionLoading === conta.id + "-toggle"}
                              >
                                {conta.status === "ativo" ? "Desativar" : "Ativar"}
                              </DropdownMenuItem>
                            )}
                            {canWrite && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  destructive
                                  onClick={() => setDeleteDialog(conta)}
                                >
                                  Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={closeDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#F87171]">Excluir Conta Manychat</DialogTitle>
          </DialogHeader>

          <p className="text-[#8B8B9E] text-sm">
            Você está prestes a excluir a conta{" "}
            <span className="text-[#F1F1F3] font-semibold">{deleteDialog?.nome}</span>.
          </p>

          {/* Related data warning */}
          <div className="bg-[#2A1616] border border-[#F87171]/20 rounded-lg p-4 space-y-2">
            <p className="text-[#F87171] text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Dados que serão desvinculados
            </p>
            <ul className="text-xs text-[#C4C4D4] space-y-1 ml-6 list-disc">
              <li>{deleteDialog?._count.webhook_flows ?? 0} fluxo(s) de webhook</li>
              <li>{deleteDialog?._count.contatos_vinculados ?? 0} contato(s) vinculado(s)</li>
              <li>{deleteDialog?._count.grupos_monitoramento ?? 0} grupo(s) monitorado(s)</li>
            </ul>
          </div>

          {/* Confirmation input */}
          <div className="space-y-2">
            <p className="text-sm text-[#8B8B9E]">
              Digite <span className="font-mono font-bold text-[#F87171]">excluir</span> para confirmar:
            </p>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="excluir"
              autoComplete="off"
              className="w-full h-10 px-3 rounded-lg border border-[#1E1E2A] bg-[#111118] text-sm text-[#F1F1F3] placeholder-[#5A5A72] focus:outline-none focus:border-[#F87171]/50 transition-colors"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteDialog && handleDelete(deleteDialog)}
              disabled={deleteConfirmText !== "excluir" || actionLoading === deleteDialog?.id + "-delete"}
              loading={actionLoading === deleteDialog?.id + "-delete"}
            >
              Excluir Conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
