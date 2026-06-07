import { supabase } from './supabaseClient.js';
import { navigateTo } from './router.js';

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

// Uygulamanın bir kez başlatıldığını izleyen bayrak.
// (Oturum tazelenince kullanıcıyı tekrar okullar sayfasına atmamak için.)
let appStarted = false;

// Giriş ekranını göster, uygulamayı gizle
function showLogin() {
    appStarted = false;
    loginScreen.style.display = 'flex';
    appContainer.style.display = 'none';
    logoutBtn.style.display = 'none';
    loginError.innerText = '';
    passwordInput.value = '';
}

// Uygulamayı başlat, giriş ekranını gizle — yalnızca bir kez çalışır
async function startApp() {
    if (appStarted) return;
    appStarted = true;
    loginScreen.style.display = 'none';
    appContainer.style.display = 'block';
    logoutBtn.style.display = 'block';
    await navigateTo('schools');
}

// "Giriş Yap" butonu
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
        loginError.innerText = 'Giriş başarısız. E-posta veya şifre hatalı.';
    }
    // Başarılıysa aşağıdaki onAuthStateChange "SIGNED_IN" olayını yakalar
    // ve startApp() otomatik çalışır.
}

// "Çıkış" butonu
async function handleLogout() {
    await supabase.auth.signOut();
    // onAuthStateChange "SIGNED_OUT" olayını yakalar ve showLogin() çalışır.
}

// Buton ve klavye (Enter) olayları
loginBtn.onclick = handleLogin;
emailInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
logoutBtn.onclick = handleLogout;

// Giriş / çıkış değişikliklerini dinle
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        startApp();
    } else if (event === 'SIGNED_OUT') {
        showLogin();
    }
    // TOKEN_REFRESHED gibi diğer olaylarda hiçbir şey yapma —
    // kullanıcıyı çalışırken rahatsız etmeyelim.
});

// Sayfa ilk açıldığında: tarayıcıda kayıtlı bir oturum var mı?
(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        await startApp();
    } else {
        showLogin();
    }
})();