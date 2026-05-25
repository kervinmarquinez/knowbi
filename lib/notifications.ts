import { Platform, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

const DAILY_PILLS_CHANNEL_ID = 'daily-pills';

let handlerConfigured = false;

export function configureNotificationHandler() {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(DAILY_PILLS_CHANNEL_ID, {
    name: 'Píldoras del día',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#7F77DD',
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  });
}

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    (Constants as { manifest?: { extra?: { eas?: { projectId?: string } } } }).manifest?.extra?.eas?.projectId
  );
}

export async function getNotificationPermissionStatus(): Promise<
  'granted' | 'denied' | 'undetermined'
> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function openSystemNotificationSettings(): Promise<void> {
  await Linking.openSettings();
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function registerForExpoPushToken(): Promise<string | null> {
  try {
    await ensureAndroidChannel();
    const projectId = getProjectId();
    const tokenResult = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    return tokenResult.data ?? null;
  } catch (e) {
    const err = e as { name?: string; message?: string; code?: string; stack?: string };
    console.error('registerForExpoPushToken failed', {
      name: err?.name,
      message: err?.message,
      code: err?.code,
      hasProjectId: !!getProjectId(),
      stack: err?.stack,
    });
    return null;
  }
}

export async function savePushTokenToSupabase(token: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  await supabase
    .from('user_preferences')
    .update({ expo_push_token: token })
    .eq('user_id', userData.user.id);
}

// Idempotente: si el token ya está guardado o el permiso no está concedido, no hace nada.
// Si falta el token y hay permiso, intenta registrarlo y guardarlo. Errores silenciados
// (logueados) — es recuperación best-effort, no debe bloquear el boot.
export async function ensurePushTokenRegistered(userId: string): Promise<void> {
  try {
    const { data: row, error } = await supabase
      .from('user_preferences')
      .select('expo_push_token')
      .eq('user_id', userId)
      .single();
    if (error || row?.expo_push_token) return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const token = await registerForExpoPushToken();
    if (!token) return;

    await savePushTokenToSupabase(token);
  } catch (e) {
    console.warn('ensurePushTokenRegistered failed', e);
  }
}

