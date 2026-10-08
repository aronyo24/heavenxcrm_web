import { useEffect, useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts"
import { Download, RefreshCw, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChartCard } from "@/components/admin/ChartCard"
import { ChartEmpty } from "@/components/admin/ChartEmpty"
import { SummaryCards } from "@/components/admin/SummaryCards"
import { Bot, MessageSquare, Clock } from "lucide-react"
import { fetchChatbotAnalytics, fetchChatLogs, getExportReportUrl } from "@/lib/api"
import type { ChatbotAnalytics } from "@/lib/types"
import { PageHeader } from "@/components/crm/PageHeader"

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"]

export default function ChatbotAnalyticsPage() {
  const [data, setData] = useState<ChatbotAnalytics | null>(null)
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [analytics, chatLogs] = await Promise.all([
        fetchChatbotAnalytics(),
        fetchChatLogs({ limit: "50" }),
      ])
      setData(analytics)
      setLogs(chatLogs.logs || [])
    } catch (err) {
      console.error("Chatbot analytics failed:", err)
      setData(null)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const topKeywords   = data?.top_keywords    || []
  const categories    = data?.category_breakdown || []
  const hourlyUsage   = data?.hourly_usage    || []
  const dailyUsage    = data?.daily_usage     || []

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-muted/60" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-muted/60" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-64 rounded-2xl bg-muted/60" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Chatbot"
        description="What students ask the AI advisor, by topic and keyword"
        actions={
          <>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={getExportReportUrl("chat")} download><Download className="w-4 h-4 mr-2" /> Export CSV</a>
              </Button>
            </div>
          </>
        }
      />

      <SummaryCards cards={[
        { label: "Total Prompts",  value: data?.total_prompts        ?? 0, icon: MessageSquare },
        { label: "Categories",     value: categories.length,               icon: Bot },
        { label: "Flagged",        value: data?.flagged_prompts?.length    ?? 0, icon: AlertTriangle },
        { label: "Unanswered",     value: data?.unanswered_prompts?.length ?? 0, icon: Clock },
      ]} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Top Keywords">
          {topKeywords.length === 0 ? (
            <ChartEmpty message="No keyword data yet" hint="Populated as users chat with the AI advisor." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topKeywords}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="keyword" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Category Breakdown">
          {categories.length === 0 ? (
            <ChartEmpty message="No category data yet" hint="Populated as users chat with the AI advisor." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categories.map((c) => ({ name: c.category, value: c.count }))}
                  dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                  label={({ name, percent }) => `${name} ${percent !== undefined ? (percent * 100).toFixed(0) : 0}%`}
                >
                  {categories.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Usage by Hour">
          {hourlyUsage.length === 0 ? (
            <ChartEmpty message="No hourly data yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Daily Usage Volume">
          {dailyUsage.length === 0 ? (
            <ChartEmpty message="No daily data yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {(data?.unanswered_prompts?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h3 className="font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" /> Repeated / Unanswered Questions
          </h3>
          <div className="mt-3 space-y-2">
            {data!.unanswered_prompts.slice(0, 10).map((p) => (
              <div key={p.id} className="text-sm p-2 rounded-lg bg-background/80">
                <span className="text-xs text-muted-foreground">{p.category} · {p.session_id.slice(0, 8)}</span>
                <p className="mt-0.5">{p.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-semibold mb-3">Conversation Logs</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No conversation logs yet. Start chatting with the AI advisor to populate this.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id as number} className={`text-sm p-3 rounded-lg ${log.role === "user" ? "bg-primary/5" : "bg-muted/50"}`}>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="capitalize">{log.role as string} · {log.category as string}</span>
                  <span>{new Date(log.created_at as string).toLocaleString()}</span>
                </div>
                <p className="mt-1">{log.message as string}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
