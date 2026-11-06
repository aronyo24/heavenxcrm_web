import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  Braces, Copy, Download, FileUp, Loader2, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Trash2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  createEmailTemplate, deleteEmailTemplate, duplicateEmailTemplate, exportEmailTemplates, fetchEmailPlaceholders,
  fetchEmailTemplates, importEmailTemplates, previewEmailTemplate, restoreDefaultEmailTemplates, updateEmailTemplate,
  type EmailPlaceholder, type EmailTemplate, type EmailTemplateCategory, type EmailTemplateInput,
} from "@/lib/crm-api"
import { invalidateEmailTemplateCache } from "@/lib/email-template-cache"
import { cn } from "@/lib/utils"

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback)

// One colour per stage of the admission journey, so the library scans at a glance.
const CATEGORY_TONE: Record<EmailTemplateCategory, string> = {
  enquiry: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  follow_up: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  documents: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  application: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  offer: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  visa: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  payment: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  event: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  automated: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  general: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
}

const EMPTY: EmailTemplateInput = {
  name: "", category: "general", subject: "", body: "", cta_label: "", cta_url: "", is_active: true,
}

const SAMPLE_CSV = [
  "name,category,subject,body,cta_label,cta_url",
  '"Scholarship deadline",payment,"{first_name}, scholarship deadline is near","The scholarship for {course} closes soon.\nReply to this email to apply.",,',
].join("\n")

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

interface EditorProps {
  template: EmailTemplate | null
  categories: { key: EmailTemplateCategory; label: string }[]
  placeholders: EmailPlaceholder[]
  eventPlaceholders: EmailPlaceholder[]
  onSaved: () => void
}

