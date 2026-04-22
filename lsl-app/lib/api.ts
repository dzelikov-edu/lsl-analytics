// This reads from the EXPO_PUBLIC_BACKEND_URL in your .env file
export const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';

console.log('App is connecting to API at:', API_BASE_URL);
