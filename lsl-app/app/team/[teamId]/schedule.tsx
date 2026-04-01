import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL } from '@/lib/api';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

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
};

export default function TeamScheduleScreen() {
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
                metaLine: {
                    fontSize: 13,
                    color: theme.mutedText,
                    marginBottom: 8,
                },
                mainLine: {
                    fontSize: 19,
                    fontWeight: '700',
                    color: theme.text,
                },
            }),
        [theme]
    );

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [payload, setPayload] = useState<any>(null);

    useEffect(() => {
        const loadSchedule = async () => {
            if (!teamId) return;

            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`${API_BASE_URL}/teams/${teamId}/schedule`);
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

        loadSchedule();
    }, [teamId]);

    const games: ScheduleGame[] = payload?.games ?? payload?.schedule ?? [];

    const formatSite = (site?: string) => {
        if (site === 'HOME') return 'vs';
        if (site === 'AWAY') return '@';
        if (site === 'NEUTRAL') return '(N)';
        return '—';
    };

    const formatOpponent = (game: ScheduleGame) => {
        const raw = game.opponent_name || game.opponent_team_id || '—';
        return raw.replace(/_/g, ' ');
    };

    return (
        <ScrollView contentContainerStyle={styles.content}>
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
                    <View style={styles.header}>
                        <Text style={styles.subTitle}>Upcoming Schedule</Text>
                    </View>

                    {games.length === 0 ? (
                        <View style={styles.card}>
                            <Text style={styles.body}>No upcoming games available.</Text>
                        </View>
                    ) : (
                        games.map((game) => (
                            <View key={game.game_key} style={styles.card}>
                                <Text style={styles.metaLine}>
                                    {game.display_date || game.date_key || 'TBD'} • {game.phase_display || game.phase || '—'} • Week {game.week ?? '—'}
                                </Text>
                                <Text style={styles.mainLine}>
                                    {formatSite(game.site)} {formatOpponent(game)}
                                </Text>
                            </View>
                        ))
                    )}
                </>
            )}
        </ScrollView>
    );
}