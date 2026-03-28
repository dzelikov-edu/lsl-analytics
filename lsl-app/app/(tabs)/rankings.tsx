import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function RankingsScreen() {
    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.screenTitle}>Rankings</Text>

            <View style={styles.switcherRow}>
                <View style={[styles.switchPill, styles.switchPillActive]}>
                    <Text style={[styles.switchText, styles.switchTextActive]}>LSL Poll</Text>
                </View>
                <View style={styles.switchPill}>
                    <Text style={styles.switchText}>LCAA Poll</Text>
                </View>
            </View>

            <View style={styles.listCard}>
                <Text style={styles.listRow}>1. Creighton</Text>
                <Text style={styles.listRow}>2. Marquette</Text>
                <Text style={styles.listRow}>3. Michigan</Text>
                <Text style={styles.listRow}>4. Oklahoma State</Text>
                <Text style={styles.listRow}>5. Kansas</Text>
                <Text style={styles.listRow}>6. Notre Dame</Text>
                <Text style={styles.listRow}>7. UCLA</Text>
                <Text style={styles.listRow}>8. Kansas State</Text>
                <Text style={styles.listRow}>9. Duke</Text>
                <Text style={styles.listRow}>10. Arizona</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: {
        padding: 20,
        paddingBottom: 40,
        backgroundColor: '#fff',
    },
    screenTitle: {
        fontSize: 32,
        fontWeight: '800',
        marginBottom: 20,
    },
    switcherRow: {
        flexDirection: 'row',
        marginBottom: 18,
        gap: 10,
    },
    switchPill: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 999,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#f4f4f4',
    },
    switchPillActive: {
        backgroundColor: '#111',
        borderColor: '#111',
    },
    switchText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    switchTextActive: {
        color: '#fff',
    },
    listCard: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 14,
        padding: 14,
        backgroundColor: '#fafafa',
    },
    listRow: {
        fontSize: 18,
        marginBottom: 10,
    },
});