/** Cooldown in seconds before user can request a new assignment after praying */
export const PRAYER_COOLDOWN_SECONDS = 30;

/** Max assignment requests per session per hour (rate limit) */
export const RATE_LIMIT_SESSION_PER_HOUR = 20;

/** Max assignment requests per IP per hour (rate limit) */
export const RATE_LIMIT_IP_PER_HOUR = 50;

/** Assignment candidate cache TTL in milliseconds */
export const ASSIGNMENT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Default archdiocese for cemetery queries */
export const DEFAULT_ARCHDIOCESE = "Atlanta";

/** Atlanta area center for map default view */
export const MAP_DEFAULT_CENTER = { lng: -84.388, lat: 33.749 } as const;
export const MAP_DEFAULT_ZOOM = 10;
