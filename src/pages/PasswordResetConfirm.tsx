import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BrandLogo } from "@/components/brand-logo"
import { confirmPasswordReset } from "@/lib/api"

export default function PasswordResetConfirmPage() {
  const navigate = useNavigate()
  const { uidb64 = "", token = "" } = useParams()
  const [password1, setPassword1] = useState("")
  const [password2, setPassword2] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    try {
      const result = await confirmPasswordReset(uidb64, token, password1, password2)
      setMessage(result.message)
      navigate("/login", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update password.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 pb-20 pt-16">
      <div className="mb-8 flex justify-center">
        <Link to="/login"><BrandLogo className="h-12 sm:h-14" /></Link>
      </div>
      <motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="mx-auto max-w-xl rounded-3xl border bg-card/95 p-6 shadow-xl sm:p-8">
        <h1 className="text-3xl font-bold text-foreground">Create a new password</h1>
        <p className="mt-2 text-muted-foreground">Use a strong password with upper and lower case letters, a number, and at least 8 characters.</p>

        <div className="mt-6 space-y-4">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-10" type="password" required value={password1} onChange={(event) => setPassword1(event.target.value)} placeholder="New password" />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-10" type="password" required value={password2} onChange={(event) => setPassword2(event.target.value)} placeholder="Confirm new password" />
          </div>

          {message ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">{message}</div> : null}
          {error ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

          <Button className="w-full" size="lg" type="submit" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
            Update password
          </Button>

          <p className="text-sm text-muted-foreground">
            Back to <Link className="text-primary hover:underline" to="/login">login</Link>
          </p>
        </div>
      </motion.form>
    </div>
  )
}