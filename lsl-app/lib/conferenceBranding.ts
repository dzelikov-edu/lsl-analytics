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
    ACC: {
        displayName: 'Atlantic Coast Conference',
        headerTitle: 'ACC',
        primary: '#013CA6',
        secondary: '#0B1F3A',
        accent: '#A5A9AB',
        textOnPrimary: '#FFFFFF',
    },
    AAC: {
        displayName: 'American Conference',
        headerTitle: 'AAC',
        primary: '#041E41',
        secondary: '#12284C',
        accent: '#EE2231',
        textOnPrimary: '#FFFFFF',
    },
    A10: {
        displayName: 'Atlantic 10 Conference',
        headerTitle: 'A-10',
        primary: '#8B2332',
        secondary: '#4A1620',
        accent: '#D4AF37',
        textOnPrimary: '#FFFFFF',
    },
    BE: {
        displayName: 'Big East Conference',
        headerTitle: 'Big East',
        primary: '#003E7E',
        secondary: '#0F172A',
        accent: '#ED1A39',
        textOnPrimary: '#FFFFFF',
    },
    B10: {
        displayName: 'Big Ten Conference',
        headerTitle: 'Big Ten',
        primary: '#0088CE',
        secondary: '#111827',
        accent: '#939598',
        textOnPrimary: '#FFFFFF',
    },
    B12: {
        displayName: 'Big 12 Conference',
        headerTitle: 'Big 12',
        primary: '#C41230',
        secondary: '#1F2937',
        accent: '#FFFFFF',
        textOnPrimary: '#FFFFFF',
    },
    BW: {
        displayName: 'Big West Conference',
        headerTitle: 'Big West',
        primary: '#0057B8',
        secondary: '#0F172A',
        accent: '#F2A900',
        textOnPrimary: '#FFFFFF',
    },
    MVC: {
        displayName: 'Missouri Valley Conference',
        headerTitle: 'MVC',
        primary: '#C8102E',
        secondary: '#1F2937',
        accent: '#9CA3AF',
        textOnPrimary: '#FFFFFF',
    },
    MW: {
        displayName: 'Mountain West Conference',
        headerTitle: 'Mountain West',
        primary: '#4F2D7F',
        secondary: '#1E293B',
        accent: '#AFAFAF',
        textOnPrimary: '#FFFFFF',
    },
    P12: {
        displayName: 'PAC-12 Conference',
        headerTitle: 'PAC-12',
        primary: '#092346',
        secondary: '#0F172A',
        accent: '#FFFFFF',
        textOnPrimary: '#FFFFFF',
    },
    SEC: {
        displayName: 'Southeastern Conference',
        headerTitle: 'SEC',
        primary: '#22356B',
        secondary: '#111827',
        accent: '#FBCE28',
        textOnPrimary: '#FFFFFF',
    },
    WCC: {
        displayName: 'West Coast Conference',
        headerTitle: 'WCC',
        primary: '#1D428A',
        secondary: '#111827',
        accent: '#FFFFFF',
        textOnPrimary: '#FFFFFF',
    },
};

export function getConferenceBranding(confId?: string | null): ConferenceBranding {
    if (!confId) return FALLBACK_CONFERENCE_BRANDING;
    const normalized = String(confId).trim().toUpperCase();
    return CONFERENCE_BRANDING[normalized] ?? {
        ...FALLBACK_CONFERENCE_BRANDING,
        displayName: normalized,
        headerTitle: normalized,
    };
}