// ---------------------------------------------------------------
// workshop_attendance.js — ÇALIŞTAY YOKLAMA SAYFASI
// ADIM 4.4 + 4.5 — Çalıştaya tıklayınca açılan yoklama tablosu
// ---------------------------------------------------------------
// Grup derslerindeki attendance.js yapısının çalıştaylara
// uyarlanmış hali. Öğrenci ekle, hafta ekle, tek hücre toggle,
// partner, not, video özellikleri.
//
// TABLO YAPISI (Supabase):
//   workshop_students:   id, workshop_id, user_id, name, phone, is_archived
//   workshop_dates:      id, workshop_id, lesson_date, week_number,
//                        is_cancelled, note, teacher_partner
//   workshop_attendance: id, workshop_id, workshop_date_id, student_id, status
//   workshop_videos:     id, workshop_date_id, url
// ---------------------------------------------------------------

import { supabase } from './supabaseClient.js';
import { showWorkshopPayments } from './workshop_payments.js';
import { refreshIcons, formatDate, isPastDate, openPromptModal, openPromptModalWithValue, openConfirmModal, showToast, escapeHtml } from './utils.js';
import { navigateTo } from './router.js';
import { t } from './i18n.js';
import { appState } from './state.js';

// ---------------------------------------------------------------
// Giriş noktası — router.js çağırır
// ---------------------------------------------------------------
export async function showWorkshopAttendance(workshopId, workshopName) {
    appState.currentWorkshopId   = workshopId;
    appState.currentWorkshopName = workshopName;
    await loadWorkshopData();
    renderWorkshopAttendance();
}

// ---------------------------------------------------------------
// Supabase'den tüm çalıştay verisini çek
// ---------------------------------------------------------------
async function loadWorkshopData() {
    const wid = appState.currentWorkshopId;

    // Çalıştay ana bilgisi
    const { data: wsData } = await supabase.from('workshops').select('*').eq('id', wid).single();
    appState.currentWorkshop = wsData || null;

    // Öğrenciler
    const { data: students } = await supabase
        .from('workshop_students').select('*').eq('workshop_id', wid).order('id');
    appState.wsStudents = students || [];

    // Haftalar (tarihler)
    const { data: dates } = await supabase
        .from('workshop_dates').select('*').eq('workshop_id', wid).order('week_number');
    appState.wsDates = dates || [];

    // Yoklama
    const dateIds = appState.wsDates.map(d => d.id);
    appState.wsAttendanceMap = {};
    if (dateIds.length > 0) {
        const { data: att } = await supabase
            .from('workshop_attendance').select('*').in('workshop_date_id', dateIds);
        if (att) att.forEach(a => {
            appState.wsAttendanceMap[`${a.student_id}_${a.workshop_date_id}`] = a.status;
        });
    }

    // Video
    appState.wsVideoMap = {};
    if (dateIds.length > 0) {
        const { data: vids } = await supabase
            .from('workshop_videos').select('*').in('workshop_date_id', dateIds);
        if (vids) vids.forEach(v => { appState.wsVideoMap[v.workshop_date_id] = v.url; });
    }

    // Partner ve not (workshop_dates içinde)
    appState.wsPartnerMap = {};
    appState.wsNotesMap   = {};
    appState.wsDates.forEach(d => {
        appState.wsPartnerMap[d.id] = d.teacher_partner || '';
        appState.wsNotesMap[d.id]   = d.note || '';
    });
}

