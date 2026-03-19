import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import bcrypt from "bcryptjs"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(pool as any)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 Iniciando seed do banco de dados...")

  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || "Admin@2025!"

  // 1. Create initial super_admin
  const existingAdmin = await prisma.usuario.findFirst({
    where: { email: "admin@funilperseguicao.com", deleted_at: null },
  })

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(initialPassword, 12)
    await prisma.usuario.create({
      data: {
        nome: "Administrador",
        email: "admin@funilperseguicao.com",
        senha: hashedPassword,
        role: "super_admin",
        status: "ativo",
        force_password_change: true,
      },
    })
    console.log("✅ Super Admin criado: admin@funilperseguicao.com")
    console.log(`   Senha temporária: ${initialPassword}`)
    console.log("   ⚠️  Troca de senha será exigida no primeiro login")
  } else {
    console.log("ℹ️  Super Admin já existe, pulando criação")
  }

  // 2. Development seed — only in non-production
  if (process.env.NODE_ENV !== "production") {
    console.log("\n🔧 Criando usuários de desenvolvimento...")

    const devUsers = [
      {
        nome: "Evandro Schechtel",
        email: "evandro@funilperseguicao.com",
        role: "super_admin" as const,
        force_password_change: false,
      },
      {
        nome: "Maria Operadora",
        email: "maria@funilperseguicao.com",
        role: "operador" as const,
        force_password_change: false,
      },
      {
        nome: "João Viewer",
        email: "joao@funilperseguicao.com",
        role: "viewer" as const,
        force_password_change: false,
      },
    ]

    const devPassword = await bcrypt.hash("Dev@12345!", 12)

    for (const u of devUsers) {
      const existing = await prisma.usuario.findFirst({
        where: { email: u.email, deleted_at: null },
      })

      if (!existing) {
        await prisma.usuario.create({
          data: {
            ...u,
            senha: devPassword,
            status: "ativo",
          },
        })
        console.log(`✅ Usuário de dev criado: ${u.email} (${u.role})`)
      } else {
        console.log(`ℹ️  Usuário já existe: ${u.email}, pulando`)
      }
    }

    console.log("\n📝 Credenciais de desenvolvimento:")
    console.log("   Senha de todos os devs: Dev@12345!")
  }

  console.log("\n✨ Seed concluído com sucesso!")
}

main()
  .catch((e) => {
    console.error("❌ Erro durante o seed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
