import { Header } from "@/components/layout/Header"
import { ClienteForm } from "@/components/admin/ClienteForm"

export default function NovoClientePage() {
  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Clientes", href: "/admin/clientes" },
          { label: "Novo Cliente" },
        ]}
      />

      <div className="p-6 max-w-lg">
        <div className="mb-6">
          <h1 className="text-[#F1F1F3] text-2xl font-bold">Novo Cliente</h1>
          <p className="text-[#8B8B9E] text-sm mt-1">
            Cadastre um cliente para associar contas Manychat e campanhas
          </p>
        </div>

        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-6">
          <ClienteForm mode="create" />
        </div>
      </div>
    </div>
  )
}
