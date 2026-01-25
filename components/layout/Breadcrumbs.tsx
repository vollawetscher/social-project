'use client'

import { useRouter } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const router = useRouter()

  return (
    <nav className="flex items-center gap-2 text-sm text-slate-600 mb-4">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 hover:bg-slate-100"
        onClick={() => router.push('/dashboard')}
      >
        <Home className="h-4 w-4" />
      </Button>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-slate-400" />
          {item.href ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-slate-100 font-normal"
              onClick={() => router.push(item.href!)}
            >
              {item.label}
            </Button>
          ) : (
            <span className="px-2 font-medium text-slate-900">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  )
}
