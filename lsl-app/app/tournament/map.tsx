import React, { useState } from 'react';
import { StyleSheet, View, Dimensions, Text } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';

import TournamentMatchup from '@/components/TournamentMatchup';
import ScoutingReport from '@/components/ScoutingReport';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// MAP BOUNDARIES: Adjust these based on your total bracket size
const MAP_WIDTH = 4000;
const MAP_HEIGHT = 6000;

export default function TournamentMap() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    const [selectedMatchup, setSelectedMatchup] = useState<any>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const offset = useSharedValue({ x: 0, y: 0 });
    const start = useSharedValue({ x: 0, y: 0 });

    // 1. SIMPLIFIED PAN GESTURE (No Zoom, with Boundaries)
    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            const nextX = e.translationX + start.value.x;
            const nextY = e.translationY + start.value.y;

            // Simple "Guardrail" Logic: 
            // Prevents dragging too far past the edges
            offset.value = {
                x: Math.min(0, Math.max(nextX, -(MAP_WIDTH - SCREEN_WIDTH))),
                y: Math.min(0, Math.max(nextY, -(MAP_HEIGHT - SCREEN_HEIGHT))),
            };
        })
        .onEnd(() => {
            start.value = { x: offset.value.x, y: offset.value.y };
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: offset.value.x },
            { translateY: offset.value.y },
        ],
    }));

    const openScoutingReport = (matchup: any) => {
        setSelectedMatchup(matchup);
        setModalVisible(true);
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.canvas, animatedStyle]}>

                        {/* REGION LABEL: Lightened for better readability */}
                        <View style={[styles.regionMarker, { top: 100, left: 300 }]}>
                            <Text style={[styles.regionText, { color: theme.mutedText, opacity: 0.15 }]}>
                                MIDWEST
                            </Text>
                        </View>

                        <View style={{ position: 'absolute', left: 300, top: 250 }}>
                            <TournamentMatchup
                                teamA={{ id: 'KU', name: 'Kansas', seed: 1 }}
                                teamB={{ id: 'MSU', name: 'Michigan State', seed: 8 }}
                                status="PREDICTION"
                                onPress={() => openScoutingReport({
                                    teamA: { id: 'KU', name: 'Kansas', record: '28-4', ppg: 78.5, rpg: 38.2, fg_pct: 48, three_pct: 36, apg: 15, spg: 7, bpg: 5, oppg: 65, topg: 11, fpg: 14 },
                                    teamB: { id: 'MSU', name: 'Michigan State', record: '22-11', ppg: 72.1, rpg: 35.5, fg_pct: 44, three_pct: 34, apg: 12, spg: 6, bpg: 4, oppg: 68, topg: 13, fpg: 16 }
                                })}
                            />
                        </View>

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
    regionMarker: { position: 'absolute' },
    regionText: { fontSize: 80, fontWeight: '900', letterSpacing: -2 }
});
