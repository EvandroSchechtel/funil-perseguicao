import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider } from "@/contexts/AuthContext"
import { Toaster } from "sonner"

export const metadata: Metadata = {
  title: "Funil Perseguição",
  description: "Sistema de Gerenciamento de Webhooks",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <AuthProvider>
          {children}
          <Toaster
            theme="dark"
            position="top-right"
            toastOptions={{
              style: {
                background: "#16161E",
                border: "1px solid #1E1E2A",
                color: "#F1F1F3",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
