import { View, Text, StyleSheet, Pressable } from 'react-native';
import TeamLogo from './TeamLogo';
import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Image } from 'expo-image';

type MatchupTeam = {
    id: string;
    name: string;
    seed: number;
    score?: number | null;
    isWinner?: boolean;
};

type MatchupProps = {
    teamA: MatchupTeam;
    teamB: MatchupTeam;
    status: 'PREDICTION' | 'LIVE' | 'FINAL';
    onPress?: () => void;
};

export default function TournamentMatchup({ teamA, teamB, status, onPress }: MatchupProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    const renderTeamRow = (team: MatchupTeam) => (
        <View style={styles.teamRow}>
            <Text style={[styles.seed, { color: theme.mutedText }]}>{team.seed}</Text>
            <TeamLogo teamId={team.id} size={22} />
            <Text
                style={[
                    styles.teamName,
                    { color: theme.text },
                    team.isWinner && { fontWeight: '800' }
                ]}
                numberOfLines={1}
            >
                {team.name}
            </Text>
            {team.score !== null && team.score !== undefined && (
                <Text style={[styles.score, { color: theme.text }]}>{team.score}</Text>
            )}
        </View>
    );

    return (
        <Pressable
            style={({ pressed }) => [
                styles.container,
                { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.9 : 1 }
            ]}
            onPress={onPress}
        >
            {renderTeamRow(teamA)}
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            {renderTeamRow(teamB)}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 220,
        borderRadius: 10,
        borderWidth: 1,
        marginVertical: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    teamRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        height: 44,
    },
    seed: { fontSize: 11, width: 22, fontWeight: 'bold' },
    teamName: { fontSize: 14, flex: 1, marginLeft: 6 },
    score: { fontSize: 15, fontWeight: '900', marginLeft: 10 },
    divider: { height: 1 },
});
