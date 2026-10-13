import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth";
import { RequireCrm } from "@/components/require-crm";
import { CrmLayout } from "@/components/crm/CrmLayout";
import { RequireAdmin } from "@/components/require-admin";
import { RequireCrmManager } from "@/components/require-crm-manager";
import { AdminLayout } from "@/components/admin/AdminLayout";
import LoginPage from "@/pages/Login";
import PasswordResetPage from "@/pages/PasswordReset";
import PasswordResetConfirmPage from "@/pages/PasswordResetConfirm";
import MeetingRoom from "@/pages/MeetingRoom";
import CrmDashboard from "@/pages/crm/CrmDashboard";
import PipelineKanban from "@/pages/crm/PipelineKanban";
import StudentsList from "@/pages/crm/StudentsList";
import LeadsInbox from "@/pages/crm/LeadsInbox";
import StudentProfile from "@/pages/crm/StudentProfile";
import ApplicationsList from "@/pages/crm/ApplicationsList";
import CounselorManagement from "@/pages/crm/CounselorManagement";
import FacebookIntegrationPage from "@/pages/crm/FacebookIntegration";
import TasksBoard from "@/pages/crm/TasksBoard";
import CommunicationsList from "@/pages/crm/CommunicationsList";
import UniversitiesBrowse from "@/pages/crm/UniversitiesBrowse";
import ProfileSettings from "@/pages/crm/ProfileSettings";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import VisitorAnalytics from "@/pages/admin/VisitorAnalytics";
import SubmissionAnalytics from "@/pages/admin/SubmissionAnalytics";
import ChatbotAnalytics from "@/pages/admin/ChatbotAnalytics";
import ActivityFeed from "@/pages/admin/ActivityFeed";
import ManagerManagement from "@/pages/admin/ManagerManagement";
import UsersList from "@/pages/admin/UsersList";
import UserDetail from "@/pages/admin/UserDetail";

// This app hosts the CRM and admin halves of HeavenxCRM's frontend,
// split out so it can be deployed on its own staff-only domain/subdomain
// separately from the public student site (see ../heavenxcrm, which is
// student-only). It talks to the same Django API (see VITE_API_BASE_URL) -
// no backend changes needed.
export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <Router>
          <Routes>
            <Route path="/meeting/:token" element={<RequireCrm><MeetingRoom /></RequireCrm>} />
            <Route path="/login" element={<LoginPage portal="crm" />} />
            <Route path="/admin/login" element={<LoginPage portal="admin" />} />
            <Route path="/password-reset" element={<PasswordResetPage />} />
            <Route path="/reset-password/:uidb64/:token" element={<PasswordResetConfirmPage />} />
            <Route path="/crm" element={<RequireCrm><CrmLayout /></RequireCrm>}>
              <Route index element={<CrmDashboard />} />
              <Route path="pipeline" element={<PipelineKanban />} />
              <Route path="leads" element={<RequireCrmManager><LeadsInbox /></RequireCrmManager>} />
              <Route path="students" element={<StudentsList />} />
              <Route path="students/:slug" element={<StudentProfile />} />
              <Route path="applications" element={<ApplicationsList />} />
              <Route path="communications" element={<CommunicationsList />} />
              <Route path="universities" element={<UniversitiesBrowse />} />
              <Route path="counselors" element={<RequireCrmManager><CounselorManagement /></RequireCrmManager>} />
              {/* Moved to the admin panel - keep old links working. */}
              <Route path="integrations/facebook" element={<Navigate to="/admin/integrations/facebook" replace />} />
              <Route path="tasks" element={<TasksBoard />} />
              <Route path="settings" element={<ProfileSettings />} />
            </Route>
            <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
              <Route index element={<AdminDashboard />} />
              <Route path="visitors" element={<VisitorAnalytics />} />
              <Route path="submissions" element={<SubmissionAnalytics />} />
              <Route path="chatbot" element={<ChatbotAnalytics />} />
              <Route path="activity" element={<ActivityFeed />} />
              <Route path="managers" element={<ManagerManagement />} />
              <Route path="sub-admins" element={<Navigate to="/admin/managers" replace />} />
              <Route path="users" element={<UsersList />} />
              <Route path="users/:id" element={<UserDetail />} />
              <Route path="integrations/facebook" element={<FacebookIntegrationPage />} />
            </Route>
            <Route path="/" element={<Navigate to="/crm" replace />} />
            <Route path="*" element={<Navigate to="/crm" replace />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}
