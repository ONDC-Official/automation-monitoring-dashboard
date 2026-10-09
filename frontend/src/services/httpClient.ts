import axios from 'axios';
import { store } from '@/store';
import type { ApiErrorBody } from '@/services/types';

export class ApiError extends Error {
    status: number;
    body?: ApiErrorBody;
    constructor(status: number, message: string, body?: ApiErrorBody) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.body = body;
    }
}

export const httpClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json' },
});

// Attach the session bearer token (issued by /api/auth/login) to every
// request. Read from the persisted store so it survives reloads.
httpClient.interceptors.request.use((cfg) => {
    const token = store.getState().auth.token;
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
});

/**
 * The most useful sentence we can put in front of a user.
 *
 * The two transport failures are called out by name because their axios
 * messages ("timeout of 30000ms exceeded", "Network Error") tell a user
 * nothing about which of the two happened, and they mean different things: one
 * is a slow backend, the other is no backend.
 */
const messageFrom = (error: unknown): string => {
    if (!axios.isAxiosError(error)) {
        return error instanceof Error ? error.message : 'Unexpected error';
    }
    const body = error.response?.data as ApiErrorBody | undefined;
    if (body?.message) return body.message;
    if (body?.error) return body.error;
    if (error.code === 'ECONNABORTED') return 'Request timed out';
    if (error.code === 'ERR_NETWORK') return 'Cannot reach the dashboard API';
    return error.message;
};

httpClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status ?? 0;
            const body = error.response?.data as ApiErrorBody | undefined;
            throw new ApiError(status, messageFrom(error), body);
        }
        throw error;
    },
);

export const isApiError = (error: unknown): error is ApiError =>
    error instanceof ApiError;

/** A displayable message for anything a query can reject with. */
export const errorMessage = (error: unknown): string => {
    if (isApiError(error)) return error.message;
    return messageFrom(error);
};
