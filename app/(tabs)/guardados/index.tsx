import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from '../../../lib/ui/Badge';
import { Button } from '../../../lib/ui/Button';
import { Chip } from '../../../lib/ui/Chip';
import { AuthGate } from '../../../lib/ui/AuthGate';
import { supabase } from '../../../lib/supabase';
import { formatPillDate } from '../../../lib/formatPillDate';
import type { Category } from '../../../lib/ui/categories';

type SavedPill = {
  id: string;
  title: string;
  body: string;
  category: Category;
  date: string;
};

const ALL_FILTER = 'Todas';

export default function GuardadasScreen() {
  const router = useRouter();
  const [pills, setPills] = useState<SavedPill[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_FILTER);
  const [isAnon, setIsAnon] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function fetchSaved() {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        if (!session) {
          if (!cancelled) setIsAnon(true);
          return;
        }
        if (!cancelled) setIsAnon(session.user.is_anonymous === true);
        if (session.user.is_anonymous) return;

        const { data, error: queryErr } = await supabase
          .from('daily_pills')
          .select('id, title, body, category, date')
          .eq('user_id', session.user.id)
          .eq('is_saved', true)
          .order('saved_at', { ascending: false });

        if (queryErr) {
          console.error('guardados fetch error', queryErr);
          return;
        }

        if (!cancelled) {
          setPills((data ?? []) as SavedPill[]);
        }
      }

      fetchSaved();
      return () => { cancelled = true; };
    }, []),
  );

  const unsave = useCallback((pillId: string) => {
    let removed: { pill: SavedPill; index: number } | null = null;
    setPills((prev) => {
      const idx = prev.findIndex((p) => p.id === pillId);
      if (idx === -1) return prev;
      removed = { pill: prev[idx], index: idx };
      return prev.filter((p) => p.id !== pillId);
    });

    const restoreOnFailure = (reason: unknown) => {
      if (!removed) return;
      console.error('unsave failed', reason);
      const restored = removed;
      setPills((prev) => {
        const next = prev.slice();
        next.splice(restored.index, 0, restored.pill);
        return next;
      });
    };

    supabase
      .from('daily_pills')
      .update({ is_saved: false })
      .eq('id', pillId)
      .then(({ error }) => {
        if (error) restoreOnFailure(error);
      }, restoreOnFailure);
  }, []);

  const uniqueCategories = Array.from(new Set(pills.map((p) => p.category)));

  const visiblePills =
    selectedCategory === ALL_FILTER
      ? pills
      : pills.filter((p) => p.category === selectedCategory);

  const showChips = pills.length > 0;
  const isEmpty = visiblePills.length === 0;
  const isFilteredEmpty = isEmpty && selectedCategory !== ALL_FILTER;

  if (isAnon === null) {
    return (
      <>
        <Stack.Screen options={{ title: 'Guardadas' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#7F77DD" />
        </View>
      </>
    );
  }

  if (isAnon) {
    return (
      <>
        <Stack.Screen options={{ title: 'Guardadas' }} />
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <AuthGate
            icon="bookmark-outline"
            title="Guarda lo que te sorprende"
            body="Crea una cuenta para guardar tus píldoras favoritas y volver a ellas cuando quieras."
            source="guardados"
          />
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Guardadas' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {showChips && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Chip
              label={ALL_FILTER}
              selected={selectedCategory === ALL_FILTER}
              onPress={() => setSelectedCategory(ALL_FILTER)}
            />
            {uniqueCategories.map((cat) => (
              <Chip
                key={cat}
                label={cat}
                selected={selectedCategory === cat}
                onPress={() => setSelectedCategory(cat)}
              />
            ))}
          </ScrollView>
        )}

        {isEmpty ? (
          <View className="items-center" style={{ paddingHorizontal: 20, paddingTop: 60 }}>
            <Ionicons name="bookmark-outline" size={48} color="#C5C2BA" style={{ marginBottom: 20 }} />
            <Text
              className="font-display-semibold text-ink"
              style={{ fontSize: 17, lineHeight: 17 * 1.35, marginBottom: 8 }}
            >
              Aún nada por aquí
            </Text>
            <Text
              className="font-body text-body-text text-center"
              style={{ fontSize: 14, lineHeight: 14 * 1.65, maxWidth: 280, marginBottom: 24 }}
            >
              {isFilteredEmpty
                ? 'Sin píldoras guardadas en esta categoría todavía.'
                : 'Aquí aparecerán las píldoras que guardes. Pulsa el marcador cuando encuentres algo que merezca quedarse.'}
            </Text>
            {isFilteredEmpty ? (
              <View style={{ alignSelf: 'stretch' }}>
                <Button
                  variant="secondary"
                  label="Ver todas"
                  onPress={() => setSelectedCategory(ALL_FILTER)}
                />
              </View>
            ) : (
              <View style={{ alignSelf: 'stretch' }}>
                <Button
                  variant="primary"
                  label="Ver mis píldoras de hoy"
                  onPress={() => router.push('/(tabs)')}
                />
              </View>
            )}
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            {visiblePills.map((p) => (
              <Link
                key={p.id}
                href={{ pathname: '/pill/[id]', params: { id: p.id } }}
                asChild
              >
                <Link.Trigger>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Ver píldora: ${p.title}`}
                  >
                    <View className="bg-white rounded-card" style={styles.item}>
                      <View style={styles.cardHeader}>
                        <Badge category={p.category} />
                        <Pressable
                          onPress={() => unsave(p.id)}
                          hitSlop={8}
                          style={styles.bookmarkBtn}
                          accessibilityRole="button"
                          accessibilityLabel="Quitar de guardadas"
                        >
                          <Ionicons name="bookmark" size={18} color="#1A1A2E" />
                        </Pressable>
                      </View>
                      <Text
                        className="font-display-bold text-ink"
                        style={{ fontSize: 16, lineHeight: 16 * 1.3, marginTop: 8, marginBottom: 6 }}
                      >
                        {p.title}
                      </Text>
                      <Text
                        className="font-body text-body-text-muted"
                        style={{ fontSize: 11, lineHeight: 13 }}
                      >
                        {formatPillDate(p.date)}
                      </Text>
                    </View>
                  </Pressable>
                </Link.Trigger>
                <Link.Preview />
                <Link.Menu>
                  <Link.MenuAction
                    title="Quitar de guardadas"
                    icon="bookmark.slash"
                    destructive
                    onPress={() => unsave(p.id)}
                  />
                </Link.Menu>
              </Link>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    flexDirection: 'row',
  },
  item: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0DED8',
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bookmarkBtn: {
    padding: 4,
  },
});
