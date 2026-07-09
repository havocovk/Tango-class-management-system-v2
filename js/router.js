// ---------------------------------------------------------------
// ADIM 3.1 — ROUTER (YÖNLENDİRİCİ) MODÜLÜ
// ---------------------------------------------------------------
// Bu dosya uygulamanın "santral memuru"dur.
// Tüm sayfa geçişleri TEK bir yerden, buradan yönetilir.
//
// Modüller artık birbirini DOĞRUDAN değil, sadece bu dosyayı çağırır.
// Bu sayede attendance.js ile payments.js arasındaki
// "kısır döngü" (döngüsel bağımlılık) kırılır.
//
// NOT: Burada sayfalar 'import(...)' ile (dinamik import) çağrılıyor.
// Bu özellikle önemli: router.js hiçbir sayfayı en baştan sabit
// olarak içeri almaz, böylece yeni bir döngü oluşmaz.
//
// KULLANIM:
//   navigateTo('schools');
//   navigateTo('classes',    { schoolId, schoolName });
//   navigateTo('attendance', { classId, className });
//   navigateTo('payments',   { classId, className });
//   navigateTo('stats');
// ---------------------------------------------------------------

// En son gidilen sayfa — dil değişiminde yeniden çizmek için saklanır.
let currentRoute = { screen: 'schools', params: {} };

// ---------------------------------------------------------------
// renderScreen — sadece ekranı çizer, history'e DOKUNMAZ.
// Hem navigateTo hem reloadCurrentView tarafından kullanılır.
// ---------------------------------------------------------------
async function renderScreen(screen, params) {
    // Her ekran geçişinde görünürlüğü ayarla:
    // mainMenu → mainMenuView göster, dynamicView gizle
    // diğerleri → dynamicView göster, mainMenuView gizle
    const mainMenuView = document.getElementById('mainMenuView');
    const dynamicView  = document.getElementById('dynamicView');
    if (screen === 'mainMenu') {
        if (mainMenuView) mainMenuView.style.display = 'block';
        if (dynamicView)  dynamicView.style.display  = 'none';
    } else {
        if (mainMenuView) mainMenuView.style.display = 'none';
        if (dynamicView)  dynamicView.style.display  = 'block';
    }

    switch (screen) {
        case 'schools': {
            const module = await import('./schools.js');
            await module.loadSchools();
            break;
        }
        case 'classes': {
            const module = await import('./classes.js');
            await module.showClassesView(params.schoolId, params.schoolName);
            break;
        }
        case 'attendance': {
            const module = await import('./attendance.js');
            await module.showAttendanceView(params.classId, params.className);
            break;
        }
        case 'payments': {
            const module = await import('./payments.js');
            await module.showPaymentsView(params.classId, params.className);
            break;
        }
        case 'stats': {
            const module = await import('./classStats.js');
            await module.showWeeklyStats();
            break;
        }
        default:
            console.error('Bilinmeyen ekran adı:', screen);
    }
}

// ---------------------------------------------------------------
// navigateTo — kullanıcı bir butona/linke tıkladığında çağrılır.
// History'e kayıt EKLER ve ekranı çizer.
//
// ANDROID GERİ TUŞU MANTIĞI:
//   Uygulama ilk açıldığında history boştur. startApp() içinde
//   schools için pushState yapılır → stack: [schools]
//
//   Kullanıcı okula tıklar → navigateTo('classes') → pushState
//   stack: [schools, classes]
//
//   Kullanıcı sınıfa tıklar → navigateTo('attendance') → pushState
//   stack: [schools, classes, attendance]
//
//   Geri tuşu → popstate → classes state'i gelir → renderScreen('classes')
//   Geri tuşu → popstate → schools state'i gelir → renderScreen('schools')
//   Geri tuşu → popstate → history bitti → state null gelir → çıkış onayı
// ---------------------------------------------------------------
export async function navigateTo(screen, params = {}) {
    currentRoute = { screen, params };
    history.pushState({ screen, params }, '');
    await renderScreen(screen, params);
}

// ---------------------------------------------------------------
// reloadCurrentView — DİL DEĞİŞİMİNDE çağrılır.
// History'e DOKUNMAZ, sadece mevcut ekranı yeni dilde yeniden çizer.
// ---------------------------------------------------------------
export async function reloadCurrentView() {
    await renderScreen(currentRoute.screen, currentRoute.params);
}