import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { API_BASE_URL } from '@/lib/api';

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
                    style={[
                        styles.switchPill,
                        selectedPoll === 'LSL' && styles.switchPillActive,
                    ]}>
                    <Text
                        style={[
                            styles.switchText,
                            selectedPoll === 'LSL' && styles.switchTextActive,
                        ]}>
                        LSL Poll
                    </Text>
                </Pressable>

                <Pressable
                    onPress={() => setSelectedPoll('LCAA')}
                    style={[
                        styles.switchPill,
                        selectedPoll === 'LCAA' && styles.switchPillActive,
                    ]}>
                    <Text
                        style={[
                            styles.switchText,
                            selectedPoll === 'LCAA' && styles.switchTextActive,
                        ]}>
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

const styles = StyleSheet.create({
    content: {
        padding: 20,
        paddingBottom: 40,
        backgroundColor: '#fff',
    },
    screenTitle: {
        fontSize: 32,
        fontWeight: '800',
        marginBottom: 20,
    },
    switcherRow: {
        flexDirection: 'row',
        marginBottom: 18,
        gap: 10,
    },
    switchPill: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 999,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#f4f4f4',
    },
    switchPillActive: {
        backgroundColor: '#111',
        borderColor: '#111',
    },
    switchText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    switchTextActive: {
        color: '#fff',
    },
    section: {
        marginBottom: 18,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 10,
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
    listCard: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 14,
        padding: 14,
        backgroundColor: '#fafafa',
    },
    listRow: {
        fontSize: 18,
        marginBottom: 10,
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    errorText: {
        fontSize: 14,
        opacity: 0.75,
    },
    emptyText: {
        fontSize: 15,
        opacity: 0.7,
    },
});