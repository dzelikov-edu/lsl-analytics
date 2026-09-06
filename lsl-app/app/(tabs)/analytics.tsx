import TeamLogo from '@/components/TeamLogo';
import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCachedApi } from '@/hooks/useCachedApi';
import { getTeamBranding } from '@/lib/teamBranding';
import { useMemo } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, SectionList, StyleSheet, Text, View, useWindowDimensions, Pressable, Image } from 'react-native';
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
    const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
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
                    marginBottom: -10,
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
                    minHeight: 90,
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
        cacheKey: 'analytics:latest',
        endpoint: '/analytics',
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
                    <Text style={styles.cardTeam}>
                        {item?.team_id ? getTeamBranding(item.team_id, item.team_name).displayName : '—'}
                    </Text>
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
                                <Text style={styles.listRow}>
                                    {row.team_id ? getTeamBranding(row.team_id, row.team_name).displayName : '—'}
                                </Text>
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

    // 1. Prepare data into Sections (Slicing to top 5 here for performance)
    const sections = useMemo(() => {
        const list = [];
        const tables = payload?.top_tables ?? {};
        const insightsData = payload?.featured_insights ?? [];

        // 1. Insights (Show placeholder if empty)
        list.push({
            title: 'Featured Insights',
            type: 'INSIGHTS',
            data: insightsData.length > 0 ? insightsData : [{ is_placeholder: true }]
        });

        // 2. Metrics (Always show these 4 sections)
        const metrics = [
            { key: 'power', title: 'Power Rankings' },
            { key: 'resume', title: 'Resume' },
            { key: 'form', title: 'Form' },
            { key: 'sos', title: 'SOS' }
        ];

        metrics.forEach(m => {
            const data = tables[m.key] ?? [];
            list.push({
                title: m.title,
                type: 'TABLE',
                data: data.length > 0 ? data.slice(0, 5) : [{ is_placeholder: true }]
            });
        });

        return list;
    }, [payload]);

    // 2. Unified Render Logic
    const renderSectionItem = ({ item, section, index }: { item: any, section: any, index: number }) => {
        // --- CATCH PLACEHOLDERS ---
        if (item.is_placeholder) {
            return (
                <View style={[styles.listCard, { padding: 16, backgroundColor: theme.card, borderRadius: 14 }]}>
                    <Text style={styles.emptyText}>
                        {section.type === 'INSIGHTS'
                            ? 'No featured insights for this week.'
                            : 'Metrics will compile once the season begins.'}
                    </Text>
                </View>
            );
        }

        // --- RENDER REAL INSIGHTS ---
        if (section.type === 'INSIGHTS') {
            return (
                <View style={[styles.listCard, { marginBottom: 14 }]}>
                    <View style={styles.insightBlock}>
                        <TeamLogo teamId={item.team_id} size={24} />
                        <View style={styles.insightTextWrap}>
                            <Text style={styles.insightTitle}>{item.title ?? 'Insight'}</Text>
                            <Text style={styles.insightTeam}>
                                {item.team_id ? getTeamBranding(item.team_id, item.team_name).displayName : '—'}
                            </Text>
                            <Text style={styles.insightSummary}>{item.summary ?? '—'}</Text>
                            {item.value !== null && item.value !== undefined && (
                                <Text style={styles.insightValue}>{item.value}</Text>
                            )}
                        </View>
                    </View>
                </View>
            );
        }

        /// Table Row logic
        const isFirst = index === 0;
        const isLast = index === section.data.length - 1;

        return (
            <View style={[
                styles.listRowWrap,
                {
                    backgroundColor: theme.card,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderColor: theme.border,
                    // SIDE BORDERS
                    borderLeftWidth: 1,
                    borderRightWidth: 1,
                    // BOTTOM BORDER (On everyone)
                    borderBottomWidth: 1,
                    // TOP BORDER (Only on the very first row of the pod)
                    borderTopWidth: isFirst ? 1 : 0,

                    marginBottom: 0,

                    // RADII
                    borderTopLeftRadius: isFirst ? 14 : 0,
                    borderTopRightRadius: isFirst ? 14 : 0,
                    borderBottomLeftRadius: isLast ? 14 : 0,
                    borderBottomRightRadius: isLast ? 14 : 0,
                }
            ]}>
                <Text style={styles.rankNumber}>{item.rank ?? '—'}.</Text>
                <TeamLogo teamId={item.team_id} size={22} />
                <View style={styles.rowTextWrap}>
                    <Text style={styles.listRow}>
                        {item.team_id ? getTeamBranding(item.team_id, item.team_name).displayName : '—'}
                    </Text>
                    {item.value !== null && item.value !== undefined && (
                        <Text style={styles.listRowValue}>{item.value}</Text>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <SectionList
                sections={sections}
                renderItem={renderSectionItem}
                keyExtractor={(item, index) => `${item.team_id || index}-${index}`}
                contentContainerStyle={[styles.content, { paddingTop: topTabPadding + 2 }]} // Added +2 safety margin
                stickySectionHeadersEnabled={false}
                removeClippedSubviews={true}
                initialNumToRender={10}
                windowSize={5}
                ListHeaderComponent={
                    <>
                        {/* --- BRANDED HEADER --- */}
                        <View style={{ alignItems: 'center', marginBottom: 10, marginTop: 8 }}>
                            <Image
                                source={require('@/assets/images/index_header_icon.png')}
                                style={{ width: 140, height: 60 }}
                                resizeMode="contain"
                            />
                            <Text style={{
                                fontSize: 12,
                                fontWeight: '800',
                                color: theme.mutedText,
                                letterSpacing: 2.5,
                                marginTop: 8,
                                textTransform: 'uppercase'
                            }}>
                                The Universe Analytics
                            </Text>
                        </View>

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
                            <View style={[styles.section, { marginBottom: 10 }]}>
                                <Text style={styles.sectionTitle}>Leaders</Text>
                                <View style={styles.leadersGrid}>
                                    {leaderCards.map(({ label, item }) => renderLeaderCard(label, item))}
                                </View>
                            </View>
                        )}
                    </>
                }
                renderSectionHeader={({ section: { title } }) => (
                    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{title}</Text>
                )}
            />
        </View>
    );
}