import TeamLogo from '@/components/TeamLogo';
import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCachedApi } from '@/hooks/useCachedApi';
import { getTeamBranding } from '@/lib/teamBranding';
import { Image } from 'react-native'; // Ensure Image is imported
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import Head from 'expo-router/head';
import { getToken } from '@/lib/auth-storage';
import { API_BASE_URL } from '@/lib/api';

export default function HomeScreen() {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = AppColors[colorScheme];
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 430;
  const topTabPadding = isCompact ? insets.top + 8 : 12;

  const [favorites, setFavorites] = useState<string[]>([]);

  // We wrap the entire logic in useCallback with [] so it only creates ONCE
  const loadFavs = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/api/favorites`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // ONLY update state if the data is actually different
        setFavorites(prev => JSON.stringify(prev) === JSON.stringify(data) ? prev : data);
      }
    } catch (e) {
      console.log("Error loading favs on home", e);
    }
  }, []); // Empty array is crucial

  useFocusEffect(
    useCallback(() => {
      loadFavs();
    }, [loadFavs])
  );

  // --- TOURNAMENT CONTEXT STATE ---
  const [phase, setPhase] = useState<string | null>(null);
  const [teamSeeds, setTeamSeeds] = useState<Record<string, number>>({});

  const loadTournamentContext = useCallback(async () => {
    try {
      const [stateRes, seedsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/tournament/state?season=2036`),
        fetch(`${API_BASE_URL}/api/tournament/seeds?season=2036`)
      ]);
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        setPhase(stateData.phase);
      }
      if (seedsRes.ok) {
        const seedsData = await seedsRes.json();
        const seedMap: Record<string, number> = {};
        if (Array.isArray(seedsData)) {
          seedsData.forEach((s: any) => { seedMap[s.team_id] = s.seed; });
        }
        setTeamSeeds(seedMap);
      }
    } catch (e) {
      console.log("Error loading tournament context on home", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTournamentContext();
    }, [loadTournamentContext])
  );
  // --------------------------------

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

  const getDisplayRank = (teamId: string, lslRank: number | null | undefined, gamePhase: string) => {
    const tournamentPhases = ['Survival_16', 'Round_64', 'Round_32', 'Sweet_16', 'Elite_8', 'National Semifinals', 'Championship'];
    const isTournamentGame = tournamentPhases.includes(gamePhase);
    const seed = teamSeeds[teamId];

    if (isTournamentGame && seed) return `(${seed}) `;
    if (lslRank !== null && lslRank !== undefined) return `#${lslRank} `;
    return '';
  };

  const {
    data: payload,
    loading,
    refreshing,
    error,
    refetch,
  } = useCachedApi({
    cacheKey: 'home-data-v1', // Stable key
    endpoint: '/home',        // Stable endpoint
    maxAgeMs: 1000 * 60 * 10,  // 10 minutes cache
  });

  const featuredGames = payload?.featured_games?.games ?? [];
  const rankings = payload?.rankings_preview?.rankings ?? [];
  const analytics = payload?.analytics_preview?.leaders ?? {};
  const calendarDays = payload?.calendar_preview?.days ?? [];

  const myTeamsSnapshot = useMemo(() => {
    // Safety check: ensure everything exists before we start
    if (!favorites || !Array.isArray(favorites) || !calendarDays || !Array.isArray(calendarDays)) {
      return [];
    }

    const snapshot: any[] = [];

    favorites.forEach(favId => {
      // Ensure favId isn't null before calling toUpperCase
      const tid = String(favId || "").toUpperCase();
      if (!tid) return;

      let upcomingGame: any = null;
      let lastResult: any = null;

      for (const day of calendarDays) {
        if (!day?.games || !Array.isArray(day.games)) continue;

        const game = day.games.find((g: any) =>
          String(g?.home_id || "").toUpperCase() === tid ||
          String(g?.away_id || "").toUpperCase() === tid
        );

        if (game) {
          const isPlayed = game.a_score !== null && game.a_score !== undefined &&
            game.b_score !== null && game.b_score !== undefined;

          const gameType = isPlayed ? 'RESULT' : 'UPCOMING';
          // Use optional chaining for the display date
          const payload = { ...game, display_date: day?.display_date || 'TBD', type: gameType };

          if (gameType === 'UPCOMING') {
            upcomingGame = payload;
            break;
          } else {
            lastResult = payload;
          }
        }
      }

      if (upcomingGame) snapshot.push(upcomingGame);
      else if (lastResult) snapshot.push(lastResult);
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
    <>
      <Head>
        <title>Home | Legends CBB</title>
      </Head>

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
                The Legends Universe
              </Text>
            </View>

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
                            {getDisplayRank(game.away_id, game.lsl_rank_away, game.phase)}
                            {getTeamBranding(game.away_id, game.away_name).displayName}
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
                            {getDisplayRank(game.home_id, game.lsl_rank_home, game.phase)}
                            {getTeamBranding(game.home_id, game.home_name).displayName}
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
              <Text style={styles.sectionTitle}>
                {phase === 'SELECTION_SUNDAY' || phase === 'LIVE' ? 'LCAA Tournament' : 'Featured Games'}
              </Text>

              {phase === 'SELECTION_SUNDAY' || phase === 'LIVE' ? (
                /* BIG BRACKET PORTAL CARD */
                <Pressable
                  onPress={() => router.push('/tournament/map?portal=true')}
                  style={({ pressed }) => [
                    styles.featuredCard,
                    { backgroundColor: '#1C1C1E', borderColor: '#007AFF', borderWidth: 2 },
                    pressed && styles.cardPressed
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.featuredCardMeta, { color: '#007AFF', fontWeight: '800', marginBottom: 4 }]}>
                        OFFICIAL 2036 BRACKET
                      </Text>
                      <Text style={[styles.featuredTeamLine, { fontSize: 22, color: '#fff' }]}>
                        The Road to the Forever Four
                      </Text>
                      <Text style={{ color: theme.mutedText, marginTop: 4, fontSize: 13 }}>
                        View the official field and track the live results.
                      </Text>
                    </View>
                    <Image
                      source={require('@/assets/images/index_header_icon.png')}
                      style={{ width: 60, height: 60, opacity: 0.8 }}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={{
                    marginTop: 15,
                    backgroundColor: '#007AFF',
                    paddingVertical: 10,
                    borderRadius: 8,
                    alignItems: 'center'
                  }}>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>VIEW OFFICIAL BRACKET</Text>
                  </View>
                </Pressable>
              ) : (
                /* ORIGINAL FEATURED GAMES LOGIC */
                featuredGames.map((game: any, index: number) => (
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
                          {getDisplayRank(game.away_id, game.lsl_rank_away, game.phase)}
                          {getTeamBranding(game.away_id, game.away_name).displayName}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.featuredTeamRow, { marginBottom: 0 }]}>
                      <TeamLogo teamId={game.home_id} size={featuredLogoSize} />
                      <View style={styles.featuredTeamTextWrap}>
                        <Text style={styles.featuredTeamLine}>
                          {getDisplayRank(game.home_id, game.lsl_rank_home, game.phase)}
                          {getTeamBranding(game.home_id, game.home_name).displayName}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))
              )}
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
                      <Text style={styles.rankingName}>{getTeamBranding(team.team_id, team.team_name).displayName}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Analytics</Text>
              <View style={styles.card}>
                {[
                  { key: 'power', label: 'Power Leader', metric: analytics?.power },
                  { key: 'resume', label: 'Resume Leader', metric: analytics?.resume },
                  { key: 'form', label: 'Form Leader', metric: analytics?.form },
                  { key: 'sos', label: 'Toughest Schedule', metric: analytics?.sos },
                ].map((entry, index) => (
                  <View
                    key={entry.key}
                    style={[
                      styles.leaderRow,
                      index > 0 && { marginTop: 12 }, // add spacing between rows
                    ]}
                  >
                    <TeamLogo teamId={entry.metric?.team_id} size={26} />
                    <View style={styles.leaderTextWrap}>
                      <Text style={styles.leaderLabel}>{entry.label}</Text>
                      <Text style={styles.leaderName}>
                        {entry.metric?.team_id
                          ? getTeamBranding(entry.metric.team_id, entry.metric.team_name).displayName
                          : '—'}
                      </Text>
                      <Text style={styles.leaderValue}>
                        {entry.metric?.rank !== null && entry.metric?.rank !== undefined
                          ? `#${entry.metric.rank}`
                          : '—'}
                        {entry.metric?.value !== null && entry.metric?.value !== undefined
                          ? ` • ${entry.metric.value}`
                          : ''}
                      </Text>
                    </View>
                  </View>
                ))}
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
                                {getDisplayRank(game.away_id, game.lsl_rank_away, game.phase)}
                                {getTeamBranding(game.away_id, game.away_name).displayName}
                              </Text>
                            </View>
                          </View>

                          <View style={[styles.upcomingGameRow, { marginBottom: 0 }]}>
                            <TeamLogo teamId={game.home_id} size={upcomingLogoSize} />
                            <View style={styles.upcomingGameTextWrap}>
                              <Text style={styles.upcomingGameLine}>
                                {getDisplayRank(game.home_id, game.lsl_rank_home, game.phase)}
                                {getTeamBranding(game.home_id, game.home_name).displayName}
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
    </>
  );
}