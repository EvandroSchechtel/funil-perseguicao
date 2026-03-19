"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface ClienteFormProps {
  mode: "create" | "edit"
  initialData?: {
    id: string
    nome: string
    email: string | null
    telefone: string | null
  }
}

export function ClienteForm({ mode, initialData }: ClienteFormProps) {
  const { accessToken } = useAuth()
  const router = useRouter()

  const [nome, setNome] = useState(initialData?.nome || "")
  const [email, setEmail] = useState(initialData?.email || "")
  const [telefone, setTelefone] = useState(initialData?.telefone || "")
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const newErrors: Record<string, string> = {}
    if (!nome.trim()) newErrors.nome = "Nome é obrigatório"

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        nome: nome.trim(),
        email: email.trim() || null,
        telefone: telefone.trim() || null,
      }

      const url =
        mode === "create"
          ? "/api/admin/clientes"
          : `/api/admin/clientes/${initialData!.id}`

      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.errors) {
          const fieldErrors: Record<string, string> = {}
          for (const [key, msgs] of Object.entries(data.errors)) {
            fieldErrors[key] = (msgs as string[])[0]
          }
          setErrors(fieldErrors)
        } else {
          toast.error(data.message || "Erro ao salvar cliente.")
        }
        return
      }

      toast.success(data.message || (mode === "create" ? "Cliente criado!" : "Cliente atualizado!"))
      router.push("/admin/clientes")
      router.refresh()
    } catch {
      toast.error("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Nome"
        placeholder="Ex: Empresa ABC, João Silva..."
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        error={errors.nome}
        required
      />

      <Input
        label="Email (opcional)"
        placeholder="contato@empresa.com"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />

      <Input
        label="Telefone (opcional)"
        placeholder="(11) 99999-9999"
        value={telefone}
        onChange={(e) => setTelefone(e.target.value)}
        error={errors.telefone}
      />

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading} className="flex-1">
          {loading
            ? mode === "create" ? "Criando..." : "Salvando..."
            : mode === "create" ? "Criar Cliente" : "Salvar Alterações"}
        </Button>
      </div>
    </form>
  )
}
