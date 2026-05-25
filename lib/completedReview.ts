import AsyncStorage from '@react-native-async-storage/async-storage';

// Flag de "relectura": cuando el set del día ya está leído, el Home aterriza por defecto en
// Completado. Si el usuario pulsa "Volver a las píldoras de hoy", marcamos la fecha de ese
// set para permitirle releer sin que el Home le rebote de vuelta a Completado. Al siguiente
// drop (nueva fecha de set) el flag deja de aplicar solo.
const KEY = 'completed_review_date';

export async function markReviewing(date: string): Promise<void> {
  await AsyncStorage.setItem(KEY, date);
}

export async function isReviewing(date: string): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === date;
}
