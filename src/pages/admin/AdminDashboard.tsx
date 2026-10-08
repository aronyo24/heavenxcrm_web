import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Bot, CheckCircle2, Clock, FileText,
  Filter, Globe, GraduationCap, Hourglass, Inbox, ListChecks, Megaphone, MessageSquare, Minus, Printer,
  RefreshCw, Search, Trophy, UserPlus, Users, Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/crm/PageHeader"
import { StatTile } from "@/components/crm/StatTile"
import { fetchAdminDashboard } from "@/lib/api"
import type { AdminDashboardData, BusinessOverview, PeriodCount } from "@/lib/types"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

const PERIODS = [7, 30, 90] as const
type Period = (typeof PERIODS)[number]

// Same palette as StageBadge so the funnel matches the CRM pipeline.
const STAGE_BAR: Record<string, string> = {
  new: "bg-slate-400",
  contacted: "bg-blue-500",
  counseling: "bg-indigo-500",
  applied: "bg-purple-500",
  offer: "bg-amber-500",
  visa: "bg-cyan-500",
  enrolled: "bg-emerald-500",
}

const APP_STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  documents_requested: "Documents requested",
  offer_received: "Offer received",
  enrolled: "Enrolled",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
}

function greeting(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

const nf = new Intl.NumberFormat("en")
const fmt = (n: number) => nf.format(n)
const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" })

function Panel({
  title, description, icon: Icon, action, children, className, bodyClassName,
}: {
  title: string
  description?: string
  icon: React.ElementType
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn("flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm break-inside-avoid", className)}>
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      <div className={cn("flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

// Change vs the previous period of equal length. Arrow + sign carry the
// direction so it never relies on colour alone.
function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="text-xs text-muted-foreground">No earlier data</span>
  const flat = Math.abs(value) < 0.5
  const good = invert ? value < 0 : value > 0
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        flat ? "bg-muted text-muted-foreground"
          : good ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : "bg-red-500/10 text-red-700 dark:text-red-400",
      )}
    >
      <Icon className="h-3 w-3" />
      {value > 0 ? "+" : ""}{value.toFixed(0)}%
    </span>
  )
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const w = 100
  const h = 28
  const step = w / (values.length - 1)
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-8 w-full", className)} aria-hidden>
      <polygon points={`0,${h} ${pts.join(" ")} ${w},${h}`} className="fill-current opacity-10" />
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

function KpiCard({
  label, icon: Icon, data, days, spark, tone, to, hint,
}: {
  label: string
  icon: React.ElementType
  data: PeriodCount
  days: number
  spark?: number[]
  tone: string
  to?: string
  hint?: string
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-current/10", tone)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-1 text-3xl font-bold leading-none tabular-nums">{fmt(data.current)}</p>
      <div className="mt-2 flex items-center gap-2">
        <Delta value={data.change_pct} />
        <span className="truncate text-xs text-muted-foreground">{hint ?? `vs previous ${days} days (${fmt(data.previous)})`}</span>
      </div>
      {spark && <Sparkline values={spark} className={cn("mt-3", tone)} />}
    </>
  )
  const cls = "group relative block overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-all"
  return to ? (
    <Link to={to} className={cn(cls, "hover:-translate-y-0.5 hover:shadow-md")}>{body}</Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function AttentionItem({
  icon: Icon, count, label, detail, to, severity,
}: {
  icon: React.ElementType
  count: number
  label: string
  detail: string
  to: string
  severity: "critical" | "warning"
}) {
  const clear = count === 0
  return (
    <Link
      to={to}
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        clear ? "bg-card hover:bg-muted/50"
          : severity === "critical" ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
            : "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
          clear ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : severity === "critical" ? "bg-red-500/15 text-red-600 dark:text-red-400"
              : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        )}
      >
        {clear ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold tabular-nums leading-none">{fmt(count)}</span>
          <span className="truncate text-sm font-medium">{label}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">{clear ? "All clear" : detail}</span>
      </span>
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  )
}

// Ranked horizontal bars - easier to compare than a pie and labels never collide.
function BarList({
  rows, barClass = "bg-amber-500", emptyText, valueSuffix = "",
}: {
  rows: Array<{ label: string; value: number }>
  barClass?: string
  emptyText: string
  valueSuffix?: string
}) {
  if (rows.length === 0) return <Empty>{emptyText}</Empty>
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="group" title={`${r.label}: ${fmt(r.value)}${valueSuffix}`}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="tabular-nums text-muted-foreground">{fmt(r.value)}{valueSuffix}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full transition-all group-hover:opacity-80", barClass)} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function TrendChart({ trend }: { trend: BusinessOverview["trend"] }) {
  const total = trend.reduce((s, d) => s + d.leads + d.applications, 0)
  if (total === 0) return <Empty>No leads or applications in this period yet.</Empty>
  return (
    <div className="h-64 [--series-apps:#4f46e5] [--series-leads:#059669] dark:[--series-apps:#6366f1]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            labelFormatter={(v) => new Date(`${v}T00:00:00`).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
          />
          <Line type="monotone" dataKey="leads" name="New leads" stroke="var(--series-leads)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="applications" name="Applications" stroke="var(--series-apps)" strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground [--series-apps:#4f46e5] [--series-leads:#059669] dark:[--series-apps:#6366f1]">
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded bg-[var(--series-leads)]" /> New leads
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded border-t-2 border-dashed border-[var(--series-apps)]" /> Applications
      </span>
    </div>
  )
}

function Funnel({ funnel, total }: { funnel: BusinessOverview["funnel"]; total: number }) {
  if (total === 0) return <Empty>No students in the pipeline yet.</Empty>
  const max = Math.max(...funnel.map((s) => s.count), 1)
  return (
    <ul className="space-y-2.5">
      {funnel.map((s) => (
        <li key={s.key} title={`${s.label}: ${fmt(s.count)} students`}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5">
              {s.label}
              {s.is_won && <Trophy className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {fmt(s.count)} <span className="text-xs">· {total ? Math.round((s.count / total) * 100) : 0}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", STAGE_BAR[s.key] ?? (s.is_won ? "bg-emerald-500" : "bg-slate-400"))}
              style={{ width: `${Math.max((s.count / max) * 100, s.count ? 3 : 0)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function ConversionRing({ pct }: { pct: number }) {
  const r = 36
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-24 w-24 flex-shrink-0">
      <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" strokeWidth="8" className="stroke-muted" />
        <circle
          cx="44" cy="44" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
          className="stroke-emerald-500 transition-all duration-700"
          strokeDasharray={`${(Math.min(pct, 100) / 100) * c} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums leading-none">{pct.toFixed(pct < 10 ? 1 : 0)}%</span>
        <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">converted</span>
      </div>
    </div>
  )
}

function CounselorTable({ rows, days }: { rows: BusinessOverview["counselors"]; days: number }) {
  if (rows.length === 0) return <Empty>No active counselors yet. Add them from the CRM Counselors page.</Empty>
  return (
    <div className="-mx-4 -mb-4 overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2">Counselor</th>
            <th className="px-3 py-2">Caseload</th>
            <th className="px-3 py-2 text-right">New ({days}d)</th>
            <th className="px-3 py-2 text-right">Enrolled ({days}d)</th>
            <th className="px-3 py-2 text-right">Tasks done</th>
            <th className="px-4 py-2 text-right">Overdue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => {
            const load = c.capacity ? Math.min(c.active / c.capacity, 1) : 0
            return (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        i === 0 && c.enrolled > 0 ? "bg-amber-400 text-[#13204a]" : "bg-muted text-muted-foreground",
                      )}
                      title={i === 0 && c.enrolled > 0 ? "Top performer this period" : undefined}
                    >
                      {i === 0 && c.enrolled > 0 ? <Trophy className="h-3.5 w-3.5" /> : c.name[0]?.toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2" title={`${c.active} of ${c.capacity} active students`}>
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", load >= 0.9 ? "bg-red-500" : load >= 0.7 ? "bg-amber-500" : "bg-emerald-500")}
                        style={{ width: `${load * 100}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-xs text-muted-foreground">{c.active}/{c.capacity}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmt(c.new)}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{fmt(c.enrolled)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmt(c.tasks_done)}</td>
                <td className="px-4 py-2.5 text-right">
                  {c.tasks_overdue > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
                      <AlertTriangle className="h-3 w-3" /> {c.tasks_overdue}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SourcesTable({ biz }: { biz: BusinessOverview }) {
  if (biz.lead_sources.length === 0) {
    return <Empty>No lead sources recorded yet. Set a source on each student to see which channels convert.</Empty>
  }
  return (
    <div className="space-y-3">
      {biz.lead_sources.map((s) => (
        <div key={s.name} title={`${s.name}: ${s.total} leads, ${s.won} enrolled`}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium">{s.name}</span>
              <span className="rounded bg-muted px-1.5 py-px text-[10px] uppercase tracking-wider text-muted-foreground">{s.category}</span>
            </span>
            <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">
              {fmt(s.total)} leads · <span className="font-semibold text-foreground">{s.conversion_pct}%</span> enrolled
            </span>
          </div>
          <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-emerald-500" style={{ width: `${s.conversion_pct}%` }} />
          </div>
        </div>
      ))}
      {biz.leads_without_source > 0 && (
        <p className="pt-1 text-xs text-muted-foreground">
          {fmt(biz.leads_without_source)} students have no source recorded.
        </p>
      )}
    </div>
  )
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [days, setDays] = useState<Period>(30)
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  // `loading` is switched on by the callers (initial state, period change,
  // Refresh); the silent background poll leaves it off.
  const load = useCallback(async () => {
    try {
      const next = await fetchAdminDashboard(days)
      setData(next)
      setFailed(false)
      setUpdatedAt(new Date())
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch keyed by period; state is only set after the await
    void load()
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, 60_000)
    return () => clearInterval(interval)
  }, [load])

  if (loading && !data) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-16 w-1/2 rounded-xl bg-muted/60" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-36 rounded-xl bg-muted/60" />)}
        </div>
        <div className="h-24 rounded-xl bg-muted/60" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-80 rounded-xl bg-muted/60 lg:col-span-2" />
          <div className="h-80 rounded-xl bg-muted/60" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Zap className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="font-medium text-destructive">Couldn't load the dashboard.</p>
        <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
        <Button onClick={() => { setLoading(true); void load() }} className="mt-4" size="sm">Retry</Button>
      </div>
    )
  }

  const { business: biz, summary, visitor_countries, submission_analytics, chatbot_analytics, search_trends } = data
  const now = new Date()
  const firstName = user?.full_name?.split(" ")[0] || "Admin"
  const { attention: att } = biz
  const attentionCount = att.unassigned_leads + att.overdue_tasks + att.stuck_students + att.pending_applications
  const totalInPipeline = biz.funnel.reduce((s, f) => s + f.count, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={now.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        title={`${greeting(now.getHours())}, ${firstName}`}
        description={
          attentionCount > 0
            ? `${fmt(attentionCount)} item${attentionCount === 1 ? "" : "s"} need attention. Here's how the business performed over the last ${days} days.`
            : `Everything is on track. Here's how the business performed over the last ${days} days.`
        }
        actions={
          <>
            <div className="inline-flex rounded-lg border bg-card p-0.5 shadow-sm print:hidden" role="group" aria-label="Reporting period">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { if (p !== days) { setLoading(true); setDays(p) } }}
                  aria-pressed={days === p}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    days === p ? "bg-[#13204a] text-white dark:bg-amber-400 dark:text-[#13204a]" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p} days
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); void load() }} disabled={loading} className="print:hidden" title={updatedAt ? `Last updated ${updatedAt.toLocaleTimeString()}` : undefined}>
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
              {updatedAt ? updatedAt.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" }) : "Refresh"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Print report
            </Button>
          </>
        }
      />
      {failed && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 print:hidden">
          Couldn't refresh just now - showing the last loaded numbers.
        </p>
      )}

      {/* Headline KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="New leads" icon={UserPlus} data={biz.kpis.leads} days={days} tone="text-emerald-600 dark:text-emerald-400" spark={biz.trend.map((d) => d.leads)} to="/crm/leads" />
        <KpiCard label="Applications" icon={FileText} data={biz.kpis.applications} days={days} tone="text-indigo-600 dark:text-indigo-400" spark={biz.trend.map((d) => d.applications)} to="/crm/applications" />
        <KpiCard label="Enrolments" icon={GraduationCap} data={biz.kpis.enrolled} days={days} tone="text-amber-600 dark:text-amber-400" spark={undefined} hint={`${fmt(biz.totals.won)} enrolled all-time`} />
        <KpiCard label="Website visitors" icon={Globe} data={biz.kpis.visitors} days={days} tone="text-sky-600 dark:text-sky-400" spark={biz.trend.map((d) => d.visitors)} to="/admin/visitors" />
      </div>

      {/* Needs attention */}
      <Panel
        title="Needs attention"
        description="Open the item to act on it in the CRM"
        icon={AlertTriangle}
        className="print:hidden"
        bodyClassName="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
      >
        <AttentionItem
          icon={Inbox} count={att.unassigned_leads} label="unassigned leads" to="/crm/leads" severity={att.stale_unassigned ? "critical" : "warning"}
          detail={att.stale_unassigned ? `${att.stale_unassigned} waiting over 24 hours` : "Assign a counselor to follow up"}
        />
        <AttentionItem icon={ListChecks} count={att.overdue_tasks} label="overdue tasks" to="/crm/tasks?view=overdue" severity="critical" detail="Follow-ups past their due time" />
        <AttentionItem icon={Hourglass} count={att.stuck_students} label="stalled students" to="/crm/pipeline" severity="warning" detail="No status change in 14+ days" />
        <AttentionItem
          icon={FileText} count={att.pending_applications} label="applications to review" to="/crm/applications" severity="warning"
          detail={att.documents_requested ? `${att.documents_requested} more waiting on documents` : "Submitted or under review"}
        />
      </Panel>

      {/* Trend + conversion */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Leads & applications" description={`Daily, last ${days} days`} icon={Activity} className="lg:col-span-2" action={<Legend />}>
          <TrendChart trend={biz.trend} />
        </Panel>
        <Panel title="Conversion" description="All students, all time" icon={Trophy}>
          <div className="flex items-center gap-5">
            <ConversionRing pct={biz.totals.conversion_pct} />
            <dl className="flex-1 space-y-2 text-sm">
              {[
                { label: "In progress", value: biz.totals.open, dot: "bg-sky-500" },
                { label: "Enrolled", value: biz.totals.won, dot: "bg-emerald-500" },
                { label: "Lost", value: biz.totals.lost, dot: "bg-slate-400" },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-2 text-muted-foreground"><span className={cn("h-2 w-2 rounded-full", r.dot)} />{r.label}</dt>
                  <dd className="font-semibold tabular-nums">{fmt(r.value)}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2 border-t pt-2">
                <dt className="text-muted-foreground">Total students</dt>
                <dd className="font-semibold tabular-nums">{fmt(biz.totals.students)}</dd>
              </div>
            </dl>
          </div>
          <div className="mt-5 border-t pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Applications by status</p>
            {biz.applications_by_status.length === 0 ? (
              <p className="text-sm text-muted-foreground">No applications yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {biz.applications_by_status.map((a) => (
                  <span key={a.status} className="rounded-full border bg-muted/40 px-2 py-0.5 text-xs">
                    {APP_STATUS_LABEL[a.status] ?? a.status} <span className="font-semibold tabular-nums">{a.count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Funnel + sources */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Pipeline funnel"
          description={`${fmt(totalInPipeline)} active students by status`}
          icon={Filter}
          action={<Link to="/crm/pipeline" className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400 print:hidden">Open pipeline</Link>}
        >
          <Funnel funnel={biz.funnel} total={totalInPipeline} />
        </Panel>
        <Panel title="Lead sources" description="Which channels bring students who enrol" icon={Megaphone}>
          <SourcesTable biz={biz} />
        </Panel>
      </div>

      {/* Team */}
      <Panel
        title="Counselor performance"
        description={`Ranked by enrolments in the last ${days} days`}
        icon={Users}
        action={<Link to="/crm/counselors" className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400 print:hidden">Manage team</Link>}
      >
        <CounselorTable rows={biz.counselors} days={days} />
      </Panel>

      {/* Website & AI advisor */}
      <div className="pt-2">
        <h2 className="text-sm font-semibold">Website & AI advisor</h2>
        <p className="text-xs text-muted-foreground">How students find and use the public site</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Visitors today" value={fmt(summary.today_visitors ?? 0)} hint={`${fmt(summary.total_visitors ?? 0)} all-time`} icon={Globe} tone="sky" />
        <StatTile label="Advisor forms" value={fmt(summary.today_submissions ?? 0)} hint={`today · ${fmt(summary.total_submissions ?? 0)} total`} icon={FileText} tone="violet" />
        <StatTile label="Chat prompts" value={fmt(summary.today_chat_prompts ?? 0)} hint={`today · ${fmt(summary.total_chat_prompts ?? 0)} total`} icon={MessageSquare} tone="emerald" />
        <StatTile label="Registered users" value={fmt(summary.total_users ?? 0)} hint={`${fmt(summary.resume_analyses ?? 0)} CV analyses run`} icon={Users} tone="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Visitor countries" description="Where site visitors come from" icon={Globe}>
          <BarList
            rows={visitor_countries.slice(0, 7).map((c) => ({ label: c.country || "Unknown", value: c.count }))}
            barClass="bg-sky-500"
            emptyText="No visitor location data yet."
          />
        </Panel>
        <Panel title="Study destinations" description="Countries students want to study in" icon={GraduationCap}>
          <BarList
            rows={submission_analytics.countries.slice(0, 7).map((c) => ({ label: c.country, value: c.count }))}
            barClass="bg-amber-500"
            emptyText="Appears once students complete the AI advisor."
          />
        </Panel>
        <Panel title="Chatbot topics" description="What students ask the AI advisor" icon={Bot}>
          <BarList
            rows={chatbot_analytics.category_breakdown.slice(0, 7).map((c) => ({ label: c.category.replace(/_/g, " "), value: c.count }))}
            barClass="bg-emerald-500"
            emptyText="No chat data yet."
          />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Top universities" description="Most requested in advisor forms" icon={Trophy}>
          <BarList
            rows={submission_analytics.universities.slice(0, 6).map((u) => ({ label: u.name, value: u.count }))}
            barClass="bg-indigo-500"
            emptyText="No submission data yet."
          />
        </Panel>
        <Panel title="Top searches" description="What visitors search for on the site" icon={Search}>
          {search_trends.top_queries.length === 0 ? (
            <Empty>No search queries recorded yet.</Empty>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {search_trends.top_queries.slice(0, 18).map((q) => (
                <span key={q.query} className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                  {q.query} <span className="tabular-nums text-muted-foreground">{q.count}</span>
                </span>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Recent site activity"
        icon={Clock}
        className="print:hidden"
        action={<Link to="/admin/activity" className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400">View all</Link>}
      >
        {(data.recent_activity ?? []).length === 0 ? (
          <Empty>No activity recorded yet.</Empty>
        ) : (
          <ul className="-my-1 divide-y">
            {data.recent_activity.slice(0, 8).map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-24 flex-shrink-0 truncate text-xs capitalize text-muted-foreground">{e.event_type.replace(/_/g, " ")}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{e.page_path}</span>
                <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">
                  {new Date(e.created_at).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
