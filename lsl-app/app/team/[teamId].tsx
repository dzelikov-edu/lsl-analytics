import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { API_BASE_URL } from '@/lib/api';

export default function TeamDetailScreen() {
    const { teamId } = useLocalSearchParams<{ teamId: string }>();

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
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Error</Text>
                    <Text style={styles.body}>{error}</Text>
                </View>
            ) : !team ? (
                <View style={styles.card}>
                    <Text style={styles.body}>No team data available.</Text>
                </View>
            ) : (
                <>
                    <View style={styles.header}>
                        <Text style={styles.teamName}>{team.team_name}</Text>
                        <Text style={styles.pollLine}>
                            LSL: {formatPollValue(lslRank, lslNext5)} • LCAA: {formatPollValue(lcaaRank, lcaaNext5)}
                        </Text>
                        <Text style={styles.statusLine}>
                            Players: {team?.roster_summary?.players_count ?? 0}
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Analytics</Text>

                        {analyticsCards.map((entry) => (
                            <View key={entry.label} style={styles.card}>
                                <Text style={styles.metricLabel}>{entry.label}</Text>
                                <Text style={styles.metricValue}>{formatMetricValue(entry.item)}</Text>
                                <Text style={styles.metricTier}>
                                    {entry.item?.tier ? `Tier: ${entry.item.tier}` : 'Tier: —'}
                                </Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Available Sections</Text>
                        <View style={styles.card}>
                            <Text style={styles.listRow}>Overview</Text>

                            <Pressable
                                onPress={() => router.push(`/team/${teamId}/schedule`)}
                                style={({ pressed }) => [pressed && styles.rowPressed]}>
                                <Text style={[styles.listRow, styles.linkRow]}>Schedule</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => router.push(`/team/${teamId}/results`)}
                                style={({ pressed }) => [pressed && styles.rowPressed]}>
                                <Text style={[styles.listRow, styles.linkRow]}>Results</Text>
                            </Pressable>
                            <Text style={styles.listRow}>Analytics</Text>

                            <Pressable
                                onPress={() => router.push(`/team/${teamId}/roster`)}
                                style={({ pressed }) => [pressed && styles.rowPressed]}>
                                <Text style={[styles.listRow, styles.linkRow]}>Roster</Text>
                            </Pressable>
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
    header: {
        marginBottom: 24,
    },
    teamName: {
        fontSize: 32,
        fontWeight: '800',
        marginBottom: 6,
    },
    pollLine: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    statusLine: {
        fontSize: 14,
        opacity: 0.7,
    },
    section: {
        marginBottom: 14,
    },
    card: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
        backgroundColor: '#fafafa',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 10,
    },
    metricLabel: {
        fontSize: 14,
        opacity: 0.65,
        marginBottom: 6,
    },
    metricValue: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 4,
    },
    metricTier: {
        fontSize: 14,
        opacity: 0.75,
    },
    listRow: {
        fontSize: 16,
        marginBottom: 8,
    },
    linkRow: {
        textDecorationLine: 'underline',
    },
    rowPressed: {
        opacity: 0.7,
    },
    body: {
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'monospace',
    },
});