import ConferenceLogo from '@/components/ConferenceLogo';
import TeamLogo from '@/components/TeamLogo';
import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCachedApi } from '@/hooks/useCachedApi';
import { getConferenceBranding } from '@/lib/conferenceBranding';
import { getTeamBranding } from '@/lib/teamBranding';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ConferenceDetailScreen() {
    const { confId } = useLocalSearchParams<{ confId: string }>();
    const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
    const theme = AppColors[colorScheme];

    // 1. Fetch the data first
    const {
        data: conference,
        loading,
        error,
    } = useCachedApi({
        cacheKey: `conference:${confId}:detail`,
        endpoint: `/conferences/${confId}`,
        maxAgeMs: 1000 * 60 * 30,
        enabled: !!confId,
    });

    // 2. Derive branding based on whether data has arrived or not
    const branding = getConferenceBranding(confId, conference?.conf_name || conference?.conference_name);
    const conferenceName = branding.displayName;
    // Logic: Use the 3-letter ID (confId) for the top bar in Realism mode, 
    // otherwise use your authored short code (MPC).
    const headerTitle = branding.displayName === branding.headerTitle ? confId : (branding.headerTitle || 'Conference');

    const styles = useMemo(
        () =>
            StyleSheet.create({
                content: {
                    padding: 20,
                    paddingTop: 12,
                    paddingBottom: 40,
                    backgroundColor: theme.background,
                },
                heroCard: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 18,
                    padding: 16,
                    marginBottom: 20,
                    backgroundColor: theme.card,
                },
                heroTopRow: {
                    flexDirection: 'row',
                    alignItems: 'center',
                },
                heroLogoWrap: {
                    marginRight: 12,
                },
                heroTextWrap: {
                    flex: 1,
                },
                conferenceName: {
                    fontSize: 28,
                    fontWeight: '800',
                    marginBottom: 4,
                    color: theme.text,
                },
                heroSubLine: {
                    fontSize: 15,
                    color: theme.mutedText,
                },
                heroMetaLine: {
                    fontSize: 14,
                    color: theme.mutedText,
                    marginTop: 10,
                },
                accentBar: {
                    height: 4,
                    width: 64,
                    borderRadius: 999,
                    backgroundColor: branding.primary, // Uses the color from branding
                    marginTop: 12,
                },
                section: {
                    marginBottom: 14,
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
                card: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 14,
                    backgroundColor: theme.card,
                },
                context: {
                    fontSize: 15,
                    color: theme.mutedText,
                },
                rowWrap: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 12,
                },
                rowPressable: {
                    borderRadius: 12,
                },
                rowPressed: {
                    opacity: 0.75,
                },
                rankNumber: {
                    width: 32,
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
                teamName: {
                    fontSize: 17,
                    fontWeight: '700',
                    color: theme.text,
                },
                rowMeta: {
                    fontSize: 13,
                    color: theme.mutedText,
                    marginTop: 2,
                },
                errorTitle: {
                    fontSize: 20,
                    fontWeight: '700',
                    marginBottom: 10,
                    color: theme.text,
                },
            }),
        [theme, branding] // Re-run styles when branding (colors) change
    );

    const standings = conference?.standings ?? conference?.teams ?? [];

    const formatRecord = (row: any) => {
        const conf = row?.conference;
        const overall = row?.overall;
        const confText = conf && conf.wins !== undefined ? `${conf.wins}-${conf.losses}` : null;
        const overallText = overall && overall.wins !== undefined ? `${overall.wins}-${overall.losses}` : null;

        if (confText && overallText) return `Conf ${confText} • Overall ${overallText}`;
        if (confText) return `Conf ${confText}`;
        if (overallText) return `Overall ${overallText}`;
        return null;
    };

    const teamsCount = conference?.teams_count ?? conference?.summary?.teams_count ?? standings.length;
    const lslTop25Count = conference?.polls?.LSL?.top25_count ?? 0;
    const lslNext5Count = conference?.polls?.LSL?.next5_count ?? 0;

    return (
        <ScrollView contentContainerStyle={styles.content}>
            {loading ? (
                <View style={styles.centerBlock}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.helper}>Loading conference...</Text>
                </View>
            ) : error ? (
                <View style={styles.card}>
                    <Text style={styles.errorTitle}>Error</Text>
                    <Text style={styles.context}>{error}</Text>
                </View>
            ) : !conference ? (
                <View style={styles.card}>
                    <Text style={styles.context}>No conference data available.</Text>
                </View>
            ) : (
                <>
                    <Stack.Screen options={{ title: headerTitle }} />

                    <View style={styles.heroCard}>
                        <View style={styles.heroTopRow}>
                            <View style={styles.heroLogoWrap}>
                                <ConferenceLogo confId={confId} size={48} />
                            </View>
                            <View style={styles.heroTextWrap}>
                                <Text style={styles.conferenceName}>{conferenceName}</Text>
                                <Text style={styles.heroSubLine}>Conference Detail</Text>
                            </View>
                        </View>
                        <Text style={styles.heroMetaLine}>
                            Teams: {teamsCount}
                            {lslTop25Count || lslNext5Count ? ` • LSL Top 25: ${lslTop25Count} • Next 5: ${lslNext5Count}` : ''}
                        </Text>
                        <View style={styles.accentBar} />
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Standings</Text>
                        <View style={styles.card}>
                            {standings.length === 0 ? (
                                <Text style={styles.context}>No standings available.</Text>
                            ) : (
                                standings.map((row: any, index: number) => (
                                    <Pressable
                                        key={`${row.team_id ?? row.team_name}-${index}`}
                                        onPress={() => row.is_tracked && router.push({ pathname: '/team/[teamId]', params: { teamId: row.team_id } })}
                                        style={({ pressed }) => [styles.rowWrap, row.is_tracked && styles.rowPressable, pressed && row.is_tracked && styles.rowPressed]}>
                                        <Text style={styles.rankNumber}>{index + 1}.</Text>
                                        <TeamLogo teamId={row.team_id} size={24} />
                                        <View style={styles.rowTextWrap}>
                                            <Text style={styles.teamName}>
                                                {row?.polls?.LSL?.rank !== null && row?.polls?.LSL?.rank !== undefined ? `#${row.polls.LSL.rank} ` : ''}
                                                {getTeamBranding(row.team_id, row.team_name).displayName}
                                            </Text>
                                            {formatRecord(row) && <Text style={styles.rowMeta}>{formatRecord(row)}</Text>}
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
