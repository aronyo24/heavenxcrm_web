import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { isAxiosError } from "axios"
import { Search, RefreshCw, UserCheck, ShieldAlert, Download, ShieldOff, Eye, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import type { AuthUser } from "@/lib/types"
import { PageHeader } from "@/components/crm/PageHeader"

const ALL = "all"

function formatBudget(user: AuthUser): string {
  if (user.budget === null || user.budget === undefined) return "—"
  const currency = user.budget_currency || "USD"
  return `${currency} ${Number(user.budget).toLocaleString()}`
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadCsv(users: AuthUser[]) {
  const headers = ["Full Name", "Email", "Phone", "Age", "Target Country", "Budget", "Program"]
  const rows = users.map((u) => [
    u.full_name || u.username,
    u.email,
    u.phone ? `${u.phone_country_code || ""} ${u.phone}`.trim() : "",
    u.age ?? "",
    u.target_country || "",
    u.budget !== null && u.budget !== undefined ? `${u.budget_currency || "USD"} ${u.budget}` : "",
    u.preferred_program || "",
  ])
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `users_export_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function UsersList() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<AuthUser[]>([])
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState(ALL)
  const [countryFilter, setCountryFilter] = useState(ALL)
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  const isFullAdmin = currentUser?.role === "admin"
  const perms = currentUser?.permissions || {}
  const canView = isFullAdmin || !!perms.view_all_records
  const canExport = isFullAdmin || !!perms.export_reports

  const load = async () => {
    setLoading(true)
    setForbidden(false)
    try {
      const response = await apiClient.get("/users/")
      // Handle array or paginated response format
      setUsers(response.data?.results || response.data || [])
    } catch (err) {
      if (isAxiosError(err) && (err.response?.status === 403 || err.response?.status === 401)) {
        setForbidden(true)
      }
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canView) void load()
    else setLoading(false)
  }, [canView])

  const countryOptions = useMemo(() => {
    const set = new Set<string>()
    users.forEach((u) => { if (u.target_country) set.add(u.target_country) })
    return Array.from(set).sort()
  }, [users])

  const filtered = useMemo(() => users.filter((u) => {
    const q = search.toLowerCase()
    const matchesSearch = !q || (
      u.email?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.target_country?.toLowerCase().includes(q) ||
      u.preferred_program?.toLowerCase().includes(q)
    )
    const matchesRole = roleFilter === ALL || (u.role || "user") === roleFilter
    const matchesCountry = countryFilter === ALL || u.target_country === countryFilter
    const matchesStatus = statusFilter === ALL || u.application_status === statusFilter
    return matchesSearch && matchesRole && matchesCountry && matchesStatus
  }), [users, search, roleFilter, countryFilter, statusFilter])

  const hasActiveFilters = search !== "" || roleFilter !== ALL || countryFilter !== ALL || statusFilter !== ALL

  const resetFilters = () => {
    setSearch("")
    setRoleFilter(ALL)
    setCountryFilter(ALL)
    setStatusFilter(ALL)
  }

  if (!canView) {
    return (
      <div className="text-center text-muted-foreground py-24 border border-dashed rounded-2xl flex flex-col items-center gap-3">
        <ShieldOff className="w-8 h-8" />
        <p className="font-medium text-foreground">Access restricted</p>
        <p className="text-sm max-w-sm">Only admins and sub-admins with the "View all records" permission can see the user list.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Registered users"
        description="Everyone who has signed up on the public site"
        actions={
          <>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
              {canExport && (
                <Button variant="outline" size="sm" onClick={() => downloadCsv(filtered)} disabled={loading || filtered.length === 0}>
                  <Download className="w-4 h-4 mr-2" /> Export CSV{hasActiveFilters ? ` (${filtered.length})` : ""}
                </Button>
              )}
            </div>
          </>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, country, program..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="w-full sm:w-40">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All roles</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="sub_admin">Sub-Admin</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-48">
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger><SelectValue placeholder="Target country" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All countries</SelectItem>
              {countryOptions.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-44">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Application status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
            <X className="w-3.5 h-3.5 mr-1.5" /> Clear filters
          </Button>
        )}
      </div>

      {forbidden && (
        <div className="text-center text-muted-foreground py-12 border border-dashed rounded-2xl">
          You don't have permission to view the user list.
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-muted/60 animate-pulse border" />
          ))}
        </div>
      ) : !forbidden && (
        <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Full Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Age</th>
                  <th className="px-4 py-3 font-semibold">Target Country</th>
                  <th className="px-4 py-3 font-semibold">Budget</th>
                  <th className="px-4 py-3 font-semibold">Program</th>
                  <th className="px-4 py-3 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground whitespace-nowrap">{u.full_name || u.username}</span>
                        {u.role === "admin" && (
                          <Badge variant="default" className="bg-red-500/15 text-red-500 border-red-500/20 text-[10px] hover:bg-red-500/15">
                            <ShieldAlert className="w-3 h-3 mr-1" /> Admin
                          </Badge>
                        )}
                        {u.role === "sub_admin" && (
                          <Badge variant="secondary" className="bg-indigo-500/15 text-indigo-500 border-indigo-500/20 text-[10px] hover:bg-indigo-500/15">
                            <UserCheck className="w-3 h-3 mr-1" /> Sub-Admin
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{u.email}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {u.phone ? `${u.phone_country_code || ""} ${u.phone}`.trim() : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.age ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{u.target_country || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatBudget(u)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{u.preferred_program || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/admin/users/${u.id}`}>
                          <Eye className="w-3.5 h-3.5 mr-1.5" /> View
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              No registered users found matching the search criteria.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
