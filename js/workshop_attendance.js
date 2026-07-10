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
import { refreshIcons, formatDate, isPastDate, openPromptModal, openPromptModalWithValue, openConfirmModal, showToast, escapeHtml } from './utils.js';
import { navigateTo } from './router.js';
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
        const weeks   = ws.total_weeks ? `${ws.total_weeks} hafta` : '';
        const dateStr = ws.start_date  ? ws.start_date.split('T')[0] : '';
        const time    = ws.lesson_time ? ws.lesson_time.substring(0,5) : '';
        infoHtml = `
        <div style="background:rgba(45,212,191,0.06);border:1px solid rgba(45,212,191,0.25);border-radius:14px;padding:14px 16px;margin-bottom:16px;">
            <div style="font-size:12px;color:var(--text-dim);line-height:1.9;">
                ${ws.studio_name ? '<div><b>Stüdyo:</b> ' + escapeHtml(ws.studio_name) + '</div>' : ''}
                ${dateStr ? '<div><b>Başlangıç:</b> ' + dateStr + (time ? ' · ' + time : '') + '</div>' : ''}
                ${weeks ? '<div><b>Süre:</b> ' + weeks + '</div>' : ''}
                ${ws.theme ? '<div><b>Tema:</b> ' + escapeHtml(ws.theme) + '</div>' : ''}
            </div>
        </div>`;
    }

    container.innerHTML = `
        <div class="view">
            <div class="back-link" id="backToWorkshopsBtn">← Çalıştaylar</div>
            <div class="main-title">Çalıştay Yoklama</div>
            <h2 style="text-align:center;font-size:18px;color:var(--primary);">${escapeHtml(appState.currentWorkshopName || '')}</h2>
            ${infoHtml}
            <div class="nav-buttons" style="margin-bottom:10px;">
                <button id="wsAddStudentBtn"><i data-lucide="user-plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>Öğrenci Ekle</button>
                <button id="wsImportStudentBtn" class="btn-secondary"><i data-lucide="users" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>Mevcut Öğrenci</button>
                <button id="wsAddWeekBtn"><i data-lucide="calendar-plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>Hafta Ekle</button>
                <button id="wsPaymentsBtn" class="btn-info"><i data-lucide="credit-card" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>Ödemeler</button>
                <button id="wsToggleArchivedBtn" class="btn-secondary"><i data-lucide="archive" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${appState.showArchivedWsStudents ? 'Arşivi Gizle' : 'Arşivi Göster'}</button>
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
    document.getElementById('wsAddStudentBtn').onclick    = () => addWorkshopStudent();
    document.getElementById('wsImportStudentBtn').onclick  = () => importStudentFromClasses();
    document.getElementById('wsAddWeekBtn').onclick       = () => addWorkshopWeek();
    document.getElementById('wsPaymentsBtn').onclick      = () => showToast('Çalıştay ödemeleri adım 4.7\'de gelecek.', 'warning');
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
    let html = '<th>#</th><th>Öğrenci</th>';
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
        tbody.innerHTML = `<tr><td colspan="${2 + appState.wsDates.length}" style="text-align:center;color:var(--text-dim);padding:20px;">Henüz öğrenci eklenmemiş.</td></tr>`;
        return;
    }

    visible.forEach((student, idx) => {
        const nameParts = student.name.trim().split(' ');
        const firstName = escapeHtml(nameParts[0] || student.name);
        const lastName  = escapeHtml(nameParts.slice(1).join(' '));
        const nameHtml  = lastName ? `<div style="line-height:1.35;">${firstName}<br>${lastName}</div>` : firstName;

        let row = `<tr><td>${idx+1}</td><td><div style="display:flex;justify-content:space-between;align-items:center;">
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

    let videoRow = '<tr><td class="foot-sticky-first">#</td><td class="foot-sticky-label">Ders Videoları</td>';
    appState.wsDates.forEach(d => {
        const hasVideo = appState.wsVideoMap[d.id];
        const vColor = hasVideo ? 'var(--primary)' : 'var(--text-dim)';
        const cc = d.is_cancelled ? ' cell-cancelled' : '';
        videoRow += `<td class="${cc}"><span class="ws-vid-icon" data-wsdate-id="${d.id}" style="cursor:pointer;display:inline-flex;color:${vColor};"><i data-lucide="video" size="20"></i></span></td>`;
    });
    videoRow += '</tr>';

    let partnerRow = '<tr><td class="foot-sticky-first">#</td><td class="foot-sticky-label">Partner</td>';
    appState.wsDates.forEach(d => {
        const partner = appState.wsPartnerMap[d.id] || '';
        const color = partner ? 'var(--primary)' : 'var(--text-dim)';
        const cc = d.is_cancelled ? ' cell-cancelled' : '';
        partnerRow += `<td class="${cc}"><span class="ws-partner-edit" data-wsdate-id="${d.id}" data-partner="${escapeHtml(partner)}" title="${escapeHtml(partner)}" style="cursor:pointer;display:inline-flex;color:${color};"><i data-lucide="notebook-pen" size="18"></i></span></td>`;
    });
    partnerRow += '</tr>';

    let noteRow = '<tr><td class="foot-sticky-first">#</td><td class="foot-sticky-label">Ders Notu</td>';
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
            openPromptModalWithValue('Partner / Öğretmen', current, 'İsim girin', async (val) => {
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
            openPromptModalWithValue('Ders Notu', current, 'Not girin', async (val) => {
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
        if (error) { showToast('Yoklama kaydedilemedi: ' + error.message, 'error'); return; }
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
    if (!modal) { showToast('Modal bulunamadı.', 'error'); return; }

    title.textContent    = 'Yeni Öğrenci';
    input1.placeholder   = 'Ad Soyad';
    input2.placeholder   = 'Telefon (opsiyonel)';
    input1.value         = '';
    input2.value         = '';
    modal.style.display  = 'flex';
    input1.focus();

    confirm.onclick = async () => {
        const name  = input1.value.trim();
        const phone = input2.value.trim() || null;
        if (!name) { showToast('Ad Soyad boş olamaz.', 'warning'); return; }
        modal.style.display = 'none';
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { showToast('Oturum bulunamadı.', 'error'); return; }
        const { error } = await supabase.from('workshop_students').insert({
            workshop_id: appState.currentWorkshopId,
            user_id:     user.id,
            name,
            phone,
            is_archived: false
        });
        if (error) { showToast('Öğrenci eklenemedi: ' + error.message, 'error'); return; }
        showToast('Öğrenci eklendi ✓', 'success');
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
    if (!modal) { showToast('Modal bulunamadı.', 'error'); return; }

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
        archiveBtn.title = isArchived ? 'Arşivden çıkar' : 'Arşivle';
    }
    refreshIcons();

    // Kalem → sadece isim alanı
    editBtn.onclick = () => {
        viewMode.style.display  = 'none';
        editMode.style.display  = 'block';
        if (editTitle) editTitle.textContent = 'Adı Düzenle';
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
            if (editTitle) editTitle.textContent = 'Telefonu Düzenle';
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
            if (error) { showToast('İşlem başarısız.', 'error'); return; }
            modal.style.display = 'none';
            showToast(!isArchived ? 'Öğrenci arşivlendi ✓' : 'Arşivden çıkarıldı ✓', 'success');
            await loadWorkshopData();
            renderWorkshopAttendance();
        };
    }

    // Sil
    deleteBtn.onclick = () => {
        modal.style.display = 'none';
        openConfirmModal('Bu öğrenciyi silmek istediğinizden emin misiniz?', async () => {
            const { error } = await supabase.from('workshop_students').delete().eq('id', studentId);
            if (error) { showToast('Silinemedi.', 'error'); return; }
            showToast('Öğrenci silindi ✓', 'success');
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
            if (error) { showToast('Güncellenemedi.', 'error'); return; }
            nameDisp.innerText = newName;
            currentName = newName;
        } else {
            const newPhone = phoneInput ? phoneInput.value.trim() : null;
            const { error } = await supabase.from('workshop_students').update({ phone: newPhone || null }).eq('id', studentId);
            if (error) { showToast('Güncellenemedi.', 'error'); return; }
        }
        editInput.style.display = 'block';
        if (phoneInput) phoneInput.style.display = 'block';
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
        showToast('Güncellendi ✓', 'success');
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
    if (error) { showToast('Hafta eklenemedi: ' + error.message, 'error'); return; }
    showToast('Hafta eklendi ✓', 'success');
    await loadWorkshopData();
    renderWorkshopAttendance();
}

// ---------------------------------------------------------------
// Video ekle / göster / sil
// ---------------------------------------------------------------
function handleWorkshopVideo(dateId) {
    const current = appState.wsVideoMap[dateId] || '';
    openPromptModalWithValue('Ders Videosu', current, 'https://...', async (url) => {
        // Önce eski videoyu sil
        await supabase.from('workshop_videos').delete().eq('workshop_date_id', dateId);
        if (url && url.trim()) {
            const { error } = await supabase.from('workshop_videos').insert({
                workshop_date_id: dateId, url: url.trim()
            });
            if (error) { showToast('Video kaydedilemedi: ' + error.message, 'error'); return; }
            showToast('Video kaydedildi ✓', 'success');
        } else {
            showToast('Video silindi ✓', 'success');
        }
        await loadWorkshopData();
        renderWorkshopAttendance();
    });
}

// ---------------------------------------------------------------
// Partner güncelle
// ---------------------------------------------------------------
async function updateWorkshopPartner(dateId, partner) {
    const { error } = await supabase.from('workshop_dates')
        .update({ teacher_partner: partner || null }).eq('id', dateId);
    if (error) { showToast('Partner kaydedilemedi.', 'error'); return; }
    appState.wsPartnerMap[dateId] = partner || '';
    showToast('Partner kaydedildi ✓', 'success');
    await loadWorkshopData();
    renderWorkshopAttendance();
}

// ---------------------------------------------------------------
// Not güncelle
// ---------------------------------------------------------------
async function updateWorkshopNote(dateId, note) {
    const { error } = await supabase.from('workshop_dates')
        .update({ note: note || null }).eq('id', dateId);
    if (error) { showToast('Not kaydedilemedi.', 'error'); return; }
    appState.wsNotesMap[dateId] = note || '';
    showToast('Not kaydedildi ✓', 'success');
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
    if (!modal) { showToast('Menü bulunamadı.', 'error'); return; }

    title.textContent = 'Hafta İşlemleri';

    // İptal butonu metnini duruma göre ayarla
    cancelBtn.innerHTML = isCancelled
        ? '<i data-lucide="rotate-ccw" size="15"></i>İptali Geri Al'
        : '<i data-lucide="ban" size="15"></i>Haftayı İptal Et';

    cancelBtn.onclick = async () => {
        modal.style.display = 'none';
        await toggleWorkshopWeekCancel(dateId, !isCancelled);
    };

    deleteBtn.onclick = () => {
        modal.style.display = 'none';
        openConfirmModal('Bu haftayı ve tüm yoklama kayıtlarını silmek istediğinizden emin misiniz?', async () => {
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
        showToast('Hafta silindi ✓', 'success');
        await loadWorkshopData();
        renderWorkshopAttendance();
    } catch (err) {
        showToast('Hafta silinemedi: ' + err.message, 'error');
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

    if (error) { showToast('Öğrenciler yüklenemedi.', 'error'); return; }
    if (!allStudents || allStudents.length === 0) { showToast('Grup dersinde öğrenci yok.', 'warning'); return; }

    // Zaten çalıştayda olan öğrenci isimlerini al (duplicate önleme)
    const existingNames = appState.wsStudents.map(s => s.name.trim().toLowerCase());

    // Basit seçim listesi — dynamicModal'ı genişlet
    const modal    = document.getElementById('dynamicModal');
    const titleEl  = document.getElementById('dynamicModalTitle');
    const inputEl  = document.getElementById('dynamicInput');
    const confirmB = document.getElementById('dynamicModalConfirm');
    const cancelB  = document.getElementById('dynamicModalCancel');
    if (!modal) { showToast('Modal bulunamadı.', 'error'); return; }

    titleEl.textContent = 'Öğrenci Seç';

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
        if (!selected || selected.disabled) { showToast('Geçerli bir öğrenci seçin.', 'warning'); return; }
        const name  = selected.dataset.name;
        const phone = selected.dataset.phone || null;

        modal.style.display    = 'none';
        selectEl.style.display = 'none';
        inputEl.style.display  = 'block';

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { showToast('Oturum bulunamadı.', 'error'); return; }
        const { error: insErr } = await supabase.from('workshop_students').insert({
            workshop_id: appState.currentWorkshopId,
            user_id:     user.id,
            name,
            phone,
            is_archived: false
        });
        if (insErr) { showToast('Öğrenci eklenemedi: ' + insErr.message, 'error'); return; }
        showToast(name + ' çalıştaya eklendi ✓', 'success');
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
    if (error) { showToast('İşlem başarısız.', 'error'); return; }
    showToast(makeCancelled ? 'Hafta iptal edildi ✓' : 'İptal geri alındı ✓', 'success');
    await loadWorkshopData();
    renderWorkshopAttendance();
}