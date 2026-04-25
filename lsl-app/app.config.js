import 'dotenv/config';

export default ({ config }) => {
    return {
        ...config,
        // REMOVE the runtimeVersion block entirely
        plugins: [
            ...(config.plugins || []),
            "expo-secure-store"
        ],
        extra: {
            ...config.extra,
            // HARDCODE this for the beta to ensure it never fails
            backendUrl: 'https://lsl-backend.onrender.com',
            eas: {
                projectId: "1123b7ce-5272-4e3c-a214-fca8911aa554",
            },
        },
        updates: {
            url: "https://u.expo.dev/1123b7ce-5272-4e3c-a214-fca8911aa554"
        }
    };
};
