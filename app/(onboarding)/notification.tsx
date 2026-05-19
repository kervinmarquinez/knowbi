import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from '../../lib/ui/Button';
import { supabase } from '../../lib/supabase';
import {
  requestNotificationPermission,
  registerForExpoPushToken,
  savePushTokenToSupabase,
} from '../../lib/notifications';

const NOTIFICATION_TIME_KEY = 'notification_time';
const NOTIFICATION_ENABLED_KEY = 'notification_enabled';

function formatHour(date: Date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function defaultHour() {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
}

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
  const [hour, setHour] = useState<Date>(defaultHour);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onIosChange = (_e: DateTimePickerEvent, selected?: Date) => {
    if (selected) setHour(selected);
  };

  const openAndroidPicker = () => {
    DateTimePickerAndroid.open({
      value: hour,
      mode: 'time',
      is24Hour: true,
      display: 'spinner',
      onChange: (_e, selected) => {
        if (selected) setHour(selected);
        setPickerOpen(true);
      },
    });
    setPickerOpen(true);
  };

  const finish = useCallback(
    async (enable: boolean) => {
      if (submitting) return;
      setSubmitting(true);
      const formatted = formatHour(hour);
      let notificationEnabled = false;
      try {
        await AsyncStorage.setItem(NOTIFICATION_TIME_KEY, formatted);
        if (enable) {
          const granted = await requestNotificationPermission();
          if (granted) notificationEnabled = true;
        }
        await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, String(notificationEnabled));
        await syncPreferencesToSupabase({
          notificationTime: formatted,
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
    [hour, router, submitting],
  );

  const onActivate = () => {
    if (Platform.OS === 'ios') {
      // iOS shows picker inline; user already saw it after opening
      if (!pickerOpen) {
        setPickerOpen(true);
        return;
      }
    } else if (!pickerOpen) {
      openAndroidPicker();
      return;
    }
    finish(true);
  };

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
          Elige a qué hora quieres recibir tu aviso diario.
        </Text>

        {pickerOpen ? (
          Platform.OS === 'ios' ? (
            <View style={{ marginTop: 16, alignItems: 'center' }}>
              <DateTimePicker
                value={hour}
                mode="time"
                display="spinner"
                onChange={onIosChange}
                style={{ width: 220, height: 180 }}
              />
            </View>
          ) : (
            <Pressable
              onPress={openAndroidPicker}
              style={{
                marginTop: 28,
                paddingHorizontal: 24,
                paddingVertical: 16,
                borderRadius: 14,
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#E0DED8',
                alignItems: 'center',
                minWidth: 160,
              }}
            >
              <Text
                style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#888885' }}
              >
                Hora de aviso
              </Text>
              <Text
                style={{
                  fontFamily: 'Nunito_800ExtraBold',
                  fontSize: 36,
                  color: '#1A1A2E',
                  marginTop: 4,
                }}
              >
                {formatHour(hour)}
              </Text>
            </Pressable>
          )
        ) : (
          <Text
            style={{
              fontFamily: 'DMSans_400Regular',
              fontSize: 13,
              color: '#888885',
              marginTop: 24,
            }}
          >
            Por defecto te avisaremos a las 09:00.
          </Text>
        )}
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}>
        <Button
          variant="primary"
          label={pickerOpen ? 'Activar notificaciones' : 'Elegir hora y activar'}
          onPress={onActivate}
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
