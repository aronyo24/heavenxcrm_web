import { useRef, useState } from "react"
import { Camera, KeyRound, Loader2, Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { changePassword, updateUserProfile, uploadProfileFiles } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/env"
import { PageHeader } from "@/components/crm/PageHeader"

// The API returns media as a site-relative path (/media/...), but this app is
// served from a different origin than Django - resolve it against the API host.
function mediaUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path
  try {
    return new URL(path, API_BASE_URL).toString()
  } catch {
    return path
  }
}

export default function ProfileSettings() {
  const { user, refreshAuth } = useAuth()
  const fileInput = useRef<HTMLInputElement>(null)

  // CrmLayout only renders once auth has loaded, so `user` is already set here.
  const [fullName, setFullName] = useState(user?.full_name || "")
  const [phoneCode, setPhoneCode] = useState(user?.phone_country_code || "")
  const [phone, setPhone] = useState(user?.phone || "")
  const [country, setCountry] = useState(user?.country || "")
  const [bio, setBio] = useState(user?.bio || "")
  const [emailNotifications, setEmailNotifications] = useState(user?.email_notifications ?? true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword1, setNewPassword1] = useState("")
  const [newPassword2, setNewPassword2] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!fullName.trim()) {
      toast.error("Full name is required.")
      return
    }
    setSavingProfile(true)
    try {
      await updateUserProfile({
        full_name: fullName,
        phone_country_code: phoneCode,
        phone,
        country,
        bio,
        email_notifications: emailNotifications,
      })
      await refreshAuth()
      toast.success("Profile updated.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile.")
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePictureChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    const formData = new FormData()
    formData.append("profile_picture", file)
    setUploading(true)
    try {
      await uploadProfileFiles(formData)
      await refreshAuth()
      toast.success("Profile picture updated.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload picture.")
    } finally {
      setUploading(false)
    }
  }

  const handlePasswordSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (newPassword1 !== newPassword2) {
      toast.error("New passwords do not match.")
      return
    }
    setSavingPassword(true)
    try {
      const result = await changePassword({
        current_password: currentPassword,
        new_password1: newPassword1,
        new_password2: newPassword2,
      })
      toast.success(result.message || "Password changed.")
      setCurrentPassword("")
      setNewPassword1("")
      setNewPassword2("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password.")
    } finally {
      setSavingPassword(false)
    }
  }

  const initial = (user?.full_name || user?.email || "C")[0].toUpperCase()

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="Settings" description="Update your profile details and password." />

      <form onSubmit={handleProfileSave} className="rounded-2xl border bg-card p-6 space-y-5">
        <h2 className="text-lg font-semibold">Profile</h2>

        <div className="flex items-center gap-4">
          {user?.profile_picture ? (
            <img src={mediaUrl(user.profile_picture)} alt="" className="h-16 w-16 rounded-full object-cover border" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-xl font-bold text-[#0f2318]">
              {initial}
            </div>
          )}
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
              Change photo
            </Button>
            <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handlePictureChange} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium">Full name</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={150} required />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium">Email</label>
            <Input value={user?.email || ""} disabled />
            <p className="mt-1 text-xs text-muted-foreground">Contact an administrator to change your login email.</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Phone</label>
            <div className="flex gap-2">
              <Input className="w-24" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} placeholder="+880" />
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Country</label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium">Bio</label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={emailNotifications} onChange={(e) => setEmailNotifications(e.target.checked)} />
          Email me notifications
        </label>

        <Button type="submit" disabled={savingProfile}>
          {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save profile
        </Button>
      </form>

      <form onSubmit={handlePasswordSave} className="rounded-2xl border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Change password</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium">Current password</label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">New password</label>
            <Input type="password" value={newPassword1} onChange={(e) => setNewPassword1(e.target.value)} required autoComplete="new-password" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Confirm new password</label>
            <Input type="password" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} required autoComplete="new-password" />
          </div>
        </div>
        <Button type="submit" variant="outline" disabled={savingPassword}>
          {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
          Update password
        </Button>
      </form>
    </div>
  )
}
