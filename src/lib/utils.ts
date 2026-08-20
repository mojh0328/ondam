import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined) {
  if (typeof value !== 'number') return 'AUD 0.00';
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
}

export function formatPercent(value: number | null | undefined) {
  if (typeof value !== 'number') return '0.0%';
  return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100);
}

export function formatGrams(value: number | null | undefined) {
  if (typeof value !== 'number') return '0g';
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}g`;
}

export function formatAmount(value: number | null | undefined, unit: string) {
  if (typeof value !== 'number') return unit === 'ml' ? '0ml' : '0g';
  const formatted = value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  return unit === 'ml' ? `${formatted}ml` : `${formatted}g`;
}

export function unitLabel(unit: string) {
  return unit === 'ml' ? 'ml' : 'g';
}

export function largeUnitLabel(unit: string) {
  return unit === 'ml' ? 'L' : 'kg';
}
