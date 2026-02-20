"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/ui/logo"
import { CheckCircle, ArrowRight, Clock } from "lucide-react"

interface CallEndedSignupProps {
  callerName: string
  callId: string
}

export function CallEndedSignup({ callerName, callId }: CallEndedSignupProps) {
  const [email, setEmail] = useState("")

  function saveAndRedirect(path: string) {
    if (callId) {
      localStorage.setItem("pendingCallId", callId)
    }
    const url = new URL(path, window.location.origin)
    if (email) {
      url.searchParams.set("email", email)
    }
    window.location.href = url.toString()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo className="h-8" />
        </div>

        {/* Processing notice */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-warning/15 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">Recording processing</p>
              <p className="text-xs text-muted-foreground">
                Your call with <span className="font-medium text-foreground">{callerName}</span> is being transcribed
              </p>
            </div>
          </div>
        </div>

        {/* CTA card */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">Access your call recording</h1>
            <p className="text-sm text-muted-foreground">
              Create a free 5-day account to view the transcript and AI analysis of your conversation.
            </p>
          </div>

          {/* Benefits */}
          <ul className="space-y-2">
            {[
              "Full transcript with speaker labels",
              "AI-generated meeting summary",
              "Generate reports from the conversation",
            ].map((benefit) => (
              <li key={benefit} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-success shrink-0" />
                {benefit}
              </li>
            ))}
          </ul>

          {/* Email input */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm">
              Your email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              onKeyDown={(e) => {
                if (e.key === "Enter" && email) saveAndRedirect("/signup")
              }}
            />
          </div>

          <Button
            className="w-full"
            onClick={() => saveAndRedirect("/signup")}
            disabled={!email}
          >
            Create free account
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button
              className="text-primary hover:underline font-medium"
              onClick={() => saveAndRedirect("/login")}
            >
              Log in
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Your recording will be ready within a few minutes.
        </p>
      </div>
    </div>
  )
}
