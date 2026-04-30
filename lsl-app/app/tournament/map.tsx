import React, { useState } from 'react';
import { StyleSheet, View, Dimensions, Text } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';

import TournamentMatchup from '@/components/TournamentMatchup';
import ScoutingReport from '@/components/ScoutingReport';
import { getGameCoordinates } from '@/lib/bracketLayout';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function TournamentMap() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    // -- STATE FOR SCOUTING REPORT --
    const [selectedMatchup, setSelectedMatchup] = useState<any>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const offset = useSharedValue({ x: 0, y: 0 });
    const scale = useSharedValue(1);
    const start = useSharedValue({ x: 0, y: 0 });

    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            offset.value = {
                x: e.translationX + start.value.x,
                y: e.translationY + start.value.y,
            };
        })
        .onEnd(() => {
            start.value = {
                x: offset.value.x,
                y: offset.value.y,
            };
        });

    const pinchGesture = Gesture.Pinch().onUpdate((e) => { scale.value = e.scale; });
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: offset.value.x },
            { translateY: offset.value.y },
            { scale: scale.value },
        ],
    }));

    // Composing the gestures
    const composed = Gesture.Simultaneous(panGesture, pinchGesture);

    // -- HANDLER TO OPEN REPORT --
    const openScoutingReport = (matchup: any) => {
        setSelectedMatchup(matchup);
        setModalVisible(true);
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <GestureDetector gesture={Gesture.Simultaneous(panGesture, pinchGesture)}>
                    <Animated.View style={[styles.canvas, animatedStyle]}>

                        {/* EXAMPLE: ONE MATCHUP ON THE MAP */}
                        <View style={{ position: 'absolute', left: 300, top: 200 }}>
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

                        {/* REGION LABEL */}
                        <View style={[styles.regionMarker, { top: 50, left: 300 }]}>
                            <Text style={{ fontSize: 60, fontWeight: '900', color: theme.border }}>MIDWEST</Text>
                        </View>

                    </Animated.View>
                </GestureDetector>

                {/* THE BOTTOM SHEET MODAL */}
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
    canvas: { width: 4000, height: 6000 },
    regionMarker: { position: 'absolute', opacity: 0.3 }
});
