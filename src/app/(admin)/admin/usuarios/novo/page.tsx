"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { Header } from "@/components/layout/Header"
import { UserForm, type UserFormData } from "@/components/admin/UserForm"
import { toast } from "sonner"

export default function NovoUsuarioPage() {
  const { accessToken } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleSubmit(data: UserFormData) {
    setError("")
    setFieldErrors({})

    if (data.senha.length < 8) {
      setFieldErrors({ senha: "Senha deve ter no mínimo 8 caracteres" })
      return
    }

    if (data.senha !== data.confirmarSenha) {
      setFieldErrors({ confirmarSenha: "As senhas não coincidem" })
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          nome: data.nome,
          email: data.email,
          senha: data.senha,
          role: data.role,
          status: data.status,
          force_password_change: data.force_password_change,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        if (result.errors) {
          const flat: Record<string, string> = {}
          Object.entries(result.errors).forEach(([k, v]) => {
            flat[k] = (v as string[])[0]
          })
          setFieldErrors(flat)
        }
        setError(result.message || "Erro ao criar usuário")
        return
      }

      toast.success("Usuário criado com sucesso! Email de boas-vindas enviado.")
      router.push("/admin/usuarios")
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Usuários", href: "/admin/usuarios" },
          { label: "Novo" },
        ]}
      />
      <UserForm
        mode="create"
        onSubmit={handleSubmit}
        loading={loading}
        error={error}
        fieldErrors={fieldErrors}
        backHref="/admin/usuarios"
        title="Novo Usuário"
        subtitle="Crie um novo usuário com acesso ao sistema."
      />
    </div>
  )
}
