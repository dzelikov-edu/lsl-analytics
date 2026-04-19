type CacheEntry<T = any> = {
    data: T;
    fetchedAt: number;
};

const API_CACHE = new Map<string, CacheEntry>();

export function getCachedValue<T = any>(key: string, maxAgeMs?: number): T | null {
    const entry = API_CACHE.get(key);
    if (!entry) return null;

    if (maxAgeMs !== undefined) {
        const age = Date.now() - entry.fetchedAt;
        if (age > maxAgeMs) {
            return null;
        }
    }

    return entry.data as T;
}

export function setCachedValue<T = any>(key: string, data: T) {
    API_CACHE.set(key, {
        data,
        fetchedAt: Date.now(),
    });
}

export function clearCachedValue(key: string) {
    API_CACHE.delete(key);
}

export function clearAllApiCache() {
    API_CACHE.clear();
}

export function hasCachedValue(key: string, maxAgeMs?: number) {
    return getCachedValue(key, maxAgeMs) !== null;
}