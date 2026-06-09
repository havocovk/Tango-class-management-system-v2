// ---------------------------------------------------------------
// offlineStore.js — ADIM 7.2: Çevrimdışı Depolama Motoru
// ---------------------------------------------------------------
// Bu dosya, internet yokken uygulamanın çalışabilmesi için gereken
// iki şeyi yönetir:
//
//   1) VERİ CACHE'İ (dataCache):
//      Çevrimiçiyken çekilen veriler (okullar, sınıflar, yoklama)
//      telefona kaydedilir. İnternet kesilince bu kayıtlardan okunur
//      — böylece liste boş gelmez.
//
//   2) BEKLEYEN DEĞİŞİKLİKLER (pendingAttendance):
//      İnternet yokken alınan yoklamalar burada sıraya konur.
//      İnternet gelince hepsi sırayla Supabase'e gönderilir.
//
// Tüm veriler tarayıcının IndexedDB'sinde tutulur (telefonun içindeki
// küçük bir veritabanı). localStorage'dan çok daha güçlüdür.
//
// NOT: Bu dosyadaki bazı fonksiyonlar (savePendingChange, syncPending,
// refreshPendingBadge) Adım 7.2'nin İKİNCİ parçasında devreye girer.
// Şu an tanımlı dururlar ama hiçbir yerden çağrılmadıkları için
// tamamen tehlikesizdir.
// ---------------------------------------------------------------

import { supabase } from './supabaseClient.js';

const DB_NAME       = 'tcms-offline';
const DB_VERSION    = 1;
const STORE_CACHE   = 'dataCache';
const STORE_PENDING = 'pendingAttendance';

let dbPromise = null;

// Veritabanını aç (yoksa oluştur). Bir kez açılır, tekrar tekrar kullanılır.
function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_CACHE)) {
                db.createObjectStore(STORE_CACHE);
            }
            if (!db.objectStoreNames.contains(STORE_PENDING)) {
                db.createObjectStore(STORE_PENDING, { keyPath: 'key' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
    });
    return dbPromise;
}

// ---------------------------------------------------------------
// VERİ CACHE'İ — get / set
// Anahtar (key) örnekleri: 'schools', 'classes_3', 'attendance_12'
// Hata olursa uygulama çökmesin diye null/false döner.
// ---------------------------------------------------------------
export async function cacheGet(key) {
    try {
        const db = await openDB();
        return await new Promise((resolve) => {
            const tx  = db.transaction(STORE_CACHE, 'readonly');
            const req = tx.objectStore(STORE_CACHE).get(key);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror   = () => resolve(null);
        });
    } catch (e) {
        console.warn('[offline] cacheGet hata:', e);
        return null;
    }
}

export async function cacheSet(key, value) {
    try {
        const db = await openDB();
        return await new Promise((resolve) => {
            const tx = db.transaction(STORE_CACHE, 'readwrite');
            tx.objectStore(STORE_CACHE).put(value, key);
            tx.oncomplete = () => resolve(true);
            tx.onerror    = () => resolve(false);
        });
    } catch (e) {
        console.warn('[offline] cacheSet hata:', e);
        return false;
    }
}

// ---------------------------------------------------------------
// BEKLEYEN DEĞİŞİKLİKLER — sıraya ekle / oku / say / sil
// Her kayıt: { key, studentId, courseDateId, status }
//   key    = "ogrenciId_tarihId"  → aynı hücre tekrar değişirse
//            üzerine yazılır, yalnızca SON durum saklanır (tek kayıt).
//   status = '+', '-', 'S' veya '' (boş = o yoklamanın silineceği anlamına gelir)
// ---------------------------------------------------------------
export async function savePendingChange(studentId, courseDateId, status) {
    try {
        const db  = await openDB();
        const key = `${studentId}_${courseDateId}`;
        return await new Promise((resolve) => {
            const tx = db.transaction(STORE_PENDING, 'readwrite');
            tx.objectStore(STORE_PENDING).put({ key, studentId, courseDateId, status });
            tx.oncomplete = () => resolve(true);
            tx.onerror    = () => resolve(false);
        });
    } catch (e) {
        console.warn('[offline] savePendingChange hata:', e);
        return false;
    }
}

