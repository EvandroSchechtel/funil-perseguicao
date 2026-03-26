"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Wifi, Info, Search, ChevronDown, CheckCircle2, Lock } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Header } from "@/components/layout/Header"
import { toast } from "sonner"

interface Cliente {
  id: string
  nome: string
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[11px] text-[#3F3F58] mt-1.5">
      <Info className="w-3 h-3 mt-0.5 shrink-0" />
      {children}
    </p>
  )
}

function ClienteSearchSelect({
  clientes,
  loading,
  value,
  onChange,
  error,
}: {
  clientes: Cliente[]
  loading: boolean
  value: string
  onChange: (id: string) => void
  error?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  const selected = clientes.find((c) => c.id === value)
  const filtered = clientes.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={loading}
        onClick={() => { setOpen((v) => !v); setSearch("") }}
        className={`flex h-10 w-full items-center justify-between rounded-lg border bg-[#13131F] px-3 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-40 hover:border-[#252535] focus:outline-none ${
          error
            ? "border-[#F87171] focus:border-[#F87171]"
            : "border-[#1C1C2C] focus:border-[#25D366]/50"
        }`}
      >
        <span className={selected ? "text-[#EEEEF5]" : "text-[#3F3F58]"}>
          {loading ? "Carregando clientes…" : selected ? selected.nome : "— Selecionar cliente —"}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-[#3F3F58] shrink-0" />
      </button>

      {open && !loading && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-[#1C1C2C] bg-[#0F0F1A] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <div className="p-2 border-b border-[#1C1C2C]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#3F3F58]" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full bg-[#13131F] rounded-lg border border-[#1C1C2C] text-sm text-[#EEEEF5] placeholder-[#3F3F58] pl-7 pr-3 py-1.5 focus:outline-none focus:border-[#25D366]/40"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-[#3F3F58] text-xs text-center py-4">Nenhum cliente encontrado</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(c.id); setOpen(false); setSearch("") }}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-[#13131F] transition-colors text-left gap-2"
                >
                  <span className="text-[#EEEEF5] truncate">{c.nome}</span>
                  {c.id === value && <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-[#F87171] mt-1.5">{error}</p>}
    </div>
  )
}

export default function NovaInstanciaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clienteIdFromUrl = searchParams.get("cliente_id") || ""
  const { accessToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    nome: "",
    instance_id: "",
    token: "",
    client_token: "",
    cliente_id: clienteIdFromUrl,
  })

  useEffect(() => {
    if (!accessToken) return
    fetch("/api/admin/clientes?per_page=200", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((d) => setClientes(d.data || []))
      .catch(() => {})
      .finally(() => setLoadingClientes(false))
  }, [accessToken])

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const newErrors: Record<string, string> = {}
    if (!form.nome.trim()) newErrors.nome = "Nome é obrigatório"
    if (!form.cliente_id) newErrors.cliente_id = "Cliente é obrigatório"
    if (!form.instance_id.trim()) newErrors.instance_id = "Instance ID é obrigatório"
    if (!form.token.trim()) newErrors.token = "Token é obrigatório"
    if (!form.client_token.trim()) newErrors.client_token = "Client Token é obrigatório"

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    setLoading(true)
    try {
      const res = await fetch("/api/admin/zapi/instancias", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Instância conectada com sucesso.")
        router.push(`/admin/zapi/${data.instancia?.id ?? ""}`)
      } else {
        toast.error(data.message || "Erro ao criar instância.")
      }
    } catch {
      toast.error("Erro de conexão.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Z-API / WhatsApp", href: "/admin/zapi" },
          { label: "Nova Instância" },
        ]}
      />

      <div className="p-6 max-w-xl">
        <Link
          href="/admin/zapi"
          className="inline-flex items-center gap-2 text-[#7F7F9E] hover:text-[#EEEEF5] text-sm mb-7 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Z-API
        </Link>

        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 rounded-xl bg-[#22C55E]/10 flex items-center justify-center">
            <Wifi className="w-5 h-5 text-[#22C55E]" />
          </div>
          <div>
            <h1 className="text-[#EEEEF5] text-xl font-bold">Conectar Instância Z-API</h1>
            <p className="text-[#7F7F9E] text-xs mt-0.5">
              Configure as credenciais para monitorar grupos do WhatsApp
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-[#0F0F1A] border border-[#1C1C2C] rounded-2xl shadow-[0_4px_32px_rgba(0,0,0,0.45)] overflow-hidden">
            {/* Section: Identificação */}
            <div className="px-6 pt-6 pb-5 space-y-4 border-b border-[#1C1C2C]">
              <p className="text-[#3F3F58] text-[10px] font-semibold uppercase tracking-widest">
                Identificação
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9898B0]">
                  Nome da instância <span className="text-[#F87171]">*</span>
                </label>
                <Input
                  placeholder="Ex: WhatsApp Mari Tortella"
                  value={form.nome}
                  onChange={set("nome")}
                  error={errors.nome}
                  autoFocus
                />
                <FieldHint>Um nome descritivo para identificar esta instância na plataforma.</FieldHint>
              </div>

              {/* Cliente — obrigatório e imutável */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9898B0] flex items-center gap-1.5">
                  Cliente vinculado <span className="text-[#F87171]">*</span>
                  <span className="flex items-center gap-0.5 text-[#3F3F58] text-[10px] font-normal">
                    <Lock className="w-2.5 h-2.5" />
                    imutável após criação
                  </span>
                </label>
                {clienteIdFromUrl ? (
                  // Auto-selecionado via URL — exibir como somente leitura
                  <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-[#1C1C2C] bg-[#13131F] px-3 text-sm text-[#EEEEF5] opacity-70 cursor-not-allowed">
                    <Lock className="w-3.5 h-3.5 text-[#3F3F58] shrink-0" />
                    {loadingClientes
                      ? "Carregando…"
                      : clientes.find((c) => c.id === clienteIdFromUrl)?.nome ?? clienteIdFromUrl}
                  </div>
                ) : (
                  <ClienteSearchSelect
                    clientes={clientes}
                    loading={loadingClientes}
                    value={form.cliente_id}
                    onChange={(id) => setForm((p) => ({ ...p, cliente_id: id }))}
                    error={errors.cliente_id}
                  />
                )}
                {errors.cliente_id && !clienteIdFromUrl && (
                  <p className="text-xs text-[#F87171]">{errors.cliente_id}</p>
                )}
                <FieldHint>
                  Vincula grupos desta instância às campanhas do cliente.{" "}
                  <strong className="text-[#5A5A72]">Não pode ser alterado após salvar.</strong>
                </FieldHint>
              </div>
            </div>

            {/* Section: Credenciais */}
            <div className="px-6 py-5 space-y-4">
              <p className="text-[#3F3F58] text-[10px] font-semibold uppercase tracking-widest">
                Credenciais Z-API
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9898B0]">
                  Instance ID <span className="text-[#F87171]">*</span>
                </label>
                <Input
                  placeholder="Ex: 3C0A9B2..."
                  value={form.instance_id}
                  onChange={set("instance_id")}
                  error={errors.instance_id}
                />
                <FieldHint>Painel Z-API → sua instância → copiar Instance ID.</FieldHint>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9898B0]">
                  Token <span className="text-[#F87171]">*</span>
                </label>
                <Input
                  type="password"
                  placeholder="Token de acesso da instância"
                  value={form.token}
                  onChange={set("token")}
                  error={errors.token}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9898B0]">
                  Client Token <span className="text-[#F87171]">*</span>
                </label>
                <Input
                  type="password"
                  placeholder="Client token Z-API"
                  value={form.client_token}
                  onChange={set("client_token")}
                  error={errors.client_token}
                />
                <FieldHint>
                  Z-API → Security → Client Token (diferente do token da instância).
                </FieldHint>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-[#0A0A12] border-t border-[#1C1C2C] flex gap-3">
              <Button type="submit" loading={loading} className="flex-1 shadow-lg shadow-[#25D366]/10">
                <Wifi className="w-4 h-4" />
                Conectar e Salvar
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
