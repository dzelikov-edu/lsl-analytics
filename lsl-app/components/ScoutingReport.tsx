import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import StatRow from './StatRow';
import TeamLogo from './TeamLogo';

type ScoutingReportProps = {
    visible: boolean;
    onClose: () => void;
    teamA: any;
    teamB: any;
};

export default function ScoutingReport({ visible, onClose, teamA, teamB }: ScoutingReportProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];
    const [isExpanded, setIsExpanded] = useState(false);

    if (!teamA || !teamB) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={styles.dismissArea} onPress={onClose} />
                <View style={[styles.sheet, { backgroundColor: theme.background }]}>
                    {/* Handle bar for the "Map" feel */}
                    <View style={[styles.handle, { backgroundColor: theme.border }]} />

                    <View style={styles.header}>
                        <View style={styles.headerTeam}>
                            <TeamLogo teamId={teamA.id} size={40} />
                            <Text style={[styles.teamName, { color: theme.text }]}>{teamA.name}</Text>
                        </View>
                        <Text style={[styles.vs, { color: theme.mutedText }]}>VS</Text>
                        <View style={styles.headerTeam}>
                            <TeamLogo teamId={teamB.id} size={40} />
                            <Text style={[styles.teamName, { color: theme.text }]}>{teamB.name}</Text>
                        </View>
                    </View>

                    <ScrollView style={styles.statsScroll}>
                        {/* CORE STATS */}
                        <StatRow label="Record" valueA={teamA.record} valueB={teamB.record} isCore />
                        <StatRow label="PPG" valueA={teamA.ppg} valueB={teamB.ppg} isCore />
                        <StatRow label="RPG" valueA={teamA.rpg} valueB={teamB.rpg} isCore />
                        <StatRow label="FG%" valueA={`${teamA.fg_pct ?? 0}%`} valueB={`${teamB.fg_pct ?? 0}%`} isCore />
                        <StatRow label="3PT%" valueA={`${teamA.three_pct ?? 0}%`} valueB={`${teamB.three_pct ?? 0}%`} isCore />
                        <StatRow label="FT%" valueA={`${teamA.ft_pct ?? 0}%`} valueB={`${teamB.ft_pct ?? 0}%`} isCore />

                        {/* ADVANCED STATS (Conditional) */}
                        {isExpanded && (
                            <View>
                                <StatRow label="APG" valueA={teamA.apg} valueB={teamB.apg} />
                                <StatRow label="SPG" valueA={teamA.spg} valueB={teamB.spg} />
                                <StatRow label="BPG" valueA={teamA.bpg} valueB={teamB.bpg} />
                                <StatRow label="OPPG" valueA={teamA.oppg} valueB={teamB.oppg} />
                                <StatRow label="TOPG" valueA={teamA.topg} valueB={teamB.topg} />
                                <StatRow label="FPG" valueA={teamA.fpg} valueB={teamB.fpg} />
                            </View>
                        )}

                        <Pressable style={styles.expandButton} onPress={() => setIsExpanded(!isExpanded)}>
                            <Text style={{ color: '#007AFF', fontWeight: '700' }}>
                                {isExpanded ? 'Show Less' : 'Show Advanced Stats'}
                            </Text>
                        </Pressable>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    dismissArea: { flex: 1 },
    sheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '80%',
    },
    handle: { width: 40, height: 5, borderRadius: 2.5, alignSelf: 'center', marginBottom: 15 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerTeam: { alignItems: 'center', flex: 1 },
    teamName: { fontSize: 14, fontWeight: '800', marginTop: 8, textAlign: 'center' },
    vs: { fontSize: 18, fontWeight: '900', marginHorizontal: 10 },
    statsScroll: { marginTop: 10 },
    expandButton: { padding: 20, alignItems: 'center' },
});
