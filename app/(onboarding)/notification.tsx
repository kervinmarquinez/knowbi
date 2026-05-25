import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from '../../lib/ui/Button';
import { supabase } from '../../lib/supabase';
import { currentMadridDropHHMM } from '../../lib/dropWindow';
import {
  requestNotificationPermission,
  registerForExpoPushToken,
  savePushTokenToSupabase,
  openSystemNotificationSettings,
} from '../../lib/notifications';

const NOTIFICATION_TIME_KEY = 'notification_time';
const NOTIFICATION_ENABLED_KEY = 'notification_enabled';

async function syncPreferencesToSupabase(input: {
  notificationTime: string;
  notificationEnabled: boolean;
}) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  const { data: existing } = await supabase
    .from('user_preferences')
    .select('categories')
    .eq('user_id', userData.user.id)
    .single();

  await supabase.from('user_preferences').upsert(
    {
      user_id: userData.user.id,
      categories: existing?.categories ?? [],
      plan: 'free',
      notification_enabled: input.notificationEnabled,
      notification_time: input.notificationTime,
    },
    { onConflict: 'user_id' },
  );
}

export default function NotificationOnboarding() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // La hora de drop se fija a la hora a la que el usuario llega a esta pantalla (≈ created_at),
  // sin que tenga que elegirla. Editable después en Ajustes.
  const finish = useCallback(
    async (enable: boolean) => {
      if (submitting) return;
      setSubmitting(true);
      const dropHHMM = currentMadridDropHHMM();
      let notificationEnabled = false;
      try {
        await AsyncStorage.setItem(NOTIFICATION_TIME_KEY, dropHHMM);
        if (enable) {
          const granted = await requestNotificationPermission();
          if (granted) {
            notificationEnabled = true;
          } else {
            Alert.alert(
              'Notificaciones bloqueadas',
              'Activa las notificaciones de Knowbi en los ajustes del sistema para recibir tus píldoras diarias.',
              [
                { text: 'Ahora no', style: 'cancel' },
                { text: 'Abrir ajustes', onPress: () => { openSystemNotificationSettings(); } },
              ],
            );
          }
        }
        await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, String(notificationEnabled));
        await syncPreferencesToSupabase({
          notificationTime: dropHHMM,
          notificationEnabled,
        });
        if (notificationEnabled) {
          const token = await registerForExpoPushToken();
          if (token) await savePushTokenToSupabase(token);
        }
      } catch (e) {
        console.warn('notification setup failed', e);
      } finally {
        router.replace('/(tabs)');
      }
    },
    [router, submitting],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7FC' }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 32 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 16,
            backgroundColor: '#EEEDFE',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="notifications-outline" size={32} color="#534AB7" />
        </View>
        <Text
          style={{
            fontFamily: 'Nunito_800ExtraBold',
            fontSize: 26,
            lineHeight: 26 * 1.2,
            color: '#1A1A2E',
            textAlign: 'center',
            marginTop: 22,
            maxWidth: 320,
            letterSpacing: -0.26,
          }}
        >
          No te pierdas tus 5 píldoras del día.
        </Text>
        <Text
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: 15,
            lineHeight: 15 * 1.55,
            color: '#444441',
            textAlign: 'center',
            maxWidth: 320,
            marginTop: 10,
          }}
        >
          Te avisaremos cuando lleguen tus 5 píldoras de cada día.
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}>
        <Button
          variant="primary"
          label="Activar notificaciones"
          onPress={() => finish(true)}
          disabled={submitting}
        />
        <Pressable
          onPress={() => finish(false)}
          disabled={submitting}
          style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#888885' }}>
            Ahora no
          </Text>
        </Pressable>
      </View>
      <View style={{ height: 16 }} />
    </SafeAreaView>
  );
}
