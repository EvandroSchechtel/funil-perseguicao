import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import bcrypt from "bcryptjs"

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret")
  if (secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const email = "admin@funilperseguicao.com"
  const password = process.env.ADMIN_INITIAL_PASSWORD || "Admin@2025!"

  const hashed = await bcrypt.hash(password, 12)

  const existing = await prisma.usuario.findFirst({ where: { email, deleted_at: null } })
  if (existing) {
    await prisma.usuario.update({
      where: { id: existing.id },
      data: { senha: hashed, force_password_change: true, status: "ativo" },
    })
    return NextResponse.json({ message: "Senha resetada com sucesso!", email, senha: password })
  }

  await prisma.usuario.create({
    data: {
      nome: "Administrador",
      email,
      senha: hashed,
      role: "super_admin",
      status: "ativo",
      force_password_change: true,
    },
  })

  return NextResponse.json({ message: "Admin criado com sucesso!", email, senha: password })
}
