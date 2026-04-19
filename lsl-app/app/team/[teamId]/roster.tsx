import TeamLogo from '@/components/TeamLogo';
import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCachedApi } from '@/hooks/useCachedApi';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type PlayerRow = {
    player_id: string;
    player_name: string;
    jersey_number?: string;
    primary_position?: string;
    secondary_position?: string;
    class?: string;
    height?: string;
    home_city?: string;
    home_state_region?: string;
    home_country?: string;
    ppg?: number | null;
    rpg?: number | null;
    apg?: number | null;
};

export default function TeamRosterScreen() {
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
                body: {
                    fontSize: 14,
                    lineHeight: 20,
                    color: theme.text,
                },
                topRow: {
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                },
                identityWrap: {
                    flex: 1,
                    paddingRight: 12,
                },
                numberBadge: {
                    minWidth: 44,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: theme.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.background,
                },
                numberBadgeText: {
                    fontSize: 14,
                    fontWeight: '800',
                    color: theme.text,
                },
                playerName: {
                    fontSize: 20,
                    fontWeight: '800',
                    color: theme.text,
                    marginBottom: 4,
                },
                roleLine: {
                    fontSize: 14,
                    color: theme.mutedText,
                    marginBottom: 2,
                },
                hometownLine: {
                    fontSize: 14,
                    color: theme.mutedText,
                    marginBottom: 10,
                },
                statsRow: {
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: 8,
                },
                statChip: {
                    flex: 1,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 12,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    backgroundColor: theme.background,
                },
                statLabel: {
                    fontSize: 11,
                    fontWeight: '700',
                    color: theme.mutedText,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    marginBottom: 2,
                },
                statValue: {
                    fontSize: 15,
                    fontWeight: '800',
                    color: theme.text,
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
        data: payload,
        loading,
        error,
    } = useCachedApi({
        cacheKey: `team:${teamId}:roster`,
        endpoint: `/teams/${teamId}/roster`,
        maxAgeMs: 1000 * 60 * 30,
        enabled: !!teamId,
    });

    const players: PlayerRow[] = payload?.players ?? [];

    const formatHometown = (p: PlayerRow) => {
        const city = p.home_city?.trim();
        const state = p.home_state_region?.trim();
        const country = p.home_country?.trim();

        if (city && state && country && country.toUpperCase() === 'USA') {
            return `${city}, ${state}`;
        }
        if (city && country) return `${city}, ${country}`;
        if (state && country) return `${state}, ${country}`;
        return country || city || state || '—';
    };

    const formatStat = (value?: number | null) => {
        if (value === null || value === undefined) return '—';
        return `${value}`;
    };

    const formatRoleLine = (player: PlayerRow) => {
        const position = player.primary_position || '—';
        const secondary = player.secondary_position ? ` / ${player.secondary_position}` : '';
        const playerClass = player.class || '—';
        const height = player.height || '—';

        return `${position}${secondary} • ${playerClass} • ${height}`;
    };

    return (
        <ScrollView contentContainerStyle={styles.content}>
            {loading ? (
                <View style={styles.centerBlock}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.helper}>Loading roster...</Text>
                </View>
            ) : error ? (
                <View style={styles.card}>
                    <Text style={styles.errorTitle}>Error</Text>
                    <Text style={styles.body}>{error}</Text>
                </View>
            ) : (
                <>
                    <View style={styles.headerCard}>
                        <View style={styles.headerRow}>
                            <TeamLogo teamId={teamId} size={34} />
                            <View style={styles.headerTextWrap}>
                                <Text style={styles.headerTitle}>Roster</Text>
                                <Text style={styles.headerSubTitle}>
                                    {payload?.players_count ?? 0} players
                                </Text>
                            </View>
                        </View>
                    </View>

                    {players.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyTitle}>No roster data yet</Text>
                            <Text style={styles.emptyText}>
                                Player information will appear here once roster data is available for this team.
                            </Text>
                        </View>
                    ) : (
                        players.map((player) => (
                            <Pressable
                                key={player.player_id}
                                onPress={() =>
                                    router.push({
                                        pathname: '/player/[playerId]',
                                        params: { playerId: player.player_id },
                                    })
                                }
                                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
                                <View style={styles.topRow}>
                                    <View style={styles.identityWrap}>
                                        <Text style={styles.playerName}>{player.player_name}</Text>
                                        <Text style={styles.roleLine}>{formatRoleLine(player)}</Text>
                                    </View>

                                    <View style={styles.numberBadge}>
                                        <Text style={styles.numberBadgeText}>
                                            {player.jersey_number ? `#${player.jersey_number}` : '—'}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={styles.hometownLine}>{formatHometown(player)}</Text>

                                <View style={styles.statsRow}>
                                    <View style={styles.statChip}>
                                        <Text style={styles.statLabel}>PPG</Text>
                                        <Text style={styles.statValue}>{formatStat(player.ppg)}</Text>
                                    </View>

                                    <View style={styles.statChip}>
                                        <Text style={styles.statLabel}>RPG</Text>
                                        <Text style={styles.statValue}>{formatStat(player.rpg)}</Text>
                                    </View>

                                    <View style={styles.statChip}>
                                        <Text style={styles.statLabel}>APG</Text>
                                        <Text style={styles.statValue}>{formatStat(player.apg)}</Text>
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