export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatRelativeTime(isoString: string): string {
  const d = new Date(isoString);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "A l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diff < 86400 * 2) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function formatHoursAgo(isoString: string): string {
  const hoursAgo = Math.round((Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60));
  return hoursAgo < 1 ? "il y a moins d'1h" : `il y a ${hoursAgo}h`;
}

export function formatKarma(karma: number): string {
  return karma > 0 ? `+${karma}` : String(karma);
}

export function getKarmaColor(karma: number): string {
  return karma >= 0 ? '#49e619' : karma >= -5 ? '#f59e0b' : '#ef4444';
}

export function getCategoryLabel(category: string | null): string {
  return category === 'food_rescue' ? 'Anti-gaspi' : 'Repas maison';
}

export function getCategoryColor(category: string | null): string {
  return category === 'food_rescue' ? '#16a34a' : '#f97316';
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
