import TeamLogo from '@/components/TeamLogo';
import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCachedApi } from '@/hooks/useCachedApi';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PlayerDetailScreen() {
    const { playerId } = useLocalSearchParams<{ playerId: string }>();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    const {
        data: player,
        loading,
        error,
    } = useCachedApi({
        cacheKey: `player:${playerId}:detail`,
        endpoint: `/players/${playerId}`,
        maxAgeMs: 1000 * 60 * 30,
        enabled: !!playerId,
    });

    const styles = useMemo(
        () =>
            StyleSheet.create({
                content: {
                    paddingHorizontal: 20,
                    paddingTop: 12,
                    paddingBottom: 40,
                    backgroundColor: theme.background,
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
                playerName: {
                    fontSize: 28,
                    fontWeight: '800',
                    marginBottom: 4,
                    color: theme.text,
                },
                secondaryLine: {
                    fontSize: 15,
                    color: theme.mutedText,
                    marginBottom: 4,
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
                statsGrid: {
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                },
                statCard: {
                    width: '48.5%',
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 14,
                    padding: 14,
                    backgroundColor: theme.card,
                    marginBottom: 10,
                    minHeight: 96,
                },
                statLabel: {
                    fontSize: 13,
                    color: theme.mutedText,
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                },
                statValue: {
                    fontSize: 20,
                    fontWeight: '800',
                    color: theme.text,
                },
                infoCard: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 14,
                    padding: 14,
                    backgroundColor: theme.card,
                    marginBottom: 10,
                },
                infoLine: {
                    fontSize: 15,
                    color: theme.text,
                    marginBottom: 8,
                },
                muted: {
                    color: theme.mutedText,
                },
                previousTeamRow: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 12,
                },
                previousTeamTextWrap: {
                    marginLeft: 10,
                    flex: 1,
                },
                previousTeamLabel: {
                    fontSize: 12,
                    color: theme.mutedText,
                    marginBottom: 2,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                },
                previousTeamName: {
                    fontSize: 18,
                    fontWeight: '700',
                    color: theme.text,
                },
                notesCard: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 14,
                    padding: 14,
                    backgroundColor: theme.card,
                },
                notesText: {
                    fontSize: 14,
                    lineHeight: 20,
                    color: theme.text,
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
                body: {
                    fontSize: 14,
                    lineHeight: 20,
                    color: theme.text,
                },
            }),
        [theme]
    );

    const formatStat = (value?: number | null) => {
        if (value === null || value === undefined) return '—';
        return `${value}`;
    };

    const formatPct = (value?: number | null) => {
        if (value === null || value === undefined) return '—';
        return `${value}%`;
    };

    const formatHometown = () => {
        const city = player?.home_city?.trim();
        const state = player?.home_state_region?.trim();
        const country = player?.home_country?.trim();

        if (city && state && country && country.toUpperCase() === 'USA') {
            return `${city}, ${state}`;
        }
        if (city && country) return `${city}, ${country}`;
        if (state && country) return `${state}, ${country}`;
        return country || city || state || '—';
    };

    const roleLine = `${player?.primary_position || '—'}${player?.secondary_position ? ` / ${player.secondary_position}` : ''
        } • ${player?.class || '—'} • ${player?.height || '—'} • ${player?.weight || '—'}`;

    const title = player?.player_name || 'Player';
    const previousTeamName = player?.prev_team_name || player?.prev_team_id || '—';
    const hasPreviousSeason =
        player?.prev_games_played !== null && player?.prev_games_played !== undefined ||
        player?.prev_ppg !== null && player?.prev_ppg !== undefined ||
        player?.prev_rpg !== null && player?.prev_rpg !== undefined ||
        player?.prev_apg !== null && player?.prev_apg !== undefined ||
        player?.prev_spg !== null && player?.prev_spg !== undefined ||
        player?.prev_bpg !== null && player?.prev_bpg !== undefined ||
        player?.prev_fg_pct !== null && player?.prev_fg_pct !== undefined ||
        player?.prev_three_pct !== null && player?.prev_three_pct !== undefined ||
        player?.prev_ft_pct !== null && player?.prev_ft_pct !== undefined;

    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Stack.Screen
                options={{
                    title,
                }}
            />

            {loading ? (
                <View style={styles.centerBlock}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.helper}>Loading player...</Text>
                </View>
            ) : error ? (
                <View style={styles.errorCard}>
                    <Text style={styles.errorTitle}>Error</Text>
                    <Text style={styles.body}>{error}</Text>
                </View>
            ) : !player ? (
                <View style={styles.errorCard}>
                    <Text style={styles.body}>No player data available.</Text>
                </View>
            ) : (
                <>
                    <View style={styles.heroCard}>
                        <View style={styles.heroTopRow}>
                            <View style={styles.logoWrap}>
                                <TeamLogo teamId={player.team_id} size={48} />
                            </View>

                            <View style={styles.heroTextWrap}>
                                <Text style={styles.playerName}>{player.player_name}</Text>
                                <Text style={styles.secondaryLine}>
                                    {player.jersey_number ? `#${player.jersey_number} • ` : ''}
                                    {player.team_name || player.team_id || '—'}
                                </Text>
                                <Text style={styles.secondaryLine}>{roleLine}</Text>
                            </View>
                        </View>

                        <Text style={styles.metaLine}>{formatHometown()}</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Season Stats</Text>
                        <View style={styles.statsGrid}>
                            <View style={styles.statCard}>
                                <Text style={styles.statLabel}>PPG</Text>
                                <Text style={styles.statValue}>{formatStat(player.ppg)}</Text>
                            </View>

                            <View style={styles.statCard}>
                                <Text style={styles.statLabel}>RPG</Text>
                                <Text style={styles.statValue}>{formatStat(player.rpg)}</Text>
                            </View>

                            <View style={styles.statCard}>
                                <Text style={styles.statLabel}>APG</Text>
                                <Text style={styles.statValue}>{formatStat(player.apg)}</Text>
                            </View>

                            <View style={styles.statCard}>
                                <Text style={styles.statLabel}>Games</Text>
                                <Text style={styles.statValue}>{formatStat(player.games_played)}</Text>
                            </View>

                            <View style={styles.statCard}>
                                <Text style={styles.statLabel}>FG%</Text>
                                <Text style={styles.statValue}>{formatPct(player.fg_pct)}</Text>
                            </View>

                            <View style={styles.statCard}>
                                <Text style={styles.statLabel}>3PT%</Text>
                                <Text style={styles.statValue}>{formatPct(player.three_pct)}</Text>
                            </View>

                            <View style={styles.statCard}>
                                <Text style={styles.statLabel}>FT%</Text>
                                <Text style={styles.statValue}>{formatPct(player.ft_pct)}</Text>
                            </View>

                            <View style={styles.statCard}>
                                <Text style={styles.statLabel}>SPG / BPG</Text>
                                <Text style={styles.statValue}>
                                    {formatStat(player.spg)} / {formatStat(player.bpg)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Previous Season</Text>

                        <View style={styles.infoCard}>
                            <View style={styles.previousTeamRow}>
                                <TeamLogo teamId={player.prev_team_id} size={28} />
                                <View style={styles.previousTeamTextWrap}>
                                    <Text style={styles.previousTeamLabel}>Previous Team</Text>
                                    <Text style={styles.previousTeamName}>{previousTeamName}</Text>
                                </View>
                            </View>

                            {hasPreviousSeason ? (
                                <View style={styles.statsGrid}>
                                    <View style={styles.statCard}>
                                        <Text style={styles.statLabel}>Games</Text>
                                        <Text style={styles.statValue}>{formatStat(player.prev_games_played)}</Text>
                                    </View>

                                    <View style={styles.statCard}>
                                        <Text style={styles.statLabel}>PPG</Text>
                                        <Text style={styles.statValue}>{formatStat(player.prev_ppg)}</Text>
                                    </View>

                                    <View style={styles.statCard}>
                                        <Text style={styles.statLabel}>RPG</Text>
                                        <Text style={styles.statValue}>{formatStat(player.prev_rpg)}</Text>
                                    </View>

                                    <View style={styles.statCard}>
                                        <Text style={styles.statLabel}>APG</Text>
                                        <Text style={styles.statValue}>{formatStat(player.prev_apg)}</Text>
                                    </View>

                                    <View style={styles.statCard}>
                                        <Text style={styles.statLabel}>SPG</Text>
                                        <Text style={styles.statValue}>{formatStat(player.prev_spg)}</Text>
                                    </View>

                                    <View style={styles.statCard}>
                                        <Text style={styles.statLabel}>BPG</Text>
                                        <Text style={styles.statValue}>{formatStat(player.prev_bpg)}</Text>
                                    </View>

                                    <View style={styles.statCard}>
                                        <Text style={styles.statLabel}>FG%</Text>
                                        <Text style={styles.statValue}>{formatPct(player.prev_fg_pct)}</Text>
                                    </View>

                                    <View style={styles.statCard}>
                                        <Text style={styles.statLabel}>3PT%</Text>
                                        <Text style={styles.statValue}>{formatPct(player.prev_three_pct)}</Text>
                                    </View>

                                    <View style={styles.statCard}>
                                        <Text style={styles.statLabel}>FT%</Text>
                                        <Text style={styles.statValue}>{formatPct(player.prev_ft_pct)}</Text>
                                    </View>
                                </View>
                            ) : (
                                <Text style={styles.notesText}>No previous-season stats available.</Text>
                            )}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Notes</Text>
                        <View style={styles.notesCard}>
                            <Text style={styles.notesText}>{player.notes || 'No notes available.'}</Text>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Browse Team</Text>
                        <View style={styles.navCard}>
                            <Pressable
                                onPress={() => router.push(`/team/${player.team_id}`)}
                                style={({ pressed }) => [styles.navRow, pressed && styles.navRowPressed]}>
                                <Text style={styles.navTitle}>Team Detail</Text>
                                <Text style={styles.navSub}>Return to the full team overview</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => router.push(`/team/${player.team_id}/roster`)}
                                style={({ pressed }) => [styles.navRow, pressed && styles.navRowPressed]}>
                                <Text style={styles.navTitle}>Team Roster</Text>
                                <Text style={styles.navSub}>Go back to the full roster list</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => router.push(`/team/${player.team_id}/schedule`)}
                                style={({ pressed }) => [styles.navRow, styles.navRowLast, pressed && styles.navRowPressed]}>
                                <Text style={styles.navTitle}>Team Schedule</Text>
                                <Text style={styles.navSub}>See upcoming and full season games</Text>
                            </Pressable>
                        </View>
                    </View>
                </>
            )}
        </ScrollView>
    );
}