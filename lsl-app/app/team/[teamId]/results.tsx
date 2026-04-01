import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { API_BASE_URL } from '@/lib/api';

type ResultGame = {
    game_key: string;
    phase?: string;
    phase_display?: string;
    week?: number | null;
    site?: string;
    team_id?: string;
    opponent_team_id?: string;
    opponent_name?: string;
    team_score?: number | null;
    opp_score?: number | null;
    played?: boolean;
};

export default function TeamResultsScreen() {
    const { teamId } = useLocalSearchParams<{ teamId: string }>();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [payload, setPayload] = useState<any>(null);

    useEffect(() => {
        const loadResults = async () => {
            if (!teamId) return;

            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`${API_BASE_URL}/teams/${teamId}/results`);
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

        loadResults();
    }, [teamId]);

    const games: ResultGame[] = payload?.schedule ?? payload?.results ?? [];

    const formatSite = (site?: string) => {
        if (site === 'HOME') return 'vs';
        if (site === 'AWAY') return '@';
        if (site === 'NEUTRAL') return '(N)';
        return '—';
    };

    const formatOpponent = (game: ResultGame) => {
        const raw = game.opponent_name || game.opponent_team_id || '—';
        return raw.replace(/_/g, ' ');
    };

    const resultLetter = (game: ResultGame) => {
        if (game.team_score == null || game.opp_score == null) return '—';
        if (game.team_score > game.opp_score) return 'W';
        if (game.team_score < game.opp_score) return 'L';
        return 'T';
    };

    return (
        <ScrollView contentContainerStyle={styles.content}>
            {loading ? (
                <View style={styles.centerBlock}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.helper}>Loading results...</Text>
                </View>
            ) : error ? (
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Error</Text>
                    <Text style={styles.body}>{error}</Text>
                </View>
            ) : (
                <>
                    <View style={styles.header}>
                        <Text style={styles.screenTitle}>
                            {(payload?.team_name || payload?.team_id || 'Results').replace(/_/g, ' ')}
                        </Text>
                        <Text style={styles.subTitle}>Played Results</Text>
                    </View>

                    {games.length === 0 ? (
                        <View style={styles.card}>
                            <Text style={styles.body}>No played games available.</Text>
                        </View>
                    ) : (
                        games.map((game) => (
                            <View key={game.game_key} style={styles.card}>
                                <Text style={styles.metaLine}>
                                    {game.phase_display || game.phase || '—'} • Week {game.week ?? '—'}
                                </Text>
                                <Text style={styles.resultLine}>
                                    {resultLetter(game)} {game.team_score ?? '—'}-{game.opp_score ?? '—'}
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

const styles = StyleSheet.create({
    content: {
        padding: 20,
        paddingBottom: 40,
        backgroundColor: '#fff',
    },
    header: {
        marginBottom: 20,
    },
    screenTitle: {
        fontSize: 32,
        fontWeight: '800',
        marginBottom: 4,
    },
    subTitle: {
        fontSize: 15,
        opacity: 0.7,
    },
    centerBlock: {
        paddingVertical: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    helper: {
        fontSize: 15,
        opacity: 0.7,
        marginTop: 12,
    },
    card: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        backgroundColor: '#fafafa',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 10,
    },
    body: {
        fontSize: 14,
        lineHeight: 20,
    },
    metaLine: {
        fontSize: 13,
        opacity: 0.7,
        marginBottom: 8,
    },
    resultLine: {
        fontSize: 19,
        fontWeight: '800',
        marginBottom: 6,
    },
    mainLine: {
        fontSize: 17,
        fontWeight: '600',
    },
});