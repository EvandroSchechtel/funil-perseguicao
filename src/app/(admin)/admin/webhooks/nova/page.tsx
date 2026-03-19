import { Header } from "@/components/layout/Header"
import { WebhookForm } from "@/components/admin/WebhookForm"

export default function NovoWebhookPage() {
  return (
    <div className="flex flex-col h-full">
      <Header
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Webhooks", href: "/admin/webhooks" },
          { label: "Novo Webhook" },
        ]}
      />

      <div className="p-6 max-w-lg">
        <div className="mb-6">
          <h1 className="text-[#F1F1F3] text-2xl font-bold">Novo Webhook</h1>
          <p className="text-[#8B8B9E] text-sm mt-1">
            Crie um endpoint para receber leads e disparar flows no Manychat
          </p>
        </div>

        <div className="bg-[#16161E] border border-[#1E1E2A] rounded-xl p-6">
          <WebhookForm mode="create" />
        </div>
      </div>
    </div>
  )
}
