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
                <button id="wsAddWeekBtn"><i data-lucide="calendar-plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>Hafta Ekle</button>
                <button id="wsPaymentsBtn" class="btn-info"><i data-lucide="credit-card" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>Ödemeler</button>
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
    document.getElementById('wsAddWeekBtn').onclick       = () => addWorkshopWeek();
    document.getElementById('wsPaymentsBtn').onclick      = () => showToast('Çalıştay ödemeleri adım 4.7\'de gelecek.', 'warning');

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
    const visible = appState.wsStudents.filter(s => !s.is_archived);

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

    let videoRow = '<tr><td class="foot-sticky-first">#</td><td class="foot-sticky-label">Video</td>';
    appState.wsDates.forEach(d => {
        const hasVideo = appState.wsVideoMap[d.id];
        const cc = d.is_cancelled ? ' cell-cancelled' : '';
        videoRow += `<td class="${cc}"><span class="ws-vid-icon ${hasVideo ? 'active' : ''}" data-wsdate-id="${d.id}" style="cursor:pointer;"><i data-lucide="video" size="20"></i></span></td>`;
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

    let noteRow = '<tr><td class="foot-sticky-first">#</td><td class="foot-sticky-label">Not</td>';
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
            const dateId    = cell.dataset.wsdateId;
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
            const dateId = el.dataset.wsdateId;
            handleWorkshopVideo(dateId);
        });
    });

    // Partner
    document.querySelectorAll('.ws-partner-edit').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const dateId  = el.dataset.wsdateId;
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
            const dateId  = el.dataset.wsdateId;
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
            const dateId    = th.dataset.wsdateId;
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
    openPromptModal('Yeni Öğrenci', 'Ad Soyad', async (name) => {
        if (!name) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { showToast('Oturum bulunamadı.', 'error'); return; }
        const { error } = await supabase.from('workshop_students').insert({
            workshop_id: appState.currentWorkshopId,
            user_id:     user.id,
            name:        name,
            is_archived: false
        });
        if (error) { showToast('Öğrenci eklenemedi: ' + error.message, 'error'); return; }
        showToast('Öğrenci eklendi ✓', 'success');
        await loadWorkshopData();
        renderWorkshopAttendance();
    });
}

// ---------------------------------------------------------------
// Öğrenci düzenle / sil
// ---------------------------------------------------------------
function editWorkshopStudent(studentId, currentName) {
    openPromptModalWithValue('Öğrenci Düzenle', currentName, 'Ad Soyad', async (newName) => {
        if (!newName || newName === currentName) return;
        const { error } = await supabase.from('workshop_students').update({ name: newName }).eq('id', studentId);
        if (error) { showToast('Güncellenemedi.', 'error'); return; }
        showToast('Öğrenci güncellendi ✓', 'success');
        await loadWorkshopData();
        renderWorkshopAttendance();
    });
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
    openPromptModalWithValue('Video Bağlantısı', current, 'https://...', async (url) => {
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
    openConfirmModal(
        isCancelled ? 'Bu haftanın iptalini geri almak istiyor musunuz?' : 'Bu haftayı ne yapmak istersiniz? (Tamam = İptal Et, kapatıp tekrar basılıysa sil)',
        async () => {
            await toggleWorkshopWeekCancel(dateId, !isCancelled);
        }
    );
}

async function toggleWorkshopWeekCancel(dateId, makeCancelled) {
    const { error } = await supabase.from('workshop_dates')
        .update({ is_cancelled: makeCancelled }).eq('id', dateId);
    if (error) { showToast('İşlem başarısız.', 'error'); return; }
    showToast(makeCancelled ? 'Hafta iptal edildi ✓' : 'İptal geri alındı ✓', 'success');
    await loadWorkshopData();
    renderWorkshopAttendance();
}