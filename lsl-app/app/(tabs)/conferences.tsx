import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ConferencesScreen() {
    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.screenTitle}>Conferences</Text>

            <View style={styles.card}>
                <Text style={styles.conferenceName}>Big East</Text>
                <Text style={styles.context}>Leader: Creighton • 1 ranked team</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.conferenceName}>Big 12</Text>
                <Text style={styles.context}>Leader: Kansas • 2 ranked teams</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.conferenceName}>Big Ten</Text>
                <Text style={styles.context}>Leader: Michigan • 1 ranked team</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.conferenceName}>ACC</Text>
                <Text style={styles.context}>Leader: Duke • 2 ranked teams</Text>
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
    card: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        backgroundColor: '#fafafa',
    },
    conferenceName: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 8,
    },
    context: {
        fontSize: 15,
        opacity: 0.75,
    },
});