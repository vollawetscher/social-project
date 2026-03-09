"use client"

import { Link, usePathname } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Mic, FileText, LayoutTemplate, Settings, Phone, Store } from "lucide-react"
import { cn } from "@/lib/utils"

const navItemDefs = [
  { nameKey: "sessions", href: "/sessions", icon: Mic },
  { nameKey: "outputs", href: "/outputs", icon: FileText },
  { nameKey: "calls", href: "/calls", icon: Phone },
  { nameKey: "templates", href: "/templates", icon: LayoutTemplate },
  { nameKey: "marketplace", href: "/marketplace", icon: Store },
  { nameKey: "settings", href: "/settings", icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()
  const t = useTranslations('nav')

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-background">
      <div className="flex items-center justify-around h-16">
        {navItemDefs.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/")
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className="text-[10px] font-medium">{t(item.nameKey)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
