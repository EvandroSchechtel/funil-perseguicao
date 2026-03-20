"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"

export interface AuthUser {
  id: string
  nome: string
  email: string
  role: "super_admin" | "admin" | "operador" | "viewer" | "cliente"
  avatar_url: string | null
  force_password_change: boolean
  cliente_id?: string | null
}

interface AuthContextType {
  user: AuthUser | null
  accessToken: string | null
  loading: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ error?: string }>
  logout: () => Promise<void>
  refreshToken: () => Promise<boolean>
  updateUser: (updates: Partial<AuthUser>) => void
  setAccessToken: (token: string) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessTokenState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const setAccessToken = useCallback((token: string) => {
    setAccessTokenState(token)
    if (typeof window !== "undefined") {
      localStorage.setItem("at", token)
      // Set cookie for proxy page route protection (matches JWT 15min = 900s)
      document.cookie = `access_token=${token}; Path=/; SameSite=Strict; Max-Age=900`
    }
  }, [])

  const fetchMe = useCallback(async (token: string): Promise<AuthUser | null> => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.user
    } catch {
      return null
    }
  }, [])

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST" })
      if (!res.ok) return false
      const data = await res.json()
      const newToken = data.access_token
      setAccessToken(newToken)
      const userData = await fetchMe(newToken)
      if (userData) setUser(userData)
      return true
    } catch {
      return false
    }
  }, [setAccessToken, fetchMe])

  // Initialize: try to restore session from localStorage or refresh cookie
  // Uses retry logic to survive brief downtime during Railway deployments
  useEffect(() => {
    const init = async () => {
      const storedToken = typeof window !== "undefined" ? localStorage.getItem("at") : null

      if (storedToken) {
        const userData = await fetchMe(storedToken)
        if (userData) {
          setAccessTokenState(storedToken)
          setUser(userData)
          setLoading(false)
          return
        }
      }

      // Token expired or missing — try refresh with retries (handles deploy restarts)
      let refreshed = false
      for (let attempt = 0; attempt < 3 && !refreshed; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1500))
        refreshed = await refreshToken()
      }

      if (!refreshed && typeof window !== "undefined") {
        localStorage.removeItem("at")
      }

      setLoading(false)
    }

    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh token 2 minutes before expiry (every 13 minutes)
  useEffect(() => {
    if (!accessToken) return

    const interval = setInterval(
      () => {
        refreshToken()
      },
      13 * 60 * 1000
    )

    return () => clearInterval(interval)
  }, [accessToken, refreshToken])

  const login = useCallback(
    async (email: string, password: string, rememberMe = false): Promise<{ error?: string }> => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, rememberMe }),
        })

        const data = await res.json()

        if (!res.ok) {
          return { error: data.message || "Erro ao fazer login" }
        }

        setAccessToken(data.access_token)
        setUser(data.user)

        return {}
      } catch {
        return { error: "Erro de conexão. Tente novamente." }
      }
    },
    [setAccessToken]
  )

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {}

    setUser(null)
    setAccessTokenState(null)
    if (typeof window !== "undefined") {
      localStorage.removeItem("at")
      document.cookie = "access_token=; Path=/; SameSite=Strict; Max-Age=0"
    }
    router.push("/login")
  }, [router])

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev))
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        login,
        logout,
        refreshToken,
        updateUser,
        setAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
