import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TopBar } from '../lib/ui/TopBar';
import { Button } from '../lib/ui/Button';
import { supabase } from '../lib/supabase';

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CompletedScreen() {
  const router = useRouter();
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function syncStreak() {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) return;
      const userId = userData.user.id;

      const today = toDateString(new Date());
      const yesterday = toDateString(new Date(Date.now() - 86_400_000));

      const { data: row, error: fetchErr } = await supabase
        .from('user_streaks')
        .select('current_streak, max_streak, last_active_date')
        .eq('user_id', userId)
        .single();

      if (fetchErr && fetchErr.code !== 'PGRST116') {
        console.error('streak fetch error', fetchErr);
        return;
      }

      let newCurrent: number;
      let newMax: number;

      if (!row) {
        newCurrent = 1;
        newMax = 1;
        const { error: insertErr } = await supabase.from('user_streaks').insert({
          user_id: userId,
          current_streak: newCurrent,
          max_streak: newMax,
          last_active_date: today,
        });
        if (insertErr) console.error('streak insert error', insertErr);
      } else if (row.last_active_date === today) {
        // Already counted today — just display what we have
        if (!cancelled) setStreak(row.current_streak);
        return;
      } else if (row.last_active_date === yesterday) {
        newCurrent = row.current_streak + 1;
        newMax = Math.max(row.max_streak, newCurrent);
        const { error: updateErr } = await supabase
          .from('user_streaks')
          .update({ current_streak: newCurrent, max_streak: newMax, last_active_date: today })
          .eq('user_id', userId);
        if (updateErr) console.error('streak update error', updateErr);
      } else {
        // Gap of more than one day — reset
        newCurrent = 1;
        newMax = Math.max(row.max_streak, 1);
        const { error: updateErr } = await supabase
          .from('user_streaks')
          .update({ current_streak: newCurrent, max_streak: newMax, last_active_date: today })
          .eq('user_id', userId);
        if (updateErr) console.error('streak update error', updateErr);
      }

      if (!cancelled) setStreak(newCurrent);
    }

    syncStreak();
    return () => { cancelled = true; };
  }, []);

  // Show the last known value while loading to keep the layout stable
  const displayStreak = streak ?? '—';

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <TopBar streak={streak ?? 0} />
      <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 20 }}>
        <Text
          className="font-display text-ink text-center"
          style={{ fontSize: 28, lineHeight: 28 * 1.2, marginBottom: 32 }}
        >
          ¡Ya tienes las 5 de hoy!
        </Text>
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={
            streak === null
              ? 'Cargando racha'
              : `Racha actual: ${streak} ${streak === 1 ? 'día seguido' : 'días seguidos'}`
          }
          style={{ alignItems: 'center' }}
        >
          <Text
            className="font-display text-amber"
            style={{ fontSize: 64, lineHeight: 64 }}
          >
            {displayStreak}
          </Text>
          <Text
            className="font-body text-body-text-muted"
            style={{ fontSize: 14, lineHeight: 14, marginTop: 6 }}
          >
            días seguidos
          </Text>
        </View>
        <Text
          className="font-body text-body-text text-center"
          style={{ fontSize: 14, lineHeight: 14 * 1.6, marginTop: 32, maxWidth: 280 }}
        >
          Llevas {displayStreak} días seguidos. Eso es mucho más que la mayoría.
        </Text>
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}>
        <Button
          variant="primary"
          label="Volver a las píldoras de hoy"
          onPress={() => router.replace('/(tabs)')}
        />
        <Button
          variant="secondary"
          label="Ver mis guardadas"
          onPress={() => router.replace('/(tabs)/guardados')}
        />
      </View>
    </SafeAreaView>
  );
}
