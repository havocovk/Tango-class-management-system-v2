// ---------------------------------------------------------------
// attendanceActions.js — Yoklama Veri İşlemleri
// ---------------------------------------------------------------
// Sorumlulukları:
//   - toggleAttendance()   → yoklama durumu değiştir (boş → + → - → S → boş)
//   - addStudent()         → sınıfa yeni öğrenci ekle
//   - addWeek()            → bir sonraki haftayı ekle
//   - deleteWeek()         → haftayı ve tüm bağlı kayıtları sil
//   - updateStudentName()  → öğrenci adını güncelle (attendanceModals çağırır)
//   - deleteStudent()      → öğrenciyi sil (attendanceModals çağırır)
//
// BAĞIMLILIK:
//   attendanceActions.js → attendance.js (loadAttendanceData + renderAttendanceView)
//   attendance.js        → attendanceActions.js : HAYIR (döngü yok ✓)
// ---------------------------------------------------------------

import { supabase } from './supabaseClient.js';
import { refreshIcons, openPromptModal, showToast } from './utils.js';
import { appState } from './state.js';
import { loadAttendanceData, renderAttendanceView } from './attendance.js';
import { savePendingChange, clearPendingChange, refreshPendingBadge } from './offlineStore.js';

// ---------------------------------------------------------------
// ADIM 5.1 — YOKLAMA DEĞİŞİMİNDE SADECE İLGİLİ HÜCREYİ GÜNCELLE
// ---------------------------------------------------------------
// ESKİ DAVRANIM:
//   1. Veritabanına git → tüm yoklama verisini yeniden çek
//   2. Tüm tabloyu sıfırdan yeniden çiz (renderAttendanceView)
//   → Her tıklamada tüm sayfa titriyor, gereksiz yavaşlık.
//
// YENİ DAVRANIM:
//   1. Veritabanını güncelle
//   2. appState.attendanceMap'i bellekte güncelle (DB'ye gitmeden)
//   3. Sadece o tek hücreyi sayfada bul → sadece ikonunu değiştir
//   → Sayfa titremez, anlık güncelleme, çok daha hızlı.
// ---------------------------------------------------------------
export async function toggleAttendance(studentId, courseDateId) {
    const current = appState.attendanceMap[`${studentId}_${courseDateId}`] || '';
    let newStatus = '';
    if (current === '') newStatus = '+';
    else if (current === '+') newStatus = '-';
    else if (current === '-') newStatus = 'S';
    else newStatus = '';

    // ADIM 7.2 — ÇEVRİMDIŞIYSA: Supabase'e gitmeyiz. Değişikliği bellekte
    // güncelleriz, gönderilmek üzere sıraya koyarız, hücreyi anında
    // güncelleriz ve "N kayıt bekleniyor" rozetini tazeleriz.
    if (!navigator.onLine) {
        if (newStatus === '') delete appState.attendanceMap[`${studentId}_${courseDateId}`];
        else appState.attendanceMap[`${studentId}_${courseDateId}`] = newStatus;

        await savePendingChange(studentId, courseDateId, newStatus);
        await refreshPendingBadge();

        const offlineCell = document.querySelector(`.att-cell[data-student-id="${studentId}"][data-date-id="${courseDateId}"]`);
        if (offlineCell) {
            let offlineIcon = '';
            if (newStatus === '+') offlineIcon = '<i data-lucide="check-circle-2" class="icon-present" size="18"></i>';
            else if (newStatus === '-') offlineIcon = '<i data-lucide="x-circle" class="icon-absent" size="18"></i>';
            else if (newStatus === 'S') offlineIcon = '<i data-lucide="user-x" style="color:var(--text-dim);" size="18"></i>';
            offlineCell.innerHTML = offlineIcon;
            refreshIcons();
        }
        return;
    }

    if (newStatus === '') {
        const { error } = await supabase
            .from('attendance')
            .delete()
            .eq('student_id', studentId)
            .eq('course_date_id', courseDateId);
        if (!error) {
            delete appState.attendanceMap[`${studentId}_${courseDateId}`];
        } else {
            showToast('Yoklama güncellenemedi. Bağlantıyı kontrol edin.', 'error');
            return;
        }
    } else {
        await supabase
            .from('attendance')
            .delete()
            .eq('student_id', studentId)
            .eq('course_date_id', courseDateId);

        const { error } = await supabase
            .from('attendance')
            .insert({ student_id: studentId, course_date_id: courseDateId, status: newStatus });

        if (!error) {
            appState.attendanceMap[`${studentId}_${courseDateId}`] = newStatus;
        } else {
            showToast('Yoklama güncellenemedi. Bağlantıyı kontrol edin.', 'error');
            return;
        }
    }

    // Sadece bu hücreyi bul ve ikonunu güncelle — tüm tabloyu yeniden çizme!
    const cell = document.querySelector(`.att-cell[data-student-id="${studentId}"][data-date-id="${courseDateId}"]`);
    if (cell) {
        let iconHtml = '';
        if (newStatus === '+') iconHtml = '<i data-lucide="check-circle-2" class="icon-present" size="18"></i>';
        else if (newStatus === '-') iconHtml = '<i data-lucide="x-circle" class="icon-absent" size="18"></i>';
        else if (newStatus === 'S') iconHtml = '<i data-lucide="user-x" style="color:var(--text-dim);" size="18"></i>';
        cell.innerHTML = iconHtml;
        refreshIcons();
    }

    // ADIM 7.2 — Çevrimiçi yazma başarılı oldu. Bu hücre için bekleyen
    // (eski, çevrimdışı) bir kayıt kalmışsa onu temizle ki sonraki
    // senkronizasyonda eski değer geri yazılmasın. Ardından rozeti tazele.
    await clearPendingChange(`${studentId}_${courseDateId}`);
    await refreshPendingBadge();
}

