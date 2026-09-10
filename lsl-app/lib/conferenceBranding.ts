import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { realismEnabledCache, setRealismEnabled } from './nameMasking';

export type ConferenceBranding = {
    displayName: string;
    headerTitle: string;
    primary: string;
    secondary: string;
    accent: string;
    textOnPrimary: string;
};

const FALLBACK_CONFERENCE_BRANDING: ConferenceBranding = {
    displayName: 'Conference',
    headerTitle: 'Conference',
    primary: '#1F2937',
    secondary: '#111827',
    accent: '#374151',
    textOnPrimary: '#FFFFFF',
};

const CONFERENCE_BRANDING: Record<string, ConferenceBranding> = {
    // Store-safe base build:
    // All real-world conference names and color schemes have been removed.
    // Fictional leagues can be defined here (e.g., LCAA-based conferences)
    // and real conferences are only available via external visual packs.
    ACC: {
        displayName: 'Coastal Elite Conference',
        headerTitle: 'CEC',
        primary: '#013CA6',
        secondary: '#0B1F3A',
        accent: '#A5A9AB',
        textOnPrimary: '#FFFFFF',
    },
    AAC: {
        displayName: 'National Athletic Conference',
        headerTitle: 'NAC',
        primary: '#041E41',
        secondary: '#12284C',
        accent: '#EE2231',
        textOnPrimary: '#FFFFFF',
    },
    A10: {
        displayName: 'East Coast Conference',
        headerTitle: 'ECC',
        primary: '#8B2332',
        secondary: '#4A1620',
        accent: '#D4AF37',
        textOnPrimary: '#FFFFFF',
    },
    BE: {
        displayName: 'Metropolitan Conference',
        headerTitle: 'MPC',
        primary: '#003E7E',
        secondary: '#0F172A',
        accent: '#ED1A39',
        textOnPrimary: '#FFFFFF',
    },
    B10: {
        displayName: 'Rustbelt Athletic Conference',
        headerTitle: 'RAC',
        primary: '#0088CE',
        secondary: '#111827',
        accent: '#939598',
        textOnPrimary: '#FFFFFF',
    },
    B12: {
        displayName: 'Great Plains Conference',
        headerTitle: 'GPC',
        primary: '#C41230',
        secondary: '#1F2937',
        accent: '#FFFFFF',
        textOnPrimary: '#FFFFFF',
    },
    BW: {
        displayName: 'Liberal West Conference',
        headerTitle: 'LWC',
        primary: '#0057B8',
        secondary: '#0F172A',
        accent: '#F2A900',
        textOnPrimary: '#FFFFFF',
    },
    MVC: {
        displayName: 'Heartland Athletic Conference',
        headerTitle: 'HAC',
        primary: '#C8102E',
        secondary: '#1F2937',
        accent: '#9CA3AF',
        textOnPrimary: '#FFFFFF',
    },
    MW: {
        displayName: 'Rocky Mountain Conference',
        headerTitle: 'RMC',
        primary: '#4F2D7F',
        secondary: '#1E293B',
        accent: '#AFAFAF',
        textOnPrimary: '#FFFFFF',
    },
    P12: {
        displayName: 'West Pacific Conference',
        headerTitle: 'WPC',
        primary: '#092346',
        secondary: '#0F172A',
        accent: '#FFFFFF',
        textOnPrimary: '#FFFFFF',
    },
    SEC: {
        displayName: 'Southern Athletic Conference',
        headerTitle: 'SAC',
        primary: '#22356B',
        secondary: '#111827',
        accent: '#FBCE28',
        textOnPrimary: '#FFFFFF',
    },
    WCC: {
        displayName: 'Pacific Rim Conference',
        headerTitle: 'PRC',
        primary: '#1D428A',
        secondary: '#111827',
        accent: '#FFFFFF',
        textOnPrimary: '#FFFFFF',
    },
};

export function getConferenceBranding(confId?: string | null, apiName?: string | null): ConferenceBranding {
    if (!confId) return FALLBACK_CONFERENCE_BRANDING;

    // Web-safe guard: Check if window exists instead of blocking the entire web platform
    if (realismEnabledCache === null) {
        if (Platform.OS !== 'web' || typeof window !== 'undefined') {
            AsyncStorage.getItem('has_custom_logos').then(val => {
                setRealismEnabled(val === 'true');
            }).catch(() => {
                // Failsafe if storage is blocked
                setRealismEnabled(false);
            });
        }
    }

    const normalized = String(confId).trim().toUpperCase();
    const authored = CONFERENCE_BRANDING[normalized];

    const base = authored ?? {
        ...FALLBACK_CONFERENCE_BRANDING,
        displayName: normalized,
        headerTitle: normalized,
    };

    // LOGIC: Use real MasterIndex name if cache is confirmed true OR if we are on the web
    const isWeb = Platform.OS === 'web';
    const finalName = ((realismEnabledCache === true || isWeb) && apiName) ? apiName : base.displayName;
    const finalTitle = ((realismEnabledCache === true || isWeb) && apiName) ? apiName : base.headerTitle;

    return {
        ...base,
        displayName: finalName,
        headerTitle: finalTitle,
    };
}