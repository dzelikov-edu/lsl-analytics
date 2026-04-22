import TeamLogo from '@/components/TeamLogo';
import { AppColors } from '@/constants/app-colors';
import { getToken } from '../../lib/auth-storage';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCachedApi } from '@/hooks/useCachedApi';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function TeamDetailScreen() {
    const { teamId } = useLocalSearchParams<{ teamId: string }>();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    const [isFavorite, setIsFavorite] = useState(false);
    const [favoriteLoading, setFavoriteLoading] = useState(false);

    const backendBaseUrl = 'http://192.168.1.108:8000'; // adjust later for production

    async function fetchFavoritesForUser(): Promise<string[]> {
        try {
            const token = await getToken(); // Get stored token
            if (!token) return [];

            const res = await fetch(`${backendBaseUrl}/api/favorites`, {
                headers: { 'Authorization': `Bearer ${token}` } // Send token
            });
            if (!res.ok) return [];
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        } catch (e) {
            console.log('Error fetching favorites', e);
            return [];
        }
    }

    async function addFavorite(teamId: string) {
        try {
            const token = await getToken(); // Get stored token
            const res = await fetch(`${backendBaseUrl}/api/favorites`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // Send token
                },
                body: JSON.stringify({ teamId }),
            });
            if (!res.ok) console.log('Failed to add favorite', res.status);
        } catch (e) {
            console.log('Error adding favorite', e);
        }
    }

    async function removeFavorite(teamId: string) {
        try {
            const token = await getToken(); // Get stored token
            const res = await fetch(`${backendBaseUrl}/api/favorites/${encodeURIComponent(teamId)}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` } // Send token
            });
            if (!res.ok) console.log('Failed to remove favorite', res.status);
        } catch (e) {
            console.log('Error removing favorite', e);
        }
    }

    useEffect(() => {
        if (!teamId) return;
        let cancelled = false;

        const load = async () => {
            setFavoriteLoading(true);
            const favs = await fetchFavoritesForUser();
            if (!cancelled) {
                const tid = String(teamId).toUpperCase();
                setIsFavorite(favs.map(t => String(t).toUpperCase()).includes(tid));
                setFavoriteLoading(false);
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [teamId]);


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
                heroTopRow: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 10,
                },
                logoWrap: {
                    marginRight: 12,
                },
                heroTextWrap: {
                    flex: 1,
                },
                teamName: {
                    fontSize: 30,
                    fontWeight: '800',
                    marginBottom: 4,
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
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                },
                analyticsCard: {
                    width: '48.5%',
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 14,
                    padding: 14,
                    backgroundColor: theme.card,
                    marginBottom: 10,
                    minHeight: 112,
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

    const {
        data: team,
        loading,
        error,
    } = useCachedApi({
        cacheKey: `team:${teamId}:detail:latest:v1`,
        endpoint: `/teams/${teamId}`,
        maxAgeMs: 1000 * 60 * 30,
        enabled: !!teamId,
    });

    const lslRank = team?.polls?.LSL?.rank;
    const lslNext5 = team?.polls?.LSL?.next5_order;
    const lcaaRank = team?.polls?.LCAA?.rank;
    const lcaaNext5 = team?.polls?.LCAA?.next5_order;

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

    const formatConferenceName = (name?: string | null) => {
        if (!name) return null;

        const normalized = name.trim();

        const shortMap: Record<string, string> = {
            'Atlantic Coast Conference': 'ACC',
            'Southeastern Conference': 'SEC',
            'Big Ten Conference': 'Big Ten',
            'Big 12 Conference': 'Big 12',
            'Big East Conference': 'Big East',
            'Pacific-12 Conference': 'Pac-12',
            'Pac-12 Conference': 'Pac-12',
            'American Athletic Conference': 'AAC',
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

    const conferenceName = team?.conference_name ?? null;
    const conferenceDisplayName = formatConferenceName(conferenceName);
    const playersCount = team?.roster_summary?.players_count ?? 0;

    const analyticsCards = [
        { label: 'Power', item: team?.analytics?.power },
        { label: 'Resume', item: team?.analytics?.resume },
        { label: 'Form', item: team?.analytics?.form },
        { label: 'SOS', item: team?.analytics?.sos },
    ];

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
                        <View style={styles.heroTopRow}>
                            <View style={styles.logoWrap}>
                                <TeamLogo teamId={teamId} size={52} />
                            </View>

                            <View style={styles.heroTextWrap}>
                                <Text style={styles.teamName}>{team.team_name}</Text>
                                <Text style={styles.primaryRecord}>{overallRecord}</Text>
                            </View>
                        </View>

                        <Text style={styles.secondaryLine}>
                            {conferenceDisplayName
                                ? `${conferenceDisplayName} record: ${conferenceRecord}`
                                : `Conference record: ${conferenceRecord}`}
                        </Text>

                        <Text style={styles.pollsLine}>
                            LSL: {formatPollValue(lslRank, lslNext5)} • LCAA: {formatPollValue(lcaaRank, lcaaNext5)}
                        </Text>

                        <Text style={styles.metaLine}>Players: {playersCount}</Text>

                        <Pressable
                            style={({ pressed }) => [
                                {
                                    marginTop: 12,
                                    paddingVertical: 8,
                                    paddingHorizontal: 16,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: theme.border,
                                    backgroundColor: pressed ? theme.border : theme.card,
                                    alignSelf: 'flex-start',
                                },
                            ]}
                            disabled={favoriteLoading}
                            onPress={async () => {
                                if (!teamId) return;
                                const tid = String(teamId);
                                setFavoriteLoading(true);
                                if (isFavorite) {
                                    await removeFavorite(tid);
                                    setIsFavorite(false);
                                } else {
                                    await addFavorite(tid);
                                    setIsFavorite(true);
                                }
                                setFavoriteLoading(false);
                            }}
                        >
                            <Text
                                style={{
                                    color: theme.text,
                                    fontWeight: '600',
                                }}
                            >
                                {favoriteLoading
                                    ? 'Updating...'
                                    : isFavorite
                                        ? 'Unfavorite Team'
                                        : 'Favorite Team'}
                            </Text>
                        </Pressable>

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