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
import TeamLogo from '@/components/TeamLogo';
import { getGameCoordinates, GAME_HEIGHT, CENTER_X, CENTER_Y } from '@/lib/bracketLayout';
import { getTeamBranding } from '@/lib/teamBranding';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAP_SIZE = 5000;

type TournamentMapProps = {
    isMock?: boolean;
    overrideBracketData?: any[]; initialBracketId?: string | null;
    onRunPersonalSim?: () => void;       // handler for bottom-bar button
};

export default function TournamentMap({ isMock = false, overrideBracketData, onRunPersonalSim, initialBracketId }: TournamentMapProps) {
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
    const [hasCustomLogos, setHasCustomLogos] = useState(false);

    const offset = useSharedValue({ x: -1000, y: -1000 });
    const start = useSharedValue({ x: -1000, y: -1000 });

    const roundHeaders = [
        { round: 'Survival_16', label: 'SURVIVAL 16', dates: '3/16 – 3/17', gap: 140 },
        { round: 'Round_64', label: 'ROUND OF 64', dates: '3/18 – 3/19', gap: 140 },
        { round: 'Round_32', label: 'ROUND OF 32', dates: '3/20 – 3/21', gap: 140 },
        { round: 'Sweet_16', label: 'SUPREME 16', dates: '3/25 – 3/26', gap: 140 },
        { round: 'Elite_8', label: 'ETERNAL 8', dates: '3/27 – 3/28', gap: 67 },
        { round: 'National Semifinals', label: 'FOREVER FOUR', dates: '4/3', gap: 0 },
        // Championship handled by center title + champ panel
    ];

    // --- Champion Computation (Shared Across Modes) ---
    const champGame = bracketGames.find((g: any) => g.round === "Championship");
    let champTeamId: string | null = null;

    if (champGame) {
        if (isMock) {
            // Bracketology: AI simulation stored winner_id on the Championship game
            champTeamId = champGame.winner_id || null;
        } else {
            // Challenge / Live: use the user's pick for the Champ if it exists; fallback to official winner_id
            champTeamId = picks[champGame.id] || champGame.winner_id || null;
        }
    }

    const champName = champTeamId ? (teamNames[champTeamId] || champTeamId) : null;
    const champSeed = champTeamId ? (teamSeeds[champTeamId] || 0) : 0;

    let champLine: string | null = null;
    if (champTeamId && champName) {
        const seedPart = champSeed > 0 ? `${champSeed}) ` : "";
        if (isMock) {
            champLine = `AI PROJECTED CHAMPION: ${seedPart}${champName}`;
        } else {
            champLine = `YOUR CHAMPION: ${seedPart}${champName}`;
        }
    } else {
        if (isMock) {
            champLine = "AI PROJECTED CHAMPION: TBD";
        } else {
            champLine = "YOUR CHAMPION: TBD";
        }
    }

    const champBranding = champTeamId ? getTeamBranding(champTeamId) : null;
    const champAccent = champBranding?.primary ?? theme.border;
    const champAccentSecondary = champBranding?.secondary ?? theme.border;

    const panGesture = Gesture.Pan().onUpdate((e) => {
        const nextX = e.translationX + start.value.x;
        const nextY = e.translationY + start.value.y;
        offset.value = { x: Math.min(-320, Math.max(nextX, -2550)), y: Math.min(-85, Math.max(nextY, -1035)) };
    }).onEnd(() => {
        start.value = { x: offset.value.x, y: offset.value.y };
    });

    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value.x }, { translateY: offset.value.y }] }));

    const headerAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: offset.value.x }],
    }));

    useEffect(() => {
        (async () => {
            try {
                const flag = await AsyncStorage.getItem('has_custom_logos');
                setHasCustomLogos(flag === 'true');
            } catch (e) {
                console.log('Error reading has_custom_logos', e);
            }
        })();
    }, []);

    async function loadData() {
        // Optimistic UI: Only show spinner if the map is currently empty.
        // This prevents the "white flash" when switching tabs.
        if (bracketGames.length === 0) setLoading(true);

        try {
            const token = await getToken();
            if (!token) { setLoading(false); return; }
            const cb = Date.now();

            // 1. Parallel Launch: always use /bracket for base structure
            const [bracketsRes, mainDataRes, seedsRes, namesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/tournament/brackets?season=2036&cb=${cb}`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/tournament/bracket?season=2036&cb=${cb}`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/tournament/seeds?season=2036&cb=${cb}`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/tournament/team-names?cb=${cb}`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            // Parse all JSON in parallel
            const [brackets, apiBracketData, seedListData, namesData] = await Promise.all([
                bracketsRes.json(), mainDataRes.json(), seedsRes.json(), namesRes.json()
            ]);

            // Use override data if provided (personal sim), otherwise use API data
            const bracketData = (isMock && overrideBracketData && overrideBracketData.length > 0)
                ? overrideBracketData
                : apiBracketData;

            // 2. Process Team Names and Stats immediately
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

            // 3. Setup Region Order
            const foundRegions = [...new Set(bracketData.map((g: any) => g.region))];
            const finalRegions = ["West", "Midwest", "East", "South"].filter(r => foundRegions.includes(r));
            setRegionOrder(finalRegions);

            // 4. Handle Active Bracket ID
            let currentBracketId = initialBracketId || bracketId;
            if (!isMock && !currentBracketId && Array.isArray(brackets) && brackets.length > 0) {
                const unlocked = brackets.filter((b: any) => !b.is_locked);
                currentBracketId = unlocked[0]?.id || brackets[0].id;
            }
            setBracketId(currentBracketId);

            // 5. Final Data Transformation (Picks & Propagation)
            let updatedGames: any[] = [...bracketData];
            let finalPicks: { [k: string]: string } = {};

            if (isMock && overrideBracketData && overrideBracketData.length > 0) {
                // Personal Sim Mode: Use winners from the override data
                bracketData.forEach((g: any) => {
                    if (g.winner_id) finalPicks[g.id] = g.winner_id;
                });
            } else if (!isMock && currentBracketId) {
                // Real Mode: Fetch user picks...
                const pRes = await fetch(`${API_BASE_URL}/api/tournament/brackets/${currentBracketId}/picks?cb=${cb}`, { headers: { Authorization: `Bearer ${token}` } });
                // (rest stays the same)
                if (pRes.ok) {
                    const pData = await pRes.json();
                    if (pData?.picks) {
                        finalPicks = pData.picks;
                        // Propagation loop
                        Object.entries(finalPicks).forEach(([gameId, winnerId]) => {
                            if (!winnerId || winnerId === "TBD") return;
                            const gIdx = updatedGames.findIndex((g: any) => g.id === gameId);
                            if (gIdx === -1) return;
                            const cur = updatedGames[gIdx];
                            if (cur?.next_game_id) {
                                const nIdx = updatedGames.findIndex((g: any) => g.id === cur.next_game_id);
                                if (nIdx === -1) return;
                                const nxt = { ...updatedGames[nIdx] };
                                const regIdx = finalRegions.indexOf(cur.region);
                                const isTop = (cur.round === "Survival_16") ? false : (cur.round === "Elite_8" ? (regIdx < 2) : (cur.round === "National Semifinals" ? cur.game_slot === 1 : cur.game_slot % 2 !== 0));
                                if (isTop) nxt.team_a_id = winnerId; else nxt.team_b_id = winnerId;
                                updatedGames[nIdx] = nxt;
                            }
                        });
                    }
                }
            }

            // 6. Bulk UI Update
            setBracketGames(updatedGames);
            setPicks(finalPicks);

        } catch (e) {
            console.error("LCAA Load Error:", e);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, [isMock, overrideBracketData]);

    useFocusEffect(
        React.useCallback(() => {
            loadData();
        }, [isMock, overrideBracketData])
    );

    const getPickCount = (roundName: string) => {
        return bracketGames.filter(g => g.round === roundName && picks[g.id]).length;
    };

    const handlePick = (gameId: string, teamId: string) => {
        if (isMock) return; // <--- ADD THIS LINE: Completely disables manual picking in mock mode
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

    const renderSideRoundHeaders = (side: 'left' | 'right') => {
        if (!bracketGames.length || !regionOrder.length) return null;

        // Left side anchor = first region; right side anchor = last region
        const regionIndex = side === 'left' ? 0 : regionOrder.length - 1;
        const regionId = regionOrder[regionIndex];

        return roundHeaders.map((m) => {
            const sample = bracketGames.find(
                (g: any) => g.round === m.round && g.region === regionId
            );
            if (!sample) return null;

            const c = getGameCoordinates(sample.region, sample.round, sample.game_slot, regionOrder);
            const headerX = c.x + 110;     // center over 220px card
            const headerY = c.y - 40;      // above that round’s game row

            return (
                <View
                    key={`${side}-${m.round}`}
                    style={{
                        position: 'absolute',
                        left: headerX,
                        top: headerY,
                        alignItems: 'center',
                    }}
                >
                    <Text
                        style={{
                            color: theme.text,
                            fontSize: 10,
                            fontWeight: '800',
                        }}
                    >
                        {m.label}
                    </Text>
                    <Text
                        style={{
                            color: theme.mutedText,
                            fontSize: 9,
                        }}
                    >
                        {m.dates}
                    </Text>
                </View>
            );
        });
    };

    const renderChampHeader = () => {
        if (!champGame) return null;
        if (!regionOrder.length) return null;

        const c = getGameCoordinates(champGame.region, champGame.round, champGame.game_slot, regionOrder);
        const headerX = c.x + 110;
        const headerY = c.y - 40;

        return (
            <View
                style={{
                    position: 'absolute',
                    left: headerX,
                    top: headerY,
                    alignItems: 'center',
                }}
            >
                <Text
                    style={{
                        color: theme.text,
                        fontSize: 11,
                        fontWeight: '900',
                    }}
                >
                    NATIONAL CHAMPIONSHIP
                </Text>
                <Text
                    style={{
                        color: theme.mutedText,
                        fontSize: 9,
                    }}
                >
                    4/5
                </Text>
            </View>
        );
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

                            // Vertical placement: between those two R32 games, nudged down
                            const labelY = (posA.y + posB.y) / 2 + 40;

                            // Horizontal center of this region’s column (220px card width → +110)
                            const centerX = posA.x + 110;

                            // Use a container centered on that X so text is really centered
                            const containerWidth = 220;
                            const containerLeft = centerX - containerWidth / 2;

                            return (
                                <View
                                    key={r}
                                    style={{
                                        position: 'absolute',
                                        top: labelY,
                                        left: containerLeft,
                                        width: containerWidth,
                                        alignItems: 'center',
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.watermark,
                                            {
                                                position: 'relative', // override absolute from styles.watermark
                                                color: theme.text,
                                                opacity: 0.35,
                                            },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {r.toUpperCase()}
                                    </Text>
                                </View>
                            );
                        })}
                        {hasCustomLogos ? (
                            <View
                                style={{
                                    position: 'absolute',
                                    top: CENTER_Y - 212,
                                    left: CENTER_X - 79,
                                    width: 160,
                                    height: 160,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <TeamLogo teamId="LCAA_FOREVER_FOUR" size={190} />
                            </View>
                        ) : (
                            <Text
                                style={[
                                    styles.watermark,
                                    { top: CENTER_Y - 100, left: CENTER_X - 160, fontSize: 40, color: theme.text },
                                ]}
                            >
                                FOREVER FOUR
                            </Text>
                        )}

                        {/* --- IN-CANVAS CHAMPIONSHIP HEADER --- */}
                        <View
                            style={{
                                position: 'absolute',
                                top: CENTER_Y - 32, // Positioned below the logo, above the game
                                left: CENTER_X - 98,
                                width: 200,
                                alignItems: 'center',
                            }}
                        >
                            <Text
                                style={{
                                    color: theme.text,
                                    fontSize: 12,
                                    fontWeight: '900',
                                    letterSpacing: 0.5,
                                }}
                            >
                                NATIONAL CHAMPIONSHIP
                            </Text>
                            <Text
                                style={{
                                    color: theme.mutedText,
                                    fontSize: 10,
                                    fontWeight: '700',
                                    marginTop: 2,
                                }}
                            >
                                4/5
                            </Text>
                        </View>

                        {bracketGames.map(renderElbowLine)}

                        {bracketGames.map((game) => {
                            const coords = getGameCoordinates(game.region, game.round, game.game_slot, regionOrder);
                            const isChampGame = champGame && game.id === champGame.id && champTeamId;

                            return (
                                <React.Fragment key={game.id}>
                                    <View style={{ position: 'absolute', left: coords.x, top: coords.y }}>
                                        <TournamentMatchup
                                            teamA={{ id: game.team_a_id, name: teamNames[game.team_a_id] || game.team_a_id, seed: teamSeeds[game.team_a_id] || 0 }}
                                            teamB={{ id: game.team_b_id, name: teamNames[game.team_b_id] || game.team_b_id, seed: teamSeeds[game.team_b_id] || 0 }}
                                            status="PREDICTION"
                                            pickedWinnerId={picks[game.id]}
                                            onPressTeamA={() => handlePick(game.id, game.team_a_id)}
                                            onPressTeamB={() => handlePick(game.id, game.team_b_id)}
                                            onLongPress={!isMock ? () => openScoutingReport(game) : undefined}
                                            showPickIndicators={!isMock}
                                        />
                                    </View>

                                    {isChampGame && (
                                        (() => {
                                            const PANEL_WIDTH = 260;
                                            const panelCenterX = coords.x + 110; // 110 = half of 220 (matchup width)
                                            const panelLeft = panelCenterX - PANEL_WIDTH / 2;
                                            const panelTop = coords.y + GAME_HEIGHT + 40; // Leave solid space under game

                                            return (
                                                <View
                                                    style={{
                                                        position: 'absolute',
                                                        left: panelLeft,
                                                        top: panelTop,
                                                        width: PANEL_WIDTH,
                                                    }}
                                                >
                                                    <View
                                                        style={{
                                                            borderRadius: 16,
                                                            overflow: 'hidden',
                                                            backgroundColor: theme.card,
                                                            borderWidth: 2,
                                                            borderColor: champAccentSecondary, // use secondary as border
                                                            shadowColor: '#000',
                                                            shadowOffset: { width: 0, height: 3 },
                                                            shadowOpacity: 0.2,
                                                            shadowRadius: 6,
                                                            elevation: 5,
                                                        }}
                                                    >
                                                        {/* Top stripe (like the Final Four header band) */}
                                                        <View
                                                            style={{
                                                                paddingVertical: 6,
                                                                paddingHorizontal: 10,
                                                                backgroundColor: champAccent, // primary as stripe
                                                                alignItems: 'center',
                                                            }}
                                                        >
                                                            <Text
                                                                style={{
                                                                    color: '#FFFFFF',
                                                                    fontWeight: '900',
                                                                    fontSize: 10,
                                                                    letterSpacing: 1,
                                                                }}
                                                            >
                                                                {isMock ? 'PROJECTED NATIONAL CHAMPION' : 'NATIONAL CHAMPION'}
                                                            </Text>
                                                        </View>

                                                        {/* Middle: logo + seed + name */}
                                                        <View
                                                            style={{
                                                                paddingVertical: 12,
                                                                paddingHorizontal: 12,
                                                                alignItems: 'center',
                                                            }}
                                                        >
                                                            <TeamLogo teamId={champTeamId!} size={40} />
                                                            <Text
                                                                style={{
                                                                    color: theme.text,
                                                                    fontWeight: '900',
                                                                    fontSize: 16,
                                                                    marginTop: 8,
                                                                }}
                                                                numberOfLines={1}
                                                            >
                                                                {champName}
                                                            </Text>
                                                            {champSeed > 0 && (
                                                                <Text
                                                                    style={{
                                                                        color: theme.mutedText,
                                                                        fontSize: 11,
                                                                        marginTop: 2,
                                                                    }}
                                                                    numberOfLines={1}
                                                                >
                                                                    {champSeed}‑SEED
                                                                </Text>
                                                            )}
                                                        </View>

                                                        {/* Bottom label (mode aware) */}
                                                        <View
                                                            style={{
                                                                paddingVertical: 6,
                                                                alignItems: 'center',
                                                                borderTopWidth: 1,
                                                                borderTopColor: champAccentSecondary,
                                                            }}
                                                        >
                                                            <Text
                                                                style={{
                                                                    color: theme.mutedText,
                                                                    fontSize: 10,
                                                                    fontWeight: '700',
                                                                }}
                                                            >
                                                                {isMock ? 'Based on current seeds & power ratings' : 'From your locked bracket'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            );
                                        })()
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </Animated.View>
                </GestureDetector>

                <View style={[styles.topBar, { backgroundColor: theme.background }]}>
                    {/* CENTER TITLE - Pushed up for room, champLine removed */}
                    <View style={{ position: 'absolute', top: 20, left: 0, right: 0, alignItems: 'center', zIndex: 10 }}>
                        <Text style={{ color: theme.text, fontWeight: '900', fontSize: 14, letterSpacing: 0.5 }}>
                            {isMock ? 'LCAA BRACKETOLOGY • 2036' : 'OFFICIAL LCAA BRACKET • 2036'}
                        </Text>
                    </View>

                    {/* SLIDING HEADERS LAYER */}
                    <Animated.View style={[{ position: 'absolute', top: 41, left: 0, flexDirection: 'row' }, headerAnimatedStyle]}>
                        {/* LEFT SIDE */}
                        <View style={{ flexDirection: 'row', marginLeft: 401 }}>
                            {roundHeaders.map(m => (
                                <View key={`l-${m.round}`} style={{ alignItems: 'center', width: 100, marginRight: m.gap }}>
                                    <Text style={{ color: theme.text, fontSize: 9.5, fontWeight: '900' }}>{m.label}</Text>
                                    <Text style={{ color: theme.mutedText, fontSize: 8.5, fontWeight: '600' }}>{m.dates}</Text>
                                </View>
                            ))}
                        </View>

                        {/* RIGHT SIDE (Mirrored Spacing) */}
                        <View style={{ flexDirection: 'row-reverse', marginLeft: 384 }}>
                            {roundHeaders.map(m => (
                                <View key={`r-${m.round}`} style={{ alignItems: 'center', width: 100, marginLeft: m.gap }}>
                                    <Text style={{ color: theme.text, fontSize: 9.5, fontWeight: '900' }}>{m.label}</Text>
                                    <Text style={{ color: theme.mutedText, fontSize: 8.5, fontWeight: '600' }}>{m.dates}</Text>
                                </View>
                            ))}
                        </View>
                    </Animated.View>
                </View>

                <View style={[styles.bottomBar, { backgroundColor: theme.card }]}>
                    {isMock ? (
                        <>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.text, fontSize: 10, fontWeight: '600' }}>
                                    Bracketology: seeded field. Run an AI sim to see one possible tournament path.
                                </Text>
                                <Text
                                    style={{
                                        color: '#FF9500',
                                        fontSize: 9,
                                        fontWeight: '800',
                                        marginTop: 2,
                                    }}
                                >
                                    PRESEASON • V1.0
                                </Text>
                            </View>
                            {onRunPersonalSim && (
                                <Pressable
                                    onPress={onRunPersonalSim}
                                    style={{
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 8,
                                        backgroundColor: '#5856D6',
                                        marginLeft: 8,
                                    }}
                                >
                                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                                        Run AI Sim
                                    </Text>
                                </Pressable>
                            )}
                        </>
                    ) : (
                        <>
                            {/* existing picks + Lock Bracket UI */}
                        </>
                    )}
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
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 72,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        overflow: 'hidden',
        zIndex: 1000,
    },
    bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 50, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: '#333', flexDirection: 'row', paddingHorizontal: 10 }
});
