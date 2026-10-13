import { Navigate } from "react-router-dom"
import { useAuth } from "@/lib/auth"

// CRM pages for admins and managers only (Leads, Counselors). Sits inside
// RequireCrm, so the user is already signed in as CRM staff here.
export function RequireCrmManager({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  if (!user?.is_crm_manager) {
    return <Navigate to="/crm" replace />
  }

  return <>{children}</>
}
