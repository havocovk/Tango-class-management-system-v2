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
import { refreshIcons, openPromptModal, showToast, escapeHtml } from './utils.js';
import { appState } from './state.js';
import { loadAttendanceData, renderAttendanceView } from './attendance.js';
import { savePendingChange, clearPendingChange, refreshPendingBadge } from './offlineStore.js';
import { t } from './i18n.js';

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
    else if (current === 'S') newStatus = 'I';
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
            else if (newStatus === 'I') offlineIcon = '<i data-lucide="user-minus" style="color:var(--accent);" size="18"></i>';
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
            showToast(t('actions.attUpdateFail'), 'error');
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
            showToast(t('actions.attUpdateFail'), 'error');
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
        else if (newStatus === 'I') iconHtml = '<i data-lucide="user-minus" style="color:var(--accent);" size="18"></i>';
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
        showToast(t('actions.studentUpdated'), 'success');
        await loadAttendanceData();
        renderAttendanceView();
    } else {
        showToast(t('actions.studentUpdateFail'), 'error');
    }
}

// ---------------------------------------------------------------
// Öğrenci silme — openStudentActionModal (attendanceModals)
// sil butonundan çağırır
// ---------------------------------------------------------------
export async function deleteStudent(studentId) {
    const { error } = await supabase.from('students').delete().eq('id', studentId);
    if (error) {
        showToast(t('actions.studentDeleteFail'), 'error');
        return false;
    }
    showToast(t('actions.studentDeleted'), 'success');
    await loadAttendanceData();
    renderAttendanceView();
    return true;
}

// ---------------------------------------------------------------
// ADIM 5.1 — ÖĞRENCİYİ ARŞİVLE / ARŞİVDEN ÇIKAR
// Silmez; yalnızca is_archived bayrağını değiştirir. Veriler korunur.
// ---------------------------------------------------------------
export async function archiveStudent(studentId, makeArchived) {
    const { error } = await supabase
        .from('students')
        .update({ is_archived: makeArchived })
        .eq('id', studentId);
    if (error) {
        showToast(t('actions.archiveFail'), 'error');
        return;
    }
    showToast(makeArchived ? t('actions.studentArchived') : t('actions.studentUnarchived'), 'success');

    // ADIM 5.1 — Bir öğrenci arşivlendiğinde "arşivi göster" modunu kapat
    // ki öğrenci listeden hemen gizlensin. Arşivden çıkarıldığında ise
    // mod zaten açıktı (kullanıcı arşivi görüyordu), dokunma.
    if (makeArchived) {
        appState.showArchivedStudents = false;
    }

    await loadAttendanceData();
    renderAttendanceView();
}

