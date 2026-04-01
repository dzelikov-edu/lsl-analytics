import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { API_BASE_URL } from '@/lib/api';

export default function HomeScreen() {
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

  const refreshedAt = payload?.status?.refreshed_at ?? null;
  const pollWeek = payload?.rankings_preview?.week ?? null;
  const featuredGames = payload?.featured_games?.games ?? [];
  const rankings = payload?.rankings_preview?.rankings ?? [];
  const analyticsLeaders = payload?.analytics_preview?.leaders ?? {};
  const calendarDays = payload?.calendar_preview?.days ?? [];

  const formatRankedName = (
    teamName: string,
    rank: number | null | undefined,
    next5: number | null | undefined
  ) => {
    if (rank !== null && rank !== undefined) return `#${rank} ${teamName}`;
    if (next5 !== null && next5 !== undefined) return `${teamName} (Next 5)`;
    return teamName;
  };

  const analyticsItems = [
    { label: 'Power Leader', item: analyticsLeaders.power },
    { label: 'Resume Leader', item: analyticsLeaders.resume },
    { label: 'Form Leader', item: analyticsLeaders.form },
    { label: 'Toughest Schedule', item: analyticsLeaders.sos },
  ].filter((x) => x.item);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="large" />
          <Text style={styles.helper}>Loading home payload...</Text>
        </View>
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Error</Text>
          <Text style={styles.body}>{error}</Text>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.appTitle}>LSL</Text>
            <Text style={styles.context}>
              {pollWeek !== null ? `Poll Week ${pollWeek}` : 'League Home'}
            </Text>
            <Text style={styles.status}>
              {refreshedAt ? `Last refresh: ${refreshedAt}` : 'Last refresh unavailable'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Featured Games</Text>

            {featuredGames.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyText}>No featured games available.</Text>
              </View>
            ) : (
              featuredGames.map((game: any) => (
                <View key={game.game_key} style={styles.card}>
                  <Text style={styles.cardMeta}>
                    {game.display_date || game.date_key || 'TBD'} • {game.phase_display || game.phase || '—'} • Week {game.week ?? '—'}
                  </Text>

                  <Text style={styles.teamRow}>
                    {formatRankedName(
                      game.away_name,
                      game.lsl_rank_away,
                      game.lsl_next5_away
                    )}
                  </Text>

                  <Text style={styles.teamRow}>
                    {formatRankedName(
                      game.home_name,
                      game.lsl_rank_home,
                      game.lsl_next5_home
                    )}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rankings</Text>

            {rankings.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyText}>No rankings available.</Text>
              </View>
            ) : (
              <View style={styles.card}>
                {rankings.slice(0, 10).map((team: any, index: number) => (
                  <Text key={`${team.team_id}-${index}`} style={styles.listRow}>
                    {team.rank ?? team.bucket_order ?? index + 1}. {team.team_name}
                  </Text>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Analytics</Text>

            {analyticsItems.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyText}>No analytics leaders available.</Text>
              </View>
            ) : (
              analyticsItems.map((entry, index) => (
                <View key={`${entry.label}-${index}`} style={styles.card}>
                  <Text style={styles.analyticsLabel}>{entry.label}</Text>
                  <Text style={styles.analyticsTeam}>{entry.item.team_name}</Text>
                  <Text style={styles.analyticsValue}>
                    {entry.item.rank !== null && entry.item.rank !== undefined
                      ? `#${entry.item.rank}`
                      : '—'}
                    {entry.item.value !== null && entry.item.value !== undefined
                      ? ` • ${entry.item.value}`
                      : ''}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Schedule</Text>

            {calendarDays.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyText}>No upcoming schedule available.</Text>
              </View>
            ) : (
              calendarDays.map((day: any, index: number) => (
                <View key={`${day.date_key}-${index}`} style={styles.card}>
                  <Text style={styles.dayHeader}>
                    {day.display_date || day.date_key || 'TBD'} • {day.games_count ?? 0} games
                  </Text>

                  {(day.games ?? []).slice(0, 5).map((game: any, gameIndex: number) => (
                    <Text key={`${game.game_key}-${gameIndex}`} style={styles.listRow}>
                      {game.away_name} at {game.home_name}
                    </Text>
                  ))}
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#fff',
  },
  header: {
    marginBottom: 24,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  context: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  status: {
    fontSize: 14,
    opacity: 0.65,
  },
  section: {
    marginBottom: 14,
  },
  centerBlock: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helper: {
    fontSize: 15,
    opacity: 0.7,
    marginTop: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#fafafa',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  cardMeta: {
    fontSize: 12,
    opacity: 0.65,
    marginBottom: 8,
  },
  teamRow: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  listRow: {
    fontSize: 16,
    marginBottom: 8,
  },
  analyticsLabel: {
    fontSize: 14,
    opacity: 0.65,
    marginBottom: 6,
  },
  analyticsTeam: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  analyticsValue: {
    fontSize: 14,
    opacity: 0.75,
  },
  dayHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    opacity: 0.7,
  },
  body: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
});