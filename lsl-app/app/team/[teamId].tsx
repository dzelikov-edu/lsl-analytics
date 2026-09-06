import TeamLogo from '@/components/TeamLogo';
import { API_BASE_URL } from '../../lib/api';
import { AppColors } from '@/constants/app-colors';
import { getToken } from '../../lib/auth-storage';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCachedApi } from '@/hooks/useCachedApi';
import { getTeamBranding } from '@/lib/teamBranding';
import { getConferenceBranding } from '@/lib/conferenceBranding';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function TeamDetailScreen() {
    const { teamId } = useLocalSearchParams<{ teamId: string }>();
    const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
    const theme = AppColors[colorScheme];

    const [isFavorite, setIsFavorite] = useState(false);
    const [favoriteLoading, setFavoriteLoading] = useState(false);

    async function fetchFavoritesForUser(): Promise<string[]> {
        try {
            const token = await getToken(); // Get stored token
            if (!token) return [];

            const res = await fetch(`${API_BASE_URL}/api/favorites`, {
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
        if (favoriteLoading) return; // Prevention gate
        setFavoriteLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE_URL}/api/favorites`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ teamId }),
            });

            if (res.ok) {
                setIsFavorite(true); // Update the icon instantly
            } else {
                console.log('Failed to add favorite', res.status);
            }
        } catch (e) {
            console.log('Error adding favorite', e);
        } finally {
            setFavoriteLoading(false); // Clear the gate
        }
    }


    async function removeFavorite(teamId: string) {
        if (favoriteLoading) return; // Prevention gate
        setFavoriteLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE_URL}/api/favorites/${encodeURIComponent(teamId)}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                setIsFavorite(false); // Update the icon instantly
            } else {
                console.log('Failed to remove favorite', res.status);
            }
        } catch (e) {
            console.log('Error removing favorite', e);
        } finally {
            setFavoriteLoading(false); // Clear the gate
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

    const getOrdinal = (n: number | null) => {
        if (!n) return '';
        const s = ['th', 'st', 'nd', 'rd'],
            v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

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

    // NEW: derive a not-tracked flag from the error text
    const isNotTracked = !!error && (String(error).includes('Unknown team_id') || String(error).includes('404'));

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

    const getTierMeta = (metric: string, tier?: string | null) => {
        if (!tier) {
            return {
                label: '—',
                color: theme.mutedText,
                bg: theme.card,
            };
        }

        const t = tier.toLowerCase();
        const m = metric.toLowerCase();

        // POWER: elite / strong / solid / tracked
        if (m === 'power') {
            if (t === 'elite') {
                return { label: 'Elite', color: '#15803d', bg: '#bbf7d0' };
            }
            if (t === 'strong') {
                return { label: 'Strong', color: '#1d4ed8', bg: '#bfdbfe' };
            }
            if (t === 'solid') {
                return { label: 'Solid', color: '#b45309', bg: '#fef3c7' };
            }
            if (t === 'tracked') {
                return { label: 'Tracked', color: '#4b5563', bg: '#e5e7eb' };
            }
        }

        // RESUME: reuse same keys, but softer resume language
        if (m === 'resume') {
            if (t === 'elite') {
                return { label: 'Top Shelf', color: '#15803d', bg: '#bbf7d0' };
            }
            if (t === 'strong') {
                return { label: 'Strong Profile', color: '#22c55e', bg: '#dcfce7' };
            }
            if (t === 'solid') {
                return { label: 'Solid Profile', color: '#eab308', bg: '#fef9c3' };
            }
            if (t === 'tracked') {
                return { label: 'Developing', color: '#6b7280', bg: '#e5e7eb' };
            }
        }

        // FORM: hot / strong / solid / cool
        if (m === 'form') {
            if (t === 'hot') {
                return { label: 'Red Hot', color: '#b91c1c', bg: '#fee2e2' }; // strong red
            }
            if (t === 'strong') {
                return { label: 'In Form', color: '#ef4444', bg: '#fee2e2' }; // red
            }
            if (t === 'solid') {
                return { label: 'Steady', color: '#ea580c', bg: '#ffedd5' }; // orange
            }
            if (t === 'cool') {
                return { label: 'Cooling Off', color: '#0ea5e9', bg: '#e0f2fe' }; // blue-ish
            }
        }

        // SOS: brutal / strong / solid / lighter
        if (m === 'sos') {
            if (t === 'brutal') {
                return { label: 'Elite SOS', color: '#111827', bg: '#e5e7eb' }; // very hard slate
            }
            if (t === 'strong') {
                return { label: 'Tough SOS', color: '#374151', bg: '#e5e7eb' };
            }
            if (t === 'solid') {
                return { label: 'Balanced SOS', color: '#6b7280', bg: '#f3f4f6' };
            }
            if (t === 'lighter') {
                return { label: 'Lighter SOS', color: '#9ca3af', bg: '#f9fafb' };
            }
        }

        // Fallback for Form/SOS or any unexpected tiers for now
        return {
            label: tier,
            color: theme.mutedText,
            bg: theme.card,
        };
    };

    const formatConferenceName = (name?: string | null, confId?: string | null, isRealism?: boolean) => {
        if (!name) return null;

        const authoredShortMap: Record<string, string> = {
            'ACC': 'CEC',
            'AAC': 'NAC',
            'A10': 'ECC',
            'BE': 'MPC',
            'B10': 'RAC',
            'B12': 'GPC',
            'BW': 'LWC',
            'MVC': 'HAC',
            'MW': 'RMC',
            'P12': 'WPC',
            'SEC': 'SAC',
            'WCC': 'PRC',
        };

        // Use the boolean passed in instead of the missing variable
        if (isRealism && confId) {
            return confId;
        }

        const normalizedId = String(confId).toUpperCase();
        return authoredShortMap[normalizedId] ?? name.replace(/\s+Conference$/, '');
    };

    const overallRecord = team?.record?.overall_record ?? '—';
    const conferenceRecord = team?.record?.conference_record ?? '—';

    const teamBranding = getTeamBranding(teamId, team?.team_name);
    const conferenceBranding = getConferenceBranding(team?.conference_id, team?.conference_name);
    // If the display name is the same as the API name, realism is "active"
    const isRealismActive = teamBranding.displayName === team?.team_name;
    const conferenceDisplayName = conferenceBranding.displayName || 'Conference';
    const playersCount = team?.roster_summary?.players_count ?? 0;

    const analyticsCards = [
        { label: 'Power', item: team?.analytics?.power },
        { label: 'Resume', item: team?.analytics?.resume },
        { label: 'Form', item: team?.analytics?.form },
        { label: 'SOS', item: team?.analytics?.sos },
    ];

    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Stack.Screen
                options={{
                    title: teamBranding.displayName
                }}
            />
            {loading ? (
                <View style={styles.centerBlock}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.helper}>Loading team...</Text>
                </View>
            ) : isNotTracked ? (
                <View style={styles.errorCard}>
                    <Text style={styles.errorTitle}>Team Not Tracked</Text>
                    <Text style={styles.body}>
                        This program isn’t part of the 69 fully tracked Legends teams yet, so a detailed team page
                        isn’t available. You’ll still see them in schedules, box scores, and conference views
                        if they're a part of the group of currently tracked conferences.
                    </Text>
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
                                <Text style={styles.teamName}>{teamBranding.displayName}</Text>

                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={styles.primaryRecord}>{overallRecord}</Text>

                                    {team.conference_rank && (
                                        <View style={{
                                            backgroundColor: theme.text,
                                            paddingHorizontal: 8,
                                            paddingVertical: 2,
                                            borderRadius: 4,
                                            marginLeft: 10
                                        }}>
                                            <Text style={{ color: theme.background, fontSize: 12, fontWeight: '800' }}>
                                                {/* ADD 'T-' if tied */}
                                                {team.conference_is_tied ? 'T-' : ''}{getOrdinal(team.conference_rank)} in {formatConferenceName(conferenceBranding.displayName, team.conference_id, isRealismActive)}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>

                        <Text style={styles.secondaryLine}>
                            {conferenceDisplayName
                                ? `${conferenceDisplayName} record: ${conferenceRecord}`
                                : `Conference record: ${conferenceRecord}`}
                        </Text>

                        {team.form && team.form.length > 0 && (
                            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
                                <Text
                                    style={{
                                        fontSize: 12,
                                        color: theme.mutedText,
                                        fontWeight: '700',
                                        marginRight: 8,
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    Recent Form:
                                </Text>
                                <View style={{ flexDirection: 'row' }}>
                                    {team.form.map((res: string, i: number) => (
                                        <View
                                            key={i}
                                            style={{
                                                width: 22,
                                                height: 22,
                                                borderRadius: 11,
                                                backgroundColor: res === 'W' ? '#34C759' : '#FF3B30', // Green for W, Red for L
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginRight: 4,
                                            }}
                                        >
                                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>
                                                {res}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

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
                                    // Dim the button slightly when it's in the 'Updating...' state
                                    opacity: favoriteLoading ? 0.6 : 1,
                                },
                            ]}
                            disabled={favoriteLoading}
                            onPress={() => {
                                if (!teamId) return;
                                const tid = String(teamId);

                                // Let the standalone functions handle the state updates!
                                if (isFavorite) {
                                    removeFavorite(tid);
                                } else {
                                    addFavorite(tid);
                                }
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
                        <Text
                            style={{
                                fontSize: 12,
                                color: theme.mutedText,
                                marginBottom: 12,
                            }}
                        >
                            Power: neutral-court strength • Resume: body of work • Form: recent performance • SOS: schedule difficulty
                        </Text>
                        <View style={styles.analyticsGrid}>
                            {analyticsCards.map((entry) => {
                                const { label, color, bg } = getTierMeta(entry.label, entry.item?.tier);

                                return (
                                    <View key={entry.label} style={styles.analyticsCard}>
                                        <Text style={styles.metricLabel}>{entry.label}</Text>
                                        <Text style={styles.metricValue}>{formatMetricValue(entry.item)}</Text>

                                        <View
                                            style={{
                                                marginTop: 6,
                                                alignSelf: 'flex-start',
                                                paddingHorizontal: 8,
                                                paddingVertical: 3,
                                                borderRadius: 999,
                                                backgroundColor: bg,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 12,
                                                    fontWeight: '700',
                                                    color,
                                                    textTransform: 'uppercase',
                                                }}
                                            >
                                                {label}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
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