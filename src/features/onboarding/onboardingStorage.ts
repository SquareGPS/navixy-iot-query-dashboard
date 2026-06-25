const STORAGE_KEY = 'onboarding_v1_completed';

export function isOnboardingCompleted(userId: string): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const completed = JSON.parse(raw) as string[];
    return completed.includes(userId);
  } catch {
    return false;
  }
}

export function markOnboardingCompleted(userId: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const completed = raw ? (JSON.parse(raw) as string[]) : [];
    if (!completed.includes(userId)) {
      completed.push(userId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
    }
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([userId]));
  }
}

export function clearOnboardingCompleted(userId: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const completed = (JSON.parse(raw) as string[]).filter((id) => id !== userId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}
