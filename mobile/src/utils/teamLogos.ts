// Serie A Team Logos Utility for Mobile
// Using football-logos.cc CDN

// URL dei loghi delle squadre di Serie A
const TEAM_LOGOS: Record<string, string> = {
  'Atalanta': 'https://assets.football-logos.cc/logos/italy/128x128/atalanta.a56b2cd2.png',
  'Bologna': 'https://assets.football-logos.cc/logos/italy/128x128/bologna.5ccee9b7.png',
  'Cagliari': 'https://assets.football-logos.cc/logos/italy/128x128/cagliari.be0d30d2.png',
  'Como': 'https://assets.football-logos.cc/logos/italy/128x128/como-1907.b9c19b65.png',
  'Como 1907': 'https://assets.football-logos.cc/logos/italy/128x128/como-1907.b9c19b65.png',
  'Cremonese': 'https://assets.football-logos.cc/logos/italy/128x128/cremonese.a8cbcf13.png',
  'Empoli': 'https://assets.football-logos.cc/logos/italy/128x128/empoli.2ed5b552.png',
  'Fiorentina': 'https://assets.football-logos.cc/logos/italy/128x128/fiorentina.312dfbcd.png',
  'Genoa': 'https://assets.football-logos.cc/logos/italy/128x128/genoa.88413402.png',
  'Inter': 'https://assets.football-logos.cc/logos/italy/128x128/inter.8346f7f3.png',
  'Juventus': 'https://assets.football-logos.cc/logos/italy/128x128/juventus.792b5a21.png',
  'Lazio': 'https://assets.football-logos.cc/logos/italy/128x128/lazio.8c0a207d.png',
  'Lecce': 'https://assets.football-logos.cc/logos/italy/128x128/lecce.8ab06c40.png',
  'Milan': 'https://assets.football-logos.cc/logos/italy/128x128/milan.6234a904.png',
  'Monza': 'https://assets.football-logos.cc/logos/italy/128x128/monza.2f65bf04.png',
  'Napoli': 'https://assets.football-logos.cc/logos/italy/128x128/napoli.fadfb492.png',
  'Parma': 'https://assets.football-logos.cc/logos/italy/128x128/parma.83514aba.png',
  'Pisa': 'https://assets.football-logos.cc/logos/italy/128x128/pisa.6900f7e1.png',
  'Roma': 'https://assets.football-logos.cc/logos/italy/128x128/roma.2602f4be.png',
  'Sassuolo': 'https://assets.football-logos.cc/logos/italy/128x128/sassuolo.9465a3aa.png',
  'Torino': 'https://assets.football-logos.cc/logos/italy/128x128/torino.970d0e20.png',
  'Udinese': 'https://assets.football-logos.cc/logos/italy/128x128/udinese.cf6a82f4.png',
  'Venezia': 'https://assets.football-logos.cc/logos/italy/128x128/venezia.02549c47.png',
  'Verona': 'https://assets.football-logos.cc/logos/italy/128x128/verona.ebe7a1c1.png',
  'Hellas Verona': 'https://assets.football-logos.cc/logos/italy/128x128/verona.ebe7a1c1.png',
};

// Fallback SVG data URI for unknown teams
const FALLBACK_LOGO = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="12" fill="%236b7280"/%3E%3Ctext x="50" y="58" font-family="Arial,sans-serif" font-size="28" font-weight="bold" fill="%23ffffff" text-anchor="middle"%3E?%3C/text%3E%3C/svg%3E';

/**
 * Get logo URL for a team
 * @param teamName - The team name as stored in database
 * @returns Logo URL
 */
export function getTeamLogo(teamName: string): string {
  if (!teamName) return FALLBACK_LOGO;

  // Try exact match first
  if (TEAM_LOGOS[teamName]) {
    return TEAM_LOGOS[teamName];
  }

  // Try case-insensitive match
  const lowerName = teamName.toLowerCase();
  for (const [key, url] of Object.entries(TEAM_LOGOS)) {
    if (key.toLowerCase() === lowerName) {
      return url;
    }
  }

  // Try partial match
  for (const [key, url] of Object.entries(TEAM_LOGOS)) {
    if (key.toLowerCase().includes(lowerName) || lowerName.includes(key.toLowerCase())) {
      return url;
    }
  }

  return FALLBACK_LOGO;
}

/**
 * Check if we have a logo for this team
 */
export function hasTeamLogo(teamName: string): boolean {
  if (!teamName) return false;
  const lowerName = teamName.toLowerCase();
  return Object.keys(TEAM_LOGOS).some(key =>
    key.toLowerCase() === lowerName ||
    key.toLowerCase().includes(lowerName) ||
    lowerName.includes(key.toLowerCase())
  );
}

export default TEAM_LOGOS;
