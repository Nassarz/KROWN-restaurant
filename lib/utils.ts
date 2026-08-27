import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

export function getCategoryIcon(name: string): string {
  const n = (name || '').trim().toLowerCase();
  if (n.includes('all') || n.includes('menu')) return '✨';
  if (n.includes('sandwich')) return '🥪';
  if (n.includes('pizza')) return '🍕';
  if (n.includes('burger')) return '🍔';
  if (n.includes('main')) return '🥩';
  if (n.includes('pasta') || n.includes('spageti') || n.includes('penne')) return '🍝';
  if (n.includes('expresso') || n.includes('coffee') || n.includes('latte') || n.includes('booster')) return '☕';
  if (n.includes('tea')) return '🍵';
  if (n.includes('lemonade')) return '🍋';
  if (n.includes('colada') || n.includes('mojito')) return '🍸';
  if (n.includes('shake') || n.includes('smoothie')) return '🥤';
  if (n.includes('juice')) return '🧃';
  if (n.includes('bread') || n.includes('baguette') || n.includes('loaf') || n.includes('dough')) return '🍞';
  if (n.includes('cake') || n.includes('muffin') || n.includes('pastry') || n.includes('danish') || n.includes('dessert')) return '🍰';
  if (n.includes('pie') || n.includes('samosa')) return '🥟';
  if (n.includes('icecream') || n.includes('scoop')) return '🍨';
  if (n.includes('local') || n.includes('special')) return '🍲';
  if (n.includes('appetizer') || n.includes('salad')) return '🥗';
  if (n.includes('chicken')) return '🍗';
  if (n.includes('meat') || n.includes('beef') || n.includes('pork')) return '🍖';
  if (n.includes('fish') || n.includes('tilapia')) return '🐟';
  if (n.includes('snack') || n.includes('fries')) return '🍟';
  return '🍽️';
}
