import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from '../../lib/ui/Button';
import { CategoryGrid } from '../../lib/ui/CategoryGrid';
import { supabase } from '../../lib/supabase';
import { kickoffTodaysPills } from '../../lib/pillsKickoff';

const USER_CATEGORIES_KEY = 'user_categories';

async function loadInitialCategories(): Promise<string[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (userId) {
    const { data } = await supabase
      .from('user_preferences')
      .select('categories')
      .eq('user_id', userId)
      .single();
    if (data?.categories && Array.isArray(data.categories)) {
      return data.categories as string[];
    }
  }
  const local = await AsyncStorage.getItem(USER_CATEGORIES_KEY);
  if (!local) return [];
  try {
    const parsed = JSON.parse(local);
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

async function savePreferences(picked: string[]) {
  await AsyncStorage.setItem(USER_CATEGORIES_KEY, JSON.stringify(picked));
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return;
  await supabase
    .from('user_preferences')
    .upsert(
      { user_id: userId, categories: picked, plan: 'free' },
      { onConflict: 'user_id' },
    );
}

export default function CategoriesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const isOnboarding = params.from === 'onboarding';
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isOnboarding) {
      loadInitialCategories().then((cats) => {
        if (!cancelled) setPicked(cats);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [isOnboarding]);

  const toggle = useCallback((c: string) => {
    setPicked((prev) => {
      if (prev.includes(c)) return prev.filter((x) => x !== c);
      if (prev.length >= 8) return prev;
      return [...prev, c];
    });
  }, []);

  const canSubmit = picked.length >= 3 && picked.length <= 8;

  const onSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      await savePreferences(picked);
      // Anticipa la generación del día para solapar los ~50s con la pantalla de
      // notificación. Solo en onboarding (usuario nuevo sin píldoras), no al editar
      // categorías desde Ajustes. Fire-and-forget dentro del helper.
      if (isOnboarding) await kickoffTodaysPills(picked);
    } catch (e) {
      console.error('save categories error', e);
    } finally {
      setSaving(false);
      if (isOnboarding) {
        router.replace('/(onboarding)/notification');
      } else {
        router.back();
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      {!isOnboarding && (
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
          </Pressable>
        </View>
      )}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: isOnboarding ? 40 : 8,
          paddingBottom: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontFamily: 'Nunito_800ExtraBold',
            fontSize: 26,
            lineHeight: 26 * 1.2,
            letterSpacing: -0.26,
            color: '#1A1A2E',
          }}
        >
          {isOnboarding ? 'Elige lo que te pica la curiosidad.' : 'Tus categorías'}
        </Text>
        <Text
          className="font-body text-body-text"
          style={{ fontSize: 15, lineHeight: 15 * 1.55, marginTop: 8, marginBottom: 24 }}
        >
          {isOnboarding
            ? 'Elige al menos 3 y hasta 8 temas. Cada día te traemos 5 píldoras de tus favoritos.'
            : 'Elige al menos 3 y hasta 8 temas. Influyen en las píldoras que recibes cada día.'}
        </Text>
        <CategoryGrid picked={picked} onToggle={toggle} />
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Button
          variant="primary"
          label={saving ? 'Guardando…' : isOnboarding ? 'Continuar' : 'Guardar'}
          onPress={onSubmit}
          disabled={!canSubmit || saving}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
