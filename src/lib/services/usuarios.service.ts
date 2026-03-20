import bcrypt from "bcryptjs"
import crypto from "crypto"
import { prisma } from "@/lib/db/prisma"
import { revokeAllUserTokens } from "@/lib/auth/refresh-token"
import { sendEmail } from "@/lib/email"
import { boasVindasTemplate } from "@/lib/email/templates/boas-vindas"
import { ServiceError } from "./errors"

export interface ListUsuariosParams {
  page?: number
  perPage?: number
  search?: string
  role?: string
}

export async function listarUsuarios(params: ListUsuariosParams = {}) {
  const { page = 1, perPage = 20, search = "", role = "" } = params

  const where = {
    deleted_at: null,
    ...(search && {
      OR: [
        { nome: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(role && role !== "all" && { role: role as "super_admin" | "admin" | "operador" | "viewer" | "cliente" }),
  }

  const [total, usuarios] = await Promise.all([
    prisma.usuario.count({ where }),
    prisma.usuario.findMany({
      where,
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        avatar_url: true,
        status: true,
        ultimo_login: true,
        created_at: true,
        cliente_id: true,
        cliente_vinculado: { select: { id: true, nome: true } },
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ])

  return {
    data: usuarios,
    meta: { current_page: page, per_page: perPage, total, total_pages: Math.ceil(total / perPage) },
  }
}

export async function buscarUsuario(id: string) {
  const usuario = await prisma.usuario.findFirst({
    where: { id, deleted_at: null },
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      cliente_id: true,
      avatar_url: true,
      status: true,
      force_password_change: true,
      ultimo_login: true,
      created_at: true,
      updated_at: true,
    },
  })

  if (!usuario) throw new ServiceError("not_found", "Usuário não encontrado")
  return { data: usuario }
}

export interface CriarUsuarioParams {
  nome: string
  email: string
  senha: string
  role: "super_admin" | "admin" | "operador" | "viewer" | "cliente"
  cliente_id?: string | null
  status?: "ativo" | "inativo"
  force_password_change?: boolean
}

export async function criarUsuario(params: CriarUsuarioParams) {
  const { nome, email, senha, role, cliente_id, status = "ativo", force_password_change = true } = params

  const exists = await prisma.usuario.findFirst({
    where: { email: email.toLowerCase(), deleted_at: null },
  })
  if (exists) throw new ServiceError("conflict", "Já existe um usuário com este email.")

  if (role === "cliente" && !cliente_id) {
    throw new ServiceError("validation", "Usuários com perfil Cliente devem estar vinculados a um cliente.")
  }

  const hashedPassword = await bcrypt.hash(senha, 12)

  const usuario = await prisma.usuario.create({
    data: {
      nome,
      email: email.toLowerCase(),
      senha: hashedPassword,
      role,
      status,
      force_password_change,
      ...(cliente_id ? { cliente_id } : {}),
    },
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      status: true,
      force_password_change: true,
      created_at: true,
    },
  })

  const template = boasVindasTemplate({
    nome,
    email: email.toLowerCase(),
    senhaTemporaria: force_password_change ? senha : undefined,
  })
  await sendEmail({ to: email, subject: template.subject, html: template.html, text: template.text })

  return { data: usuario }
}

export interface AtualizarUsuarioParams {
  nome?: string
  role?: "super_admin" | "admin" | "operador" | "viewer" | "cliente"
  cliente_id?: string | null
  status?: "ativo" | "inativo"
  senha?: string
  force_password_change?: boolean
}

export async function atualizarUsuario(id: string, data: AtualizarUsuarioParams, currentUserId: string) {
  const usuario = await prisma.usuario.findFirst({ where: { id, deleted_at: null } })
  if (!usuario) throw new ServiceError("not_found", "Usuário não encontrado")

  const { nome, role, cliente_id, status, senha, force_password_change } = data

  if (role === "cliente" && cliente_id === undefined && !usuario.cliente_id) {
    throw new ServiceError("validation", "Usuários com perfil Cliente devem estar vinculados a um cliente.")
  }

  if (role && role !== "super_admin" && usuario.role === "super_admin") {
    const superAdminCount = await prisma.usuario.count({
      where: { role: "super_admin", deleted_at: null, status: "ativo" },
    })
    if (superAdminCount <= 1) {
      throw new ServiceError("forbidden", "Não é possível alterar o perfil do único super_admin do sistema.")
    }
  }

  const updateData: Record<string, unknown> = {}
  if (nome !== undefined) updateData.nome = nome
  if (role !== undefined) updateData.role = role
  if (cliente_id !== undefined) updateData.cliente_id = cliente_id
  if (status !== undefined) updateData.status = status
  if (force_password_change !== undefined) updateData.force_password_change = force_password_change
  if (senha) updateData.senha = await bcrypt.hash(senha, 12)

  if (status === "inativo" && usuario.status === "ativo") {
    await revokeAllUserTokens(id)
  }

  const updated = await prisma.usuario.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      status: true,
      force_password_change: true,
      updated_at: true,
    },
  })

  return { data: updated }
}

export async function deletarUsuario(id: string, currentUserId: string) {
  if (id === currentUserId) {
    throw new ServiceError("forbidden", "Você não pode excluir sua própria conta.")
  }

  const usuario = await prisma.usuario.findFirst({ where: { id, deleted_at: null } })
  if (!usuario) throw new ServiceError("not_found", "Usuário não encontrado")

  if (usuario.role === "super_admin") {
    const count = await prisma.usuario.count({ where: { role: "super_admin", deleted_at: null } })
    if (count <= 1) {
      throw new ServiceError("forbidden", "Não é possível excluir o único super_admin do sistema.")
    }
  }

  await revokeAllUserTokens(id)
  await prisma.usuario.update({ where: { id }, data: { deleted_at: new Date() } })

  return { message: "Usuário excluído com sucesso." }
}

export async function toggleUsuario(id: string, currentUserId: string) {
  if (id === currentUserId) {
    throw new ServiceError("forbidden", "Você não pode desativar sua própria conta.")
  }

  const usuario = await prisma.usuario.findFirst({ where: { id, deleted_at: null } })
  if (!usuario) throw new ServiceError("not_found", "Usuário não encontrado")

  const novoStatus = usuario.status === "ativo" ? "inativo" : "ativo"

  if (novoStatus === "inativo" && usuario.role === "super_admin") {
    const count = await prisma.usuario.count({
      where: { role: "super_admin", status: "ativo", deleted_at: null },
    })
    if (count <= 1) {
      throw new ServiceError("forbidden", "Não é possível desativar o único super_admin ativo do sistema.")
    }
  }

  if (novoStatus === "inativo") {
    await revokeAllUserTokens(id)
  }

  const updated = await prisma.usuario.update({
    where: { id },
    data: { status: novoStatus },
    select: { id: true, status: true },
  })

  return { data: updated }
}

export async function resetarSenha(id: string) {
  const usuario = await prisma.usuario.findFirst({ where: { id, deleted_at: null } })
  if (!usuario) throw new ServiceError("not_found", "Usuário não encontrado")

  const tempPassword = crypto.randomBytes(8).toString("base64url").slice(0, 12)
  const hashedPassword = await bcrypt.hash(tempPassword, 12)

  await prisma.usuario.update({
    where: { id },
    data: { senha: hashedPassword, force_password_change: true },
  })

  await revokeAllUserTokens(id)

  const template = boasVindasTemplate({
    nome: usuario.nome,
    email: usuario.email,
    senhaTemporaria: tempPassword,
  })
  await sendEmail({
    to: usuario.email,
    subject: "Sua senha foi redefinida — Funil Perseguição",
    html: template.html,
    text: template.text,
  })

  return { message: "Senha resetada. O usuário receberá um email com as novas credenciais." }
}
