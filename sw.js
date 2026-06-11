// ---------------------------------------------------------------
// sw.js — ADIM 7.1: Temel Service Worker
// ---------------------------------------------------------------
// Görev: Uygulamanın "kabuğunu" (HTML, CSS, JS dosyaları) telefona
// kaydeder. İnternet olmasa bile uygulama açılır ve giriş ekranı
// görünür. Veritabanı işlemleri (Supabase) internet gerektirmeye
// devam eder — bu adımda çevrimdışı veri senkronizasyonu yok,
// o Adım 7.2'nin konusu.
//
// Cache stratejisi: "Cache First, Network Fallback"
//   1. İstek geldikçe önce cache'e bak
//   2. Cache'te varsa oradan sun (hızlı, internet gerekmez)
//   3. Cache'te yoksa ağa git, cevabı cache'e ekle
// ---------------------------------------------------------------

const CACHE_NAME = 'tcms-v37';

// İlk kurulumda cache'lenecek dosyalar (uygulama kabuğu)
const SHELL_FILES = [
    '/',
    '/index.html',
    '/css/base.css',
    '/css/components.css',
    '/css/chart.css',
    '/css/mobile.css',
    '/js/app.js',
    '/js/attendance.js',
    '/js/attendanceActions.js',
    '/js/attendanceModals.js',
    '/js/classes.js',
    '/js/classStats.js',
    '/js/config.js',
    '/js/i18n.js',
    '/js/offlineStore.js',
    '/js/payments.js',
    '/js/router.js',
    '/js/schools.js',
    '/js/state.js',
    '/js/supabaseClient.js',
    '/js/utils.js',
    '/locales/tr.js',
    '/locales/en.js',
    '/favicon.png'
];

// ---------------------------------------------------------------
// KURULUM (install): Service worker yüklenince shell dosyalarını
// cache'e al. skipWaiting() ile hemen aktif hale geçer.
// ---------------------------------------------------------------
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(SHELL_FILES);
        })
    );
    self.skipWaiting();
});

// ---------------------------------------------------------------
// AKTİFLEŞME (activate): Eski cache sürümlerini temizle.
// clients.claim() ile açık sekmeleri hemen kontrol altına al.
// ---------------------------------------------------------------
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// ---------------------------------------------------------------
// İSTEK YAKALAMA (fetch): Her ağ isteğinde araya gir.
// Supabase API isteklerini (ağdan gelmesi şart) geç.
// Geri kalanlar için: önce cache, yoksa ağ.
// ---------------------------------------------------------------
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // Supabase API, harici CDN (Lucide, Google Fonts) isteklerini
    // service worker'dan geçirme — bunlar her zaman ağdan gelsin
    if (
        url.includes('supabase.co') ||
        url.includes('googleapis.com') ||
        url.includes('unpkg.com') ||
        url.includes('jsdelivr.net') ||
        url.includes('gstatic.com')
    ) {
        return; // Tarayıcının normal davranışına bırak
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) {
                return cached; // Cache'ten sun
            }
            // Cache'te yoksa ağdan al ve cache'e ekle
            return fetch(event.request).then((response) => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return response;
            });
        })
    );
});