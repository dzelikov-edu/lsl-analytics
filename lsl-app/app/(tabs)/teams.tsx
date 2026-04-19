import TeamLogo from '@/components/TeamLogo';
import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCachedApi } from '@/hooks/useCachedApi';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TeamRow = {
    team_id: string;
    team_name: string;
    polls?: {
        week?: number | null;
        LSL?: {
            rank?: number | null;
            next5_order?: number | null;
        };
    };
    analytics?: {
        power?: { rank?: number | null } | null;
        resume?: { rank?: number | null } | null;
        form?: { rank?: number | null } | null;
        sos?: { rank?: number | null } | null;
    };
};

export default function TeamsScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isCompact = width < 430;
    const topTabPadding = isCompact ? insets.top + 8 : 12;

    const styles = useMemo(
        () =>
            StyleSheet.create({
                content: {
                    paddingHorizontal: 20,
                    paddingTop: topTabPadding,
                    paddingBottom: 40,
                    backgroundColor: theme.background,
                },
                screenTitle: {
                    fontSize: 32,
                    fontWeight: '800',
                    marginBottom: 6,
                    color: theme.text,
                },
                screenSubTitle: {
                    fontSize: 15,
                    color: theme.mutedText,
                    marginBottom: 18,
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
                teamCard: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 12,
                    backgroundColor: theme.card,
                },
                teamCardPressed: {
                    opacity: 0.75,
                },
                topRow: {
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                },
                nameBlock: {
                    flex: 1,
                    paddingRight: 12,
                },
                teamName: {
                    fontSize: 21,
                    fontWeight: '800',
                    color: theme.text,
                    marginBottom: 2,
                },
                rankBadge: {
                    minWidth: 52,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: theme.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.background,
                },
                rankBadgeText: {
                    fontSize: 13,
                    fontWeight: '800',
                    color: theme.text,
                },
                analyticsRow: {
                    marginTop: 2,
                },
                analyticsLabel: {
                    fontSize: 12,
                    color: theme.mutedText,
                    marginBottom: 4,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                },
                analyticsStrip: {
                    fontSize: 14,
                    lineHeight: 20,
                    color: theme.text,
                },
                errorTitle: {
                    fontSize: 18,
                    fontWeight: '700',
                    marginBottom: 8,
                    color: theme.text,
                },
                errorText: {
                    fontSize: 14,
                    color: theme.mutedText,
                },
            }),
        [theme, topTabPadding]
    );

    const {
        data: payload,
        loading,
        error,
    } = useCachedApi({
        cacheKey: 'teams:week0',
        endpoint: '/teams?week=0',
        maxAgeMs: 1000 * 60 * 30,
    });

    const teams: TeamRow[] = payload?.teams ?? [];

    const formatRankText = (team: TeamRow) => {
        const rank = team?.polls?.LSL?.rank;
        const next5 = team?.polls?.LSL?.next5_order;

        if (rank !== null && rank !== undefined) return `#${rank}`;
        if (next5 !== null && next5 !== undefined) return 'Next 5';
        return 'Unranked';
    };

    const formatAnalyticsStrip = (team: TeamRow) => {
        const power = team?.analytics?.power?.rank;
        const resume = team?.analytics?.resume?.rank;
        const form = team?.analytics?.form?.rank;
        const sos = team?.analytics?.sos?.rank;

        return [
            `Power ${power ? `#${power}` : '—'}`,
            `Resume ${resume ? `#${resume}` : '—'}`,
            `Form ${form ? `#${form}` : '—'}`,
            `SOS ${sos ? `#${sos}` : '—'}`,
        ].join(' • ');
    };

    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.screenTitle}>Teams</Text>
            <Text style={styles.screenSubTitle}>Browse all tracked teams</Text>

            {loading ? (
                <View style={styles.centerBlock}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.helper}>Loading teams...</Text>
                </View>
            ) : error ? (
                <View style={styles.teamCard}>
                    <Text style={styles.errorTitle}>Error</Text>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : teams.length === 0 ? (
                <View style={styles.teamCard}>
                    <Text style={styles.errorText}>No teams available.</Text>
                </View>
            ) : (
                teams.map((team) => (
                    <Pressable
                        key={team.team_id}
                        onPress={() => router.push(`/team/${team.team_id}`)}
                        style={({ pressed }) => [styles.teamCard, pressed && styles.teamCardPressed]}>
                        <View style={styles.topRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 }}>
                                <TeamLogo teamId={team.team_id} size={30} />
                                <View style={{ marginLeft: 10, flex: 1 }}>
                                    <Text style={styles.teamName}>{team.team_name}</Text>
                                </View>
                            </View>

                            <View style={styles.rankBadge}>
                                <Text style={styles.rankBadgeText}>{formatRankText(team)}</Text>
                            </View>
                        </View>

                        <View style={styles.analyticsRow}>
                            <Text style={styles.analyticsLabel}>Analytics Snapshot</Text>
                            <Text style={styles.analyticsStrip}>{formatAnalyticsStrip(team)}</Text>
                        </View>
                    </Pressable>
                ))
            )}
        </ScrollView>
    );
}