// ---------------------------------------------------------------
// workshopAttActions.js — ÇALIŞTAY YOKLAMA VERİ İŞLEMLERİ
// ---------------------------------------------------------------
// Sorumlulukları:
//   - toggleWorkshopAttendance() → yoklama durumu değiştir (boş → + → - → S → boş)
//   - addWorkshopStudent()       → çalıştaya yeni öğrenci ekle
//   - addWorkshopWeek()          → bir sonraki haftayı ekle
//   - deleteWorkshopWeek()       → haftayı ve tüm bağlı kayıtları sil
//   - importStudentFromClasses() → grup dersi öğrencisini aktar
//   - toggleWorkshopWeekCancel() → dersi iptal et / iptali geri al
//   - downloadWorkshopAttCsv()   → yoklama tablosunu CSV olarak indir
//
// BAĞIMLILIK:
//   workshopAttActions.js → workshop_attendance.js (loadWorkshopData + renderWorkshopAttendance)
//   workshop_attendance.js → workshopAttActions.js : HAYIR (döngü yok ✓)
// ---------------------------------------------------------------

import { supabase } from './supabaseClient.js';
import { showToast, escapeHtml } from './utils.js';
import { appState } from './state.js';
import { t } from './i18n.js';
import { loadWorkshopData, renderWorkshopAttendance } from './workshop_attendance.js';

// ---------------------------------------------------------------
// Yoklama toggle (boş → + → - → S → boş)
// ---------------------------------------------------------------
export async function toggleWorkshopAttendance(studentId, dateId, cell) {
    const key = `${studentId}_${dateId}`;
    const current = appState.wsAttendanceMap[key] || '';
    let newStatus = '';
    if (current === '') newStatus = '+';
    else if (current === '+') newStatus = '-';
    else if (current === '-') newStatus = 'S';
    else newStatus = '';

    // Önce eski kaydı sil
    await supabase.from('workshop_attendance').delete()
        .eq('student_id', studentId).eq('workshop_date_id', dateId);

    if (newStatus === '') {
        delete appState.wsAttendanceMap[key];
    } else {
        const { error } = await supabase.from('workshop_attendance').insert({
            workshop_id:      appState.currentWorkshopId,
            workshop_date_id: dateId,
            student_id:       studentId,
            status:           newStatus
        });
        if (error) { showToast(t('workshopAtt.attSaveFail').replace('{msg}', error.message), 'error'); return; }
        appState.wsAttendanceMap[key] = newStatus;
    }

    // Sadece bu hücreyi güncelle
    let icon = '';
    if (newStatus === '+') icon = '<i data-lucide="check-circle-2" class="icon-present" size="18"></i>';
    else if (newStatus === '-') icon = '<i data-lucide="x-circle" class="icon-absent" size="18"></i>';
    else if (newStatus === 'S') icon = '<i data-lucide="user-x" style="color:var(--text-dim);" size="18"></i>';
    cell.innerHTML = icon;
    if (window.lucide) window.lucide.createIcons();
}

// ---------------------------------------------------------------
// Öğrenci ekle
// ---------------------------------------------------------------
export function addWorkshopStudent() {
    const modal   = document.getElementById('doubleInputModal');
    const title   = document.getElementById('doubleModalTitle');
    const input1  = document.getElementById('doubleInput1');
    const input2  = document.getElementById('doubleInput2');
    const confirm = document.getElementById('doubleModalConfirm');
    const cancel  = document.getElementById('doubleModalCancel');
    if (!modal) { showToast('Modal not found.', 'error'); return; }

    title.textContent    = t('workshopAtt.newStudentTitle');
    input1.placeholder   = t('workshopAtt.namePlaceholder');
    input2.placeholder   = t('workshopAtt.phonePlaceholder');
    input1.value         = '';
    input2.value         = '';
    modal.style.display  = 'flex';
    input1.focus();

    confirm.onclick = async () => {
        const name  = input1.value.trim();
        const phone = input2.value.trim() || null;
        if (!name) { showToast(t('workshopAtt.nameEmpty'), 'warning'); return; }
        modal.style.display = 'none';
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { showToast(t('workshopAtt.sessionNotFound'), 'error'); return; }
        const { error } = await supabase.from('workshop_students').insert({
            workshop_id: appState.currentWorkshopId,
            user_id:     user.id,
            name,
            phone,
            is_archived: false
        });
        if (error) { showToast(t('workshopAtt.studentAddFail').replace('{msg}', error.message), 'error'); return; }
        showToast(t('workshopAtt.studentAdded'), 'success');
        await loadWorkshopData();
        renderWorkshopAttendance();
    };
    cancel.onclick = () => { modal.style.display = 'none'; };
}

