// 施工日誌 service worker
// v2：HTML 改為 network-first（永遠抓最新版，離線才用快取），解決多台裝置看到舊版的問題
const CACHE = 'rizhi-v3';
const ASSETS = [
  './',
  './index.html',
  './worklog.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, {cache:'reload'}))).catch(()=>{}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    const isHTML = req.mode === 'navigate'
                || url.pathname.endsWith('.html')
                || url.pathname.endsWith('/');

    // HTML（app 主檔）：network-first，永遠拿最新版；離線時才回退快取
    if (isHTML) {
      e.respondWith(
        fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
          return res;
        }).catch(() =>
          caches.match(req).then(hit => hit || caches.match('./worklog.html')).then(hit => hit || caches.match('./index.html'))
        )
      );
      return;
    }

    // 其他同源資源（icon/manifest）：cache-first，供離線使用
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
        return res;
      }))
    );
    return;
  }

  // 跨源（PDF/影像解析元件 CDN）：network-first，成功則快取供下次離線使用
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
      return res;
    }).catch(() => caches.match(req))
  );
});
