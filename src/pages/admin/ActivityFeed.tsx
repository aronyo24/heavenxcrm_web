import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Download, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChartCard } from "@/components/admin/ChartCard"
import { ChartEmpty } from "@/components/admin/ChartEmpty"
import { fetchActivityFeed, getExportReportUrl } from "@/lib/api"
import type { ActivityEvent } from "@/lib/types"
import { PageHeader } from "@/components/crm/PageHeader"

export default function ActivityFeedPage() {
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [pagePopularity, setPagePopularity] = useState<Array<{ page_path: string; count: number }>>([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchActivityFeed({ limit: "100" })
      setActivity(data.activity || [])
      setPagePopularity(data.page_popularity || [])
    } catch (err) {
      console.error("Activity feed failed:", err)
      setActivity([])
      setPagePopularity([])
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }

  useEffect(() => {
    void load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !loaded) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-56 rounded-lg bg-muted/60" />
        <div className="h-64 rounded-2xl bg-muted/60" />
        <div className="h-96 rounded-2xl bg-muted/60" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Live activity"
        description="Page views, clicks and form submissions as they happen"
        actions={
          <>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={getExportReportUrl("activity")} download><Download className="w-4 h-4 mr-2" /> Export CSV</a>
              </Button>
            </div>
          </>
        }
      />

      <ChartCard title="Most Visited Pages">
        {pagePopularity.length === 0 ? (
          <ChartEmpty message="No page-view data yet" hint="Data is collected automatically as users browse the site." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={pagePopularity.slice(0, 12).map((p) => ({ name: p.page_path, count: p.count }))}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium">Live feed — auto-refreshes every 30s</span>
          <span className="ml-auto text-xs text-muted-foreground">{activity.length} events</span>
        </div>
        <div className="divide-y max-h-[500px] overflow-y-auto">
          {activity.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No activity recorded yet.</div>
          ) : (
            activity.map((event) => (
              <div key={event.id} className="p-4 hover:bg-muted/30 transition-colors text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-xs font-medium capitalize">
                      {event.event_type.replace("_", " ")}
                    </span>
                    <span className="font-mono text-foreground">{event.page_path}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground flex gap-3">
                  {event.user__email && <span>User: {event.user__email}</span>}
                  {event.duration_seconds != null && <span>Duration: {event.duration_seconds.toFixed(1)}s</span>}
                  {event.element_id && <span>Element: {event.element_id}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
