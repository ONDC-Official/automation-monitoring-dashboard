import { httpClient } from '@/services/httpClient';

export interface LoginResponse {
    // Bearer token to attach to subsequent /api requests (empty when the
    // backend runs without ADMIN_TOKEN, i.e. internal-only mode).
    token: string;
    username: string;
}

/** Validate credentials against the backend. Throws ApiError on failure. */
export function login(username: string, password: string): Promise<LoginResponse> {
    return httpClient
        .post<LoginResponse>('/api/auth/login', { username, password })
        .then((r) => r.data);
}
