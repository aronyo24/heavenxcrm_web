import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChartCard } from "@/components/admin/ChartCard"
import { ChartEmpty } from "@/components/admin/ChartEmpty"
import { SummaryCards } from "@/components/admin/SummaryCards"
import { FileText, DollarSign, Building2, MapPin } from "lucide-react"
import { fetchSubmissionAnalytics, getExportReportUrl } from "@/lib/api"
import type { SubmissionAnalytics } from "@/lib/types"
import { PageHeader } from "@/components/crm/PageHeader"

export default function SubmissionAnalyticsPage() {
  const [data, setData] = useState<SubmissionAnalytics | null>(null)
  const [filters, setFilters] = useState({ start_date: "", end_date: "", country: "" })
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
      setData(await fetchSubmissionAnalytics(params))
    } catch (err) {
      console.error("Submission analytics failed:", err)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const summary = data?.summary

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-56 rounded-lg bg-muted/60" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-muted/60" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-64 rounded-2xl bg-muted/60" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Reports"
        description="Advisor form submissions - filter, review and export"
        actions={
          <>
            <div className="flex flex-wrap gap-2">
              <Input type="date" value={filters.start_date} onChange={(e) => setFilters({ ...filters, start_date: e.target.value })} className="w-36" />
              <Input type="date" value={filters.end_date}   onChange={(e) => setFilters({ ...filters, end_date:   e.target.value })} className="w-36" />
              <Input placeholder="Country" value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })} className="w-32" />
              <Button size="sm" onClick={() => void load()} disabled={loading}>Apply</Button>
              <Button variant="outline" size="sm" asChild>
                <a href={getExportReportUrl("submissions", "csv", Object.fromEntries(Object.entries(filters).filter(([, v]) => v)))} download>
                  <Download className="w-4 h-4 mr-1" /> CSV
                </a>
              </Button>
            </div>
          </>
        }
      />

      <SummaryCards cards={[
        { label: "Total Submissions", value: summary?.total_submissions ?? 0, icon: FileText },
        { label: "Avg Budget",        value: `$${(summary?.average_budget ?? 0).toLocaleString()}`, icon: DollarSign },
        { label: "Top University",    value: summary?.top_university ?? "—", icon: Building2 },
        { label: "Top Country",       value: summary?.top_country    ?? "—", icon: MapPin },
      ]} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Top 10 Universities" description="Horizontal bar chart">
          {(data?.universities || []).length === 0 ? (
            <ChartEmpty message="No submission data yet" hint="Appears when users complete the AI advisor chat." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(data!.universities).slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Target Countries">
          {(data?.countries || []).length === 0 ? (
            <ChartEmpty message="No country data yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data!.countries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="country" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Budget Ranges" description="Grouped distribution">
          {(data?.budget_ranges || []).length === 0 ? (
            <ChartEmpty message="No budget data yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data!.budget_ranges}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Age Groups">
          {(data?.age_groups || []).length === 0 ? (
            <ChartEmpty message="No age-group data yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data!.age_groups}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="group" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Phone Country Codes">
          {(data?.phone_codes || []).length === 0 ? (
            <ChartEmpty message="No phone-code data yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(data!.phone_codes).map((p) => ({ name: p.code || "Unknown", count: p.count }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Services / Programs">
          {(data?.services || []).length === 0 ? (
            <ChartEmpty message="No service data yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(data!.services).map((s) => ({ name: s.service, count: s.count }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#ec4899" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  )
}
