"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Mic, FileText, LayoutTemplate, Settings, Smartphone } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  {
    name: "Sessions",
    href: "/app/sessions",
    icon: Mic,
  },
  {
    name: "Outputs",
    href: "/app/outputs",
    icon: FileText,
  },
  {
    name: "Templates",
    href: "/app/templates",
    icon: LayoutTemplate,
  },
  {
    name: "Settings",
    href: "/app/settings",
    icon: Settings,
  },
  {
    name: "Caller",
    href: "/mobile",
    icon: Smartphone,
  },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-background">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
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
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
