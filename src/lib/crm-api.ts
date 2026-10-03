/**
 * API functions for the Admission CRM (`/crm`). Built on the existing
 * `apiClient` axios instance (cookie auth + CSRF injection + error
 * normalization already configured in `src/lib/api.ts`) rather than a new
 * axios instance.
 */

import { apiClient } from "./api"
import type {
  Application,
  ApplicationListItem,
  ApplicationStatus,
  CallRequest,
  CallType,
  CommunicationChannel,
  CommunicationDirection,
  CommunicationLog,
  CommunicationStatus,
  Counselor,
  CounselorPerformance,
  CrmAuditLogEntry,
  CrmCall,
  CrmCallPollResponse,
  CrmDashboardStats,
  CrmMessage,
  CrmPaginatedResponse,
  LeadSource,
  MyCrmStatus,
  PipelineStage,
  Student,
  StudentListItem,
  StudentRecommendationsResponse,
  Task,
} from "./crm-types"

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function fetchCrmDashboard(): Promise<CrmDashboardStats> {
  const response = await apiClient.get("/crm/dashboard/")
  return response.data
}

// ---------------------------------------------------------------------------
// Pipeline stages / lead sources
// ---------------------------------------------------------------------------

export async function fetchPipelineStages(): Promise<PipelineStage[]> {
  const response = await apiClient.get("/crm/pipeline-stages/")
  return response.data
}

export async function fetchLeadSources(): Promise<LeadSource[]> {
  const response = await apiClient.get("/crm/lead-sources/")
  return response.data
}

// ---------------------------------------------------------------------------
// Counselors
// ---------------------------------------------------------------------------

export interface CreateCounselorPayload {
  new_user_email: string
  new_user_password: string
  new_user_full_name?: string
  employee_code?: string
  phone?: string
  max_active_students?: number
  specialization_countries?: string[]
}

export async function fetchCounselors(): Promise<Counselor[]> {
  const response = await apiClient.get("/crm/counselors/", { params: { limit: 100 } })
  return response.data.data as Counselor[]
}

export async function createCounselor(payload: CreateCounselorPayload): Promise<Counselor> {
  const response = await apiClient.post("/crm/counselors/", payload)
  return response.data
}

export async function updateCounselor(id: number, payload: Partial<Counselor>): Promise<Counselor> {
  const response = await apiClient.patch(`/crm/counselors/${id}/`, payload)
  return response.data
}

