import { API_BASE_URL } from '@/lib/api';
import { getCachedValue, setCachedValue } from '@/lib/apiCache';
import { useEffect, useState } from 'react';

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
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;

        const load = async () => {
            const freshCached = getCachedValue<T>(cacheKey, maxAgeMs);

            if (freshCached) {
                setData(freshCached);
                setLoading(false);
            } else {
                setLoading(true);
            }

            try {
                setError(null);

                const response = await fetch(`${API_BASE_URL}${endpoint}`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const json = await response.json();

                if (cancelled) return;

                setCachedValue(cacheKey, json);
                setData(json);
            } catch (err: any) {
                if (cancelled) return;
                if (!freshCached) {
                    setError(err?.message ?? 'Unknown error');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [cacheKey, endpoint, maxAgeMs, enabled]);

    return {
        data,
        loading,
        error,
    };
}