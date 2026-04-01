import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL } from '@/lib/api';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

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
                header: {
                    marginBottom: 16,
                },
                subTitle: {
                    fontSize: 15,
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
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 12,
                    backgroundColor: theme.card,
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
                topRow: {
                    marginBottom: 8,
                },
                playerName: {
                    fontSize: 20,
                    fontWeight: '700',
                    color: theme.text,
                },
                metaLine: {
                    fontSize: 14,
                    color: theme.mutedText,
                    marginBottom: 6,
                },
                statsLine: {
                    fontSize: 14,
                    fontWeight: '600',
                    color: theme.text,
                },
            }),
        [theme]
    );

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [payload, setPayload] = useState<any>(null);

    useEffect(() => {
        const loadRoster = async () => {
            if (!teamId) return;

            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`${API_BASE_URL}/teams/${teamId}/roster`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const json = await response.json();
                setPayload(json);
            } catch (err: any) {
                setError(err?.message ?? 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        loadRoster();
    }, [teamId]);

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

    return (
        <ScrollView contentContainerStyle={styles.content}>
            {loading ? (
                <View style={styles.centerBlock}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.helper}>Loading roster...</Text>
                </View>
            ) : error ? (
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Error</Text>
                    <Text style={styles.body}>{error}</Text>
                </View>
            ) : (
                <>
                    <View style={styles.header}>
                        <Text style={styles.subTitle}>Roster • {payload?.players_count ?? 0} players</Text>
                    </View>

                    {players.length === 0 ? (
                        <View style={styles.card}>
                            <Text style={styles.body}>No roster data available.</Text>
                        </View>
                    ) : (
                        players.map((player) => (
                            <View key={player.player_id} style={styles.card}>
                                <View style={styles.topRow}>
                                    <Text style={styles.playerName}>
                                        {player.jersey_number ? `#${player.jersey_number} ` : ''}
                                        {player.player_name}
                                    </Text>
                                </View>

                                <Text style={styles.metaLine}>
                                    {player.primary_position || '—'}
                                    {player.secondary_position ? ` / ${player.secondary_position}` : ''}
                                    {' • '}
                                    {player.class || '—'}
                                    {' • '}
                                    {player.height || '—'}
                                </Text>

                                <Text style={styles.metaLine}>{formatHometown(player)}</Text>

                                <Text style={styles.statsLine}>
                                    PPG {formatStat(player.ppg)} • RPG {formatStat(player.rpg)} • APG {formatStat(player.apg)}
                                </Text>
                            </View>
                        ))
                    )}
                </>
            )}
        </ScrollView>
    );
}