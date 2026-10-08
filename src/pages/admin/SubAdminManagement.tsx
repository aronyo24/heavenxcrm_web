import { useEffect, useState } from "react"
import { Plus, Trash2, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { createSubAdmin, deleteSubAdmin, fetchSubAdmins, updateSubAdmin } from "@/lib/api"
import type { AdminPermissions, SubAdmin } from "@/lib/types"
import { PageHeader } from "@/components/crm/PageHeader"

const PERMISSION_LABELS: Partial<Record<keyof AdminPermissions, string>> = {
  view_all_records: "View all records",
  edit_records: "Edit records",
  delete_records: "Delete records",
  manage_sub_admins: "Manage sub-admins",
  view_analytics: "View analytics",
  export_reports: "Export reports",
}

export default function SubAdminManagement() {
  const [subAdmins, setSubAdmins] = useState<SubAdmin[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: "", password: "", full_name: "" })
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      setSubAdmins(await fetchSubAdmins())
    } catch (err) {
      console.error("Failed to load sub-admins:", err)
      setSubAdmins([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const handleCreate = async () => {
    if (!form.email || !form.password) return
    await createSubAdmin(form)
    setForm({ email: "", password: "", full_name: "" })
    setShowForm(false)
    await load()
  }

  const togglePermission = async (admin: SubAdmin, key: keyof AdminPermissions) => {
    const perms = { ...admin.permissions, [key]: !admin.permissions[key] }
    await updateSubAdmin(admin.id, { permissions: perms })
    await load()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Sub-admins"
        description="Create staff accounts and control what each one can access"
        actions={
          <>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-2" /> Add Sub-Admin
            </Button>
          </>
        }
      />

      {showForm && (
        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <h3 className="font-semibold">New Sub-Admin</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <Button onClick={() => void handleCreate()}>Create Account</Button>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="text-muted-foreground animate-pulse">Loading...</div>
        ) : subAdmins.map((admin) => (
          <div key={admin.id} className="rounded-2xl border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="font-semibold">{admin.full_name || admin.email}</span>
                  <Badge variant={admin.is_active ? "default" : "secondary"}>
                    {admin.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{admin.email}</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => void deleteSubAdmin(admin.id).then(load)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(Object.keys(PERMISSION_LABELS) as Array<keyof AdminPermissions>).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => void togglePermission(admin, key)}
                  className={`px-3 py-1 rounded-full text-xs transition-colors ${
                    admin.permissions[key]
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {PERMISSION_LABELS[key]}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!loading && subAdmins.length === 0 && (
          <div className="text-center text-muted-foreground py-12 border border-dashed rounded-2xl">
            No sub-admins yet. Create one to delegate admin access.
          </div>
        )}
      </div>
    </div>
  )
}
