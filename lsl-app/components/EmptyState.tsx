import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { IconSymbol } from './ui/icon-symbol'; // Using your existing icons

type EmptyStateProps = {
    title: string;
    description: string;
    buttonText: string;
    theme: any;
};

export function EmptyState({ title, description, buttonText, theme }: EmptyStateProps) {
    return (
        <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <IconSymbol size={48} name="person.3.fill" color={theme.mutedText} />
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.description, { color: theme.mutedText }]}>{description}</Text>

            <Pressable
                style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: theme.text, opacity: pressed ? 0.8 : 1 }
                ]}
                onPress={() => router.push('/teams')}
            >
                <Text style={[styles.buttonText, { color: theme.background }]}>{buttonText}</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        marginTop: 12,
        marginBottom: 8,
        textAlign: 'center',
    },
    description: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    button: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 10,
    },
    buttonText: {
        fontSize: 15,
        fontWeight: '700',
    },
});
