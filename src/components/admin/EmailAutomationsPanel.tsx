import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, CheckSquare, Eye, FileText, GitBranch, Loader2, Target, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  fetchEmailAutomations, fetchEmailTemplates, previewEmailTemplate, setEmailAutomationsEnabled, updateEmailAutomation,
  type EmailAutomationRule, type EmailAutomationState, type EmailTemplate,
} from "@/lib/crm-api"
import { cn } from "@/lib/utils"

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback)

const GROUPS: Record<string, { icon: LucideIcon; description: string }> = {
  task: { icon: CheckSquare, description: "Sent when a task linked to a student changes. Only the title and date are shared, never the description." },
  application: { icon: FileText, description: "Sent when an application moves to a new status. Any note the counselor adds is included." },
  stage: { icon: GitBranch, description: "Sent when a student moves along the pipeline." },
  lead: { icon: Target, description: "Sent when a lead status changes. The status label itself is not shown to the student." },
}

function Switch({ checked, onChange, disabled, label }: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-emerald-600" : "bg-muted-foreground/30",
      )}
    >
      <span className={cn("absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  )
}

function RuleRow({ rule, templates, disabled, onChange, onPreview }: {
  rule: EmailAutomationRule
  templates: EmailTemplate[]
  disabled: boolean
  onChange: (change: { enabled?: boolean; template?: number }) => void
  onPreview: (template: EmailTemplate) => void
}) {
  const current = templates.find((t) => t.id === rule.template)
  const broken = rule.enabled && !rule.template_active
  return (
    <div className="grid items-center gap-x-3 gap-y-2 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]">
      <div className="flex min-w-0 items-center gap-3">
        <Switch checked={rule.enabled} disabled={disabled || !rule.template} onChange={(enabled) => onChange({ enabled })} label={`Email on ${rule.label}`} />
        <span className="min-w-0 truncate text-sm font-medium" title={rule.label}>{rule.label}</span>
      </div>
      <Select value={rule.template ? String(rule.template) : undefined} onValueChange={(v) => onChange({ template: Number(v) })} disabled={disabled}>
        <SelectTrigger className={cn("h-9 min-w-0 text-sm", broken && "border-amber-500")}>
          <SelectValue placeholder="Choose a template" />
        </SelectTrigger>
        <SelectContent>
          {templates.filter((t) => t.is_active || t.id === rule.template).map((t) => (
            <SelectItem key={t.id} value={String(t.id)}>{t.name}{t.is_active ? "" : " (inactive)"}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="ghost" size="sm" className="h-9 justify-start gap-1.5" disabled={!current} onClick={() => current && onPreview(current)}>
        <Eye className="h-4 w-4" /> Preview
      </Button>
      {broken ? (
        <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 sm:col-span-3">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> This email will not send until you choose an active template.
        </p>
      ) : null}
    </div>
  )
}

export function EmailAutomationsPanel() {
  const [state, setState] = useState<EmailAutomationState | null>(null)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)

  useEffect(() => {
    // Reloaded each time the tab opens, so template edits made next door show up.
    Promise.all([fetchEmailAutomations(), fetchEmailTemplates(true)])
      .then(([automations, library]) => { setState(automations); setTemplates(library) })
      .catch((err) => toast.error(errorMessage(err, "Could not load automated emails")))
  }, [])

  const save = async (request: () => Promise<EmailAutomationState>) => {
    setSaving(true)
    try {
      setState(await request())
    } catch (err) {
      toast.error(errorMessage(err, "Could not save that change"))
    } finally {
      setSaving(false)
    }
  }

  const showPreview = async (event: string, template: EmailTemplate) => {
    try {
      setPreview(await previewEmailTemplate({
        subject: template.subject, body: template.body, cta_label: template.cta_label, cta_url: template.cta_url, event,
      }))
    } catch (err) {
      toast.error(errorMessage(err, "Could not load the preview"))
    }
  }

  const activeCount = useMemo(
    () => state?.groups.flatMap((g) => g.rules).filter((r) => r.enabled && r.template_active).length ?? 0,
    [state],
  )

  if (!state) {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-5">
        <div>
          <p className="font-semibold">Automated emails to students</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {state.enabled
              ? `On. ${activeCount} events send an email automatically, signed by the student's counselor.`
              : "Off. No automated email is sent, whatever the settings below."}
          </p>
        </div>
        <Switch checked={state.enabled} disabled={saving} onChange={(next) => void save(() => setEmailAutomationsEnabled(next))} label="Automated emails" />
      </div>

      <div className={cn("grid gap-6 xl:grid-cols-2", !state.enabled && "opacity-60")}>
        {state.groups.map((group) => {
          const meta = GROUPS[group.key]
          const Icon = meta.icon
          return (
            <section key={group.key} className="rounded-2xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-emerald-600" />
                <h3 className="font-semibold">{group.label}</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
              <div className="mt-3 divide-y">
                {group.rules.map((rule) => (
                  <RuleRow
                    key={rule.event} rule={rule} templates={templates} disabled={saving}
                    onChange={(change) => void save(() => updateEmailAutomation(rule.event, change))}
                    onPreview={(template) => void showPreview(rule.event, template)}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <Dialog open={preview !== null} onOpenChange={(open) => { if (!open) setPreview(null) }}>
        <DialogContent className="max-h-[94vh] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.subject}</DialogTitle>
            <DialogDescription>Shown with sample details. Edit the wording in the Templates tab.</DialogDescription>
          </DialogHeader>
          {preview ? <iframe title="Automated email preview" srcDoc={preview.html} sandbox="" className="h-[65vh] w-full rounded-lg border bg-white" /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
