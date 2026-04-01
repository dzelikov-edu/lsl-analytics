import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL } from '@/lib/api';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Top25Row = {
    rank: number;
    team_id: string;
    team_name: string;
    notes?: string;
};

type Next5Row = {
    order: number;
    team_id: string;
    team_name: string;
    notes?: string;
};

type PollKey = 'LSL' | 'LCAA';

export default function RankingsScreen() {
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
                screenTitle: {
                    fontSize: 32,
                    fontWeight: '800',
                    marginBottom: 20,
                    color: theme.text,
                },
                switcherRow: {
                    flexDirection: 'row',
                    marginBottom: 18,
                    gap: 10,
                },
                switchPill: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 999,
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    backgroundColor: theme.card,
                },
                switchPillActive: {
                    backgroundColor: theme.text,
                    borderColor: theme.text,
                },
                switchText: {
                    fontSize: 14,
                    fontWeight: '600',
                    color: theme.text,
                },
                switchTextActive: {
                    color: theme.background,
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
                listCard: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 14,
                    padding: 14,
                    backgroundColor: theme.card,
                },
                listRow: {
                    fontSize: 18,
                    marginBottom: 10,
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
                emptyText: {
                    fontSize: 15,
                    color: theme.mutedText,
                },
            }),
        [theme]
    );

    const [selectedPoll, setSelectedPoll] = useState<PollKey>('LSL');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [top25, setTop25] = useState<Top25Row[]>([]);
    const [next5, setNext5] = useState<Next5Row[]>([]);

    useEffect(() => {
        const loadRankings = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`${API_BASE_URL}/polls/${selectedPoll}?week=0`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const json = await response.json();
                setTop25(json?.top25 ?? []);
                setNext5(json?.next5 ?? []);
            } catch (err: any) {
                setError(err?.message ?? 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        loadRankings();
    }, [selectedPoll]);

    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.screenTitle}>Rankings</Text>

            <View style={styles.switcherRow}>
                <Pressable
                    onPress={() => setSelectedPoll('LSL')}
                    style={[styles.switchPill, selectedPoll === 'LSL' && styles.switchPillActive]}>
                    <Text style={[styles.switchText, selectedPoll === 'LSL' && styles.switchTextActive]}>
                        LSL Poll
                    </Text>
                </Pressable>

                <Pressable
                    onPress={() => setSelectedPoll('LCAA')}
                    style={[styles.switchPill, selectedPoll === 'LCAA' && styles.switchPillActive]}>
                    <Text style={[styles.switchText, selectedPoll === 'LCAA' && styles.switchTextActive]}>
                        LCAA Poll
                    </Text>
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.centerBlock}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.helper}>Loading rankings...</Text>
                </View>
            ) : error ? (
                <View style={styles.listCard}>
                    <Text style={styles.errorTitle}>Error</Text>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : (
                <>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Top 25</Text>
                        <View style={styles.listCard}>
                            {top25.length === 0 ? (
                                <Text style={styles.emptyText}>No Top 25 rankings available.</Text>
                            ) : (
                                top25.map((row) => (
                                    <Text key={row.team_id} style={styles.listRow}>
                                        {row.rank}. {row.team_name}
                                    </Text>
                                ))
                            )}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Next 5</Text>
                        <View style={styles.listCard}>
                            {next5.length === 0 ? (
                                <Text style={styles.emptyText}>No Next 5 teams available.</Text>
                            ) : (
                                next5.map((row) => (
                                    <Text key={row.team_id} style={styles.listRow}>
                                        {row.order}. {row.team_name}
                                    </Text>
                                ))
                            )}
                        </View>
                    </View>
                </>
            )}
        </ScrollView>
    );
}