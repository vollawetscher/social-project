'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      
      // Check if user has dismissed the prompt before
      const dismissed = localStorage.getItem('pwa-install-dismissed')
      if (!dismissed) {
        setShowPrompt(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setShowPrompt(false)
    }

    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  if (!showPrompt) return null

  return (
    <Card className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 p-4 shadow-lg border-blue-200 bg-blue-50 z-50">
      <div className="flex items-start gap-3">
        <Download className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 mb-1">
            App installieren
          </h3>
          <p className="text-sm text-blue-700 mb-3">
            Füge die App zum Startbildschirm hinzu für schnellen Zugriff auf Aufnahmen
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleInstall}>
              Installieren
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Später
            </Button>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
          className="flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}
