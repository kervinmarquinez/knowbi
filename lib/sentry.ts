import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

let initialized = false;

export function initSentry() {
  if (initialized) return;
  if (!DSN) {
    if (__DEV__) console.warn('Sentry DSN missing (EXPO_PUBLIC_SENTRY_DSN) — error tracking disabled.');
    return;
  }
  Sentry.init({
    dsn: DSN,
    debug: false,
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
    enableNativeCrashHandling: true,
  });
  initialized = true;
}

export function setSentryUser(userId: string | null) {
  if (!initialized) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

export const wrap = Sentry.wrap;
