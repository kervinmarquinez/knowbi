import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TopBar } from '../lib/ui/TopBar';
import { Button } from '../lib/ui/Button';
import { supabase } from '../lib/supabase';

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function minutesUntil(hhmm: string): number {
  const [hh, mm] = hhmm.split(':').map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return Math.round((target.getTime() - now.getTime()) / 60_000);
}

export default function NoPillsYetScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [streak, setStreak] = useState<number>(0);
  const [scheduledTime, setScheduledTime] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        if (!cancelled) setReady(true);
        return;
      }
      const userId = userData.user.id;
      const today = toDateString(new Date());

      const { data: pillCheck, error: pillCheckErr } = await supabase
        .from('daily_pills')
        .select('id')
        .eq('user_id', userId)
        .eq('date', today)
        .limit(1);

      if (pillCheckErr) {
        console.error('no-pills check error', pillCheckErr);
      }

      if (!cancelled && Array.isArray(pillCheck) && pillCheck.length > 0) {
        router.replace('/(tabs)');
        return;
      }

      const [streakRes, notifTimeFromStorage] = await Promise.all([
        supabase
          .from('user_streaks')
          .select('current_streak')
          .eq('user_id', userId)
          .single(),
        AsyncStorage.getItem('notification_time'),
      ]);

      if (!cancelled) {
        if (streakRes.data) setStreak(streakRes.data.current_streak);

        if (notifTimeFromStorage) {
          setScheduledTime(notifTimeFromStorage);
        } else {
          const { data: prefRow } = await supabase
            .from('user_preferences')
            .select('notification_time')
            .eq('user_id', userId)
            .single();
          if (!cancelled && prefRow?.notification_time) {
            setScheduledTime(prefRow.notification_time);
          }
        }

        setReady(true);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (!ready) return null;

  const minutesLeft = scheduledTime ? minutesUntil(scheduledTime) : null;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <TopBar streak={streak} />
      <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 24 }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 14,
            backgroundColor: '#EEEDFE',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 28,
          }}
        >
          <Ionicons name="time-outline" size={36} color="#534AB7" />
        </View>
        <Text
          className="font-display text-ink text-center"
          style={{ fontSize: 26, lineHeight: 26 * 1.2, letterSpacing: -0.26, maxWidth: 320 }}
        >
          {scheduledTime ? `Aún no son las ${scheduledTime}.` : 'Aún no están listas.'}
        </Text>
        <Text
          className="font-body text-body-text text-center"
          style={{ fontSize: 15, lineHeight: 15 * 1.55, marginTop: 14, maxWidth: 300 }}
        >
          {minutesLeft !== null
            ? `En ${minutesLeft} minutos tienes nuevas píldoras esperando.`
            : 'En unos minutos tienes nuevas píldoras esperando.'}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Button
          variant="primary"
          label="Ver guardados"
          onPress={() => router.push('/(tabs)/guardados')}
        />
      </View>
    </SafeAreaView>
  );
}
