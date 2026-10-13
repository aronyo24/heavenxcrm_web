/**
 * ============================================================================
 * HeavenxCRM - TypeScript Type Definitions
 * ============================================================================
 * 
 * This file contains all TypeScript interfaces and types used throughout
 * the HeavenxCRM application.
 * 
 * Usage:
 *   import type { University, Course } from '@/lib/types';
 */

// ============================================================================
// UNIVERSITY TYPES
// ============================================================================

/**
 * University data structure
 * Represents a university/institution in the system
 * 
 * @property id - Unique identifier (string or number)
 * @property name - University name
 * @property country - Country where university is located
 * @property city - City where university is located
 * @property type - Institution type (Public/Private)
 * @property established_year - Year the university was established
 * @property logo - URL to university logo image
 * @property website_url - Optional university website URL
 * @property total_courses - Optional count of courses offered
 * @property courses - Optional array of courses offered by this university
 */
export interface University {
    id: string | number;
    name: string;
    country: string;
    city: string;
    type?: string | null;
    established_year?: number | null;
    logo: string;
    website_url?: string;
    total_courses?: number;
    courses?: Course[];
    is_partner?: boolean;
}

// ============================================================================
// COURSE TYPES
// ============================================================================

/**
 * Course/Program data structure
 * Represents an academic program offered by a university
 * 
 * @property id - Unique identifier (string or number)
 * @property course_id - Optional course reference ID
 * @property program_name - Name of the academic program
 * @property university_id - ID of the university offering this course
 * @property university_name - Name of the university
 * @property degree - Type of degree (Bachelor's, Master's, PhD, etc.)
 * @property duration - Duration as text (e.g., "2 years")
 * @property duration_years - Optional duration in years
 * @property duration_months - Optional duration in months
 * @property tuition_usd - Tuition fee in USD
 * @property ielts - Required IELTS score
 * @property toefl - Optional required TOEFL score
 * @property duolingo - Optional required Duolingo score
 * @property website_url - Optional course application URL
 * @property logo - URL to university logo
 * @property attendance - Optional attendance mode (Full-time, Part-time, etc.)
 * @property country - Optional country name
 * @property city - Optional city name
 * @property programName - CamelCase alias for program_name (backwards compatibility)
 * @property universityName - CamelCase alias for university_name
 * @property universityId - CamelCase alias for university_id
 * @property tuitionUSD - CamelCase alias for tuition_usd
 */
/**
 * Per-country entry requirements for a course (e.g. "UK" vs "International").
 */
export interface CourseCountryRequirement {
    country: string;
    academic_requirement?: string | null;
    english_requirement?: string | null;
    additional_notes?: string | null;
}

export interface Course {
    id: string | number;
    course_id?: string;
    program_name: string;
    university_id: string | number;
    university_name: string;
    degree: string;
    duration?: string;
    duration_years?: number;
    duration_months?: number;
    /** @deprecated legacy USD-only field - use tuition_amount + tuition_currency (formatTuition) instead */
    tuition_usd?: number;
    ielts: number;
    toefl?: number;
    duolingo?: number;
    website_url?: string;
    logo: string;
    attendance?: string;
    country?: string;
    city?: string;
    // Backwards compatibility aliases (camelCase)
    programName?: string;
    universityName?: string;
    universityId?: string | number;
    tuitionUSD?: number;

    // Fields from the normalized university_master dataset - see
    // apps.universities.serializers.CourseSerializer on the backend.
    category?: string | null;
    level?: string | null;
    campus_name?: string | null;
    intake_date?: string | null;
    tuition_amount?: number | null;
    tuition_currency?: string | null;
    pte?: number | null;
    entry_requirements?: string | null;
    language_requirements?: string | null;
    course_structure?: string | null;
    career_prospects?: string | null;
    course_scholarships?: string | null;
    placement_available?: boolean;
    scholarship_available?: boolean;
    country_requirements?: CourseCountryRequirement[];
}

// ============================================================================
// RESUME ANALYSIS TYPES
// ============================================================================

/**
 * Resume Analysis Result
 * Data extracted from student's resume
 * 
 * @property full_name - Student's full name extracted from resume
 * @property previous_institute - Most recent university/college attended
 * @property field_of_study - Major, degree, or field of study
 * @property gpa - GPA or grade (e.g., "3.85 / 4.0" or "85%")
 * @property summary - 2-sentence summary of the candidate
 * @property key_skills - Array of key skills identified
 */
export interface ResumeAnalysisResult {
    full_name: string | null;
    previous_institute: string | null;
    previous_university?: string | null;
    field_of_study: string | null;
    department?: string | null;
    gpa: string | null;
    cgpa?: string | null;
    summary: string;
    key_skills: string[];
    resume_uploaded?: boolean;
}

