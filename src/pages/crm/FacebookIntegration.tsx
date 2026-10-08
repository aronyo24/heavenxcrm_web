import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import {
  AlertTriangle, CheckCircle2, ChevronDown, Copy, Facebook, Link2, Loader2, Pause, Play, RefreshCw,
  RotateCcw, ShieldCheck, Unplug, Webhook, XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  connectFacebookPage, disconnectFacebookPage, fetchFacebookHealth, fetchFacebookImportedLeads,
  fetchFacebookIntegration, regenerateFacebookVerifyToken, retryFailedFacebookLeads, subscribeFacebookPage,
  syncFacebookLeadsNow, updateFacebookIntegration,
  type FacebookHealthCheck, type FacebookImportedLead, type FacebookIntegrationState,
} from "@/lib/crm-api"
import { studentPath } from "@/lib/student-url"

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback)

function formatDateTime(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
}

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error("Could not copy - select the text and copy it manually"),
  )
}

function Section({ step, icon: Icon, title, description, children }: {
  step?: number
  icon: React.ElementType
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold">{step ? `${step}. ` : ""}{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function CopyField({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <Input readOnly value={value || "Not set"} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Button type="button" variant="outline" size="icon" disabled={!value} onClick={() => copy(value, label)} aria-label={`Copy ${label}`}>
          <Copy className="h-4 w-4" />
        </Button>
        {children}
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "danger" }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone === "danger" && Number(value) > 0 ? "text-destructive" : ""}`}>{value}</p>
    </div>
  )
}

const CHECK_ICON = {
  ok: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />,
  warn: <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />,
  fail: <XCircle className="h-5 w-5 shrink-0 text-destructive" />,
}

const LEAD_STATUS = {
  created: <Badge className="border-emerald-500/20 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">New lead</Badge>,
  merged: <Badge variant="secondary">Matched existing</Badge>,
  failed: <Badge className="border-destructive/20 bg-destructive/10 text-destructive">Failed</Badge>,
}

export default function FacebookIntegrationPage() {
  const [state, setState] = useState<FacebookIntegrationState | null>(null)
  const [checks, setChecks] = useState<FacebookHealthCheck[] | null>(null)
  const [leads, setLeads] = useState<FacebookImportedLead[]>([])
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const [showConnect, setShowConnect] = useState(false)
  const [token, setToken] = useState("")
  const [pageChoices, setPageChoices] = useState<{ id: string; name: string }[] | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [showTokenHelp, setShowTokenHelp] = useState(false)

  const [appId, setAppId] = useState("")
  const [appSecret, setAppSecret] = useState("")
  const [syncDays, setSyncDays] = useState("7")

  const runChecks = useCallback(async () => {
    setChecking(true)
    try {
      setChecks(await fetchFacebookHealth())
    } catch (err) {
      toast.error(errorMessage(err, "Health check failed"))
    } finally {
      setChecking(false)
    }
  }, [])

  const loadLeads = useCallback(async () => {
    try {
      setLeads(await fetchFacebookImportedLeads())
    } catch {
      setLeads([])
    }
  }, [])

  const applyState = (next: FacebookIntegrationState) => {
    setState(next)
    setAppId(next.app_id)
  }

  useEffect(() => {
    fetchFacebookIntegration()
      .then((next) => {
        applyState(next)
        setShowConnect(!next.connected)
      })
      .catch((err) => toast.error(errorMessage(err, "Failed to load the Facebook integration")))
    fetchFacebookImportedLeads().then(setLeads).catch(() => setLeads([]))
    fetchFacebookHealth()
      .then(setChecks)
      .catch((err) => toast.error(errorMessage(err, "Health check failed")))
  }, [])

  const withBusy = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  const handleConnect = (pageId?: string) => withBusy("connect", async () => {
    try {
      const result = await connectFacebookPage(token, pageId)
      applyState(result.state)
      if (result.status === "choose_page") {
        setPageChoices(result.pages)
        return
      }
      toast.success(`Connected to ${result.page.name}`)
      if (!result.subscribed) toast.warning(`Connected, but could not subscribe the Page: ${result.subscribe_error}`)
      setToken("")
      setPageChoices(null)
      setShowConnect(false)
      void runChecks()
    } catch (err) {
      toast.error(errorMessage(err, "Could not connect"))
    }
  })

  const handleDisconnect = () => withBusy("disconnect", async () => {
    try {
      applyState(await disconnectFacebookPage())
      setConfirmDisconnect(false)
      setShowConnect(true)
      toast.success("Facebook Page disconnected")
      void runChecks()
    } catch (err) {
      toast.error(errorMessage(err, "Could not disconnect"))
    }
  })

  const handleSaveWebhook = () => withBusy("save", async () => {
    try {
      applyState(await updateFacebookIntegration({ app_id: appId.trim(), ...(appSecret ? { app_secret: appSecret.trim() } : {}) }))
      setAppSecret("")
      toast.success("Webhook settings saved")
      void runChecks()
    } catch (err) {
      toast.error(errorMessage(err, "Could not save"))
    }
  })

  const handleRegenerate = () => withBusy("verify", async () => {
    try {
      applyState(await regenerateFacebookVerifyToken())
      toast.success("New Verify Token created - update it in Meta too")
    } catch (err) {
      toast.error(errorMessage(err, "Could not create a Verify Token"))
    }
  })

  const handleToggle = () => withBusy("toggle", async () => {
    if (!state) return
    try {
      applyState(await updateFacebookIntegration({ is_enabled: !state.enabled }))
      toast.success(state.enabled ? "Lead import paused" : "Lead import resumed")
    } catch (err) {
      toast.error(errorMessage(err, "Could not update"))
    }
  })

  const handleSync = () => withBusy("sync", async () => {
    try {
      const { result, state: next } = await syncFacebookLeadsNow(Number(syncDays))
      applyState(next)
      toast.success(
        result.created || result.merged
          ? `${result.created} new lead(s), ${result.merged} matched existing`
          : "Up to date - no new leads"
      )
      void loadLeads()
    } catch (err) {
      toast.error(errorMessage(err, "Sync failed"))
    }
  })

  const handleRetry = () => withBusy("retry", async () => {
    try {
      const res = await retryFailedFacebookLeads()
      applyState(res.state)
      toast.success(`Retried ${res.retried}; ${res.still_failed} still failing`)
      void loadLeads()
    } catch (err) {
      toast.error(errorMessage(err, "Retry failed"))
    }
  })

  const handleSubscribe = () => withBusy("subscribe", async () => {
    try {
      setChecks(await subscribeFacebookPage())
      toast.success("Page subscribed to new leads")
    } catch (err) {
      toast.error(errorMessage(err, "Could not subscribe the Page"))
    }
  })

  if (!state) {
    return <div className="animate-pulse text-muted-foreground">Loading...</div>
  }

  const failing = checks?.filter((c) => c.status === "fail") ?? []
  const statusBadge = !state.connected
    ? <Badge variant="secondary">Not connected</Badge>
    : !state.enabled
      ? <Badge className="border-amber-500/20 bg-amber-500/15 text-amber-700 dark:text-amber-400">Paused</Badge>
      : failing.length
        ? <Badge className="border-destructive/20 bg-destructive/10 text-destructive">Needs attention</Badge>
        : <Badge className="border-emerald-500/20 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Active</Badge>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <Facebook className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">Facebook Lead Ads</h1>
              {statusBadge}
            </div>
            <p className="text-sm text-muted-foreground">
              Leads from your Facebook & Instagram ad forms go straight into Students.
            </p>
          </div>
        </div>
        {state.connected ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={syncDays} onValueChange={setSyncDays}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24 hours</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => void handleSync()} disabled={busy === "sync" || !state.enabled}>
              {busy === "sync" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Sync now
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handleToggle()} disabled={busy === "toggle"}>
              {state.enabled ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {state.enabled ? "Pause" : "Resume"}
            </Button>
          </div>
        ) : null}
      </div>

      {state.source === "env" ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          These settings currently come from the server's <code>.env</code> file. Connect your Page below to manage
          everything from here instead.
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Leads imported" value={state.stats.total} />
        <Stat label="Last 7 days" value={state.stats.last_7_days} />
        <Stat label="Matched existing" value={state.stats.merged} />
        <Stat label="Failed" value={state.stats.failed} tone="danger" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {/* Step 1: connect */}
          <Section step={1} icon={Link2} title="Connect your Facebook Page" description="The Page that runs your lead ads.">
            {state.connected && !showConnect ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold">{state.page.name || "Facebook Page"}</p>
                    <p className="text-xs text-muted-foreground">
                      Page ID {state.page.id}
                      {state.page_token_hint ? ` · token ${state.page_token_hint}` : ""}
                      {state.connected_at ? ` · connected ${formatDateTime(state.connected_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowConnect(true)}>Reconnect</Button>
                    {confirmDisconnect ? (
                      <Button size="sm" variant="destructive" onClick={() => void handleDisconnect()} disabled={busy === "disconnect"}>
                        Confirm disconnect
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDisconnect(true)}>
                        <Unplug className="mr-2 h-4 w-4" /> Disconnect
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-sm font-medium" htmlFor="fb-token">Access token</label>
                <Input
                  id="fb-token"
                  type="password"
                  autoComplete="off"
                  placeholder="EAA..."
                  value={token}
                  onChange={(e) => { setToken(e.target.value); setPageChoices(null) }}
                />
                <p className="text-xs text-muted-foreground">
                  A System User token (never expires) or a token from Graph API Explorer. We find your Page and
                  store its token encrypted - you never need to edit server files.
                </p>

                {pageChoices ? (
                  <div className="space-y-2 rounded-xl border p-3">
                    <p className="text-sm font-medium">This token manages several Pages - choose one:</p>
                    {pageChoices.map((page) => (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => void handleConnect(page.id)}
                        disabled={busy === "connect"}
                        className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:border-primary/40 hover:bg-primary/5"
                      >
                        <span className="font-medium">{page.name}</span>
                        <span className="text-xs text-muted-foreground">{page.id}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void handleConnect()} disabled={!token.trim() || busy === "connect"}>
                    {busy === "connect" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                    Connect Page
                  </Button>
                  {state.connected ? (
                    <Button variant="ghost" onClick={() => { setShowConnect(false); setToken(""); setPageChoices(null) }}>Cancel</Button>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                  onClick={() => setShowTokenHelp((v) => !v)}
                >
                  How do I get a token?
                  <ChevronDown className={`h-4 w-4 transition-transform ${showTokenHelp ? "rotate-180" : ""}`} />
                </button>
                {showTokenHelp ? (
                  <ol className="list-decimal space-y-1.5 rounded-xl bg-muted/40 p-4 pl-8 text-sm text-muted-foreground">
                    <li>Open <strong>business.facebook.com → Settings → Users → System users</strong> and add one (role: Admin).</li>
                    <li><strong>Assign assets:</strong> your Page and your app, both with full control.</li>
                    <li>
                      <strong>Generate new token</strong> for your app, expiration <strong>Never</strong>, with:{" "}
                      <code className="text-xs">leads_retrieval, pages_manage_metadata, pages_show_list, pages_read_engagement, ads_read</code>.
                    </li>
                    <li>In <strong>Settings → Integrations → Leads access</strong>, allow your app.</li>
                    <li>Paste the token above and click <strong>Connect Page</strong>.</li>
                  </ol>
                ) : null}
              </div>
            )}
          </Section>

          {/* Step 2: webhook */}
          <Section
            step={2}
            icon={Webhook}
            title="Real-time webhook"
            description="Optional but recommended: leads appear within seconds instead of on the next automatic sync."
          >
            <div className="space-y-4">
              <CopyField label="Callback URL" value={state.webhook_url} />
              <CopyField label="Verify token" value={state.verify_token}>
                <Button type="button" variant="outline" size="icon" onClick={() => void handleRegenerate()} disabled={busy === "verify"} aria-label="Generate new verify token">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </CopyField>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="fb-app-id">App ID</label>
                  <Input id="fb-app-id" inputMode="numeric" placeholder="e.g. 1234567890" value={appId} onChange={(e) => setAppId(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="fb-app-secret">App Secret</label>
                  <Input
                    id="fb-app-secret"
                    type="password"
                    autoComplete="off"
                    placeholder={state.has_app_secret ? `Saved ${state.app_secret_hint} - type to replace` : "32 characters"}
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Meta → your app → App settings → Basic.</p>
                <Button onClick={() => void handleSaveWebhook()} disabled={busy === "save"}>
                  {busy === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </div>

              <ol className="list-decimal space-y-1 rounded-xl bg-muted/40 p-4 pl-8 text-sm text-muted-foreground">
                <li>In Meta: your app → <strong>Webhooks</strong> → choose <strong>Page</strong>.</li>
                <li>Paste the <strong>Callback URL</strong> and <strong>Verify token</strong> above → Verify and save.</li>
                <li>Click <strong>Subscribe</strong> next to <strong>leadgen</strong>.</li>
                <li>Publish the app (<strong>Live</strong> mode) - unpublished apps only receive test events.</li>
              </ol>
            </div>
          </Section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {/* Health */}
          <Section icon={ShieldCheck} title="Connection health">
            <div className="space-y-3">
              {checks === null ? (
                <p className="animate-pulse text-sm text-muted-foreground">Checking...</p>
              ) : (
                checks.map((check) => (
                  <div key={check.key} className="flex gap-3">
                    {CHECK_ICON[check.status]}
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{check.label}</p>
                      {check.detail ? <p className="break-words text-muted-foreground">{check.detail}</p> : null}
                      {check.fix && check.status !== "ok" ? (
                        <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">{check.fix}</p>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => void runChecks()} disabled={checking}>
                  {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Run checks
                </Button>
                {checks?.some((c) => c.key === "subscription" && c.status === "fail") ? (
                  <Button size="sm" onClick={() => void handleSubscribe()} disabled={busy === "subscribe"}>Subscribe Page</Button>
                ) : null}
              </div>
            </div>
          </Section>

          {/* Sync */}
          <Section icon={RefreshCw} title="Automatic sync" description="The CRM also checks Facebook for new leads whenever staff open Students.">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Last sync</dt>
                <dd className="font-medium">{formatDateTime(state.last_sync_at)}</dd>
              </div>
              {state.last_sync_result.forms !== undefined ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Result</dt>
                  <dd className="text-right font-medium">
                    {state.last_sync_result.created ?? 0} new · {state.last_sync_result.merged ?? 0} matched · {state.last_sync_result.forms} form(s)
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Last lead</dt>
                <dd className="font-medium">{formatDateTime(state.stats.last_lead_at)}</dd>
              </div>
            </dl>
            {state.last_error ? (
              <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {state.last_error}
              </p>
            ) : null}
          </Section>
        </div>
      </div>

      {/* Recent imports */}
      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <div>
            <h2 className="font-semibold">Recent imports</h2>
            <p className="text-sm text-muted-foreground">The last 30 leads received from Facebook.</p>
          </div>
          {state.stats.failed > 0 ? (
            <Button size="sm" variant="outline" onClick={() => void handleRetry()} disabled={busy === "retry"}>
              <RotateCcw className="mr-2 h-4 w-4" /> Retry failed ({state.stats.failed})
            </Button>
          ) : null}
        </div>
        {leads.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No Facebook leads yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b">
                  <th className="px-5 py-3 font-medium">Lead</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Campaign</th>
                  <th className="px-5 py-3 font-medium">Received via</th>
                  <th className="px-5 py-3 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leads.map((lead) => (
                  <tr key={lead.id} className="align-top">
                    <td className="px-5 py-3">
                      {lead.student ? (
                        <Link to={studentPath(lead.student.id, lead.student.name)} className="font-medium text-primary hover:underline">
                          {lead.student.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {lead.error ? <p className="mt-1 max-w-xs break-words text-xs text-destructive">{lead.error}</p> : null}
                    </td>
                    <td className="px-5 py-3">{LEAD_STATUS[lead.status]}</td>
                    <td className="max-w-[220px] truncate px-5 py-3" title={lead.campaign}>{lead.campaign || "—"}</td>
                    <td className="px-5 py-3 capitalize text-muted-foreground">{lead.via === "webhook" ? "Real time" : "Sync"}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{formatDateTime(lead.submitted_at ?? lead.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
