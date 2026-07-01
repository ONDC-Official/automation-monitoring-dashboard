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

httpClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status ?? 0;
            const body = error.response?.data as ApiErrorBody | undefined;
            const message = body?.message ?? error.message;
            throw new ApiError(status, message, body);
        }
        throw error;
    },
);
