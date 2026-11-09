/**
 * config.ts - All environment variables in one place.
 * Import from here everywhere - never use import.meta.env directly.
 * Change URLs by editing .env.development or .env.production only.
 */

const config = {
  // Django API base URL
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL as string,

  // Ollama public URL - used for health check only
  // NOTE: Frontend never calls Ollama directly for chat.
  //       All chat goes through Django /api/advisor-chat/
  ollamaUrl: import.meta.env.VITE_OLLAMA_URL as string,

  // App info
  appName: (import.meta.env.VITE_APP_NAME as string) || 'UniGuide AI',
  appEnv: (import.meta.env.VITE_APP_ENV as string) || 'development',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;

export default config;

// Validate required vars on startup
const required = ['VITE_API_BASE_URL'] as const;
required.forEach((key) => {
  if (!import.meta.env[key]) {
    console.warn(`Warning: Missing env var: ${key}`);
  }
});
