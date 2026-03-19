import { NextRequest } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db/prisma"
import { requireRoles } from "@/lib/api/auth-guard"
import { sendEmail } from "@/lib/email"
import { boasVindasTemplate } from "@/lib/email/templates/boas-vindas"
import { ok, created, badRequest, conflict, serverError } from "@/lib/api/response"

// GET — list users
export async function GET(request: NextRequest) {
  try {
    const result = await requireRoles(request, "super_admin")
    if ("error" in result) return result.error

    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get("page") || "1", 10)
    const perPage = parseInt(searchParams.get("per_page") || "20", 10)
    const search = searchParams.get("q") || ""
    const role = searchParams.get("role") || ""

    const where = {
      deleted_at: null,
      ...(search && {
        OR: [
          { nome: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(role && role !== "all" && { role: role as "super_admin" | "admin" | "operador" | "viewer" }),
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
        },
        orderBy: { created_at: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ])

    return ok({
      data: usuarios,
      meta: {
        current_page: page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    })
  } catch (error) {
    console.error("[GET /api/admin/usuarios]", error)
    return serverError()
  }
}

const createSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  senha: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
  role: z.enum(["super_admin", "admin", "operador", "viewer"]),
  status: z.enum(["ativo", "inativo"]).optional().default("ativo"),
  force_password_change: z.boolean().optional().default(true),
})

// POST — create user
export async function POST(request: NextRequest) {
  try {
    const result = await requireRoles(request, "super_admin")
    if ("error" in result) return result.error

    const body = await request.json()
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return badRequest("Dados inválidos", parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { nome, email, senha, role, status, force_password_change } = parsed.data

    const exists = await prisma.usuario.findFirst({
      where: { email: email.toLowerCase(), deleted_at: null },
    })

    if (exists) {
      return conflict("Já existe um usuário com este email.")
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

    // Send welcome email
    const template = boasVindasTemplate({
      nome,
      email: email.toLowerCase(),
      senhaTemporaria: force_password_change ? senha : undefined,
    })
    await sendEmail({ to: email, subject: template.subject, html: template.html, text: template.text })

    return created({ data: usuario })
  } catch (error) {
    console.error("[POST /api/admin/usuarios]", error)
    return serverError()
  }
}
