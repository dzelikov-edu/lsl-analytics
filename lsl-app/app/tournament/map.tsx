import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, Text, ActivityIndicator } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Svg, Line } from 'react-native-svg';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';

import { API_BASE_URL } from '@/lib/api';
import { getToken } from '@/lib/auth-storage';
import TournamentMatchup from '@/components/TournamentMatchup';
import ScoutingReport from '@/components/ScoutingReport';
import { getGameCoordinates, COLUMN_WIDTH, GAME_HEIGHT } from '@/lib/bracketLayout';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_WIDTH = 4000;
const MAP_HEIGHT = 6000;

export default function TournamentMap() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    const [loading, setLoading] = useState(true);
    const [bracketGames, setBracketGames] = useState<any[]>([]);
    const [selectedMatchup, setSelectedMatchup] = useState<any>(null);
    const [modalVisible, setModalVisible] = useState(false);

    // Map Gestures
    const offset = useSharedValue({ x: 0, y: 0 });
    const start = useSharedValue({ x: 0, y: 0 });

    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            const nextX = e.translationX + start.value.x;
            const nextY = e.translationY + start.value.y;
            offset.value = {
                x: Math.min(0, Math.max(nextX, -(MAP_WIDTH - SCREEN_WIDTH))),
                y: Math.min(0, Math.max(nextY, -(MAP_HEIGHT - SCREEN_HEIGHT))),
            };
        })
        .onEnd(() => {
            start.value = { x: offset.value.x, y: offset.value.y };
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: offset.value.x }, { translateY: offset.value.y }],
    }));

    // 1. FETCH REAL DATA FROM POSTGRES
    useEffect(() => {
        async function loadBracket() {
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE_URL}/api/tournament/bracket?season=2036`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                setBracketGames(data);
            } catch (e) {
                console.error("Failed to load bracket:", e);
            } finally {
                setLoading(false);
            }
        }
        loadBracket();
    }, []);

    const openScoutingReport = (game: any) => {
        // Prepare stat snapshot (Mocking stats for now, real averages later)
        const stats = {
            teamA: { id: game.team_a_id, name: game.team_a_name || 'Team A', record: '0-0', ppg: 0, rpg: 0, fg_pct: 0, three_pct: 0 },
            teamB: { id: game.team_b_id, name: game.team_b_name || 'Team B', record: '0-0', ppg: 0, rpg: 0, fg_pct: 0, three_pct: 0 }
        };
        setSelectedMatchup(stats);
        setModalVisible(true);
    };

    if (loading) return <ActivityIndicator style={{ flex: 1 }} color={theme.text} />;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.canvas, animatedStyle]}>

                        {/* 2. DRAW BRACKET LINES (SVG LAYER) */}
                        {/* <Svg style={StyleSheet.absoluteFill}>
                            {bracketGames.map((game) => {
                                if (!game.next_game_id) return null;
                                const startCoords = getGameCoordinates(game.region, game.round, game.game_slot);
                                // Find where the winner goes
                                const nextGame = bracketGames.find(g => g.id === game.next_game_id);
                                if (!nextGame) return null;
                                const endCoords = getGameCoordinates(nextGame.region, nextGame.round, nextGame.game_slot);

                                return (
                                    <Line
                                        key={`line-${game.id}`}
                                        x1={startCoords.x + 220} // End of the card
                                        y1={startCoords.y + (GAME_HEIGHT / 2)}
                                        x2={endCoords.x}
                                        y2={endCoords.y + (GAME_HEIGHT / 2)}
                                        stroke={theme.border}
                                        strokeWidth="2"
                                    />
                                );
                            })}
                        </Svg> */}

                        {/* 3. DRAW THE CARDS */}
                        {bracketGames.map((game) => {
                            const coords = getGameCoordinates(game.region, game.round, game.game_slot);
                            return (
                                <View
                                    key={game.id}
                                    style={{ position: 'absolute', left: coords.x, top: coords.y }}
                                >
                                    <TournamentMatchup
                                        teamA={{ id: game.team_a_id, name: game.team_a_id, seed: game.seed_a }}
                                        teamB={{ id: game.team_b_id, name: game.team_b_id, seed: game.seed_b }}
                                        status="PREDICTION"
                                        onPress={() => openScoutingReport(game)}
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
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, overflow: 'hidden' },
    canvas: { width: MAP_WIDTH, height: MAP_HEIGHT },
    regionMarker: { position: 'absolute', opacity: 0.15 }
});
