import TeamLogo from '@/components/TeamLogo';
import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCachedApi } from '@/hooks/useCachedApi';
import { router } from 'expo-router';
import { useMemo, useState, useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
                    fontSize: 18,
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
        cacheKey: `poll:${selectedPoll}:week0`,
        endpoint: `/polls/${selectedPoll}?week=0`,
        maxAgeMs: 1000 * 60 * 30,
    });

    const top25: Top25Row[] = payload?.top25 ?? [];
    const next5: Next5Row[] = payload?.next5 ?? [];

    return (
        <ScrollView
            key={selectedPoll}
            contentContainerStyle={styles.content}
        >

            <Text style={styles.screenTitle}>Rankings</Text>

            <View style={styles.switcherRow}>
                <Pressable
                    onPress={() => {
                        if (selectedPoll !== 'LSL') {
                            setSelectedPoll('LSL');
                        }
                    }}
                    style={[styles.switchPill, selectedPoll === 'LSL' && styles.switchPillActive]}>
                    <Text style={[styles.switchText, selectedPoll === 'LSL' && styles.switchTextActive]}>
                        LSL Poll
                    </Text>
                </Pressable>

                <Pressable
                    onPress={() => {
                        if (selectedPoll !== 'LCAA') {
                            setSelectedPoll('LCAA');
                        }
                    }}
                    style={[styles.switchPill, selectedPoll === 'LCAA' && styles.switchPillActive]}>
                    <Text style={[styles.switchText, selectedPoll === 'LCAA' && styles.switchTextActive]}>
                        LCAA Poll
                    </Text>
                </Pressable>
            </View>

            {(loading || !payload) && !error ? (
                <View style={styles.centerBlock}>
                    <ActivityIndicator size="large" color={theme.text} />
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
                                    <Pressable
                                        key={row?.team_id}
                                        onPress={() =>
                                            router.push({
                                                pathname: '/team/[teamId]',
                                                params: { teamId: row?.team_id },
                                            })
                                        }
                                        style={({ pressed }) => [styles.listRowWrap, pressed && styles.listRowPressed]}>
                                        <Text style={styles.rankNumber}>{row?.rank}.</Text>
                                        <TeamLogo teamId={row?.team_id} size={24} />
                                        <View style={styles.rowTextWrap}>
                                            <Text style={styles.listRow}>{row?.team_name}</Text>
                                        </View>
                                    </Pressable>
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
                                    <Pressable
                                        key={row?.team_id}
                                        onPress={() =>
                                            router.push({
                                                pathname: '/team/[teamId]',
                                                params: { teamId: row?.team_id },
                                            })
                                        }
                                        style={({ pressed }) => [styles.listRowWrap, pressed && styles.listRowPressed]}>
                                        <Text style={styles.rankNumber}>{row?.order}.</Text>
                                        <TeamLogo teamId={row?.team_id} size={24} />
                                        <View style={styles.rowTextWrap}>
                                            <Text style={styles.listRow}>{row?.team_name}</Text>
                                        </View>
                                    </Pressable>
                                ))
                            )}
                        </View>
                    </View>
                </>
            )}
        </ScrollView>
    );
}