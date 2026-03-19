import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        ativo: "bg-[rgba(37,211,102,0.15)] text-[#34D67A]",
        inativo: "bg-[rgba(107,114,128,0.15)] text-[#6B7280]",
        enviado: "bg-[rgba(37,211,102,0.15)] text-[#34D67A]",
        falho: "bg-[rgba(239,68,68,0.15)] text-[#F87171]",
        pendente: "bg-[rgba(250,204,21,0.15)] text-[#FACC15]",
        duplicado: "bg-[rgba(251,146,60,0.15)] text-[#FB923C]",
        super_admin: "bg-[rgba(168,85,247,0.15)] text-[#A855F7]",
        admin: "bg-[rgba(59,130,246,0.15)] text-[#60A5FA]",
        operador: "bg-[rgba(37,211,102,0.15)] text-[#34D67A]",
        viewer: "bg-[rgba(107,114,128,0.15)] text-[#6B7280]",
        default: "bg-[rgba(107,114,128,0.15)] text-[#8B8B9E]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
