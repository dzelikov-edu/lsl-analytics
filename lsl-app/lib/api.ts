import { router } from 'expo-router';
import { getToken, deleteToken } from './auth-storage';

export const API_BASE_URL = 'https://lsl-backend.onrender.com';
console.log('API_BASE_URL locked to:', API_BASE_URL);

export async function apiFetch(
    path: string,
    options: RequestInit = {}
): Promise<Response> {
    const token = await getToken();

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const res = await fetch(
        path.startsWith('http') ? path : `${API_BASE_URL}${path}`,
        { ...options, headers }
    );

    if (res.status === 401) {
        console.log('apiFetch: 401, clearing token and redirecting to login');
        await deleteToken();
        router.replace('/auth/login');
        throw new Error('Unauthorized');
    }

    return res;
}
