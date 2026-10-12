/**
 * TypeScript interfaces for the Admission CRM (`/crm`), mirroring the
 * apps.crm DRF serializers (Phase 1: pipeline, students, counselors, tasks).
 */

export interface PipelineStage {
  id: number
  key: string
  label: string
  sort_order: number
  is_won: boolean
  is_lost: boolean
}

export interface LeadSource {
  id: number
  name: string
  category: "paid" | "organic" | "referral" | "event" | "other"
  is_active: boolean
}

export interface Counselor {
  id: number
  user_id: number
  email: string
  full_name: string
  employee_code: string
  phone: string
  is_active: boolean
  max_active_students: number
  specialization_countries: string[]
  active_student_count: number
  created_at: string
  updated_at: string
}

export interface CounselorPerformance {
  counselor_id: number
  total_students: number
  won: number
  lost: number
  active: number
  conversion_rate: number
  open_tasks: number
}

export type StudentPriority = "low" | "medium" | "high"

// The ad lead form a student submitted, with the form's original questions
// (see apps/crm/facebook_leads.py). Empty object for leads added by hand.
export interface LeadForm {
  source: "facebook"
  form_name: string
  campaign: string
  ad_name: string
  submitted_at: string | null
  answers: { question: string; answer: string }[]
}

export interface StudentListItem {
  id: number
  full_name: string
  email: string
  phone: string
  stage: number
  stage_key: string
  stage_label: string
  counselor: number | null
  counselor_name: string | null
  lead_source: number | null
  lead_source_name: string | null
  campaign: string
  priority: StudentPriority
  target_country: string
  target_degree: string
  is_lost: boolean
  created_at: string
  updated_at: string
  stage_changed_at: string
  open_call_request: { id: number; status: CallRequestStatus; call_type: CallType; proposed_at: string | null } | null
}

export interface Student extends StudentListItem {
  user: number | null
  phone_country_code: string
  whatsapp_number: string
  alt_phone: string
  previous_institute: string
  field_of_study: string
  gpa: number | null
  highest_qualification: string
  english_test: string
  english_score: number | null
  target_specialization: string
  budget_min: number | null
  budget_max: number | null
  budget_currency: string
  campaign: string
  lead_form: LeadForm | Record<string, never>
  notes: string
  tags: string[]
  lost_reason: string
  created_by: number | null
}

export type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "documents_requested"
  | "offer_received"
  | "enrolled"
  | "rejected"
  | "withdrawn"

/** A student's application to one specific course (apps.crm.Application). */
export interface ApplicationListItem {
  id: number
  student: number
  student_name: string
  student_email: string
  student_phone: string
  course: number
  course_name: string
  course_degree: string
  university_name: string
  university_logo: string | null
  university_country: string
  status: ApplicationStatus
  intake_term: string
  counselor_name: string | null
  has_resume: boolean
  submitted_at: string
  updated_at: string
  decided_at: string | null
}

export interface Application extends Omit<ApplicationListItem, "student_name" | "student_email" | "student_phone" | "has_resume"> {
  course_url: string | null
  full_name: string
  email: string
  phone: string
  nationality: string
  date_of_birth: string | null
  highest_qualification: string
  institution_name: string
  gpa: number | null
  english_test: string
  english_score: number | null
  personal_statement: string
  resume: string | null
  /** CV on the student's site account - shown when the application has none. */
  profile_resume: string | null
  reviewed_by: number | null
  reviewed_by_name: string | null
  review_notes: string
}

export interface ApplicationSummary {
  total: number
  by_status: Record<ApplicationStatus, number>
  this_week: number
}

export interface StudentRecommendation {
  course_id: number
  course_title: string
  university_id?: number
  university_name: string
  country?: string
  specialization?: string | null
  degree_type?: string | null
  tuition_fee?: number | null
  match_score: number
  admission_probability: number
  job_placement_rate?: number | null
  avg_starting_salary?: number | null
  // Enriched from universities.Course - only present once the backend merge runs.
  entry_requirements?: string | null
  ielts?: number | null
  toefl?: number | null
  pte?: number | null
  scholarship_available?: boolean
  duration?: string | null
  intake_date?: string | null
  course_url?: string | null
  university_logo?: string | null
}

export interface StudentRecommendationsResponse {
  recommendations: StudentRecommendation[]
  total: number
}

export type TaskType = "task" | "reminder" | "appointment" | "call" | "follow_up"
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled"

export interface Task {
  id: number
  task_type: TaskType
  title: string
  description: string
  student: number | null
  student_name: string | null
  assigned_to: number
  assigned_to_name: string
  created_by: number | null
  due_at: string
  status: TaskStatus
  priority: StudentPriority
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type CommunicationChannel = "call" | "whatsapp" | "email" | "sms" | "in_person" | "note"
export type CommunicationDirection = "inbound" | "outbound"
export type CommunicationStatus = "sent" | "failed" | "logged"

export interface CommunicationLog {
  id: number
  student: number
  student_name: string
  student_email: string
  channel: CommunicationChannel
  direction: CommunicationDirection
  subject: string
  summary: string
  body_html: string
  to_email: string
  cc_email: string
  status: CommunicationStatus
  error_message: string
  duration_seconds: number | null
  logged_by: number | null
  logged_by_name: string | null
  occurred_at: string
  created_at: string
}

export type CallType = "audio" | "video"
export type CallStatus = "ringing" | "accepted" | "rejected" | "ended"

export interface CrmCall {
  id: number
  student: number
  is_from_counselor: boolean
  caller_name: string | null
  call_type: CallType
  status: CallStatus
  offer_sdp: string
  answer_sdp: string
  created_at: string
  answered_at: string | null
  ended_at: string | null
}

export interface CrmCallCandidate {
  id: number
  from_counselor: boolean
  candidate: RTCIceCandidateInit
  created_at: string
}

export interface CrmCallPollResponse {
  call: CrmCall | null
  candidates: CrmCallCandidate[]
}

export interface CrmMessage {
  id: number
  student: number
  sender_name: string
  is_from_counselor: boolean
  body: string
  is_read: boolean
  created_at: string
  attachment_url: string | null
  attachment_name: string
  attachment_size: number | null
  attachment_type: string
  call_log_type: CallType | ""
  call_log_outcome: "completed" | "missed" | "declined" | ""
  call_log_duration: number | null
}

export type CallRequestStatus = "pending" | "proposed" | "accepted" | "declined" | "completed" | "cancelled"

export interface CallRequest {
  id: number
  student: number
  call_type: CallType
  status: CallRequestStatus
  note: string
  proposed_at: string | null
  proposal_note: string
  response_note: string
  call: number | null
  created_at: string
  updated_at: string
}

export interface MyCrmStatus {
  student: Student
  counselor: Counselor | null
  unread_messages: number
  updates: CommunicationLog[]
}

export interface CrmAuditLogEntry {
  id: number
  actor: number | null
  actor_name: string | null
  student: number | null
  student_name: string | null
  action: string
  description: string
  data: Record<string, unknown>
  created_at: string
}

export interface CrmDashboardStageCount {
  key: string
  label: string
  sort_order: number
  is_won: boolean
  is_lost: boolean
  student_count: number
}

export interface CrmDashboardStats {
  total_students: number
  active_students: number
  lost_students: number
  new_leads_this_week: number
  new_leads_this_month: number
  by_stage: CrmDashboardStageCount[]
  tasks_due_today: number
  tasks_overdue: number
}

export interface CrmPaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}
