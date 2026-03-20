"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Wifi } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Header } from "@/components/layout/Header"
import { toast } from "sonner"

export default function NovaInstanciaPage() {
  const router = useRouter()
  const { accessToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nome: "",
    instance_id: "",
    token: "",
    client_token: "",
  })

  function setField(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
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
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Instância conectada com sucesso.")
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
          { label: "Z-API / Grupos WA", href: "/admin/zapi" },
          { label: "Nova Instância" },
        ]}
      />

      <div className="p-6 max-w-lg">
        <Link
          href="/admin/zapi"
          className="inline-flex items-center gap-2 text-[#8B8B9E] hover:text-[#F1F1F3] text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>

        <div className="mb-6">
          <h1 className="text-[#F1F1F3] text-2xl font-bold">Conectar Instância Z-API</h1>
          <p className="text-[#8B8B9E] text-sm mt-1">
            Adicione uma instância do Z-API para monitorar grupos do WhatsApp
          </p>
        </div>

        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#8B8B9E] uppercase tracking-wider">
                Nome da instância <span className="text-[#F87171]">*</span>
              </label>
              <Input
                placeholder="Ex: WhatsApp Principal"
                value={form.nome}
                onChange={setField("nome")}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#8B8B9E] uppercase tracking-wider">
                Instance ID (Z-API) <span className="text-[#F87171]">*</span>
              </label>
              <Input
                placeholder="Ex: 3C0A9..."
                value={form.instance_id}
                onChange={setField("instance_id")}
              />
              <p className="text-xs text-[#5A5A72]">
                Encontrado no painel Z-API → sua instância
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#8B8B9E] uppercase tracking-wider">
                Token <span className="text-[#F87171]">*</span>
              </label>
              <Input
                type="password"
                placeholder="Token de acesso Z-API"
                value={form.token}
                onChange={setField("token")}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#8B8B9E] uppercase tracking-wider">
                Client Token <span className="text-[#F87171]">*</span>
              </label>
              <Input
                type="password"
                placeholder="Client token Z-API"
                value={form.client_token}
                onChange={setField("client_token")}
              />
              <p className="text-xs text-[#5A5A72]">
                Encontrado em Z-API → Security → Client Token
              </p>
            </div>

            <div className="pt-2 flex gap-3">
              <Button type="submit" loading={loading} className="flex-1">
                <Wifi className="w-4 h-4 mr-2" />
                Conectar e Salvar
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
