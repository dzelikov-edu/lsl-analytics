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
import { getGameCoordinates, GAME_HEIGHT } from '@/lib/bracketLayout';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_WIDTH = 3200;
const MAP_HEIGHT = 2500;

export default function TournamentMap() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];
    const [loading, setLoading] = useState(true);
    const [bracketGames, setBracketGames] = useState<any[]>([]);
    const [regionOrder, setRegionOrder] = useState<string[]>([]);
    const [selectedMatchup, setSelectedMatchup] = useState<any>(null);
    const [modalVisible, setModalVisible] = useState(false);

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

    useEffect(() => {
        async function loadBracket() {
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE_URL}/api/tournament/bracket?season=2036`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                const uniqueRegions = [...new Set(data.filter((g: any) => g.region !== "Final Four" && g.region !== "National Semifinals").map((g: any) => g.region))];
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
        const nextGame = bracketGames.find(g => g.id === game.next_game_id);
        if (!nextGame) return null;
        const endCoords = getGameCoordinates(nextGame.region, nextGame.round, nextGame.game_slot, regionOrder);

        const isLeft = (game.region === regionOrder[0] || game.region === regionOrder[3] || (game.region === "Final Four" && game.game_slot === 1));

        const startX = isLeft ? startCoords.x + 220 : startCoords.x;
        const startY = startCoords.y + (GAME_HEIGHT / 2);
        const endX = isLeft ? endCoords.x : endCoords.x + 220;
        const endY = endCoords.y + (GAME_HEIGHT / 2);

        const midX = startX + (isLeft ? 20 : -20);
        const verticalHeight = Math.abs(endY - startY);
        const verticalTop = Math.min(startY, endY);

        return (
            <React.Fragment key={`line-${game.id}`}>
                {/* Horizontal segment from card */}
                <View style={{ position: 'absolute', left: Math.min(startX, midX), top: startY, width: 20, height: 1.5, backgroundColor: theme.border, opacity: 0.3 }} />
                {/* Vertical "Elbow" segment */}
                <View style={{ position: 'absolute', left: midX, top: verticalTop, width: 1.5, height: verticalHeight, backgroundColor: theme.border, opacity: 0.3 }} />
                {/* Horizontal segment to next card */}
                <View style={{ position: 'absolute', left: Math.min(midX, endX), top: endY, width: Math.abs(endX - midX), height: 1.5, backgroundColor: theme.border, opacity: 0.3 }} />
            </React.Fragment>
        );
    };

    if (loading) return <ActivityIndicator style={{ flex: 1 }} color={theme.text} />;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.canvas, animatedStyle]}>

                        {/* 1. WATERMARKS */}
                        {regionOrder.map((r, i) => (
                            <Text key={r} style={[styles.watermark, { top: i > 1 ? 1400 : 400, left: (i === 0 || i === 3) ? 300 : 2200, color: theme.text, opacity: 0.25 }]}>
                                {r.toUpperCase()}
                            </Text>
                        ))}
                        <Text style={[styles.watermark, { top: 800, left: 1350, opacity: 0.25, color: theme.text }]}>LCAA</Text>

                        {/* 2. BRACKET LINES (USING STANDARD VIEWS) */}
                        {bracketGames.map(renderElbowLine)}

                        {/* 3. MATCHUP CARDS */}
                        {bracketGames.map((game) => {
                            const coords = getGameCoordinates(game.region, game.round, game.game_slot, regionOrder);
                            return (
                                <View key={game.id} style={{ position: 'absolute', left: coords.x, top: coords.y }}>
                                    <TournamentMatchup
                                        teamA={{ id: game.team_a_id, name: game.team_a_id, seed: game.seed_a }}
                                        teamB={{ id: game.team_b_id, name: game.team_b_id, seed: game.seed_b }}
                                        status="PREDICTION"
                                        onPress={() => {
                                            setSelectedMatchup({
                                                teamA: { id: game.team_a_id, name: game.team_a_id, record: '0-0', ppg: 0, rpg: 0, fg_pct: 0, three_pct: 0 },
                                                teamB: { id: game.team_b_id, name: game.team_b_id, record: '0-0', ppg: 0, rpg: 0, fg_pct: 0, three_pct: 0 }
                                            });
                                            setModalVisible(true);
                                        }}
                                    />
                                </View>
                            );
                        })}
                    </Animated.View>
                </GestureDetector>

                {selectedMatchup && (
                    <ScoutingReport visible={modalVisible} onClose={() => setModalVisible(false)} teamA={selectedMatchup.teamA} teamB={selectedMatchup.teamB} />
                )}
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, overflow: 'hidden' },
    canvas: { width: MAP_WIDTH, height: MAP_HEIGHT },
    watermark: { position: 'absolute', fontSize: 100, fontWeight: '900' },
});
