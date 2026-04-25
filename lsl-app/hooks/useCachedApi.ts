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

    const load = useCallback(async (isRefresh = false, skipLoading = false) => {
        if (!enabled) return;

        if (isRefresh) {
            setRefreshing(true);
        } else if (!skipLoading) {
            setLoading(true);
        }

        try {
            setError(null);

            // fixes slashes
            const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
            const end = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
            const fullUrl = `${base}${end}`;

            const response = await fetch(fullUrl);

            if (!response.ok) {
                // We removed the console.log, but we KEEP the throw.
                // This tells the hook to set the 'error' state correctly.
                throw new Error(`HTTP ${response.status}`);
            }

            const json = await response.json();
            setCachedValue(cacheKey, json);
            setData(json);
        } catch (err: any) {
            if (!skipLoading) {
                setError(err?.message ?? 'Unknown error');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [cacheKey, endpoint, enabled]);


    useEffect(() => {
        if (!enabled) return;

        const freshCached = getCachedValue<T>(cacheKey, maxAgeMs);

        setData(freshCached);
        setLoading(enabled && !freshCached);
        setError(null);

        // We call load manually here
        load(false, !!freshCached);

    }, [cacheKey, endpoint, enabled]); // DO NOT add 'load' here unless it's memoized



    // NEW: Function to manually trigger a refresh
    const refetch = useCallback(() => {
        return load(true);
    }, [load]);

    return {
        data,
        loading,
        refreshing,
        error,
        refetch,
    };
}