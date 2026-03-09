// Utility functions for formatting

// Devise : Franc Pacifique (XPF) - pas de décimales
export const CURRENCY = "XPF";
export const CURRENCY_SYMBOL = " F";

export const fmt = (n, decimals = 0) => {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat('fr-FR', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  }).format(n);
};

export const fmtPrice = (n) => {
  // Format prix en XPF (sans décimales)
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat('fr-FR', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  }).format(Math.round(n)) + CURRENCY_SYMBOL;
};

export const fmtPct = (n, decimals = 1) => {
  if (n === null || n === undefined) return "—";
  return fmt(n, decimals) + "%";
};
