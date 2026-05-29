import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAndroidTabBarPad } from '../../../lib/useAndroidTabBarPad';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Badge } from '../../../lib/ui/Badge';
import { AuthGate } from '../../../lib/ui/AuthGate';
import { Button } from '../../../lib/ui/Button';
import { Flame } from '../../../lib/ui/Flame';
import { supabase } from '../../../lib/supabase';
import type { Category } from '../../../lib/ui/categories';

type Cell = 'empty' | 'mid' | 'full';

const CELL_COLOR: Record<Cell, string> = {
  empty: '#F1EFE8',
  mid: '#EF9F2766',
  full: '#EF9F27',
};

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type PillRow = {
  id: string;
  date: string;
  category: string;
  is_read: boolean;
  is_saved: boolean;
};

type ProfileData = {
  currentStreak: number;
  maxStreak: number;
  pills: PillRow[];
  totalRead: number;
  totalSaved: number;
};

const DEFAULTS: ProfileData = {
  currentStreak: 0,
  maxStreak: 0,
  pills: [],
  totalRead: 0,
  totalSaved: 0,
};

type DayCell = { state: Cell; isToday: boolean; weekday: string };

const RECENT_DAYS = 14;
const WEEKDAY_INITIALS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']; // índice = Date.getDay()

// Tira de actividad: los últimos N días (más antiguo a la izquierda, hoy a la derecha).
function buildRecentDays(pills: PillRow[], days: number): { days: DayCell[]; fullDays: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const byDate = new Map<string, { total: number; read: number }>();
  for (const p of pills) {
    const entry = byDate.get(p.date) ?? { total: 0, read: 0 };
    entry.total += 1;
    if (p.is_read) entry.read += 1;
    byDate.set(p.date, entry);
  }

  const todayStr = toDateString(today);
  const result: DayCell[] = [];
  let fullDays = 0;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = toDateString(d);
    const entry = byDate.get(key);

    let state: Cell;
    if (!entry || entry.read === 0) {
      state = 'empty';
    } else if (entry.read === entry.total) {
      state = 'full';
      fullDays += 1;
    } else {
      state = 'mid';
    }

    result.push({ state, isToday: key === todayStr, weekday: WEEKDAY_INITIALS[d.getDay()] });
  }

  return { days: result, fullDays };
}

function computeTopCategories(pills: PillRow[]): { category: Category; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of pills) {
    if (p.is_read) {
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([category, count]) => ({ category: category as Category, count }));
}

