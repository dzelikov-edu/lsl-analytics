export const AppColors = {
    light: {
        background: '#F7F7F8',
        card: '#FFFFFF',
        border: '#D9D9DE',
        text: '#111111',
        mutedText: '#666A73',
    },
    dark: {
        background: '#0F1115',
        card: '#171A21',
        border: '#2A2F3A',
        text: '#F5F7FA',
        mutedText: '#A7AFBD',
    },
} as const;

export type AppThemeName = keyof typeof AppColors;