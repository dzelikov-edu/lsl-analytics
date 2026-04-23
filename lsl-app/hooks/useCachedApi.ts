import { API_BASE_URL } from '@/lib/api';
import { getCachedValue, setCachedValue } from '@/lib/apiCache';
import { useEffect, useState, useCallback } from 'react';

type UseCachedApiOptions = {
    cacheKey: string;
    endpoint: string;
    maxAgeMs?: number;
    enabled?: boolean;
};

export function useCachedApi<T = any>({
    cacheKey,
    endpoint,
    maxAgeMs = 1000 * 60 * 30, // 30 minutes
    enabled = true,
}: UseCachedApiOptions) {
    const cached = getCachedValue<T>(cacheKey, maxAgeMs);

    const [data, setData] = useState<T | null>(cached);
    const [loading, setLoading] = useState(enabled && !cached);
    const [refreshing, setRefreshing] = useState(false); // NEW: for Pull-to-Refresh
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (isRefresh = false) => {
        if (!enabled) return;

        if (isRefresh) {
            setRefreshing(true);
        } else if (!data) {
            setLoading(true);
        }

        try {
            setError(null);
            const response = await fetch(`${API_BASE_URL}${endpoint}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const json = await response.json();

            setCachedValue(cacheKey, json);
            setData(json);
        } catch (err: any) {
            setError(err?.message ?? 'Unknown error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [cacheKey, endpoint, enabled]);

    useEffect(() => {
        const freshCached = getCachedValue<T>(cacheKey, maxAgeMs);
        setData(freshCached); // Instantly resets data to null if not in cache
        load();
    }, [cacheKey, endpoint, enabled]);

    // NEW: Function to manually trigger a refresh
    const refetch = useCallback(() => {
        return load(true);
    }, [load]);

    return {
        data,
        loading,
        refreshing, // NEW
        error,
        refetch,    // NEW
    };
}