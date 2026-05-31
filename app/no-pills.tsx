import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TopBar } from '../lib/ui/TopBar';
import { Button } from '../lib/ui/Button';
import { supabase } from '../lib/supabase';
import { windowDate } from '../lib/dropWindow';

export default function NoPillsYetScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [streak, setStreak] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        if (!cancelled) setReady(true);
        return;
      }
      const userId = userData.user.id;

      // El set del día es el de hoy en Madrid (drop a medianoche). Si ya existe, el batch
      // terminó: volvemos a Home. Si no, esta pantalla es la red de seguridad mientras se
      // genera (hueco tras medianoche o fallback).
      const date = windowDate();

      const { data: pillCheck, error: pillCheckErr } = await supabase
        .from('daily_pills')
        .select('id')
        .eq('user_id', userId)
        .eq('date', date)
        .limit(1);

      if (pillCheckErr) {
        console.error('no-pills check error', pillCheckErr);
      }

      if (!cancelled && Array.isArray(pillCheck) && pillCheck.length > 0) {
        router.replace('/(tabs)');
        return;
      }

      const { data: streakData } = await supabase
        .from('user_streaks')
        .select('current_streak')
        .eq('user_id', userId)
        .maybeSingle();

      if (!cancelled) {
        if (streakData) setStreak(streakData.current_streak);
        setReady(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router (expo-router) tiene identidad estable; efecto de montaje
  }, []);

  if (!ready) return null;

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
          Estamos preparando tus 5 de hoy.
        </Text>
        <Text
          className="font-body text-body-text text-center"
          style={{ fontSize: 15, lineHeight: 15 * 1.55, marginTop: 14, maxWidth: 300 }}
        >
          Llegan en un momento.
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
