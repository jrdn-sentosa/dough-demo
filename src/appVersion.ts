/** The app version, for Settings and for feedback. Falls back to "dev" if the build didn't set it. */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
