import type { MarketplaceTemplate, NotissimaExportJSON } from '@/lib/types/marketplace'

export function templateToExportJSON(template: MarketplaceTemplate): NotissimaExportJSON {
  const config = template.template_config
  return {
    v: 1,
    name: template.title,
    description: template.description,
    perspectives: config.perspectives ?? [],
    audiences: config.audiences ?? [],
    tone: config.tone ?? 'neutral',
    output_format: config.output_format ?? 'markdown',
    languages: config.languages ?? ['en'],
    domains: config.domains ?? [],
    generation_prompt: config.generation_prompt ?? template.instructions ?? '',
    do_include: config.do_include ?? '',
    do_not_include: config.do_not_include ?? '',
  }
}

export function copyExportJSON(template: MarketplaceTemplate): Promise<void> {
  const json = JSON.stringify(templateToExportJSON(template), null, 2)
  return navigator.clipboard.writeText(json)
}

export function downloadExportJSON(template: MarketplaceTemplate): void {
  const json = JSON.stringify(templateToExportJSON(template), null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${template.title.toLowerCase().replace(/\s+/g, '-')}.notissima.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
