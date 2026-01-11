import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Monnaie par défaut: Franc Burundais (FBu)
const DEFAULT_CURRENCY = 'FBu';
const DEFAULT_LOCALE = 'fr-BI';

export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = DEFAULT_CURRENCY
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount || 0;

  // Format avec séparateur de milliers
  const formatted = new Intl.NumberFormat(DEFAULT_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);

  return `${formatted} ${currency}`;
}

export function formatCurrencyShort(
  amount: number | string | null | undefined
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount || 0;

  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}Md FBu`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M FBu`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(0)}K FBu`;
  }
  return `${num} FBu`;
}

export function formatNumber(num: number | string | null | undefined): string {
  const n = typeof num === 'string' ? parseFloat(num) : num || 0;
  return new Intl.NumberFormat(DEFAULT_LOCALE).format(n);
}

export function formatPercent(num: number | string | null | undefined): string {
  const n = typeof num === 'string' ? parseFloat(num) : num || 0;
  return `${n.toFixed(2)}%`;
}

export function formatDate(
  date: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(d);
}

export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
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

// Couleurs pour les états de compte
export function getAccountStatusColor(status: number | null): string {
  const colors: Record<number, string> = {
    1: 'bg-green-100 text-green-800 border-green-200', // Actif
    2: 'bg-red-100 text-red-800 border-red-200', // Bloqué
    3: 'bg-yellow-100 text-yellow-800 border-yellow-200', // Dormant
    4: 'bg-gray-100 text-gray-800 border-gray-200', // Clôturé
  };
  return colors[status || 0] || 'bg-gray-100 text-gray-800 border-gray-200';
}

export function getAccountStatusLabel(status: number | null): string {
  const labels: Record<number, string> = {
    1: 'Actif',
    2: 'Bloqué',
    3: 'Dormant',
    4: 'Clôturé',
  };
  return labels[status || 0] || 'Inconnu';
}

// Couleurs pour les états de crédit
export function getCreditStatusColor(status: number | null): string {
  const colors: Record<number, string> = {
    1: 'bg-blue-100 text-blue-800 border-blue-200', // Demande
    2: 'bg-yellow-100 text-yellow-800 border-yellow-200', // En analyse
    3: 'bg-purple-100 text-purple-800 border-purple-200', // Approuvé
    4: 'bg-red-100 text-red-800 border-red-200', // Rejeté
    5: 'bg-green-100 text-green-800 border-green-200', // Débloqué
    6: 'bg-green-100 text-green-800 border-green-200', // En cours
    7: 'bg-gray-100 text-gray-800 border-gray-200', // Soldé
    8: 'bg-orange-100 text-orange-800 border-orange-200', // En retard
    9: 'bg-red-100 text-red-800 border-red-200', // Contentieux
  };
  return colors[status || 0] || 'bg-gray-100 text-gray-800 border-gray-200';
}

export function getCreditStatusLabel(status: number | null): string {
  const labels: Record<number, string> = {
    1: 'Demande',
    2: 'En analyse',
    3: 'Approuvé',
    4: 'Rejeté',
    5: 'Débloqué',
    6: 'En cours',
    7: 'Soldé',
    8: 'En retard',
    9: 'Contentieux',
  };
  return labels[status || 0] || 'Inconnu';
}

// Couleurs pour les états de client
export function getClientStatusColor(status: number | null): string {
  const colors: Record<number, string> = {
    1: 'bg-green-100 text-green-800 border-green-200', // Actif
    2: 'bg-gray-100 text-gray-800 border-gray-200', // Inactif
    3: 'bg-red-100 text-red-800 border-red-200', // Suspendu
  };
  return colors[status || 0] || 'bg-gray-100 text-gray-800 border-gray-200';
}

export function getClientStatusLabel(status: number | null): string {
  const labels: Record<number, string> = {
    1: 'Actif',
    2: 'Inactif',
    3: 'Suspendu',
  };
  return labels[status || 0] || 'Inconnu';
}

// États d'échéance
export function getEcheanceStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'Payé': 'bg-green-100 text-green-800 border-green-200',
    'À payer': 'bg-blue-100 text-blue-800 border-blue-200',
    'En retard': 'bg-red-100 text-red-800 border-red-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
}

// Type de personne
export function getPersonTypeLabel(type: number | null): string {
  const labels: Record<number, string> = {
    1: 'Personne physique',
    2: 'Personne morale',
    3: 'Groupe informel',
  };
  return labels[type || 0] || 'Inconnu';
}

// Sexe
export function getSexeLabel(sexe: number | null): string {
  const labels: Record<number, string> = {
    1: 'Masculin',
    2: 'Féminin',
  };
  return labels[sexe || 0] || '-';
}

// État civil
export function getEtatCivilLabel(etat: number | null): string {
  const labels: Record<number, string> = {
    1: 'Célibataire',
    2: 'Marié(e)',
    3: 'Divorcé(e)',
    4: 'Veuf/Veuve',
  };
  return labels[etat || 0] || '-';
}

// Rôles utilisateur
export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    'SUPER_ADMIN': 'Super Admin',
    'DIRECTOR': 'Directeur',
    'BRANCH_MANAGER': 'Chef d\'Agence',
    'CREDIT_OFFICER': 'Agent de crédit',
    'TELLER': 'Caissier',
  };
  return labels[role] || role;
}

export function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    'SUPER_ADMIN': 'bg-purple-100 text-purple-800 border-purple-200',
    'DIRECTOR': 'bg-blue-100 text-blue-800 border-blue-200',
    'BRANCH_MANAGER': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'CREDIT_OFFICER': 'bg-green-100 text-green-800 border-green-200',
    'TELLER': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  };
  return colors[role] || 'bg-gray-100 text-gray-800 border-gray-200';
}

// Calcul de jours de retard
export function getDaysOverdue(date: string | Date | null | undefined): number {
  if (!date) return 0;
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  const diffTime = today.getTime() - d.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

// Anciennes fonctions pour compatibilité (deprecated)
export function getStatusColor(status: number | string): string {
  return getAccountStatusColor(typeof status === 'string' ? parseInt(status) : status);
}

export function getStatusLabel(status: number | string, type: 'account' | 'loan' | 'client' = 'account'): string {
  const numStatus = typeof status === 'string' ? parseInt(status) : status;
  switch (type) {
    case 'loan':
      return getCreditStatusLabel(numStatus);
    case 'client':
      return getClientStatusLabel(numStatus);
    default:
      return getAccountStatusLabel(numStatus);
  }
}
