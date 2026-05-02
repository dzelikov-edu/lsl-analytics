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
    pickedWinnerId?: string | null;
    onPressTeamA?: () => void;
    onPressTeamB?: () => void;
};

export default function TournamentMatchup({ teamA, teamB, status, pickedWinnerId, onPressTeamA, onPressTeamB }: MatchupProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];
    const isPickedA = pickedWinnerId === teamA.id;
    const isPickedB = pickedWinnerId === teamB.id;

    return (
        <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* Team A Row */}
            <Pressable style={styles.teamRow} onPress={onPressTeamA}>
                <Text style={[styles.seed, { color: theme.mutedText }]}>{teamA.seed}</Text>
                <TeamLogo teamId={teamA.id} size={22} />
                <Text
                    style={[
                        styles.teamName,
                        { color: theme.text, fontWeight: isPickedA ? '900' : '400' }
                    ]}
                    numberOfLines={1}
                >
                    {teamA.name}
                </Text>
                {/* THE RADIO CIRCLE */}
                <View style={[
                    styles.radioCircle,
                    { borderColor: theme.border },
                    isPickedA && { backgroundColor: '#34C759', borderColor: '#34C759' } // Green when picked
                ]} />
            </Pressable>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Team B Row */}
            <Pressable style={styles.teamRow} onPress={onPressTeamB}>
                <Text style={[styles.seed, { color: theme.mutedText }]}>{teamB.seed}</Text>
                <TeamLogo teamId={teamB.id} size={22} />
                <Text
                    style={[
                        styles.teamName,
                        { color: theme.text, fontWeight: isPickedB ? '900' : '400' }
                    ]}
                    numberOfLines={1}
                >
                    {teamB.name}
                </Text>
                {/* THE RADIO CIRCLE */}
                <View style={[
                    styles.radioCircle,
                    { borderColor: theme.border },
                    isPickedB && { backgroundColor: '#34C759', borderColor: '#34C759' }
                ]} />
            </Pressable>
        </View>
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
    radioCircle: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 1,
        marginLeft: 10,
    },
    seed: { fontSize: 11, width: 22, fontWeight: 'bold' },
    teamName: { fontSize: 14, flex: 1, marginLeft: 6 },
    score: { fontSize: 15, fontWeight: '900', marginLeft: 10 },
    divider: { height: 1 },
});
