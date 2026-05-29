import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useAndroidTabBarPad } from '../../../lib/useAndroidTabBarPad';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Button } from '../../../lib/ui/Button';
import { supabase } from '../../../lib/supabase';
import { signOut } from '../../../lib/auth';
import {
  requestNotificationPermission,
  registerForExpoPushToken,
  savePushTokenToSupabase,
  getNotificationPermissionStatus,
  openSystemNotificationSettings,
} from '../../../lib/notifications';

const NOTIFICATION_TIME_KEY = 'notification_time';
const NOTIFICATION_ENABLED_KEY = 'notification_enabled';
const USER_CATEGORIES_KEY = 'user_categories';

function parseTimeString(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function formatHour(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

type OSPermissionStatus = 'granted' | 'denied' | 'undetermined';

type AjustesState = {
  notificationTime: Date;
  notificationEnabled: boolean;
  osPermissionStatus: OSPermissionStatus;
  categoryCount: number;
  displayName: string | null;
  email: string | null;
  isAnonymous: boolean;
};

type PrefRow = {
  notification_time: string | null;
  notification_enabled: boolean | null;
  categories: string[] | null;
};

function pickDisplayName(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;
  const fullName = metadata.full_name;
  if (typeof fullName === 'string' && fullName.trim()) return fullName.trim();
  const name = metadata.name;
  if (typeof name === 'string' && name.trim()) return name.trim();
  return null;
}

export default function AjustesScreen() {
  const router = useRouter();
  const androidTabBarPad = useAndroidTabBarPad();
  const appVersion = Constants.expoConfig?.version;

  const [state, setState] = useState<AjustesState>({
    notificationTime: parseTimeString('09:00'),
    notificationEnabled: false,
    osPermissionStatus: 'undetermined',
    categoryCount: 0,
    displayName: null,
    email: null,
    isAnonymous: false,
  });

  const [activating, setActivating] = useState(false);
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        const userId = user?.id;

        const [prefResult, localTime, localEnabled, localCategories, osPermissionStatus] =
          await Promise.all([
            userId
              ? supabase
                  .from('user_preferences')
                  .select('notification_time, notification_enabled, categories')
                  .eq('user_id', userId)
                  .maybeSingle<PrefRow>()
              : Promise.resolve({ data: null as PrefRow | null }),
            AsyncStorage.getItem(NOTIFICATION_TIME_KEY),
            AsyncStorage.getItem(NOTIFICATION_ENABLED_KEY),
            AsyncStorage.getItem(USER_CATEGORIES_KEY),
            getNotificationPermissionStatus(),
          ]);

        if (cancelled) return;

        const prefData = prefResult.data;

        const timeStr = prefData?.notification_time ?? localTime ?? '09:00';
        const notificationEnabled = prefData?.notification_enabled ?? localEnabled === 'true';

        let categoryCount = 0;
        if (prefData?.categories) {
          categoryCount = prefData.categories.length;
        } else if (localCategories) {
          try {
            categoryCount = (JSON.parse(localCategories) as string[]).length;
          } catch {
            categoryCount = 0;
          }
        }

        setState({
          notificationTime: parseTimeString(timeStr),
          notificationEnabled,
          osPermissionStatus,
          categoryCount,
          displayName: pickDisplayName(user?.user_metadata),
          email: user?.email ?? null,
          isAnonymous: user?.is_anonymous === true,
        });
        setReady(true);
      }

      load().catch((e) => {
        console.error('ajustes load error', e);
        if (!cancelled) setReady(true);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const onTimeChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (!selected) return;
    // La hora de drop opera por horas en punto (la ventana usa solo la hora). Redondeamos
    // a HH:00 para que coincidan el drop, el push y la cuenta atrás de Completado.
    const floored = new Date(selected);
    floored.setMinutes(0, 0, 0);
    const hhmm = formatHour(floored);
    setState((prev) => ({ ...prev, notificationTime: floored }));
    Promise.all([
      AsyncStorage.setItem(NOTIFICATION_TIME_KEY, hhmm),
      (async () => {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return;
        const { error: updateErr } = await supabase
          .from('user_preferences')
          .update({ notification_time: hhmm })
          .eq('user_id', userData.user.id);
        if (updateErr) console.error('notification_time update error', updateErr);
      })(),
    ]).catch((e) => console.error('ajustes time save error', e));
  };

  const openAndroidTimePicker = () => {
    DateTimePickerAndroid.open({
      value: state.notificationTime,
      mode: 'time',
      is24Hour: true,
      display: 'spinner',
      onChange: onTimeChange,
    });
  };

  const activateNotifications = async () => {
    if (activating) return;
    setActivating(true);
    try {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setState((s) => ({ ...s, osPermissionStatus: 'denied' }));
        Alert.alert(
          'Notificaciones bloqueadas',
          'Activa las notificaciones de Knowbi en los ajustes del sistema para recibir tus píldoras diarias.',
          [
            { text: 'Ahora no', style: 'cancel' },
            {
              text: 'Abrir ajustes',
              onPress: () => {
                openSystemNotificationSettings();
              },
            },
          ],
        );
        return;
      }
      const defaultHhmm = formatHour(state.notificationTime);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        console.error('activate notifications: no user');
        return;
      }

      const { error: updateErr } = await supabase
        .from('user_preferences')
        .update({ notification_enabled: true, notification_time: defaultHhmm })
        .eq('user_id', userData.user.id);

      if (updateErr) {
        console.error('activate notifications update error', updateErr);
        Alert.alert('Algo falló', 'No pudimos guardar tus preferencias. Inténtalo otra vez.');
        return;
      }

      await AsyncStorage.setItem(NOTIFICATION_TIME_KEY, defaultHhmm);
      await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, 'true');
      const token = await registerForExpoPushToken();
      if (token) await savePushTokenToSupabase(token);
      setState((s) => ({ ...s, notificationEnabled: true }));
    } catch (e) {
      console.error('activate notifications failed', e);
    } finally {
      setActivating(false);
    }
  };

  const onToggleNotifications = (next: boolean) => {
    if (activating) return;
    if (next) {
      activateNotifications();
    } else {
      deactivateNotifications();
    }
  };

  const deactivateNotifications = async () => {
    if (activating) return;
    setActivating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        console.error('deactivate notifications: no user');
        return;
      }
      const { error: updateErr } = await supabase
        .from('user_preferences')
        .update({ notification_enabled: false })
        .eq('user_id', userData.user.id);
      if (updateErr) {
        console.error('deactivate notifications update error', updateErr);
        Alert.alert('Algo falló', 'No pudimos guardar tus preferencias. Inténtalo otra vez.');
        return;
      }
      await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, 'false');
      setState((s) => ({ ...s, notificationEnabled: false }));
    } catch (e) {
      console.error('deactivate notifications failed', e);
    } finally {
      setActivating(false);
    }
  };

  const performSignOut = async () => {
    try {
      await signOut();
      await AsyncStorage.removeItem(USER_CATEGORIES_KEY);
    } catch (e) {
      console.error('sign out error', e);
    }
    router.replace('/(auth)/welcome');
  };

  const handleSignOut = () => {
    Alert.alert(
      '¿Cerrar sesión?',
      state.isAnonymous
        ? 'Si te vas sin crear cuenta, perderás tu racha y las píldoras de esta sesión. Crear cuenta es rápido.'
        : 'Tendrás que volver a iniciar sesión para acceder a tu racha y tus píldoras guardadas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar sesión', style: 'destructive', onPress: performSignOut },
      ],
    );
  };

  if (!ready) {
    return (
      <>
        <Stack.Screen options={{ title: 'Ajustes' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#7F77DD" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Ajustes' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 + androidTabBarPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View className="bg-white rounded-card" style={[styles.card, { marginBottom: 16 }]}>
          {state.isAnonymous ? (
            <>
              <Text
                className="font-display-semibold text-ink"
                style={{ fontSize: 17, lineHeight: 17 * 1.3 }}
              >
                Modo invitado
              </Text>
              <Text
                className="font-body text-body-text-muted"
                style={{ fontSize: 13, lineHeight: 13 * 1.4, marginTop: 6 }}
              >
                Crea una cuenta para guardar tu racha y tus píldoras favoritas.
              </Text>
              <View style={{ marginTop: 14 }}>
                <Button
                  variant="primary"
                  label="Crear cuenta"
                  onPress={() => router.push('/(auth)/signup?from=ajustes')}
                />
              </View>
              <Pressable
                onPress={() => router.push('/(auth)/login?from=ajustes')}
                style={{
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 4,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'DMSans_500Medium',
                    fontSize: 14,
                    color: '#7F77DD',
                  }}
                >
                  Ya tengo cuenta
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text
                className="font-body text-body-text-muted"
                style={{ fontSize: 12, lineHeight: 13 }}
              >
                Tu cuenta
              </Text>
              <Text
                className="font-display-semibold text-ink"
                style={{ fontSize: 20, lineHeight: 20 * 1.25, marginTop: 4 }}
              >
                {state.displayName ?? state.email ?? 'Tu cuenta'}
              </Text>
              {state.displayName && state.email ? (
                <Text
                  className="font-body text-body-text-muted"
                  style={{ fontSize: 13, lineHeight: 13 * 1.4, marginTop: 4 }}
                >
                  {state.email}
                </Text>
              ) : null}
            </>
          )}
        </View>

        {/* Notification card */}
        <View className="bg-white rounded-card" style={[styles.card, { marginBottom: 16 }]}>
          {state.osPermissionStatus === 'denied' ? (
            <>
              <Text
                className="font-body-medium text-ink"
                style={{ fontSize: 15, lineHeight: 15 * 1.3 }}
              >
                Notificaciones bloqueadas
              </Text>
              <Text
                className="font-body text-body-text-muted"
                style={{ fontSize: 13, lineHeight: 13 * 1.4, marginTop: 6 }}
              >
                Knowbi tiene las notificaciones desactivadas en los ajustes del sistema. Actívalas
                ahí para recibir tus píldoras diarias.
              </Text>
              <View style={{ marginTop: 14 }}>
                <Button
                  variant="primary"
                  label="Abrir ajustes"
                  onPress={() => {
                    openSystemNotificationSettings();
                  }}
                />
              </View>
            </>
          ) : (
            <>
              {/* La hora de drop es independiente del aviso: se muestra siempre. */}
              {
                <>
                  <View style={styles.row}>
                    <Text
                      className="font-body-medium text-ink"
                      style={{ fontSize: 15, lineHeight: 15 * 1.3 }}
                    >
                      Hora de tus píldoras
                    </Text>
                    {Platform.OS === 'ios' ? (
                      <DateTimePicker
                        value={state.notificationTime}
                        mode="time"
                        display="compact"
                        onChange={onTimeChange}
                      />
                    ) : (
                      <Pressable
                        onPress={openAndroidTimePicker}
                        style={styles.timeChip}
                        accessibilityRole="button"
                        accessibilityLabel="Cambiar hora de aviso"
                      >
                        <Text
                          style={{
                            fontFamily: 'DMSans_500Medium',
                            fontSize: 16,
                            lineHeight: 16 * 1.2,
                            color: '#1A1A2E',
                          }}
                        >
                          {formatHour(state.notificationTime)}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  <View style={styles.divider} />
                </>
              }
              <View style={styles.row}>
                <Text
                  className="font-body-medium text-ink"
                  style={{ fontSize: 15, lineHeight: 15 * 1.3, flex: 1, paddingRight: 12 }}
                >
                  {state.notificationEnabled
                    ? 'Desactivar notificaciones'
                    : 'Activar notificaciones'}
                </Text>
                <Switch
                  value={state.notificationEnabled}
                  onValueChange={onToggleNotifications}
                  disabled={activating}
                  trackColor={{ false: '#E0DED8', true: '#7F77DD' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#E0DED8"
                />
              </View>
            </>
          )}
        </View>

        {/* Categories */}
        <Pressable
          className="bg-white rounded-card"
          style={[styles.card, { marginBottom: 16 }]}
          onPress={() => router.push('/(onboarding)/categories')}
          accessibilityRole="button"
          accessibilityLabel="Editar tus categorías"
          accessibilityHint="Abre la lista de categorías para modificar tus preferencias"
        >
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <View>
              <Text
                className="font-body-medium text-ink"
                style={{ fontSize: 15, lineHeight: 15 * 1.3 }}
              >
                Tus categorías
              </Text>
              <Text
                className="font-body text-body-text-muted"
                style={{ fontSize: 13, lineHeight: 13 * 1.4, marginTop: 4 }}
              >
                {state.categoryCount > 0
                  ? `Tienes ${state.categoryCount} categoría${state.categoryCount === 1 ? '' : 's'} seleccionada${state.categoryCount === 1 ? '' : 's'}`
                  : 'Elige tus temas favoritos'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#888885" />
          </View>
        </Pressable>

        {/* App version */}
        <View
          className="bg-white rounded-card"
          style={[styles.card, { marginBottom: 24, alignItems: 'center' }]}
        >
          <Text className="font-body text-body-text-muted" style={{ fontSize: 13, lineHeight: 13 }}>
            {appVersion ? `Versión ${appVersion}` : 'Versión —'}
          </Text>
        </View>

        {/* Sign out */}
        {!state.isAnonymous && (
          <Button variant="destructive" label="Cerrar sesión" onPress={handleSignOut} />
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0DED8',
    padding: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E0DED8',
    marginVertical: 14,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1EFE8',
  },
});
