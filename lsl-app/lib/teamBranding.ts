export type TeamBranding = {
    displayName: string;
    primary: string;
    secondary: string;
    accent: string;
    headerText: string;
    logo: null | string;
};

const TEAM_BRANDING: Record<string, TeamBranding> = {
    CREIGHTON: {
        displayName: 'Creighton',
        primary: '#005CA9',
        secondary: '#FFFFFF',
        accent: '#041E42',
        headerText: '#FFFFFF',
        logo: null,
    },
    DUKE: {
        displayName: 'Duke',
        primary: '#003087',
        secondary: '#FFFFFF',
        accent: '#012169',
        headerText: '#FFFFFF',
        logo: null,
    },
    KANSAS: {
        displayName: 'Kansas',
        primary: '#0051BA',
        secondary: '#E8000D',
        accent: '#FFC82D',
        headerText: '#FFFFFF',
        logo: null,
    },
    MICHIGAN: {
        displayName: 'Michigan',
        primary: '#00274C',
        secondary: '#FFCB05',
        accent: '#1D1D1D',
        headerText: '#FFFFFF',
        logo: null,
    },
    OKLAHOMA_STATE: {
        displayName: 'Oklahoma State',
        primary: '#FF7300',
        secondary: '#000000',
        accent: '#231F20',
        headerText: '#000000',
        logo: null,
    },
};

const FALLBACK_BRANDING: TeamBranding = {
    displayName: 'Team',
    primary: '#111111',
    secondary: '#FFFFFF',
    accent: '#D0D0D0',
    headerText: '#FFFFFF',
    logo: null,
};

export function getTeamBranding(teamId?: string | null): TeamBranding {
    if (!teamId) return FALLBACK_BRANDING;
    const normalized = String(teamId).trim().toUpperCase();
    return TEAM_BRANDING[normalized] ?? {
        ...FALLBACK_BRANDING,
        displayName: normalized.replace(/_/g, ' '),
    };
}