/**
 * AAPICO Video Portal Configuration
 */

export const API_CONFIG = {
  // Base URL for the video server API
  BASE_URL: (import.meta.env.VITE_APP_URL as string) || window.location.origin,

  // External Video Server URL (for HLS streams)
  // In production, this might be a separate CDN or server
  VIDEO_SERVER_URL: (import.meta.env.VITE_VIDEO_SERVER_URL as string) || (import.meta.env.VITE_APP_URL as string) || window.location.origin,

  // Default credentials for testing/mock LDAP
  DEFAULT_ADMIN: {
    EMAIL: "admin@company.com",
    PASSWORD: "admin1234"
  },

  // Video Processing Settings
  POLLING_INTERVAL: 3000, // 3 seconds
  MAX_UPLOAD_SIZE: 4.2 * 1024 * 1024 * 1024, // 4.2 GB

  // HLS Playback Settings
  HLS_PATH: "/hls", // Proxy path for HLS streams

  // UI Constants
  BRAND_NAME: "AAPICO",
  COLORS: {
    PRIMARY: "#1D366D",
    SECONDARY: "#2DC84D",
    GRAY_LIGHT: "#D8D9DA",
    GRAY_DARK: "#A1A1A5"
  }
};
