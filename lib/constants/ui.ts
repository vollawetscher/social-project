/**
 * Shared UI constants for consistent styling and labeling across the app
 */

import { FileText, MessageSquare, Mic, ListTodo, Plus, Loader2, CheckCircle2 } from 'lucide-react'
import { FilePurpose } from '@/lib/types/database'

/**
 * File purpose labels with icons
 */
export const FILE_PURPOSE_CONFIG = {
  context: { 
    icon: FileText, 
    label: 'Kontext',
    color: 'text-blue-600'
  },
  meeting: { 
    icon: MessageSquare, 
    label: 'Besprechung',
    color: 'text-purple-600'
  },
  dictation: { 
    icon: Mic, 
    label: 'Diktat',
    color: 'text-green-600'
  },
  instruction: { 
    icon: ListTodo, 
    label: 'Anweisungen',
    color: 'text-amber-600'
  },
  addition: { 
    icon: Plus, 
    label: 'Ergänzung',
    color: 'text-slate-600'
  },
} as const

/**
 * Session status configuration
 */
export const SESSION_STATUS_CONFIG = {
  created: {
    variant: 'secondary' as const,
    label: 'Bereit',
    icon: FileText,
    color: 'text-slate-600'
  },
  uploading: {
    variant: 'default' as const,
    label: 'Wird hochgeladen',
    icon: Loader2,
    color: 'text-blue-600',
    animated: true
  },
  transcribing: {
    variant: 'default' as const,
    label: 'Wird transkribiert',
    icon: Mic,
    color: 'text-purple-600',
    animated: true
  },
  summarizing: {
    variant: 'default' as const,
    label: 'Wird zusammengefasst',
    icon: Loader2,
    color: 'text-blue-600',
    animated: true
  },
  done: {
    variant: 'outline' as const,
    label: 'Abgeschlossen',
    icon: CheckCircle2,
    color: 'text-green-600'
  },
  error: {
    variant: 'destructive' as const,
    label: 'Fehler',
    icon: FileText,
    color: 'text-red-600'
  },
} as const

/**
 * Processing statuses that require polling
 */
export const PROCESSING_STATUSES = ['uploading', 'transcribing', 'summarizing'] as const

/**
 * Mobile tap target minimum size (WCAG 2.1)
 */
export const MIN_TAP_TARGET_SIZE = 44 // pixels

/**
 * Polling intervals (milliseconds)
 */
export const POLLING_INTERVALS = {
  SESSION_STATUS: 5000, // 5 seconds - reduced from 3s
  SLOW_POLLING: 10000, // 10 seconds for background polling
} as const
