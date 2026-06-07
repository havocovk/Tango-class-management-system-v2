import { supabase } from './supabaseClient.js';
import { navigateTo } from './router.js';
import { showToast } from './utils.js';

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

window.addEventListener('online', () => {
    hideOfflineBanner();
    showToast('Bağlantı geri geldi ✓', 'success');
});

// "Tekrar Dene" butonu: okullar sayfasını yeniden yükle
retryBtn.onclick = async () => {
    if (!navigator.onLine) {
        showToast('Hâlâ çevrimdışısınız. Bağlantıyı kontrol edin.', 'warning');
        return;
    }
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