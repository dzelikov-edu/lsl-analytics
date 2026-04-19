export const CONFERENCE_LOGOS: Record<string, any> = {
    ACC: require('@/assets/images/conference-logos/ACC.png'),
    BE: require('@/assets/images/conference-logos/BE.png'),
    B10: require('@/assets/images/conference-logos/B10.png'),
    B12: require('@/assets/images/conference-logos/B12.png'),
    SEC: require('@/assets/images/conference-logos/SEC.png'),
    P12: require('@/assets/images/conference-logos/P12.png'),
    AAC: require('@/assets/images/conference-logos/AAC.png'),
    MW: require('@/assets/images/conference-logos/MW.png'),
    WCC: require('@/assets/images/conference-logos/WCC.png'),
};

export function getConferenceLogo(confId?: string | null) {
    if (!confId) return null;
    const normalized = String(confId).trim().toUpperCase();
    return CONFERENCE_LOGOS[normalized] ?? null;
}