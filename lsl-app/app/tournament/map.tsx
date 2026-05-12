import React, { useState, useEffect, useLayoutEffect } from 'react';
import { StyleSheet, View, Dimensions, Text, ActivityIndicator, Pressable, Alert, useWindowDimensions, Platform, ScrollView } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withDecay, cancelAnimation } from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import { API_BASE_URL } from '@/lib/api';
import { getToken } from '@/lib/auth-storage';
import TournamentMatchup from '@/components/TournamentMatchup';
import ScoutingReport from '@/components/ScoutingReport';
import TeamLogo from '@/components/TeamLogo';
import { getGameCoordinates, GAME_HEIGHT, CENTER_X, CENTER_Y } from '@/lib/bracketLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTeamBranding } from '@/lib/teamBranding';
import { useFocusEffect, router, Stack, useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAP_SIZE = 5000;

type TournamentMapProps = {
    isMock?: boolean;
    viewOnly?: boolean;
    overrideBracketData?: any[];
    initialBracketId?: string | null;
    onRunPersonalSim?: () => void;       // handler for bottom-bar button
    onClose?: () => void;
};

export default function TournamentMap({ isMock = false, viewOnly = false, overrideBracketData, onRunPersonalSim, initialBracketId, onClose }: TournamentMapProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isTablet = width >= 768;
    const isAndroid = Platform.OS === 'android';
    const navigation = useNavigation();
    const [phase, setPhase] = useState<string | null>(null);

    useLayoutEffect(() => {
        // ONLY hide the header if this is the pushed Official Bracket screen
        if (!isMock) {
            navigation.setOptions({ headerShown: false });
        }
    }, [navigation, isMock]);

    // FETCH THE PHASE INSIDE MAP.TSX (Add this useEffect block)
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/tournament/state?season=2036`);
                const data = await res.json();
                setPhase(data.phase);
            } catch (e) { console.log(e); }
        })();
    }, []);

    // --- DYNAMIC FORCEFIELD LOGIC ---
    // iPad: keep original. (-1035)
    // iPhone: keep current behavior. (-1250)
    // Android phones: allow much more travel so bottom of bracket is reachable.
    const maxY = isTablet
        ? (isMock ? -1035 : -1035) // -1035 remains locked for Bracketology (iPad)
        : isAndroid
            ? (isMock ? -1328 : -1420) // -1328 remains locked for Bracketology (Android)
            : (isMock ? -1250 : -1250); // -1250 remains locked for Bracketology (iPhone)
    // iPad stays at your original -85 top limit. iPhone gets more room at -20.
    const minY = isTablet ? -85 : -60;

    // --- HORIZONTAL FORCEFIELD LOGIC ---
    // maxX: The "Left Wall" (How far you can pan to see the left side)
    const maxX = isTablet ? -2542 : -2920; // Try -2650 for iPhone to see more left
    // minX: The "Right Wall" (How far you can pan to see the right side)
    const minX = isTablet ? -327 : -327;   // Try -150 for iPhone to see more right

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

    // iPad starts at your original -1000. iPhone starts higher at -350.
    const translateX = useSharedValue(-1000);
    const translateY = useSharedValue(isTablet ? -1000 : -350);

    const startX = useSharedValue(-1000);
    const startY = useSharedValue(isTablet ? -1000 : -350);

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

    // Note: We use the already-gated teamNames map we just created in loadData
    const champName = champTeamId ? (teamNames[champTeamId] || getTeamBranding(champTeamId, null).displayName) : null;
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

    const panGesture = Gesture.Pan()
        .onStart(() => {
            // Stop any ongoing momentum immediately
            cancelAnimation(translateX);
            cancelAnimation(translateY);

            // Capture where the map is at the exact moment you touch it
            startX.value = translateX.value;
            startY.value = translateY.value;
        })
        .onUpdate((e) => {
            // Calculate the new position and keep it inside your forcefield
            translateX.value = Math.min(minX, Math.max(e.translationX + startX.value, maxX));
            translateY.value = Math.min(minY, Math.max(e.translationY + startY.value, maxY));
        })
        .onEnd((e) => {
            // Apply the "Hot Wheels" glide effect
            translateX.value = withDecay({
                velocity: e.velocityX,
                clamp: [maxX, minX], // [Left Wall, Right Wall]
                deceleration: 0.995,
            });
            translateY.value = withDecay({
                velocity: e.velocityY,
                clamp: [maxY, minY], // [Bottom Wall, Top Wall]
                deceleration: 0.995,
            });
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value }
        ]
    }));

    const headerAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
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

            // 1. Parallel Launch
            const responses = await Promise.all([
                fetch(`${API_BASE_URL}/api/tournament/brackets?season=2036&cb=${cb}`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/tournament/bracket?season=2036&cb=${cb}`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/tournament/seeds?season=2036&cb=${cb}`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/tournament/team-names?cb=${cb}`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            // Helper to prevent JSON parsing crashes on HTML error pages
            const safeJson = async (res: Response, label: string) => {
                const contentType = res.headers.get("content-type");
                if (res.ok && contentType && contentType.includes("application/json")) {
                    return res.json();
                }
                console.error(`[MAP ERROR] ${label} failed: ${res.status} (${res.statusText})`);
                return label === "team-names" ? {} : [];
            };

            const [brackets, apiBracketData, seedListData, namesData] = await Promise.all([
                safeJson(responses[0], "brackets"),
                safeJson(responses[1], "main-bracket"),
                safeJson(responses[2], "seeds"),
                safeJson(responses[3], "team-names")
            ]);

            // Use override data if provided (personal sim), otherwise use API data
            const bracketData = (isMock && overrideBracketData && overrideBracketData.length > 0)
                ? overrideBracketData
                : apiBracketData;

            // 2. Process Team Names and Stats immediately using the Branding Gate
            const gatedNames: Record<string, string> = {};
            Object.keys(namesData).forEach(tid => {
                // We pass the real name from the API into branding
                gatedNames[tid] = getTeamBranding(tid, namesData[tid]).displayName;
            });
            setTeamNames(gatedNames);
            const statsMap: Record<string, any> = {};
            (seedListData || []).forEach((row: any) => {
                statsMap[row.team_id] = {
                    ppg: row.ppg ?? 0,
                    rpg: row.rpg ?? 0,
                    apg: row.apg ?? 0,
                    spg: row.spg ?? 0,        // Ensures 0 shows up
                    bpg: row.bpg ?? 0,        // Ensures 0 shows up
                    fg_pct: row.fg_pct ?? 0,
                    three_pct: row.three_pct ?? 0,
                    ft_pct: row.ft_pct ?? 0,  // Ensures 0 shows up instead of undefined
                    oppg: row.oppg ?? 0,
                    topg: row.topg ?? 0,
                    fpg: row.fpg ?? 0,
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
        if (isMock || viewOnly || phase === 'LIVE') return; // LOCK THE GATES
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
        if (!bracketId) return;

        Alert.alert(
            "Save Picks",
            "Saving your current picks will also take you back to the 'My Brackets' screen. Proceed?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Save & Exit",
                    onPress: async () => {
                        setLocking(true);
                        try {
                            const token = await getToken();
                            if (!token) return;

                            const nonEmptyPicks: { [k: string]: string } = {};
                            Object.entries(picks).forEach(([gameId, winnerId]) => {
                                if (winnerId && winnerId !== "TBD") {
                                    nonEmptyPicks[gameId] = winnerId;
                                }
                            });

                            // THE MISSING LINE:
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

                            if (res.ok) {
                                if (onClose) onClose(); // Take user back to list
                            } else {
                                Alert.alert("Error", "Failed to save picks. Check connection.");
                            }
                        } catch (e) {
                            console.log("Error locking bracket:", e);
                        } finally {
                            setLocking(false);
                        }
                    }
                }
            ]
        );
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
            {/* FORCE HIDE THE NATIVE HEADER */}
            <Stack.Screen options={{
                headerShown: false,
                headerTransparent: true,
                headerTitle: ""
            }} />
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
                                                        {/* Top stripe (like a championship header band) */}
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

                <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    backgroundColor: theme.background,
                    borderBottomWidth: 1,
                    borderBottomColor: '#333',
                    overflow: 'hidden',
                    // Guarded height: Bracketology stays at 72... Official gets proper notch room.
                    height: isMock
                        ? (72 + (isTablet ? 0 : insets.top - 22))
                        : isTablet
                            ? 72
                            : isAndroid
                                ? 80   // <-- Nudge Android Height independently
                                : 98,  // <-- Nudge iPhone Height independently
                }}>
                    {/* ✕ EXIT BUTTON - ONLY FOR OFFICIAL MODE */}
                    {!isMock && (
                        <Pressable
                            onPress={onClose} // CHANGE THIS FROM router.back() to onClose
                            style={{
                                position: 'absolute',
                                left: 15,
                                top: isTablet
                                    ? 12.5
                                    : isAndroid
                                        ? 15 // <-- Nudge Android X Position
                                        : insets.top - 9.5, // <-- Nudge iPhone X Position
                                zIndex: 1100,
                                padding: 10,
                            }}
                        >
                            <Text style={{ color: theme.text, fontSize: 24, fontWeight: '200' }}>✕</Text>
                        </Pressable>
                    )}

                    {/* CENTER TITLE */}
                    <View style={{
                        position: 'absolute',
                        // GUARDED POSITION: Keep your perfect Bracketology math
                        top: isMock
                            ? (isTablet ? 20 : insets.top - 0)
                            : isTablet
                                ? 25
                                : isAndroid
                                    ? 20 // <-- Nudge Android Title Position
                                    : insets.top + 3, // <-- Nudge iPhone Title Position
                        left: 0,
                        right: 0,
                        alignItems: 'center',
                        zIndex: 10
                    }}>
                        <Text style={{ color: theme.text, fontWeight: '900', fontSize: 14, letterSpacing: 0.5 }}>
                            {isMock ? 'LCAA BRACKETOLOGY • 2036' : 'OFFICIAL LCAA BRACKET • 2036'}
                        </Text>
                    </View>

                    {/* SLIDING ROUND HEADERS */}
                    <Animated.View style={[{
                        position: 'absolute',
                        // GUARDED POSITION: Keep your perfect Bracketology math
                        top: isMock
                            ? (20 + (isTablet ? 20 : insets.top))
                            : isTablet
                                ? 45
                                : isAndroid
                                    ? 50 // <-- Nudge Android Headers Position
                                    : insets.top + 23, // <-- Nudge iPhone Headers Position
                        left: 0,
                        flexDirection: 'row'
                    }, headerAnimatedStyle]}>
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

                {/* BOTTOM BAR: Only visible in Official Mode AND if predictions are OPEN AND not in View-Only mode */}
                {!isMock && phase === 'SELECTION_SUNDAY' && !viewOnly ? (
                    <View style={[styles.bottomBar, { backgroundColor: theme.card }]}>
                        <View style={{ flex: 1, justifyContent: 'center' }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 18 }}>
                                <Text style={{ color: theme.text, fontSize: 9, fontWeight: '700' }}>
                                    S16: {getPickCount("Survival_16")}/16  •
                                    R64: {getPickCount("Round_64")}/32  •
                                    R32: {getPickCount("Round_32")}/16  •
                                    S16: {getPickCount("Sweet_16")}/8  •
                                    E8: {getPickCount("Elite_8")}/4  •
                                    F4: {getPickCount("National Semifinals")}/2  •
                                    CHAMP: {getPickCount("Championship")}/1
                                </Text>
                            </ScrollView>
                            <Text style={{ color: theme.mutedText, fontSize: 8, fontWeight: '600', marginTop: 1 }}>
                                {getPickCount("Survival_16") + getPickCount("Round_64") + getPickCount("Round_32") + getPickCount("Sweet_16") + getPickCount("Elite_8") + getPickCount("National Semifinals") + getPickCount("Championship")} / 79 TOTAL
                            </Text>
                        </View>
                        <Pressable
                            onPress={handleLockBracket}
                            style={{
                                paddingHorizontal: 16,
                                paddingVertical: 8,
                                borderRadius: 8,
                                backgroundColor: locking ? theme.border : '#34C759',
                                marginLeft: 8
                            }}
                        >
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>
                                {locking ? 'SAVING...' : 'SAVE PICKS'}
                            </Text>
                        </Pressable>
                    </View>
                ) : (
                    /* Mock Mode Bottom Bar (Your existing Bracketology logic) */
                    isMock ? (
                        <View style={[styles.bottomBar, { backgroundColor: theme.card }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.text, fontSize: 10, fontWeight: '600' }}>
                                    Bracketology: seeded field. Run an AI sim to see one possible tournament path.
                                </Text>
                                <Text style={{ color: '#FF9500', fontSize: 9, fontWeight: '800', marginTop: 2 }}>
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
                        </View>
                    ) : null /* Hidden entirely if LIVE or Peeking */
                )}

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
        height: 60, // Keep base height here
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        overflow: 'hidden',
        zIndex: 1000,
    },
    bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 50, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: '#333', flexDirection: 'row', paddingHorizontal: 10 }
});
