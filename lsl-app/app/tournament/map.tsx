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
    const [teamNames, setTeamNames] = useState<Record<string, string>>({});
    const [teamSeeds, setTeamSeeds] = useState<Record<string, number>>({});
    const [picks, setPicks] = useState<{ [gameId: string]: string }>({});
    const [selectedMatchup, setSelectedMatchup] = useState<any>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const offset = useSharedValue({ x: -1000, y: -1000 });
    const start = useSharedValue({ x: -1000, y: -1000 });

    const panGesture = Gesture.Pan().onUpdate((e) => {
        const nextX = e.translationX + start.value.x;
        const nextY = e.translationY + start.value.y;
        offset.value = { x: Math.min(-320, Math.max(nextX, -2550)), y: Math.min(-100, Math.max(nextY, -1075)) };
    }).onEnd(() => {
        start.value = { x: offset.value.x, y: offset.value.y };
    });

    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value.x }, { translateY: offset.value.y }] }));

    useEffect(() => {
        async function loadData() {
            try {
                const token = await getToken();
                const [bracketRes, seedsRes, namesRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/tournament/bracket?season=2036`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_BASE_URL}/api/tournament/seeds?season=2036`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_BASE_URL}/api/tournament/team-names`, { headers: { Authorization: `Bearer ${token}` } })
                ]);

                const bracketData = await bracketRes.json();
                const seedListData = await seedsRes.json();
                const namesData = await namesRes.json();

                setTeamNames(namesData);
                const seedMap: Record<string, number> = {};
                bracketData.forEach((g: any) => {
                    if (g.round === "Round_64" || g.round === "Survival_16") {
                        if (g.team_a_id !== "TBD") seedMap[g.team_a_id] = g.seed_a;
                        if (g.team_b_id !== "TBD") seedMap[g.team_b_id] = g.seed_b;
                    }
                });
                setTeamSeeds(seedMap);

                const uniqueRegions = [...new Set(bracketData.filter((g: any) => g.region !== "Final Four" && g.region !== "National Semifinals").map((g: any) => g.region))];
                setRegionOrder(uniqueRegions as string[]);
                setBracketGames(bracketData);
            } catch (e) { console.error(e); } finally { setLoading(false); }
        }
        loadData();
    }, []);

    const getPickCount = (roundName: string) => {
        return bracketGames.filter(g => g.round === roundName && picks[g.id]).length;
    };

    const handlePick = (gameId: string, teamId: string) => {
        if (teamId === "TBD") return;
        const isDeselecting = picks[gameId] === teamId;
        const newWinnerId = isDeselecting ? "" : teamId;
        setPicks(prev => ({ ...prev, [gameId]: newWinnerId }));

        setBracketGames(currentGames => {
            const updated = [...currentGames];
            const gameIdx = updated.findIndex(g => g.id === gameId);
            const currentGame = updated[gameIdx];

            if (currentGame && currentGame.next_game_id) {
                const nextIdx = updated.findIndex(g => g.id === currentGame.next_game_id);
                if (nextIdx !== -1) {
                    const nextGame = { ...updated[nextIdx] };
                    // 1. Identify region verticality (Top regions are index 0 and 1)
                    const regionIdx = regionOrder.indexOf(currentGame.region);
                    const isTopRegion = regionIdx === 0 || regionIdx === 1;

                    // 2. Exact slot placement logic
                    let isTop = false;
                    if (currentGame.round === "Survival_16") {
                        isTop = false; // Survival winners always take the bottom slot of Round of 64
                    } else if (currentGame.round === "Elite_8") {
                        isTop = isTopRegion; // Top regions feed Team A, Bottom regions feed Team B of Semis
                    } else if (currentGame.round === "National Semifinals") {
                        isTop = currentGame.game_slot === 1; // Left Semi feeds Team A, Right Semi feeds Team B of Champ
                    } else {
                        isTop = currentGame.game_slot % 2 !== 0; // Standard Round of 64, 32, and 16 logic
                    }
                    if (isTop) nextGame.team_a_id = newWinnerId || "TBD";
                    else nextGame.team_b_id = newWinnerId || "TBD";
                    updated[nextIdx] = nextGame;
                }
            }
            return updated;
        });
    };

    const renderElbowLine = (game: any) => {
        if (!game.next_game_id) return null;
        const startCoords = getGameCoordinates(game.region, game.round, game.game_slot, regionOrder);
        const nextGame = bracketGames.find(g => g.id === game.next_game_id);
        if (!nextGame) return null;
        const endCoords = getGameCoordinates(nextGame.region, nextGame.round, nextGame.game_slot, regionOrder);
        const isLeftFlow = (startCoords.x < endCoords.x);

        const startX = isLeftFlow ? startCoords.x + 220 : startCoords.x;
        const startY = startCoords.y + (GAME_HEIGHT / 2) + 12.75;
        const endX = isLeftFlow ? endCoords.x : endCoords.x + 220;
        const endY = endCoords.y + (GAME_HEIGHT / 2) + 12.75;
        const semiCenterX = endCoords.x + 110;
        const midX = (game.round === "Elite_8") ? semiCenterX : startX + (isLeftFlow ? 130 : -130);

        return (
            <React.Fragment key={`line-${game.id}`}>
                <View style={{ position: 'absolute', left: Math.min(startX, midX), top: startY, width: Math.abs(midX - startX), height: 1, backgroundColor: theme.border, opacity: 1 }} />
                <View style={{ position: 'absolute', left: midX, top: Math.min(startY, endY), width: 1, height: Math.abs(endY - startY) + 1, backgroundColor: theme.border, opacity: 1 }} />
                <View style={{ position: 'absolute', left: Math.min(midX, endX), top: endY, width: Math.abs(endX - midX), height: 1, backgroundColor: theme.border, opacity: 1 }} />
            </React.Fragment>
        );
    };

    if (loading) return <ActivityIndicator style={{ flex: 1 }} color={theme.text} />;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.canvas, animatedStyle]}>
                        {regionOrder.map((r) => {
                            const posA = getGameCoordinates(r, 'Round_32', 2, regionOrder);
                            const posB = getGameCoordinates(r, 'Round_32', 3, regionOrder);
                            const labelY = (posA.y + posB.y) / 2 + 40;
                            const labelX = posA.x + 110;
                            return (<Text key={r} style={[styles.watermark, { top: labelY, left: labelX, color: theme.text, opacity: 0.35, transform: [{ translateX: -50 }] }]}>{r.toUpperCase()}</Text>);
                        })}
                        <Text style={[styles.watermark, { top: CENTER_Y - 100, left: CENTER_X - 160, fontSize: 40, color: theme.text }]}>FOREVER FOUR</Text>

                        {bracketGames.map(renderElbowLine)}

                        {bracketGames.map((game) => {
                            const coords = getGameCoordinates(game.region, game.round, game.game_slot, regionOrder);
                            return (
                                <View key={game.id} style={{ position: 'absolute', left: coords.x, top: coords.y }}>
                                    <TournamentMatchup
                                        teamA={{ id: game.team_a_id, name: teamNames[game.team_a_id] || game.team_a_id, seed: teamSeeds[game.team_a_id] || 0 }}
                                        teamB={{ id: game.team_b_id, name: teamNames[game.team_b_id] || game.team_b_id, seed: teamSeeds[game.team_b_id] || 0 }}
                                        status="PREDICTION" pickedWinnerId={picks[game.id]}
                                        onPressTeamA={() => handlePick(game.id, game.team_a_id)}
                                        onPressTeamB={() => handlePick(game.id, game.team_b_id)}
                                    />
                                </View>
                            );
                        })}
                    </Animated.View>
                </GestureDetector>

                <View style={[styles.topBar, { backgroundColor: theme.background }]}>
                    <Text style={{ color: theme.text, fontWeight: '700' }}>LCAA Bracket • 2036</Text>
                </View>

                <View style={[styles.bottomBar, { backgroundColor: theme.card }]}>
                    <Text style={{ color: theme.text, fontSize: 10, fontWeight: '600' }}>
                        Picks: S16 {getPickCount("Survival_16")}/16 • R64 {getPickCount("Round_64")}/32 • R32 {getPickCount("Round_32")}/16 • S16 {getPickCount("Sweet_16")}/8 • E8 {getPickCount("Elite_8")}/4 • FF {getPickCount("National Semifinals")}/2 • Champ {getPickCount("Championship")}/1
                    </Text>
                </View>

                {selectedMatchup && <ScoutingReport visible={modalVisible} onClose={() => setModalVisible(false)} teamA={{ ...selectedMatchup.teamA, name: teamNames[selectedMatchup.teamA.id] || selectedMatchup.teamA.id }} teamB={{ ...selectedMatchup.teamB, name: teamNames[selectedMatchup.teamB.id] || selectedMatchup.teamB.id }} />}
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, overflow: 'hidden' },
    canvas: { width: MAP_SIZE, height: MAP_SIZE },
    watermark: { position: 'absolute', fontSize: 24, fontWeight: '900', letterSpacing: 1.5 },
    topBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 40, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#333' },
    bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 50, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: '#333' }
});
