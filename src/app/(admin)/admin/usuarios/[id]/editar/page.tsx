"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { Header } from "@/components/layout/Header"
import { UserForm, type UserFormData } from "@/components/admin/UserForm"
import { toast } from "sonner"
import type { Role } from "@/lib/auth/rbac"

interface EditarUsuarioPageProps {
  params: Promise<{ id: string }>
}

export default function EditarUsuarioPage({ params }: EditarUsuarioPageProps) {
  const { accessToken } = useAuth()
  const router = useRouter()
  const [usuarioId, setUsuarioId] = useState<string>("")
  const [usuarioNome, setUsuarioNome] = useState<string>("")
  const [initialData, setInitialData] = useState<Partial<UserFormData> | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    params.then(({ id }) => {
      setUsuarioId(id)
      fetchUsuario(id)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchUsuario(id: string) {
    try {
      const res = await fetch(`/api/admin/usuarios/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error("Não encontrado")
      const data = await res.json()
      const u = data.data
      setUsuarioNome(u.nome)
      setInitialData({
        nome: u.nome,
        email: u.email,
        role: u.role as Role,
        status: u.status,
        force_password_change: u.force_password_change,
      })
    } catch {
      toast.error("Usuário não encontrado")
      router.push("/admin/usuarios")
    } finally {
      setFetching(false)
    }
  }

  async function handleSubmit(data: UserFormData) {
    setError("")
    setFieldErrors({})

    if (data.senha && data.senha.length < 8) {
      setFieldErrors({ senha: "Senha deve ter no mínimo 8 caracteres" })
      return
    }

    if (data.senha && data.senha !== data.confirmarSenha) {
      setFieldErrors({ confirmarSenha: "As senhas não coincidem" })
      return
    }

    setLoading(true)

    try {
      const body: Record<string, unknown> = {
        nome: data.nome,
        role: data.role,
        status: data.status,
        force_password_change: data.force_password_change,
      }
      if (data.senha) body.senha = data.senha

      const res = await fetch(`/api/admin/usuarios/${usuarioId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
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
        setError(result.message || "Erro ao salvar")
        return
      }

      toast.success("Usuário atualizado com sucesso!")
      router.push("/admin/usuarios")
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="flex flex-col h-full">
        <Header breadcrumbs={[{ label: "Admin" }, { label: "Usuários", href: "/admin/usuarios" }, { label: "Editar" }]} />
        <div className="flex items-center justify-center p-20">
          <div className="animate-spin w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Usuários", href: "/admin/usuarios" },
          { label: `Editar ${usuarioNome}` },
        ]}
      />
      {initialData && (
        <UserForm
          mode="edit"
          initialData={initialData}
          onSubmit={handleSubmit}
          loading={loading}
          error={error}
          fieldErrors={fieldErrors}
          backHref="/admin/usuarios"
          title={`Editar ${usuarioNome}`}
          subtitle="Atualize as informações do usuário."
        />
      )}
    </div>
  )
}
