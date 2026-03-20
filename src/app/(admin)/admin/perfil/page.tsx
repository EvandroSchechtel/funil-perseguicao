"use client"

import React, { useState } from "react"
import { Eye, EyeOff, User } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import type { Role } from "@/lib/auth/rbac"

const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  operador: "Operador",
  viewer: "Viewer",
  cliente: "Cliente",
}

function getInitials(nome: string) {
  return nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
}

export default function PerfilPage() {
  const { user, accessToken, updateUser, setAccessToken } = useAuth()

  // Info form
  const [nome, setNome] = useState(user?.nome || "")
  const [savingInfo, setSavingInfo] = useState(false)

  // Password form
  const [senhaAtual, setSenhaAtual] = useState("")
  const [novaSenha, setNovaSenha] = useState("")
  const [confirmarSenha, setConfirmarSenha] = useState("")
  const [showSenhaAtual, setShowSenhaAtual] = useState(false)
  const [showNovaSenha, setShowNovaSenha] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return

    setSavingInfo(true)
    try {
      const res = await fetch("/api/admin/perfil", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ nome }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.message || "Erro ao salvar")
        return
      }

      updateUser({ nome: data.data.nome })
      toast.success("Perfil atualizado com sucesso!")
    } catch {
      toast.error("Erro de conexão")
    } finally {
      setSavingInfo(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordErrors({})

    if (novaSenha.length < 8) {
      setPasswordErrors({ novaSenha: "Mínimo 8 caracteres" })
      return
    }

    if (novaSenha !== confirmarSenha) {
      setPasswordErrors({ confirmarSenha: "As senhas não coincidem" })
      return
    }

    setSavingPassword(true)
    try {
      const res = await fetch("/api/admin/perfil/senha", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ senhaAtual, novaSenha, confirmarSenha }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.error === "wrong_password") {
          setPasswordErrors({ senhaAtual: "Senha atual incorreta" })
        } else {
          toast.error(data.message || "Erro ao alterar senha")
        }
        return
      }

      // Update access token
      if (data.access_token) {
        setAccessToken(data.access_token)
      }

      setSenhaAtual("")
      setNovaSenha("")
      setConfirmarSenha("")
      toast.success("Senha alterada com sucesso!")
    } catch {
      toast.error("Erro de conexão")
    } finally {
      setSavingPassword(false)
    }
  }

  if (!user) return null

  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Meu Perfil" },
        ]}
      />

      <div className="p-6 max-w-2xl space-y-6">
        {/* Profile info */}
        <Card>
          <CardHeader>
            <CardTitle>Informações do Perfil</CardTitle>
            <CardDescription>Atualize seu nome e foto de perfil.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="w-16 h-16">
                <AvatarImage src={user.avatar_url || ""} alt={user.nome} />
                <AvatarFallback className="text-lg">{getInitials(user.nome)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-[#F1F1F3] font-semibold">{user.nome}</p>
                <p className="text-[#8B8B9E] text-sm">{user.email}</p>
                <Badge variant={user.role as "super_admin" | "admin" | "operador" | "viewer" | "cliente"} className="mt-1">
                  {roleLabels[user.role as Role]}
                </Badge>
              </div>
            </div>

            <form onSubmit={handleSaveInfo} className="space-y-4">
              <Input
                label="Nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-[#F1F1F3]">Email</label>
                <div className="flex h-10 items-center rounded-lg border border-[#1E1E2A] bg-[#111118] px-3 text-sm text-[#5A5A72]">
                  {user.email}
                </div>
                <p className="text-xs text-[#5A5A72]">O email não pode ser alterado.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-[#F1F1F3]">Membro desde</label>
                <div className="flex h-10 items-center rounded-lg border border-[#1E1E2A] bg-[#111118] px-3 text-sm text-[#5A5A72]">
                  {new Date(user.id ? Date.now() : Date.now()).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" loading={savingInfo}>
                  Salvar Informações
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card>
          <CardHeader>
            <CardTitle>Alterar Senha</CardTitle>
            <CardDescription>Mantenha sua conta segura com uma senha forte.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <Input
                label="Senha atual"
                type={showSenhaAtual ? "text" : "password"}
                placeholder="Digite sua senha atual"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                error={passwordErrors.senhaAtual}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowSenhaAtual(!showSenhaAtual)}
                    className="text-[#5A5A72] hover:text-[#8B8B9E] transition-colors"
                    tabIndex={-1}
                  >
                    {showSenhaAtual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                required
              />

              <Input
                label="Nova senha"
                type={showNovaSenha ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                error={passwordErrors.novaSenha}
                helperText="Mínimo 8 caracteres"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowNovaSenha(!showNovaSenha)}
                    className="text-[#5A5A72] hover:text-[#8B8B9E] transition-colors"
                    tabIndex={-1}
                  >
                    {showNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                required
              />

              <Input
                label="Confirmar nova senha"
                type={showConfirmar ? "text" : "password"}
                placeholder="Repita a nova senha"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                error={passwordErrors.confirmarSenha}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmar(!showConfirmar)}
                    className="text-[#5A5A72] hover:text-[#8B8B9E] transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                required
              />

              <div className="flex justify-end">
                <Button type="submit" loading={savingPassword}>
                  Alterar Senha
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
