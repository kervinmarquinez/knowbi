import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getUserCategories(): Promise<string[]> {
  const raw = await AsyncStorage.getItem('user_categories');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === 'string') : [];
  } catch {
    return typeof raw === 'string' && raw.length > 0 ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  }
}

export function useDailyPills() {
  const [pills, setPills] = useState<DailyPill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPills = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !sessionData.session?.user) {
      setError('No hay sesión activa');
      setIsLoading(false);
      return;
    }
    const userId = sessionData.session.user.id;
    const date = todayISO();

    const { data, error: queryErr } = await supabase
      .from('daily_pills')
      .select('id, category, title, body, date, is_saved, is_read')
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

    const { error: invokeErr } = await supabase.functions.invoke('generate-pills', {
      body: { user_id: userId, categories, count: DEFAULT_PILL_COUNT, date },
    });

    if (invokeErr) {
      setError(invokeErr.message);
      setIsLoading(false);
      return;
    }

    const { data: refetched, error: refetchErr } = await supabase
      .from('daily_pills')
      .select('id, category, title, body, date, is_saved, is_read')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: true });

    if (refetchErr) {
      setError(refetchErr.message);
      setIsLoading(false);
      return;
    }

    setPills((refetched ?? []) as DailyPill[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchPills();
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
      })
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

  const allRead = pills.length > 0 && pills.every((p) => p.is_read);

  return { pills, isLoading, error, markAsRead, saveToLibrary, setSaved, allRead, refetch: fetchPills };
}
