import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { PersonAvatar } from "@/components/crm/PersonAvatar"
import { createCounselor, deleteCounselor, fetchCounselorPerformance, fetchCounselors, updateCounselor } from "@/lib/crm-api"
import type { Counselor, CounselorPerformance } from "@/lib/crm-types"
import { useAuth } from "@/lib/auth"
import { PageHeader } from "@/components/crm/PageHeader"

export default function CounselorManagement() {
  const { user } = useAuth()
  // Provisioning counselor accounts is admin-only - a counselor (or a
  // sub-admin without it explicitly granted) can view this directory but
  // shouldn't see controls that only a full admin can actually use.
  const isFullAdmin = user?.role === "admin"
  const [counselors, setCounselors] = useState<Counselor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ new_user_full_name: "", new_user_email: "", new_user_password: "", employee_code: "" })
  const [performance, setPerformance] = useState<Record<number, CounselorPerformance>>({})
  const [removing, setRemoving] = useState<Counselor | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchCounselors()
      setCounselors(data)
      const entries = await Promise.all(
        data.map(async (c) => [c.id, await fetchCounselorPerformance(c.id).catch(() => null)] as const)
      )
      setPerformance(Object.fromEntries(entries.filter(([, v]) => v)) as Record<number, CounselorPerformance>)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load counselors")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleCreate = async () => {
    if (!form.new_user_email || !form.new_user_password) return
    try {
      await createCounselor(form)
      toast.success("Counselor added")
      setForm({ new_user_full_name: "", new_user_email: "", new_user_password: "", employee_code: "" })
      setShowForm(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add counselor")
    }
  }

  const toggleActive = async (counselor: Counselor) => {
    try {
      await updateCounselor(counselor.id, { is_active: !counselor.is_active })
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update counselor")
    }
  }

  const handleRemove = async () => {
    if (!removing) return
    setRemoveBusy(true)
    try {
      const res = await deleteCounselor(removing.id)
      const parts = [`${res.released_students} student${res.released_students === 1 ? "" : "s"} moved to Leads`]
      if (res.reassigned_tasks) parts.push(`${res.reassigned_tasks} open task${res.reassigned_tasks === 1 ? "" : "s"} reassigned to you`)
      toast.success(`${removing.full_name} removed`, { description: parts.join(" · ") })
      setRemoving(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove counselor")
    } finally {
      setRemoveBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader eyebrow="Team" title="Counselors" description="Counselor accounts, caseloads and capacity." />
        {isFullAdmin && (
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Add Counselor</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Counselor</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Full name" value={form.new_user_full_name} onChange={(e) => setForm({ ...form, new_user_full_name: e.target.value })} />
                <Input placeholder="Email" type="email" value={form.new_user_email} onChange={(e) => setForm({ ...form, new_user_email: e.target.value })} />
                <Input placeholder="Password" type="password" value={form.new_user_password} onChange={(e) => setForm({ ...form, new_user_password: e.target.value })} />
                <Input placeholder="Employee code (optional)" value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} />
              </div>
              <DialogFooter>
                <Button onClick={() => void handleCreate()}>Create Account</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-muted-foreground animate-pulse">Loading...</div>
        ) : counselors.map((counselor) => {
          const perf = performance[counselor.id]
          return (
            <div key={counselor.id} className="rounded-2xl border bg-card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <PersonAvatar name={counselor.full_name} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{counselor.full_name}</span>
                      <Badge variant={counselor.is_active ? "default" : "secondary"}>
                        {counselor.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{counselor.email}</p>
                  </div>
                </div>
                {isFullAdmin && counselor.user_id !== user?.id && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void toggleActive(counselor)}>
                      {counselor.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10"
                      onClick={() => setRemoving(counselor)}
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" /> Remove
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Stat label="Caseload" value={`${counselor.active_student_count} / ${counselor.max_active_students}`} />
                <Stat label="Total Students" value={perf?.total_students ?? "—"} />
                <Stat label="Conversion Rate" value={perf ? `${perf.conversion_rate}%` : "—"} />
                <Stat label="Open Tasks" value={perf?.open_tasks ?? "—"} />
              </div>
            </div>
          )
        })}
        {!loading && counselors.length === 0 && (
          <div className="text-center text-muted-foreground py-12 border border-dashed rounded-2xl">
            No counselors yet. Add one to start assigning leads.
          </div>
        )}
      </div>

      <Dialog open={removing != null} onOpenChange={(open) => { if (!open && !removeBusy) setRemoving(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removing?.full_name}?</DialogTitle>
            <DialogDescription>
              They will lose access to the CRM straight away. Their{" "}
              {removing?.active_student_count ?? 0} active student{removing?.active_student_count === 1 ? "" : "s"} will
              move back to Leads so you can reassign them, and their open tasks will be reassigned to you.
              Past notes, messages and activity are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)} disabled={removeBusy}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleRemove()} disabled={removeBusy}>
              {removeBusy ? "Removing…" : "Remove counselor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold mt-0.5">{value}</p>
    </div>
  )
}
