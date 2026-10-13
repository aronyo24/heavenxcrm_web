/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-useless-catch */
/**
 * ============================================================================
 * HeavenxCRM - API Configuration
 * ============================================================================
 * 
 * This file contains all API calls for the HeavenxCRM application.
 * It uses Axios for HTTP requests and provides a clean interface for
 * interacting with the backend API.
 * 
 * Structure:
 * 1. Configuration & Setup
 * 2. Universities API Functions
 * 3. Courses API Functions  
 * 4. Helper Functions
 * 
 * TypeScript types are in: src/lib/types.ts
 * 
 * Usage Example:
 *   import { getUniversities, getCourses } from '@/lib/api';
 *   import type { University, Course } from '@/lib/types';
 *   
 *   const universities = await getUniversities();
 *   const courses = await getCourses('computer science');
 */

import axios, { AxiosError, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import type { AdminDashboardData, AuthUser, ChatResponse, Course, CurrentAuthSession, PaginatedResponse, ResumeAnalysisResult, ResumeAnalysisStats, ResumeHistoryItem, University, UserProfile } from './types';
import config from './config';
import { API_BASE_URL, AUTH_API_BASE_URL } from './env';

// Re-export types for convenience (so users can import from api.ts or types.ts)
export type { University, Course, ApiResponse, PaginatedResponse, UniversityFilters, CourseFilters, StudentProfile, Application, UserProfile, AuthUser, AuthSummary, ResumeHistoryItem } from './types';

// ============================================================================
// 1. API CONFIGURATION
// ============================================================================

/**
 * Base URL for all API requests.
 * - Uses VITE_API_BASE_URL when provided.
 * - Falls back to the same-origin /api path for easy deploys.
 */
let csrfTokenCache: string | null = null;

function getCookie(name: string): string | null {
    if (typeof document === 'undefined') {
        return null;
    }

    const cookieValue = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${name}=`));

    return cookieValue ? decodeURIComponent(cookieValue.split('=')[1]) : null;
}

/**
 * Axios instance with pre-configured settings
 * - Base URL is automatically prepended to all requests
 * - Timeout set to 10 seconds  
 * - JSON content type header included
 */
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 60000,
    withCredentials: true,
});

const authClient = axios.create({
    baseURL: AUTH_API_BASE_URL,
    timeout: 60000,
    withCredentials: true,
});

function attachCsrfToken(config: InternalAxiosRequestConfig) {
    const method = (config.method || 'get').toLowerCase();
    if (!['get', 'head', 'options'].includes(method)) {
        const csrfToken = csrfTokenCache || getCookie('csrftoken');
        if (csrfToken) {
            config.headers.set('X-CSRFToken', csrfToken);
        }
    }
    return config;
}

function extractErrorMessage(error: AxiosError): string {
    if (error.response) {
        const data = error.response.data as any;
        if (typeof data?.message === 'string' && data.message.trim()) {
            return data.message;
        }
        if (typeof data?.detail === 'string' && data.detail.trim()) {
            return data.detail;
        }
        if (typeof data?.error === 'string' && data.error.trim()) {
            return data.error;
        }
        // { errors: {field: [...]} } from our own views, or DRF's plain
        // { field: [...] } validation errors from serializers.
        const fieldErrors = data?.errors && typeof data.errors === 'object' ? data.errors : data;
        if (fieldErrors && typeof fieldErrors === 'object' && !Array.isArray(fieldErrors)) {
            const text = Object.values(fieldErrors)
                .flatMap((value) => Array.isArray(value) ? value : [value])
                .filter((value) => typeof value === 'string' && value.trim())
                .join(' ');
            if (text) return text;
        }
        return `Server error: ${error.response.status}`;
    }

    if (error.request) {
        return 'Network error: Unable to reach server';
    }

    return error.message || 'An unexpected error occurred';
}

apiClient.interceptors.request.use(attachCsrfToken);
authClient.interceptors.request.use(attachCsrfToken);

type CsrfRetryConfig = InternalAxiosRequestConfig & { _csrfRetried?: boolean };

// Django rotates the CSRF token on login/logout, and the csrftoken cookie is
// HttpOnly, so csrfTokenCache can go stale (e.g. another tab signed in or
// out). If a request is rejected for CSRF, fetch a fresh token and retry once
// instead of surfacing an error that only a page reload would clear.
function retryOnCsrfFailure(client: AxiosInstance) {
    client.interceptors.response.use(undefined, async (error: AxiosError) => {
        const config = error.config as CsrfRetryConfig | undefined;
        const detail = (error.response?.data as any)?.detail;
        if (
            config && !config._csrfRetried && error.response?.status === 403
            && typeof detail === 'string' && detail.includes('CSRF')
        ) {
            config._csrfRetried = true;
            await ensureCsrfToken();
            return client.request(config);
        }
        return Promise.reject(error);
    });
}

retryOnCsrfFailure(apiClient);
retryOnCsrfFailure(authClient);

/**
 * Response interceptor for global error handling
 * Logs errors and provides user-friendly error messages
 */
apiClient.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
        // Log error for debugging
        console.error('API Error:', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            message: error.message,
            data: error.response?.data,
        });
        
        // Throw error with user-friendly message
        if (error.response) {
            const status = error.response.status;
            const errorMsg = extractErrorMessage(error);

            if (status === 401 || status === 403) {
                throw new Error('Your session is not authorized for this action. Please log in again and retry.');
            }
            
            // Handle quota exceeded errors (429)
            if (status === 429) {
                throw new Error(`API Quota Exceeded: ${errorMsg}`);
            }
            
            throw new Error(errorMsg);
        } else if (error.request) {
            // Request made but no response received
            throw new Error('Network error: Unable to reach server');
        } else {
            // Something else went wrong
            throw new Error(error.message || 'An unexpected error occurred');
        }
    }
);

authClient.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
        console.error('Auth API Error:', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            message: error.message,
            data: error.response?.data,
        });

        throw new Error(extractErrorMessage(error));
    }
);

// ============================================================================
// 2. UNIVERSITIES API FUNCTIONS
// ============================================================================

/**
 * Fetch universities with optional filtering and pagination
 * 
 * @param search - Search term to filter by university name
 * @param country - Filter by country name
 * @returns Paginated university response
 * 
 * @example
 * // Get all universities
 * const universities = await getUniversities();
 * 
 * // Search by name
 * const results = await getUniversities('Harvard');
 * 
 * // Filter by country
 * const ukUniversities = await getUniversities('', 'UK');
 */
export async function getUniversitiesPage(
    search?: string,
    country?: string,
    type?: string,
    page = 1,
    limit = 40
): Promise<PaginatedResponse<University>> {
    try {
        // Build query parameters
        const params: Record<string, string> = {};
        if (search) params.search = search;
        if (country) params.country = country;
        if (type) params.type = type;
        // Always include the page parameter to be explicit with the backend
        params.page = String(page);
        params.limit = String(limit);

        // Make API call
        const response = await apiClient.get('/universities/', { params });

        // Handle different response formats (array or paginated)
        const payload = response.data as any;
        const universities = Array.isArray(payload)
            ? payload
            : payload.data || payload.results || [];

        const pagination = payload.pagination || {};
        const total = Number(pagination.total ?? payload.total ?? payload.count) || universities.length;
        const resolvedLimit = Number(pagination.limit ?? payload.limit) || limit;
        const totalPages = Number(pagination.totalPages ?? payload.totalPages) || Math.max(1, Math.ceil(total / resolvedLimit));
        const resolvedPage = Number(pagination.page ?? payload.page) || page;

        return {
            success: payload.success ?? true,
            data: universities.map(transformUniversityFromApi),
            pagination: {
                total,
                page: resolvedPage,
                limit: resolvedLimit,
                totalPages,
                hasNextPage: Boolean(pagination.hasNextPage ?? payload.hasNextPage ?? payload.next),
                hasPrevPage: Boolean(pagination.hasPrevPage ?? payload.hasPrevPage ?? payload.previous),
            },
        };
    } catch (error) {
        throw error;
    }
}

export async function getUniversities(search?: string, country?: string, type?: string): Promise<University[]> {
    const response = await getUniversitiesPage(search, country, type);
    return response.data;
}

/**
 * Fetch a single university by ID
 * 
 * @param id - University ID
 * @returns University object with details
 * 
 * @example
 * const university = await getUniversityById(123);
 */
export async function getUniversityById(id: string | number): Promise<University> {
    try {
        const response = await apiClient.get(`/universities/${id}/`);
        return transformUniversityFromApi(response.data);
    } catch (error) {
        console.error(`Failed to fetch university ${id}:`, error);
        throw error;
    }
}

// ============================================================================
// 3. COURSES API FUNCTIONS
// ============================================================================

/**
 * Fetch all courses/programs with optional filtering
 *
 * Note: the backend paginates (`CoursePagination`, 24 per page by default).
 * This convenience function is meant for small, bounded result sets (e.g. a
 * single university's course list) - it requests a generous fixed page size
 * so callers get everything in one shot. For the main course-browsing UI,
 * where the full ~30k+ row dataset needs real search/pagination, use
 * `getCoursesPage()` instead.
 *
 * @param search - Search term to filter by program name
 * @param university - Filter by university ID
 * @param country - Filter by country name
 * @returns Array of Course objects
 *
 * @example
 * // Get all courses
 * const courses = await getCourses();
 *
 * // Search by program name
 * const results = await getCourses('Computer Science');
 *
 * // Get courses from a specific university
 * const universityCourses = await getCourses('', 123);
 */
export async function getCourses(
    search?: string,
    university?: string | number,
    country?: string
): Promise<Course[]> {
    try {
        const response = await getCoursesPage(search, university, country, undefined, undefined, 1, 200);
        return response.data;
    } catch (error) {
        console.error('Failed to fetch courses:', error);
        throw error;
    }
}

/**
 * Fetch a page of courses with search/filter/sort, matching the same
 * `{success, data, pagination}` envelope as `getUniversitiesPage`.
 *
 * @param search - Search term (program name, category, degree, university name/country)
 * @param university - Filter by university ID
 * @param country - Filter by the university's home country
 * @param degree - Exact-match filter on the parsed degree label (see getCourseFilters)
 * @param ordering - DRF ordering param, e.g. 'tuition_amount', '-tuition_amount', 'duration_years', 'name'
 *
 * @example
 * const page = await getCoursesPage('data science', undefined, 'United Kingdom', undefined, '-tuition_amount', 1, 24);
 */
export async function getCoursesPage(
    search?: string,
    university?: string | number,
    country?: string,
    degree?: string,
    ordering?: string,
    page = 1,
    limit = 24
): Promise<PaginatedResponse<Course>> {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (university) params.university = String(university);
    if (country) params.country = country;
    if (degree) params.degree = degree;
    if (ordering) params.ordering = ordering;
    params.page = String(page);
    params.limit = String(limit);

    const response = await apiClient.get('/courses/', { params });
    const payload = response.data as any;
    const courses = Array.isArray(payload) ? payload : payload.data || payload.results || [];

    const pagination = payload.pagination || {};
    const total = Number(pagination.total ?? payload.count) || courses.length;
    const resolvedLimit = Number(pagination.limit) || limit;
    const totalPages = Number(pagination.totalPages) || Math.max(1, Math.ceil(total / resolvedLimit));
    const resolvedPage = Number(pagination.page) || page;

    return {
        success: payload.success ?? true,
        data: courses.map(transformCourseFromApi),
        pagination: {
            total,
            page: resolvedPage,
            limit: resolvedLimit,
            totalPages,
            hasNextPage: Boolean(pagination.hasNextPage ?? payload.next),
            hasPrevPage: Boolean(pagination.hasPrevPage ?? payload.previous),
        },
    };
}

/**
 * Fetch the distinct degree/country values available across all courses, for
 * populating filter dropdowns without loading the whole course table.
 */
export async function getCourseFilters(): Promise<{ degrees: string[]; countries: string[]; categoryCount: number }> {
    const response = await apiClient.get('/courses/filters/');
    return {
        degrees: response.data?.degrees || [],
        countries: response.data?.countries || [],
        categoryCount: response.data?.category_count || 0,
    };
}

/**
 * Fetch a single course by ID
 * 
 * @param id - Course ID
 * @returns Course object with details
 * 
 * @example
 * const course = await getCourseById(456);
 */
export async function getCourseById(id: string | number): Promise<Course> {
    try {
        const response = await apiClient.get(`/courses/${id}/`);
        return transformCourseFromApi(response.data);
    } catch (error) {
        console.error(`Failed to fetch course ${id}:`, error);
        throw error;
    }
}

/**
 * Fetch all courses for a specific university
 * Convenience function that wraps getCourses()
 * 
 * @param universityId - University ID
 * @returns Array of Course objects for that university
 * 
 * @example
 * const courses = await getCoursesByUniversity(123);
 */
export async function getCoursesByUniversity(universityId: string | number): Promise<Course[]> {
    return getCourses(undefined, universityId);
}

// ============================================================================
// 4. RESUME ANALYSIS
// ============================================================================

export async function analyzeResume(file: File): Promise<ResumeAnalysisResult> {
    await ensureCsrfToken();
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await apiClient.post('/analyze-resume/', formData);
        return response.data as ResumeAnalysisResult;
    } catch (err: any) {
        // Log detailed server response for debugging
        if (err?.response?.data) {
            console.error('Resume upload server response:', err.response.data);
        } else if (err?.message) {
            console.error('Resume upload error:', err.message);
        } else {
            console.error('Unknown resume upload error', err);
        }
        throw err;
    }
}

export async function getResumeAnalysisStats(): Promise<ResumeAnalysisStats> {
    const response = await apiClient.get('/resume-analysis-stats/');
    return response.data as ResumeAnalysisStats;
}

// ============================================================================
// 4B. AUTHENTICATION API FUNCTIONS
// ============================================================================

export async function ensureCsrfToken(): Promise<string> {
    const response = await authClient.get('/csrf/');
    csrfTokenCache = response.data?.csrfToken || getCookie('csrftoken') || null;
    return csrfTokenCache || '';
}

// login/register/logout rotate the CSRF token server-side - adopt the new
// one, otherwise the next POST sends the old token and fails with a 403.
async function adoptRotatedCsrfToken(data: any): Promise<void> {
    if (data?.csrfToken) {
        csrfTokenCache = data.csrfToken;
    } else {
        await ensureCsrfToken();
    }
}

export async function loginUser(payload: { email: string; password: string; remember_me?: boolean; portal?: 'crm' | 'admin' }): Promise<{ user: AuthUser; redirect_url?: string; remember_me?: boolean }> {
    await ensureCsrfToken();
    const response = await authClient.post('/login/', {
        username: payload.email,
        password: payload.password,
        remember_me: payload.remember_me ?? true,
        // This deployment is the staff-only frontend (see App.tsx), so the
        // portal is always 'crm' or 'admin' - never 'student'. Sending the
        // page-specific value (not just a blanket 'crm') means the backend
        // rejects a counselor's correct password on the admin-only login
        // page with a clear "administrators only" error, instead of letting
        // them in and bouncing them out client-side after the fact.
        portal: payload.portal ?? 'crm',
    });
    await adoptRotatedCsrfToken(response.data);
    return response.data as { user: AuthUser; redirect_url?: string; remember_me?: boolean };
}

export async function registerUser(payload: { full_name: string; country: string; email: string; phone?: string; phone_country_code?: string; password1: string; password2: string; agree_terms: boolean }): Promise<{ user: AuthUser; redirect_url?: string }> {
    await ensureCsrfToken();
    const response = await authClient.post('/register/', payload);
    await adoptRotatedCsrfToken(response.data);
    return response.data as { user: AuthUser; redirect_url?: string };
}

export async function checkEmailDeliverability(email: string): Promise<{ valid: boolean; message: string | null }> {
    const response = await authClient.post('/check-email/', { email });
    return response.data as { valid: boolean; message: string | null };
}

export async function logoutUser(): Promise<void> {
    await ensureCsrfToken();
    const response = await authClient.post('/logout/', {});
    await adoptRotatedCsrfToken(response.data);
}

export async function fetchCurrentUser(): Promise<CurrentAuthSession> {
    const response = await authClient.get('/me/');
    return response.data;
}

export async function fetchResumeHistory(): Promise<{ success: boolean; count: number; results: ResumeHistoryItem[] }> {
    const response = await authClient.get('/resume-history/');
    return response.data;
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    await ensureCsrfToken();
    const response = await authClient.post('/password-reset/', { email });
    return response.data as { success: boolean; message: string };
}

export async function confirmPasswordReset(uidb64: string, token: string, password1: string, password2: string): Promise<{ success: boolean; message: string }> {
    await ensureCsrfToken();
    const response = await authClient.post(`/password-reset/${uidb64}/${token}/`, {
        password1,
        password2,
    });
    return response.data as { success: boolean; message: string };
}

export async function getUserProfile(
    email: string
): Promise<{ user: UserProfile; analyses: any[]; total: number }> {
    await ensureCsrfToken();
    const response = await apiClient.post('/user-profile/', { email });
    return response.data as { user: UserProfile; analyses: any[]; total: number };
}

export async function upsertUserProfile(
    email: string,
    country: string,
    fullName?: string
): Promise<{ user: UserProfile; is_new_user: boolean }> {
    await ensureCsrfToken();
    const response = await apiClient.post('/user-profile/upsert/', {
        email,
        country,
        full_name: fullName || '',
    });

    return response.data as { user: UserProfile; is_new_user: boolean };
}

/**
 * Send message to AI Advisor and get response
 * 
 * @param profile - Student profile data
 * @param chatHistory - Previous conversation messages
 * @param message - New user message
 * @returns AI advisor response with ready_to_recommend flag
 */
export async function sendAdvisorMessage(
    profile: any,
    chatHistory: Array<{ role: string; content: string }>,
    message: string
): Promise<{ message: string; ready_to_recommend: boolean; next_field?: string | null; options?: string[]; preferences?: any; profile?: any }> {
    await ensureCsrfToken();
    const response = await apiClient.post('/advisor-chat/', {
        profile,
        chat_history: chatHistory,
        message,
    });

    return response.data;
}

/**
 * Get university recommendations based on student profile and preferences
 * 
 * @param profile - Student profile data
 * @param preferences - User preferences (country, degree, etc.)
 * @returns Array of recommended courses
 */
export async function getRecommendations(
    profile: any,
    preferences: any
): Promise<{ recommendations: Course[]; total: number }> {
    await ensureCsrfToken();
    const response = await apiClient.post('/recommend-universities/', {
        profile,
        preferences,
    });

    return response.data;
}

// ============================================================================
// 4C. ADVISOR CHAT (OLLAMA)
// ============================================================================

/**
 * Send a chat message to Django advisor-chat endpoint.
 * Django calls Ollama internally - frontend never touches Ollama directly.
 */
export async function sendChatMessage(
    message: string,
    history: Array<{ role: string; content: string }>,
    sessionId: string
): Promise<ChatResponse> {
    await ensureCsrfToken();
    const response = await apiClient.post('/advisor-chat/', {
        message,
        history,
        session_id: sessionId,
    });

    return response.data as ChatResponse;
}

/**
 * Health check - is the AI online?
 * Calls /api/ollama-health/ which checks internally on the VPS.
 */
export async function checkAIHealth(): Promise<{ status: 'ok' | 'error'; model: string }> {
    const response = await apiClient.get('/ollama-health/');
    return response.data as { status: 'ok' | 'error'; model: string };
}

/**
 * Get distinct country list from university database.
 */
export async function getCountries(): Promise<string[]> {
    const response = await apiClient.get('/universities/?format=countries');
    return response.data.countries || [];
}

/**
 * Streaming chat via Server-Sent Events.
 * Words appear one by one as Ollama generates them.
 * Profile parameter allows the AI to skip redundant questions.
 */
export async function sendChatMessageStream(
    message: string,
    history: { role: string; content: string }[],
    sessionId: string,
    onToken: (token: string) => void,
    onDone: (data: ChatResponse) => void,
    onError: (err: string) => void,
    profile?: any
): Promise<void> {
    try {
        const baseUrl = config.apiBaseUrl.replace(/\/$/, '');
        const response = await fetch(`${baseUrl}/advisor-chat-stream/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                history,
                session_id: sessionId,
                profile: profile || {},
            }),
        });

        if (!response.ok) {
            throw new Error(`Server error: HTTP ${response.status}`);
        }

        if (!response.body) {
            throw new Error('No response body from server');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;

                try {
                    const data = JSON.parse(jsonStr);

                    if (data.error) {
                        onError(data.error);
                        return;
                    }

                    if (data.done) {
                        onDone(data as ChatResponse);
                        return;
                    }

                    if (data.token) {
                        onToken(data.token);
                    }
                } catch {
                    // Skip incomplete JSON, will be completed in next chunk.
                }
            }
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Connection error';
        onError(message);
    }
}

