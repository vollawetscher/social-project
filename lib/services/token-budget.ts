import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/server'

export type TokenBudgetTask = 'session_analyze' | 'output_generate'
export type OutputLengthPreference = 'short' | 'medium' | 'long'

type BudgetDefaults = {
  minTokens: number
  maxTokens: number
  scalingFactor: number
}

type TokenBudgetRow = {
  id: string
  task: string
  model: string | null
  template_id: string | null
  min_tokens: number
  max_tokens: number
  scaling_factor: number
  is_active: boolean
  updated_at?: string
}

export type ResolveTokenBudgetInput = {
  task: TokenBudgetTask
  model: string
  promptChars?: number
  templateId?: string | null
  lengthPreference?: OutputLengthPreference
}

export type ResolvedTokenBudget = {
  maxTokens: number
  minTokens: number
  ceilingTokens: number
  scalingFactor: number
  estimatedInputTokens: number
  source: 'default' | 'db'
  budgetId?: string
  lengthPreference?: OutputLengthPreference
}

const LENGTH_MULTIPLIER: Record<OutputLengthPreference, number> = {
  short: 0.7,
  medium: 1.0,
  long: 1.35,
}

const DEFAULT_BUDGETS: Record<TokenBudgetTask, BudgetDefaults> = {
  session_analyze: {
    minTokens: 2500,
    maxTokens: 4096,
    scalingFactor: 1.1,
  },
  output_generate: {
    minTokens: 900,
    maxTokens: 16384,
    scalingFactor: 1.4,
  },
}

function estimateTokensFromChars(chars: number): number {
  // Fast approximation for English/mixed content.
  return Math.max(1, Math.ceil(chars / 4))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function pickBestBudgetRow(
  rows: TokenBudgetRow[],
  input: ResolveTokenBudgetInput
): TokenBudgetRow | null {
  if (!rows.length) return null
  const byTask = rows.filter((r) => r.task === input.task && r.is_active)
  if (!byTask.length) return null

  const exactTemplateAndModel = byTask.find(
    (r) => r.template_id === (input.templateId || null) && r.model === input.model
  )
  if (exactTemplateAndModel) return exactTemplateAndModel

  const templateAnyModel = byTask.find(
    (r) => r.template_id === (input.templateId || null) && r.model == null
  )
  if (templateAnyModel) return templateAnyModel

  const taskModel = byTask.find((r) => r.template_id == null && r.model === input.model)
  if (taskModel) return taskModel

  const taskDefault = byTask.find((r) => r.template_id == null && r.model == null)
  if (taskDefault) return taskDefault

  return null
}

export async function resolveTokenBudget(
  input: ResolveTokenBudgetInput,
  supabase?: SupabaseClient
): Promise<ResolvedTokenBudget> {
  const defaults = DEFAULT_BUDGETS[input.task]
  const promptChars = Math.max(0, input.promptChars || 0)
  const estimatedInputTokens = estimateTokensFromChars(promptChars)
  const lengthMultiplier = input.lengthPreference ? LENGTH_MULTIPLIER[input.lengthPreference] : 1

  try {
    const db = supabase || createServiceRoleClient()
    const { data, error } = await db
      .from('ai_token_budgets')
      .select('id, task, model, template_id, min_tokens, max_tokens, scaling_factor, is_active, updated_at')
      .eq('task', input.task)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(100)

    if (error || !Array.isArray(data)) {
      const fallbackMax = clamp(
        Math.round(estimatedInputTokens * defaults.scalingFactor * lengthMultiplier),
        defaults.minTokens,
        defaults.maxTokens
      )
      return {
        maxTokens: fallbackMax,
        minTokens: defaults.minTokens,
        ceilingTokens: defaults.maxTokens,
        scalingFactor: defaults.scalingFactor,
        estimatedInputTokens,
        source: 'default',
        lengthPreference: input.lengthPreference,
      }
    }

    const best = pickBestBudgetRow(data as TokenBudgetRow[], input)
    if (!best) {
      const fallbackMax = clamp(
        Math.round(estimatedInputTokens * defaults.scalingFactor * lengthMultiplier),
        defaults.minTokens,
        defaults.maxTokens
      )
      return {
        maxTokens: fallbackMax,
        minTokens: defaults.minTokens,
        ceilingTokens: defaults.maxTokens,
        scalingFactor: defaults.scalingFactor,
        estimatedInputTokens,
        source: 'default',
        lengthPreference: input.lengthPreference,
      }
    }

    const dynamicMax = clamp(
      Math.round(
        estimatedInputTokens *
          Number(best.scaling_factor || defaults.scalingFactor) *
          (input.lengthPreference ? LENGTH_MULTIPLIER[input.lengthPreference] : 1)
      ),
      Number(best.min_tokens || defaults.minTokens),
      Number(best.max_tokens || defaults.maxTokens)
    )

    return {
      maxTokens: dynamicMax,
      minTokens: Number(best.min_tokens || defaults.minTokens),
      ceilingTokens: Number(best.max_tokens || defaults.maxTokens),
      scalingFactor: Number(best.scaling_factor || defaults.scalingFactor),
      estimatedInputTokens,
      source: 'db',
      budgetId: best.id,
      lengthPreference: input.lengthPreference,
    }
  } catch {
    const fallbackMax = clamp(
      Math.round(estimatedInputTokens * defaults.scalingFactor * lengthMultiplier),
      defaults.minTokens,
      defaults.maxTokens
    )
    return {
      maxTokens: fallbackMax,
      minTokens: defaults.minTokens,
      ceilingTokens: defaults.maxTokens,
      scalingFactor: defaults.scalingFactor,
      estimatedInputTokens,
      source: 'default',
      lengthPreference: input.lengthPreference,
    }
  }
}