export async function fetchCounselorPerformance(id: number): Promise<CounselorPerformance> {
  const response = await apiClient.get(`/crm/counselors/${id}/performance/`)
  return response.data
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export interface StudentFilters {
  stage?: string
  counselor?: number | string
  lead_source?: number | string
  is_lost?: boolean
  search?: string
  ordering?: "newest" | "oldest" | "name" | "stage"
  page?: number
  limit?: number
}

export async function fetchStudents(filters: StudentFilters = {}): Promise<CrmPaginatedResponse<StudentListItem>> {
  const response = await apiClient.get("/crm/students/", { params: filters })
  return response.data
}

export async function fetchStudent(id: number | string): Promise<Student> {
  const response = await apiClient.get(`/crm/students/${id}/`)
  return response.data
}

export async function createStudent(payload: Partial<Student>): Promise<Student> {
  const response = await apiClient.post("/crm/students/", payload)
  return response.data
}

export async function updateStudent(id: number | string, payload: Partial<Student>): Promise<Student> {
  const response = await apiClient.patch(`/crm/students/${id}/`, payload)
  return response.data
}

export async function deleteStudent(id: number | string): Promise<void> {
  await apiClient.delete(`/crm/students/${id}/`)
}

export async function changeStudentStage(
  id: number | string,
  stageKey: string,
  lostReason?: string
): Promise<Student> {
  const response = await apiClient.post(`/crm/students/${id}/change_stage/`, {
    stage_key: stageKey,
    lost_reason: lostReason,
  })
  return response.data
}

export async function assignStudentCounselor(id: number | string, counselorId: number | null): Promise<Student> {
  const response = await apiClient.post(`/crm/students/${id}/assign_counselor/`, { counselor_id: counselorId })
  return response.data
}

export async function fetchStudentRecommendations(id: number | string): Promise<StudentRecommendationsResponse> {
  const response = await apiClient.get(`/crm/students/${id}/recommendations/`)
  return response.data
}

export async function searchStudents(query: string): Promise<StudentListItem[]> {
  const response = await apiClient.get("/crm/students/search/", { params: { q: query } })
  return response.data.results
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export interface ApplicationFilters {
  student?: number | string
  status?: ApplicationStatus
  university?: number | string
  search?: string
  page?: number
  limit?: number
}

export async function fetchApplications(
  filters: ApplicationFilters = {}
): Promise<CrmPaginatedResponse<ApplicationListItem>> {
  const response = await apiClient.get("/crm/applications/", { params: filters })
  return response.data
}

export async function fetchStudentApplications(studentId: number | string): Promise<ApplicationListItem[]> {
  const response = await apiClient.get("/crm/applications/", { params: { student: studentId, limit: 100 } })
  return response.data.data
}

export async function fetchApplication(id: number | string): Promise<Application> {
  const response = await apiClient.get(`/crm/applications/${id}/`)
  return response.data
}

export async function updateApplication(id: number | string, payload: { review_notes?: string }): Promise<Application> {
  const response = await apiClient.patch(`/crm/applications/${id}/`, payload)
  return response.data
}

export async function changeApplicationStatus(
  id: number | string,
  status: ApplicationStatus,
  reviewNotes?: string
): Promise<Application> {
  const response = await apiClient.post(`/crm/applications/${id}/change_status/`, {
    status,
    review_notes: reviewNotes,
  })
  return response.data
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export interface TaskFilters {
  assigned_to?: number | "me"
  status?: string
  student?: number | string
}

export async function fetchTasks(filters: TaskFilters = {}): Promise<CrmPaginatedResponse<Task>> {
  const response = await apiClient.get("/crm/tasks/", { params: filters })
  return response.data
}

export async function fetchTasksDueToday(): Promise<Task[]> {
  const response = await apiClient.get("/crm/tasks/due_today/")
  return response.data
}

export async function createTask(payload: Partial<Task>): Promise<Task> {
  const response = await apiClient.post("/crm/tasks/", payload)
  return response.data
}

export async function updateTask(id: number, payload: Partial<Task>): Promise<Task> {
  const response = await apiClient.patch(`/crm/tasks/${id}/`, payload)
  return response.data
}

export async function completeTask(id: number): Promise<Task> {
  const response = await apiClient.post(`/crm/tasks/${id}/complete/`)
  return response.data
}

export async function deleteTask(id: number): Promise<void> {
  await apiClient.delete(`/crm/tasks/${id}/`)
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function fetchCrmAuditLog(studentId?: number | string): Promise<CrmPaginatedResponse<CrmAuditLogEntry>> {
  const response = await apiClient.get("/crm/audit-log/", { params: studentId ? { student: studentId } : {} })
  return response.data
}

// ---------------------------------------------------------------------------
// Communications (email + manual call/WhatsApp/SMS/in-person/note logging)
// ---------------------------------------------------------------------------

export interface LogCommunicationPayload {
  student: number
  channel: Exclude<CommunicationChannel, "email">
  direction?: CommunicationDirection
  subject?: string
  summary: string
  duration_seconds?: number
  occurred_at?: string
}

export interface CommunicationFilters {
  student?: number | string
  channel?: CommunicationChannel
  direction?: CommunicationDirection
  status?: CommunicationStatus
  search?: string
  ordering?: "occurred_at" | "-occurred_at"
  page?: number
  limit?: number
}

export async function fetchCommunications(
  filters: CommunicationFilters = {}
): Promise<CrmPaginatedResponse<CommunicationLog>> {
  const response = await apiClient.get("/crm/communications/", { params: filters })
  return response.data
}

// Asks the backend to pull new student email replies from the shared mailbox
// now. Throttled server-side: `checked` is false when a sync ran moments ago.
export async function syncInbox(): Promise<{ checked: boolean; logged: number }> {
  const response = await apiClient.post("/crm/communications/sync-inbox/")
  return response.data
}

export async function logCommunication(payload: LogCommunicationPayload): Promise<CommunicationLog> {
  const response = await apiClient.post("/crm/communications/", payload)
  return response.data
}

export async function sendStudentEmail(
  studentId: number | string,
  payload: { subject: string; message: string }
): Promise<CommunicationLog> {
  const response = await apiClient.post(`/crm/students/${studentId}/send_email/`, payload)
  return response.data
}

// ---------------------------------------------------------------------------
// Direct chat (counselor side - a specific student's thread)
// ---------------------------------------------------------------------------

export async function fetchStudentMessages(studentId: number | string): Promise<CrmMessage[]> {
  const response = await apiClient.get(`/crm/students/${studentId}/messages/`)
  return response.data
}

function buildMessagePayload(body: string, attachment?: File): FormData | { body: string } {
  if (!attachment) return { body }
  const form = new FormData()
  form.append("body", body)
  form.append("attachment", attachment)
  return form
}

export async function sendStudentMessage(
  studentId: number | string, body: string, attachment?: File
): Promise<CrmMessage> {
  const response = await apiClient.post(`/crm/students/${studentId}/messages/`, buildMessagePayload(body, attachment))
  return response.data
}

// ---------------------------------------------------------------------------
// Student portal ("my" endpoints - the logged-in student's own CRM record)
// ---------------------------------------------------------------------------

export async function fetchMyCrmStatus(): Promise<MyCrmStatus> {
  const response = await apiClient.get("/crm/my/status/")
  return response.data
}

export async function fetchMyMessages(): Promise<CrmMessage[]> {
  const response = await apiClient.get("/crm/my/messages/")
  return response.data
}

export async function sendMyMessage(body: string, attachment?: File): Promise<CrmMessage> {
  const response = await apiClient.post("/crm/my/messages/", buildMessagePayload(body, attachment))
  return response.data
}

// ---------------------------------------------------------------------------
// Call signaling (counselor side - a specific student)
// ---------------------------------------------------------------------------

export async function startStudentCall(
  studentId: number | string,
  payload: { call_type: CallType; offer_sdp: string }
): Promise<CrmCall> {
  const response = await apiClient.post(`/crm/students/${studentId}/calls/start/`, payload)
  return response.data
}

export async function pollStudentCall(studentId: number | string, after?: number): Promise<CrmCallPollResponse> {
  const response = await apiClient.get(`/crm/students/${studentId}/calls/poll/`, {
    params: after ? { after } : {},
  })
  return response.data
}

export async function answerStudentCall(
  studentId: number | string,
  callId: number,
  answerSdp: string
): Promise<CrmCall> {
  const response = await apiClient.post(`/crm/students/${studentId}/calls/answer/`, {
    call_id: callId,
    answer_sdp: answerSdp,
  })
  return response.data
}

export async function endStudentCall(studentId: number | string, callId: number): Promise<CrmCall> {
  const response = await apiClient.post(`/crm/students/${studentId}/calls/end/`, { call_id: callId })
  return response.data
}

export async function sendStudentCallIce(
  studentId: number | string,
  callId: number,
  candidate: RTCIceCandidateInit
): Promise<void> {
  await apiClient.post(`/crm/students/${studentId}/calls/ice/`, { call_id: callId, candidate })
}

// ---------------------------------------------------------------------------
// Call signaling (student portal side - the logged-in student's own record)
// ---------------------------------------------------------------------------

export async function startMyCall(payload: { call_type: CallType; offer_sdp: string }): Promise<CrmCall> {
  const response = await apiClient.post("/crm/my/calls/start/", payload)
  return response.data
}

export async function pollMyCall(after?: number): Promise<CrmCallPollResponse> {
  const response = await apiClient.get("/crm/my/calls/poll/", { params: after ? { after } : {} })
  return response.data
}

export async function answerMyCall(callId: number, answerSdp: string): Promise<CrmCall> {
  const response = await apiClient.post("/crm/my/calls/answer/", { call_id: callId, answer_sdp: answerSdp })
  return response.data
}

export async function endMyCall(callId: number): Promise<CrmCall> {
  const response = await apiClient.post("/crm/my/calls/end/", { call_id: callId })
  return response.data
}

export async function sendMyCallIce(callId: number, candidate: RTCIceCandidateInit): Promise<void> {
  await apiClient.post("/crm/my/calls/ice/", { call_id: callId, candidate })
}

// ---------------------------------------------------------------------------
// Call-request booking flow - a student can't call directly, they request
// a call, the counselor proposes a time, the student confirms it.
// ---------------------------------------------------------------------------

export async function fetchStudentCallRequests(studentId: number | string): Promise<CallRequest[]> {
  const response = await apiClient.get(`/crm/students/${studentId}/call-requests/`)
  return response.data
}

export async function proposeCallRequestTime(
  studentId: number | string, requestId: number, payload: { proposed_at: string; note?: string }
): Promise<CallRequest> {
  const response = await apiClient.post(`/crm/students/${studentId}/call-requests/${requestId}/propose/`, payload)
  return response.data
}

export async function cancelStudentCallRequest(studentId: number | string, requestId: number): Promise<CallRequest> {
  const response = await apiClient.post(`/crm/students/${studentId}/call-requests/${requestId}/cancel/`)
  return response.data
}

export async function fetchMyCallRequests(): Promise<CallRequest[]> {
  const response = await apiClient.get("/crm/my/call-requests/")
  return response.data
}

export async function createMyCallRequest(payload: { call_type: CallType; note?: string }): Promise<CallRequest> {
  const response = await apiClient.post("/crm/my/call-requests/", payload)
  return response.data
}

export async function respondToMyCallRequest(
  requestId: number, payload: { action: "accept" | "decline"; note?: string }
): Promise<CallRequest> {
  const response = await apiClient.post(`/crm/my/call-requests/${requestId}/respond/`, payload)
  return response.data
}

export async function cancelMyCallRequest(requestId: number): Promise<CallRequest> {
  const response = await apiClient.post(`/crm/my/call-requests/${requestId}/cancel/`)
  return response.data
}
