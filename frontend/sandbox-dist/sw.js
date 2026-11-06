// service worker מינימלי - מספק installability ל-PWA
// ponytail: אין caching אמיתי/offline עדיין, להוסיף כשיהיה צורך אמיתי (למשל תמיכה offline)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {}); // נדרש כדי שדפדפנים יזהו את זה כ-PWA installable