export interface ResumeAnalysisStats {
    today_count: number;
    month_count: number;
    all_time_count: number;
}

export interface UserProfile {
    id: string | number;
    email: string;
    full_name?: string | null;
    country?: string | null;
    educational_qualification?: string | null;
    field_of_study?: string | null;
    gpa?: string | null;
    previous_institute?: string | null;
    total_analyses?: number;
    created_at?: string;
    updated_at?: string;
}

export interface AdminPermissions {
    view_all_records?: boolean;
    edit_records?: boolean;
    delete_records?: boolean;
    manage_sub_admins?: boolean;
    view_analytics?: boolean;
    export_reports?: boolean;
    crm_view_own_students?: boolean;
    crm_view_all_students?: boolean;
    crm_edit_students?: boolean;
    crm_delete_students?: boolean;
    crm_manage_pipeline?: boolean;
    crm_manage_documents?: boolean;
    crm_view_reports?: boolean;
    crm_view_financials?: boolean;
    crm_manage_financials?: boolean;
    crm_manage_partners?: boolean;
    crm_manage_counselors?: boolean;
}

export interface AuthUser {
    id: string | number;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
    full_name?: string | null;
    age?: number | null;
    country?: string | null;
    target_country?: string | null;
    bio?: string | null;
    phone?: string | null;
    phone_country_code?: string | null;
    university_institution?: string | null;
    budget?: number | null;
    budget_currency?: string;
    linkedin_url?: string | null;
    github_url?: string | null;
    portfolio_url?: string | null;
    preferred_program?: string | null;
    application_status?: 'pending' | 'active' | 'approved';
    profile_picture?: string | null;
    resume_file?: string | null;
    email_notifications?: boolean;
    marketing_emails?: boolean;
    role?: 'admin' | 'sub_admin' | 'counselor' | 'user' | null;
    permissions?: AdminPermissions;
    is_admin?: boolean;
    is_crm_manager?: boolean;
    is_crm_staff?: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface ProfileCompletion {
    filled: number;
    total: number;
    percentage: number;
}

export interface UserNotification {
    id: number;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
}

export interface ChartDataPoint {
    name: string;
    count: number;
    value?: number;
}

export interface PeriodCount {
    current: number;
    previous: number;
    change_pct: number | null;
}

export interface BusinessOverview {
    days: number;
    kpis: Record<"visitors" | "leads" | "applications" | "enrolled", PeriodCount>;
    trend: Array<{ date: string; visitors: number; leads: number; applications: number }>;
    funnel: Array<{ key: string; label: string; count: number; is_won: boolean }>;
    lead_sources: Array<{
        name: string; category: string; total: number; recent: number; won: number; conversion_pct: number;
    }>;
    leads_without_source: number;
    counselors: Array<{
        id: number; name: string; email: string; active: number; capacity: number;
        new: number; enrolled: number; tasks_done: number; tasks_overdue: number;
    }>;
    attention: {
        unassigned_leads: number;
        stale_unassigned: number;
        overdue_tasks: number;
        stuck_students: number;
        pending_applications: number;
        documents_requested: number;
    };
    totals: { students: number; open: number; won: number; lost: number; conversion_pct: number };
    applications_by_status: Array<{ status: string; count: number }>;
}

export interface AdminDashboardData {
    business: BusinessOverview;
    summary: Record<string, number>;
    visitor_countries: Array<{
        country: string;
        country_code?: string;
        count: number;
        percentage: number;
        latitude?: number;
        longitude?: number;
    }>;
    submission_analytics: SubmissionAnalytics;
    chatbot_analytics: ChatbotAnalytics;
    search_trends: SearchTrends;
    page_popularity: Array<{ page_path: string; count: number }>;
    recent_activity: ActivityEvent[];
}

export interface SubmissionAnalytics {
    summary: {
        total_submissions: number;
        average_budget: number;
        top_university: string | null;
        top_country: string | null;
    };
    universities: ChartDataPoint[];
    budget_ranges: Array<{ range: string; count: number }>;
    countries: Array<{ country: string; count: number }>;
    age_groups: Array<{ group: string; count: number }>;
    phone_codes: Array<{ code: string; count: number }>;
    services: Array<{ service: string; count: number }>;
}

export interface ChatbotAnalytics {
    total_prompts: number;
    top_topics: Array<{ category: string; count: number }>;
    top_keywords: ChartDataPoint[];
    hourly_usage: Array<{ hour: string; count: number }>;
    daily_usage: Array<{ date: string; count: number }>;
    category_breakdown: Array<{ category: string; count: number }>;
    flagged_prompts: Array<{ id: number; message: string; category: string; session_id: string; created_at: string }>;
    unanswered_prompts: Array<{ id: number; message: string; category: string; session_id: string; created_at: string }>;
}

export interface SearchTrends {
    top_queries: Array<{ query: string; count: number }>;
    trend: Array<{ date: string; count: number }>;
    total_searches: number;
}

export interface ActivityEvent {
    id: number;
    event_type: string;
    page_path: string;
    element_id?: string;
    duration_seconds?: number;
    session_key?: string;
    created_at: string;
    user__email?: string;
}

export interface SubAdmin {
    id: number;
    user_id: number;
    email: string;
    full_name: string;
    permissions: AdminPermissions;
    is_active: boolean;
    created_at: string;
    created_by?: string;
}

export interface AuthSummary {
    resume_count: number;
    search_count: number;
    saved_count: number;
    activity_count: number;
}

export interface ResumeHistoryItem {
    id: string | number;
    file_name: string;
    file_size: number;
    analysis_status: string;
    recommendations_count?: number;
    extracted_skills?: unknown[];
    extracted_education?: Record<string, unknown>;
    extracted_experience?: unknown[];
    error_message?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface CurrentAuthSession {
    authenticated: boolean;
    user: AuthUser;
    summary: AuthSummary;
    resume_history: ResumeHistoryItem[];
    profile: Record<string, unknown>;
    profile_completion?: ProfileCompletion;
    recent_activities?: Array<{ activity_type: string; description: string; created_at: string }>;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Generic API response wrapper
 * Used for standardized API responses
 * 
 * @template T - The type of data returned
 * @property data - The actual data payload
 * @property error - Optional error message
 * @property status - HTTP status code
 */
export interface ApiResponse<T> {
    data: T;
    error?: string;
    status: number;
}

/**
 * Paginated API response
 * Used when API returns paginated results
 * 
 * @template T - The type of items in results array
 * @property count - Total number of items
 * @property next - URL to next page (null if last page)
 * @property previous - URL to previous page (null if first page)
 * @property results - Array of items for current page
 */
export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    pagination: PaginationMeta;
}

// ============================================================================
// FILTER/SEARCH TYPES
// ============================================================================

/**
 * University search/filter parameters
 */
export interface UniversityFilters {
    search?: string;
    country?: string;
    type?: string;
}

/**
 * Course search/filter parameters
 */
export interface CourseFilters {
    search?: string;
    university?: string | number;
    country?: string;
    degree?: string;
    min_tuition?: number;
    max_tuition?: number;
}

// ============================================================================
// FORM DATA TYPES
// ============================================================================

/**
 * Student profile data
 * Used for personalized recommendations
 */
export interface StudentProfile {
    id?: string | number;
    name: string;
    email: string;
    country: string;
    education_level: string;
    field_of_interest: string;
    budget?: number;
    ielts_score?: number;
    toefl_score?: number;
    gpa?: number;
}

/**
 * Application data
 * Used when student applies to a program
 */
export interface Application {
    id?: string | number;
    student_id: string | number;
    course_id: string | number;
    status: 'draft' | 'submitted' | 'under_review' | 'accepted' | 'rejected';
    submitted_at?: string;
    updated_at?: string;
}

// ============================================================================
// CHAT TYPES
// ============================================================================

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isTyping?: boolean;
}

export interface UniversityFilter {
    country: string;
    degree_type: 'BSc' | 'MSc' | 'PhD';
    subject: string;
    budget_usd: number;
    cgpa: number;
    english_test: 'IELTS' | 'TOEFL' | 'Duolingo' | 'None';
    english_score: number;
    funding_preference: 'funded' | 'self-funded' | 'any';
}

export interface ChatResponse {
    reply: string;
    ready_to_search: boolean;
    filters: UniversityFilter | null;
    universities: Course[];
    total_count: number;
    session_id: string;
    error: string | null;
}

export interface QuickReply {
    label: string;
    value: string;
    emoji?: string;
}

export interface ConversationFilters {
  country:               string;
  degree_type:           'BSc' | 'MSc' | 'PhD';
  subject:               string;
  budget_usd:            number;
  cgpa:                  number;
  english_test:          'IELTS' | 'TOEFL' | 'Duolingo' | 'None';
  english_score:         number;
  funding_preference:    'funded' | 'self-funded' | 'any';
  previous_degree_field: string;
  previous_university:   string;
  bsc_completed:         boolean;
  msc_completed:         boolean;
}

export interface ResultsPageState {
  filters:     ConversationFilters;
  universities: Course[];
  total_count: number;
  session_id:  string;
}

// Step tracking for progress bar
export type ChatStep =
  | 'country'
  | 'degree'
  | 'bsc_check'
  | 'msc_check'
  | 'subject'
  | 'budget'
  | 'prev_field'
  | 'prev_university'
  | 'cgpa'
  | 'english_test'
  | 'english_score'
  | 'funding'
  | 'done';
