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
  if (n.includes('local') || n.includes('special')) return '🍲';
  if (n.includes('pizza')) return '🍕';
  if (n.includes('burger')) return '🍔';
  if (n.includes('main')) return '🥩';
  if (n.includes('sushi')) return '🍣';
  if (n.includes('appetizer') || n.includes('salad')) return '🥗';
  if (n.includes('drink') || n.includes('beverage') || n.includes('juice') || n.includes('tea')) return '🍹';
  if (n.includes('dessert') || n.includes('cake') || n.includes('sweet')) return '🍰';
  if (n.includes('takeaway')) return '🛍️';
  if (n.includes('chicken') || n.includes('poultry')) return '🍗';
  if (n.includes('meat') || n.includes('beef') || n.includes('pork')) return '🍖';
  if (n.includes('fish') || n.includes('seafood')) return '🐟';
  if (n.includes('rice') || n.includes('pilao') || n.includes('biryani')) return '🍚';
  if (n.includes('pasta') || n.includes('noodles')) return '🍝';
  if (n.includes('soup') || n.includes('stew')) return '🥣';
  if (n.includes('breakfast') || n.includes('egg')) return '🍳';
  if (n.includes('snack') || n.includes('fries') || n.includes('chips')) return '🍟';
  if (n.includes('wrap') || n.includes('shawarma') || n.includes('taco')) return '🌯';
  if (n.includes('coffee') || n.includes('latte')) return '☕';
  return '🍽️';
}
