import TeamLogo from '@/components/TeamLogo';
import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCachedApi } from '@/hooks/useCachedApi';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getToken } from '@/lib/auth-storage';
import { API_BASE_URL } from '@/lib/api';

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = AppColors[colorScheme];
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 430;
  const topTabPadding = isCompact ? insets.top + 8 : 12;

  const [favorites, setFavorites] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      const loadFavs = async () => {
        try {
          const token = await getToken();
          if (!token) return;
          const res = await fetch(`${API_BASE_URL}/api/favorites`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setFavorites(data);
          }
        } catch (e) {
          console.log("Error loading favs on home", e);
        }
      };
      loadFavs();
    }, [])
  );

  const featuredCardPadding = isCompact ? 12 : 14;
  const featuredCardRadius = isCompact ? 14 : 16;
  const featuredMetaFontSize = isCompact ? 12 : 13;
  const featuredTeamFontSize = isCompact ? 16 : 17;
  const featuredLogoSize = isCompact ? 22 : 24;
  const featuredRowGap = isCompact ? 6 : 8;
  const featuredTextGap = isCompact ? 8 : 10;

  const upcomingCardPadding = isCompact ? 12 : 14;
  const upcomingCardRadius = isCompact ? 14 : 16;
  const upcomingDateFontSize = isCompact ? 16 : 17;
  const upcomingGamesMetaFontSize = isCompact ? 12 : 13;
  const upcomingLogoSize = isCompact ? 20 : 22;
  const upcomingGameFontSize = isCompact ? 15 : 16;
  const upcomingBlockGap = isCompact ? 6 : 10;
  const upcomingRowGap = isCompact ? 4 : 6;
  const upcomingTextGap = isCompact ? 8 : 10;

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
        sectionTitle: {
          fontSize: 22,
          fontWeight: '700',
          marginBottom: 12,
          color: theme.text,
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
        featuredCard: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: featuredCardRadius,
          padding: featuredCardPadding,
          marginBottom: 10,
          backgroundColor: theme.card,
        },
        featuredCardMeta: {
          fontSize: featuredMetaFontSize,
          color: theme.mutedText,
          marginBottom: isCompact ? 8 : 10,
        },
        featuredTeamRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: featuredRowGap,
        },
        featuredTeamTextWrap: {
          marginLeft: featuredTextGap,
          flex: 1,
        },
        featuredTeamLine: {
          fontSize: featuredTeamFontSize,
          fontWeight: '700',
          color: theme.text,
        },
        cardMeta: {
          fontSize: 13,
          color: theme.mutedText,
          marginBottom: 10,
        },
        cardTitle: {
          fontSize: 17,
          fontWeight: '700',
          marginBottom: 4,
          color: theme.text,
        },
        cardTeamRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 8,
        },
        cardTeamTextWrap: {
          marginLeft: 10,
          flex: 1,
        },
        cardTeamLine: {
          fontSize: 17,
          fontWeight: '700',
          color: theme.text,
        },
        rankingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 10,
        },
        rankingRowPressed: {
          opacity: 0.7,
        },
        rankingRank: {
          width: 34,
          fontSize: 15,
          fontWeight: '800',
          color: theme.text,
          textAlign: 'right',
          marginRight: 8,
        },
        rankingTextWrap: {
          marginLeft: 10,
          flex: 1,
        },
        rankingName: {
          fontSize: 15,
          fontWeight: '700',
          color: theme.text,
        },
        leaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        leaderTextWrap: {
          marginLeft: 10,
          flex: 1,
        },
        leaderLabel: {
          fontSize: 13,
          color: theme.mutedText,
          marginBottom: 2,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        },
        leaderName: {
          fontSize: 16,
          fontWeight: '700',
          color: theme.text,
        },
        leaderValue: {
          fontSize: 14,
          color: theme.mutedText,
          marginTop: 2,
        },
        upcomingDayCard: {
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: upcomingCardRadius,
          padding: upcomingCardPadding,
          marginBottom: 12,
          backgroundColor: theme.card,
        },
        upcomingDayTitle: {
          fontSize: upcomingDateFontSize,
          fontWeight: '700',
          marginBottom: 4,
          color: theme.text,
        },
        upcomingDayMeta: {
          fontSize: upcomingGamesMetaFontSize,
          color: theme.mutedText,
          marginBottom: isCompact ? 4 : 6,
        },
        upcomingGameBlock: {
          marginTop: upcomingBlockGap,
        },
        upcomingGameRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: upcomingRowGap,
        },
        upcomingGameTextWrap: {
          marginLeft: upcomingTextGap,
          flex: 1,
        },
        upcomingGameLine: {
          fontSize: upcomingGameFontSize,
          fontWeight: '700',
          color: theme.text,
        },
        dayGameBlock: {
          marginTop: 10,
        },
        dayGameRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 6,
        },
        dayGameTextWrap: {
          marginLeft: 10,
          flex: 1,
        },
        dayGameLine: {
          fontSize: 16,
          fontWeight: '700',
          color: theme.text,
        },
        body: {
          fontSize: 15,
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
      }),
    [theme, topTabPadding, isCompact]
  );

  const {
    data: payload,
    loading,
    refreshing,
    error,
    refetch,
  } = useCachedApi({
    cacheKey: 'home-data',
    endpoint: '/home',
    maxAgeMs: 1000 * 60 * 10,
  });

  const featuredGames = payload?.featured_games?.games ?? [];
  const rankings = payload?.rankings_preview?.rankings ?? [];
  const analytics = payload?.analytics_preview?.leaders ?? {};
  const calendarDays = payload?.calendar_preview?.days ?? [];

  const myTeamsSnapshot = useMemo(() => {
    if (favorites.length === 0 || !calendarDays) return [];

    const snapshot: any[] = [];

    favorites.forEach(favId => {
      const tid = String(favId).toUpperCase();
      let upcomingGame: any = null;
      let lastResult: any = null;

      for (const day of calendarDays) {
        const game = day.games?.find((g: any) =>
          String(g.home_id).toUpperCase() === tid ||
          String(g.away_id).toUpperCase() === tid
        );

        if (game) {
          // --- BULLETPROOF CHECK ---
          // A game is ONLY a result if both scores are numbers and NOT null/undefined
          const hasScoreA = game.a_score !== null && game.a_score !== undefined;
          const hasScoreB = game.b_score !== null && game.b_score !== undefined;
          const isPlayed = hasScoreA && hasScoreB;

          if (isPlayed) {
            lastResult = { ...game, display_date: day.display_date, type: 'RESULT' };
          } else {
            upcomingGame = { ...game, display_date: day.display_date, type: 'UPCOMING' };
            // If we found an actual upcoming game, stop looking
            break;
          }
        }
      }

      if (upcomingGame) {
        snapshot.push(upcomingGame);
      } else if (lastResult) {
        snapshot.push(lastResult);
      }
    });

    return snapshot;
  }, [favorites, calendarDays]);


  const getCalendarGamePriority = (game: any) => {
    const homeRank = game?.lsl_rank_home;
    const awayRank = game?.lsl_rank_away;
    const homeNext5 = game?.lsl_next5_home;
    const awayNext5 = game?.lsl_next5_away;

    const homeTop25 = homeRank !== null && homeRank !== undefined;
    const awayTop25 = awayRank !== null && awayRank !== undefined;
    const homeN5 = homeNext5 !== null && homeNext5 !== undefined;
    const awayN5 = awayNext5 !== null && awayNext5 !== undefined;

    const rankedTeamsCount =
      (homeTop25 ? 1 : 0) +
      (awayTop25 ? 1 : 0) +
      (homeN5 ? 1 : 0) +
      (awayN5 ? 1 : 0);

    const bestRankValue = Math.min(
      homeTop25 ? homeRank : 999,
      awayTop25 ? awayRank : 999,
      homeN5 ? 25 + homeNext5 : 999,
      awayN5 ? 25 + awayNext5 : 999
    );

    const combinedRankValue =
      (homeTop25 ? homeRank : homeN5 ? 25 + homeNext5 : 50) +
      (awayTop25 ? awayRank : awayN5 ? 25 + awayNext5 : 50);

    return {
      rankedTeamsCount,
      bestRankValue,
      combinedRankValue,
    };
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refetch}
          tintColor={theme.text}
        />
      }
    >
      {loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="large" />
          <Text style={styles.helper}>Loading home...</Text>
        </View>
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Error</Text>
          <Text style={styles.body}>{error}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.screenTitle}>Legends CBB</Text>
          <Text style={styles.screenSubTitle}>
            League snapshot, featured matchups, rankings, and analytics leaders
          </Text>

          {myTeamsSnapshot.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Teams</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingRight: 20 }}
              >
                {myTeamsSnapshot.map((game, index) => (
                  <Pressable
                    key={index}
                    onPress={() => router.push({
                      pathname: '/game/[gameKey]',
                      params: { gameKey: game.game_key }
                    })}
                    style={({ pressed }) => [
                      styles.card,
                      { width: 260, marginBottom: 0 },
                      pressed && styles.cardPressed
                    ]}
                  >
                    <Text style={styles.cardMeta}>
                      {game.display_date}{game.type === 'RESULT' ? ' • Final' : ''}
                    </Text>

                    {/* AWAY TEAM ROW */}
                    <View style={styles.cardTeamRow}>
                      <TeamLogo teamId={game.away_id} size={20} />
                      <View style={styles.cardTeamTextWrap}>
                        <Text style={styles.cardTeamLine} numberOfLines={1}>
                          {game.lsl_rank_away !== null && game.lsl_rank_away !== undefined
                            ? `#${game.lsl_rank_away} `
                            : ''}
                          {game.away_name}
                        </Text>
                      </View>
                      {/* ONLY RENDER THIS IF IT IS A RESULT */}
                      {game.type === 'RESULT' && (
                        <Text style={[styles.cardTeamLine, { marginLeft: 10, fontWeight: '800' }]}>
                          {game.a_score}
                        </Text>
                      )}
                    </View>

                    {/* HOME TEAM ROW */}
                    <View style={styles.cardTeamRow}>
                      <TeamLogo teamId={game.home_id} size={20} />
                      <View style={styles.cardTeamTextWrap}>
                        <Text style={styles.cardTeamLine} numberOfLines={1}>
                          {game.lsl_rank_home !== null && game.lsl_rank_home !== undefined
                            ? `#${game.lsl_rank_home} `
                            : ''}
                          {game.home_name}
                        </Text>
                      </View>
                      {/* ONLY RENDER THIS IF IT IS A RESULT */}
                      {game.type === 'RESULT' && (
                        <Text style={[styles.cardTeamLine, { marginLeft: 10, fontWeight: '800' }]}>
                          {game.b_score}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Featured Games</Text>
            {featuredGames.map((game: any, index: number) => (
              <Pressable
                key={game.game_key ?? index}
                onPress={() =>
                  router.push({
                    pathname: '/game/[gameKey]',
                    params: { gameKey: game.game_key },
                  })
                }
                style={({ pressed }) => [styles.featuredCard, pressed && styles.cardPressed]}>
                <Text style={styles.featuredCardMeta}>
                  {game.display_date || game.date_key || 'TBD'} • {game.phase_display || game.phase || '—'} • Week {game.week ?? '—'}
                </Text>

                <View style={styles.featuredTeamRow}>
                  <TeamLogo teamId={game.away_id} size={featuredLogoSize} />
                  <View style={styles.featuredTeamTextWrap}>
                    <Text style={styles.featuredTeamLine}>
                      {game.lsl_rank_away !== null && game.lsl_rank_away !== undefined
                        ? `#${game.lsl_rank_away} `
                        : ''}
                      {game.away_name || 'Away'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.featuredTeamRow, { marginBottom: 0 }]}>
                  <TeamLogo teamId={game.home_id} size={featuredLogoSize} />
                  <View style={styles.featuredTeamTextWrap}>
                    <Text style={styles.featuredTeamLine}>
                      {game.lsl_rank_home !== null && game.lsl_rank_home !== undefined
                        ? `#${game.lsl_rank_home} `
                        : ''}
                      {game.home_name || 'Home'}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rankings</Text>
            <View style={styles.card}>
              {rankings.slice(0, 10).map((team: any, index: number) => (
                <Pressable
                  key={team.team_id ?? index}
                  onPress={() =>
                    router.push({
                      pathname: '/team/[teamId]',
                      params: { teamId: team.team_id },
                    })
                  }
                  style={({ pressed }) => [styles.rankingRow, pressed && styles.rankingRowPressed]}>
                  <Text style={styles.rankingRank}>
                    {team.rank ?? index + 1}.
                  </Text>
                  <TeamLogo teamId={team.team_id} size={22} />
                  <View style={styles.rankingTextWrap}>
                    <Text style={styles.rankingName}>{team.team_name}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Analytics</Text>
            <View style={styles.card}>
              <View style={styles.leaderRow}>
                <TeamLogo teamId={analytics?.power?.team_id} size={26} />
                <View style={styles.leaderTextWrap}>
                  <Text style={styles.leaderLabel}>Power Leader</Text>
                  <Text style={styles.leaderName}>
                    {analytics?.power?.team_name ?? '—'}
                  </Text>
                  <Text style={styles.leaderValue}>
                    {analytics?.power?.rank !== null && analytics?.power?.rank !== undefined
                      ? `#${analytics.power.rank}`
                      : '—'}
                    {analytics?.power?.value !== null && analytics?.power?.value !== undefined
                      ? ` • ${analytics.power.value}`
                      : ''}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Schedule</Text>
            {calendarDays.map((day: any, index: number) => (
              <View key={day.date_key ?? index} style={styles.upcomingDayCard}>
                <Text style={styles.upcomingDayTitle}>
                  {day.display_date || day.date_key || 'TBD'}
                </Text>
                <Text style={styles.upcomingDayMeta}>{day.games_count ?? 0} games</Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingTop: 4, paddingBottom: 2 }}
                >
                  {[...(day.games ?? [])]
                    .sort((a: any, b: any) => {
                      const pa = getCalendarGamePriority(a);
                      const pb = getCalendarGamePriority(b);

                      if (pb.rankedTeamsCount !== pa.rankedTeamsCount) {
                        return pb.rankedTeamsCount - pa.rankedTeamsCount;
                      }

                      if (pa.bestRankValue !== pb.bestRankValue) {
                        return pa.bestRankValue - pb.bestRankValue;
                      }

                      if (pa.combinedRankValue !== pb.combinedRankValue) {
                        return pa.combinedRankValue - pb.combinedRankValue;
                      }

                      return 0;
                    })
                    // NOTE: removed .slice(0, 3) so we see all games
                    .map((game: any, gameIndex: number) => (
                      <Pressable
                        key={game.game_key ?? gameIndex}
                        onPress={() =>
                          router.push({
                            pathname: '/game/[gameKey]',
                            params: { gameKey: game.game_key },
                          })
                        }
                        style={({ pressed }) => [
                          styles.upcomingGameBlock,
                          { width: 220, marginRight: 10 }, // fixed card width + spacing
                          pressed && styles.cardPressed,
                        ]}
                      >
                        <View style={styles.upcomingGameRow}>
                          <TeamLogo teamId={game.away_id} size={upcomingLogoSize} />
                          <View style={styles.upcomingGameTextWrap}>
                            <Text style={styles.upcomingGameLine}>
                              {game.lsl_rank_away !== null && game.lsl_rank_away !== undefined
                                ? `#${game.lsl_rank_away} `
                                : ''}
                              {game.away_name || 'Away'}
                            </Text>
                          </View>
                        </View>

                        <View style={[styles.upcomingGameRow, { marginBottom: 0 }]}>
                          <TeamLogo teamId={game.home_id} size={upcomingLogoSize} />
                          <View style={styles.upcomingGameTextWrap}>
                            <Text style={styles.upcomingGameLine}>
                              {game.lsl_rank_home !== null && game.lsl_rank_home !== undefined
                                ? `#${game.lsl_rank_home} `
                                : ''}
                              {game.home_name || 'Home'}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    ))}
                </ScrollView>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}