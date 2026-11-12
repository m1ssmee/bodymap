import type { CapacitorConfig } from '@capacitor/cli';

// The app loads the live site (its API routes need a server, so no static export).
// For local testing: CAP_SERVER_URL=http://10.0.2.2:3000 npx cap sync android
// Afterwards run a plain `npx cap sync android` so the app points at Vercel again.
const url = process.env.CAP_SERVER_URL ?? 'https://bodymap-qu9s.vercel.app';

const config: CapacitorConfig = {
  appId: 'app.bodymap',
  appName: 'BodyMap',
  webDir: 'www',
  backgroundColor: '#f6f4ef',
  server: {
    url,
    cleartext: url.startsWith('http://'),
    // Served from www/ at the server's origin when the page can't load.
    errorPath: 'offline.html',
  },
  android: {
    appendUserAgent: 'BodyMapApp',
  },
  plugins: {
    // Capacitor 8 edge-to-edge: 'native' pads the WebView inside the status and
    // navigation bars (unless the page opts in with viewport-fit=cover).
    // 'LIGHT' = dark icons for a light background.
    SystemBars: {
      insetsHandling: 'native',
      style: 'LIGHT',
    },
  },
};

export default config;
