export function formatTeamName(teamIdOrName?: string | null): string {
    if (!teamIdOrName) return 'Team';
    return String(teamIdOrName).replace(/_/g, ' ').trim();
}

export function buildTeamScreenTitle(
    screen: 'detail' | 'roster' | 'schedule' | 'results',
    teamName?: string | null
): string {
    const base = formatTeamName(teamName);

    switch (screen) {
        case 'detail':
            return base;
        case 'roster':
            return `${base} Roster`;
        case 'schedule':
            return `${base} Schedule`;
        case 'results':
            return `${base} Results`;
        default:
            return base;
    }
}