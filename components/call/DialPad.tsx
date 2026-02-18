"use client"

import { useState } from "react"
import { Phone, Video, Delete } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DialPadProps {
  onCall: (phoneNumber: string, mode: "audio" | "video") => void
  disabled?: boolean
}

const DIALPAD_KEYS = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
  { digit: "*", letters: "" },
  { digit: "0", letters: "+" },
  { digit: "#", letters: "" },
]

export function DialPad({ onCall, disabled }: DialPadProps) {
  const [number, setNumber] = useState("")

  const handlePress = (digit: string) => {
    setNumber((prev) => prev + digit)
  }

  const handleDelete = () => {
    setNumber((prev) => prev.slice(0, -1))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center px-4 py-6 min-h-[72px]">
        <span
          className={cn(
            "font-mono transition-all",
            number.length > 0
              ? "text-2xl font-semibold text-foreground"
              : "text-lg text-muted-foreground"
          )}
        >
          {number || "Enter number"}
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-center px-8 pb-4">
        <div className="grid grid-cols-3 gap-3">
          {DIALPAD_KEYS.map((key) => (
            <button
              key={key.digit}
              onClick={() => handlePress(key.digit)}
              className="flex flex-col items-center justify-center h-16 rounded-full bg-secondary hover:bg-secondary/80 active:bg-muted transition-colors"
            >
              <span className="text-xl font-semibold text-foreground">
                {key.digit}
              </span>
              {key.letters && (
                <span className="text-[10px] text-muted-foreground tracking-wider">
                  {key.letters}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={handleDelete}
            className={cn(
              "h-14 w-14 rounded-full flex items-center justify-center transition-opacity",
              number.length > 0
                ? "opacity-100"
                : "opacity-0 pointer-events-none"
            )}
          >
            <Delete className="h-6 w-6 text-muted-foreground" />
          </button>
          <Button
            size="lg"
            onClick={() => number && onCall(number, "audio")}
            disabled={!number || disabled}
            className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90"
          >
            <Phone className="h-7 w-7" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => number && onCall(number, "video")}
            disabled={!number || disabled}
            className="h-14 w-14 rounded-full bg-info/10 border-info/30 hover:bg-info/20"
          >
            <Video className="h-6 w-6 text-info" />
          </Button>
        </div>
      </div>
    </div>
  )
}