// ---------------------------------------------------------------
// Yeni öğrenci ekleme — renderAttendanceView addStudentBtn'den çağırır
// ---------------------------------------------------------------
export async function addStudent() {
    openPromptModal(t('actions.newStudentTitle'), t('actions.newStudentPlaceholder'), async (name) => {
        if (!name) return;
        const { error } = await supabase.from('students').insert({ class_id: appState.currentClassId, name });
        if (error) {
            showToast(t('actions.studentAddFail'), 'error');
        } else {
            showToast(t('actions.studentAdded', { name }), 'success');
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
        showToast(t('actions.weekAdded'), 'success');
        await loadAttendanceData();
        renderAttendanceView();
    } else {
        showToast(t('actions.weekAddFail'), 'error');
    }
}

// ---------------------------------------------------------------
// Hafta silme — course_dates kaydını sil; attendance ve videos
// tabloları ON DELETE CASCADE ile veritabanı tarafında otomatik silinir.
// renderAttendanceView'daki header th click'ten çağırılır
// ---------------------------------------------------------------
export async function deleteWeek(courseDateId) {
    const { error } = await supabase.from('course_dates').delete().eq('id', courseDateId);
    if (error) {
        showToast(t('actions.weekDeleteFail'), 'error');
        return;
    }
    showToast(t('actions.weekDeleted'), 'success');
    await loadAttendanceData();
    renderAttendanceView();
}

// ---------------------------------------------------------------
// Mevcut öğrenci aktar — başka sınıftan öğrenciyi bu sınıfa kopyala
// Sınıf birleşmelerinde kullanılır: öğrenciyi yeniden kayıt etmeden
// seçim listesinden seçerek bu sınıfa ekler.
// ---------------------------------------------------------------
export async function importStudentFromClasses() {
    const { data: allStudents, error } = await supabase
        .from('students')
        .select('id, name, phone, class_id, classes(name)')
        .eq('is_archived', false)
        .order('name');

    if (error) { showToast(t('actions.importLoadFail'), 'error'); return; }
    if (!allStudents || allStudents.length === 0) { showToast(t('actions.importEmpty'), 'warning'); return; }

    // Bu sınıfta zaten kayıtlı öğrenci isimlerini al (duplicate önleme)
    const existingNames = appState.students.map(s => s.name.trim().toLowerCase());

    // Başka sınıflara ait öğrencileri filtrele (bu sınıftakileri listede gösterme)
    const otherStudents = allStudents.filter(s => s.class_id !== appState.currentClassId);

    if (otherStudents.length === 0) { showToast(t('actions.importEmpty'), 'warning'); return; }

    const modal    = document.getElementById('dynamicModal');
    const titleEl  = document.getElementById('dynamicModalTitle');
    const inputEl  = document.getElementById('dynamicInput');
    const confirmB = document.getElementById('dynamicModalConfirm');
    const cancelB  = document.getElementById('dynamicModalCancel');
    if (!modal) { showToast('Modal not found.', 'error'); return; }

    titleEl.textContent = t('workshopAtt.importTitle');

    // Input yerine select listesi göster
    inputEl.style.display = 'none';
    let selectEl = document.getElementById('attImportSelect');
    if (!selectEl) {
        selectEl = document.createElement('select');
        selectEl.id = 'attImportSelect';
        selectEl.style.cssText = 'width:100%;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;margin-top:10px;';
        inputEl.parentNode.insertBefore(selectEl, inputEl);
    }
    selectEl.style.display = 'block';
    selectEl.innerHTML = otherStudents.map(s => {
        const className = s.classes ? s.classes.name : '';
        const alreadyIn = existingNames.includes(s.name.trim().toLowerCase());
        return `<option value="${s.id}" data-name="${escapeHtml(s.name)}" data-phone="${escapeHtml(s.phone || '')}" ${alreadyIn ? 'disabled' : ''}>${escapeHtml(s.name)}${className ? ' (' + escapeHtml(className) + ')' : ''}${alreadyIn ? ' ✓' : ''}</option>`;
    }).join('');

    modal.style.display = 'flex';

    confirmB.onclick = async () => {
        const selected = selectEl.options[selectEl.selectedIndex];
        if (!selected || selected.disabled) { showToast(t('actions.importInvalid'), 'warning'); return; }
        const name  = selected.dataset.name;
        const phone = selected.dataset.phone || null;

        modal.style.display    = 'none';
        selectEl.style.display = 'none';
        inputEl.style.display  = 'block';

        const { error: insErr } = await supabase.from('students').insert({
            class_id:    appState.currentClassId,
            name,
            phone:       phone || null,
            is_archived: false
        });
        if (insErr) { showToast(t('actions.importFail').replace('{msg}', insErr.message), 'error'); return; }
        showToast(t('actions.importSuccess').replace('{name}', name), 'success');
        await loadAttendanceData();
        renderAttendanceView();
    };

    cancelB.onclick = () => {
        modal.style.display    = 'none';
        selectEl.style.display = 'none';
        inputEl.style.display  = 'block';
    };
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
        showToast(makeCancelled ? t('actions.weekCancelled') : t('actions.weekUncancelled'), 'success');
        await loadAttendanceData();
        renderAttendanceView();
    } else {
        showToast(t('actions.weekToggleFail'), 'error');
    }
}