// ============================================================================
// 5. HELPER FUNCTIONS (Data Transformation)
// ============================================================================

/**
 * Transform API response to University interface
 * Handles different field names and provides defaults
 * 
 * @private
 */
function transformUniversityFromApi(data: any): University {
    return {
        id: data.id,
        name: data.name,
        country: data.country || '',
        city: data.city || '',
        type: data.type ?? data.university_type ?? null,
        established_year: data.established_year ?? null,
        logo: data.logo || data.logo_url || '',
        website_url: data.website_url,
        total_courses: data.total_courses || 0,
        courses: data.courses ? data.courses.map(transformCourseFromApi) : undefined,
        is_partner: Boolean(data.is_partner),
    };
}

/**
 * Transform API response to Course interface
 * Handles different field names and provides defaults
 * Also creates camelCase aliases for backwards compatibility
 * 
 * @private
 */
function transformCourseFromApi(data: any): Course {
    return {
        id: data.id,
        course_id: data.course_id,
        program_name: data.program_name || data.name,
        university_id: data.university_id,
        university_name: data.university_name,
        degree: data.degree,
        duration: data.duration,
        duration_years: data.duration_years,
        duration_months: data.duration_months,
        tuition_usd: data.tuition_usd || 0,
        ielts: data.ielts || 0,
        toefl: data.toefl,
        duolingo: data.duolingo,
        website_url: data.website_url,
        logo: data.logo || '',
        attendance: data.attendance,
        country: data.country,
        city: data.city,
        // Backwards compatibility aliases (camelCase)
        programName: data.program_name || data.name,
        universityName: data.university_name,
        universityId: data.university_id,
        tuitionUSD: data.tuition_usd || 0,

        // Fields from the normalized university_master dataset - passed
        // through as-is (undefined/null when the source doesn't have them,
        // never coerced to a misleading 0/empty value).
        category: data.category,
        level: data.level,
        campus_name: data.campus_name,
        intake_date: data.intake_date,
        tuition_amount: data.tuition_amount,
        tuition_currency: data.tuition_currency,
        pte: data.pte,
        entry_requirements: data.entry_requirements,
        language_requirements: data.language_requirements,
        course_structure: data.course_structure,
        career_prospects: data.career_prospects,
        course_scholarships: data.course_scholarships,
        placement_available: Boolean(data.placement_available),
        scholarship_available: Boolean(data.scholarship_available),
        country_requirements: data.country_requirements,
    };
}

