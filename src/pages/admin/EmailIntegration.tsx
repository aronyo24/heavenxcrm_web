import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  AlertTriangle, CheckCircle2, ChevronDown, Eye, EyeOff, Inbox, Loader2, Mail, Palette, PlugZap, Send, Server, ShieldCheck,
  Trash2, Users, XCircle, Zap,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { EmailAutomationsPanel } from "@/components/admin/EmailAutomationsPanel"
import { EmailTemplatesManager } from "@/components/admin/EmailTemplatesManager"
import {
  fetchEmailIntegration, previewEmailTemplate, resetEmailIntegration, sendTestEmail, testEmailConnection,
  updateEmailIntegration,
  type EmailConnectionTest, type EmailIntegrationInput, type EmailIntegrationState, type EmailSecurity,
} from "@/lib/crm-api"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback)

function formatDateTime(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
}

interface Preset {
  key: string
  label: string
  host: string
  port: number
  security: EmailSecurity
  imapHost: string
  help: string
}

// Common providers for admission agencies - one click fills in the server details.
const PRESETS: Preset[] = [
  { key: "google", label: "Gmail / Google Workspace", host: "smtp.gmail.com", port: 587, security: "tls", imapHost: "imap.gmail.com",
    help: "Use an App Password, not your normal password: Google Account → Security → 2-Step Verification → App passwords." },
  { key: "microsoft", label: "Microsoft 365 / Outlook", host: "smtp.office365.com", port: 587, security: "tls", imapHost: "outlook.office365.com",
    help: "SMTP AUTH must be enabled for the mailbox (Microsoft 365 admin → Users → Mail → Manage email apps). With MFA, use an App Password." },
  { key: "zoho", label: "Zoho Mail", host: "smtp.zoho.com", port: 465, security: "ssl", imapHost: "imap.zoho.com",
    help: "Enable IMAP in Zoho Mail settings. With 2FA on, generate an application-specific password. EU/IN accounts use smtp.zoho.eu / smtp.zoho.in." },
  { key: "hostinger", label: "Hostinger", host: "smtp.hostinger.com", port: 465, security: "ssl", imapHost: "imap.hostinger.com",
    help: "Use the full email address and the mailbox password from hPanel → Emails." },
  { key: "cpanel", label: "cPanel / own domain", host: "mail.{domain}", port: 465, security: "ssl", imapHost: "mail.{domain}",
    help: "The server is usually mail.<your domain> - we fill it in from your email address. Check the exact name in cPanel → Email Accounts → Connect Devices." },
  { key: "ionos", label: "IONOS", host: "smtp.ionos.co.uk", port: 465, security: "ssl", imapHost: "imap.ionos.co.uk",
    help: "Use the full email address and its mailbox password. Outside the UK use smtp.ionos.com / imap.ionos.com (US) or smtp.ionos.de / imap.ionos.de (EU)." },
  { key: "ses", label: "Amazon SES", host: "email-smtp.us-east-1.amazonaws.com", port: 587, security: "tls", imapHost: "",
    help: "Use SMTP credentials from the SES console (not your AWS keys), and change the region in the host if needed. SES cannot receive replies - set Reply-To to a real mailbox." },
  { key: "sendgrid", label: "SendGrid", host: "smtp.sendgrid.net", port: 587, security: "tls", imapHost: "",
    help: 'Username is literally "apikey" and the password is your API key. Verify your sender domain in SendGrid first.' },
  { key: "brevo", label: "Brevo", host: "smtp-relay.brevo.com", port: 587, security: "tls", imapHost: "",
    help: "Use the SMTP login and key from Brevo → SMTP & API. Verify your sender in Brevo first." },
  { key: "custom", label: "Other", host: "", port: 587, security: "tls", imapHost: "", help: "Enter the details from your email provider." },
]

function Section({ icon: Icon, title, description, children, action }: {
  icon: React.ElementType
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold">{title}</h2>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Field({ label, htmlFor, hint, children, className }: {
  label: string
  htmlFor?: string
  hint?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function Toggle({ checked, onChange, label, description }: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description?: string
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border p-3 hover:bg-muted/30">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description ? <span className="block text-xs text-muted-foreground">{description}</span> : null}
      </span>
      <button
        type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-emerald-600" : "bg-muted-foreground/30")}
      >
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-4" : "translate-x-0.5")} />
      </button>
    </label>
  )
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "danger" }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold", tone === "danger" && Number(value) > 0 && "text-destructive")}>{value}</p>
    </div>
  )
}

type Draft = Required<Omit<EmailIntegrationInput, "password">> & { password: string }

