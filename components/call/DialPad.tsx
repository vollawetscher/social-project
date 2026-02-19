"use client"

import { useState, useRef } from "react"
import { Phone, Delete } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DialPadProps {
  onCall: (phoneNumber: string, mode: "audio" | "video") => void
  disabled?: boolean
  initialNumber?: string
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
  { digit: "+", letters: "" },
  { digit: "0", letters: "" },
  { digit: "#", letters: "" },
]

export function DialPad({ onCall, disabled, initialNumber = "" }: DialPadProps) {
  const [number, setNumber] = useState(initialNumber)
  const inputRef = useRef<HTMLInputElement>(null)

  const handlePress = (digit: string) => {
    setNumber((prev) => prev + digit)
    inputRef.current?.focus()
  }

  const handleDelete = () => {
    setNumber((prev) => prev.slice(0, -1))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow digits, +, spaces, dashes, parens — anything a phone number might contain
    const val = e.target.value.replace(/[^\d+\s\-().]/g, "")
    setNumber(val)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Editable number display */}
      <div className="flex items-center justify-center gap-2 px-6 py-5 min-h-[72px]">
        <input
          ref={inputRef}
          type="text"
          inputMode="none"
          value={number}
          onChange={handleInputChange}
          placeholder="Enter number"
          className={cn(
            "flex-1 bg-transparent text-center font-mono outline-none border-none",
            "placeholder:text-muted-foreground/50",
            number.length > 0
              ? "text-2xl font-semibold text-foreground"
              : "text-lg text-muted-foreground"
          )}
        />
        {number.length > 0 && (
          <button
            onClick={handleDelete}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Delete"
          >
            <Delete className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center px-8 pb-4">
        <div className="grid grid-cols-3 gap-3">
          {DIALPAD_KEYS.map((key) => (
            <button
              key={key.digit}
              onClick={() => handlePress(key.digit)}
              className="flex flex-col items-center justify-center h-16 rounded-full bg-secondary hover:bg-secondary/80 active:bg-muted transition-colors"
            >
              <span className={cn(
                "font-semibold text-foreground",
                key.digit === "+" ? "text-2xl" : "text-xl"
              )}>
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

        <div className="flex items-center justify-center mt-6">
          <Button
            size="icon"
            onClick={() => number && onCall(number, "audio")}
            disabled={!number || disabled}
            className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90"
          >
            <Phone className="h-7 w-7" />
          </Button>
        </div>
      </div>
    </div>
  )
}
