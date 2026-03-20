"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getRoleDescription, ROLES, type Role } from "@/lib/auth/rbac"
import { useAuth } from "@/contexts/AuthContext"

interface ClienteOption {
  id: string
  nome: string
}

export interface UserFormData {
  nome: string
  email: string
  senha: string
  confirmarSenha: string
  role: Role
  cliente_id?: string | null
  status: "ativo" | "inativo"
  force_password_change: boolean
}

interface UserFormProps {
  mode: "create" | "edit"
  initialData?: Partial<UserFormData>
  onSubmit: (data: UserFormData) => Promise<void>
  loading: boolean
  error?: string
  fieldErrors?: Record<string, string>
  backHref: string
  title: string
  subtitle?: string
}

const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  operador: "Operador",
  viewer: "Viewer",
  cliente: "Cliente",
}

export function UserForm({
  mode,
  initialData,
  onSubmit,
  loading,
  error,
  fieldErrors = {},
  backHref,
  title,
  subtitle,
}: UserFormProps) {
  const { accessToken } = useAuth()
  const [nome, setNome] = useState(initialData?.nome || "")
  const [email, setEmail] = useState(initialData?.email || "")
  const [senha, setSenha] = useState("")
  const [confirmarSenha, setConfirmarSenha] = useState("")
  const [role, setRole] = useState<Role>(initialData?.role || "viewer")
  const [clienteId, setClienteId] = useState<string>(initialData?.cliente_id || "")
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [status, setStatus] = useState<"ativo" | "inativo">(initialData?.status || "ativo")
  const [forcePasswordChange, setForcePasswordChange] = useState(
    initialData?.force_password_change ?? true
  )
  const [showSenha, setShowSenha] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    fetch("/api/admin/clientes?per_page=200", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((d) => setClientes(d.data ?? []))
      .catch(() => {})
  }, [accessToken])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({
      nome,
      email,
      senha,
      confirmarSenha,
      role,
      cliente_id: role === "cliente" ? clienteId || null : null,
      status,
      force_password_change: forcePasswordChange,
    })
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F1F3]">{title}</h1>
          {subtitle && <p className="text-[#8B8B9E] text-sm mt-1">{subtitle}</p>}
        </div>
        <Link href={backHref}>
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        </Link>
      </div>

      <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Nome completo"
            placeholder="Nome do usuário"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            error={fieldErrors.nome}
            required
          />

          <Input
            label="Email"
            type="email"
            placeholder="usuario@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            disabled={mode === "edit"}
            helperText={mode === "edit" ? "O email não pode ser alterado." : undefined}
            required
          />

          {/* Password fields */}
          <Input
            label={mode === "create" ? "Senha" : "Nova senha"}
            type={showSenha ? "text" : "password"}
            placeholder={mode === "edit" ? "Deixe em branco para manter" : "Mínimo 8 caracteres"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            error={fieldErrors.senha}
            helperText={mode === "edit" ? "Deixe em branco para manter a senha atual." : "Mínimo 8 caracteres."}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowSenha(!showSenha)}
                className="text-[#5A5A72] hover:text-[#8B8B9E] transition-colors"
                tabIndex={-1}
              >
                {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            required={mode === "create"}
          />

          {(senha || mode === "create") && (
            <Input
              label="Confirmar senha"
              type={showConfirmar ? "text" : "password"}
              placeholder="Repita a senha"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              error={fieldErrors.confirmarSenha}
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
              required={mode === "create" || !!senha}
            />
          )}

          {/* Role select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-[#F1F1F3]">
              Perfil de acesso <span className="text-[#F87171]">*</span>
            </label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger error={fieldErrors.role}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabels[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {role && (
              <p className="text-xs text-[#5A5A72]">{getRoleDescription(role)}</p>
            )}
            {fieldErrors.role && (
              <p className="text-xs text-[#F87171]">{fieldErrors.role}</p>
            )}
          </div>

          {/* Cliente link — only when role === cliente */}
          {role === "cliente" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[#F1F1F3]">
                Cliente vinculado <span className="text-[#F87171]">*</span>
              </label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger error={fieldErrors.cliente_id}>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.cliente_id && (
                <p className="text-xs text-[#F87171]">{fieldErrors.cliente_id}</p>
              )}
              <p className="text-xs text-[#5A5A72]">
                Este usuário terá acesso ao portal do cliente vinculado.
              </p>
            </div>
          )}

          {/* Status toggle */}
          <div className="flex items-start justify-between gap-4 py-2">
            <div>
              <p className="text-sm font-semibold text-[#F1F1F3]">Status Ativo</p>
              <p className="text-xs text-[#5A5A72] mt-0.5">
                Desative para bloquear o acesso deste usuário.
              </p>
            </div>
            <Switch
              checked={status === "ativo"}
              onCheckedChange={(checked) => setStatus(checked ? "ativo" : "inativo")}
            />
          </div>

          {/* Force password change */}
          <div className="flex items-start justify-between gap-4 py-2 border-t border-[#1E1E2A] pt-4">
            <div>
              <p className="text-sm font-semibold text-[#F1F1F3]">
                Exigir troca de senha no primeiro login
              </p>
              <p className="text-xs text-[#5A5A72] mt-0.5">
                O usuário será obrigado a criar uma nova senha antes de acessar o sistema.
              </p>
            </div>
            <Switch
              checked={forcePasswordChange}
              onCheckedChange={setForcePasswordChange}
            />
          </div>

          {error && (
            <div className="bg-[rgba(239,68,68,0.10)] border border-[rgba(239,68,68,0.20)] rounded-lg px-4 py-3">
              <p className="text-[#F87171] text-sm">{error}</p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={loading}>
              {loading
                ? mode === "create"
                  ? "Criando..."
                  : "Salvando..."
                : mode === "create"
                ? "Criar Usuário"
                : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
