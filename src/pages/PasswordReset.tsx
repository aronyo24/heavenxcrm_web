import { useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BrandLogo } from "@/components/brand-logo"
import { requestPasswordReset } from "@/lib/api"

export default function PasswordResetPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    try {
      const result = await requestPasswordReset(email)
      setMessage(result.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request password reset.")
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
        <h1 className="text-3xl font-bold text-foreground">Reset your password</h1>
        <p className="mt-2 text-muted-foreground">We’ll send a reset link to the email attached to your account.</p>

        <div className="mt-6 space-y-4">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-10" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </div>

          {message ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">{message}</div> : null}
          {error ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

          <Button className="w-full" size="lg" type="submit" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
            Send reset link
          </Button>

          <p className="text-sm text-muted-foreground">
            Remembered it? <Link className="text-primary hover:underline" to="/login">Back to login</Link>
          </p>
        </div>
      </motion.form>
    </div>
  )
}