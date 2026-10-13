import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth"

type Portal = "crm" | "admin"

const PORTAL_COPY: Record<Portal, { cardTitle: string; cardSubtitle: string }> = {
  crm: {
    cardTitle: "Staff sign in",
    cardSubtitle: "This workspace is for counselors, managers and administrators only.",
  },
  admin: {
    cardTitle: "Administrator sign in",
    cardSubtitle: "This console is for authorized administrator accounts only.",
  },
}

// Each portal always lands on its own dashboard - the admin login goes
// straight to /admin, the CRM login straight to /crm - rather than a
// role-based redirect, so which page you signed in on is what decides
// where you land, not just who you are. A deep link into that same portal
// (e.g. bounced from /admin/users by RequireAdmin) is still honored so an
// expired session doesn't lose your place.
const PORTAL_HOME: Record<Portal, string> = {
  crm: "/crm",
  admin: "/admin",
}

export default function LoginPage({ portal = "crm" }: { portal?: Portal }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const copy = PORTAL_COPY[portal]
  const home = PORTAL_HOME[portal]

  const explicitFrom = (location.state as { from?: { pathname?: string } | string } | null)?.from
  const explicitPath = typeof explicitFrom === "string" ? explicitFrom : explicitFrom?.pathname
  const target = explicitPath && explicitPath.startsWith(home) ? explicitPath : home

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await login({ email, password, remember_me: rememberMe, portal })
      navigate(target, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log in.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="rounded-3xl border bg-card/95 p-6 shadow-xl backdrop-blur sm:p-8"
        >
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-foreground">{copy.cardTitle}</h2>
            <p className="text-sm text-muted-foreground">{copy.cardSubtitle}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-10" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-10" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
              Remember me for 30 days
            </label>

            {error ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              Sign in
            </Button>
          </div>

          <div className="mt-6 flex items-center justify-between text-sm">
            <Link className="text-primary hover:underline" to="/password-reset">Forgot password?</Link>
            <Link className="text-muted-foreground hover:text-foreground" to={portal === "admin" ? "/login" : "/admin/login"}>
              {portal === "admin" ? "Counselor / CRM sign in" : "Administrator sign in"}
            </Link>
          </div>
        </motion.form>
      </div>
    </div>
  )
}
