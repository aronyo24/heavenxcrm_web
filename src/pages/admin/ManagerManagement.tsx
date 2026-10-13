import { useEffect, useState } from "react"
import { Check, Pencil, Plus, Shield, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { createSubAdmin, deleteSubAdmin, fetchSubAdmins, updateSubAdmin } from "@/lib/api"
import type { SubAdmin } from "@/lib/types"
import { PageHeader } from "@/components/crm/PageHeader"

// Managers are stored as role 'sub_admin' on the backend. They get the whole
// CRM (leads, counselors, assignment) but never the /admin panel, so there
// are no per-account permission toggles here.
function errorMessage(err: unknown, fallback: string) {
  const data = (err as { response?: { data?: { error?: string } } })?.response?.data
  return data?.error || fallback
}

export default function ManagerManagement() {
  const [managers, setManagers] = useState<SubAdmin[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: "", password: "", full_name: "" })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState("")

  const load = async () => {
    setLoading(true)
    try {
      setManagers(await fetchSubAdmins())
    } catch (err) {
      console.error("Failed to load managers:", err)
      setManagers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    void load()
  }, [])

  const handleCreate = async () => {
    if (!form.email || !form.password) return
    setSaving(true)
    try {
      await createSubAdmin(form)
      toast.success("Manager added")
      setForm({ email: "", password: "", full_name: "" })
      setShowForm(false)
      await load()
    } catch (err) {
      toast.error(errorMessage(err, "Could not add manager"))
    } finally {
      setSaving(false)
    }
  }

  const saveName = async (manager: SubAdmin) => {
    try {
      await updateSubAdmin(manager.id, { full_name: editName.trim() })
      setEditingId(null)
      await load()
    } catch (err) {
      toast.error(errorMessage(err, "Could not update manager"))
    }
  }

  const toggleActive = async (manager: SubAdmin) => {
    try {
      await updateSubAdmin(manager.id, { is_active: !manager.is_active })
      await load()
    } catch (err) {
      toast.error(errorMessage(err, "Could not update manager"))
    }
  }

  const remove = async (manager: SubAdmin) => {
    if (!window.confirm(`Remove manager access for ${manager.email}?`)) return
    try {
      await deleteSubAdmin(manager.id)
      toast.success("Manager removed")
      await load()
    } catch (err) {
      toast.error(errorMessage(err, "Could not remove manager"))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Managers"
        description="Managers have full access to the CRM, but not to this admin panel"
        actions={
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-2" /> Add Manager
          </Button>
        }
      />

      {showForm && (
        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <h3 className="font-semibold">New Manager</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <Button disabled={saving || !form.email || !form.password} onClick={() => void handleCreate()}>
            {saving ? "Creating..." : "Create Account"}
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="text-muted-foreground animate-pulse">Loading...</div>
        ) : managers.map((manager) => (
          <div key={manager.id} className="rounded-2xl border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  {editingId === manager.id ? (
                    <>
                      <Input
                        className="h-8 w-56"
                        value={editName}
                        autoFocus
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveName(manager)
                          if (e.key === "Escape") setEditingId(null)
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void saveName(manager)}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">{manager.full_name || manager.email}</span>
                      <button
                        type="button"
                        title="Edit name"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => { setEditingId(manager.id); setEditName(manager.full_name || "") }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <Badge variant={manager.is_active ? "default" : "secondary"}>
                    {manager.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{manager.email}</p>
                <p className="text-xs text-muted-foreground mt-2">Full CRM access</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void toggleActive(manager)}>
                  {manager.is_active ? "Deactivate" : "Activate"}
                </Button>
                <Button variant="destructive" size="sm" title="Remove manager" onClick={() => void remove(manager)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {!loading && managers.length === 0 && (
          <div className="text-center text-muted-foreground py-12 border border-dashed rounded-2xl">
            No managers yet. Add one to give someone full CRM access.
          </div>
        )}
      </div>
    </div>
  )
}
