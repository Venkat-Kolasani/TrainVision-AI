// Configuration for the application
export const config = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  APP_TITLE: import.meta.env.VITE_APP_TITLE || 'TrainVision AI',
  APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
} as const;

export default config;