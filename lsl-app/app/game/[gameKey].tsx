import TeamLogo from '@/components/TeamLogo';
import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCachedApi } from '@/hooks/useCachedApi';
import { getTeamBranding } from '@/lib/teamBranding';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';

type Leader = {
    player_id?: string;
    player_name?: string;
    jersey_number?: string;
    primary_position?: string;
    value?: number | null;
} | null;

type TeamPreview = {
    team_id?: string;
    team_name?: string;
    conference_id?: string | null;
    conference_name?: string | null;
    record?: {
        overall_record?: string;
        conference_record?: string;
    };
    polls?: {
        LSL?: {
            rank?: number | null;
            next5_order?: number | null;
        };
        LCAA?: {
            rank?: number | null;
            next5_order?: number | null;
        };
    };
    analytics?: {
        power?: { rank?: number | null; value?: number | null; tier?: string | null } | null;
        resume?: { rank?: number | null; value?: number | null; tier?: string | null } | null;
        form?: { rank?: number | null; value?: number | null; tier?: string | null } | null;
        sos?: { rank?: number | null; value?: number | null; tier?: string | null } | null;
    };
    leaders?: {
        ppg?: Leader;
        rpg?: Leader;
        apg?: Leader;
        spg?: Leader;
    };
};

export default function GamePreviewScreen() {
    const { gameKey } = useLocalSearchParams<{ gameKey: string }>();
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];
    const { width } = useWindowDimensions();

    const isCompact = width < 430;
    const isTablet = width >= 900;

    const pagePadding = isCompact ? 14 : isTablet ? 24 : 20;
    const heroHorizontalPadding = isCompact ? 14 : isTablet ? 22 : 18;
    const heroTopPadding = isCompact ? 12 : 14;
    const heroBottomPadding = isCompact ? 14 : 18;

    const heroLogoSize = isCompact ? 52 : isTablet ? 72 : 64;
    const heroNameFontSize = isCompact ? 15 : isTablet ? 20 : 18;
    const heroNameLineHeight = isCompact ? 19 : isTablet ? 24 : 22;
    const heroMetaFontSize = isCompact ? 12 : 13;
    const heroSubFontSize = isCompact ? 13 : 14;
    const heroCenterWidth = isCompact ? 42 : isTablet ? 58 : 52;
    const heroCenterFontSize = isCompact ? 12 : isTablet ? 14 : 13;

    const sectionTitleSize = isCompact ? 17 : isTablet ? 22 : 20;
    const compareCenterWidth = isCompact ? 82 : isTablet ? 108 : 98;
    const compareHeaderFontSize = isCompact ? 13 : 14;
    const compareValueFontSize = isCompact ? 14 : isTablet ? 16 : 15;
    const compareRowPaddingX = isCompact ? 10 : 14;
    const compareRowPaddingY = isCompact ? 10 : 12;

    const leaderCenterWidth = isCompact ? 56 : isTablet ? 108 : 98;
    const leaderRowPaddingX = isCompact ? 8 : 14;
    const leaderRowPaddingY = isCompact ? 9 : 12;
    const leaderNameFontSize = isCompact ? 12 : isTablet ? 16 : 15;
    const leaderNameLineHeight = isCompact ? 16 : isTablet ? 22 : 20;
    const leaderCategoryFontSize = isCompact ? 11 : 12;

    const {
        data: game,
        loading,
        error,
    } = useCachedApi({
        cacheKey: `game:${gameKey}:detail`,
        endpoint: `/games/${gameKey}`,
        maxAgeMs: 1000 * 60 * 30,
        enabled: !!gameKey,
    });

    const awayTeam: TeamPreview | null = game?.away_team ?? null;
    const homeTeam: TeamPreview | null = game?.home_team ?? null;

    const formatPoll = (team?: TeamPreview | null) => {
        const rank = team?.polls?.LSL?.rank;
        if (rank !== null && rank !== undefined) return `#${rank}`;
        return null;
    };

    const formatRankedTeamName = (teamId?: string | null, team?: TeamPreview | null) => {
        const rank = formatPoll(team);
        // We pass the team_name from the 'team' object (API data) into branding
        const displayName = getTeamBranding(teamId, team?.team_name).displayName;
        return `${rank ? `${rank} ` : ''}${displayName}`;
    };

    const formatLeader = (leader?: Leader) => {
        if (!leader) return '—';
        const position = leader.primary_position ? ` • ${leader.primary_position}` : '';
        const jersey = leader.jersey_number ? `#${leader.jersey_number} ` : '';
        const value =
            leader.value !== null && leader.value !== undefined ? ` (${leader.value})` : '';
        return `${jersey}${leader.player_name || '—'}${position}${value}`;
    };

    const formatLeaderNameCompact = (leader?: Leader) => {
        if (!leader) return '—';
        const jersey = leader.jersey_number ? `#${leader.jersey_number} ` : '';
        return `${jersey}${leader.player_name || '—'}`;
    };

    const formatLeaderSubCompact = (leader?: Leader) => {
        if (!leader) return '—';

        const parts: string[] = [];
        if (leader.primary_position) parts.push(leader.primary_position);
        if (leader.value !== null && leader.value !== undefined) parts.push(`${leader.value}`);

        return parts.length ? parts.join(' • ') : '—';
    }

    const formatCompareValue = (value?: string | number | null) => {
        if (value === null || value === undefined || value === '') return '—';
        return `${value}`;
    };

    const awayTitleName = formatRankedTeamName(game?.away_id, awayTeam);
    const homeTitleName = formatRankedTeamName(game?.home_id, homeTeam);
    const screenTitle =
        game?.away_id && game?.home_id
            ? `${awayTitleName} ${String(game?.matchup_display || '').includes(' at ') ? 'at' : 'vs'} ${homeTitleName}`
            : game?.matchup_display || 'Game Preview';

    const awayBrand = game?.away_id ? getTeamBranding(game.away_id) : null;
    const homeBrand = game?.home_id ? getTeamBranding(game.home_id) : null;

    const awayColor = awayBrand?.primary || '#334155';
    const homeColor = homeBrand?.primary || '#334155';

    const awayAccentColor = awayBrand?.secondary || awayColor;
    const homeAccentColor = homeBrand?.secondary || homeColor;

    const styles = useMemo(
        () =>
            StyleSheet.create({
                content: {
                    paddingHorizontal: pagePadding,
                    paddingTop: 12,
                    paddingBottom: 40,
                    backgroundColor: theme.background,
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
                heroCard: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 18,
                    paddingHorizontal: heroHorizontalPadding,
                    paddingTop: heroTopPadding,
                    paddingBottom: heroBottomPadding,
                    marginBottom: 18,
                    backgroundColor: theme.card,
                    overflow: 'hidden',
                    position: 'relative',
                },
                heroTintLeft: {
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '46%',
                },
                heroTintRight: {
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: '46%',
                },
                heroAccentLeft: {
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: 4,
                    width: isCompact ? 96 : 110,
                    borderBottomRightRadius: 12,
                },
                heroAccentRight: {
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    height: 4,
                    width: isCompact ? 96 : 110,
                    borderBottomLeftRadius: 12,
                },
                heroTopBand: {
                    minHeight: 26,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: isCompact ? 12 : 14,
                    zIndex: 2,
                },
                heroMeta: {
                    fontSize: heroMetaFontSize,
                    color: theme.mutedText,
                    textAlign: 'center',
                },
                matchupRow: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    zIndex: 2,
                },
                heroTeamSide: {
                    flex: 1,
                    minWidth: 0,
                },
                heroTeamSideLeft: {
                    alignItems: 'flex-start',
                    paddingRight: isCompact ? 8 : 10,
                },
                heroTeamSideRight: {
                    alignItems: 'flex-end',
                    paddingLeft: isCompact ? 8 : 10,
                },
                heroLogoWrap: {
                    marginBottom: 10,
                },
                heroTeamName: {
                    fontSize: heroNameFontSize,
                    lineHeight: heroNameLineHeight,
                    fontWeight: '800',
                    color: theme.text,
                    marginBottom: 4,
                },
                heroTeamNameLeft: {
                    textAlign: 'left',
                },
                heroTeamNameRight: {
                    textAlign: 'right',
                },
                heroTeamSub: {
                    fontSize: heroSubFontSize,
                    color: theme.mutedText,
                },
                heroTeamSubLeft: {
                    textAlign: 'left',
                },
                heroTeamSubRight: {
                    textAlign: 'right',
                },
                matchupCenter: {
                    width: heroCenterWidth,
                    alignItems: 'center',
                    justifyContent: 'center',
                },
                matchupCenterText: {
                    fontSize: heroCenterFontSize,
                    fontWeight: '800',
                    color: theme.mutedText,
                    letterSpacing: 1.2,
                },
                section: {
                    marginBottom: 18,
                },
                sectionTitle: {
                    fontSize: sectionTitleSize,
                    fontWeight: '700',
                    marginBottom: 10,
                    color: theme.text,
                },
                compareCard: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 14,
                    backgroundColor: theme.card,
                    overflow: 'hidden',
                },
                compareHeader: {
                    flexDirection: 'row',
                    paddingHorizontal: compareRowPaddingX,
                    paddingTop: 12,
                    paddingBottom: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                },
                compareColLeft: {
                    flex: 1,
                    paddingRight: 8,
                    minWidth: 0,
                },
                compareColCenter: {
                    width: compareCenterWidth,
                    alignItems: 'center',
                    justifyContent: 'center',
                },
                compareColRight: {
                    flex: 1,
                    paddingLeft: 8,
                    alignItems: 'flex-end',
                    minWidth: 0,
                },
                compareTeamName: {
                    fontSize: compareHeaderFontSize,
                    fontWeight: '700',
                    color: theme.text,
                },
                compareLabelRow: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: compareRowPaddingX,
                    paddingVertical: compareRowPaddingY,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                },
                compareValueLeft: {
                    flex: 1,
                    fontSize: compareValueFontSize,
                    fontWeight: '700',
                    color: theme.text,
                    paddingRight: 8,
                },
                compareLabel: {
                    width: compareCenterWidth,
                    fontSize: leaderCategoryFontSize,
                    textAlign: 'center',
                    color: theme.mutedText,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                },
                compareValueRight: {
                    flex: 1,
                    fontSize: compareValueFontSize,
                    fontWeight: '700',
                    color: theme.text,
                    textAlign: 'right',
                    paddingLeft: 8,
                },
                leadersCard: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 14,
                    backgroundColor: theme.card,
                    overflow: 'hidden',
                },
                leaderRow: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: leaderRowPaddingX,
                    paddingVertical: leaderRowPaddingY,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                },
                leaderSide: {
                    flex: 1,
                    minWidth: 0,
                    paddingRight: 6,
                },
                leaderSideRight: {
                    flex: 1,
                    minWidth: 0,
                    paddingLeft: 6,
                    alignItems: 'flex-end',
                },
                leaderCategory: {
                    width: leaderCenterWidth,
                    fontSize: leaderCategoryFontSize,
                    textAlign: 'center',
                    color: theme.mutedText,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                },
                leaderName: {
                    fontSize: leaderNameFontSize,
                    lineHeight: leaderNameLineHeight,
                    fontWeight: '700',
                    color: theme.text,
                    marginBottom: isCompact ? 2 : 2,
                },
                leaderNameLeft: {
                    textAlign: 'left',
                },
                leaderNameRight: {
                    textAlign: 'right',
                },
                leaderMeta: {
                    fontSize: isCompact ? 11 : 13,
                    lineHeight: isCompact ? 14 : 18,
                    color: theme.mutedText,
                },
                leaderMetaLeft: {
                    textAlign: 'left',
                },
                leaderMetaRight: {
                    textAlign: 'right',
                },
                navCard: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 14,
                    backgroundColor: theme.card,
                    overflow: 'hidden',
                },
                navRow: {
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                },
                navRowLast: {
                    borderBottomWidth: 0,
                },
                navRowPressed: {
                    opacity: 0.7,
                },
                navTitle: {
                    fontSize: 17,
                    fontWeight: '700',
                    color: theme.text,
                    marginBottom: 2,
                },
                navSub: {
                    fontSize: 13,
                    color: theme.mutedText,
                },
                errorCard: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 14,
                    padding: 14,
                    backgroundColor: theme.card,
                },
                errorTitle: {
                    fontSize: 20,
                    fontWeight: '700',
                    marginBottom: 10,
                    color: theme.text,
                },
                body: {
                    fontSize: 14,
                    lineHeight: 20,
                    color: theme.text,
                },
            }),
        [
            theme,
            isCompact,
            isTablet,
            pagePadding,
            heroHorizontalPadding,
            heroTopPadding,
            heroBottomPadding,
            heroMetaFontSize,
            heroLogoSize,
            heroNameFontSize,
            heroNameLineHeight,
            heroSubFontSize,
            heroCenterWidth,
            heroCenterFontSize,
            sectionTitleSize,
            compareCenterWidth,
            compareHeaderFontSize,
            compareValueFontSize,
            compareRowPaddingX,
            compareRowPaddingY,
            leaderCenterWidth,
            leaderRowPaddingX,
            leaderRowPaddingY,
            leaderNameFontSize,
            leaderNameLineHeight,
            leaderCategoryFontSize,
        ]
    );

    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Stack.Screen
                options={{
                    title: screenTitle,
                }}
            />

            {loading ? (
                <View style={styles.centerBlock}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.helper}>Loading game preview...</Text>
                </View>
            ) : error ? (
                <View style={styles.errorCard}>
                    <Text style={styles.errorTitle}>Error</Text>
                    <Text style={styles.body}>{error}</Text>
                </View>
            ) : !game ? (
                <View style={styles.errorCard}>
                    <Text style={styles.body}>No game data available.</Text>
                </View>
            ) : (
                <>
                    <View style={styles.heroCard}>
                        <LinearGradient
                            colors={[awayColor, 'transparent']}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={styles.heroTintLeft}
                        />
                        <LinearGradient
                            colors={[homeColor, 'transparent']}
                            start={{ x: 1, y: 0.5 }}
                            end={{ x: 0, y: 0.5 }}
                            style={styles.heroTintRight}
                        />
                        <View style={[styles.heroAccentLeft, { backgroundColor: awayAccentColor }]} />
                        <View style={[styles.heroAccentRight, { backgroundColor: homeAccentColor }]} />

                        <View style={styles.heroTopBand}>
                            <Text style={styles.heroMeta}>
                                {game.display_date || game.date_key || 'TBD'} • {game.phase_display || game.phase || '—'} • Week {game.week ?? '—'}
                            </Text>
                        </View>

                        <View style={styles.matchupRow}>
                            <View style={[styles.heroTeamSide, styles.heroTeamSideLeft]}>
                                <View style={styles.heroLogoWrap}>
                                    <TeamLogo teamId={game.away_id} size={heroLogoSize} />
                                </View>
                                <Text
                                    numberOfLines={2}
                                    style={[styles.heroTeamName, styles.heroTeamNameLeft]}>
                                    {formatRankedTeamName(game.away_id, awayTeam)}
                                </Text>
                                <Text style={[styles.heroTeamSub, styles.heroTeamSubLeft]}>
                                    {awayTeam?.record?.overall_record || '—'}
                                </Text>
                            </View>

                            <View style={styles.matchupCenter}>
                                <Text style={styles.matchupCenterText}>
                                    {String(game?.matchup_display || '').includes(' at ') ? 'AT' : 'VS'}
                                </Text>
                            </View>

                            <View style={[styles.heroTeamSide, styles.heroTeamSideRight]}>
                                <View style={styles.heroLogoWrap}>
                                    <TeamLogo teamId={game.home_id} size={heroLogoSize} />
                                </View>
                                <Text
                                    numberOfLines={2}
                                    style={[styles.heroTeamName, styles.heroTeamNameRight]}>
                                    {formatRankedTeamName(game.home_id, homeTeam)}
                                </Text>
                                <Text style={[styles.heroTeamSub, styles.heroTeamSubRight]}>
                                    {homeTeam?.record?.overall_record || '—'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Team Comparison</Text>
                        <View style={styles.compareCard}>
                            <View style={styles.compareHeader}>
                                <View style={styles.compareColLeft}>
                                    <Text style={styles.compareTeamName}>{getTeamBranding(game.away_id, game.away_team?.team_name).displayName}</Text>
                                </View>
                                <View style={styles.compareColCenter} />
                                <View style={styles.compareColRight}>
                                    <Text style={styles.compareTeamName}>{getTeamBranding(game.home_id, game.home_team?.team_name).displayName}</Text>
                                </View>
                            </View>

                            <View style={styles.compareLabelRow}>
                                <Text style={styles.compareValueLeft}>
                                    {formatCompareValue(awayTeam?.record?.overall_record)}
                                </Text>
                                <Text style={styles.compareLabel}>Overall</Text>
                                <Text style={styles.compareValueRight}>
                                    {formatCompareValue(homeTeam?.record?.overall_record)}
                                </Text>
                            </View>

                            <View style={styles.compareLabelRow}>
                                <Text style={styles.compareValueLeft}>
                                    {formatCompareValue(awayTeam?.record?.conference_record)}
                                </Text>
                                <Text style={styles.compareLabel}>Conference</Text>
                                <Text style={styles.compareValueRight}>
                                    {formatCompareValue(homeTeam?.record?.conference_record)}
                                </Text>
                            </View>

                            <View style={styles.compareLabelRow}>
                                <Text style={styles.compareValueLeft}>
                                    {formatCompareValue(formatPoll(awayTeam))}
                                </Text>
                                <Text style={styles.compareLabel}>LSL Rank</Text>
                                <Text style={styles.compareValueRight}>
                                    {formatCompareValue(formatPoll(homeTeam))}
                                </Text>
                            </View>

                            <View style={styles.compareLabelRow}>
                                <Text style={styles.compareValueLeft}>
                                    {formatCompareValue(awayTeam?.analytics?.power?.rank ? `#${awayTeam.analytics.power.rank}` : '—')}
                                </Text>
                                <Text style={styles.compareLabel}>Power</Text>
                                <Text style={styles.compareValueRight}>
                                    {formatCompareValue(homeTeam?.analytics?.power?.rank ? `#${homeTeam.analytics.power.rank}` : '—')}
                                </Text>
                            </View>

                            <View style={styles.compareLabelRow}>
                                <Text style={styles.compareValueLeft}>
                                    {formatCompareValue(awayTeam?.analytics?.resume?.rank ? `#${awayTeam.analytics.resume.rank}` : '—')}
                                </Text>
                                <Text style={styles.compareLabel}>Resume</Text>
                                <Text style={styles.compareValueRight}>
                                    {formatCompareValue(homeTeam?.analytics?.resume?.rank ? `#${homeTeam.analytics.resume.rank}` : '—')}
                                </Text>
                            </View>

                            <View style={styles.compareLabelRow}>
                                <Text style={styles.compareValueLeft}>
                                    {formatCompareValue(awayTeam?.analytics?.form?.rank ? `#${awayTeam.analytics.form.rank}` : '—')}
                                </Text>
                                <Text style={styles.compareLabel}>Form</Text>
                                <Text style={styles.compareValueRight}>
                                    {formatCompareValue(homeTeam?.analytics?.form?.rank ? `#${homeTeam.analytics.form.rank}` : '—')}
                                </Text>
                            </View>

                            <View style={[styles.compareLabelRow, { borderBottomWidth: 0 }]}>
                                <Text style={styles.compareValueLeft}>
                                    {formatCompareValue(awayTeam?.analytics?.sos?.rank ? `#${awayTeam.analytics.sos.rank}` : '—')}
                                </Text>
                                <Text style={styles.compareLabel}>SOS</Text>
                                <Text style={styles.compareValueRight}>
                                    {formatCompareValue(homeTeam?.analytics?.sos?.rank ? `#${homeTeam.analytics.sos.rank}` : '—')}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Season Leaders</Text>
                        <View style={styles.leadersCard}>
                            <View style={styles.leaderRow}>
                                <View style={styles.leaderSide}>
                                    {isCompact ? (
                                        <>
                                            <Text style={[styles.leaderName, styles.leaderNameLeft]} numberOfLines={2}>
                                                {formatLeaderNameCompact(awayTeam?.leaders?.ppg)}
                                            </Text>
                                            <Text style={[styles.leaderMeta, styles.leaderMetaLeft]}>
                                                {formatLeaderSubCompact(awayTeam?.leaders?.ppg)}
                                            </Text>
                                        </>
                                    ) : (
                                        <Text style={[styles.leaderName, styles.leaderNameLeft]}>
                                            {formatLeader(awayTeam?.leaders?.ppg)}
                                        </Text>
                                    )}
                                </View>

                                <Text style={styles.leaderCategory}>PPG</Text>

                                <View style={styles.leaderSideRight}>
                                    {isCompact ? (
                                        <>
                                            <Text style={[styles.leaderName, styles.leaderNameRight]} numberOfLines={2}>
                                                {formatLeaderNameCompact(homeTeam?.leaders?.ppg)}
                                            </Text>
                                            <Text style={[styles.leaderMeta, styles.leaderMetaRight]}>
                                                {formatLeaderSubCompact(homeTeam?.leaders?.ppg)}
                                            </Text>
                                        </>
                                    ) : (
                                        <Text style={[styles.leaderName, styles.leaderNameRight]}>
                                            {formatLeader(homeTeam?.leaders?.ppg)}
                                        </Text>
                                    )}
                                </View>
                            </View>

                            <View style={styles.leaderRow}>
                                <View style={styles.leaderSide}>
                                    {isCompact ? (
                                        <>
                                            <Text style={[styles.leaderName, styles.leaderNameLeft]} numberOfLines={2}>
                                                {formatLeaderNameCompact(awayTeam?.leaders?.rpg)}
                                            </Text>
                                            <Text style={[styles.leaderMeta, styles.leaderMetaLeft]}>
                                                {formatLeaderSubCompact(awayTeam?.leaders?.rpg)}
                                            </Text>
                                        </>
                                    ) : (
                                        <Text style={[styles.leaderName, styles.leaderNameLeft]}>
                                            {formatLeader(awayTeam?.leaders?.rpg)}
                                        </Text>
                                    )}
                                </View>

                                <Text style={styles.leaderCategory}>RPG</Text>

                                <View style={styles.leaderSideRight}>
                                    {isCompact ? (
                                        <>
                                            <Text style={[styles.leaderName, styles.leaderNameRight]} numberOfLines={2}>
                                                {formatLeaderNameCompact(homeTeam?.leaders?.rpg)}
                                            </Text>
                                            <Text style={[styles.leaderMeta, styles.leaderMetaRight]}>
                                                {formatLeaderSubCompact(homeTeam?.leaders?.rpg)}
                                            </Text>
                                        </>
                                    ) : (
                                        <Text style={[styles.leaderName, styles.leaderNameRight]}>
                                            {formatLeader(homeTeam?.leaders?.rpg)}
                                        </Text>
                                    )}
                                </View>
                            </View>

                            <View style={styles.leaderRow}>
                                <View style={styles.leaderSide}>
                                    {isCompact ? (
                                        <>
                                            <Text style={[styles.leaderName, styles.leaderNameLeft]} numberOfLines={2}>
                                                {formatLeaderNameCompact(awayTeam?.leaders?.apg)}
                                            </Text>
                                            <Text style={[styles.leaderMeta, styles.leaderMetaLeft]}>
                                                {formatLeaderSubCompact(awayTeam?.leaders?.apg)}
                                            </Text>
                                        </>
                                    ) : (
                                        <Text style={[styles.leaderName, styles.leaderNameLeft]}>
                                            {formatLeader(awayTeam?.leaders?.apg)}
                                        </Text>
                                    )}
                                </View>

                                <Text style={styles.leaderCategory}>APG</Text>

                                <View style={styles.leaderSideRight}>
                                    {isCompact ? (
                                        <>
                                            <Text style={[styles.leaderName, styles.leaderNameRight]} numberOfLines={2}>
                                                {formatLeaderNameCompact(homeTeam?.leaders?.apg)}
                                            </Text>
                                            <Text style={[styles.leaderMeta, styles.leaderMetaRight]}>
                                                {formatLeaderSubCompact(homeTeam?.leaders?.apg)}
                                            </Text>
                                        </>
                                    ) : (
                                        <Text style={[styles.leaderName, styles.leaderNameRight]}>
                                            {formatLeader(homeTeam?.leaders?.apg)}
                                        </Text>
                                    )}
                                </View>
                            </View>

                            <View style={[styles.leaderRow, { borderBottomWidth: 0 }]}>
                                <View style={styles.leaderSide}>
                                    {isCompact ? (
                                        <>
                                            <Text style={[styles.leaderName, styles.leaderNameLeft]} numberOfLines={2}>
                                                {formatLeaderNameCompact(awayTeam?.leaders?.spg)}
                                            </Text>
                                            <Text style={[styles.leaderMeta, styles.leaderMetaLeft]}>
                                                {formatLeaderSubCompact(awayTeam?.leaders?.spg)}
                                            </Text>
                                        </>
                                    ) : (
                                        <Text style={[styles.leaderName, styles.leaderNameLeft]}>
                                            {formatLeader(awayTeam?.leaders?.spg)}
                                        </Text>
                                    )}
                                </View>

                                <Text style={styles.leaderCategory}>SPG</Text>

                                <View style={styles.leaderSideRight}>
                                    {isCompact ? (
                                        <>
                                            <Text style={[styles.leaderName, styles.leaderNameRight]} numberOfLines={2}>
                                                {formatLeaderNameCompact(homeTeam?.leaders?.spg)}
                                            </Text>
                                            <Text style={[styles.leaderMeta, styles.leaderMetaRight]}>
                                                {formatLeaderSubCompact(homeTeam?.leaders?.spg)}
                                            </Text>
                                        </>
                                    ) : (
                                        <Text style={[styles.leaderName, styles.leaderNameRight]}>
                                            {formatLeader(homeTeam?.leaders?.spg)}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Browse Teams</Text>
                        <View style={styles.navCard}>
                            <Pressable
                                onPress={() =>
                                    router.push({
                                        pathname: '/team/[teamId]',
                                        params: { teamId: game.away_id },
                                    })
                                }
                                style={({ pressed }) => [styles.navRow, pressed && styles.navRowPressed]}>
                                <Text style={styles.navTitle}>{getTeamBranding(game.away_id, game.away_team?.team_name).displayName} Team Page</Text>
                                <Text style={styles.navSub}>Open full team detail</Text>
                            </Pressable>

                            <Pressable
                                onPress={() =>
                                    router.push({
                                        pathname: '/team/[teamId]',
                                        params: { teamId: game.home_id },
                                    })
                                }
                                style={({ pressed }) => [styles.navRow, styles.navRowLast, pressed && styles.navRowPressed]}>
                                <Text style={styles.navTitle}>{getTeamBranding(game.home_id, game.home_team?.team_name).displayName} Team Page</Text>
                                <Text style={styles.navSub}>Open full team detail</Text>
                            </Pressable>
                        </View>
                    </View>
                </>
            )}
        </ScrollView>
    );
}