// ---------------------------------------------------------------
// Hafta ekle (son haftanın 7 gün sonrası)
// ---------------------------------------------------------------
export async function addWorkshopWeek() {
    const dates = appState.wsDates;
    let lastDate, lastWeekNum;
    if (dates.length > 0) {
        lastDate    = new Date(dates[dates.length - 1].lesson_date);
        lastWeekNum = dates[dates.length - 1].week_number;
    } else {
        lastDate    = new Date();
        lastWeekNum = 0;
    }
    const newDate = new Date(lastDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { error } = await supabase.from('workshop_dates').insert({
        workshop_id:  appState.currentWorkshopId,
        lesson_date:  newDate.toISOString().split('T')[0],
        week_number:  lastWeekNum + 1,
        is_cancelled: false
    });
    if (error) { showToast(t('workshopAtt.weekAddFail').replace('{msg}', error.message), 'error'); return; }
    showToast(t('workshopAtt.weekAdded'), 'success');
    await loadWorkshopData();
    renderWorkshopAttendance();
}

// ---------------------------------------------------------------
// Hafta sil — workshop_dates kaydını sil; workshop_attendance ve
// workshop_videos tabloları ON DELETE CASCADE ile veritabanı
// tarafında otomatik silinir.
// ---------------------------------------------------------------
export async function deleteWorkshopWeek(dateId) {
    const { error } = await supabase.from('workshop_dates').delete().eq('id', dateId);
    if (error) {
        showToast(t('workshopAtt.weekDeleteFail').replace('{msg}', error.message), 'error');
        return;
    }
    showToast(t('workshopAtt.weekDeleted'), 'success');
    await loadWorkshopData();
    renderWorkshopAttendance();
}

// ---------------------------------------------------------------
// Mevcut grup dersi öğrencisini çalıştaya aktar
// ---------------------------------------------------------------
export async function importStudentFromClasses() {
    const { data: allStudents, error } = await supabase
        .from('students')
        .select('id, name, phone, class_id, classes(name)')
        .eq('is_archived', false)
        .order('name');

    if (error) { showToast(t('workshopAtt.importLoadFail'), 'error'); return; }
    if (!allStudents || allStudents.length === 0) { showToast(t('workshopAtt.importEmpty'), 'warning'); return; }

    // Zaten çalıştayda olan öğrenci isimlerini al (duplicate önleme)
    const existingNames = appState.wsStudents.map(s => s.name.trim().toLowerCase());

    // Basit seçim listesi — dynamicModal'ı genişlet
    const modal    = document.getElementById('dynamicModal');
    const titleEl  = document.getElementById('dynamicModalTitle');
    const inputEl  = document.getElementById('dynamicInput');
    const confirmB = document.getElementById('dynamicModalConfirm');
    const cancelB  = document.getElementById('dynamicModalCancel');
    if (!modal) { showToast('Modal not found.', 'error'); return; }

    titleEl.textContent = t('workshopAtt.importTitle');

    // Input yerine select listesi göster
    inputEl.style.display = 'none';
    let selectEl = document.getElementById('wsImportSelect');
    if (!selectEl) {
        selectEl = document.createElement('select');
        selectEl.id = 'wsImportSelect';
        selectEl.style.cssText = 'width:100%;background:var(--input-bg);color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;margin-top:10px;';
        inputEl.parentNode.insertBefore(selectEl, inputEl);
    }
    selectEl.style.display = 'block';
    selectEl.innerHTML = allStudents.map(s => {
        const className  = s.classes ? s.classes.name : '';
        const alreadyIn  = existingNames.includes(s.name.trim().toLowerCase());
        return `<option value="${s.id}" data-name="${escapeHtml(s.name)}" data-phone="${escapeHtml(s.phone || '')}" ${alreadyIn ? 'disabled' : ''}>${escapeHtml(s.name)}${className ? ' (' + escapeHtml(className) + ')' : ''}${alreadyIn ? ' ✓' : ''}</option>`;
    }).join('');

    modal.style.display = 'flex';

    confirmB.onclick = async () => {
        const selected = selectEl.options[selectEl.selectedIndex];
        if (!selected || selected.disabled) { showToast(t('workshopAtt.importInvalid'), 'warning'); return; }
        const name  = selected.dataset.name;
        const phone = selected.dataset.phone || null;

        modal.style.display    = 'none';
        selectEl.style.display = 'none';
        inputEl.style.display  = 'block';

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { showToast(t('workshopAtt.sessionNotFound'), 'error'); return; }
        const { error: insErr } = await supabase.from('workshop_students').insert({
            workshop_id: appState.currentWorkshopId,
            user_id:     user.id,
            name,
            phone,
            is_archived: false
        });
        if (insErr) { showToast(t('workshopAtt.importFail').replace('{msg}', insErr.message), 'error'); return; }
        showToast(t('workshopAtt.importSuccess').replace('{name}', name), 'success');
        await loadWorkshopData();
        renderWorkshopAttendance();
    };

    cancelB.onclick = () => {
        modal.style.display    = 'none';
        selectEl.style.display = 'none';
        inputEl.style.display  = 'block';
    };
}

// ---------------------------------------------------------------
// Dersi İptal Et / İptali Geri Al
// ---------------------------------------------------------------
export async function toggleWorkshopWeekCancel(dateId, makeCancelled) {
    const { error } = await supabase.from('workshop_dates')
        .update({ is_cancelled: makeCancelled }).eq('id', dateId);
    if (error) { showToast(t('workshopAtt.weekToggleFail'), 'error'); return; }
    showToast(makeCancelled ? t('workshopAtt.weekCancelled') : t('workshopAtt.weekUncancelled'), 'success');
    await loadWorkshopData();
    renderWorkshopAttendance();
}

// ---------------------------------------------------------------
// Çalıştay Yoklama CSV Dışa Aktar
// ---------------------------------------------------------------
export function downloadWorkshopAttCsv() {
    const statusMap = { '+': t('workshopAtt.csvStatusPresent'), '-': t('workshopAtt.csvStatusAbsent'), 'S': t('workshopAtt.csvStatusSkipped'), 'I': t('workshopAtt.csvStatusInactive'), '': '' };
    const headers = [t('workshopAtt.csvColStudent'), ...appState.wsDates.map(d => d.lesson_date)];
    const rows = appState.wsStudents
        .filter(s => !s.is_archived)
        .map(s => [
            s.name,
            ...appState.wsDates.map(d => {
                const st = appState.wsAttendanceMap[`${s.id}_${d.id}`] || '';
                return statusMap[st] || '';
            })
        ]);
    const csv = [headers, ...rows]
        .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    const today3   = new Date().toISOString().split('T')[0];
    const slug3 = str => str.replace(/ç/g,'c').replace(/Ç/g,'C').replace(/ğ/g,'g').replace(/Ğ/g,'G').replace(/ı/g,'i').replace(/İ/g,'I').replace(/ö/g,'o').replace(/Ö/g,'O').replace(/ş/g,'s').replace(/Ş/g,'S').replace(/ü/g,'u').replace(/Ü/g,'U').replace(/[^a-zA-Z0-9 ]/g,'').trim().replace(/ +/g,'_');
    const studio3  = slug3(appState.currentWorkshop && appState.currentWorkshop.studio_name || '');
    const wsName3  = slug3(appState.currentWorkshopName || 'calistay');
    a.download = `${today3}_${studio3}_${wsName3}_${t('workshopAtt.csvSuffixAtt')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}