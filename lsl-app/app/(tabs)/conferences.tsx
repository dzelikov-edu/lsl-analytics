import ConferenceLogo from '@/components/ConferenceLogo';
import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCachedApi } from '@/hooks/useCachedApi';
import { getConferenceBranding } from '@/lib/conferenceBranding';
import { router } from 'expo-router';
import Head from 'expo-router/head';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ConferenceRow = {
    conference_id: string;
    conference_name: string;
    teams_count?: number;
    week?: number;
    polls?: {
        LSL?: {
            week?: number;
            top25_count?: number;
            next5_count?: number;
        };
    };
};

export default function ConferencesScreen() {
    const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
    const theme = AppColors[colorScheme];
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isCompact = width < 430;
    const topTabPadding = isCompact ? insets.top + 8 : 12;

    const formatConfShortName = (branding: any) => {
        // If we are in realism mode, the headerTitle will be the full name (e.g. Big East)
        // In that case, we want the short ID (the 'conf.conference_id')
        // We will handle this logic in the JSX for maximum precision.
        return branding.headerTitle;
    };

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
                    marginBottom: 18,
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
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 12,
                    backgroundColor: theme.card,
                },
                cardPressed: {
                    opacity: 0.75,
                },
                topRow: {
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                },
                leftSide: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    flex: 1,
                    paddingRight: 12,
                },
                nameBlock: {
                    flex: 1,
                    paddingLeft: 10,
                },
                conferenceName: {
                    fontSize: 21,
                    fontWeight: '800',
                    marginBottom: 2,
                    color: theme.text,
                },
                conferenceId: {
                    fontSize: 12,
                    color: theme.mutedText,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                },
                badge: {
                    minWidth: 58,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.background,
                },
                badgeText: {
                    fontSize: 13,
                    fontWeight: '800',
                    color: theme.text,
                },
                statsLabel: {
                    fontSize: 12,
                    color: theme.mutedText,
                    marginBottom: 4,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                },
                statsLine: {
                    fontSize: 14,
                    lineHeight: 20,
                    color: theme.text,
                },
                accentBar: {
                    height: 4,
                    width: 56,
                    borderRadius: 999,
                    marginTop: 12,
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
            }),
        [theme, topTabPadding]
    );

    const {
        data: payload,
        loading,
        error,
    } = useCachedApi({
        cacheKey: 'conferences:list',
        endpoint: '/conferences',
        maxAgeMs: 1000 * 60 * 60,
    });

    const conferences: ConferenceRow[] = payload?.conferences ?? [];

    const formatContext = (conf: ConferenceRow) => {
        const top25 = conf?.polls?.LSL?.top25_count ?? 0;
        const next5 = conf?.polls?.LSL?.next5_count ?? 0;

        if (top25 > 0 || next5 > 0) {
            return `Teams: ${conf.teams_count ?? 0} • Top 25: ${top25} • Next 5: ${next5}`;
        }

        return `Teams: ${conf.teams_count ?? 0}`;
    };

    return (
        <>
            <Head>
                <title>Conferences | Legends CBB</title>
            </Head>

            <ScrollView contentContainerStyle={styles.content}>
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
                        The Universe's Conferences
                    </Text>
                </View>

                {loading ? (
                    <View style={styles.centerBlock}>
                        <ActivityIndicator size="large" />
                        <Text style={styles.helper}>Loading conferences...</Text>
                    </View>
                ) : error ? (
                    <View style={styles.card}>
                        <Text style={styles.errorTitle}>Error</Text>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : conferences.length === 0 ? (
                    <View style={styles.card}>
                        <Text style={styles.errorText}>No conferences available.</Text>
                    </View>
                ) : (
                    conferences.map((conf) => {
                        const branding = getConferenceBranding(conf.conference_id, conf.conference_name);

                        return (
                            <Pressable
                                key={conf.conference_id}
                                onPress={() => router.push(`/conference/${conf.conference_id}`)}
                                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
                                <View style={styles.topRow}>
                                    <View style={styles.leftSide}>
                                        <ConferenceLogo confId={conf.conference_id} size={30} />
                                        <View style={styles.nameBlock}>
                                            <Text style={styles.conferenceName}>
                                                {branding.displayName}
                                            </Text>
                                            <Text style={styles.conferenceId}>
                                                {/* Logic: If Realism flipped the title to the full name, show the ID (e.g. SEC). 
                Otherwise show your authored short code (e.g. SAC). */}
                                                {branding.displayName === branding.headerTitle ? conf.conference_id : branding.headerTitle}
                                            </Text>
                                        </View>
                                    </View>

                                    <View
                                        style={[
                                            styles.badge,
                                            {
                                                borderColor: branding.accent,
                                                backgroundColor: theme.card,
                                            },
                                        ]}>
                                        <Text style={[styles.badgeText, { color: theme.text }]}>
                                            {conf.teams_count ?? 0}T
                                        </Text>
                                    </View>
                                </View>

                                <Text style={styles.statsLabel}>Conference Snapshot</Text>
                                <Text style={styles.statsLine}>{formatContext(conf)}</Text>
                                <View style={[styles.accentBar, { backgroundColor: branding.primary }]} />
                            </Pressable>
                        );
                    })
                )}
            </ScrollView>
        </>
    );
}