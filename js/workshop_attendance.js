// ---------------------------------------------------------------
// workshop_attendance.js — ÇALIŞTAY YOKLAMA KOORDİNATÖRÜ
// ---------------------------------------------------------------
// Sorumlulukları:
//   1. showWorkshopAttendance()  → dışarıya export edilen tek giriş noktası
//   2. loadWorkshopData()        → Supabase'den tüm veriyi çeker, appState'e yazar
//                                  workshopAttActions ve workshopAttModals da bu
//                                  fonksiyonu import ederek yeniden çekme işlemi yapar
//   3. renderWorkshopAttendance()→ tabloyu DOM'a yazar; event listener'larda
//                                  workshopAttActions ve workshopAttModals import edilir
//   4. buildHeader()             → tablo başlık satırını oluşturur
//   5. buildStudentRows()        → öğrenci satırlarını oluşturur
//   6. buildFooter()             → video/partner/not footer satırlarını oluşturur
//   7. attachCellListeners()     → tüm tıklama olaylarını bağlar
//
// BAĞIMLILIK HARİTASI (yönlü, çevrimsiz — döngü yok):
//
//   workshop_attendance.js
//             ↑                        ↑
//   workshopAttActions.js      workshopAttModals.js
//
//   workshop_attendance.js → workshopAttActions.js : HAYIR (statik import yok)
//   workshop_attendance.js → workshopAttModals.js  : HAYIR (statik import yok)
//   workshopAttActions.js  → workshop_attendance.js: EVET (load + render için)
//   workshopAttModals.js   → workshop_attendance.js: EVET (load + render için)
//
// attachCellListeners içindeki event listener'lar actions ve modals'ı
// dinamik import ile yükler — döngüsel bağımlılık oluşmaz.
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
import { refreshIcons, formatDate, openPromptModalWithValue, showToast, escapeHtml, isPastDate, openConfirmModal, openGoogleCalendarEvent } from './utils.js';
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
// Supabase'den tüm çalıştay verisini çeker ve appState'e yazar.
// Export edilir çünkü workshopAttActions ve workshopAttModals
// veri yenileme sonrası bu fonksiyonu çağırır.
// ---------------------------------------------------------------
export async function loadWorkshopData() {
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
// Tabloyu DOM'a yazar.
// Export edilir çünkü workshopAttActions ve workshopAttModals
// işlem sonrasında tabloyu yeniden çizmek için bu fonksiyonu çağırır.
// ---------------------------------------------------------------
export function renderWorkshopAttendance() {
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
                <button id="wsCsvBtn" class="btn-ghost" style="flex:none;min-width:auto;width:auto;"><i data-lucide="download" size="13" style="width:13px;height:13px;display:block;flex-shrink:0;"></i>${t('workshopAtt.csvDownload')}</button>
            </div>
            <div class="main-title">${t('workshopAtt.title')}</div>
            <h2 style="text-align:center;font:var(--font-title);margin:0;color:var(--primary);">${escapeHtml(appState.currentWorkshopName || '')}</h2>
            ${infoHtml}
            <div class="nav-buttons" style="margin-bottom:10px;">
                <button id="wsAddStudentBtn"><i data-lucide="user-plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${t('workshopAtt.addStudent')}</button>
                <button id="wsImportStudentBtn" class="btn-success"><i data-lucide="users" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${t('workshopAtt.importStudent')}</button>
                <button id="wsAddWeekBtn"><i data-lucide="calendar-plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${t('workshopAtt.addWeek')}</button>
            </div>
            <div class="nav-buttons" style="margin-bottom:10px;">
                <button id="wsPaymentsBtn" class="btn-info"><i data-lucide="credit-card" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${t('workshopAtt.payments')}</button>
                <button id="wsToggleArchivedBtn" class="btn-secondary"><i data-lucide="archive" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${appState.showArchivedWsStudents ? t('workshopAtt.hideArchive') : t('workshopAtt.showArchive')}</button>
                <button id="wsCalendarBtn" class="btn-secondary" style="border-color:var(--accent);color:var(--accent);"><i data-lucide="calendar-plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${escapeHtml(t('calendar.addToCalendar'))}</button>
            </div>
            <div style="margin:8px 0 6px;">
                <input id="wsStudentSearchInput" type="text" placeholder="${t('attendance.searchPlaceholder')}" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--input-bg);color:white;font-size:13px;box-sizing:border-box;">
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

    // Butonlar — actions dinamik import ile yüklenir (döngüsel bağımlılık önlenir)
    (async () => {
        const actions = await import('./workshopAttActions.js');
        const modals  = await import('./workshopAttModals.js');

        document.getElementById('backToWorkshopsBtn').onclick  = () => navigateTo('workshops');
        document.getElementById('wsCsvBtn').onclick            = () => actions.downloadWorkshopAttCsv();
        document.getElementById('wsAddStudentBtn').onclick     = () => actions.addWorkshopStudent();
        document.getElementById('wsImportStudentBtn').onclick  = () => actions.importStudentFromClasses();
        document.getElementById('wsAddWeekBtn').onclick        = () => actions.addWorkshopWeek();
        document.getElementById('wsPaymentsBtn').onclick       = () => showWorkshopPayments(appState.currentWorkshopId, appState.currentWorkshopName);
        document.getElementById('wsToggleArchivedBtn').onclick = () => {
            appState.showArchivedWsStudents = !appState.showArchivedWsStudents;
            renderWorkshopAttendance();
        };

        // Google Calendar entegrasyonu
        const wsCalBtn = document.getElementById('wsCalendarBtn');
        if (wsCalBtn) {
            wsCalBtn.addEventListener('click', () => {
                const ws = appState.currentWorkshop;
                if (!appState.wsDates || appState.wsDates.length === 0) {
                    showToast(t('classes.alertNoDate'), 'warning');
                    return;
                }
                // ILK hafta tarihini bul (calistaylar COUNT'lu tekrar icin baslangic onemli)
                const firstDateStr = appState.wsDates
                    .map(d => d.lesson_date)
                    .sort()
                    .shift();
                // Ders saatini al
                const lessonTime = (ws && ws.lesson_time)
                    ? ws.lesson_time.substring(0, 5)
                    : '19:00';
                // Toplam hafta sayisini al (tekrar kurali icin)
                const totalWeeks = (ws && ws.total_weeks) ? ws.total_weeks : null;
                const rrule = totalWeeks
                    ? `FREQ=WEEKLY;COUNT=${totalWeeks}`
                    : 'FREQ=WEEKLY';
                // Ilk tarihin gun adini hesapla
                // JS getDay(): 0=Pazar,1=Pzt,2=Sal,3=Car,4=Per,5=Cum,6=Cmt
                // stats.days:  [0]=Pzt,[1]=Sal,[2]=Car,[3]=Per,[4]=Cum,[5]=Cmt,[6]=Paz
                const [yr, mo, dy] = firstDateStr.split('-').map(Number);
                const dayIndex = new Date(yr, mo - 1, dy).getDay();
                const dayNames = t('stats.days');
                const mappedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
                const dayName = Array.isArray(dayNames) ? (dayNames[mappedIndex] || '') : '';
                // Event basligini olustur: "CalisatayAdi - GunAdi"
                const title = `${escapeHtml(appState.currentWorkshopName || '')} - ${dayName}`;
                // Uyari mesajini goster
                showToast(t('calendar.calendarWarning'), 'warning');
                // Google Calendar'i ac
                openGoogleCalendarEvent(
                    title,
                    firstDateStr,
                    lessonTime,
                    rrule,
                    t('calendar.workshopDesc')
                );
            });
        }

        // Öğrenci arama / filtreleme
        const wsSearchInput = document.getElementById('wsStudentSearchInput');
        if (wsSearchInput) {
            wsSearchInput.addEventListener('keyup', () => {
                const query = wsSearchInput.value.trim().toLowerCase();
                document.querySelectorAll('#wsStudentRows tr').forEach(row => {
                    const nameCell = row.querySelector('td:nth-child(2)');
                    if (!nameCell) return;
                    const name = nameCell.textContent.trim().toLowerCase();
                    row.style.display = name.includes(query) ? '' : 'none';
                });
            });
        }

        attachCellListeners(actions, modals);
        refreshIcons();
    })();
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
        tbody.innerHTML = `<tr><td colspan="${2 + appState.wsDates.length}" class="empty-state">${t('workshopAtt.emptyStudents')}</td></tr>`;
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
// actions ve modals parametresi renderWorkshopAttendance'daki
// dinamik import'tan gelir — döngüsel bağımlılık oluşmaz.
// ---------------------------------------------------------------
function attachCellListeners(actions, modals) {
    // Yoklama hücresi
    document.querySelectorAll('.ws-att-cell').forEach(cell => {
        cell.addEventListener('click', async (e) => {
            e.stopPropagation();
            const studentId = parseInt(cell.dataset.studentId);
            const dateId    = parseInt(cell.dataset.wsdateId);
            const dateObj   = appState.wsDates.find(d => d.id === dateId);
            if (!dateObj || dateObj.is_cancelled) return;
            if (isPastDate(dateObj.lesson_date)) {
                openConfirmModal(
                    t('workshopAtt.pastDateConfirm'),
                    async () => { await actions.toggleWorkshopAttendance(studentId, dateId, cell); },
                    null,
                    t('common.yes')
                );
                return;
            }
            await actions.toggleWorkshopAttendance(studentId, dateId, cell);
        });
    });

    // Öğrenci düzenle
    document.querySelectorAll('.ws-student-edit').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const studentId = parseInt(el.dataset.studentId);
            const name      = el.dataset.studentName;
            modals.editWorkshopStudent(studentId, name);
        });
    });

    // Video
    document.querySelectorAll('.ws-vid-icon').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const dateId = parseInt(el.dataset.wsdateId);
            modals.handleWorkshopVideo(dateId);
        });
    });

    // Partner
    document.querySelectorAll('.ws-partner-edit').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const dateId  = parseInt(el.dataset.wsdateId);
            const current = el.dataset.partner || '';
            modals.openWorkshopPartnerModal(dateId, current, (newVal) => {
                el.dataset.partner = newVal;
                el.title           = newVal;
                el.style.color     = newVal ? 'var(--primary)' : 'var(--text-dim)';
            });
        });
    });

    // Not
    document.querySelectorAll('.ws-note-cell').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const dateId  = parseInt(el.dataset.wsdateId);
            const current = appState.wsNotesMap[dateId] || '';
            modals.openWorkshopNoteModal(dateId, current, (newVal) => {
                appState.wsNotesMap[dateId] = newVal;
                const span = el.querySelector('span');
                if (span) span.style.color = newVal ? 'var(--primary)' : 'var(--text-dim)';
            });
        });
    });

    // Hafta başlığı (sil / iptal)
    document.querySelectorAll('#wsHeaderRow th[data-wsdate-id]').forEach(th => {
        th.addEventListener('click', (e) => {
            e.stopPropagation();
            const dateId    = parseInt(th.dataset.wsdateId);
            const cancelled = th.dataset.cancelled === '1';
            modals.openWorkshopWeekMenu(dateId, cancelled);
        });
    });
}