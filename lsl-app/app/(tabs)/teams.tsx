import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL } from '@/lib/api';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type TeamRow = {
    team_id: string;
    team_name: string;
    polls?: {
        week?: number | null;
        LSL?: {
            rank?: number | null;
            next5_order?: number | null;
        };
    };
    analytics?: {
        power?: { rank?: number | null } | null;
        resume?: { rank?: number | null } | null;
        form?: { rank?: number | null } | null;
        sos?: { rank?: number | null } | null;
    };
};

export default function TeamsScreen() {
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
                    marginBottom: 20,
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
                teamCard: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 12,
                    backgroundColor: theme.card,
                },
                teamCardPressed: {
                    opacity: 0.75,
                },
                cardHeader: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                },
                teamName: {
                    fontSize: 22,
                    fontWeight: '700',
                    flex: 1,
                    paddingRight: 12,
                    color: theme.text,
                },
                pollBadge: {
                    fontSize: 18,
                    fontWeight: '700',
                    color: theme.text,
                },
                analyticsStrip: {
                    fontSize: 14,
                    color: theme.mutedText,
                },
                errorTitle: {
                    fontSize: 18,
                    fontWeight: '700',
                    marginBottom: 8,
                    color: theme.text,
                },
            }),
        [theme]
    );

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [teams, setTeams] = useState<TeamRow[]>([]);

    useEffect(() => {
        const loadTeams = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`${API_BASE_URL}/teams?week=0`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const json = await response.json();
                setTeams(json?.teams ?? []);
            } catch (err: any) {
                setError(err?.message ?? 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        loadTeams();
    }, []);

    const formatRankText = (team: TeamRow) => {
        const rank = team?.polls?.LSL?.rank;
        const next5 = team?.polls?.LSL?.next5_order;

        if (rank !== null && rank !== undefined) return `#${rank}`;
        if (next5 !== null && next5 !== undefined) return `Next 5`;
        return '';
    };

    const formatAnalyticsStrip = (team: TeamRow) => {
        const power = team?.analytics?.power?.rank;
        const resume = team?.analytics?.resume?.rank;
        const form = team?.analytics?.form?.rank;
        const sos = team?.analytics?.sos?.rank;

        return [
            `Power ${power ? `#${power}` : '—'}`,
            `Resume ${resume ? `#${resume}` : '—'}`,
            `Form ${form ? `#${form}` : '—'}`,
            `SOS ${sos ? `#${sos}` : '—'}`,
        ].join(' • ');
    };

    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.screenTitle}>Teams</Text>

            {loading ? (
                <View style={styles.centerBlock}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.helper}>Loading teams...</Text>
                </View>
            ) : error ? (
                <View style={styles.teamCard}>
                    <Text style={styles.errorTitle}>Error</Text>
                    <Text style={styles.analyticsStrip}>{error}</Text>
                </View>
            ) : teams.length === 0 ? (
                <View style={styles.teamCard}>
                    <Text style={styles.analyticsStrip}>No teams available.</Text>
                </View>
            ) : (
                teams.map((team) => (
                    <Pressable
                        key={team.team_id}
                        onPress={() => router.push(`/team/${team.team_id}`)}
                        style={({ pressed }) => [styles.teamCard, pressed && styles.teamCardPressed]}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.teamName}>{team.team_name}</Text>
                            <Text style={styles.pollBadge}>{formatRankText(team)}</Text>
                        </View>
                        <Text style={styles.analyticsStrip}>{formatAnalyticsStrip(team)}</Text>
                    </Pressable>
                ))
            )}
        </ScrollView>
    );
}