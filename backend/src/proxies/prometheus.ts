import axios, { AxiosInstance } from 'axios';
import { config } from '../config/env';

/** Thin wrapper over the Prometheus HTTP API (read-only). */

const http: AxiosInstance = axios.create({
    baseURL: config.prometheusUrl,
    timeout: 15_000,
});

export const instantQuery = async (query: string, time?: string) => {
    const { data } = await http.get('/api/v1/query', {
        params: { query, time },
    });
    return data;
};

export const rangeQuery = async (params: {
    query: string;
    start: string;
    end: string;
    step: string;
}) => {
    const { data } = await http.get('/api/v1/query_range', { params });
    return data;
};

export const labelValues = async (label: string) => {
    const { data } = await http.get(
        `/api/v1/label/${encodeURIComponent(label)}/values`
    );
    return data;
};

export const targets = async () => {
    const { data } = await http.get('/api/v1/targets');
    return data;
};

export const rules = async () => {
    const { data } = await http.get('/api/v1/rules');
    return data;
};

export const isUp = async (): Promise<boolean> => {
    try {
        const { status } = await http.get('/-/healthy', { timeout: 4000 });
        return status >= 200 && status < 300;
    } catch {
        return false;
    }
};
