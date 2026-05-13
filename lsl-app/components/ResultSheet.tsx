import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Alert } from 'react-native';
import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import TeamLogo from './TeamLogo';
import { API_BASE_URL } from '@/lib/api';  // Added this
import { getToken } from '@/lib/auth-storage';  // Added this

type ResultSheetProps = {
    visible: boolean;
    onClose: () => void;
    game: any | null;
    teamNames: Record<string, string>;
    pickedId: string | null;
    teamSeeds: Record<string, number>;
    teamRanks: Record<string, number>;
    userIsAdmin: boolean;  // Pass true if the user is admin
};

export default function ResultSheet({ visible, onClose, game, teamNames, pickedId, teamSeeds, teamRanks, userIsAdmin }: ResultSheetProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    if (!visible || !game) return null;

    const teamAId = game.team_a_id;
    const teamBId = game.team_b_id;
    const nameA = teamNames[teamAId] || teamAId;
    const nameB = teamNames[teamBId] || teamBId;

    const scoreA = game.score_a;
    const scoreB = game.score_b;
    const winnerId = game.winner_id;

    const hasFinal = typeof scoreA === 'number' && typeof scoreB === 'number' && winnerId;

    // Round display name
    const rawRound: string = game.round;
    const roundLabelMap: Record<string, string> = {
        Survival_16: 'SURVIVAL 16',
        Round_64: 'ROUND OF 64',
        Round_32: 'ROUND OF 32',
        Sweet_16: 'SUPREME 16',
        Elite_8: 'ETERNAL 8',
        'National Semifinals': 'FOREVER FOUR',
        Championship: 'NATIONAL CHAMPIONSHIP',
    };
    const roundLabel = roundLabelMap[rawRound] || rawRound;
    const showRegion = rawRound !== 'National Semifinals' && rawRound !== 'Championship';

    // Seeds from global map (stable across all rounds)
    const seedA: number | undefined = teamSeeds[teamAId];
    const seedB: number | undefined = teamSeeds[teamBId];

    const rankA: number | undefined = teamRanks[teamAId];
    const rankB: number | undefined = teamRanks[teamBId];

    // Determine home (better seed, lower number) on the RIGHT
    type TeamSide = {
        id: string;
        name: string;
        seed?: number;
        score?: number | null;
        isWinner: boolean;
    };

    const teamA: TeamSide = {
        id: teamAId,
        name: nameA,
        seed: typeof seedA === 'number' ? seedA : undefined,
        score: scoreA,
        isWinner: !!winnerId && winnerId === teamAId,
    };
    const teamB: TeamSide = {
        id: teamBId,
        name: nameB,
        seed: typeof seedB === 'number' ? seedB : undefined,
        score: scoreB,
        isWinner: !!winnerId && winnerId === teamBId,
    };

    let leftTeam: TeamSide = teamA;
    let rightTeam: TeamSide = teamB;

    if (typeof teamA.seed === 'number' && typeof teamB.seed === 'number') {
        if (teamA.seed < teamB.seed) {
            // teamA better seed -> home on right
            leftTeam = teamB;
            rightTeam = teamA;
        } else if (teamB.seed < teamA.seed) {
            // teamB better seed -> home on right (already)
            leftTeam = teamA;
            rightTeam = teamB;
        } else {
            // Seeds equal: use overall rank if available
            if (typeof rankA === 'number' && typeof rankB === 'number') {
                if (rankA < rankB) {
                    // teamA better rank -> home on right
                    leftTeam = teamB;
                    rightTeam = teamA;
                } else if (rankB < rankA) {
                    leftTeam = teamA;
                    rightTeam = teamB;
                }
            }
        }
    }

    let pickLine = "You did not pick this game.";
    let pickColor = theme.mutedText as string;

    if (pickedId && pickedId !== 'TBD') {
        if (!winnerId) {
            pickLine = `Your pick: ${teamNames[pickedId] || pickedId} (game not final)`;
            pickColor = theme.mutedText;
        } else if (pickedId === winnerId) {
            pickLine = `Your pick: ${teamNames[pickedId] || pickedId} – Correct`;
            pickColor = '#34C759';
        } else {
            pickLine = `Your pick: ${teamNames[pickedId] || pickedId} – Busted`;
            pickColor = '#FF3B30';
        }
    }

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={styles.dismissArea} onPress={onClose} />
                <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    {/* Handle bar */}
                    <View style={[styles.handle, { backgroundColor: theme.border }]} />

                    <Text style={[styles.title, { color: theme.text }]}>
                        {showRegion ? `${roundLabel} • ${game.region}` : roundLabel}
                    </Text>

                    {/* Teams + scores (home/better seed on the right) */}
                    <View style={styles.row}>
                        <View style={styles.teamBlock}>
                            <TeamLogo teamId={leftTeam.id} size={32} />
                            <Text style={[styles.teamName, { color: theme.text }]} numberOfLines={1}>
                                {typeof leftTeam.seed === 'number' ? `(${leftTeam.seed}) ${leftTeam.name}` : leftTeam.name}
                            </Text>
                        </View>
                        <View style={styles.scoreBlock}>
                            <Text style={[styles.scoreLabel, { color: theme.mutedText }]}>
                                {hasFinal ? 'Final' : 'Status'}
                            </Text>
                            <Text style={[styles.scoreText, { color: theme.text }]}>
                                {hasFinal && typeof leftTeam.score === 'number' && typeof rightTeam.score === 'number'
                                    ? `${leftTeam.score} – ${rightTeam.score}`
                                    : 'TBD'}
                            </Text>
                        </View>
                        <View style={styles.teamBlock}>
                            <TeamLogo teamId={rightTeam.id} size={32} />
                            <Text style={[styles.teamName, { color: theme.text }]} numberOfLines={1}>
                                {typeof rightTeam.seed === 'number' ? `(${rightTeam.seed}) ${rightTeam.name}` : rightTeam.name}
                            </Text>
                        </View>
                    </View>

                    {/* Your pick line */}
                    <View style={{ marginTop: 16 }}>
                        <Text
                            style={{
                                fontSize: 12,
                                color: pickColor,
                                fontWeight: '700',
                                textAlign: 'center',
                            }}
                        >
                            {pickLine}
                        </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', marginTop: 18 }}>
                        {hasFinal && userIsAdmin && (
                            <Pressable
                                onPress={async () => {
                                    try {
                                        const token = await getToken();  // Assuming getToken is in your lib
                                        const res = await fetch(`${API_BASE_URL}/admin/tournament/undo-score`, {
                                            method: 'POST',
                                            headers: {
                                                Authorization: `Bearer ${token}`,
                                                'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify({
                                                game_id: game.id,
                                                season: 2036,  // Hardcoded for now, but could be passed
                                            }),
                                        });
                                        if (res.ok) {
                                            Alert.alert("Success", "Score undone.");
                                            onClose();  // Close the sheet
                                        } else {
                                            const data = await res.json();
                                            Alert.alert("Error", data.detail || "Failed to undo score.");
                                        }
                                    } catch (e) {
                                        Alert.alert("Error", "Network issue.");
                                    }
                                }}
                                style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    borderRadius: 8,
                                    backgroundColor: '#FF3B30',
                                    marginBottom: 8,
                                }}
                            >
                                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Undo Score</Text>
                            </Pressable>
                        )}

                        <Pressable
                            onPress={onClose}
                            style={{
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 8,
                                backgroundColor: theme.card,
                                borderWidth: 1,
                                borderColor: theme.border,
                            }}
                        >
                            <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>Close</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    dismissArea: { flex: 1 },
    sheet: {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        padding: 16,
        borderWidth: 1,
        maxHeight: '55%',
    },
    handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
    title: { fontSize: 14, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    teamBlock: { flex: 1, alignItems: 'center' },
    teamName: { marginTop: 6, fontSize: 12, fontWeight: '700', textAlign: 'center' },
    scoreBlock: { alignItems: 'center', paddingHorizontal: 8 },
    scoreLabel: { fontSize: 10, marginBottom: 2 },
    scoreText: { fontSize: 16, fontWeight: '900' },
});
