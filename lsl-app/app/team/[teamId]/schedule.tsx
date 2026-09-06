import TeamLogo from '@/components/TeamLogo';
import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCachedApi } from '@/hooks/useCachedApi';
import { getTeamBranding } from '@/lib/teamBranding';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type ScheduleGame = {
    game_key: string;
    date_key?: string;
    display_date?: string;
    phase?: string;
    phase_display?: string;
    week?: number | null;
    site?: string;
    opponent_team_id?: string;
    opponent_name?: string;
    opponent_lsl_rank?: number | null;
    opponent_lsl_next5_order?: number | null;
};

export default function TeamScheduleScreen() {
    const { teamId } = useLocalSearchParams<{ teamId: string }>();
    const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
    const theme = AppColors[colorScheme];

    const styles = useMemo(
        () =>
            StyleSheet.create({
                content: {
                    padding: 20,
                    paddingBottom: 40,
                    backgroundColor: theme.background,
                },
                headerCard: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 16,
                    backgroundColor: theme.card,
                },
                headerRow: {
                    flexDirection: 'row',
                    alignItems: 'center',
                },
                headerTextWrap: {
                    marginLeft: 12,
                    flex: 1,
                },
                headerTitle: {
                    fontSize: 20,
                    fontWeight: '800',
                    color: theme.text,
                    marginBottom: 2,
                },
                headerSubTitle: {
                    fontSize: 14,
                    color: theme.mutedText,
                },
                centerBlock: {
                    paddingVertical: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                },
                helper: {
                    fontSize: 15,
                    color: theme.mutedText,
                    marginTop: 12,
                },
                card: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 12,
                    backgroundColor: theme.card,
                },
                cardPressed: {
                    opacity: 0.75,
                },
                sectionTitle: {
                    fontSize: 20,
                    fontWeight: '700',
                    marginBottom: 10,
                    color: theme.text,
                },
                body: {
                    fontSize: 14,
                    lineHeight: 20,
                    color: theme.text,
                },
                metaLine: {
                    fontSize: 13,
                    color: theme.mutedText,
                    marginBottom: 10,
                },
                topRow: {
                    flexDirection: 'row',
                    alignItems: 'center',
                },
                textWrap: {
                    marginLeft: 10,
                    flex: 1,
                },
                opponentLine: {
                    fontSize: 17,
                    fontWeight: '700',
                    color: theme.text,
                    marginBottom: 4,
                },
                detailLine: {
                    fontSize: 14,
                    color: theme.mutedText,
                },
                emptyCard: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 16,
                    padding: 18,
                    backgroundColor: theme.card,
                },
                emptyTitle: {
                    fontSize: 18,
                    fontWeight: '700',
                    color: theme.text,
                    marginBottom: 6,
                },
                emptyText: {
                    fontSize: 14,
                    lineHeight: 20,
                    color: theme.mutedText,
                },
            }),
        [theme]
    );

    const {
        data: payload,
        loading,
        error,
    } = useCachedApi({
        cacheKey: `team:${teamId}:schedule`,
        endpoint: `/teams/${teamId}/schedule`,
        maxAgeMs: 1000 * 60 * 30,
        enabled: !!teamId,
    });

    const branding = getTeamBranding(teamId, (payload as any)?.team_name || (payload as any)?.team?.team_name);

    const games: ScheduleGame[] = payload?.games ?? payload?.schedule ?? [];

    const formatSite = (site?: string) => {
        if (site === 'HOME') return 'vs';
        if (site === 'AWAY') return '@';
        if (site === 'NEUTRAL') return '(N)';
        return '—';
    };

    const formatOpponent = (game: ScheduleGame) => {
        const raw = getTeamBranding(game.opponent_team_id, game.opponent_name).displayName;

        if (game.opponent_lsl_rank !== null && game.opponent_lsl_rank !== undefined) {
            return `#${game.opponent_lsl_rank} ${raw}`;
        }

        return raw;
    };

    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Stack.Screen options={{ title: `${branding.displayName} Schedule` }} />
            {loading ? (
                <View style={styles.centerBlock}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.helper}>Loading schedule...</Text>
                </View>
            ) : error ? (
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Error</Text>
                    <Text style={styles.body}>{error}</Text>
                </View>
            ) : (
                <>
                    <View style={styles.headerCard}>
                        <View style={styles.headerRow}>
                            <TeamLogo teamId={teamId} size={34} />
                            <View style={styles.headerTextWrap}>
                                <Text style={styles.headerTitle}>Schedule</Text>
                                <Text style={styles.headerSubTitle}>
                                    Upcoming and full season schedule
                                </Text>
                            </View>
                        </View>
                    </View>

                    {games.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyTitle}>No schedule available</Text>
                            <Text style={styles.emptyText}>
                                Upcoming games will appear here once schedule data is available for this team.
                            </Text>
                        </View>
                    ) : (
                        games.map((game) => (
                            <Pressable
                                key={game.game_key}
                                onPress={() =>
                                    router.push({
                                        pathname: '/game/[gameKey]',
                                        params: { gameKey: game.game_key },
                                    })
                                }
                                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
                                <Text style={styles.metaLine}>
                                    {game.display_date || game.date_key || 'TBD'} • {game.phase_display || game.phase || '—'} • Week {game.week ?? '—'}
                                </Text>

                                <View style={styles.topRow}>
                                    <TeamLogo teamId={game.opponent_team_id} size={24} />
                                    <View style={styles.textWrap}>
                                        <Text style={styles.opponentLine}>
                                            {formatSite(game.site)} {formatOpponent(game)}
                                        </Text>
                                        <Text style={styles.detailLine}>Scheduled</Text>
                                    </View>
                                </View>
                            </Pressable>
                        ))
                    )}
                </>
            )}
        </ScrollView>
    );
}