// ---------------------------------------------------------------
// Öğrenci adı (ve telefon) güncelleme — openStudentActionModal
// (attendanceModals) kaydet butonundan çağırır.
// ADIM 8.1: phone parametresi opsiyonel; verilirse birlikte kaydeder.
// ---------------------------------------------------------------
export async function updateStudentName(studentId, newName, phone) {
    const updateData = { name: newName };
    if (phone !== undefined) updateData.phone = phone || null;
    const { error } = await supabase.from('students').update(updateData).eq('id', studentId);
    if (!error) {
        showToast('Öğrenci bilgileri güncellendi ✓', 'success');
        await loadAttendanceData();
        renderAttendanceView();
    } else {
        showToast('Güncelleme başarısız. Bağlantıyı kontrol edin.', 'error');
    }
}

// ---------------------------------------------------------------
// Öğrenci silme — openStudentActionModal (attendanceModals)
// sil butonundan çağırır
// ---------------------------------------------------------------
export async function deleteStudent(studentId) {
    const { error } = await supabase.from('students').delete().eq('id', studentId);
    if (error) {
        showToast('Öğrenci silinemedi. Bağlantıyı kontrol edin.', 'error');
        return false;
    }
    showToast('Öğrenci silindi ✓', 'success');
    await loadAttendanceData();
    renderAttendanceView();
    return true;
}

// ---------------------------------------------------------------
// Yeni öğrenci ekleme — renderAttendanceView addStudentBtn'den çağırır
// ---------------------------------------------------------------
export async function addStudent() {
    openPromptModal('Yeni Öğrenci', 'Adı ve soyadı', async (name) => {
        if (!name) return;
        const { error } = await supabase.from('students').insert({ class_id: appState.currentClassId, name });
        if (error) {
            showToast('Öğrenci eklenemedi. Bağlantıyı kontrol edin.', 'error');
        } else {
            showToast(`${name} sınıfa eklendi ✓`, 'success');
            await loadAttendanceData();
            renderAttendanceView();
        }
    });
}

// ---------------------------------------------------------------
// Yeni hafta ekleme — son haftanın 7 gün sonrasını ekler
// ---------------------------------------------------------------
export async function addWeek() {
    const lastDate = appState.courseDates.length
        ? new Date(appState.courseDates[appState.courseDates.length - 1].date)
        : new Date();
    const newDate    = new Date(lastDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const newDateStr = newDate.toISOString().split('T')[0];
    const { error } = await supabase.from('course_dates').insert({
        class_id:        appState.currentClassId,
        date:            newDateStr,
        teacher_partner: null
    });
    if (!error) {
        showToast('Yeni hafta eklendi ✓', 'success');
        await loadAttendanceData();
        renderAttendanceView();
    } else {
        showToast('Hafta eklenemedi. Bağlantıyı kontrol edin.', 'error');
    }
}

// ---------------------------------------------------------------
// Hafta silme — sırayla: yoklamalar → videolar → ders tarihi
// renderAttendanceView'daki header th click'ten çağırılır
// ---------------------------------------------------------------
export async function deleteWeek(courseDateId) {
    try {
        const { error: attError } = await supabase.from('attendance').delete().eq('course_date_id', courseDateId);
        if (attError) throw attError;
        const { error: vidError } = await supabase.from('videos').delete().eq('course_date_id', courseDateId);
        if (vidError) throw vidError;
        const { error: dateError } = await supabase.from('course_dates').delete().eq('id', courseDateId);
        if (dateError) throw dateError;
        showToast('Hafta silindi ✓', 'success');
        await loadAttendanceData();
        renderAttendanceView();
    } catch (err) {
        showToast('Hafta silinirken sorun oluştu. Bağlantıyı kontrol edin.', 'error');
    }
}

// ---------------------------------------------------------------
// Dersi İptal Et / İptali Geri Al
// İptal edilen hafta veritabanında durur (silinmez), sadece
// is_cancelled bayrağı değişir. Yoklama ve ödeme hesaplarında bu
// hafta sayılmaz; tablo yeniden çizilince soluk/üstü çizili görünür.
// renderAttendanceView'daki hafta aksiyon menüsünden çağırılır.
// ---------------------------------------------------------------
export async function toggleWeekCancel(courseDateId, makeCancelled) {
    const { error } = await supabase
        .from('course_dates')
        .update({ is_cancelled: makeCancelled })
        .eq('id', courseDateId);

    if (!error) {
        showToast(makeCancelled ? 'Ders iptal edildi ✓' : 'İptal geri alındı ✓', 'success');
        await loadAttendanceData();
        renderAttendanceView();
    } else {
        showToast('İşlem başarısız. Bağlantıyı kontrol edin.', 'error');
    }
}