import { supabase } from './supabaseClient.js';
import { navigateTo } from './router.js';
import { showToast } from './utils.js';
import { syncPendingChanges, refreshPendingBadge, getPendingCount } from './offlineStore.js';

// ---------------------------------------------------------------
// ADIM 1.2 — KULLANICI GİRİŞ SİSTEMİ
// ---------------------------------------------------------------
// Uygulama artık yalnızca giriş yapan (şifresini bilen) kullanıcıya
// açılır. Oturum bilgisi tarayıcıda otomatik saklanır; "beni hatırla"
// özelliğini Supabase kendisi halleder, bu yüzden her seferinde
// yeniden giriş yapmaya gerek kalmaz.
// ---------------------------------------------------------------

const loginScreen   = document.getElementById('loginScreen');
const appContainer  = document.getElementById('appContainer');
const logoutBtn     = document.getElementById('logoutBtn');
const loginBtn      = document.getElementById('loginBtn');
const emailInput    = document.getElementById('loginEmail');
const passwordInput = document.getElementById('loginPassword');
const loginError    = document.getElementById('loginError');

// ---------------------------------------------------------------
// ADIM 4.2 — İNTERNET BAĞLANTISI KOPMA YÖNETİMİ
// ---------------------------------------------------------------
// Tango dersleri bodrum katlarda yapılır — internet olmayabilir.
// Bu kod; bağlantı kesilince sayfanın üstünde turuncu bir uyarı
// bandı gösterir. İnternet gelince bant otomatik kaybolur.
// ---------------------------------------------------------------

const offlineBanner = document.getElementById('offlineBanner');
const retryBtn      = document.getElementById('retryBtn');

function showOfflineBanner() {
    offlineBanner.style.display = 'flex';
    // Bant sayfanın üstünü kapatamasın diye içerik aşağı kayar
    document.body.style.paddingTop = '63px';
}

function hideOfflineBanner() {
    offlineBanner.style.display = 'none';
    document.body.style.paddingTop = '15px';
}

// Tarayıcı internet bağlantısını izliyor
window.addEventListener('offline', () => {
    showOfflineBanner();
});

// ADIM 7.2 — Bağlantı gelince bekleyen çevrimdışı yoklamaları Supabase'e gönder.
// isSyncing: aynı anda iki senkronizasyon çalışıp kayıtların iki kez
// gönderilmesini engelleyen küçük bir kilit.
let isSyncing = false;

async function trySyncPending() {
    if (isSyncing) return;          // zaten senkronize ediliyorsa tekrar başlatma
    if (!navigator.onLine) return;  // internet yoksa boşuna deneme
    isSyncing = true;
    try {
        const { synced, failed } = await syncPendingChanges();
        await refreshPendingBadge();
        if (synced > 0) {
            showToast(`${synced} çevrimdışı kayıt senkronize edildi ✓`, 'success');
        }
        if (failed > 0) {
            showToast(`${failed} kayıt gönderilemedi, tekrar denenecek.`, 'warning');
        }
    } finally {
        isSyncing = false;
    }
}

window.addEventListener('online', async () => {
    hideOfflineBanner();
    showToast('Bağlantı geri geldi ✓', 'success');
    await trySyncPending();
});

// ---------------------------------------------------------------
// ADIM 7.2 — GÜVENİLİR SENKRONİZASYON TETİKLEYİCİLERİ
// ---------------------------------------------------------------
// Mobil tarayıcılarda 'online' olayı her zaman tetiklenmez (özellikle
// uçak modu açılıp kapatılınca). Bu yüzden tek bir olaya güvenmeyiz;
// bekleyen kayıtları göndermek için iki ek yöntem daha kullanırız:
//
//   1) Uygulama yeniden öne geldiğinde (visibilitychange) kontrol et.
//   2) Birkaç saniyede bir periyodik kontrol et (en garantili yol —
//      kullanıcı ekrana bakarken internet gelirse de yakalar).
// ---------------------------------------------------------------

// 1) Uygulama tekrar öne gelince: internet varsa ve bekleyen varsa gönder
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
        const pending = await getPendingCount();
        if (pending > 0) await trySyncPending();
    }
});

// 2) Her 8 saniyede bir kontrol: internet varsa ve bekleyen kayıt varsa gönder
setInterval(async () => {
    if (!navigator.onLine) return;
    const pending = await getPendingCount();
    if (pending > 0) await trySyncPending();
}, 8000);

// "Tekrar Dene" butonu: okullar sayfasını yeniden yükle
retryBtn.onclick = async () => {
    if (!navigator.onLine) {
        showToast('Hâlâ çevrimdışısınız. Bağlantıyı kontrol edin.', 'warning');
        return;
    }
    await trySyncPending();
    await navigateTo('schools');
};

// Sayfa ilk açılışında bağlantı yoksa hemen bandı göster
if (!navigator.onLine) {
    showOfflineBanner();
}

// ---------------------------------------------------------------
// GİRİŞ / ÇIKIŞ FONKSİYONLARI
// ---------------------------------------------------------------

let appStarted = false;

function showLogin() {
    appStarted = false;
    loginScreen.style.display = 'flex';
    appContainer.style.display = 'none';
    logoutBtn.style.display = 'none';
    loginError.innerText = '';
    passwordInput.value = '';
}

async function startApp() {
    if (appStarted) return;
    appStarted = true;
    loginScreen.style.display = 'none';
    appContainer.style.display = 'block';
    logoutBtn.style.display = 'block';
    await navigateTo('schools');

    // ADIM 7.2 — Açılışta: internet varsa bekleyen kayıtları gönder,
    // yoksa "N kayıt bekleniyor" rozetini göster.
    if (navigator.onLine) {
        await trySyncPending();
    } else {
        await refreshPendingBadge();
    }
}

async function handleLogin() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    loginError.innerText = '';

    if (!email || !password) {
        loginError.innerText = 'Lütfen e-posta ve şifrenizi girin.';
        return;
    }

    loginBtn.disabled = true;
    loginBtn.innerText = 'Giriş yapılıyor...';

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    loginBtn.disabled = false;
    loginBtn.innerText = 'Giriş Yap';

    if (error) {
        loginError.innerText = navigator.onLine
            ? 'Giriş başarısız. E-posta veya şifre hatalı.'
            : 'İnternet bağlantısı yok. Lütfen bağlantınızı kontrol edin.';
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
}

loginBtn.onclick = handleLogin;
emailInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
logoutBtn.onclick = handleLogout;

supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        startApp();
    } else if (event === 'SIGNED_OUT') {
        showLogin();
    }
});

(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        await startApp();
    } else {
        showLogin();
    }
})();