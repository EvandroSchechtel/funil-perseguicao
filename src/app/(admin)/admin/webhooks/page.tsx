"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Plus, Search, Webhook, Copy, CheckCircle2, MoreHorizontal, Users2
} from "lucide-react"
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

interface WebhookItem {
  id: string
  nome: string
  token: string
  flow_ns: string
  flow_nome: string | null
  status: "ativo" | "inativo"
  url_publica: string
  leads_count: number
  created_at: string
  conta: { id: string; nome: string; page_name: string | null }
  usuario: { nome: string }
}

export default function WebhooksPage() {
  const { accessToken, user } = useAuth()
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<WebhookItem | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const canWrite = user ? hasPermission(user.role, "webhooks:write") : false
  const canDelete = user ? hasPermission(user.role, "webhooks:delete") : false
  const canToggle = user ? hasPermission(user.role, "webhooks:toggle") : false

  const fetchWebhooks = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: "50", ...(search && { q: search }) })
      const res = await fetch(`/api/admin/webhooks?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setWebhooks(data.webhooks || [])
    } catch {
      toast.error("Erro ao carregar webhooks.")
    } finally {
      setLoading(false)
    }
  }, [accessToken, search])

  useEffect(() => {
    const timer = setTimeout(fetchWebhooks, search ? 400 : 0)
    return () => clearTimeout(timer)
  }, [fetchWebhooks, search])

  async function handleCopy(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
      toast.success("URL copiada!")
    } catch {
      toast.error("Erro ao copiar.")
    }
  }

  async function handleToggle(webhook: WebhookItem) {
    setActionLoading(webhook.id + "-toggle")
    try {
      const res = await fetch(`/api/admin/webhooks/${webhook.id}/toggle`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        fetchWebhooks()
      } else {
        toast.error(data.message || "Erro ao alterar status.")
      }
    } catch {
      toast.error("Erro ao alterar status.")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(webhook: WebhookItem) {
    setActionLoading(webhook.id + "-delete")
    try {
      const res = await fetch(`/api/admin/webhooks/${webhook.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message)
        setDeleteDialog(null)
        fetchWebhooks()
      } else {
        toast.error(data.message || "Erro ao excluir webhook.")
      }
    } catch {
      toast.error("Erro ao excluir webhook.")
    } finally {
      setActionLoading(null)
    }
  }

  function formatDate(str: string) {
    return new Date(str).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
    })
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Webhooks" },
        ]}
      />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[#F1F1F3] text-2xl font-bold">Webhooks</h1>
            <p className="text-[#8B8B9E] text-sm mt-1">Endpoints que recebem leads de fontes externas</p>
          </div>
          {canWrite && (
            <Link href="/admin/webhooks/nova">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Webhook
              </Button>
            </Link>
          )}
        </div>

        {/* Search */}
        <div className="mb-5">
          <Input
            placeholder="Buscar por nome ou Flow NS..."
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
          ) : webhooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#1E1E2A] flex items-center justify-center">
                <Webhook className="w-8 h-8 text-[#25D366]" />
              </div>
              <div className="text-center">
                <p className="text-[#F1F1F3] font-semibold text-lg">
                  {search ? "Nenhum webhook encontrado" : "Nenhum webhook criado"}
                </p>
                <p className="text-[#8B8B9E] text-sm mt-1">
                  {search
                    ? "Tente ajustar os filtros de busca"
                    : "Crie um webhook para começar a receber leads"}
                </p>
              </div>
              {!search && canWrite && (
                <Link href="/admin/webhooks/nova">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Webhook
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E1E2A]">
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Nome</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Conta / Flow</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">URL Pública</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Leads</th>
                  <th className="text-left text-xs font-semibold text-[#5A5A72] uppercase tracking-wider px-5 py-3">Criado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {webhooks.map((wh) => (
                  <tr key={wh.id} className="border-b border-[#1E1E2A] last:border-0 hover:bg-[#1C1C28] transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-[#F1F1F3] font-medium text-sm">{wh.nome}</p>
                      <p className="text-[#5A5A72] text-xs mt-0.5">por {wh.usuario.nome}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[#C4C4D4] text-sm">{wh.conta.nome}</p>
                      <p className="text-[#5A5A72] text-xs mt-0.5 font-mono">
                        {wh.flow_nome || wh.flow_ns.slice(0, 20) + (wh.flow_ns.length > 20 ? "…" : "")}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 max-w-xs">
                        <span className="text-[#5A5A72] text-xs font-mono truncate flex-1">
                          {wh.url_publica}
                        </span>
                        <button
                          onClick={() => handleCopy(wh.url_publica, wh.id)}
                          className="text-[#5A5A72] hover:text-[#25D366] transition-colors shrink-0"
                          title="Copiar URL"
                        >
                          {copiedId === wh.id ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={wh.status === "ativo" ? "ativo" : "inativo"}>
                        {wh.status === "ativo" ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Users2 className="w-3.5 h-3.5 text-[#5A5A72]" />
                        <span className="text-[#C4C4D4] text-sm">{wh.leads_count}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[#8B8B9E] text-sm">{formatDate(wh.created_at)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canWrite && (
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/webhooks/${wh.id}/editar`}>Editar</Link>
                            </DropdownMenuItem>
                          )}
                          {canToggle && (
                            <DropdownMenuItem
                              onClick={() => handleToggle(wh)}
                              disabled={actionLoading === wh.id + "-toggle"}
                            >
                              {wh.status === "ativo" ? "Desativar" : "Ativar"}
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                destructive
                                onClick={() => setDeleteDialog(wh)}
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

      {/* Delete Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Webhook</DialogTitle>
          </DialogHeader>
          <p className="text-[#8B8B9E] text-sm">
            Tem certeza que deseja excluir o webhook{" "}
            <span className="text-[#F1F1F3] font-semibold">{deleteDialog?.nome}</span>?
            Leads já recebidos não serão apagados, mas novos envios para esta URL serão rejeitados.
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
