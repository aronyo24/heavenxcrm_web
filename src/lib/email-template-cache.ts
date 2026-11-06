import { fetchEmailPlaceholders, fetchEmailTemplates, type EmailPlaceholder, type EmailTemplate } from "@/lib/crm-api"

// Templates and merge fields change rarely - the composer loads them once per
// page visit; the admin template manager invalidates after every change.
let templates: Promise<EmailTemplate[]> | null = null
let placeholders: Promise<EmailPlaceholder[]> | null = null

export function loadComposerTemplates(): Promise<EmailTemplate[]> {
  templates ??= fetchEmailTemplates().catch((err) => { templates = null; throw err })
  return templates
}

export function loadPlaceholders(): Promise<EmailPlaceholder[]> {
  placeholders ??= fetchEmailPlaceholders().then((r) => r.placeholders).catch((err) => { placeholders = null; throw err })
  return placeholders
}

export function invalidateEmailTemplateCache() {
  templates = null
}
