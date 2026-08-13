// Session/build context auto-attached to feedback submissions and frontend logs
// (Livello 2 raccolta evidenze beta). Keeps metadata consistent across call sites.

export type SessionMetadata = {
  version: string
  commit: string
  branch: string
  userAgent: string
  deviceType: 'desktop' | 'tablet' | 'mobile' | 'unknown'
  viewport: string
  route: string
}

function detectDeviceType(ua: string): SessionMetadata['deviceType'] {
  if (/iPad|Tablet/i.test(ua) || (/Macintosh/i.test(ua) && 'ontouchend' in window)) return 'tablet'
  if (/Mobi/i.test(ua)) return 'mobile'
  return 'desktop'
}

export function buildSessionMetadata(): SessionMetadata {
  const ua = navigator.userAgent
  return {
    version: __APP_VERSION__,
    commit: __GIT_COMMIT__,
    branch: __GIT_BRANCH__,
    userAgent: ua,
    deviceType: detectDeviceType(ua),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    route: window.location.pathname,
  }
}

// Derive a short, human-readable page key from the current path.
// /leagues/abc/contracts -> "contracts" ; /dashboard -> "dashboard"
export function getPageContext(): string {
  const parts = window.location.pathname.split('/').filter(Boolean)
  if (parts[0] === 'leagues') {
    return parts.length >= 3 ? parts.slice(2).join('/') : 'league'
  }
  return parts.join('/') || 'home'
}
