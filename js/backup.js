// ---------------------------------------------------------------
// backup.js — ADIM 3.2: JSON YEDEKLEME VE GERİ YÜKLEME
// ---------------------------------------------------------------
// Bu modül iki iş yapar:
//
//   1) YEDEKLEME (exportBackup):
//      Supabase'deki TÜM tabloları (schools, classes, students,
//      course_dates, attendance, payments, videos) tek tek çeker,
//      tek bir JSON dosyası halinde telefona/bilgisayara indirir.
//
//   2) GERİ YÜKLEME (importBackup):
//      Seçilen JSON dosyasını okur ve tabloları DOĞRU SIRAYLA
//      Supabase'e geri yazar. Sıra önemlidir çünkü tablolar
//      birbirine bağlıdır (örn. bir sınıf, önce okulu var olmadan
//      eklenemez).
//
// NOT: Geri yükleme "upsert" (varsa güncelle, yoksa ekle) yöntemini
// kullanır. Böylece aynı yedeği iki kez yüklemek veri çoğaltmaz.
// ---------------------------------------------------------------

import { supabase } from './supabaseClient.js';
import { showToast } from './utils.js';
import { t } from './i18n.js';

// Yedeklenecek tablolar. SIRA ÖNEMLİDİR:
// Geri yüklemede üstten alta doğru yazılır (önce okullar, en son videolar).
// Bu sıra, tabloların birbirine bağımlılığını (foreign key) korur.
const TABLES = [
    // --- Grup Dersleri (orijinal tablolar) ---
    'schools',
    'classes',
    'students',
    'course_dates',
    'attendance',
    'payments',
    'videos',
    // --- Çalıştaylar (Aşama 4) ---
    'workshops',
    'workshop_dates',
    'workshop_students',
    'workshop_attendance',
    'workshop_payments',
    // --- Festivaller (Aşama 5) ---
    'festivals',
    'festival_classes',
    // --- Özel Dersler (Aşama 6) ---
    'private_lessons'
];

// ---------------------------------------------------------------
// YEDEKLEME — tüm tabloları çek, JSON dosyası indir
// ---------------------------------------------------------------
export async function exportBackup() {
    if (!navigator.onLine) {
        showToast('Yedekleme için internet bağlantısı gerekli.', 'warning');
        return;
    }

    showToast('Yedek hazırlanıyor...', 'success');

    const backup = {
        _meta: {
            app: 'TCMS',
            version: 1,
            createdAt: new Date().toISOString()
        },
        data: {}
    };

    try {
        for (const table of TABLES) {
            const { data, error } = await supabase.from(table).select('*');
            if (error) {
                showToast(`Yedekleme hatası (${table}). Bağlantıyı kontrol edin.`, 'error');
                return;
            }
            backup.data[table] = data || [];
        }

        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');

        const now = new Date();
        const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        a.href     = url;
        a.download = `tcms_yedek_${stamp}.json`;
        a.click();
        URL.revokeObjectURL(url);

        showToast('Yedek başarıyla indirildi ✓', 'success');
    } catch (e) {
        console.error('[backup] export hata:', e);
        showToast('Yedekleme sırasında bir hata oluştu.', 'error');
    }
}

// ---------------------------------------------------------------
// GERİ YÜKLEME — JSON dosyası seç, oku, tabloları geri yaz
// ---------------------------------------------------------------
// Bir gizli <input type="file"> oluşturup tıklatır. Kullanıcı dosya
// seçince içeriği okunur, doğrulanır ve tablolara upsert edilir.
// ---------------------------------------------------------------
export function importBackup() {
    if (!navigator.onLine) {
        showToast('Geri yükleme için internet bağlantısı gerekli.', 'warning');
        return;
    }

    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.json,application/json';

    input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        if (!file) return;

        try {
            const text   = await file.text();
            const parsed = JSON.parse(text);

            // Basit doğrulama: bu bizim yedek dosyamız mı?
            if (!parsed || !parsed.data || parsed._meta?.app !== 'TCMS') {
                showToast('Geçersiz yedek dosyası.', 'error');
                return;
            }

            showToast('Geri yükleme başlıyor...', 'success');

            // Tabloları DOĞRU SIRAYLA geri yaz (bağımlılık sırası).
            for (const table of TABLES) {
                const rows = parsed.data[table];
                if (!Array.isArray(rows) || rows.length === 0) continue;

                // upsert: aynı id varsa günceller, yoksa ekler.
                // 500'lük gruplar halinde gönder (büyük veri için güvenli).
                for (let i = 0; i < rows.length; i += 500) {
                    const chunk = rows.slice(i, i + 500);
                    const { error } = await supabase.from(table).upsert(chunk);
                    if (error) {
                        console.error(`[backup] import hata (${table}):`, error);
                        showToast(`Geri yükleme hatası (${table}).`, 'error');
                        return;
                    }
                }
            }

            showToast('Geri yükleme tamamlandı ✓ Sayfa yenileniyor...', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
            console.error('[backup] import hata:', e);
            showToast('Dosya okunamadı veya bozuk.', 'error');
        }
    });

    input.click();
}