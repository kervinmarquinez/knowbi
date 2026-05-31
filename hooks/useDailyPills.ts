import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { wasKickedToday, clearKickoff } from '../lib/pillsKickoff';
import { windowDate } from '../lib/dropWindow';

export type DailyPill = {
  id: string;
  category: string;
  title: string;
  body: string;
  date: string;
  is_saved: boolean;
  is_read: boolean;
};

const DEFAULT_PILL_COUNT = 5;

// Polling de la generación on-demand: la Edge Function tarda ~50s y su invoke puede
// expirar antes de terminar aunque acabe escribiendo. Sondeamos la BD hasta ~90s.
const PILL_FIELDS = 'id, category, title, body, date, is_saved, is_read';
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 30;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function getUserCategories(): Promise<string[]> {
  const raw = await AsyncStorage.getItem('user_categories');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === 'string') : [];
  } catch {
    return typeof raw === 'string' && raw.length > 0
      ? raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  }
}

export function useDailyPills() {
  const [pills, setPills] = useState<DailyPill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pillsRef = useRef<DailyPill[]>([]);
  useEffect(() => {
    pillsRef.current = pills;
  }, [pills]);

  // Invalida un fetch en curso (desmontaje o nuevo fetch) para no hacer setState
  // sobre un polling obsoleto.
  const fetchIdRef = useRef(0);

  const fetchPills = useCallback(async () => {
    const myId = ++fetchIdRef.current;
    const isStale = () => fetchIdRef.current !== myId;

    setIsLoading(true);
    setIsGenerating(false);
    setError(null);

    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !sessionData.session?.user) {
      setError('No hay sesión activa');
      setIsLoading(false);
      return;
    }
    const userId = sessionData.session.user.id;
    const date = windowDate();
    if (isStale()) return;

    const { data, error: queryErr } = await supabase
      .from('daily_pills')
      .select(PILL_FIELDS)
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: true });

    if (queryErr) {
      setError(queryErr.message);
      setIsLoading(false);
      return;
    }

    if (data && data.length > 0) {
      setPills(data as DailyPill[]);
      setIsLoading(false);
      return;
    }

    const categories = await getUserCategories();
    if (categories.length === 0) {
      setError('No hay categorías configuradas');
      setIsLoading(false);
      return;
    }

    // Primera vez del usuario (el batch nocturno aún no le generó píldoras): sondeamos la
    // BD hasta que aparezcan. Si el onboarding ya disparó la generación (flag de hoy), no
    // la relanzamos para no duplicar; si no, la disparamos aquí como red de seguridad
    // (usuario que vuelve / hueco del batch). No tratamos el error del invoke como fatal
    // porque la función puede seguir escribiendo aunque su request expire.
    setIsGenerating(true);
    if (!(await wasKickedToday())) {
      void supabase.functions
        .invoke('generate-pills', {
          body: { user_id: userId, categories, count: DEFAULT_PILL_COUNT, date },
        })
        .catch((e) => console.warn('generate-pills invoke', e));
    }
    if (isStale()) return;

    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      await delay(POLL_INTERVAL_MS);
      if (isStale()) return;

      const { data: polled, error: pollErr } = await supabase
        .from('daily_pills')
        .select(PILL_FIELDS)
        .eq('user_id', userId)
        .eq('date', date)
        .order('created_at', { ascending: true });
      if (isStale()) return;

      if (pollErr) {
        setError(pollErr.message);
        setIsGenerating(false);
        setIsLoading(false);
        return;
      }
      if (polled && polled.length > 0) {
        setPills(polled as DailyPill[]);
        setIsGenerating(false);
        setIsLoading(false);
        return;
      }
    }

    // Agotado el polling: limpiamos el flag para que Reintentar dispare una generación
    // fresca si el kickoff original nunca llegó al servidor.
    await clearKickoff();
    setError('No pudimos preparar tus píldoras');
    setIsGenerating(false);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchPills();
    return () => {
      fetchIdRef.current++;
    };
  }, [fetchPills]);

  const markAsRead = useCallback(async (pillId: string) => {
    setPills((prev) => prev.map((p) => (p.id === pillId ? { ...p, is_read: true } : p)));
    const { error: updateErr } = await supabase
      .from('daily_pills')
      .update({ is_read: true })
      .eq('id', pillId);
    if (updateErr) {
      setPills((prev) => prev.map((p) => (p.id === pillId ? { ...p, is_read: false } : p)));
      setError(updateErr.message);
    }
  }, []);

  const setSaved = useCallback(async (pillId: string, value: boolean) => {
    let previous = false;
    setPills((prev) =>
      prev.map((p) => {
        if (p.id !== pillId) return p;
        previous = p.is_saved;
        return { ...p, is_saved: value };
      }),
    );
    const { error: updateErr } = await supabase
      .from('daily_pills')
      .update({ is_saved: value })
      .eq('id', pillId);
    if (updateErr) {
      setPills((prev) => prev.map((p) => (p.id === pillId ? { ...p, is_saved: previous } : p)));
      setError(updateErr.message);
    }
  }, []);

  const saveToLibrary = useCallback((pillId: string) => setSaved(pillId, true), [setSaved]);

  const syncSavedStates = useCallback(async () => {
    const current = pillsRef.current;
    if (current.length === 0) return;
    const { data, error: queryErr } = await supabase
      .from('daily_pills')
      .select('id, is_saved')
      .in(
        'id',
        current.map((p) => p.id),
      );
    if (queryErr || !data) return;
    const savedById = new Map(data.map((r) => [r.id as string, r.is_saved as boolean]));
    setPills((prev) =>
      prev.map((p) => (savedById.has(p.id) ? { ...p, is_saved: savedById.get(p.id)! } : p)),
    );
  }, []);

  const allRead = pills.length > 0 && pills.every((p) => p.is_read);

  return {
    pills,
    isLoading,
    isGenerating,
    error,
    markAsRead,
    saveToLibrary,
    setSaved,
    syncSavedStates,
    allRead,
    refetch: fetchPills,
  };
}
