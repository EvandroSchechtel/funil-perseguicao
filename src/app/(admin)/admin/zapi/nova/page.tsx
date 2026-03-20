"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Wifi, Info } from "lucide-react"
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

export default function NovaInstanciaPage() {
  const router = useRouter()
  const { accessToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [form, setForm] = useState({
    nome: "",
    instance_id: "",
    token: "",
    client_token: "",
    cliente_id: "",
  })

  useEffect(() => {
    if (!accessToken) return
    fetch("/api/admin/clientes?per_page=200", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((d) => setClientes(d.clientes || []))
      .catch(() => {})
  }, [accessToken])

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome || !form.instance_id || !form.token || !form.client_token) {
      toast.error("Preencha todos os campos obrigatórios.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/admin/zapi/instancias", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ ...form, cliente_id: form.cliente_id || undefined }),
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
                  autoFocus
                />
                <FieldHint>Um nome descritivo para identificar esta instância na plataforma.</FieldHint>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#9898B0]">
                  Cliente vinculado
                </label>
                <select
                  value={form.cliente_id}
                  onChange={set("cliente_id")}
                  className="w-full h-10 bg-[#13131F] border border-[#1C1C2C] text-[#EEEEF5] text-sm rounded-lg px-3 focus:outline-none focus:border-[#25D366]/50 focus:shadow-[0_0_0_2px_rgba(37,211,102,0.1)] transition-all appearance-none cursor-pointer"
                >
                  <option value="" className="bg-[#13131F] text-[#7F7F9E]">
                    — Selecionar cliente (opcional) —
                  </option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#13131F]">
                      {c.nome}
                    </option>
                  ))}
                </select>
                <FieldHint>
                  Vincule ao cliente para que os grupos desta instância possam ser associados
                  às campanhas dele.
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
