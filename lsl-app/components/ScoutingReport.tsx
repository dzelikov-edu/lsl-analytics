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

    const seedA: number | undefined = teamA.seed;
    const seedB: number | undefined = teamB.seed;

    type SRTeam = typeof teamA;

    let leftTeam: SRTeam = teamA;
    let rightTeam: SRTeam = teamB;

    if (typeof seedA === 'number' && typeof seedB === 'number') {
        if (seedA < seedB) {
            // teamA better seed -> home on right
            leftTeam = teamB;
            rightTeam = teamA;
        } else if (seedB < seedA) {
            // teamB better seed -> home on right (already)
            leftTeam = teamA;
            rightTeam = teamB;
        } else {
            // Seeds equal: use overall_rank if available
            const rankA: number | undefined = teamA.overall_rank;
            const rankB: number | undefined = teamB.overall_rank;
            if (typeof rankA === 'number' && typeof rankB === 'number') {
                if (rankA < rankB) {
                    // teamA better rank -> home on right
                    leftTeam = teamB;
                    rightTeam = teamA;
                } else if (rankB < rankA) {
                    leftTeam = teamA;
                    rightTeam = teamB;
                }
            }
        }
    }

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={styles.dismissArea} onPress={onClose} />
                <View style={[styles.sheet, { backgroundColor: theme.background }]}>
                    {/* Handle bar for the "Map" feel */}
                    <View style={[styles.handle, { backgroundColor: theme.border }]} />

                    <View style={styles.header}>
                        <View style={styles.headerTeam}>
                            <TeamLogo teamId={leftTeam.id} size={40} />
                            <Text style={[styles.teamName, { color: theme.text }]} numberOfLines={1}>
                                {typeof leftTeam.seed === 'number' && leftTeam.seed > 0
                                    ? `(${leftTeam.seed}) ${leftTeam.name}`
                                    : leftTeam.name}
                            </Text>
                        </View>
                        <Text style={[styles.vs, { color: theme.mutedText }]}>VS</Text>
                        <View style={styles.headerTeam}>
                            <TeamLogo teamId={rightTeam.id} size={40} />
                            <Text style={[styles.teamName, { color: theme.text }]} numberOfLines={1}>
                                {typeof rightTeam.seed === 'number' && rightTeam.seed > 0
                                    ? `(${rightTeam.seed}) ${rightTeam.name}`
                                    : rightTeam.name}
                            </Text>
                        </View>
                    </View>

                    <ScrollView style={styles.statsScroll}>
                        {/* CORE STATS */}
                        <StatRow
                            label="Record"
                            valueA={leftTeam.record}
                            valueB={rightTeam.record}
                            isCore
                        />
                        <StatRow
                            label="PPG"
                            valueA={leftTeam.ppg}
                            valueB={rightTeam.ppg}
                            isCore
                        />
                        <StatRow
                            label="RPG"
                            valueA={leftTeam.rpg}
                            valueB={rightTeam.rpg}
                            isCore
                        />
                        <StatRow
                            label="FG%"
                            valueA={`${leftTeam.fg_pct ?? 0}%`}
                            valueB={`${rightTeam.fg_pct ?? 0}%`}
                            isCore
                        />
                        <StatRow
                            label="3PT%"
                            valueA={`${leftTeam.three_pct ?? 0}%`}
                            valueB={`${rightTeam.three_pct ?? 0}%`}
                            isCore
                        />
                        <StatRow
                            label="FT%"
                            valueA={`${leftTeam.ft_pct ?? 0}%`}
                            valueB={`${rightTeam.ft_pct ?? 0}%`}
                            isCore
                        />

                        {/* ADVANCED STATS (Conditional) */}
                        {isExpanded && (
                            <View>
                                <StatRow label="APG" valueA={leftTeam.apg} valueB={rightTeam.apg} />
                                <StatRow label="SPG" valueA={leftTeam.spg} valueB={rightTeam.spg} />
                                <StatRow label="BPG" valueA={leftTeam.bpg} valueB={rightTeam.bpg} />
                                <StatRow label="OPPG" valueA={leftTeam.oppg} valueB={rightTeam.oppg} />
                                <StatRow label="TOPG" valueA={leftTeam.topg} valueB={rightTeam.topg} />
                                <StatRow label="FPG" valueA={leftTeam.fpg} valueB={rightTeam.fpg} />
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