// ---------------------------------------------------------------
// Tabloyu çiz
// ---------------------------------------------------------------
function renderWorkshopAttendance() {
    const container = document.getElementById('dynamicView');
    if (!container) return;

    const ws = appState.currentWorkshop;

    // Üst bilgi kutusu
    let infoHtml = '';
    if (ws) {
        const weeks   = ws.total_weeks ? `${ws.total_weeks} ${t('workshopAtt.weekUnit')}` : '';
        const dateStr = ws.start_date  ? ws.start_date.split('T')[0] : '';
        const time    = ws.lesson_time ? ws.lesson_time.substring(0,5) : '';
        infoHtml = `
        <div style="background:rgba(45,212,191,0.06);border:1px solid rgba(45,212,191,0.25);border-radius:14px;padding:14px 16px;margin-bottom:16px;">
            <div style="font-size:12px;color:var(--text-dim);line-height:1.9;">
                ${ws.studio_name ? '<div><b>' + t('workshopAtt.studioLabel') + ':</b> ' + escapeHtml(ws.studio_name) + '</div>' : ''}
                ${dateStr ? '<div><b>' + t('workshopAtt.startLabel') + ':</b> ' + dateStr + (time ? ' · ' + time : '') + '</div>' : ''}
                ${weeks ? '<div><b>' + t('workshopAtt.durationLabel') + ':</b> ' + weeks + '</div>' : ''}
                ${ws.theme ? '<div><b>' + t('workshopAtt.themeLabel') + ':</b> ' + escapeHtml(ws.theme) + '</div>' : ''}
            </div>
        </div>`;
    }

    container.innerHTML = `
        <div class="view">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <div class="back-link" id="backToWorkshopsBtn" style="margin-bottom:0;">${t('workshopAtt.backToWorkshops')}</div>
                <button id="wsCsvBtn" style="flex:none;min-width:auto;width:auto;display:inline-flex;align-items:center;gap:5px;padding:7px 10px;background:transparent;border:1.5px solid var(--primary);border-radius:10px;color:var(--primary);font-size:11px;font-weight:600;cursor:pointer;"><i data-lucide="download" size="13" style="width:13px;height:13px;display:block;flex-shrink:0;"></i>${t('workshopAtt.csvDownload')}</button>
            </div>
            <div class="main-title">${t('workshopAtt.title')}</div>
            <h2 style="text-align:center;font-size:18px;color:var(--primary);">${escapeHtml(appState.currentWorkshopName || '')}</h2>
            ${infoHtml}
            <div class="nav-buttons" style="margin-bottom:10px;">
                <button id="wsAddStudentBtn"><i data-lucide="user-plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${t('workshopAtt.addStudent')}</button>
                <button id="wsImportStudentBtn" class="btn-secondary"><i data-lucide="users" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${t('workshopAtt.importStudent')}</button>
                <button id="wsAddWeekBtn"><i data-lucide="calendar-plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${t('workshopAtt.addWeek')}</button>
                <button id="wsPaymentsBtn" class="btn-info"><i data-lucide="credit-card" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${t('workshopAtt.payments')}</button>
                <button id="wsToggleArchivedBtn" class="btn-secondary"><i data-lucide="archive" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${appState.showArchivedWsStudents ? t('workshopAtt.hideArchive') : t('workshopAtt.showArchive')}</button>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead><tr id="wsHeaderRow"></tr></thead>
                    <tbody id="wsStudentRows"></tbody>
                    <tfoot id="wsFooterRow"></tfoot>
                </table>
            </div>
        </div>
    `;

    buildHeader();
    buildStudentRows();
    buildFooter();

    // Butonlar
    document.getElementById('backToWorkshopsBtn').onclick = () => navigateTo('workshops');
    document.getElementById('wsCsvBtn').onclick           = () => downloadWorkshopAttCsv();
    document.getElementById('wsAddStudentBtn').onclick    = () => addWorkshopStudent();
    document.getElementById('wsImportStudentBtn').onclick  = () => importStudentFromClasses();
    document.getElementById('wsAddWeekBtn').onclick       = () => addWorkshopWeek();
    document.getElementById('wsPaymentsBtn').onclick      = () => showWorkshopPayments(appState.currentWorkshopId, appState.currentWorkshopName);
    document.getElementById('wsToggleArchivedBtn').onclick = () => {
        appState.showArchivedWsStudents = !appState.showArchivedWsStudents;
        renderWorkshopAttendance();
    };

    attachCellListeners();
    refreshIcons();
}

// ---------------------------------------------------------------
// Başlık satırı (# | Öğrenci | hafta tarihleri)
// ---------------------------------------------------------------
function buildHeader() {
    const headerRow = document.getElementById('wsHeaderRow');
    let html = `<th>#</th><th>${t('workshopAtt.colStudent')}</th>`;
    appState.wsDates.forEach(d => {
        const cancelled = d.is_cancelled;
        const thStyle = 'th-date' + (cancelled ? ' th-date-cancelled' : '');
        html += `<th class="${thStyle}" data-wsdate-id="${d.id}" data-cancelled="${cancelled ? '1' : '0'}" style="cursor:pointer;">${formatDate(d.lesson_date)}</th>`;
    });
    headerRow.innerHTML = html;
}

