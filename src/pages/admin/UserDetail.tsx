import { safeHref } from "@/lib/utils"
import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { isAxiosError } from "axios"
import {
  ArrowLeft, Mail, Phone, Calendar, Globe, Wallet, GraduationCap,
  ShieldAlert, UserCheck, Linkedin, Github, Link2, FileText, ShieldOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { apiClient } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import type { AuthUser } from "@/lib/types"

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground break-words">{value ?? "—"}</p>
      </div>
    </div>
  )
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>()
  const { user: currentUser } = useAuth()
  const isFullAdmin = currentUser?.role === "admin"
  const perms = currentUser?.permissions || {}
  const canView = isFullAdmin || !!perms.view_all_records

  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(canView)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.get(`/users/${id}/`)
      setUser(response.data?.user || null)
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) {
        setError("User not found.")
      } else if (isAxiosError(err) && (err.response?.status === 403 || err.response?.status === 401)) {
        setError("You don't have permission to view this user.")
      } else {
        setError("Failed to load user details.")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canView) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, canView])

  if (!canView) {
    return (
      <div className="text-center text-muted-foreground py-24 border border-dashed rounded-2xl flex flex-col items-center gap-3">
        <ShieldOff className="w-8 h-8" />
        <p className="font-medium text-foreground">Access restricted</p>
        <p className="text-sm max-w-sm">Only admins can see user details.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/admin/users"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Users</Link>
      </Button>

      {loading && (
        <div className="space-y-3">
          <div className="h-28 rounded-2xl bg-muted/60 animate-pulse border" />
          <div className="h-64 rounded-2xl bg-muted/60 animate-pulse border" />
        </div>
      )}

      {!loading && error && (
        <div className="text-center text-muted-foreground py-24 border border-dashed rounded-2xl">
          {error}
        </div>
      )}

      {!loading && !error && user && (
        <>
          <Card>
            <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xl flex-shrink-0">
                {(user.full_name || user.email || "U")[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">{user.full_name || user.username}</h1>
                  {user.role === "admin" && (
                    <Badge variant="default" className="bg-red-500/15 text-red-500 border-red-500/20 hover:bg-red-500/15">
                      <ShieldAlert className="w-3 h-3 mr-1" /> Admin
                    </Badge>
                  )}
                  {user.role === "sub_admin" && (
                    <Badge variant="secondary" className="bg-indigo-500/15 text-indigo-500 border-indigo-500/20 hover:bg-indigo-500/15">
                      <UserCheck className="w-3 h-3 mr-1" /> Manager
                    </Badge>
                  )}
                  {user.application_status && (
                    <Badge variant="outline" className="capitalize text-[11px]">{user.application_status}</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
                <p className="text-[11px] font-mono text-muted-foreground mt-1">ID: {user.id}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact & Profile</CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                <InfoRow icon={Mail} label="Email" value={user.email} />
                <InfoRow icon={Phone} label="Phone" value={user.phone ? `${user.phone_country_code || ""} ${user.phone}`.trim() : null} />
                <InfoRow icon={Calendar} label="Age" value={user.age} />
                <InfoRow icon={Globe} label="Current Country" value={user.country} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Application Details</CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                <InfoRow icon={Globe} label="Target Country" value={user.target_country} />
                <InfoRow
                  icon={Wallet}
                  label="Budget"
                  value={user.budget !== null && user.budget !== undefined ? `${user.budget_currency || "USD"} ${Number(user.budget).toLocaleString()}` : null}
                />
                <InfoRow icon={GraduationCap} label="Preferred Program" value={user.preferred_program} />
                <InfoRow icon={GraduationCap} label="University / Institution" value={user.university_institution} />
              </CardContent>
            </Card>

            {(user.linkedin_url || user.github_url || user.portfolio_url || user.resume_file) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Links & Documents</CardTitle>
                </CardHeader>
                <CardContent className="divide-y">
                  {user.linkedin_url && (
                    <InfoRow icon={Linkedin} label="LinkedIn" value={<a href={safeHref(user.linkedin_url)} target="_blank" rel="noreferrer" className="text-primary hover:underline">{user.linkedin_url}</a>} />
                  )}
                  {user.github_url && (
                    <InfoRow icon={Github} label="GitHub" value={<a href={safeHref(user.github_url)} target="_blank" rel="noreferrer" className="text-primary hover:underline">{user.github_url}</a>} />
                  )}
                  {user.portfolio_url && (
                    <InfoRow icon={Link2} label="Portfolio" value={<a href={safeHref(user.portfolio_url)} target="_blank" rel="noreferrer" className="text-primary hover:underline">{user.portfolio_url}</a>} />
                  )}
                  {user.resume_file && (
                    <InfoRow icon={FileText} label="Resume" value={<a href={safeHref(user.resume_file)} target="_blank" rel="noreferrer" className="text-primary hover:underline">Download resume</a>} />
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Account</CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                <InfoRow icon={UserCheck} label="Username" value={user.username} />
                <InfoRow icon={Calendar} label="Joined" value={user.created_at ? new Date(user.created_at).toLocaleString() : null} />
                <InfoRow icon={Calendar} label="Last Updated" value={user.updated_at ? new Date(user.updated_at).toLocaleString() : null} />
              </CardContent>
            </Card>

            {user.bio && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Bio</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{user.bio}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  )
}