function TemplateEditor({ open, onOpenChange, ...props }: EditorProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [saving, setSaving] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next) }}>
      <DialogContent className="flex max-h-[94vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <TemplateEditorForm {...props} saving={saving} setSaving={setSaving} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function TemplateEditorForm({ template, categories, placeholders, eventPlaceholders, onSaved, saving, setSaving, onClose }: EditorProps & {
  saving: boolean
  setSaving: (saving: boolean) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<EmailTemplateInput>(() => (template ? {
    name: template.name, category: template.category, subject: template.subject, body: template.body,
    cta_label: template.cta_label, cta_url: template.cta_url, is_active: template.is_active,
  } : EMPTY))
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const subjectRef = useRef<HTMLInputElement>(null)
  const lastFocused = useRef<"subject" | "body">("body")

  // Live preview, rendered by the server with the real email layout and sample values.
  useEffect(() => {
    if (!form.subject && !form.body) return
    const timer = setTimeout(() => {
      previewEmailTemplate({ subject: form.subject, body: form.body, cta_label: form.cta_label, cta_url: form.cta_url })
        .then(setPreview)
        .catch(() => {})
    }, 450)
    return () => clearTimeout(timer)
  }, [form.subject, form.body, form.cta_label, form.cta_url])

  const set = <K extends keyof EmailTemplateInput>(key: K, value: EmailTemplateInput[K]) => setForm((f) => ({ ...f, [key]: value }))

  const insertToken = (key: string) => {
    const token = `{${key}}`
    const field = lastFocused.current
    const el = field === "subject" ? subjectRef.current : bodyRef.current
    const value = form[field]
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    set(field, value.slice(0, start) + token + value.slice(end))
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length) })
  }

  const canSave = form.name.trim() && form.subject.trim() && form.body.trim() && !saving

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...form, name: form.name.trim(), subject: form.subject.trim(), cta_url: form.cta_url.trim() }
      if (template) await updateEmailTemplate(template.id, payload)
      else await createEmailTemplate(payload)
      toast.success(template ? "Template updated" : "Template created")
      onSaved()
      onClose()
    } catch (err) {
      toast.error(errorMessage(err, "Could not save the template"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
        <DialogHeader className="border-b px-6 py-4 text-left">
          <DialogTitle>{template ? "Edit template" : "New email template"}</DialogTitle>
          <DialogDescription>
            Use fields like <code className="text-xs">{"{first_name}"}</code> - they're filled in for each student.
            The greeting, counselor name and company signature are added automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-2">
          <div className="space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-name">Template name</Label>
                <Input id="tpl-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Offer letter received" />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => set("category", v as EmailTemplateCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-end justify-between">
                <Label htmlFor="tpl-subject">Subject</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                      <Braces className="h-3.5 w-3.5" /> Insert field
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-1.5" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <div className="max-h-64 overflow-y-auto">
                      {(form.category === "automated" ? [...eventPlaceholders, ...placeholders] : placeholders).map((p) => (
                        <button
                          key={p.key} type="button" onClick={() => insertToken(p.key)}
                          className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          <span>{p.label}</span>
                          <code className="text-[11px] text-muted-foreground">{`{${p.key}}`}</code>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Input
                id="tpl-subject" ref={subjectRef} value={form.subject}
                onFocus={() => { lastFocused.current = "subject" }}
                onChange={(e) => set("subject", e.target.value)}
                placeholder="{first_name}, your application update"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-body">Message</Label>
              <Textarea
                id="tpl-body" ref={bodyRef} rows={12} value={form.body}
                onFocus={() => { lastFocused.current = "body" }}
                onChange={(e) => set("body", e.target.value)}
                className="text-sm leading-relaxed"
                placeholder={"Good news - your application for {course} has been submitted…"}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-cta">Button text <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="tpl-cta" value={form.cta_label} onChange={(e) => set("cta_label", e.target.value)} placeholder="Open your dashboard" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-url">Button link <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="tpl-url" value={form.cta_url} onChange={(e) => set("cta_url", e.target.value)} placeholder="https://… (default: student dashboard)" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} className="h-4 w-4 accent-emerald-600" />
              Available to counselors in the email composer
            </label>
          </div>

          <div className="border-t bg-muted/30 p-6 lg:border-l lg:border-t-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live preview · sample student</p>
            {preview ? (
              <div className="overflow-hidden rounded-lg border bg-card">
                <p className="truncate border-b px-3 py-2 text-sm font-medium">{preview.subject || "(no subject)"}</p>
                <iframe title="Template preview" srcDoc={preview.html} sandbox="" className="h-[520px] w-full bg-white" />
              </div>
            ) : (
              <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                Start typing to see the email
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {template ? "Save changes" : "Create template"}
          </Button>
        </DialogFooter>
    </>
  )
}

function ImportDialog({ open, onOpenChange, onImported }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [overwrite, setOverwrite] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (busy) return
    if (next) { setFile(null); setOverwrite(false) }
    onOpenChange(next)
  }

  const handleImport = async () => {
    if (!file) return
    setBusy(true)
    try {
      const res = await importEmailTemplates(file, overwrite)
      toast.success(`Imported ${res.created} new template${res.created === 1 ? "" : "s"}`, {
        description: [res.updated ? `${res.updated} updated` : "", res.skipped ? `${res.skipped} skipped (name already exists)` : ""]
          .filter(Boolean).join(" · ") || undefined,
      })
      onImported()
      setFile(null)
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err, "Import failed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import email templates</DialogTitle>
          <DialogDescription>Bring in templates from another CRM, a colleague's export, or your own files.</DialogDescription>
        </DialogHeader>

        <label
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/5",
            file && "border-emerald-500/60 bg-emerald-500/5",
          )}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); setFile(e.dataTransfer.files[0] ?? null) }}
        >
          <FileUp className="h-7 w-7 text-emerald-600" />
          <span className="text-sm font-medium">{file ? file.name : "Choose or drop a file"}</span>
          <span className="text-xs text-muted-foreground">.json, .csv, .html or .txt · up to 2 MB</span>
          <input type="file" accept=".json,.csv,.html,.htm,.txt" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>

        <ul className="space-y-1.5 rounded-xl bg-muted/40 p-4 text-xs text-muted-foreground">
          <li><strong className="text-foreground">JSON</strong> - a file exported from this page (Export button).</li>
          <li>
            <strong className="text-foreground">CSV</strong> - columns <code>name, category, subject, body</code> (optional <code>cta_label, cta_url</code>).{" "}
            <button type="button" className="text-emerald-700 underline dark:text-emerald-400" onClick={() => downloadBlob(new Blob([SAMPLE_CSV], { type: "text/csv" }), "email-templates-sample.csv")}>
              Download a sample
            </button>
          </li>
          <li><strong className="text-foreground">HTML / TXT</strong> - one email per file. The subject comes from the page title or a first line starting with "Subject:".</li>
        </ul>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
          Replace templates that have the same name
        </label>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={() => void handleImport()} disabled={!file || busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EmailTemplatesManager() {
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null)
  const [categories, setCategories] = useState<{ key: EmailTemplateCategory; label: string }[]>([])
  const [placeholders, setPlaceholders] = useState<EmailPlaceholder[]>([])
  const [eventPlaceholders, setEventPlaceholders] = useState<EmailPlaceholder[]>([])
  const [category, setCategory] = useState<EmailTemplateCategory | "all">("all")
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  const load = useCallback(() => {
    invalidateEmailTemplateCache()
    return fetchEmailTemplates(true)
      .then(setTemplates)
      .catch((err) => {
        toast.error(errorMessage(err, "Could not load templates"))
        setTemplates([])
      })
  }, [])

  useEffect(() => {
    void load()
    fetchEmailPlaceholders()
      .then((r) => { setCategories(r.categories); setPlaceholders(r.placeholders); setEventPlaceholders(r.event_placeholders) })
      .catch(() => {})
  }, [load])

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of templates ?? []) map.set(t.category, (map.get(t.category) ?? 0) + 1)
    return map
  }, [templates])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (templates ?? []).filter((t) =>
      (category === "all" || t.category === category)
      && (!term || `${t.name} ${t.subject} ${t.body}`.toLowerCase().includes(term)))
  }, [templates, category, search])

  const openEditor = (template: EmailTemplate | null) => {
    setEditing(template)
    setEditorOpen(true)
  }

  const run = async (fn: () => Promise<unknown>, success: string, failure: string) => {
    try {
      await fn()
      toast.success(success)
      await load()
    } catch (err) {
      toast.error(errorMessage(err, failure))
    }
  }

  const handleExport = async () => {
    try {
      downloadBlob(await exportEmailTemplates(), `email-templates-${new Date().toISOString().slice(0, 10)}.json`)
    } catch (err) {
      toast.error(errorMessage(err, "Export failed"))
    }
  }

  const handleRestore = async () => {
    try {
      const { created } = await restoreDefaultEmailTemplates()
      toast.success(created ? `Added ${created} starter template${created === 1 ? "" : "s"}` : "All starter templates are already in your library")
      await load()
    } catch (err) {
      toast.error(errorMessage(err, "Could not restore templates"))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates…" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><FileUp className="mr-2 h-4 w-4" /> Import</Button>
          <Button variant="outline" size="sm" onClick={() => void handleExport()}><Download className="mr-2 h-4 w-4" /> Export</Button>
          <Button variant="outline" size="sm" onClick={() => void handleRestore()} title="Add any starter templates missing from your library">
            <RotateCcw className="mr-2 h-4 w-4" /> Starter templates
          </Button>
          <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => openEditor(null)}>
            <Plus className="mr-2 h-4 w-4" /> New template
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[{ key: "all" as const, label: "All" }, ...categories].map((c) => {
          const count = c.key === "all" ? templates?.length ?? 0 : counts.get(c.key) ?? 0
          return (
            <button
              key={c.key} type="button" onClick={() => setCategory(c.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                category === c.key ? "border-emerald-600 bg-emerald-600 text-white" : "hover:border-emerald-500/60 hover:bg-emerald-500/5",
              )}
            >
              {c.label} <span className={category === c.key ? "text-white/70" : "text-muted-foreground"}>{count}</span>
            </button>
          )
        })}
      </div>

      {templates === null ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl border bg-muted/40" />)}
        </div>
      ) : visible.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((t) => (
            <article
              key={t.id}
              className={cn("group flex flex-col rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md", !t.is_active && "opacity-60")}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", CATEGORY_TONE[t.category])}>{t.category_label}</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-7 w-7" aria-label={`Actions for ${t.name}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-44 p-1">
                    <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted" onClick={() => openEditor(t)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      onClick={() => void run(() => duplicateEmailTemplate(t.id), "Copy created (inactive until you enable it)", "Could not duplicate")}>
                      <Copy className="h-3.5 w-3.5" /> Duplicate
                    </button>
                    <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmDelete(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </PopoverContent>
                </Popover>
              </div>
              <button type="button" onClick={() => openEditor(t)} className="mt-2 flex-1 text-left">
                <h3 className="font-semibold leading-snug">{t.name}</h3>
                <p className="mt-1 truncate text-sm text-foreground/80">{t.subject}</p>
                <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{t.body}</p>
              </button>
              {confirmDelete === t.id ? (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs">
                  <span className="text-destructive">Delete this template?</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setConfirmDelete(null)}>Keep</Button>
                    <Button size="sm" variant="destructive" className="h-7"
                      onClick={() => { setConfirmDelete(null); void run(() => deleteEmailTemplate(t.id), "Template deleted", "Could not delete") }}>
                      Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>{t.usage_count ? `Used ${t.usage_count}×` : "Not used yet"}</span>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    {t.is_active ? <Badge variant="secondary" className="font-normal">Active</Badge> : <span>Hidden</span>}
                    <input
                      type="checkbox" checked={t.is_active} className="h-3.5 w-3.5 accent-emerald-600"
                      aria-label={t.is_active ? "Hide from counselors" : "Show to counselors"}
                      onChange={() => void run(() => updateEmailTemplate(t.id, { is_active: !t.is_active }),
                        t.is_active ? "Hidden from counselors" : "Available to counselors", "Could not update")}
                    />
                  </label>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-medium">No templates {search || category !== "all" ? "match" : "yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Create one, import a file, or add the starter templates.</p>
        </div>
      )}

      <TemplateEditor
        open={editorOpen} onOpenChange={setEditorOpen} template={editing}
        categories={categories} placeholders={placeholders} eventPlaceholders={eventPlaceholders} onSaved={() => void load()}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => void load()} />
    </div>
  )
}
