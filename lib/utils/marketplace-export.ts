import type { MarketplaceTemplate, NotissimaExportJSON } from '@/lib/types/marketplace'

export function templateToExportJSON(template: MarketplaceTemplate, isAuthor = false): NotissimaExportJSON {
  const config = template.template_config
  return {
    v: 1,
    name: template.title,
    description: isAuthor ? template.description : '',
    perspectives: config.perspectives ?? [],
    audiences: config.audiences ?? [],
    tone: config.tone ?? 'neutral',
    output_format: config.output_format ?? 'markdown',
    languages: config.languages ?? ['en'],
    domains: config.domains ?? [],
    generation_prompt: isAuthor ? (config.generation_prompt ?? template.instructions ?? '') : '',
    do_include: isAuthor ? (config.do_include ?? '') : '',
    do_not_include: isAuthor ? (config.do_not_include ?? '') : '',
  }
}

export function copyExportJSON(template: MarketplaceTemplate, isAuthor = false): Promise<void> {
  const json = JSON.stringify(templateToExportJSON(template, isAuthor), null, 2)
  return navigator.clipboard.writeText(json)
}

export function downloadExportJSON(template: MarketplaceTemplate, isAuthor = false): void {
  const json = JSON.stringify(templateToExportJSON(template, isAuthor), null, 2)
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
