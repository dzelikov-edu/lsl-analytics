import AsyncStorage from '@react-native-async-storage/async-storage';

const DEV_FORCE_REALISM = false; // set to false for store builds

let realismEnabledCache: boolean | null = null;

async function checkRealismEnabled(): Promise<boolean> {
    if (DEV_FORCE_REALISM) return true;
    if (realismEnabledCache !== null) return realismEnabledCache;
    try {
        const flag = await AsyncStorage.getItem('has_custom_logos');
        realismEnabledCache = flag === 'true';
    } catch {
        realismEnabledCache = false;
    }
    return realismEnabledCache;
}

// Async masking helpers for hooks/components that can handle state
export async function getDisplayTeamName(rawName?: string | null, teamId?: string | null): Promise<string> {
    const fallback = rawName || teamId || 'Program';
    const realismEnabled = await checkRealismEnabled();
    if (realismEnabled) return fallback;

    // Store-safe masking: generic label based on teamId hash
    if (teamId) {
        const hash = Math.abs(hashCode(teamId)) % 1000;
        return `Program ${hash.toString().padStart(3, '0')}`;
    }
    return 'Program';
}

export async function getDisplayConferenceName(rawName?: string | null, confId?: string | null): Promise<string> {
    const fallback = rawName || confId || 'League';
    const realismEnabled = await checkRealismEnabled();
    if (realismEnabled) return fallback;

    if (confId) {
        const hash = Math.abs(hashCode(confId)) % 50;
        const bucket = String.fromCharCode(65 + (hash % 26)); // A–Z
        return `League ${bucket}`;
    }
    return 'League';
}

// Synchronous “best-effort” versions for places where async is awkward.
// They NEVER reveal real names; they only use IDs.
// Update these two functions to respect the DEV flag
export function getDisplayTeamNameSync(teamId?: string | null, rawName?: string | null): string {
    if (DEV_FORCE_REALISM && (rawName || teamId)) return rawName || teamId || 'Program';

    if (!teamId) return 'Program';
    const hash = Math.abs(hashCode(teamId)) % 1000;
    return `Program ${hash.toString().padStart(3, '0')}`;
}

export function getDisplayConferenceNameSync(confId?: string | null, rawName?: string | null): string {
    if (DEV_FORCE_REALISM && (rawName || confId)) return rawName || confId || 'League';

    if (!confId) return 'League';
    const hash = Math.abs(hashCode(confId)) % 50;
    const bucket = String.fromCharCode(65 + (hash % 26)); // A–Z
    return `League ${bucket}`;
}

function hashCode(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = (hash << 5) - hash + input.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}