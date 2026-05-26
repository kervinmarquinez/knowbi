import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../../lib/ui/Badge';
import { Button } from '../../lib/ui/Button';
import { supabase } from '../../lib/supabase';
import { formatPillDate } from '../../lib/formatPillDate';
import type { Category } from '../../lib/ui/categories';

type Pill = {
  id: string;
  title: string;
  body: string;
  category: Category;
  date: string;
  is_saved: boolean;
};

export default function PillDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pill, setPill] = useState<Pill | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('daily_pills')
        .select('id, title, body, category, date, is_saved')
        .eq('id', id)
        .maybeSingle();

      if (cancelled) return;
      if (
        error ||
        !data ||
        typeof data.id !== 'string' ||
        typeof data.title !== 'string' ||
        typeof data.body !== 'string' ||
        typeof data.category !== 'string' ||
        typeof data.date !== 'string' ||
        typeof data.is_saved !== 'boolean'
      ) {
        setNotFound(true);
        return;
      }
      setPill(data as Pill);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const toggleSaved = useCallback(async () => {
    if (!pill) return;
    const next = !pill.is_saved;
    setPill({ ...pill, is_saved: next });
    const { error } = await supabase
      .from('daily_pills')
      .update({ is_saved: next })
      .eq('id', pill.id);
    if (error) {
      console.error('toggle save failed', error);
      setPill((p) => (p ? { ...p, is_saved: !next } : p));
    }
  }, [pill]);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </Pressable>
      </View>

      {notFound ? (
        <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 24 }}>
          <Text
            className="font-display-semibold text-ink text-center"
            style={{ fontSize: 17, lineHeight: 17 * 1.35 }}
          >
            No encontramos esta píldora.
          </Text>
        </View>
      ) : pill ? (
        <>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            <Badge category={pill.category} />
            <Text
              className="font-display-bold text-ink"
              style={{ fontSize: 26, lineHeight: 26 * 1.25, marginTop: 16, letterSpacing: -0.26 }}
            >
              {pill.title}
            </Text>
            <Text
              className="font-body text-body-text-muted"
              style={{ fontSize: 12, lineHeight: 14, marginTop: 8 }}
            >
              {formatPillDate(pill.date)}
            </Text>
            <Text
              className="font-body text-body-text"
              style={{ fontSize: 16, lineHeight: 16 * 1.6, marginTop: 16 }}
            >
              {pill.body}
            </Text>
          </ScrollView>
          <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
            <Button
              variant={pill.is_saved ? 'ghost' : 'primary'}
              label={pill.is_saved ? 'Quitar de guardadas' : 'Guardar'}
              onPress={toggleSaved}
            />
          </View>
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
