// Service Worker: sorgt dafür, dass das Spiel nach dem ersten Laden schnell und auch ohne Internet läuft.
// Liegt eine Datei schon auf dem Gerät, kommt sie sofort von dort und wird im Hintergrund aufgefrischt;
// die frische Fassung gilt dann beim nächsten Start (Befund Performance: vorher wartete das Spiel aufs Netz).
// Fehlt sie, kommt sie aus dem Netz und wird abgelegt. Scheitert das Ablegen, gilt trotzdem die Antwort aus dem Netz
// (Befund Code-Prüfer). Die Ablage trägt eine Versionsnummer; ältere Ablagen DIESES Programms werden beim
// Aktivieren aufgeräumt, Ablagen anderer Spiele unter derselben Adresse bleiben unberührt (Befund Sicherheit).
// Bei jeder neuen Version die Nummer erhöhen (auch in code/start.js), dann holen alle Geräte alles neu.
const PRAEFIX = 'ki-studio-neu-ablage';
const ABLAGE = `${PRAEFIX}-v2`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (ereignis) => ereignis.waitUntil((async () => {
  const namen = await caches.keys();
  await Promise.all(namen.filter((name) => name.startsWith(PRAEFIX) && name !== ABLAGE).map((name) => caches.delete(name)));
  await self.clients.claim();
})()));

async function holeUndLegeAb(anfrage) {
  const frisch = await fetch(anfrage);
  if (frisch.ok) {
    try {
      const ablage = await caches.open(ABLAGE);
      await ablage.put(anfrage, frisch.clone());
    } catch {
      // Ablegen ging nicht (zum Beispiel Speicher voll). Die Antwort aus dem Netz gilt trotzdem.
    }
  }
  return frisch;
}

self.addEventListener('fetch', (ereignis) => {
  const anfrage = ereignis.request;
  if (anfrage.method !== 'GET' || new URL(anfrage.url).origin !== self.location.origin) return;
  ereignis.respondWith((async () => {
    const ablage = await caches.open(ABLAGE);
    const abgelegt = (await ablage.match(anfrage, { ignoreSearch: true }))
      ?? (anfrage.mode === 'navigate' ? await ablage.match(new URL('./index.html', self.registration.scope).href) : undefined);
    if (abgelegt) {
      // Im Hintergrund auffrischen; ohne Internet bleibt einfach die abgelegte Fassung.
      ereignis.waitUntil(holeUndLegeAb(anfrage).catch(() => {}));
      return abgelegt;
    }
    return holeUndLegeAb(anfrage);
  })());
});
