import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { TopBar } from '../../lib/ui/TopBar';
import { Button } from '../../lib/ui/Button';
import { supabase } from '../../lib/supabase';

const NOTIFICATION_TIME_KEY = 'notification_time';
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

type AjustesState = {
  notificationTime: Date;
  categoryCount: number;
};

type PrefRow = {
  notification_time: string | null;
  categories: string[] | null;
};

export default function AjustesScreen() {
  const router = useRouter();
  const appVersion = Constants.expoConfig?.version;

  const [state, setState] = useState<AjustesState>({
    notificationTime: parseTimeString('09:00'),
    categoryCount: 0,
  });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;

        const [prefResult, localTime, localCategories] = await Promise.all([
          userId
            ? supabase
                .from('user_preferences')
                .select('notification_time, categories')
                .eq('user_id', userId)
                .single<PrefRow>()
            : Promise.resolve({ data: null as PrefRow | null }),
          AsyncStorage.getItem(NOTIFICATION_TIME_KEY),
          AsyncStorage.getItem(USER_CATEGORIES_KEY),
        ]);

        if (cancelled) return;

        const prefData = prefResult.data;

        const timeStr = prefData?.notification_time ?? localTime ?? '09:00';

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
          categoryCount,
        });
      }

      load().catch((e) => console.error('ajustes load error', e));
      return () => { cancelled = true; };
    }, []),
  );

  const onTimeChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (!selected) return;
    const hhmm = formatHour(selected);
    setState((prev) => ({ ...prev, notificationTime: selected }));
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

  const handleSignOut = async () => {
    await Promise.all([
      supabase.auth.signOut(),
      AsyncStorage.removeItem(USER_CATEGORIES_KEY),
    ]).catch((e) => console.error('sign out error', e));
    router.replace('/');
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <TopBar showLogo={false} title="Ajustes" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Notification time */}
        <View className="bg-white rounded-card" style={[styles.card, { marginBottom: 16 }]}>
          <Text
            className="font-body-medium text-ink"
            style={{ fontSize: 15, lineHeight: 15 * 1.3, marginBottom: 16 }}
          >
            Hora de aviso
          </Text>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={state.notificationTime}
              mode="time"
              display="spinner"
              onChange={onTimeChange}
              style={{ width: 220, height: 120, marginLeft: -8 }}
            />
          ) : (
            <Pressable
              onPress={openAndroidTimePicker}
              style={styles.androidTimeButton}
              accessibilityRole="button"
              accessibilityLabel="Cambiar hora de aviso"
            >
              <Text
                className="font-body text-body-text-muted"
                style={{ fontSize: 12, lineHeight: 14 }}
              >
                Hora de aviso
              </Text>
              <Text
                className="font-display-bold text-ink"
                style={{ fontSize: 32, lineHeight: 38, marginTop: 2 }}
              >
                {formatHour(state.notificationTime)}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Categories */}
        <Pressable
          className="bg-white rounded-card"
          style={[styles.card, { marginBottom: 16 }]}
          onPress={() => router.push('/(onboarding)/categories')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
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
          <Text
            className="font-body text-body-text-muted"
            style={{ fontSize: 13, lineHeight: 13 }}
          >
            {appVersion ? `Versión ${appVersion}` : 'Versión —'}
          </Text>
        </View>

        {/* Sign out */}
        <Button variant="destructive" label="Cerrar sesión" onPress={handleSignOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0DED8',
    padding: 20,
  },
  androidTimeButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F8F7F5',
    alignSelf: 'flex-start',
    minWidth: 140,
  },
});
