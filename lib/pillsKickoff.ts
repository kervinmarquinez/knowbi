import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Contrato del "kickoff" de generación entre el onboarding (categorías) y la Home.
// Centraliza el flag para que ambas pantallas no diverjan en el string mágico.
const KICKOFF_KEY = 'pills_kickoff_date';
const PILL_COUNT = 5;

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Dispara la generación on-demand del día y deja constancia (flag con la fecha) para que la
// Home no la relance: solo hará polling. Fire-and-forget: la Edge Function sigue corriendo
// en el servidor aunque el request expire.
export async function kickoffTodaysPills(categories: string[]): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;
  const date = todayISO();
  await AsyncStorage.setItem(KICKOFF_KEY, date);
  void supabase.functions
    .invoke('generate-pills', { body: { user_id: userId, categories, count: PILL_COUNT, date } })
    .catch((e) => console.warn('generate-pills kickoff', e));
}

export async function wasKickedToday(): Promise<boolean> {
  return (await AsyncStorage.getItem(KICKOFF_KEY)) === todayISO();
}

export async function clearKickoff(): Promise<void> {
  await AsyncStorage.removeItem(KICKOFF_KEY);
}