export async function getPendingChanges() {
    try {
        const db = await openDB();
        return await new Promise((resolve) => {
            const tx  = db.transaction(STORE_PENDING, 'readonly');
            const req = tx.objectStore(STORE_PENDING).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror   = () => resolve([]);
        });
    } catch (e) {
        console.warn('[offline] getPendingChanges hata:', e);
        return [];
    }
}

export async function getPendingCount() {
    try {
        const db = await openDB();
        return await new Promise((resolve) => {
            const tx  = db.transaction(STORE_PENDING, 'readonly');
            const req = tx.objectStore(STORE_PENDING).count();
            req.onsuccess = () => resolve(req.result || 0);
            req.onerror   = () => resolve(0);
        });
    } catch (e) {
        console.warn('[offline] getPendingCount hata:', e);
        return 0;
    }
}

export async function clearPendingChange(key) {
    try {
        const db = await openDB();
        return await new Promise((resolve) => {
            const tx = db.transaction(STORE_PENDING, 'readwrite');
            tx.objectStore(STORE_PENDING).delete(key);
            tx.oncomplete = () => resolve(true);
            tx.onerror    = () => resolve(false);
        });
    } catch (e) {
        console.warn('[offline] clearPendingChange hata:', e);
        return false;
    }
}

// ---------------------------------------------------------------
// SENKRONİZASYON — bekleyen değişiklikleri Supabase'e gönder.
// Başarıyla gönderilen her kayıt sıradan silinir. Sonuçta kaç
// kaydın gönderildiği / başarısız olduğu bilgisi döner.
// (Mevcut toggleAttendance ile aynı mantık: önce sil, sonra ekle.)
// ---------------------------------------------------------------
async function pushOneChange(change) {
    try {
        // Önce o hücrenin eski kaydını sil (varsa)
        await supabase.from('attendance').delete()
            .eq('student_id', change.studentId)
            .eq('course_date_id', change.courseDateId);

        // status boşsa: silindi demektir, yeni kayıt ekleme
        if (change.status === '') return true;

        const { error } = await supabase.from('attendance').insert({
            student_id:     change.studentId,
            course_date_id: change.courseDateId,
            status:         change.status
        });
        return !error;
    } catch (e) {
        return false;
    }
}

export async function syncPendingChanges() {
    if (!navigator.onLine) return { synced: 0, failed: 0 };
    const pending = await getPendingChanges();
    let synced = 0;
    let failed = 0;
    for (const change of pending) {
        const ok = await pushOneChange(change);
        if (ok) {
            await clearPendingChange(change.key);
            synced++;
        } else {
            failed++;
        }
    }
    return { synced, failed };
}

// ---------------------------------------------------------------
// BEKLEYEN KAYIT ROZETİ — ekranın sol altında "N kayıt bekleniyor"
// pili. Sayı 0 ise gizlenir. attendanceActions ve app.js bu
// fonksiyonu çağırarak rozeti tazeler.
// ---------------------------------------------------------------
export async function refreshPendingBadge() {
    const count = await getPendingCount();
    let badge = document.getElementById('pendingSyncBadge');

    if (count <= 0) {
        if (badge) badge.style.display = 'none';
        return;
    }

    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'pendingSyncBadge';
        // CSS dosyası yüklenmese bile okunur kalsın diye temel stiller:
        badge.style.position   = 'fixed';
        badge.style.left       = '16px';
        badge.style.bottom     = '16px';
        badge.style.zIndex     = '999998';
        badge.style.alignItems = 'center';
        badge.style.gap        = '8px';
        document.body.appendChild(badge);
    }
    badge.style.display = 'flex';
    badge.innerHTML = `<span style="font-size:15px;">⏳</span><span>${count} kayıt bekleniyor</span>`;
}