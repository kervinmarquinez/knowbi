import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const USER_ID_KEY = 'knowbi_user_id';
const OAUTH_REDIRECT_URL = 'knowbi://auth-callback';

WebBrowser.maybeCompleteAuthSession();

export type AuthResult =
  | { success: true; session: Session }
  | { success: false; error: string };

export type SignUpResult =
  | { kind: 'session'; session: Session }
  | { kind: 'confirmation_required'; email: string }
  | { kind: 'error'; error: string };

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Contraseña incorrecta. Inténtalo de nuevo.';
  if (m.includes('email rate limit') || m.includes('over_email_send_rate_limit')) {
    return 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.';
  }
  if (m.includes('email not confirmed')) return 'Confirma tu email antes de iniciar sesión.';
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'Ya existe una cuenta con este email. Inicia sesión.';
  }
  if (m.includes('manual linking is disabled')) {
    return 'La vinculación de cuentas está desactivada. Activa "Manual Linking" en Supabase → Authentication → Settings.';
  }
  if (m.includes('weak password') || m.includes('password should be')) {
    return 'La contraseña es demasiado débil. Usa al menos 6 caracteres con letras y números.';
  }
  if (m.includes('token has expired') || m.includes('otp expired')) {
    return 'El código ha caducado. Solicita uno nuevo.';
  }
  if (m.includes('invalid otp') || m.includes('token is invalid') || m.includes('token not found')) {
    return 'Código inválido. Comprueba los dígitos e inténtalo otra vez.';
  }
  if (m.includes('signups not allowed')) {
    return 'No encontramos una cuenta con ese email.';
  }
  if (m.includes('identity is already linked') || m.includes('identity_already_exists')) {
    return 'Esta cuenta de Google ya está vinculada a otro usuario. Inicia sesión en su lugar.';
  }
  if (m.includes('network')) return 'Sin conexión. Comprueba tu internet e inténtalo otra vez.';
  return msg;
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function ensureAnonymousSession(): Promise<Session> {
  const existing = await getSession();
  if (existing) {
    await AsyncStorage.setItem(USER_ID_KEY, existing.user.id);
    return existing;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.session) throw new Error('Anonymous sign-in returned no session');
  await AsyncStorage.setItem(USER_ID_KEY, data.session.user.id);
  return data.session;
}

export async function isAnonymous(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return session.user.is_anonymous === true;
}

// Devuelve true si la sesión actual es anónima Y tiene progreso digno de avisar
// antes de un login que cambie de cuenta (lee, guardado, o racha > 0).
// Las categorías no cuentan: son fáciles de recrear y no son progreso real.
export async function hasValuableAnonData(): Promise<boolean> {
  const session = await getSession();
  if (!session?.user.is_anonymous) return false;
  const userId = session.user.id;

  try {
    const [pillsRes, streakRes] = await Promise.all([
      supabase
        .from('daily_pills')
        .select('id')
        .eq('user_id', userId)
        .or('is_read.eq.true,is_saved.eq.true')
        .limit(1),
      supabase
        .from('user_streaks')
        .select('current_streak')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    if (pillsRes.data && pillsRes.data.length > 0) return true;
    if ((streakRes.data?.current_streak ?? 0) > 0) return true;
    return false;
  } catch (e) {
    console.warn('hasValuableAnonData check failed', e);
    return false;
  }
}

export async function signUpWithPassword(email: string, password: string): Promise<SignUpResult> {
  const anonSession = await getSession();
  const isAnon = anonSession?.user.is_anonymous === true;

  if (isAnon) {
    const { error: updateError } = await supabase.auth.updateUser({ email, password });
    if (updateError) return { kind: 'error', error: translateAuthError(updateError.message) };
    const refreshed = await getSession();
    if (!refreshed) return { kind: 'error', error: 'No se pudo actualizar la sesión' };
    await AsyncStorage.setItem(USER_ID_KEY, refreshed.user.id);
    return { kind: 'session', session: refreshed };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: OAUTH_REDIRECT_URL },
  });
  if (error) return { kind: 'error', error: translateAuthError(error.message) };

  // Anti-enumeration quirk: when the email is already registered AND confirmed,
  // Supabase returns a fake user with identities=[] and no session. We surface
  // it as a normal "already registered" error so the UI can route to login.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { kind: 'error', error: 'Ya existe una cuenta con este email. Inicia sesión.' };
  }

  if (!data.session) {
    return { kind: 'confirmation_required', email };
  }
  await AsyncStorage.setItem(USER_ID_KEY, data.session.user.id);
  return { kind: 'session', session: data.session };
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, error: translateAuthError(error.message) };
  if (!data.session) return { success: false, error: 'No se pudo iniciar sesión' };
  await AsyncStorage.setItem(USER_ID_KEY, data.session.user.id);
  return { success: true, session: data.session };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await AsyncStorage.removeItem(USER_ID_KEY);
}

