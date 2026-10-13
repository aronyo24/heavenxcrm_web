/**
 * Meetings API + types (link-based counselor <-> student video/audio rooms).
 * Same file lives in both frontends (heavenxcrm_web and heavenxcrm) since
 * both sides of a meeting talk to the same /crm/meetings/<token>/ endpoints.
 */

import { apiClient } from "./api"

export type MeetingType = "audio" | "video"
export type MeetingStatus = "scheduled" | "live" | "ended" | "cancelled"
export type MeetingRole = "host" | "guest"

export interface Meeting {
  id: number
  token: string
  student: number
  student_name: string
  host_name: string
  title: string
  description: string
  meeting_type: MeetingType
  scheduled_at: string
  duration_minutes: number
  status: MeetingStatus
  ended_at: string | null
  connected_at: string | null
  join_url: string
  join_opens_at: string
  expired: boolean
  student_user_linked: boolean
  role?: MeetingRole
  other_party_name?: string
  /** Only on create: whether the invitation email was actually sent. */
  email_sent?: boolean
}

export interface MeetingSignal {
  id: number
  kind: "offer" | "answer" | "ice"
  session: string
  payload: RTCSessionDescriptionInit & RTCIceCandidateInit
}

export interface MeetingSyncResponse {
  status: MeetingStatus
  blocked: "cancelled" | "ended" | "too_early" | "expired" | null
  peer_present: boolean
  peer_client_id?: string
  signals: MeetingSignal[]
}

export interface CreateMeetingPayload {
  title?: string
  description?: string
  meeting_type: MeetingType
  /** ISO string; omit for an instant meeting that starts now. */
  scheduled_at?: string
  duration_minutes: number
  send_email: boolean
}

export async function fetchStudentMeetings(studentId: number | string): Promise<Meeting[]> {
  return (await apiClient.get(`/crm/students/${studentId}/meetings/`)).data
}

export async function createStudentMeeting(studentId: number | string, payload: CreateMeetingPayload): Promise<Meeting> {
  return (await apiClient.post(`/crm/students/${studentId}/meetings/`, payload)).data
}

export async function cancelStudentMeeting(studentId: number | string, meetingId: number): Promise<Meeting> {
  return (await apiClient.post(`/crm/students/${studentId}/meetings/${meetingId}/cancel/`)).data
}

export async function fetchMyMeetings(): Promise<Meeting[]> {
  return (await apiClient.get("/crm/my/meetings/")).data
}

export async function fetchMeeting(token: string): Promise<Meeting> {
  return (await apiClient.get(`/crm/meetings/${token}/`)).data
}

export async function syncMeeting(token: string, clientId: string, after?: number): Promise<MeetingSyncResponse> {
  return (await apiClient.post(`/crm/meetings/${token}/sync/`, { client_id: clientId, after })).data
}

export async function sendMeetingSignal(
  token: string, signal: { kind: MeetingSignal["kind"]; session: string; payload: unknown }
): Promise<void> {
  await apiClient.post(`/crm/meetings/${token}/signal/`, signal)
}

export async function leaveMeeting(token: string, clientId: string): Promise<void> {
  await apiClient.post(`/crm/meetings/${token}/leave/`, { client_id: clientId })
}

export async function endMeeting(token: string): Promise<Meeting> {
  return (await apiClient.post(`/crm/meetings/${token}/end/`)).data
}
