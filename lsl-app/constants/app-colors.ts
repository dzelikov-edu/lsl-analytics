export const AppColors = {
    light: {
        background: '#F7F7F8',
        card: '#FFFFFF',
        border: '#D9D9DE',
        text: '#111111',
        mutedText: '#666A73',
        danger: '#d9534f',
    },
    dark: {
        background: '#0F1115',
        card: '#171A21',
        border: '#2A2F3A',
        text: '#F5F7FA',
        mutedText: '#A7AFBD',
        danger: '#d9534f',
    },
} as const;

export type AppThemeName = keyof typeof AppColors;