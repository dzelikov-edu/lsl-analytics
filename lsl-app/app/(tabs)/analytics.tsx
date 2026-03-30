import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { API_BASE_URL } from '@/lib/api';

type LeaderItem = {
    rank?: number | null;
    team_id?: string;
    team_name?: string;
    value?: number | null;
    links?: {
        team?: string;
        analytics?: string;
    };
} | null;

type InsightItem = {
    type?: string;
    title?: string;
    team_id?: string;
    team_name?: string;
    summary?: string;
    value?: number | null;
    links?: {
        team?: string;
        analytics?: string;
    };
};

type TableRow = {
    rank?: number | null;
    team_id?: string;
    team_name?: string;
    value?: number | null;
    tier?: string | null;
};

export default function AnalyticsScreen() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [payload, setPayload] = useState<any>(null);

    useEffect(() => {
        const loadAnalytics = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`${API_BASE_URL}/analytics?week=0`);
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

        loadAnalytics();
    }, []);

    const leaders = payload?.leaders ?? {};
    const featuredInsights: InsightItem[] = payload?.featured_insights ?? [];
    const topTables = payload?.top_tables ?? {};

    const leaderCards = [
        { label: 'Power Leader', item: leaders.power as LeaderItem },
        { label: 'Resume Leader', item: leaders.resume as LeaderItem },
        { label: 'Form Leader', item: leaders.form as LeaderItem },
        { label: 'Toughest Schedule', item: leaders.sos as LeaderItem },
    ];

    const renderLeaderCard = (label: string, item: LeaderItem) => (
        <View key={label} style={styles.card}>
            <Text style={styles.cardLabel}>{label}</Text>
            <Text style={styles.cardTeam}>{item?.team_name ?? '—'}</Text>
            <Text style={styles.cardValue}>
                {item?.rank !== null && item?.rank !== undefined ? `#${item.rank}` : '—'}
                {item?.value !== null && item?.value !== undefined ? ` • ${item.value}` : ''}
            </Text>
        </View>
    );

    const renderPreviewTable = (title: string, rows: TableRow[]) => (
        <View key={title} style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.listCard}>
                {rows.length === 0 ? (
                    <Text style={styles.emptyText}>No data available.</Text>
                ) : (
                    rows.slice(0, 5).map((row, index) => (
                        <Text key={`${row.team_id ?? title}-${index}`} style={styles.listRow}>
                            {row.rank !== null && row.rank !== undefined ? row.rank : index + 1}. {row.team_name}
                            {row.value !== null && row.value !== undefined ? ` • ${row.value}` : ''}
                        </Text>
                    ))
                )}
            </View>
        </View>
    );

    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.screenTitle}>Analytics</Text>

            {loading ? (
                <View style={styles.centerBlock}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.helper}>Loading analytics...</Text>
                </View>
            ) : error ? (
                <View style={styles.listCard}>
                    <Text style={styles.errorTitle}>Error</Text>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : (
                <>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Leaders</Text>
                        {leaderCards.map(({ label, item }) => renderLeaderCard(label, item))}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Featured Insights</Text>
                        <View style={styles.listCard}>
                            {featuredInsights.length === 0 ? (
                                <Text style={styles.emptyText}>No featured insights available.</Text>
                            ) : (
                                featuredInsights.map((insight, index) => (
                                    <View key={`${insight.type ?? 'insight'}-${index}`} style={styles.insightBlock}>
                                        <Text style={styles.insightTitle}>{insight.title ?? 'Insight'}</Text>
                                        <Text style={styles.insightTeam}>{insight.team_name ?? '—'}</Text>
                                        <Text style={styles.insightSummary}>{insight.summary ?? '—'}</Text>
                                        {insight.value !== null && insight.value !== undefined ? (
                                            <Text style={styles.insightValue}>{insight.value}</Text>
                                        ) : null}
                                    </View>
                                ))
                            )}
                        </View>
                    </View>

                    {renderPreviewTable('Power', topTables.power ?? [])}
                    {renderPreviewTable('Resume', topTables.resume ?? [])}
                    {renderPreviewTable('Form', topTables.form ?? [])}
                    {renderPreviewTable('SOS', topTables.sos ?? [])}
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
    section: {
        marginBottom: 24,
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
    sectionTitle: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 12,
    },
    card: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        backgroundColor: '#fafafa',
    },
    cardLabel: {
        fontSize: 14,
        opacity: 0.65,
        marginBottom: 6,
    },
    cardTeam: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 4,
    },
    cardValue: {
        fontSize: 15,
        opacity: 0.75,
    },
    listCard: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 14,
        padding: 14,
        backgroundColor: '#fafafa',
    },
    listRow: {
        fontSize: 16,
        marginBottom: 8,
    },
    insightBlock: {
        marginBottom: 12,
    },
    insightTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    insightTeam: {
        fontSize: 16,
        marginBottom: 2,
    },
    insightSummary: {
        fontSize: 14,
        opacity: 0.75,
        marginBottom: 2,
    },
    insightValue: {
        fontSize: 14,
        fontWeight: '600',
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