import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

type StatRowProps = {
    label: string;
    valueA: string | number;
    valueB: string | number;
    isCore?: boolean;
};

export default function StatRow({ label, valueA, valueB, isCore }: StatRowProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    return (
        <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <Text style={[styles.value, { color: theme.text, textAlign: 'left' }]}>{valueA}</Text>
            <Text style={[styles.label, { color: theme.mutedText, fontWeight: isCore ? '800' : '400' }]}>
                {label.toUpperCase()}
            </Text>
            <Text style={[styles.value, { color: theme.text, textAlign: 'right' }]}>{valueB}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    label: { flex: 1, textAlign: 'center', fontSize: 12, letterSpacing: 1 },
    value: { flex: 1, fontSize: 16, fontWeight: '700', width: 60 },
});
