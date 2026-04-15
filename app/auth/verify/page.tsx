"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

export default function VerifyPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const tokenHash = searchParams.get("token_hash")
    const type = searchParams.get("type") as "magiclink" | "email" | undefined
    const next = searchParams.get("next") || "/sessions"

    if (!tokenHash || !type) {
      setError("Invalid verification link")
      return
    }

    const supabase = createClient()

    supabase.auth
      .verifyOtp({ token_hash: tokenHash, type })
      .then(({ error: verifyError }: { error: { message: string } | null }) => {
        if (verifyError) {
          console.error("[Verify] OTP verification failed:", verifyError)
          setError(verifyError.message)
          setTimeout(() => router.replace("/login"), 3000)
        } else {
          router.replace(next)
        }
      })
  }, [searchParams, router])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground">Redirecting to login…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Signing you in…
      </div>
    </div>
  )
}
