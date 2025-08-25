export type SupportedCurrency = 'KES' | 'USD' | 'EUR' | 'GBP' | 'NGN' | 'TZS' | 'UGX';

import { supabase } from '@/integrations/supabase/client';

const LOCAL_STORAGE_KEY = 'global-currency';

export const getCurrencySymbol = (code: string = 'KES'): string => {
  switch (code) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'NGN': return '₦';
    case 'TZS': return 'TSh';
    case 'UGX': return 'USh';
    case 'KES':
    default: return 'KES';
  }
};

export const formatAmount = (amount: number = 0, currencyCode?: string): string => {
  const code = currencyCode || getGlobalCurrencySync();
  // Use Intl for $, €, £; for codes like KES render code + amount
  const symbol = getCurrencySymbol(code);
  if (['$', '€', '£'].includes(symbol)) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(Number(amount || 0));
  }
  return `${symbol} ${Number(amount || 0).toLocaleString()}`;
};

export const formatAmountCompact = (amount: number = 0, currencyCode?: string): string => {
  const code = currencyCode || getGlobalCurrencySync();
  const symbol = getCurrencySymbol(code);
  const num = Number(amount || 0);
  
  if (Math.abs(num) >= 1000000) {
    const compactNum = (num / 1000000).toFixed(1);
    return ['$', '€', '£'].includes(symbol) 
      ? `${symbol}${compactNum}M`
      : `${symbol} ${compactNum}M`;
  } else if (Math.abs(num) >= 1000) {
    const compactNum = (num / 1000).toFixed(1);
    return ['$', '€', '£'].includes(symbol)
      ? `${symbol}${compactNum}K`
      : `${symbol} ${compactNum}K`;
  }
  
  return formatAmount(amount, currencyCode);
};

export const compactCurrency = (amount: number = 0, currencyCode?: string): string => {
  const code = currencyCode || getGlobalCurrencySync();
  const symbol = getCurrencySymbol(code);
  const num = Number(amount || 0);
  
  if (Math.abs(num) >= 1000000) {
    const compactNum = (num / 1000000).toFixed(1).replace(/\.0$/, '');
    return `${symbol} ${compactNum}M`;
  } else if (Math.abs(num) >= 1000) {
    const compactNum = (num / 1000).toFixed(1).replace(/\.0$/, '');
    return `${symbol} ${compactNum}K`;
  }
  
  return `${symbol} ${num.toLocaleString()}`;
};

export const getGlobalCurrencySync = (): SupportedCurrency => {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY) as SupportedCurrency | null;
  return saved || 'KES';
};

export const setGlobalCurrency = (code: SupportedCurrency) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, code);
};

export const getGlobalCurrency = async (): Promise<SupportedCurrency> => {
  // 1) localStorage
  const local = getGlobalCurrencySync();
  if (local) return local;

  // 2) Try to infer from active subscription/billing plan
  try {
    const { data: subs } = await supabase
      .from('landlord_subscriptions')
      .select('status, landlord_id, billing_plan:billing_plans(currency)')
      .eq('status', 'active')
      .limit(1);

    const code = (subs?.[0] as any)?.billing_plan?.currency as SupportedCurrency | undefined;
    if (code) {
      setGlobalCurrency(code);
      return code;
    }
  } catch (e) {
    // ignore
  }

  return 'KES';
};
