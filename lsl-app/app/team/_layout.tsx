import { getTeamBranding } from '@/lib/teamBranding';
import { buildTeamScreenTitle, formatTeamName } from '@/lib/teamHeader';
import { Stack, useLocalSearchParams } from 'expo-router';

function TeamStackScreens() {
    const params = useLocalSearchParams<{ teamId?: string }>();
    const teamId = params.teamId ?? null;
    const branding = getTeamBranding(teamId);
    const displayName = formatTeamName(branding.displayName || teamId);

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: branding.primary,
                },
                headerTintColor: branding.headerText,
                headerTitleStyle: {
                    fontWeight: '700',
                    color: branding.headerText,
                },
                headerBackTitleVisible: false,
                headerShadowVisible: false,
                headerTitleAlign: 'center',
            }}>
            <Stack.Screen
                name="[teamId]"
                options={{
                    title: buildTeamScreenTitle('detail', displayName),
                }}
            />
            <Stack.Screen
                name="[teamId]/roster"
                options={{
                    title: buildTeamScreenTitle('roster', displayName),
                }}
            />
            <Stack.Screen
                name="[teamId]/schedule"
                options={{
                    title: buildTeamScreenTitle('schedule', displayName),
                }}
            />
            <Stack.Screen
                name="[teamId]/results"
                options={{
                    title: buildTeamScreenTitle('results', displayName),
                }}
            />
        </Stack>
    );
}

export default function TeamStackLayout() {
    return <TeamStackScreens />;
}