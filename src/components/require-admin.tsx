import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/lib/auth"

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  if (!user?.is_admin) {
    // Managers and counselors are valid CRM staff but don't manage the admin dashboard -
    // send them to the surface they actually have access to instead of
    // bouncing an already-logged-in user back to the login screen.
    return <Navigate to="/crm" replace />
  }

  return <>{children}</>
}
