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
// ---------------------------------------------------------------

export async function navigateTo(screen, params = {}) {
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
        default:
            console.error('Bilinmeyen ekran adı:', screen);
    }
}