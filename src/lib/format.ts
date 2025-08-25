import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

const TIMEZONE = 'Africa/Nairobi';
const LOCALE = 'en-KE';

export const fmtCurrency = (amount: number, currency: string = 'KES'): string => {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const fmtNumber = (value: number, decimals: number = 0): string => {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

export const fmtNumberCompact = (value: number, decimals: number = 1): string => {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(decimals)}M`;
  } else if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(decimals)}K`;
  }
  return fmtNumber(value, decimals);
};

export const fmtCurrencyCompact = (amount: number, currency: string = 'KES'): string => {
  if (Math.abs(amount) >= 1000000) {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      notation: 'compact',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(amount);
  } else if (Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      notation: 'compact',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return fmtCurrency(amount, currency);
};

export const fmtPercent = (value: number, decimals: number = 1): string => {
  return new Intl.NumberFormat(LOCALE, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
};

export const fmtDate = (date: string | Date, pattern: string = 'MMM dd, yyyy'): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const zonedDate = toZonedTime(dateObj, TIMEZONE);
  return format(zonedDate, pattern);
};

export const fmtDuration = (days: number): string => {
  if (days < 1) return '< 1 day';
  if (days < 30) return `${Math.round(days)} days`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  return `${Math.round(days / 365)} years`;
};

export const formatValue = (
  value: number, 
  format: 'currency' | 'number' | 'percent' | 'duration' | 'date',
  decimals?: number
): string => {
  switch (format) {
    case 'currency':
      return fmtCurrency(value);
    case 'number':
      return fmtNumber(value, decimals);
    case 'percent':
      return fmtPercent(value, decimals);
    case 'duration':
      return fmtDuration(value);
    case 'date':
      return fmtDate(new Date(value));
    default:
      return String(value);
  }
};

export const formatValueCompact = (
  value: number, 
  format: 'currency' | 'number' | 'percent' | 'duration' | 'date',
  decimals?: number
): string => {
  switch (format) {
    case 'currency':
      return fmtCurrencyCompact(value);
    case 'number':
      return fmtNumberCompact(value, decimals);
    case 'percent':
      return fmtPercent(value, decimals);
    case 'duration':
      return fmtDuration(value);
    case 'date':
      return fmtDate(new Date(value));
    default:
      return String(value);
  }
};

export const getNairobiDate = (): Date => {
  return toZonedTime(new Date(), TIMEZONE);
};

export const toNairobiTime = (date: string | Date): Date => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(dateObj, TIMEZONE);
};