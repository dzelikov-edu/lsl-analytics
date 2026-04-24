import TeamLogo from '@/components/TeamLogo';
import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCachedApi } from '@/hooks/useCachedApi';
import { useMemo } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type LeaderItem = {
    rank?: number | null;
    team_id?: string;
    team_name?: string;
    value?: number | null;
} | null;

type InsightItem = {
    title?: string;
    team_id?: string;
    team_name?: string;
    summary?: string;
    value?: number | null;
};

type TableRow = {
    rank?: number | null;
    team_id?: string;
    team_name?: string;
    value?: number | null;
};

export default function AnalyticsScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isCompact = width < 430;
    const topTabPadding = isCompact ? insets.top + 8 : 12;

    const styles = useMemo(
        () =>
            StyleSheet.create({
                content: {
                    paddingHorizontal: 20,
                    paddingTop: topTabPadding,
                    paddingBottom: 40,
                    backgroundColor: theme.background,
                },
                screenTitle: {
                    fontSize: 32,
                    fontWeight: '800',
                    marginBottom: 6,
                    color: theme.text,
                },
                screenSubTitle: {
                    fontSize: 15,
                    color: theme.mutedText,
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
                    color: theme.mutedText,
                    marginTop: 12,
                },
                sectionTitle: {
                    fontSize: 22,
                    fontWeight: '700',
                    marginBottom: 12,
                    color: theme.text,
                },
                leadersGrid: {
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                },
                leaderCard: {
                    width: '48.5%',
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 10,
                    backgroundColor: theme.card,
                    minHeight: 118,
                },
                leaderCardPressed: {
                    opacity: 0.75,
                },
                cardLabel: {
                    fontSize: 13,
                    color: theme.mutedText,
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                },
                leaderRow: {
                    flexDirection: 'row',
                    alignItems: 'center',
                },
                leaderTextWrap: {
                    marginLeft: 10,
                    flex: 1,
                },
                cardTeam: {
                    fontSize: 18,
                    fontWeight: '700',
                    marginBottom: 3,
                    color: theme.text,
                },
                cardValue: {
                    fontSize: 14,
                    color: theme.mutedText,
                },
                listCard: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 14,
                    padding: 14,
                    backgroundColor: theme.card,
                },
                listRowWrap: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 10,
                },
                rankNumber: {
                    width: 34,
                    fontSize: 16,
                    fontWeight: '800',
                    color: theme.text,
                    textAlign: 'right',
                    marginRight: 8,
                },
                rowTextWrap: {
                    marginLeft: 10,
                    flex: 1,
                },
                listRow: {
                    fontSize: 16,
                    fontWeight: '700',
                    color: theme.text,
                },
                listRowValue: {
                    fontSize: 13,
                    color: theme.mutedText,
                    marginTop: 2,
                },
                insightBlock: {
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    marginBottom: 14,
                },
                insightTextWrap: {
                    marginLeft: 10,
                    flex: 1,
                },
                insightTitle: {
                    fontSize: 16,
                    fontWeight: '700',
                    marginBottom: 3,
                    color: theme.text,
                },
                insightTeam: {
                    fontSize: 15,
                    marginBottom: 2,
                    color: theme.text,
                },
                insightSummary: {
                    fontSize: 14,
                    color: theme.mutedText,
                    marginBottom: 2,
                },
                insightValue: {
                    fontSize: 14,
                    fontWeight: '600',
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
        [theme, topTabPadding]
    );

    const {
        data: payload,
        loading,
        error,
    } = useCachedApi({
        cacheKey: 'analytics:week0',
        endpoint: '/analytics?week=0',
        maxAgeMs: 1000 * 60 * 30,
    });

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
        <Pressable
            key={label}
            style={({ pressed }) => [
                styles.leaderCard,
                pressed && styles.leaderCardPressed,
            ]}
            onPress={() => {
                if (!item?.team_id) return;
                router.push(`/team/${item.team_id}`);
            }}
        >
            <Text style={styles.cardLabel}>{label}</Text>
            <View style={styles.leaderRow}>
                <TeamLogo teamId={item?.team_id} size={28} />
                <View style={styles.leaderTextWrap}>
                    <Text style={styles.cardTeam}>{item?.team_name ?? '—'}</Text>
                    <Text style={styles.cardValue}>
                        {item?.rank !== null && item?.rank !== undefined ? `#${item.rank}` : '—'}
                        {item?.value !== null && item?.value !== undefined ? ` • ${item.value}` : ''}
                    </Text>
                </View>
            </View>
        </Pressable>
    );

    const renderPreviewTable = (title: string, rows: TableRow[]) => (
        <View key={title} style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.listCard}>
                {rows.length === 0 ? (
                    <Text style={styles.emptyText}>No data available.</Text>
                ) : (
                    rows.slice(0, 5).map((row, index) => (
                        <View key={`${row.team_id ?? title}-${index}`} style={styles.listRowWrap}>
                            <Text style={styles.rankNumber}>
                                {row.rank !== null && row.rank !== undefined ? row.rank : index + 1}.
                            </Text>
                            <TeamLogo teamId={row.team_id} size={22} />
                            <View style={styles.rowTextWrap}>
                                <Text style={styles.listRow}>{row.team_name ?? '—'}</Text>
                                {row.value !== null && row.value !== undefined ? (
                                    <Text style={styles.listRowValue}>{row.value}</Text>
                                ) : null}
                            </View>
                        </View>
                    ))
                )}
            </View>
        </View>
    );

    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.screenTitle}>Analytics</Text>
            <Text style={styles.screenSubTitle}>League-wide leaders, signals, and top metric tables</Text>

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
                        <View style={styles.leadersGrid}>
                            {leaderCards.map(({ label, item }) => renderLeaderCard(label, item))}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Featured Insights</Text>
                        <View style={styles.listCard}>
                            {featuredInsights.length === 0 ? (
                                <Text style={styles.emptyText}>No featured insights available.</Text>
                            ) : (
                                featuredInsights.map((insight, index) => (
                                    <View key={`${insight.title ?? 'insight'}-${index}`} style={styles.insightBlock}>
                                        <TeamLogo teamId={insight.team_id} size={24} />
                                        <View style={styles.insightTextWrap}>
                                            <Text style={styles.insightTitle}>{insight.title ?? 'Insight'}</Text>
                                            <Text style={styles.insightTeam}>{insight.team_name ?? '—'}</Text>
                                            <Text style={styles.insightSummary}>{insight.summary ?? '—'}</Text>
                                            {insight.value !== null && insight.value !== undefined ? (
                                                <Text style={styles.insightValue}>{insight.value}</Text>
                                            ) : null}
                                        </View>
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