// ---------------------------------------------------------------
// Öğrenci satırları
// ---------------------------------------------------------------
function buildStudentRows() {
    const tbody = document.getElementById('wsStudentRows');
    tbody.innerHTML = '';
    const visible = appState.wsStudents.filter(s => appState.showArchivedWsStudents ? true : !s.is_archived);

    if (visible.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${2 + appState.wsDates.length}" style="text-align:center;color:var(--text-dim);padding:20px;">${t('workshopAtt.emptyStudents')}</td></tr>`;
        return;
    }

    visible.forEach((student, idx) => {
        const nameParts  = student.name.trim().split(' ');
        const firstName  = escapeHtml(nameParts[0] || student.name);
        const lastName   = escapeHtml(nameParts.slice(1).join(' '));
        const nameHtml   = lastName ? `<div style="line-height:1.35;">${firstName}<br>${lastName}</div>` : firstName;
        const rowOpacity = student.is_archived ? 'opacity:0.5;' : '';

        let row = `<tr style="${rowOpacity}"><td>${idx+1}</td><td><div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="color:var(--text-main);">${nameHtml}</span>
            <span class="ws-student-edit" data-student-id="${student.id}" data-student-name="${escapeHtml(student.name)}" style="cursor:pointer;color:var(--primary);display:inline-flex;"><i data-lucide="pencil" size="16"></i></span>
        </div></td>`;

        appState.wsDates.forEach(date => {
            const status = appState.wsAttendanceMap[`${student.id}_${date.id}`] || '';
            let icon = '';
            if (status === '+') icon = '<i data-lucide="check-circle-2" class="icon-present" size="18"></i>';
            else if (status === '-') icon = '<i data-lucide="x-circle" class="icon-absent" size="18"></i>';
            else if (status === 'S') icon = '<i data-lucide="user-x" style="color:var(--text-dim);" size="18"></i>';
            const cancelClass = date.is_cancelled ? ' cell-cancelled' : '';
            row += `<td class="ws-att-cell${cancelClass}" data-student-id="${student.id}" data-wsdate-id="${date.id}">${icon}</td>`;
        });
        row += '</tr>';
        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// ---------------------------------------------------------------
// Footer: video, partner, not satırları
// ---------------------------------------------------------------
function buildFooter() {
    const footer = document.getElementById('wsFooterRow');

    let videoRow = `<tr><td class="foot-sticky-first">#</td><td class="foot-sticky-label">${t('workshopAtt.rowVideos')}</td>`;
    appState.wsDates.forEach(d => {
        const hasVideo = appState.wsVideoMap[d.id];
        const vColor = hasVideo ? 'var(--primary)' : 'var(--text-dim)';
        const cc = d.is_cancelled ? ' cell-cancelled' : '';
        videoRow += `<td class="${cc}"><span class="ws-vid-icon" data-wsdate-id="${d.id}" style="cursor:pointer;display:inline-flex;color:${vColor};"><i data-lucide="video" size="20"></i></span></td>`;
    });
    videoRow += '</tr>';

    let partnerRow = `<tr><td class="foot-sticky-first">#</td><td class="foot-sticky-label">${t('workshopAtt.rowPartner')}</td>`;
    appState.wsDates.forEach(d => {
        const partner = appState.wsPartnerMap[d.id] || '';
        const color = partner ? 'var(--primary)' : 'var(--text-dim)';
        const cc = d.is_cancelled ? ' cell-cancelled' : '';
        partnerRow += `<td class="${cc}"><span class="ws-partner-edit" data-wsdate-id="${d.id}" data-partner="${escapeHtml(partner)}" title="${escapeHtml(partner)}" style="cursor:pointer;display:inline-flex;color:${color};"><i data-lucide="notebook-pen" size="18"></i></span></td>`;
    });
    partnerRow += '</tr>';

    let noteRow = `<tr><td class="foot-sticky-first">#</td><td class="foot-sticky-label">${t('workshopAtt.rowNote')}</td>`;
    appState.wsDates.forEach(d => {
        const note = appState.wsNotesMap[d.id] || '';
        const color = note ? 'var(--primary)' : 'var(--text-dim)';
        const cc = d.is_cancelled ? ' cell-cancelled' : '';
        noteRow += `<td class="ws-note-cell${cc}" data-wsdate-id="${d.id}" style="cursor:pointer;"><span style="color:${color};display:inline-flex;"><i data-lucide="book-open" size="18"></i></span></td>`;
    });
    noteRow += '</tr>';

    footer.innerHTML = videoRow + partnerRow + noteRow;
}

// ---------------------------------------------------------------
// Hücre tıklama olayları
// ---------------------------------------------------------------
function attachCellListeners() {
    // Yoklama hücresi
    document.querySelectorAll('.ws-att-cell').forEach(cell => {
        cell.addEventListener('click', async (e) => {
            e.stopPropagation();
            const studentId = parseInt(cell.dataset.studentId);
            const dateId    = parseInt(cell.dataset.wsdateId);
            const dateObj   = appState.wsDates.find(d => d.id === dateId);
            if (!dateObj || dateObj.is_cancelled) return;
            await toggleWorkshopAttendance(studentId, dateId, cell);
        });
    });

    // Öğrenci düzenle
    document.querySelectorAll('.ws-student-edit').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const studentId = parseInt(el.dataset.studentId);
            const name      = el.dataset.studentName;
            editWorkshopStudent(studentId, name);
        });
    });

    // Video
    document.querySelectorAll('.ws-vid-icon').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const dateId = parseInt(el.dataset.wsdateId);
            handleWorkshopVideo(dateId);
        });
    });

    // Partner
    document.querySelectorAll('.ws-partner-edit').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const dateId  = parseInt(el.dataset.wsdateId);
            const current = el.dataset.partner || '';
            openPromptModalWithValue(t('workshopAtt.partnerTitle'), current, t('workshopAtt.partnerPlaceholder'), async (val) => {
                await updateWorkshopPartner(dateId, val);
            });
        });
    });

    // Not
    document.querySelectorAll('.ws-note-cell').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const dateId  = parseInt(el.dataset.wsdateId);
            const current = appState.wsNotesMap[dateId] || '';
            openPromptModalWithValue(t('workshopAtt.noteTitle'), current, t('workshopAtt.notePlaceholder'), async (val) => {
                await updateWorkshopNote(dateId, val);
            });
        });
    });

    // Hafta başlığı (sil / iptal)
    document.querySelectorAll('#wsHeaderRow th[data-wsdate-id]').forEach(th => {
        th.addEventListener('click', (e) => {
            e.stopPropagation();
            const dateId    = parseInt(th.dataset.wsdateId);
            const cancelled = th.dataset.cancelled === '1';
            openWorkshopWeekMenu(dateId, cancelled);
        });
    });
}

