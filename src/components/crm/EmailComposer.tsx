import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle, Braces, Eye, FileText, Loader2, Mail, Paperclip, PenLine, Send, Users, X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import {
  bulkEmailStudents, previewEmailTemplate, sendStudentEmail, type EmailPlaceholder, type EmailTemplate,
} from "@/lib/crm-api"
import { loadComposerTemplates, loadPlaceholders } from "@/lib/email-template-cache"
import { cn } from "@/lib/utils"

export interface EmailRecipient {
  id: number
  full_name: string
  email: string
}

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/
const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".txt", ".csv"]
const MAX_FILES = 5
const MAX_TOTAL_BYTES = 20 * 1024 * 1024

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

/** Chip input for extra addresses: Enter, comma, space or leaving the field adds one. */
function AddressInput({ id, values, onChange, placeholder }: {
  id: string
  values: string[]
  onChange: (next: string[]) => void
  placeholder: string
}) {
  const [draft, setDraft] = useState("")
  const commit = (raw: string) => {
    const parts = raw.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean)
    if (!parts.length) return
    const bad = parts.filter((p) => !EMAIL_RE.test(p))
    const good = parts.filter((p) => EMAIL_RE.test(p) && !values.some((v) => v.toLowerCase() === p.toLowerCase()))
    if (good.length) onChange([...values, ...good])
    setDraft(bad.join(" "))
    if (bad.length) toast.error(`"${bad[0]}" is not a valid email address`)
  }
  return (
    <div className="flex min-h-9 flex-1 flex-wrap items-center gap-1.5 py-1">
      {values.map((addr) => (
        <span key={addr} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pl-2.5 pr-1 text-xs">
          {addr}
          <button
            type="button" onClick={() => onChange(values.filter((v) => v !== addr))}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground" aria-label={`Remove ${addr}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (["Enter", ",", ";", " ", "Tab"].includes(e.key) && draft.trim()) {
            e.preventDefault()
            commit(draft)
          } else if (e.key === "Backspace" && !draft && values.length) {
            onChange(values.slice(0, -1))
          }
        }}
        onPaste={(e) => {
          e.preventDefault()
          commit(draft + e.clipboardData.getData("text"))
        }}
        onBlur={() => commit(draft)}
        placeholder={values.length ? "" : placeholder}
        className="min-w-[160px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

function FieldRow({ label, htmlFor, children, className }: {
  label: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-start gap-3 border-b px-6", className)}>
      <Label htmlFor={htmlFor} className="w-14 shrink-0 pt-2.5 text-sm font-normal text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

/**
 * The CRM's one email composer - a single student (profile, list row, reply)
 * or many at once (Students list selection). Each student always gets their
 * own separate, personalised email; nobody sees the other recipients.
 */
export function EmailComposerDialog({
  open, onOpenChange, recipients, onSent, replySubject,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipients: EmailRecipient[]
  onSent: () => void
  /** When replying to a student's email: pre-fills "Re: <subject>". */
  replySubject?: string
}) {
  const [sending, setSending] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!sending) onOpenChange(next) }}>
      <DialogContent
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[94vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        {/* Mounted only while open, so every compose starts fresh. */}
        <ComposerForm
          recipients={recipients} replySubject={replySubject} sending={sending} setSending={setSending}
          onSent={onSent} onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function ComposerForm({
  recipients, replySubject, sending, setSending, onSent, onClose,
}: {
  recipients: EmailRecipient[]
  replySubject?: string
  sending: boolean
  setSending: (sending: boolean) => void
  onSent: () => void
  onClose: () => void
}) {
  const isReply = replySubject !== undefined
  const isBulk = recipients.length > 1
  const withEmail = useMemo(() => recipients.filter((r) => r.email), [recipients])
  const withoutEmail = recipients.filter((r) => !r.email)

  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [placeholders, setPlaceholders] = useState<EmailPlaceholder[]>([])
  const [templateId, setTemplateId] = useState<number | null>(null)
  const [subject, setSubject] = useState(() => (
    isReply && replySubject
      ? (/^re:/i.test(replySubject.trim()) ? replySubject.trim() : `Re: ${replySubject.trim()}`)
      : ""
  ))
  const [message, setMessage] = useState("")
  const [cc, setCc] = useState<string[]>([])
  const [bcc, setBcc] = useState<string[]>([])
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [tab, setTab] = useState<"write" | "preview">("write")
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const lastFocused = useRef<"subject" | "message">("message")
  const subjectRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadComposerTemplates().then(setTemplates).catch(() => {})
    loadPlaceholders().then(setPlaceholders).catch(() => {})
  }, [])

  const grouped = useMemo(() => {
    const groups = new Map<string, EmailTemplate[]>()
    for (const t of templates) groups.set(t.category_label, [...(groups.get(t.category_label) ?? []), t])
    return [...groups.entries()]
  }, [templates])

  const applyTemplate = (id: string) => {
    const template = templates.find((t) => String(t.id) === id)
    if (!template) return
    setTemplateId(template.id)
    if (!isReply || !subject) setSubject(template.subject)
    setMessage(template.body)
    setPreview(null)
  }

  const insertToken = (key: string) => {
    const token = `{${key}}`
    const useSubject = lastFocused.current === "subject"
    const el = useSubject ? subjectRef.current : messageRef.current
    const value = useSubject ? subject : message
    const set = useSubject ? setSubject : setMessage
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    set(value.slice(0, start) + token + value.slice(end))
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length) })
  }

  const addFiles = (list: FileList | null) => {
    if (!list) return
    const next = [...files]
    for (const file of Array.from(list)) {
      if (!ALLOWED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
        toast.error(`${file.name}: only PDF, Word, Excel, images and text files can be attached`)
        continue
      }
      if (next.length >= MAX_FILES) {
        toast.error(`You can attach up to ${MAX_FILES} files`)
        break
      }
      if (next.reduce((n, f) => n + f.size, 0) + file.size > MAX_TOTAL_BYTES) {
        toast.error("Attachments can be 20 MB in total")
        break
      }
      next.push(file)
    }
    setFiles(next)
    if (fileRef.current) fileRef.current.value = ""
  }

  const loadPreview = async () => {
    setTab("preview")
    setPreviewing(true)
    try {
      const template = templates.find((t) => t.id === templateId)
      setPreview(await previewEmailTemplate({
        subject, body: message, student_id: withEmail[0]?.id,
        cta_label: template?.cta_label, cta_url: template?.cta_url,
      }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load the preview")
      setTab("write")
    } finally {
      setPreviewing(false)
    }
  }

  const canSend = subject.trim().length >= 2 && message.trim().length >= 5 && withEmail.length > 0 && !sending

  const handleSend = async () => {
    setSending(true)
    const payload = {
      subject: subject.trim(), message: message.trim(), cc, bcc, attachments: files, template_id: templateId,
    }
    try {
      if (!isBulk) {
        await sendStudentEmail(withEmail[0].id, payload)
        toast.success(`Email sent to ${withEmail[0].email}`)
      } else {
        const res = await bulkEmailStudents(withEmail.map((s) => s.id), payload)
        const problems = res.failed.length + res.no_email.length
        if (res.sent) {
          toast.success(`Email sent to ${res.sent} student${res.sent === 1 ? "" : "s"}`, {
            description: problems ? `${problems} could not be emailed` : "Each student received a separate, personalised email",
          })
        }
        if (res.failed.length) {
          toast.error(`${res.failed.length} email${res.failed.length === 1 ? "" : "s"} failed`, {
            description: res.failed.slice(0, 3).map((f) => f.name).join(", "),
          })
        }
        if (!res.sent) return
      }
      onSent()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email")
    } finally {
      setSending(false)
    }
  }

  const title = isReply ? "Reply to student" : isBulk ? `Email ${recipients.length} students` : "New email"

  return (
    <>
        <DialogHeader className="border-b bg-gradient-to-b from-emerald-50/80 to-transparent px-6 py-4 text-left dark:from-emerald-500/[0.06]">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Mail className="h-4 w-4" />
            </span>
            {title}
          </DialogTitle>
          <DialogDescription className="pt-1">
            {isBulk
              ? "Each student gets their own separate email, so nobody sees the other recipients. "
              : "A real email, recorded in the student's communication history. "}
            Replies come back to you and the shared inbox and show up in the CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* To */}
          <FieldRow label="To" className="py-1">
            <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
              <div className="flex max-h-24 min-w-0 flex-1 flex-wrap gap-1.5 overflow-y-auto py-1.5">
                {withEmail.map((s) => (
                  <span key={s.id} title={s.email} className="inline-flex items-center gap-1.5 rounded-full border bg-card py-0.5 pl-0.5 pr-2.5 text-xs">
                    <PersonAvatar name={s.full_name || s.email} size="sm" />
                    <span className="max-w-[180px] truncate">{isBulk ? s.full_name : s.email}</span>
                  </span>
                ))}
              </div>
              <div className="flex shrink-0 gap-1 pt-1.5">
                {!showCc && (
                  <button type="button" onClick={() => setShowCc(true)} className="rounded px-1.5 py-0.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">Cc</button>
                )}
                {!showBcc && (
                  <button type="button" onClick={() => setShowBcc(true)} className="rounded px-1.5 py-0.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">Bcc</button>
                )}
              </div>
            </div>
          </FieldRow>
          {withoutEmail.length ? (
            <p className="mx-6 mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>
                {withoutEmail.length} selected student{withoutEmail.length === 1 ? " has" : "s have"} no email address and will be skipped:{" "}
                {withoutEmail.map((s) => s.full_name).join(", ")}
              </span>
            </p>
          ) : null}
          {showCc && (
            <FieldRow label="Cc" htmlFor="composer-cc">
              <AddressInput id="composer-cc" values={cc} onChange={setCc} placeholder="parent@example.com" />
            </FieldRow>
          )}
          {showBcc && (
            <FieldRow label="Bcc" htmlFor="composer-bcc">
              <AddressInput id="composer-bcc" values={bcc} onChange={setBcc} placeholder="Hidden copy - e.g. your manager" />
            </FieldRow>
          )}
          {isBulk && (cc.length || bcc.length) ? (
            <p className="mx-6 mt-2 text-xs text-muted-foreground">
              Cc/Bcc addresses receive a copy of every student's email ({withEmail.length} copies).
            </p>
          ) : null}

          {/* Template + subject */}
          <FieldRow label="Template" className="py-1.5">
            <Select value={templateId ? String(templateId) : ""} onValueChange={applyTemplate}>
              <SelectTrigger className="h-9 flex-1 border-0 px-0 shadow-none focus:ring-0">
                <SelectValue placeholder={templates.length ? "Start from a template (optional)" : "No templates yet"} />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {grouped.map(([label, items]) => (
                  <SelectGroup key={label}>
                    <SelectLabel className="text-xs uppercase tracking-wider text-muted-foreground">{label}</SelectLabel>
                    {items.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Subject" htmlFor="composer-subject" className="py-1">
            <input
              id="composer-subject" ref={subjectRef}
              value={subject}
              onFocus={() => { lastFocused.current = "subject" }}
              onChange={(e) => { setSubject(e.target.value); setPreview(null) }}
              placeholder="e.g. {first_name}, your application update"
              className="h-9 flex-1 bg-transparent text-sm font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground"
            />
          </FieldRow>

          {/* Write / preview */}
          <div className="flex items-center justify-between gap-2 px-6 pt-3">
            <div className="inline-flex rounded-lg bg-muted p-0.5 text-sm">
              <button
                type="button" onClick={() => setTab("write")}
                className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1", tab === "write" ? "bg-background shadow-sm" : "text-muted-foreground")}
              >
                <PenLine className="h-3.5 w-3.5" /> Write
              </button>
              <button
                type="button" onClick={() => void loadPreview()} disabled={!subject.trim() && !message.trim()}
                className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1 disabled:opacity-50", tab === "preview" ? "bg-background shadow-sm" : "text-muted-foreground")}
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </button>
            </div>
            {tab === "write" && placeholders.length ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
                    <Braces className="h-3.5 w-3.5" /> Insert field
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-1.5" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    Filled in for each student when the email is sent.
                  </p>
                  <div className="max-h-64 overflow-y-auto">
                    {placeholders.map((p) => (
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
            ) : null}
          </div>

          <div className="px-6 py-3">
            {tab === "write" ? (
              <Textarea
                ref={messageRef}
                rows={11}
                value={message}
                onFocus={() => { lastFocused.current = "message" }}
                onChange={(e) => { setMessage(e.target.value); setPreview(null) }}
                placeholder={"Write your message…\n\nThe greeting (\"Hi {first_name},\"), your name and the company signature are added automatically."}
                className="min-h-[220px] resize-y text-sm leading-relaxed"
              />
            ) : previewing || !preview ? (
              <div className="flex h-[360px] items-center justify-center rounded-lg border text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rendering preview…
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <div className="border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {withEmail[0] ? <>As <span className="font-medium text-foreground">{withEmail[0].full_name || withEmail[0].email}</span> will see it · </> : null}
                  <span className="font-medium text-foreground">{preview.subject}</span>
                </div>
                <iframe title="Email preview" srcDoc={preview.html} sandbox="" className="h-[420px] w-full bg-white" />
              </div>
            )}
          </div>

          {/* Attachments */}
          <div className="flex flex-wrap items-center gap-2 px-6 pb-4">
            <input
              ref={fileRef} type="file" multiple className="hidden"
              accept={ALLOWED_EXTENSIONS.join(",")} onChange={(e) => addFiles(e.target.files)}
            />
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => fileRef.current?.click()}>
              <Paperclip className="h-3.5 w-3.5" /> Attach files
            </Button>
            {files.map((file) => (
              <span key={file.name + file.size} className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 py-1 pl-2 pr-1 text-xs">
                <FileText className="h-3.5 w-3.5 text-emerald-600" />
                <span className="max-w-[180px] truncate">{file.name}</span>
                <span className="text-muted-foreground">{formatSize(file.size)}</span>
                <button
                  type="button" onClick={() => setFiles(files.filter((f) => f !== file))}
                  className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground" aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {!files.length && <span className="text-xs text-muted-foreground">PDF, Word, Excel or images · up to 5 files, 20 MB</span>}
          </div>
        </div>

        <DialogFooter className="items-center border-t px-6 py-3 sm:justify-between">
          <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <Users className="h-3.5 w-3.5" />
            {withEmail.length} recipient{withEmail.length === 1 ? "" : "s"}
            {cc.length ? ` · ${cc.length} Cc` : ""}{bcc.length ? ` · ${bcc.length} Bcc` : ""}
            {files.length ? ` · ${files.length} attachment${files.length === 1 ? "" : "s"}` : ""}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={sending}>Cancel</Button>
            <Button className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" disabled={!canSend} onClick={() => void handleSend()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending
                ? (isBulk ? `Sending to ${withEmail.length}…` : "Sending…")
                : isBulk ? `Send to ${withEmail.length} students` : "Send email"}
            </Button>
          </div>
        </DialogFooter>
    </>
  )
}
