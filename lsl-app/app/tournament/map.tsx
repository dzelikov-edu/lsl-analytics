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
    const [teamStats, setTeamStats] = useState<Record<string, any>>({});
    const [picks, setPicks] = useState<{ [gameId: string]: string }>({});
    const [selectedMatchup, setSelectedMatchup] = useState<any>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [bracketId, setBracketId] = useState<string | null>(null); // NEW
    const [locking, setLocking] = useState(false);

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
                if (!token) {
                    setLoading(false);
                    return;
                }

                // 1) Get or create a UserBracket for this user/season
                let activeBracketId: string | null = null;
                try {
                    const bracketsRes = await fetch(`${API_BASE_URL}/api/tournament/brackets?season=2036`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (bracketsRes.ok) {
                        const brackets = await bracketsRes.json();
                        if (Array.isArray(brackets) && brackets.length > 0) {
                            const unlocked = brackets.filter((b: any) => !b.is_locked);
                            const chosen = unlocked[0] || brackets[0];
                            activeBracketId = chosen.id;
                        }
                    }

                    if (!activeBracketId) {
                        const createRes = await fetch(`${API_BASE_URL}/api/tournament/brackets`, {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ name: 'My 2036 Bracket', season: 2036 }),
                        });
                        if (createRes.ok) {
                            const created = await createRes.json();
                            activeBracketId = created.id;
                        }
                    }
                } catch (e) {
                    console.log('Error initializing bracket', e);
                }
                setBracketId(activeBracketId);

                // 2) Fetch bracket structure, seeds, and names
                const [bracketRes, seedsRes, namesRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/tournament/bracket?season=2036`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_BASE_URL}/api/tournament/seeds?season=2036`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_BASE_URL}/api/tournament/team-names`, { headers: { Authorization: `Bearer ${token}` } })
                ]);

                const bracketData = await bracketRes.json();
                const seedListData = await seedsRes.json();
                const namesData = await namesRes.json();

                setTeamNames(namesData);

                const statsMap: Record<string, any> = {};
                (seedListData || []).forEach((row: any) => {
                    statsMap[row.team_id] = {
                        ppg: row.ppg,
                        rpg: row.rpg,
                        apg: row.apg,
                        fg_pct: row.fg_pct,
                        three_pct: row.three_pct,
                        oppg: row.oppg,
                        topg: row.topg,
                        fpg: row.fpg,
                        record: row.games_played > 0 ? `~${row.games_played} gp` : "—",
                    };
                });
                setTeamStats(statsMap);

                const seedMap: Record<string, number> = {};
                bracketData.forEach((g: any) => {
                    if (g.round === "Round_64" || g.round === "Survival_16") {
                        if (g.team_a_id !== "TBD") seedMap[g.team_a_id] = g.seed_a;
                        if (g.team_b_id !== "TBD") seedMap[g.team_b_id] = g.seed_b;
                    }
                });
                setTeamSeeds(seedMap);

                const uniqueRegions = [...new Set(
                    bracketData
                        .filter((g: any) => g.region !== "Final Four" && g.region !== "National Semifinals")
                        .map((g: any) => g.region)
                )];
                setRegionOrder(uniqueRegions as string[]);

                // Start from raw bracketData and then apply any saved picks
                let updatedGames: any[] = [...bracketData];
                let initialPicks: { [k: string]: string } = {};

                // 3) Hydrate picks for this bracket, if we have one
                if (activeBracketId) {
                    try {
                        const picksRes = await fetch(
                            `${API_BASE_URL}/api/tournament/brackets/${activeBracketId}/picks`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        if (picksRes.ok) {
                            const picksData = await picksRes.json();
                            if (picksData && picksData.picks) {
                                initialPicks = picksData.picks as { [k: string]: string };

                                // Replay each pick into the bracket tree to fill downstream slots
                                Object.entries(initialPicks).forEach(([gameId, winnerId]) => {
                                    if (!winnerId || winnerId === "TBD") return;

                                    const gameIdx = updatedGames.findIndex((g: any) => g.id === gameId);
                                    if (gameIdx === -1) return;
                                    const currentGame = updatedGames[gameIdx];

                                    if (currentGame && currentGame.next_game_id) {
                                        const nextIdx = updatedGames.findIndex(
                                            (g: any) => g.id === currentGame.next_game_id
                                        );
                                        if (nextIdx === -1) return;
                                        const nextGame = { ...updatedGames[nextIdx] };

                                        const regionIdx = uniqueRegions.indexOf(currentGame.region);
                                        const isTopRegion = regionIdx === 0 || regionIdx === 1;

                                        let isTop = false;
                                        if (currentGame.round === "Survival_16") {
                                            // Survival winners always take the bottom slot of Round of 64
                                            isTop = false;
                                        } else if (currentGame.round === "Elite_8") {
                                            // Top regions feed Team A, bottom regions feed Team B of Semis
                                            isTop = isTopRegion;
                                        } else if (currentGame.round === "National Semifinals") {
                                            // Left Semi feeds Team A, Right Semi feeds Team B of Champ
                                            isTop = currentGame.game_slot === 1;
                                        } else {
                                            // Standard Round of 64, 32, and 16 logic
                                            isTop = currentGame.game_slot % 2 !== 0;
                                        }

                                        if (isTop) nextGame.team_a_id = winnerId;
                                        else nextGame.team_b_id = winnerId;

                                        updatedGames[nextIdx] = nextGame;
                                    }
                                });
                            }
                        }
                    } catch (e) {
                        console.log('Error loading bracket picks', e);
                    }
                }
                // Save final bracket state plus picks
                setBracketGames(updatedGames);
                if (Object.keys(initialPicks).length > 0) {
                    setPicks(initialPicks);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
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

    const openScoutingReport = (game: any) => {
        const teamAId = game.team_a_id;
        const teamBId = game.team_b_id;
        if (!teamAId || !teamBId || teamAId === "TBD" || teamBId === "TBD") return;

        const aStats = teamStats[teamAId] || {};
        const bStats = teamStats[teamBId] || {};

        setSelectedMatchup({
            teamA: {
                id: teamAId,
                name: teamNames[teamAId] || teamAId,
                ...aStats,
            },
            teamB: {
                id: teamBId,
                name: teamNames[teamBId] || teamBId,
                ...bStats,
            },
        });
        setModalVisible(true);
    };

    const handleLockBracket = async () => {
        if (!bracketId) {
            console.log("No bracketId; cannot lock bracket.");
            return;
        }
        setLocking(true);
        try {
            const token = await getToken();
            if (!token) {
                console.log("No auth token, cannot lock bracket.");
                return;
            }

            const nonEmptyPicks: { [k: string]: string } = {};
            Object.entries(picks).forEach(([gameId, winnerId]) => {
                if (winnerId && winnerId !== "TBD") {
                    nonEmptyPicks[gameId] = winnerId;
                }
            });

            const res = await fetch(
                `${API_BASE_URL}/api/tournament/brackets/${bracketId}/picks?season=2036&lock=true`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ picks: nonEmptyPicks }),
                }
            );

            const data = await res.json();
            if (!res.ok) {
                console.log("Failed to lock bracket:", data);
            } else {
                console.log("Bracket saved/locked:", data);
            }
        } catch (e) {
            console.log("Error locking bracket:", e);
        } finally {
            setLocking(false);
        }
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
                                        status="PREDICTION"
                                        pickedWinnerId={picks[game.id]}
                                        onPressTeamA={() => handlePick(game.id, game.team_a_id)}
                                        onPressTeamB={() => handlePick(game.id, game.team_b_id)}
                                        onLongPress={() => openScoutingReport(game)} // ADD
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
                    <Text style={{ color: theme.text, fontSize: 10, fontWeight: '600', flex: 1 }}>
                        Picks: S16 {getPickCount("Survival_16")}/16 • R64 {getPickCount("Round_64")}/32 • R32 {getPickCount("Round_32")}/16 • S16 {getPickCount("Sweet_16")}/8 • E8 {getPickCount("Elite_8")}/4 • FF {getPickCount("National Semifinals")}/2 • Champ {getPickCount("Championship")}/1
                    </Text>
                    <Pressable
                        onPress={handleLockBracket}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: locking ? theme.border : '#34C759', marginLeft: 8 }}
                    >
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                            {locking ? 'Locking…' : 'Lock Bracket'}
                        </Text>
                    </Pressable>
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
    bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 50, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: '#333', flexDirection: 'row', paddingHorizontal: 10 }
});
