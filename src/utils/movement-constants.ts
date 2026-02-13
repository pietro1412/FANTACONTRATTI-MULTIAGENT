// Shared movement type constants used by Movements page and dashboard
export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  FIRST_MARKET: 'Primo Mercato',
  TRADE: 'Scambio',
  RUBATA: 'Rubata',
  SVINCOLATI: 'Svincolati',
  RELEASE: 'Taglio',
  CONTRACT_RENEW: 'Rinnovo',
}

export const MOVEMENT_TYPE_SHORT: Record<string, string> = {
  FIRST_MARKET: 'PM',
  TRADE: 'SC',
  RUBATA: 'RB',
  SVINCOLATI: 'SV',
  RELEASE: 'TG',
  CONTRACT_RENEW: 'RN',
}

export const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  FIRST_MARKET: 'bg-primary-500/20 text-primary-400',
  TRADE: 'bg-secondary-500/20 text-secondary-400',
  RUBATA: 'bg-red-500/20 text-red-400',
  SVINCOLATI: 'bg-accent-500/20 text-accent-400',
  RELEASE: 'bg-gray-500/20 text-gray-400',
  CONTRACT_RENEW: 'bg-purple-500/20 text-purple-400',
}

export const MOVEMENT_TYPE_ICONS: Record<string, string> = {
  FIRST_MARKET: '\uD83D\uDD28',
  TRADE: '\uD83D\uDD04',
  RUBATA: '\uD83C\uDFAF',
  SVINCOLATI: '\uD83D\uDCCB',
  RELEASE: '\u2702\uFE0F',
  CONTRACT_RENEW: '\uD83D\uDCDD',
}
