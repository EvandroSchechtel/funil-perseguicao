import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || "fallback-secret-change-in-production"
  return new TextEncoder().encode(secret)
}

// Public routes — no auth required
const PUBLIC_ROUTES = [
  "/login",
  "/esqueceu-senha",
  "/redefinir-senha",
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/auth/esqueceu-senha",
  "/api/auth/redefinir-senha",
  "/api/webhook",
  "/api/health",
  "/_next",
  "/favicon.ico",
  "/public",
]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Allow root — redirect based on auth
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Extract JWT from Authorization header or cookie
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

  // For page routes (not API), also try cookie-based token
  // (The client will handle token storage in memory, cookies are for refresh)

  // For API routes — check Authorization header
  if (pathname.startsWith("/api/admin")) {
    if (!token) {
      return NextResponse.json(
        { error: "unauthorized", message: "Token de acesso não fornecido" },
        { status: 401 }
      )
    }

    try {
      const { payload } = await jwtVerify(token, getSecret())

      // Block all admin routes (except trocar-senha/senha) if force_password_change
      if (payload.force_password_change) {
        const allowedWhenForced = ["/api/admin/perfil/senha"]
        if (!allowedWhenForced.some((r) => pathname.startsWith(r))) {
          return NextResponse.json(
            {
              error: "password_change_required",
              message: "Você precisa alterar sua senha antes de continuar.",
            },
            { status: 403 }
          )
        }
      }

      return NextResponse.next()
    } catch {
      return NextResponse.json(
        { error: "token_expired", message: "Token inválido ou expirado" },
        { status: 401 }
      )
    }
  }

  // For page routes under /admin — check the access_token cookie
  if (pathname.startsWith("/admin")) {
    const cookieToken = request.cookies.get("access_token")?.value

    if (!cookieToken) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }

    try {
      const { payload } = await jwtVerify(cookieToken, getSecret())

      // Force password change redirect
      if (payload.force_password_change && pathname !== "/admin/trocar-senha") {
        return NextResponse.redirect(new URL("/admin/trocar-senha", request.url))
      }

      // If already changed but trying to access trocar-senha, redirect to dashboard
      if (!payload.force_password_change && pathname === "/admin/trocar-senha") {
        return NextResponse.redirect(new URL("/admin/manychat", request.url))
      }

      return NextResponse.next()
    } catch {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
}
