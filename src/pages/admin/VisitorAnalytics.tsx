import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { Download, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChartCard } from "@/components/admin/ChartCard"
import { ChartEmpty } from "@/components/admin/ChartEmpty"
import { SummaryCards } from "@/components/admin/SummaryCards"
import { Globe, Monitor, Smartphone, Tablet } from "lucide-react"
import { apiClient, fetchVisitorHeatmap, getExportReportUrl } from "@/lib/api"
import { PageHeader } from "@/components/crm/PageHeader"

const RANGE_OPTIONS = [
  { value: "day",   label: "Day",      unit: "today" },
  { value: "month", label: "Month",    unit: "this month" },
  { value: "year",  label: "Year",     unit: "this year" },
  { value: "all",   label: "All Time", unit: "all time" },
] as const

type RangeValue = typeof RANGE_OPTIONS[number]["value"]

export default function VisitorAnalytics() {
  const [heatmap, setHeatmap]   = useState<{ total: number; countries: Array<Record<string, unknown>> } | null>(null)
  const [stats,   setStats]     = useState<Record<string, unknown> | null>(null)
  const [range,   setRange]     = useState<RangeValue>("month")
  const [loading, setLoading]   = useState(true)

  const load = async (selectedRange: RangeValue) => {
    setLoading(true)
    try {
      const [hm, st] = await Promise.all([
        fetchVisitorHeatmap(),
        apiClient.get("/visitors/stats/", { params: { range: selectedRange } }).then((r) => r.data),
      ])
      setHeatmap(hm)
      setStats(st)
    } catch (err) {
      console.error("Visitor analytics failed:", err)
      setHeatmap(null)
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load(range) }, [range])

  const countries = (heatmap?.countries || []) as Array<{ country: string; visit_count: number; percentage: number }>
  const devices   = (stats?.device_breakdown || {}) as Record<string, number>
  const rangeTrend = (stats?.range_trend || []) as Array<{ label: string; count: number }>
  const rangeOption = RANGE_OPTIONS.find((o) => o.value === range) ?? RANGE_OPTIONS[1]
  const rangeVisitors = (stats?.range_visitors as number) ?? 0

  if (loading && !heatmap && !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-muted/60" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-muted/60" />)}
        </div>
        <div className="h-72 rounded-2xl bg-muted/60" />
        <div className="h-64 rounded-2xl bg-muted/60" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Visitors"
        description="Website traffic by country and over time"
        actions={
          <>
            <div className="flex gap-2">
              <Select value={range} onValueChange={(v) => setRange(v as RangeValue)}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Range" /></SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => void load(range)} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={getExportReportUrl("activity")} download><Download className="w-4 h-4 mr-2" /> Export</a>
              </Button>
            </div>
          </>
        }
      />

      <SummaryCards cards={[
        { label: "Total Visitors", value: heatmap?.total  ?? (stats?.total_visitors as number) ?? 0, icon: Globe },
        { label: "Desktop",        value: devices.desktop ?? 0, icon: Monitor },
        { label: "Mobile",         value: devices.mobile  ?? 0, icon: Smartphone },
        { label: "Tablet",         value: devices.tablet  ?? 0, icon: Tablet },
      ]} />

      <ChartCard title={`Visits — ${rangeOption.label}`} description={`${rangeVisitors.toLocaleString()} visits ${rangeOption.unit}`}>
        {rangeTrend.length === 0 ? (
          <ChartEmpty message="No visit trend data yet" hint="Trend data builds up as visitors are tracked over time." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rangeTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={range === "all" ? -25 : 0} textAnchor={range === "all" ? "end" : "middle"} height={range === "all" ? 50 : 30} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Country Heatmap Data" description="Visit count by country">
        {countries.length === 0 ? (
          <ChartEmpty
            message="No visitor country data yet"
            hint="Country data is resolved from the visitor's public IP address and is unavailable on localhost."
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={countries.slice(0, 15).map((c) => ({ name: c.country, count: c.visit_count }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={70} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Country</th>
              <th className="text-right p-3 font-medium">Visits</th>
              <th className="text-right p-3 font-medium">% of Traffic</th>
            </tr>
          </thead>
          <tbody>
            {countries.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-6 text-center text-muted-foreground">
                  No country data available — visitor IPs resolve only for public (non-localhost) deployments.
                </td>
              </tr>
            ) : (
              countries.map((c) => (
                <tr key={c.country} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="p-3">{c.country}</td>
                  <td className="p-3 text-right font-mono">{c.visit_count}</td>
                  <td className="p-3 text-right font-mono">{c.percentage}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
