import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, Text, ActivityIndicator } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import { API_BASE_URL } from '@/lib/api';
import { getToken } from '@/lib/auth-storage';
import TournamentMatchup from '@/components/TournamentMatchup';
import ScoutingReport from '@/components/ScoutingReport';
import { getGameCoordinates, GAME_HEIGHT, CENTER_X, CENTER_Y } from '@/lib/bracketLayout';

const MAP_SIZE = 5000;

export default function TournamentMap() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];
    const [loading, setLoading] = useState(true);
    const [bracketGames, setBracketGames] = useState<any[]>([]);
    const [regionOrder, setRegionOrder] = useState<string[]>([]);
    const [selectedMatchup, setSelectedMatchup] = useState<any>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [picks, setPicks] = useState<{ [gameId: string]: string }>({});

    const handlePick = (gameId: string, teamId: string) => {
        setPicks((prev) => ({
            ...prev,
            // If the team is already picked, clear it. Otherwise, set it as the winner.
            [gameId]: prev[gameId] === teamId ? '' : teamId,
        }));
    };

    // SIMPLE, STABLE PAN
    const offset = useSharedValue({ x: -1000, y: -1000 });
    const start = useSharedValue({ x: -1000, y: -1000 });

    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            const nextX = e.translationX + start.value.x;
            const nextY = e.translationY + start.value.y;

            // MANUAL BORDERS – adjust these numbers by eye
            const clampedX = Math.min(-300, Math.max(nextX, -2570));
            const clampedY = Math.min(0, Math.max(nextY, -1200));

            offset.value = { x: clampedX, y: clampedY };
        })
        .onEnd(() => {
            start.value = { x: offset.value.x, y: offset.value.y };
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: offset.value.x }, { translateY: offset.value.y }],
    }));

    useEffect(() => {
        async function loadBracket() {
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE_URL}/api/tournament/bracket?season=2036`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                const uniqueRegions = [
                    ...new Set(
                        data
                            .filter((g: any) => g.region !== 'Final Four' && g.region !== 'National Semifinals')
                            .map((g: any) => g.region),
                    ),
                ];
                setRegionOrder(uniqueRegions as string[]);
                setBracketGames(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        loadBracket();
    }, []);

    const renderElbowLine = (game: any) => {
        if (!game.next_game_id) return null;
        const startCoords = getGameCoordinates(game.region, game.round, game.game_slot, regionOrder);
        const nextGame = bracketGames.find((g) => g.id === game.next_game_id);
        if (!nextGame) return null;
        const endCoords = getGameCoordinates(nextGame.region, nextGame.round, nextGame.game_slot, regionOrder);

        const isLeftFlow = startCoords.x < endCoords.x;

        // YOUR TUNED HEARTLINE VALUES
        const startX = isLeftFlow ? startCoords.x + 220 : startCoords.x;
        const startY = startCoords.y + (GAME_HEIGHT / 2) + 12.75;
        const endX = isLeftFlow ? endCoords.x : endCoords.x + 220;
        const endY = endCoords.y + (GAME_HEIGHT / 2) + 12.75;

        // Horizontal center of the semifinal game slot
        const semiCenterX = endCoords.x + 110;
        const midX = semiCenterX;

        return (
            <React.Fragment key={`line-${game.id}`}>
                <View
                    style={{
                        position: 'absolute',
                        left: Math.min(startX, midX),
                        top: startY,
                        width: Math.abs(midX - startX),
                        height: 1,
                        backgroundColor: theme.border,
                        opacity: 1,
                    }}
                />
                <View
                    style={{
                        position: 'absolute',
                        left: midX,
                        top: Math.min(startY, endY),
                        width: 1,
                        height: Math.abs(endY - startY) + 1,
                        backgroundColor: theme.border,
                        opacity: 1,
                    }}
                />
                <View
                    style={{
                        position: 'absolute',
                        left: Math.min(midX, endX),
                        top: endY,
                        width: Math.abs(endX - midX),
                        height: 1,
                        backgroundColor: theme.border,
                        opacity: 1,
                    }}
                />
            </React.Fragment>
        );
    };

    if (loading) return <ActivityIndicator style={{ flex: 1 }} color={theme.text} />;

    return (


        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.canvas, animatedStyle]}>
                        {/* REGION LABELS */}
                        {regionOrder.map((r) => {
                            const posA = getGameCoordinates(r, 'Round_32', 2, regionOrder);
                            const posB = getGameCoordinates(r, 'Round_32', 3, regionOrder);

                            const labelY = (posA.y + posB.y) / 2 + 40;
                            const labelX = posA.x + 110;

                            return (
                                <Text
                                    key={r}
                                    style={[
                                        styles.watermark,
                                        {
                                            top: labelY,
                                            left: labelX,
                                            color: theme.text,
                                            opacity: 0.35,
                                            transform: [{ translateX: -50 }],
                                        },
                                    ]}
                                >
                                    {r.toUpperCase()}
                                </Text>
                            );
                        })}

                        <Text
                            style={[
                                styles.watermark,
                                {
                                    top: CENTER_Y - 100,
                                    left: CENTER_X - 160,
                                    fontSize: 40,
                                    color: theme.text,
                                },
                            ]}
                        >
                            FOREVER FOUR
                        </Text>

                        {bracketGames.map(renderElbowLine)}

                        {bracketGames.map((game) => {
                            const coords = getGameCoordinates(
                                game.region,
                                game.round,
                                game.game_slot,
                                regionOrder,
                            );
                            return (
                                <View
                                    key={game.id}
                                    style={{ position: 'absolute', left: coords.x, top: coords.y }}
                                >
                                    <TournamentMatchup
                                        teamA={{ id: game.team_a_id, name: game.team_a_id, seed: game.seed_a }}
                                        teamB={{ id: game.team_b_id, name: game.team_b_id, seed: game.seed_b }}
                                        status="PREDICTION"
                                        pickedWinnerId={picks[game.id] || null}
                                        onPressTeamA={() => handlePick(game.id, game.team_a_id)}
                                        onPressTeamB={() => handlePick(game.id, game.team_b_id)}
                                    />
                                </View>
                            );
                        })}
                    </Animated.View>
                </GestureDetector>

                {selectedMatchup && (
                    <ScoutingReport
                        visible={modalVisible}
                        onClose={() => setModalVisible(false)}
                        teamA={selectedMatchup.teamA}
                        teamB={selectedMatchup.teamB}
                    />
                )}
            </View>

            {/* TOP COLUMN BAR (static shell for now) */}
            <View style={[styles.topBar, { backgroundColor: theme.background }]}>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>
                    LCAA Bracket • 2036
                </Text>
            </View>

            {/* BOTTOM PICK TRACKER (static shell for now) */}
            <View style={[styles.bottomBar, { backgroundColor: theme.card }]}>
                <Text style={{ color: theme.text, fontSize: 12 }}>
                    Picks by Round: R64 0/32 • R32 0/16 • S16 0/8 • E8 0/4 • FF 0/2 • Champ 0/1
                </Text>
            </View>

        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, overflow: 'hidden' },
    canvas: { width: MAP_SIZE, height: MAP_SIZE },
    watermark: { position: 'absolute', fontSize: 24, fontWeight: '900', letterSpacing: 1.5 },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#333',
    },
    bottomBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#333',
    },
});