export async function sendOtpToEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  return { ok: true };
}

export async function verifyEmailOtp(email: string, token: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) return { success: false, error: translateAuthError(error.message) };
  if (!data.session) return { success: false, error: 'Código inválido o expirado.' };
  await AsyncStorage.setItem(USER_ID_KEY, data.session.user.id);
  return { success: true, session: data.session };
}

export async function updatePassword(newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Sesión expirada. Vuelve a abrir el enlace del email.' };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  return { ok: true };
}

export async function getEffectiveCategories(): Promise<string[]> {
  const local = await AsyncStorage.getItem('user_categories');
  if (local) {
    try {
      const parsed = JSON.parse(local) as unknown;
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((c): c is string => typeof c === 'string');
        if (valid.length > 0) return valid;
      }
    } catch {
      // fall through to Supabase
    }
  }
  const session = await getSession();
  if (!session) return [];
  const { data } = await supabase
    .from('user_preferences')
    .select('categories')
    .eq('user_id', session.user.id)
    .maybeSingle();
  const cats = data?.categories;
  if (Array.isArray(cats)) {
    const valid = cats.filter((c): c is string => typeof c === 'string');
    if (valid.length > 0) {
      await AsyncStorage.setItem('user_categories', JSON.stringify(valid));
    }
    return valid;
  }
  return [];
}

function parseTokensFromCallbackUrl(url: string): { access_token: string; refresh_token: string } | null {
  const hashIdx = url.indexOf('#');
  if (hashIdx === -1) return null;
  const fragment = url.slice(hashIdx + 1);
  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

function parseCodeFromCallbackUrl(url: string): string | null {
  const queryIdx = url.indexOf('?');
  if (queryIdx === -1) return null;
  const hashIdx = url.indexOf('#', queryIdx);
  const queryStr = hashIdx === -1 ? url.slice(queryIdx + 1) : url.slice(queryIdx + 1, hashIdx);
  const params = new URLSearchParams(queryStr);
  return params.get('code');
}

export async function completeOAuthFromUrl(url: string): Promise<AuthResult | null> {
  if (!url.includes('auth-callback')) return null;

  const code = parseCodeFromCallbackUrl(url);
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { success: false, error: error.message };
    if (!data.session) return { success: false, error: 'No se pudo establecer la sesión' };
    await AsyncStorage.setItem(USER_ID_KEY, data.session.user.id);
    return { success: true, session: data.session };
  }

  const tokens = parseTokensFromCallbackUrl(url);
  if (tokens) {
    const { data, error } = await supabase.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
    if (error) return { success: false, error: error.message };
    if (!data.session) return { success: false, error: 'No se pudo establecer la sesión' };
    await AsyncStorage.setItem(USER_ID_KEY, data.session.user.id);
    return { success: true, session: data.session };
  }

  return null;
}

export type GoogleIntent = 'login' | 'signup';

export async function signInWithGoogle(intent: GoogleIntent = 'login'): Promise<AuthResult> {
  const existing = await getSession();
  const isAnon = existing?.user.is_anonymous === true;

  // 'signup' + anon  → linkIdentity para preservar el user_id anónimo
  // 'signup' + no anon → signInWithOAuth normal (signup limpio)
  // 'login' (cualquier estado) → signInWithOAuth (reemplaza sesión actual)
  const useLink = intent === 'signup' && isAnon;

  const oauthCall = useLink
    ? supabase.auth.linkIdentity({
        provider: 'google',
        options: { redirectTo: OAUTH_REDIRECT_URL, skipBrowserRedirect: true },
      })
    : supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: OAUTH_REDIRECT_URL, skipBrowserRedirect: true },
      });

  const { data: oauthData, error: oauthError } = await oauthCall;
  if (oauthError) return { success: false, error: translateAuthError(oauthError.message) };
  if (!oauthData?.url) return { success: false, error: 'No se recibió URL de autenticación' };

  const result = await WebBrowser.openAuthSessionAsync(oauthData.url, OAUTH_REDIRECT_URL);

  if (result.type === 'success' && result.url) {
    const completed = await completeOAuthFromUrl(result.url);
    if (completed) return completed;
  }

  // Fallback: deep link listener may have completed the session in parallel
  await new Promise((r) => setTimeout(r, 400));
  const refreshed = await getSession();
  if (refreshed && refreshed.user.is_anonymous === false) {
    await AsyncStorage.setItem(USER_ID_KEY, refreshed.user.id);
    return { success: true, session: refreshed };
  }

  return { success: false, error: 'Inicio de sesión cancelado o no completado' };
}

export type ConvertResult =
  | { success: true }
  | { success: false; error: string };

export async function convertAnonymousToReal(email: string): Promise<ConvertResult> {
  const session = await getSession();
  if (!session) return { success: false, error: 'No active session' };

  const { error } = await supabase.auth.updateUser({ email });
  if (error) return { success: false, error: error.message };
  return { success: true };
}
