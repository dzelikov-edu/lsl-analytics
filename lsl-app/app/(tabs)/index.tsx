import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL } from '@/lib/api';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = AppColors[colorScheme];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: {
          padding: 20,
          paddingBottom: 40,
          backgroundColor: theme.background,
        },
        screenTitle: {
          fontSize: 32,
          fontWeight: '800',
          marginBottom: 6,
          color: theme.text,
        },
        metaText: {
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
          borderRadius: 14,
          padding: 14,
          marginBottom: 12,
          backgroundColor: theme.card,
        },
        cardMeta: {
          fontSize: 13,
          color: theme.mutedText,
          marginBottom: 8,
        },
        cardTitle: {
          fontSize: 17,
          fontWeight: '700',
          marginBottom: 4,
          color: theme.text,
        },
        cardTeamLine: {
          fontSize: 17,
          fontWeight: '700',
          marginBottom: 4,
          color: theme.text,
        },
        dayGameBlock: {
          marginTop: 10,
        },
        dayGameLine: {
          fontSize: 16,
          fontWeight: '700',
          marginBottom: 4,
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
    [theme]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<any>(null);

  useEffect(() => {
    const loadHome = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${API_BASE_URL}/home`);
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

    loadHome();
  }, []);

  const featuredGames = payload?.featured_games?.games ?? [];
  const rankings = payload?.rankings_preview?.rankings ?? [];
  const analytics = payload?.analytics_preview?.leaders ?? {};
  const calendarDays = payload?.calendar_preview?.days ?? [];

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
    <ScrollView contentContainerStyle={styles.content}>
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
          <Text style={styles.screenTitle}>LSL</Text>
          <Text style={styles.metaText}>
            Updated {payload?.status?.refreshed_at ? 'recently' : 'just now'}
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Featured Games</Text>
            {featuredGames.map((game: any, index: number) => (
              <View key={game.game_key ?? index} style={styles.card}>
                <Text style={styles.cardMeta}>
                  {game.display_date || game.date_key || 'TBD'} • {game.phase_display || game.phase || '—'} • Week {game.week ?? '—'}
                </Text>

                <Text style={styles.cardTeamLine}>
                  {game.lsl_rank_away !== null && game.lsl_rank_away !== undefined
                    ? `#${game.lsl_rank_away} `
                    : ''}
                  {game.away_name || 'Away'}
                </Text>

                <Text style={styles.cardTeamLine}>
                  {game.lsl_rank_home !== null && game.lsl_rank_home !== undefined
                    ? `#${game.lsl_rank_home} `
                    : ''}
                  {game.home_name || 'Home'}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rankings</Text>
            <View style={styles.card}>
              {rankings.slice(0, 10).map((team: any, index: number) => (
                <Text key={team.team_id ?? index} style={styles.body}>
                  {(team.rank ?? index + 1)}. {team.team_name}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Analytics</Text>
            <View style={styles.card}>
              <Text style={styles.body}>
                Power Leader — {analytics?.power?.team_name ?? '—'}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Schedule</Text>
            {calendarDays.map((day: any, index: number) => (
              <View key={day.date_key ?? index} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {day.display_date || day.date_key || 'TBD'}
                </Text>
                <Text style={styles.cardMeta}>{day.games_count ?? 0} games</Text>

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
                  .slice(0, 3)
                  .map((game: any, gameIndex: number) => (
                    <View key={game.game_key ?? gameIndex} style={styles.dayGameBlock}>
                      <Text style={styles.dayGameLine}>
                        {game.lsl_rank_away !== null && game.lsl_rank_away !== undefined
                          ? `#${game.lsl_rank_away} `
                          : ''}
                        {game.away_name || 'Away'}
                      </Text>

                      <Text style={styles.dayGameLine}>
                        {game.lsl_rank_home !== null && game.lsl_rank_home !== undefined
                          ? `#${game.lsl_rank_home} `
                          : ''}
                        {game.home_name || 'Home'}
                      </Text>
                    </View>
                  ))}
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}