// ---------------------------------------------------------------
// Yoklama toggle (boş → + → - → S → boş)
// ---------------------------------------------------------------
async function toggleWorkshopAttendance(studentId, dateId, cell) {
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
    refreshIcons();
}

// ---------------------------------------------------------------
// Öğrenci ekle
// ---------------------------------------------------------------
function addWorkshopStudent() {
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
// Öğrenci düzenle / sil
// ---------------------------------------------------------------
function editWorkshopStudent(studentId, currentName) {
    const modal         = document.getElementById('studentActionModal');
    const viewMode      = document.getElementById('studentViewMode');
    const editMode      = document.getElementById('studentEditMode');
    const nameDisp      = document.getElementById('studentNameDisplay');
    const editInput     = document.getElementById('studentEditInput');
    const phoneInput    = document.getElementById('studentPhoneInput');
    const editBtn       = document.getElementById('studentEditBtn');
    const phoneBtn      = document.getElementById('studentPhoneBtn');
    const deleteBtn     = document.getElementById('studentDeleteBtn');
    const archiveBtn    = document.getElementById('studentArchiveBtn');
    const closeBtn      = document.getElementById('studentModalCloseView');
    const saveBtn       = document.getElementById('studentSaveBtn');
    const cancelEditBtn = document.getElementById('studentCancelEditBtn');
    const editTitle     = document.getElementById('studentEditModeTitle');
    if (!modal) { showToast('Modal not found.', 'error'); return; }

    const student = appState.wsStudents.find(s => s.id === studentId);
    const isArchived = student ? !!student.is_archived : false;

    // Tüm onclick'leri temizle (önceki bağlamalardan kalan)
    editBtn.onclick       = null;
    if (phoneBtn) phoneBtn.onclick = null;
    deleteBtn.onclick     = null;
    if (archiveBtn) archiveBtn.onclick = null;
    closeBtn.onclick      = null;
    saveBtn.onclick       = null;
    cancelEditBtn.onclick = null;

    nameDisp.innerText         = currentName;
    viewMode.style.display     = 'block';
    editMode.style.display     = 'none';
    modal.style.display        = 'flex';

    // Arşiv ikonu — duruma göre değiştir
    if (archiveBtn) {
        archiveBtn.innerHTML = isArchived
            ? '<i data-lucide="archive-restore" size="22"></i>'
            : '<i data-lucide="archive" size="22"></i>';
        archiveBtn.title = isArchived ? t('workshopAtt.archiveLabel') : t('workshopAtt.unarchiveLabel');
    }
    refreshIcons();

    // Kalem → sadece isim alanı
    editBtn.onclick = () => {
        viewMode.style.display  = 'none';
        editMode.style.display  = 'block';
        if (editTitle) editTitle.textContent = t('workshopAtt.editName');
        editInput.style.display = 'block';
        if (phoneInput) phoneInput.style.display = 'none';
        editInput.value = currentName;
        editInput.focus();
    };

    // Telefon ikonu → sadece telefon alanı
    if (phoneBtn) {
        phoneBtn.onclick = () => {
            viewMode.style.display  = 'none';
            editMode.style.display  = 'block';
            if (editTitle) editTitle.textContent = t('workshopAtt.editPhone');
            editInput.style.display = 'none';
            if (phoneInput) {
                phoneInput.style.display = 'block';
                phoneInput.value = student ? (student.phone || '') : '';
                phoneInput.focus();
            }
        };
    }

    // Arşivle / arşivden çıkar
    if (archiveBtn) {
        archiveBtn.onclick = async () => {
            const { error } = await supabase.from('workshop_students').update({ is_archived: !isArchived }).eq('id', studentId);
            if (error) { showToast(t('workshopAtt.studentArchiveFail'), 'error'); return; }
            modal.style.display = 'none';
            showToast(!isArchived ? t('workshopAtt.studentArchived') : t('workshopAtt.studentUnarchived'), 'success');
            await loadWorkshopData();
            renderWorkshopAttendance();
        };
    }

    // Sil
    deleteBtn.onclick = () => {
        modal.style.display = 'none';
        openConfirmModal(t('workshopAtt.studentDeleteConfirm'), async () => {
            const { error } = await supabase.from('workshop_students').delete().eq('id', studentId);
            if (error) { showToast(t('workshopAtt.studentDeleteFail'), 'error'); return; }
            showToast(t('workshopAtt.studentDeleted'), 'success');
            await loadWorkshopData();
            renderWorkshopAttendance();
        }, () => { modal.style.display = 'flex'; });
    };

    // Kapat
    closeBtn.onclick = () => { modal.style.display = 'none'; };

    // Kaydet
    saveBtn.onclick = async () => {
        const isNameMode = !phoneInput || editInput.style.display !== 'none';
        if (isNameMode) {
            const newName = editInput.value.trim();
            if (!newName) return;
            const { error } = await supabase.from('workshop_students').update({ name: newName }).eq('id', studentId);
            if (error) { showToast(t('workshopAtt.studentUpdateFail'), 'error'); return; }
            nameDisp.innerText = newName;
            currentName = newName;
        } else {
            const newPhone = phoneInput ? phoneInput.value.trim() : null;
            const { error } = await supabase.from('workshop_students').update({ phone: newPhone || null }).eq('id', studentId);
            if (error) { showToast(t('workshopAtt.studentUpdateFail'), 'error'); return; }
        }
        editInput.style.display = 'block';
        if (phoneInput) phoneInput.style.display = 'block';
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
        showToast(t('workshopAtt.studentUpdated'), 'success');
        await loadWorkshopData();
        renderWorkshopAttendance();
    };

    // İptal
    cancelEditBtn.onclick = () => {
        editInput.style.display = 'block';
        if (phoneInput) phoneInput.style.display = 'block';
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
    };
}

// ---------------------------------------------------------------
// Hafta ekle (son haftanın 7 gün sonrası)
// ---------------------------------------------------------------
async function addWorkshopWeek() {
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
// Video ekle / göster / sil
// ---------------------------------------------------------------
function detectWsVideoPlatform(url) {
    if (!url) return { name: 'Other', color: '#94a3b8' };
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return { name: 'YouTube',      color: '#FF0000' };
    if (lower.includes('vimeo.com'))                                  return { name: 'Vimeo',        color: '#1AB7EA' };
    if (lower.includes('drive.google.com'))                           return { name: 'Google Drive', color: '#34A853' };
    if (lower.includes('instagram.com'))                              return { name: 'Instagram',    color: '#E1306C' };
    if (lower.includes('facebook.com') || lower.includes('fb.watch'))return { name: 'Facebook',     color: '#1877F2' };
    if (lower.includes('tiktok.com'))                                 return { name: 'TikTok',       color: '#010101' };
    return { name: 'Other', color: '#94a3b8' };
}

function handleWorkshopVideo(dateId) {
    const existingUrl = appState.wsVideoMap[dateId] || '';

    if (existingUrl) {
        // Video var → mevcut videoModal'ı aç (WhatsApp gizli)
        const modal      = document.getElementById('videoModal');
        const linkDisp   = document.getElementById('videoLinkDisplay');
        const watchBtn   = document.getElementById('watchVideoBtn');
        const deleteBtn  = document.getElementById('deleteVideoBtn');
        const closeBtn   = document.getElementById('closeVideoModalBtn');
        const waBtn      = document.getElementById('whatsappVideoShareBtn');
        const noteDisp   = document.getElementById('videoNoteDisplay');
        if (!modal) return;

        const platform = detectWsVideoPlatform(existingUrl);
        const titleEl  = modal.querySelector('h3');
        if (titleEl) {
            titleEl.innerHTML = `
                <i data-lucide="video" size="20" style="color:#2DD4BF;display:inline-block;vertical-align:middle;"></i>
                <span style="vertical-align:middle;"> Ders Videosu</span>
                <span style="display:inline-block;vertical-align:middle;margin-left:8px;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:${platform.color}22;color:${platform.color};border:1px solid ${platform.color}55;">${platform.name}</span>
            `;
        }
        linkDisp.textContent = existingUrl;
        linkDisp.style.color = '#2DD4BF';
        if (waBtn)   waBtn.style.display   = 'none';   // WA gizle
        if (noteDisp) noteDisp.style.display = 'none'; // not gizle

        modal.style.display = 'flex';
        refreshIcons();

        const watchHandler = () => window.open(existingUrl, '_blank');

        const deleteHandler = () => {
            modal.style.display = 'none';
            openConfirmModal(t('workshopAtt.videoDeleteConfirm'), async () => {
                await supabase.from('workshop_videos').delete().eq('workshop_date_id', dateId);
                delete appState.wsVideoMap[dateId];
                showToast(t('workshopAtt.videoDeleted'), 'success');
                // ikonu guncelle
                const icon = document.querySelector(`.ws-vid-icon[data-wsdate-id="${dateId}"]`);
                if (icon) { icon.style.color = 'var(--dim-forest)'; }
                cleanup();
            }, () => { modal.style.display = 'flex'; refreshIcons(); });
        };

        const closeHandler = () => {
            modal.style.display = 'none';
            if (waBtn) waBtn.style.display = 'inline-flex'; // WA'yı geri aç
            cleanup();
        };

        const outsideHandler = (e) => { if (e.target === modal) closeHandler(); };

        const cleanup = () => {
            watchBtn.removeEventListener('click', watchHandler);
            deleteBtn.removeEventListener('click', deleteHandler);
            closeBtn.removeEventListener('click', closeHandler);
            modal.removeEventListener('click', outsideHandler);
        };

        watchBtn.removeEventListener('click', watchHandler);
        deleteBtn.removeEventListener('click', deleteHandler);
        closeBtn.removeEventListener('click', closeHandler);
        modal.removeEventListener('click', outsideHandler);

        watchBtn.addEventListener('click', watchHandler);
        deleteBtn.addEventListener('click', deleteHandler);
        closeBtn.addEventListener('click', closeHandler);
        modal.addEventListener('click', outsideHandler);

    } else {
        // Video yok → link giriş modalı
        openPromptModal(t('workshopAtt.videoAddTitle'), 'https://...', async (url) => {
            if (!url || !url.startsWith('http')) { showToast(t('workshopAtt.videoUrlInvalid'), 'warning'); return; }
            const { error } = await supabase.from('workshop_videos').insert({
                workshop_date_id: dateId, url: url.trim()
            });
            if (error) { showToast(t('workshopAtt.videoSaveFail').replace('{msg}', error.message), 'error'); return; }
            appState.wsVideoMap[dateId] = url.trim();
            showToast(t('workshopAtt.videoSaved'), 'success');
            // Sadece o ikonu güncelle
            const icon = document.querySelector(`.ws-vid-icon[data-wsdate-id="${dateId}"]`);
            if (icon) { icon.style.color = '#2DD4BF'; }
        });
    }
}

// ---------------------------------------------------------------
// Partner güncelle
// ---------------------------------------------------------------
async function updateWorkshopPartner(dateId, partner) {
    const { error } = await supabase.from('workshop_dates')
        .update({ teacher_partner: partner || null }).eq('id', dateId);
    if (error) { showToast(t('workshopAtt.partnerSaveFail'), 'error'); return; }
    appState.wsPartnerMap[dateId] = partner || '';
    showToast(t('workshopAtt.partnerSaved'), 'success');
    await loadWorkshopData();
    renderWorkshopAttendance();
}

// ---------------------------------------------------------------
// Not güncelle
// ---------------------------------------------------------------
async function updateWorkshopNote(dateId, note) {
    const { error } = await supabase.from('workshop_dates')
        .update({ note: note || null }).eq('id', dateId);
    if (error) { showToast(t('workshopAtt.noteSaveFail'), 'error'); return; }
    appState.wsNotesMap[dateId] = note || '';
    showToast(t('workshopAtt.noteSaved'), 'success');
    await loadWorkshopData();
    renderWorkshopAttendance();
}

// ---------------------------------------------------------------
// Hafta menüsü (iptal et / sil)
// ---------------------------------------------------------------
function openWorkshopWeekMenu(dateId, isCancelled) {
    const modal       = document.getElementById('weekActionModal');
    const title       = document.getElementById('weekActionTitle');
    const cancelBtn   = document.getElementById('weekActionCancelToggleBtn');
    const deleteBtn   = document.getElementById('weekActionDeleteBtn');
    const closeBtn    = document.getElementById('weekActionCloseBtn');
    if (!modal) { showToast('Menu not found.', 'error'); return; }

    title.textContent = t('workshopAtt.weekActions');
    deleteBtn.innerHTML = `<i data-lucide="trash-2" size="15"></i>${t('workshopAtt.weekDeleteLabel') || 'Delete Week'}`;

    // İptal butonu metnini duruma göre ayarla
    cancelBtn.innerHTML = isCancelled
        ? `<i data-lucide="rotate-ccw" size="15"></i>${t('workshopAtt.undoCancel')}`
        : `<i data-lucide="ban" size="15"></i>${t('workshopAtt.cancelWeek')}`;

    cancelBtn.onclick = async () => {
        modal.style.display = 'none';
        await toggleWorkshopWeekCancel(dateId, !isCancelled);
    };

    deleteBtn.onclick = () => {
        modal.style.display = 'none';
        openConfirmModal(t('workshopAtt.weekDeleteConfirm'), async () => {
            await deleteWorkshopWeek(dateId);
        });
    };

    closeBtn.onclick = () => { modal.style.display = 'none'; };

    modal.style.display = 'flex';
    refreshIcons();
}

async function deleteWorkshopWeek(dateId) {
    try {
        await supabase.from('workshop_attendance').delete().eq('workshop_date_id', dateId);
        await supabase.from('workshop_videos').delete().eq('workshop_date_id', dateId);
        const { error } = await supabase.from('workshop_dates').delete().eq('id', dateId);
        if (error) throw error;
        showToast(t('workshopAtt.weekDeleted'), 'success');
        await loadWorkshopData();
        renderWorkshopAttendance();
    } catch (err) {
        showToast(t('workshopAtt.weekDeleteFail').replace('{msg}', err.message), 'error');
    }
}

// ---------------------------------------------------------------
// Mevcut grup dersi öğrencisini çalıştaya aktar
// ---------------------------------------------------------------
async function importStudentFromClasses() {
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
        selectEl.style.cssText = 'width:100%;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;margin-top:10px;';
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

async function toggleWorkshopWeekCancel(dateId, makeCancelled) {
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
function downloadWorkshopAttCsv() {
    const statusMap = { '+': 'Geldi', '-': 'Gelmedi', 'S': 'Mazeretli', 'I': 'İnaktif', '': '' };
    const headers = ['Öğrenci', ...appState.wsDates.map(d => d.lesson_date)];
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