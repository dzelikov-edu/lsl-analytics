import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL } from '@/lib/api';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function TeamDetailScreen() {
    const { teamId } = useLocalSearchParams<{ teamId: string }>();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    const styles = useMemo(
        () =>
            StyleSheet.create({
                content: {
                    padding: 20,
                    paddingBottom: 40,
                    backgroundColor: theme.background,
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
                heroCard: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 18,
                    padding: 16,
                    marginBottom: 18,
                    backgroundColor: theme.card,
                },
                teamName: {
                    fontSize: 30,
                    fontWeight: '800',
                    marginBottom: 8,
                    color: theme.text,
                },
                primaryRecord: {
                    fontSize: 24,
                    fontWeight: '800',
                    marginBottom: 4,
                    color: theme.text,
                },
                secondaryLine: {
                    fontSize: 15,
                    color: theme.mutedText,
                    marginBottom: 4,
                },
                pollsLine: {
                    fontSize: 16,
                    fontWeight: '600',
                    color: theme.text,
                },
                metaLine: {
                    fontSize: 14,
                    color: theme.mutedText,
                    marginTop: 8,
                },
                section: {
                    marginBottom: 18,
                },
                sectionTitle: {
                    fontSize: 20,
                    fontWeight: '700',
                    marginBottom: 10,
                    color: theme.text,
                },
                analyticsGrid: {
                    gap: 10,
                },
                analyticsCard: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 14,
                    padding: 14,
                    backgroundColor: theme.card,
                },
                metricLabel: {
                    fontSize: 14,
                    color: theme.mutedText,
                    marginBottom: 6,
                },
                metricValue: {
                    fontSize: 20,
                    fontWeight: '700',
                    marginBottom: 4,
                    color: theme.text,
                },
                metricTier: {
                    fontSize: 14,
                    color: theme.mutedText,
                },
                navCard: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 14,
                    backgroundColor: theme.card,
                    overflow: 'hidden',
                },
                navRow: {
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                },
                navRowLast: {
                    borderBottomWidth: 0,
                },
                navRowPressed: {
                    opacity: 0.7,
                },
                navTitle: {
                    fontSize: 17,
                    fontWeight: '700',
                    color: theme.text,
                    marginBottom: 2,
                },
                navSub: {
                    fontSize: 13,
                    color: theme.mutedText,
                },
                body: {
                    fontSize: 14,
                    lineHeight: 20,
                    color: theme.text,
                },
                errorCard: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 14,
                    padding: 14,
                    backgroundColor: theme.card,
                },
                errorTitle: {
                    fontSize: 20,
                    fontWeight: '700',
                    marginBottom: 10,
                    color: theme.text,
                },
            }),
        [theme]
    );

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [team, setTeam] = useState<any>(null);

    useEffect(() => {
        const loadTeam = async () => {
            if (!teamId) return;

            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`${API_BASE_URL}/teams/${teamId}?week=0`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const json = await response.json();
                setTeam(json);
            } catch (err: any) {
                setError(err?.message ?? 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        loadTeam();
    }, [teamId]);

    const lslRank = team?.polls?.LSL?.rank;
    const lslNext5 = team?.polls?.LSL?.next5_order;
    const lcaaRank = team?.polls?.LCAA?.rank;
    const lcaaNext5 = team?.polls?.LCAA?.next5_order;

    const formatConferenceName = (name?: string | null) => {
        if (!name) return null;

        const normalized = name.trim();

        const shortMap: Record<string, string> = {
            'Atlantic Coast Conference': 'ACC',
            'Southeastern Conference': 'SEC',
            'Big Ten Conference': 'Big Ten',
            'Big 12 Conference': 'Big 12',
            'Big East Conference': 'Big East',
            'Pacific-12 Conference': 'PAC-12',
            'Pac-12 Conference': 'PAC-12',
            'American Conference': 'AAC',
            'Mountain West Conference': 'Mountain West',
            'West Coast Conference': 'WCC',
            'Missouri Valley Conference': 'Missouri Valley',
            'Atlantic 10 Conference': 'A-10',
            'Atlantic Ten Conference': 'A-10',
            'Big West Conference': 'Big West',
            'Missouri Valley Football Conference': 'Missouri Valley',
        };

        return shortMap[normalized] ?? normalized.replace(/\s+Conference$/, '');
    };

    const overallRecord = team?.record?.overall_record ?? '—';
    const conferenceRecord = team?.record?.conference_record ?? '—';
    const conferenceId = team?.conference_id ?? null;
    const conferenceName = team?.conference_name ?? null;
    const conferenceDisplayName = formatConferenceName(conferenceName);
    const playersCount = team?.roster_summary?.players_count ?? 0;

    const analyticsCards = [
        { label: 'Power', item: team?.analytics?.power },
        { label: 'Resume', item: team?.analytics?.resume },
        { label: 'Form', item: team?.analytics?.form },
        { label: 'SOS', item: team?.analytics?.sos },
    ];

    const formatPollValue = (rank?: number | null, next5?: number | null) => {
        if (rank !== null && rank !== undefined) return `#${rank}`;
        if (next5 !== null && next5 !== undefined) return 'Next 5';
        return '—';
    };

    const formatMetricValue = (item: any) => {
        if (!item) return '—';
        const rankText =
            item.rank !== null && item.rank !== undefined ? `#${item.rank}` : '—';
        const valueText =
            item.value !== null && item.value !== undefined ? ` • ${item.value}` : '';
        return `${rankText}${valueText}`;
    };

    return (
        <ScrollView contentContainerStyle={styles.content}>
            {loading ? (
                <View style={styles.centerBlock}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.helper}>Loading team...</Text>
                </View>
            ) : error ? (
                <View style={styles.errorCard}>
                    <Text style={styles.errorTitle}>Error</Text>
                    <Text style={styles.body}>{error}</Text>
                </View>
            ) : !team ? (
                <View style={styles.errorCard}>
                    <Text style={styles.body}>No team data available.</Text>
                </View>
            ) : (
                <>
                    <View style={styles.heroCard}>
                        <Text style={styles.teamName}>{team.team_name}</Text>
                        <Text style={styles.primaryRecord}>{overallRecord}</Text>
                        <Text style={styles.secondaryLine}>
                            {conferenceDisplayName ? `${conferenceDisplayName} Record: ${conferenceRecord}` : `Conference Record: ${conferenceRecord}`}
                        </Text>
                        <Text style={styles.pollsLine}>
                            LSL: {formatPollValue(lslRank, lslNext5)} • LCAA: {formatPollValue(lcaaRank, lcaaNext5)}
                        </Text>
                        <Text style={styles.metaLine}>Players: {playersCount}</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Analytics</Text>
                        <View style={styles.analyticsGrid}>
                            {analyticsCards.map((entry) => (
                                <View key={entry.label} style={styles.analyticsCard}>
                                    <Text style={styles.metricLabel}>{entry.label}</Text>
                                    <Text style={styles.metricValue}>{formatMetricValue(entry.item)}</Text>
                                    <Text style={styles.metricTier}>
                                        {entry.item?.tier ? `Tier: ${entry.item.tier}` : 'Tier: —'}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Browse Team</Text>
                        <View style={styles.navCard}>
                            <Pressable
                                onPress={() => router.push(`/team/${teamId}/schedule`)}
                                style={({ pressed }) => [styles.navRow, pressed && styles.navRowPressed]}>
                                <Text style={styles.navTitle}>Schedule</Text>
                                <Text style={styles.navSub}>Upcoming and full season schedule</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => router.push(`/team/${teamId}/results`)}
                                style={({ pressed }) => [styles.navRow, pressed && styles.navRowPressed]}>
                                <Text style={styles.navTitle}>Results</Text>
                                <Text style={styles.navSub}>Played games and final scores</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => router.push(`/team/${teamId}/roster`)}
                                style={({ pressed }) => [styles.navRow, styles.navRowLast, pressed && styles.navRowPressed]}>
                                <Text style={styles.navTitle}>Roster</Text>
                                <Text style={styles.navSub}>Players, positions, and basic profile info</Text>
                            </Pressable>
                        </View>
                    </View>
                </>
            )}
        </ScrollView>
    );
}