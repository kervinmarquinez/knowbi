import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useAndroidTabBarPad } from '../../../lib/useAndroidTabBarPad';
import { Stack, useFocusEffect } from 'expo-router';
import { Badge } from '../../../lib/ui/Badge';
import { AuthGate } from '../../../lib/ui/AuthGate';
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
};

const DEFAULTS: ProfileData = {
  currentStreak: 0,
  maxStreak: 0,
  pills: [],
};

function buildCalendarCells(pills: PillRow[]): Cell[] {
  const today = new Date();
  const byDate = new Map<string, { total: number; read: number }>();

  for (const p of pills) {
    const entry = byDate.get(p.date) ?? { total: 0, read: 0 };
    entry.total += 1;
    if (p.is_read) entry.read += 1;
    byDate.set(p.date, entry);
  }

  const cells: Cell[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = toDateString(d);
    const entry = byDate.get(key);

    if (!entry || entry.read === 0) {
      cells.push('empty');
    } else if (entry.read === entry.total) {
      cells.push('full');
    } else {
      cells.push('mid');
    }
  }
  return cells;
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
  const [data, setData] = useState<ProfileData>(DEFAULTS);
  const [isAnon, setIsAnon] = useState<boolean | null>(null);

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

        const [streakRes, pillsRes] = await Promise.all([
          supabase
            .from('user_streaks')
            .select('current_streak, max_streak')
            .eq('user_id', userId)
            .single(),
          supabase
            .from('daily_pills')
            .select('id, date, category, is_read, is_saved')
            .eq('user_id', userId)
            .gte('date', cutoffStr),
        ]);

        if (cancelled) return;

        if (streakRes.error && streakRes.error.code !== 'PGRST116') {
          console.error('perfil streak fetch error', streakRes.error);
        }
        if (pillsRes.error) {
          console.error('perfil pills fetch error', pillsRes.error);
        }

        setData({
          currentStreak: streakRes.data?.current_streak ?? 0,
          maxStreak: streakRes.data?.max_streak ?? 0,
          pills: (pillsRes.data as PillRow[]) ?? [],
        });
      }

      load().catch((e) => console.error('perfil load error', e));
      return () => { cancelled = true; };
    }, []),
  );

  const cells = useMemo(() => buildCalendarCells(data.pills), [data.pills]);
  const totalRead = useMemo(() => data.pills.filter((p) => p.is_read).length, [data.pills]);
  const totalSaved = useMemo(() => data.pills.filter((p) => p.is_saved).length, [data.pills]);
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

  return (
    <>
      <Stack.Screen options={{ title: 'Perfil' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 + androidTabBarPad }}
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-white rounded-card" style={[styles.card, { marginBottom: 16 }]}>
          <Text
            className="font-body text-body-text-muted"
            style={{ fontSize: 11, lineHeight: 13, marginBottom: 8 }}
          >
            Racha actual
          </Text>
          <Text
            className="font-display-bold text-amber"
            style={{ fontSize: 40, lineHeight: 40, fontVariant: ['tabular-nums'] }}
          >
            {data.currentStreak}
          </Text>
          <Text
            className="font-body text-body-text-muted"
            style={{ fontSize: 13, lineHeight: 13, marginTop: 4 }}
          >
            días seguidos
          </Text>
        </View>

        <View className="bg-white rounded-card" style={[styles.card, { marginBottom: 16 }]}>
          <Text
            className="font-body text-body-text-muted"
            style={{ fontSize: 11, lineHeight: 13, marginBottom: 8 }}
          >
            Mejor racha
          </Text>
          <Text
            className="font-display-semibold text-body-text-muted"
            style={{ fontSize: 28, lineHeight: 28, fontVariant: ['tabular-nums'] }}
          >
            {data.maxStreak}
          </Text>
          <Text
            className="font-body text-body-text-muted"
            style={{ fontSize: 13, lineHeight: 13, marginTop: 4 }}
          >
            mejor racha
          </Text>
        </View>

        <View className="bg-white rounded-card" style={[styles.card, { marginBottom: 16 }]}>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1 }}>
              <Text
                className="font-body text-body-text-muted"
                style={{ fontSize: 11, lineHeight: 13, marginBottom: 6 }}
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
            <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: '#E0DED8', marginHorizontal: 16 }} />
            <View style={{ flex: 1 }}>
              <Text
                className="font-body text-body-text-muted"
                style={{ fontSize: 11, lineHeight: 13, marginBottom: 6 }}
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
                <View key={category} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
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
          <View style={styles.grid}>
            {cells.map((c, i) => (
              <View
                key={i}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  backgroundColor: CELL_COLOR[c],
                }}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 }}>
            <Legend color="#F1EFE8" label="No abrió" />
            <Legend color="#EF9F2766" label="Sin completar" />
            <Legend color="#EF9F27" label="Todas leídas" />
          </View>
        </View>
      </ScrollView>
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center" style={{ gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Text
        className="font-body text-body-text-muted"
        style={{ fontSize: 11, lineHeight: 13 }}
      >
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    width: 12 * 12 + 11 * 3,
  },
});