export default function PerfilScreen() {
  const androidTabBarPad = useAndroidTabBarPad();
  const router = useRouter();
  const [data, setData] = useState<ProfileData>(DEFAULTS);
  const [isAnon, setIsAnon] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        if (!session) {
          if (!cancelled) setIsAnon(true);
          return;
        }
        if (!cancelled) setIsAnon(session.user.is_anonymous === true);
        if (session.user.is_anonymous) return;
        const userId = session.user.id;

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 83);
        const cutoffStr = toDateString(cutoff);

        const [streakRes, pillsRes, readRes, savedRes] = await Promise.all([
          supabase
            .from('user_streaks')
            .select('current_streak, max_streak')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('daily_pills')
            .select('id, date, category, is_read, is_saved')
            .eq('user_id', userId)
            .gte('date', cutoffStr),
          // Totales de por vida (no solo la ventana de 84 días del calendario).
          supabase
            .from('daily_pills')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', true),
          supabase
            .from('daily_pills')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_saved', true),
        ]);

        if (cancelled) return;

        if (streakRes.error) {
          console.error('perfil streak fetch error', streakRes.error);
        }
        if (pillsRes.error) {
          console.error('perfil pills fetch error', pillsRes.error);
        }

        setData({
          currentStreak: streakRes.data?.current_streak ?? 0,
          maxStreak: streakRes.data?.max_streak ?? 0,
          pills: (pillsRes.data as PillRow[]) ?? [],
          totalRead: readRes.count ?? 0,
          totalSaved: savedRes.count ?? 0,
        });
        setLoaded(true);
      }

      load().catch((e) => console.error('perfil load error', e));
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const recent = useMemo(() => buildRecentDays(data.pills, RECENT_DAYS), [data.pills]);
  const totalRead = data.totalRead;
  const totalSaved = data.totalSaved;
  const topCategories = useMemo(() => computeTopCategories(data.pills), [data.pills]);

  if (isAnon === null) {
    return (
      <>
        <Stack.Screen options={{ title: 'Perfil' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#7F77DD" />
        </View>
      </>
    );
  }

  if (isAnon) {
    return (
      <>
        <Stack.Screen options={{ title: 'Perfil' }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <AuthGate
            icon="flame-outline"
            title="Tu racha aparecerá aquí"
            body="Crea una cuenta para empezar a acumular racha y ver tu progreso en el calendario."
            source="perfil"
          />
        </ScrollView>
      </>
    );
  }

  if (!loaded) {
    return (
      <>
        <Stack.Screen options={{ title: 'Perfil' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#7F77DD" />
        </View>
      </>
    );
  }

  // Día 1: usuario real sin ninguna lectura. Estado motivador + CTA (regla de producto #5).
  if (totalRead === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Perfil' }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <EmptyProfile onPress={() => router.push('/(tabs)')} />
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Perfil' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 + androidTabBarPad }}
        showsVerticalScrollIndicator={false}
      >
        <View
          className="bg-white rounded-card"
          style={[styles.card, { marginBottom: 16, flexDirection: 'row', alignItems: 'center' }]}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Racha actual: ${data.currentStreak} ${
            data.currentStreak === 1 ? 'día seguido' : 'días seguidos'
          }. Mejor racha: ${data.maxStreak} ${data.maxStreak === 1 ? 'día' : 'días'}.`}
        >
          <Flame size={48} />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text
              className="font-body text-body-text-muted"
              style={{ fontSize: 12, lineHeight: 13, marginBottom: 4 }}
            >
              Racha actual
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text
                className="font-display-bold text-amber"
                style={{ fontSize: 48, lineHeight: 50, fontVariant: ['tabular-nums'] }}
              >
                {data.currentStreak}
              </Text>
              <Text
                className="font-body text-body-text-muted"
                style={{ fontSize: 14, lineHeight: 14, marginLeft: 8 }}
              >
                días seguidos
              </Text>
            </View>
            <Text
              className="font-body text-body-text-muted"
              style={{ fontSize: 13, lineHeight: 13 * 1.3, marginTop: 6 }}
            >
              Mejor racha · {data.maxStreak} {data.maxStreak === 1 ? 'día' : 'días'}
            </Text>
          </View>
        </View>

        <View className="bg-white rounded-card" style={[styles.card, { marginBottom: 16 }]}>
          <View style={{ flexDirection: 'row' }}>
            <View
              style={{ flex: 1 }}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`Píldoras leídas: ${totalRead}`}
            >
              <Text
                className="font-body text-body-text-muted"
                style={{ fontSize: 12, lineHeight: 13, marginBottom: 6 }}
              >
                Píldoras leídas
              </Text>
              <Text
                className="font-display-semibold text-ink"
                style={{ fontSize: 28, lineHeight: 28, fontVariant: ['tabular-nums'] }}
              >
                {totalRead}
              </Text>
            </View>
            <View
              style={{
                width: StyleSheet.hairlineWidth,
                backgroundColor: '#E0DED8',
                marginHorizontal: 16,
              }}
            />
            <View
              style={{ flex: 1 }}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`Píldoras guardadas: ${totalSaved}`}
            >
              <Text
                className="font-body text-body-text-muted"
                style={{ fontSize: 12, lineHeight: 13, marginBottom: 6 }}
              >
                Píldoras guardadas
              </Text>
              <Text
                className="font-display-semibold text-ink"
                style={{ fontSize: 28, lineHeight: 28, fontVariant: ['tabular-nums'] }}
              >
                {totalSaved}
              </Text>
            </View>
          </View>
        </View>

        {topCategories.length > 0 && (
          <View className="bg-white rounded-card" style={[styles.card, { marginBottom: 16 }]}>
            <Text
              className="font-display-semibold text-ink"
              style={{ fontSize: 17, lineHeight: 17 * 1.35, marginBottom: 12 }}
            >
              Tus temas favoritos
            </Text>
            <View style={{ gap: 10 }}>
              {topCategories.map(({ category, count }) => (
                <View
                  key={category}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Badge category={category} />
                  <Text
                    className="font-body text-body-text-muted"
                    style={{ fontSize: 13, lineHeight: 13 }}
                  >
                    {count} leídas
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className="bg-white rounded-card" style={styles.card}>
          <Text
            className="font-display-semibold text-ink"
            style={{ fontSize: 17, lineHeight: 17 * 1.35, marginBottom: 12 }}
          >
            Actividad
          </Text>
          <View
            style={{ flexDirection: 'row', gap: 6 }}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Tu actividad de los últimos ${RECENT_DAYS} días. ${
              recent.fullDays
            } ${recent.fullDays === 1 ? 'día' : 'días'} con las 5 píldoras leídas.`}
          >
            {recent.days.map((day, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: '100%',
                    aspectRatio: 1,
                    borderRadius: 6,
                    backgroundColor: CELL_COLOR[day.state],
                    ...(day.isToday ? { borderWidth: 1.5, borderColor: '#1A1A2E' } : null),
                  }}
                />
                <Text
                  className="font-body text-body-text-muted"
                  style={{ fontSize: 11, lineHeight: 12 }}
                >
                  {day.weekday}
                </Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 }}>
            <Legend color="#F1EFE8" label="No abriste" />
            <Legend color="#EF9F2766" label="Sin completar" />
            <Legend color="#EF9F27" label="Todas leídas" />
          </View>
        </View>
      </ScrollView>
    </>
  );
}

function EmptyProfile({ onPress }: { onPress: () => void }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingBottom: 32,
      }}
    >
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 20,
          backgroundColor: '#FAEEDA',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <Ionicons name="flame-outline" size={40} color="#EF9F27" />
      </View>
      <Text
        style={{
          fontFamily: 'Nunito_800ExtraBold',
          fontSize: 22,
          lineHeight: 22 * 1.25,
          color: '#1A1A2E',
          textAlign: 'center',
          letterSpacing: -0.22,
        }}
      >
        Tu progreso empieza hoy
      </Text>
      <Text
        style={{
          fontFamily: 'DMSans_400Regular',
          fontSize: 15,
          lineHeight: 15 * 1.55,
          color: '#444441',
          textAlign: 'center',
          marginTop: 10,
          maxWidth: 320,
        }}
      >
        Lee tus 5 píldoras de hoy y empieza a construir tu racha. Aquí verás tu progreso crecer cada
        día.
      </Text>
      <View style={{ width: '100%', maxWidth: 320, marginTop: 28 }}>
        <Button variant="primary" label="Leer mis píldoras de hoy" onPress={onPress} />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center" style={{ gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Text className="font-body text-body-text-muted" style={{ fontSize: 12, lineHeight: 13 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0DED8',
    padding: 20,
  },
});
