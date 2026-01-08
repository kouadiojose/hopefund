import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = 'RWF'
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount || 0;
  return new Intl.NumberFormat('fr-RW', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatNumber(num: number | string | null | undefined): string {
  const n = typeof num === 'string' ? parseFloat(num) : num || 0;
  return new Intl.NumberFormat('fr-RW').format(n);
}

export function formatDate(
  date: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('fr-RW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(d);
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('fr-RW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function getInitials(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.charAt(0) || '';
  const last = lastName?.charAt(0) || '';
  return (first + last).toUpperCase() || 'XX';
}

export function getStatusColor(status: number | string): string {
  const statusMap: Record<string, string> = {
    '1': 'bg-green-100 text-green-800', // Actif
    '2': 'bg-yellow-100 text-yellow-800', // En attente
    '3': 'bg-blue-100 text-blue-800', // En cours
    '5': 'bg-green-100 text-green-800', // Débloqué
    '9': 'bg-red-100 text-red-800', // Rejeté
    'active': 'bg-green-100 text-green-800',
    'pending': 'bg-yellow-100 text-yellow-800',
    'blocked': 'bg-red-100 text-red-800',
    'closed': 'bg-gray-100 text-gray-800',
  };
  return statusMap[String(status)] || 'bg-gray-100 text-gray-800';
}

export function getStatusLabel(status: number | string, type: 'account' | 'loan' | 'client' = 'account'): string {
  const labels: Record<string, Record<string, string>> = {
    account: {
      '1': 'Actif',
      '2': 'Bloqué',
      '3': 'Dormant',
      '4': 'Clôturé',
    },
    loan: {
      '1': 'Nouvelle demande',
      '2': 'Approuvé',
      '3': 'En attente',
      '5': 'Débloqué',
      '7': 'Soldé',
      '9': 'Rejeté',
    },
    client: {
      '1': 'Actif',
      '2': 'Inactif',
      '3': 'Suspendu',
    },
  };
  return labels[type]?.[String(status)] || String(status);
}
