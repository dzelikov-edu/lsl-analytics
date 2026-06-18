import TeamLogo from '@/components/TeamLogo';
import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCachedApi } from '@/hooks/useCachedApi';
import { getTeamBranding } from '@/lib/teamBranding';
import { router } from 'expo-router';
import { useMemo, useState, useEffect } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View, useWindowDimensions, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
                listRowWrap: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 10,
                },
                listRowPressed: {
                    opacity: 0.7,
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

    const [selectedPoll, setSelectedPoll] = useState<PollKey>('LSL');

    const {
        data: payload,
        loading,
        error,
    } = useCachedApi({
        cacheKey: 'rankings-all-polls-latest-v2', // new key to bust any old cache
        endpoint: '/rankings/polls',          // no week param -> server uses latest
        maxAgeMs: 1000 * 60 * 10,
    });

    console.log('RANKINGS DEBUG - WEEK:', payload?.week, 'CACHE_KEY: v2');

    // The backend uses 'primary' for LSL and 'secondary' for LCAA
    const currentPollData = selectedPoll === 'LSL' ? payload?.primary : payload?.secondary;

    const top25: Top25Row[] = currentPollData?.top25 ?? [];
    const next5: Next5Row[] = currentPollData?.next5 ?? [];

    // 0. Create a unified list for virtualization
    const unifiedRankings = useMemo(() => {
        const list: any[] = top25.map(t => ({ ...t, type: 'TOP25' }));
        if (next5.length > 0) {
            // Insert a special header item for the Next 5 section
            list.push({ type: 'SECTION_HEADER', title: 'Next 5' });
            list.push(...next5.map(n => ({ ...n, type: 'NEXT5' })));
        }
        return list;
    }, [top25, next5]);

    // 1. Group the data into Pods
    const sections = useMemo(() => [
        { title: 'Top 25', data: top25 },
        { title: 'Next 5', data: next5 }
    ], [top25, next5]);

    // 2. The Render Item function (recreates the Pod Row look)
    const renderRankingItem = ({ item, index, section }: { item: any, index: number, section: any }) => {
        const isFirst = index === 0;
        const isLast = index === section.data.length - 1;

        return (
            <Pressable
                onPress={() => router.push({ pathname: '/team/[teamId]', params: { teamId: item.team_id } })}
                style={({ pressed }) => [
                    styles.listRowWrap,
                    {
                        backgroundColor: theme.card,
                        paddingHorizontal: 14,
                        paddingVertical: 6,
                        borderLeftWidth: 1,
                        borderRightWidth: 1,
                        borderColor: theme.border,
                        marginBottom: 0, // Tighten rows
                        // Round the top of the first item in the pod
                        borderTopLeftRadius: isFirst ? 14 : 0,
                        borderTopRightRadius: isFirst ? 14 : 0,
                        borderTopWidth: isFirst ? 1 : 0,
                        // Round the bottom of the last item in the pod
                        borderBottomLeftRadius: isLast ? 14 : 0,
                        borderBottomRightRadius: isLast ? 14 : 0,
                        borderBottomWidth: isLast ? 1 : 0,
                    },
                    pressed && styles.listRowPressed
                ]}>
                <Text style={styles.rankNumber}>{item.rank || item.order}.</Text>
                <TeamLogo teamId={item.team_id} size={24} />
                <View style={styles.rowTextWrap}>
                    <Text style={styles.listRow}>
                        {getTeamBranding(item.team_id, item.team_name).displayName}
                    </Text>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <SectionList
                sections={sections}
                renderItem={renderRankingItem}
                keyExtractor={(item) => item.team_id}
                contentContainerStyle={styles.content}
                stickySectionHeadersEnabled={false} // Keeps the title scrolling with the pod
                removeClippedSubviews={true}
                initialNumToRender={15}
                renderSectionHeader={({ section: { title, data } }) => (
                    data.length > 0 ? (
                        <Text style={[styles.sectionTitle, { marginTop: title === 'Next 5' ? 24 : 0 }]}>
                            {title}
                        </Text>
                    ) : null
                )}
                ListHeaderComponent={
                    <>
                        {/* --- BRANDED HEADER --- */}
                        <View style={{ alignItems: 'center', marginBottom: 10, marginTop: 10 }}>
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
                                The Universe Rankings
                            </Text>
                        </View>
                        <View style={styles.switcherRow}>
                            <Pressable
                                onPress={() => selectedPoll !== 'LSL' && setSelectedPoll('LSL')}
                                style={[styles.switchPill, selectedPoll === 'LSL' && styles.switchPillActive]}>
                                <Text style={[styles.switchText, selectedPoll === 'LSL' && styles.switchTextActive]}>
                                    LSL Poll
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={() => selectedPoll !== 'LCAA' && setSelectedPoll('LCAA')}
                                style={[styles.switchPill, selectedPoll === 'LCAA' && styles.switchPillActive]}>
                                <Text style={[styles.switchText, selectedPoll === 'LCAA' && styles.switchTextActive]}>
                                    LCAA Poll
                                </Text>
                            </Pressable>
                        </View>

                        {loading && !payload && (
                            <View style={styles.centerBlock}>
                                <ActivityIndicator size="large" color={theme.text} />
                                <Text style={styles.helper}>Loading all rankings...</Text>
                            </View>
                        )}
                        {error && (
                            <View style={styles.listCard}><Text style={styles.errorText}>{error}</Text></View>
                        )}
                    </>
                }
                // Add a small spacer at the bottom of each section/pod
                SectionSeparatorComponent={() => <View style={{ height: 2 }} />}
            />
        </View>
    );
}