// ============================================================================
// 6. ANALYTICS API FUNCTIONS
// ============================================================================

/**
 * Log a user search query
 */
export async function trackSearchQuery(params: { query: string; page?: string; session_key?: string }): Promise<void> {
    try {
        await apiClient.post('/admin/track-search/', params);
    } catch (error) {
        console.error('Failed to track search query:', error);
    }
}

/**
 * Log a user activity event (page views, clicks, form submissions)
 */
export async function trackActivityEvent(params: {
    event_type: string;
    page_path: string;
    session_key: string;
    duration_seconds?: number;
    element_id?: string;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    try {
        await apiClient.post('/admin/track-activity/', params);
    } catch (error) {
        console.error('Failed to track activity event:', error);
    }
}

/**
 * Fetch admin dashboard data
 */
export async function fetchAdminDashboard(days = 30): Promise<AdminDashboardData> {
    await ensureCsrfToken();
    const response = await apiClient.get('/admin/dashboard/', { params: { days } });
    return response.data as AdminDashboardData;
}

// ============================================================================
// EXPORT AXIOS CLIENT (for advanced usage)
// ============================================================================

/**
 * Export the configured axios instance
 * Useful for making custom API calls not covered by the functions above
 * 
 * @example
 * import { apiClient } from '@/lib/api';
 * const response = await apiClient.post('/custom-endpoint', data);
 */
export { apiClient };

// ============================================================================
// 7. MISSING ADMIN & PROFILE API FUNCTIONS
// ============================================================================

export async function fetchNotifications() {
    const response = await apiClient.get('/admin/notifications/');
    return response.data;
}

export async function markNotificationsRead(ids?: number[]) {
    const response = await apiClient.patch('/admin/notifications/', { ids: ids || [] });
    return response.data;
}

export async function updateUserProfile(data: any) {
    // Profile text-field updates: PATCH /api/accounts/me/profile/
    const response = await authClient.patch('/me/profile/', data);
    return response.data;
}

export async function uploadProfileFiles(formData: FormData) {
    // Profile file uploads (picture / resume): POST /api/accounts/me/profile/
    const response = await authClient.post('/me/profile/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
}

export async function fetchActivityFeed(params?: any) {
    const response = await apiClient.get('/admin/activity/', { params });
    return response.data;
}

export function getExportReportUrl(reportType: string, format = 'csv', extra?: Record<string, string>): string {
    const qs = new URLSearchParams({ type: reportType, format, ...(extra || {}) }).toString();
    return `${API_BASE_URL}/admin/export/?${qs}`;
}

export async function fetchChatbotAnalytics(params?: any) {
    const response = await apiClient.get('/admin/chatbot/', { params });
    return response.data;
}

export async function fetchChatLogs(params?: any) {
    const response = await apiClient.get('/admin/chat-logs/', { params });
    return response.data;
}

export async function fetchSubAdmins(params?: any) {
    const response = await apiClient.get('/admin/sub-admins/', { params });
    // Django wraps the list in { sub_admins: [...] }
    return response.data.sub_admins || response.data || [];
}

export async function createSubAdmin(data: any) {
    const response = await apiClient.post('/admin/sub-admins/', data);
    return response.data;
}

export async function updateSubAdmin(id: string | number, data: any) {
    // Django SubAdminDetailView only exposes PATCH (not PUT)
    const response = await apiClient.patch(`/admin/sub-admins/${id}/`, data);
    return response.data;
}

export async function deleteSubAdmin(id: string | number) {
    const response = await apiClient.delete(`/admin/sub-admins/${id}/`);
    return response.data;
}

export async function fetchSubmissionAnalytics(params?: any) {
    const response = await apiClient.get('/admin/submissions/', { params });
    return response.data;
}

export async function fetchVisitorHeatmap(params?: any) {
    const response = await apiClient.get('/admin/visitor-heatmap/', { params });
    return response.data;
}

// ── Password change ───────────────────────────────────────────────────────────

export async function changePassword(data: {
    current_password: string;
    new_password1: string;
    new_password2: string;
}): Promise<{ success: boolean; message: string }> {
    await ensureCsrfToken();
    const response = await authClient.post('/change-password/', data);
    return response.data as { success: boolean; message: string };
}

// ── Saved programs ────────────────────────────────────────────────────────────

export interface SavedProgram {
    id: number;
    university_id: number;
    university_name: string;
    university_country: string;
    university_city: string;
    university_logo: string | null;
    university_website: string | null;
    course_id: number | null;
    course_name: string | null;
    course_degree: string | null;
    course_tuition: number | null;
    course_ielts: number | null;
    course_website: string | null;
    notes: string;
    is_wishlist: boolean;
    application_status: 'interested' | 'applied' | 'accepted' | 'rejected' | 'deferred';
    application_date: string | null;
    saved_at: string;
}

export async function getSavedPrograms(): Promise<{ success: boolean; count: number; results: SavedProgram[] }> {
    const response = await authClient.get('/saved/');
    return response.data;
}

export async function saveProgram(data: {
    university_id: number;
    course_id?: number | null;
    notes?: string;
    is_wishlist?: boolean;
    application_status?: string;
}): Promise<{ success: boolean; created: boolean; saved: SavedProgram }> {
    await ensureCsrfToken();
    const response = await authClient.post('/saved/', data);
    return response.data;
}

export async function updateSavedProgram(
    id: number,
    data: { application_status?: string; notes?: string; is_wishlist?: boolean }
): Promise<{ success: boolean; saved: SavedProgram }> {
    await ensureCsrfToken();
    const response = await authClient.patch(`/saved/${id}/`, data);
    return response.data;
}

export async function removeSavedProgram(id: number): Promise<{ success: boolean }> {
    await ensureCsrfToken();
    const response = await authClient.delete(`/saved/${id}/`);
    return response.data;
}
