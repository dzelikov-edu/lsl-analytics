import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, Text, ActivityIndicator, Pressable } from 'react-native';
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

    const offset = useSharedValue({ x: -1000, y: -1000 }); // Start near center
    const start = useSharedValue({ x: -1000, y: -1000 });

    const panGesture = Gesture.Pan().onUpdate((e) => {
        offset.value = { x: e.translationX + start.value.x, y: e.translationY + start.value.y };
    }).onEnd(() => {
        start.value = { x: offset.value.x, y: offset.value.y };
    });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: offset.value.x }, { translateY: offset.value.y }],
    }));

    useEffect(() => {
        async function loadBracket() {
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE_URL}/api/tournament/bracket?season=2036`, { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                const uniqueRegions = [...new Set(data.filter((g: any) => g.region !== "Final Four" && g.region !== "National Semifinals").map((g: any) => g.region))];
                setRegionOrder(uniqueRegions as string[]);
                setBracketGames(data);
            } catch (e) { console.error(e); } finally { setLoading(false); }
        }
        loadBracket();
    }, []);

    const renderElbowLine = (game: any) => {
        if (!game.next_game_id) return null;
        const startCoords = getGameCoordinates(game.region, game.round, game.game_slot, regionOrder);
        const nextGame = bracketGames.find(g => g.id === game.next_game_id);
        if (!nextGame) return null;
        const endCoords = getGameCoordinates(nextGame.region, nextGame.round, nextGame.game_slot, regionOrder);

        const isLeftFlow = (startCoords.x < endCoords.x);

        // THE HEARTLINE ADJUSTMENT
        // (GAME_HEIGHT / 2) + 2 ensures it hits the internal card divider perfectly
        const startX = isLeftFlow ? startCoords.x + 220 : startCoords.x;
        const startY = startCoords.y + (GAME_HEIGHT / 2) + 12.75;
        const endX = isLeftFlow ? endCoords.x : endCoords.x + 220;
        const endY = endCoords.y + (GAME_HEIGHT / 2) + 12.75;
        // Horizontal center of the semifinal game slot
        const semiCenterX = isLeftFlow ? endCoords.x + 110 : endCoords.x + 110;
        const midX = semiCenterX;

        return (
            <React.Fragment key={`line-${game.id}`}>
                {/* Fixed Opacity Issue: Using a very light solid color to avoid 'stacking' brightness */}
                <View style={{ position: 'absolute', left: Math.min(startX, midX), top: startY, width: Math.abs(midX - startX), height: 1, backgroundColor: theme.border, opacity: 1 }} />
                <View style={{ position: 'absolute', left: midX, top: Math.min(startY, endY), width: 1, height: Math.abs(endY - startY) + 1, backgroundColor: theme.border, opacity: 1 }} />
                <View style={{ position: 'absolute', left: Math.min(midX, endX), top: endY, width: Math.abs(endX - midX), height: 1, backgroundColor: theme.border, opacity: 1 }} />
            </React.Fragment>
        );
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.canvas, animatedStyle]}>

                        {/* 1. WATERMARKS */}
                        {regionOrder.map((r, i) => {
                            // Round of 32 slots 2 and 3
                            const posA = getGameCoordinates(r, 'Round_32', 2, regionOrder);
                            const posB = getGameCoordinates(r, 'Round_32', 3, regionOrder);

                            // YOUR SWEET SPOT VERTICAL
                            const labelY = (posA.y + posB.y) / 2 + 40;

                            // NEW: HORIZONTAL CENTER ALIGNMENT
                            // posA.x is the left edge of the card. 110 is half of the 220px card width.
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
                                            transform: [{ translateX: -50 }] // Half of estimated text width to center anchor
                                        }
                                    ]}
                                >
                                    {r.toUpperCase()}
                                </Text>
                            );
                        })}
                        <Text style={[styles.watermark, { top: CENTER_Y - 100, left: CENTER_X - 160, fontSize: 40, color: theme.text }]}>FOREVER FOUR</Text>

                        {bracketGames.map(renderElbowLine)}
                        {bracketGames.map((game) => {
                            const coords = getGameCoordinates(game.region, game.round, game.game_slot, regionOrder);
                            return (
                                <View key={game.id} style={{ position: 'absolute', left: coords.x, top: coords.y }}>
                                    <TournamentMatchup teamA={{ id: game.team_a_id, name: game.team_a_id, seed: game.seed_a }} teamB={{ id: game.team_b_id, name: game.team_b_id, seed: game.seed_b }} status="PREDICTION"
                                        onPress={() => {
                                            setSelectedMatchup({ teamA: { id: game.team_a_id, name: game.team_a_id, record: '0-0', ppg: 0, rpg: 0, fg_pct: 0, three_pct: 0 }, teamB: { id: game.team_b_id, name: game.team_b_id, record: '0-0', ppg: 0, rpg: 0, fg_pct: 0, three_pct: 0 } });
                                            setModalVisible(true);
                                        }}
                                    />
                                </View>
                            );
                        })}
                    </Animated.View>
                </GestureDetector>
                {selectedMatchup && <ScoutingReport visible={modalVisible} onClose={() => setModalVisible(false)} teamA={selectedMatchup.teamA} teamB={selectedMatchup.teamB} />}
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, overflow: 'hidden' },
    canvas: { width: MAP_SIZE, height: MAP_SIZE },
    watermark: { position: 'absolute', fontSize: 24, fontWeight: '900', letterSpacing: 1.5 },
});