const toDraft = (s: EmailIntegrationState): Draft => ({
  provider: s.provider, smtp_host: s.smtp_host, smtp_port: s.smtp_port, security: s.security, username: s.username,
  password: "", from_name: s.from_name, from_email: s.from_email, reply_to: s.reply_to,
  default_cc: s.default_cc, default_bcc: s.default_bcc, cc_sender: s.cc_sender, cc_shared_mailbox: s.cc_shared_mailbox,
  company_name: s.company_name, brand_color: s.brand_color, signature: s.signature, footer_text: s.footer_text,
  imap_enabled: s.imap_enabled, imap_host: s.imap_host, imap_port: s.imap_port,
})

const SERVER_KEYS = ["provider", "smtp_host", "smtp_port", "security", "username", "password", "from_name", "from_email", "imap_enabled", "imap_host", "imap_port"] as const
const SENDING_KEYS = ["reply_to", "default_cc", "default_bcc", "cc_sender", "cc_shared_mailbox", "company_name", "brand_color", "signature", "footer_text"] as const

export default function EmailIntegrationPage() {
  const { user } = useAuth()
  const [state, setState] = useState<EmailIntegrationState | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [test, setTest] = useState<EmailConnectionTest | null>(null)
  const [testTo, setTestTo] = useState(() => user?.email ?? "")
  const [confirmReset, setConfirmReset] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [brandPreview, setBrandPreview] = useState<string | null>(null)
  const [tab, setTab] = useState("server")

  const applyState = (next: EmailIntegrationState) => {
    setState(next)
    setDraft(toDraft(next))
  }

  useEffect(() => {
    fetchEmailIntegration().then(applyState).catch((err) => toast.error(errorMessage(err, "Failed to load email settings")))
  }, [])

  const loadBrandPreview = () => {
    previewEmailTemplate({
      subject: "{first_name}, your application has been submitted",
      body: "Good news - your application for {course} has been submitted to the university.\n\nWe will update you as soon as we hear back.",
      cta_label: "Track my application",
    }).then((p) => setBrandPreview(p.html)).catch(() => setBrandPreview(null))
  }
  useEffect(() => { if (tab === "sending" && !brandPreview) loadBrandPreview() }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!state || !draft) return <div className="animate-pulse text-muted-foreground">Loading...</div>

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d))
  const preset = PRESETS.find((p) => p.key === draft.provider)

  const dirty = (keys: readonly (keyof Draft)[]) =>
    keys.some((k) => (k === "password" ? !!draft.password : draft[k] !== toDraft(state)[k]))

  const save = async (keys: readonly (keyof Draft)[], quiet = false) => {
    const payload: EmailIntegrationInput = {}
    for (const k of keys) {
      if (k === "password" && !draft.password) continue
      ;(payload as Record<string, unknown>)[k] = draft[k]
    }
    const next = await updateEmailIntegration(payload)
    applyState(next)
    if (!quiet) toast.success("Email settings saved")
    return next
  }

  const withBusy = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (err) {
      toast.error(errorMessage(err, "Something went wrong"))
    } finally {
      setBusy(null)
    }
  }

  const pickPreset = (p: Preset) => {
    setDraft((d) => {
      if (!d) return d
      // Own-domain hosting: the server is mail.<domain of the mailbox>.
      const domain = (d.username || d.from_email).split("@")[1] ?? ""
      const fill = (host: string) => (host.includes("{domain}") ? (domain ? host.replace("{domain}", domain) : "") : host)
      return {
        ...d, provider: p.key,
        ...(p.key !== "custom"
          ? { smtp_host: fill(p.host), smtp_port: p.port, security: p.security, imap_host: fill(p.imapHost), imap_enabled: !!p.imapHost }
          : {}),
      }
    })
    setShowHelp(true)
  }

  const handleSaveAndTest = () => withBusy("test", async () => {
    if (dirty(SERVER_KEYS)) await save(SERVER_KEYS, true)
    const result = await testEmailConnection()
    setTest(result)
    setState(result.state)
    if (result.smtp.ok && (!result.imap || result.imap.ok)) toast.success("Connected - email is ready to use")
    else toast.error("Connection failed - see the details below")
  })

  const handleSendTest = () => withBusy("send-test", async () => {
    const res = await sendTestEmail(testTo.trim())
    toast.success(res.detail, { description: "Check the inbox (and spam folder) to see how students receive your emails." })
  })

  const handleReset = () => withBusy("reset", async () => {
    applyState(await resetEmailIntegration())
    setConfirmReset(false)
    setTest(null)
    toast.success("Mail server removed - using the server's default settings")
  })

  const statusBadge = state.source === "admin"
    ? state.last_test_ok === false
      ? <Badge className="border-destructive/20 bg-destructive/10 text-destructive">Needs attention</Badge>
      : <Badge className="border-emerald-500/20 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Connected</Badge>
    : state.source === "env"
      ? <Badge className="border-amber-500/20 bg-amber-500/15 text-amber-700 dark:text-amber-400">Using server defaults</Badge>
      : <Badge variant="secondary">Not set up</Badge>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">Email</h1>
              {statusBadge}
            </div>
            <p className="text-sm text-muted-foreground">
              The mailbox your team emails students from, sending rules, branding and email templates.
            </p>
          </div>
        </div>
        {state.configured ? (
          <p className="text-sm text-muted-foreground">
            Sending as <span className="font-medium text-foreground">{state.from_name ? `${state.from_name} <${state.from_email}>` : state.from_email}</span>
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sent · 30 days" value={state.stats.sent_30d} />
        <Stat label="Student replies · 30 days" value={state.stats.replies_30d} />
        <Stat label="Failed · 30 days" value={state.stats.failed_30d} tone="danger" />
        <Stat label="Last email sent" value={state.stats.last_sent_at ? new Date(state.stats.last_sent_at).toLocaleDateString([], { day: "numeric", month: "short" }) : "—"} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-10">
          <TabsTrigger value="server" className="gap-1.5 px-4"><Server className="h-4 w-4" /> Mail server</TabsTrigger>
          <TabsTrigger value="sending" className="gap-1.5 px-4"><Users className="h-4 w-4" /> Sending & branding</TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5 px-4"><Mail className="h-4 w-4" /> Templates</TabsTrigger>
          <TabsTrigger value="automation" className="gap-1.5 px-4"><Zap className="h-4 w-4" /> Automation</TabsTrigger>
        </TabsList>

        {/* ---------------- Mail server ---------------- */}
        <TabsContent value="server" className="mt-5">
          {state.source === "env" ? (
            <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              Emails currently go through the server's built-in settings ({state.smtp_host}). Save a mail server below to
              manage it from here - no server access needed.
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-3">
              <Section icon={PlugZap} title="1. Choose your email provider" description="We fill in the server details for you.">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PRESETS.map((p) => (
                    <button
                      key={p.key} type="button" onClick={() => pickPreset(p)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/5",
                        draft.provider === p.key && "border-emerald-600 bg-emerald-500/10 font-medium",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {preset ? (
                  <div className="mt-3">
                    <button type="button" className="flex items-center gap-1 text-sm text-primary hover:underline" onClick={() => setShowHelp((v) => !v)}>
                      Setup tips for {preset.label}
                      <ChevronDown className={cn("h-4 w-4 transition-transform", showHelp && "rotate-180")} />
                    </button>
                    {showHelp ? <p className="mt-2 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">{preset.help}</p> : null}
                  </div>
                ) : null}
              </Section>

              <Section icon={Server} title="2. Outgoing mail (SMTP)" description="Used for every email: counselor emails, password resets and welcome emails.">
                <div className="grid gap-4 sm:grid-cols-6">
                  <Field label="SMTP server" htmlFor="smtp-host" className="sm:col-span-3">
                    <Input id="smtp-host" value={draft.smtp_host} onChange={(e) => set("smtp_host", e.target.value.trim())} placeholder="e.g. mail.yourcompany.com" />
                  </Field>
                  <Field label="Port" htmlFor="smtp-port" className="sm:col-span-1">
                    <Input id="smtp-port" inputMode="numeric" value={draft.smtp_port || ""} onChange={(e) => set("smtp_port", Number(e.target.value.replace(/\D/g, "")) || 0)} />
                  </Field>
                  <Field label="Security" className="sm:col-span-2">
                    <Select value={draft.security} onValueChange={(v) => set("security", v as EmailSecurity)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tls">STARTTLS (587)</SelectItem>
                        <SelectItem value="ssl">SSL/TLS (465)</SelectItem>
                        <SelectItem value="none">None (not recommended)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Username" htmlFor="smtp-user" className="sm:col-span-3" hint="Usually the full email address.">
                    <Input id="smtp-user" autoComplete="off" value={draft.username} onChange={(e) => set("username", e.target.value.trim())} placeholder="info@yourcompany.com" />
                  </Field>
                  <Field
                    label="Password" htmlFor="smtp-pass" className="sm:col-span-3"
                    hint={state.has_password ? `Saved and encrypted (${state.password_hint}). Leave blank to keep it.` : "Stored encrypted. Never shown again."}
                  >
                    <div className="relative">
                      {/* Not a login form for this site - keep browsers from auto-filling a saved CRM password here. */}
                      <Input
                        id="smtp-pass" name="mail-server-password" type={showPassword ? "text" : "password"}
                        autoComplete="off" data-lpignore="true" data-1p-ignore="true" spellCheck={false}
                        value={draft.password} onChange={(e) => set("password", e.target.value)}
                        placeholder={state.has_password ? "Type a new password to replace" : "Mailbox password"}
                        className="pr-10"
                      />
                      <button
                        type="button" onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </Field>
                  <Field label="From name" htmlFor="from-name" className="sm:col-span-3" hint="What students see in their inbox.">
                    <Input id="from-name" value={draft.from_name} onChange={(e) => set("from_name", e.target.value)} placeholder="Your Company Admissions" />
                  </Field>
                  <Field label="From address" htmlFor="from-email" className="sm:col-span-3" hint="The mailbox above, or an alias it may send as.">
                    <Input id="from-email" type="email" value={draft.from_email} onChange={(e) => set("from_email", e.target.value.trim())} placeholder="info@yourcompany.com" />
                  </Field>
                </div>
              </Section>

              <Section
                icon={Inbox} title="3. Incoming replies (IMAP)"
                description="Student replies to CRM emails are pulled from this inbox and shown on their profile."
              >
                <div className="space-y-4">
                  <Toggle checked={draft.imap_enabled} onChange={(v) => set("imap_enabled", v)} label="Track student replies" description="Uses the same username and password as outgoing mail." />
                  {draft.imap_enabled ? (
                    <div className="grid gap-4 sm:grid-cols-6">
                      <Field label="IMAP server" htmlFor="imap-host" className="sm:col-span-4">
                        <Input id="imap-host" value={draft.imap_host} onChange={(e) => set("imap_host", e.target.value.trim())} placeholder="e.g. mail.yourcompany.com" />
                      </Field>
                      <Field label="Port" htmlFor="imap-port" className="sm:col-span-2">
                        <Input id="imap-port" inputMode="numeric" value={draft.imap_port || ""} onChange={(e) => set("imap_port", Number(e.target.value.replace(/\D/g, "")) || 0)} />
                      </Field>
                    </div>
                  ) : null}
                </div>
              </Section>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void withBusy("save", async () => { await save(SERVER_KEYS) })} disabled={busy !== null || !dirty(SERVER_KEYS)}>
                  {busy === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
                <Button variant="outline" onClick={() => void handleSaveAndTest()} disabled={busy !== null || !draft.smtp_host}>
                  {busy === "test" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  {dirty(SERVER_KEYS) ? "Save & test connection" : "Test connection"}
                </Button>
                {state.source === "admin" ? (
                  confirmReset ? (
                    <Button variant="destructive" onClick={() => void handleReset()} disabled={busy !== null}>Confirm remove</Button>
                  ) : (
                    <Button variant="ghost" className="text-muted-foreground" onClick={() => setConfirmReset(true)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Remove server
                    </Button>
                  )
                ) : null}
              </div>
            </div>

            {/* Right column: status + test */}
            <div className="space-y-6 lg:col-span-2">
              <Section icon={ShieldCheck} title="Connection status">
                {test ? (
                  <ul className="space-y-3">
                    {[{ label: "Outgoing mail (SMTP)", r: test.smtp }, ...(test.imap ? [{ label: "Incoming replies (IMAP)", r: test.imap }] : [])].map(({ label, r }) => (
                      <li key={label} className="flex gap-3">
                        {r.ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="h-5 w-5 shrink-0 text-destructive" />}
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-sm text-muted-foreground">{r.detail}</p>
                        </div>
                      </li>
                    ))}
                    {test.hint ? (
                      <li className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                        <p className="text-sm text-amber-800 dark:text-amber-300">{test.hint}</p>
                      </li>
                    ) : null}
                  </ul>
                ) : state.last_test_at ? (
                  <div className="flex gap-3">
                    {state.last_test_ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />}
                    <div>
                      <p className="text-sm font-medium">{state.last_test_ok ? "Working" : "Last test failed"}</p>
                      <p className="text-sm text-muted-foreground">
                        {state.last_test_ok ? `Checked ${formatDateTime(state.last_test_at)}` : state.last_error}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Save your settings and click <strong>Test connection</strong> to check them.</p>
                )}
              </Section>

              <Section icon={Send} title="Send a test email" description="See exactly what students receive.">
                <div className="flex gap-2">
                  <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
                  <Button onClick={() => void handleSendTest()} disabled={busy !== null || !testTo.trim() || !state.configured}>
                    {busy === "send-test" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                  </Button>
                </div>
              </Section>
            </div>
          </div>
        </TabsContent>

        {/* ---------------- Sending & branding ---------------- */}
        <TabsContent value="sending" className="mt-5">
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-3">
              <Section icon={Users} title="Recipients" description="Applied to every email a counselor sends to a student.">
                <div className="space-y-4">
                  <Field label="Reply-To address" htmlFor="reply-to" hint={`Where student replies go. Blank = the From address (${state.from_email || "not set"}).`}>
                    <Input id="reply-to" type="email" value={draft.reply_to} onChange={(e) => set("reply_to", e.target.value.trim())} placeholder="admissions@yourcompany.com" />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Always CC" htmlFor="default-cc" hint="Visible to the student. Comma-separated.">
                      <Input id="default-cc" value={draft.default_cc} onChange={(e) => set("default_cc", e.target.value)} placeholder="office@yourcompany.com" />
                    </Field>
                    <Field label="Always BCC" htmlFor="default-bcc" hint="Hidden copy - e.g. a manager or archive.">
                      <Input id="default-bcc" value={draft.default_bcc} onChange={(e) => set("default_bcc", e.target.value)} placeholder="archive@yourcompany.com" />
                    </Field>
                  </div>
                  <Toggle
                    checked={draft.cc_sender} onChange={(v) => set("cc_sender", v)}
                    label="CC the counselor who sends it" description="They get their own copy and see the student's reply-all."
                  />
                  <Toggle
                    checked={draft.cc_shared_mailbox} onChange={(v) => set("cc_shared_mailbox", v)}
                    label={`CC the shared inbox${state.shared_mailbox ? ` (${state.shared_mailbox})` : ""}`}
                    description="Keeps a copy of every conversation in one place."
                  />
                </div>
              </Section>

              <Section icon={Palette} title="Branding" description="How your emails look to students.">
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                    <Field label="Company name" htmlFor="company" hint="Shown in the email header and sign-off.">
                      <Input id="company" value={draft.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="HeavenxCRM" />
                    </Field>
                    <Field label="Brand colour" htmlFor="brand">
                      <div className="flex gap-2">
                        <input
                          type="color" aria-label="Pick brand colour" value={draft.brand_color || "#0f2318"}
                          onChange={(e) => set("brand_color", e.target.value)}
                          className="h-9 w-11 cursor-pointer rounded-md border bg-transparent p-1"
                        />
                        <Input id="brand" value={draft.brand_color} onChange={(e) => set("brand_color", e.target.value.trim())} className="font-mono text-xs" />
                      </div>
                    </Field>
                  </div>
                  <Field label="Signature" htmlFor="signature" hint="Added under the counselor's name - e.g. office phone, WhatsApp, website.">
                    <Textarea id="signature" rows={3} value={draft.signature} onChange={(e) => set("signature", e.target.value)} placeholder={"Tel: +44 20 0000 0000 · WhatsApp: +44 7000 000000\nwww.yourcompany.com"} />
                  </Field>
                  <Field label="Footer" htmlFor="footer" hint="Small print at the bottom - office address, registration number.">
                    <Textarea id="footer" rows={2} value={draft.footer_text} onChange={(e) => set("footer_text", e.target.value)} placeholder="Your Company Ltd · 1 High Street, London" />
                  </Field>
                </div>
              </Section>

              <Button
                onClick={() => void withBusy("save-sending", async () => { await save(SENDING_KEYS); loadBrandPreview() })}
                disabled={busy !== null || !dirty(SENDING_KEYS)}
              >
                {busy === "save-sending" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>

            <div className="lg:col-span-2">
              <div className="sticky top-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview {dirty(SENDING_KEYS) ? "· save to update" : ""}</p>
                {brandPreview ? (
                  <iframe title="Branded email preview" srcDoc={brandPreview} sandbox="" className="h-[640px] w-full rounded-2xl border bg-white shadow-sm" />
                ) : (
                  <div className="flex h-[300px] items-center justify-center rounded-2xl border text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading preview…
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ---------------- Templates ---------------- */}
        <TabsContent value="templates" className="mt-5">
          <EmailTemplatesManager />
        </TabsContent>

        {/* ---------------- Automation ---------------- */}
        <TabsContent value="automation" className="mt-5">
          <EmailAutomationsPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
