"use client"

import React, { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { AlertasProvider } from "@/contexts/AlertasContext"
import { VarreduraProvider } from "@/contexts/VarreduraContext"
import { Sidebar } from "@/components/layout/Sidebar"
import { VarreduraProgressPanel } from "@/components/admin/VarreduraProgressPanel"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
      return
    }

    // Cliente role não acessa /admin — redireciona ao portal
    if (user.role === "cliente") {
      router.push("/portal")
      return
    }

    // Force password change redirect
    if (user.force_password_change && pathname !== "/admin/trocar-senha") {
      router.push("/admin/trocar-senha")
      return
    }

    // Prevent accessing trocar-senha if not needed
    if (!user.force_password_change && pathname === "/admin/trocar-senha") {
      router.push("/admin/usuarios")
      return
    }
  }, [user, loading, pathname, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0F] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) return null

  // Force password change — no sidebar
  if (pathname === "/admin/trocar-senha") {
    return (
      <div className="min-h-screen bg-[#0B0B0F] flex items-center justify-center p-4">
        {children}
      </div>
    )
  }

  return (
    <AlertasProvider>
      <VarreduraProvider>
        <div className="min-h-screen bg-[#0B0B0F]">
          <Sidebar />
          <main className="ml-64 min-h-screen">
            {children}
          </main>
          <VarreduraProgressPanel />
        </div>
      </VarreduraProvider>
    </AlertasProvider>
  )
}
