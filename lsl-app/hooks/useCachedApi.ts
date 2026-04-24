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

            const fullUrl = `${API_BASE_URL}${endpoint}`;
            // If endpoint is "/home", this becomes "https://lsl-analytics.onrender.com/home"

            // 2. LOG IT so we can see it in your terminal
            console.log('--- DEBUG FETCH ---');
            console.log('Base:', API_BASE_URL);
            console.log('End:', endpoint);
            console.log('Full:', fullUrl);

            const response = await fetch(fullUrl);

            if (!response.ok) {
                // If it fails, log the status too
                console.log('Fetch Failed with status:', response.status);
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

        // 1. Check for cached data immediately
        const freshCached = getCachedValue<T>(cacheKey, maxAgeMs);

        // 2. Set the data and the loading state correctly
        setData(freshCached);
        setLoading(enabled && !freshCached);
        setError(null);

        // 3. SURGERY: Pass a hint to load() so it knows we have cache
        const hasCache = !!freshCached;
        load(false, hasCache);
    }, [cacheKey, endpoint, enabled]);


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