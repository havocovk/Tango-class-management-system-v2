// ---------------------------------------------------------------
// attendance.js — Yoklama Ekranı Koordinatörü
// ---------------------------------------------------------------
// Sorumlulukları:
//   1. showAttendanceView()   → dışarıya export edilen tek giriş noktası
//   2. loadAttendanceData()   → Supabase'den tüm veriyi çeker, appState'e yazar
//                               attendanceActions ve attendanceModals da bu
//                               fonksiyonu import ederek yeniden çekme işlemini yapar
//   3. renderAttendanceView() → tabloyu DOM'a yazar; event listener'larda
//                               attendanceActions ve attendanceModals dinamik
//                               import ile yüklenir — döngüsel bağımlılık olmaz
//   4. goBackToClasses()      → geri navigasyonu
//
// BAĞIMLILIK HARİTASI (yönlü, çevrimsiz — döngü yok):
//
//   attendance.js
//       ↑                    ↑
//   attendanceActions.js   attendanceModals.js
//
//   attendance.js → attendanceActions.js : HAYIR (statik import yok)
//   attendance.js → attendanceModals.js  : HAYIR (statik import yok)
//   attendanceActions.js → attendance.js : EVET  (load + render için)
//   attendanceModals.js  → attendance.js : EVET  (load + render için)
//
// renderAttendanceView içindeki event listener'lar actions ve modals'ı
// SADECE BİR KERE başta dinamik import ile yükler, sonra kullanır.
// Bu classStats.js'in classes.js'ten ayrılmasında kullanılan
// tekniğin aynısıdır.
// ---------------------------------------------------------------

import { supabase } from './supabaseClient.js';
import { formatDate, isPastDate, refreshIcons, openPromptModalWithValue, openConfirmModal, showToast, escapeHtml } from './utils.js';
import { navigateTo } from './router.js';
import { appState } from './state.js';
import { cacheGet, cacheSet, getPendingChanges } from './offlineStore.js';
import { t } from './i18n.js';

// ---------------------------------------------------------------
// Dışarıya export edilen tek giriş noktası
// router.js bu fonksiyonu çağırır
// ---------------------------------------------------------------
export async function showAttendanceView(classId, className) {
    appState.currentClassId = classId;
    appState.currentClassName = className;

    // ADIM 2.3 — Son açılan sınıfı localStorage'a kaydet.
    // Ana ekranda hızlı erişim kartı bu veriyi okur.
    try {
        localStorage.setItem('tcms_last_class', JSON.stringify({
            classId,
            className,
            schoolId:   appState.currentSchoolId,
            schoolName: appState.currentSchoolName,
            timestamp:  Date.now()
        }));
    } catch (e) { /* yoksay */ }

    await loadAttendanceData();
    renderAttendanceView();
}

// ---------------------------------------------------------------
// Supabase'den tüm yoklama verisini çeker ve appState'e yazar.
// Export edilir çünkü attendanceActions ve attendanceModals
// veri yenileme sonrası bu fonksiyonu çağırır.
// ---------------------------------------------------------------
export async function loadAttendanceData() {
    const cacheKey = `attendance_${appState.currentClassId}`;

    // ADIM 7.2 — ÇEVRİMDIŞI OKUMA
    // İnternet yoksa Supabase'e gitmeyiz; en son kaydedilen veriyi
    // telefondaki cache'ten (IndexedDB) okuruz. Ayrıca varsa henüz
    // gönderilmemiş (bekleyen) çevrimdışı yoklama değişikliklerini de
    // bu verinin üzerine uygularız — böylece kullanıcı kendi yaptığı
    // işaretlemeleri çevrimdışıyken de görür.
    if (!navigator.onLine) {
        const cached = await cacheGet(cacheKey);
        appState.students      = (cached && cached.students)      || [];
        appState.courseDates   = (cached && cached.courseDates)   || [];
        appState.attendanceMap = (cached && cached.attendanceMap) || {};
        appState.videoMap      = (cached && cached.videoMap)      || {};
        appState.partnerMap    = (cached && cached.partnerMap)    || {};
        appState.notesMap      = (cached && cached.notesMap)      || {};
        appState.payments      = (cached && cached.payments)      || [];

        const pending = await getPendingChanges();
        pending.forEach(ch => {
            const belongsToThisClass = appState.courseDates.some(d => d.id === ch.courseDateId);
            if (!belongsToThisClass) return;
            const k = `${ch.studentId}_${ch.courseDateId}`;
            if (ch.status === '') delete appState.attendanceMap[k];
            else appState.attendanceMap[k] = ch.status;
        });
        return;
    }

    // ----- ÇEVRİMİÇİ: normal şekilde Supabase'den çek (mevcut davranış) -----
    const { data: studentsData } = await supabase.from('students').select('*').eq('class_id', appState.currentClassId).order('id');
    appState.students = studentsData || [];
    const { data: datesData } = await supabase.from('course_dates').select('*').eq('class_id', appState.currentClassId).order('date');
    appState.courseDates = datesData || [];
    const { data: attData } = await supabase.from('attendance').select('*').in('course_date_id', appState.courseDates.map(d => d.id));
    appState.attendanceMap = {};
    if (attData) attData.forEach(a => { appState.attendanceMap[`${a.student_id}_${a.course_date_id}`] = a.status; });
    const { data: videoData } = await supabase.from('videos').select('*').in('course_date_id', appState.courseDates.map(d => d.id));
    appState.videoMap = {};
    if (videoData) videoData.forEach(v => { appState.videoMap[v.course_date_id] = v.url; });
    appState.partnerMap = {};
    appState.courseDates.forEach(d => { appState.partnerMap[d.id] = d.teacher_partner || ''; });
    // ADIM 8.2 — Ders notları
    appState.notesMap = {};
    appState.courseDates.forEach(d => { appState.notesMap[d.id] = d.notes || ''; });
    // ADIM 6.4: Öğrenci profil modalı ödeme bilgisine ihtiyaç duyuyor
    const { data: paymentsData } = await supabase.from('payments').select('*').in('student_id', appState.students.map(s => s.id));
    appState.payments = paymentsData || [];

    // ADIM 7.2 — Bu sınıfın güncel verisini çevrimdışı kullanım için kaydet.
    // (Boş sonuç gelirse mevcut sağlam cache'i yanlışlıkla ezmeyelim diye
    //  küçük bir güvenlik kontrolü.)
    if (appState.courseDates.length > 0 || appState.students.length > 0) {
        await cacheSet(cacheKey, {
            students:      appState.students,
            courseDates:   appState.courseDates,
            attendanceMap: appState.attendanceMap,
            videoMap:      appState.videoMap,
            partnerMap:    appState.partnerMap,
            notesMap:      appState.notesMap,
            payments:      appState.payments
        });
    }
}

// ---------------------------------------------------------------
// Tabloyu DOM'a yazar.
// Export edilir çünkü attendanceActions ve attendanceModals
// işlem sonrasında tabloyu yeniden çizmek için bu fonksiyonu çağırır.
// ---------------------------------------------------------------
export function renderAttendanceView() {
    const container = document.getElementById('dynamicView');
    if (!container) return;

    // ADIM 4.1 — Üç parçaya bölündü:
    //   1) buildTableHTML()      → tablo iskeletini (string) üretir
    //   2) satır gövdesi + buildFooterRows() → öğrenci ve footer satırları
    //   3) attachEventListeners() → tüm tıklama olaylarını bağlar
    container.innerHTML = buildTableHTML();

    const tbody = document.getElementById('studentRows');
    tbody.innerHTML = '';
    appState.students.forEach((student, idx) => {
        const nameParts   = student.name.trim().split(' ');
        const firstName   = escapeHtml(nameParts[0] || student.name);
        const lastName    = escapeHtml(nameParts.slice(1).join(' '));
        const nameHtml    = lastName
            ? `<div style="line-height:1.35;">${firstName}<br>${lastName}</div>`
            : firstName;
        let row = `<tr><td>${idx+1}</td><td><div style="display:flex;justify-content:space-between;align-items:center;"><span class="student-name-link" data-student-id="${student.id}" style="cursor:pointer; color:var(--text-main);" title="${escapeHtml(t('attendance.profileTooltip'))}">${nameHtml}</span><span class="btn-icon-edit" data-student-id="${student.id}" data-student-name="${escapeHtml(student.name)}"><i data-lucide="pencil" size="16"></i></span></div></td>`;
        appState.courseDates.forEach(date => {
            const cancelled = date.is_cancelled;
            const status = appState.attendanceMap[`${student.id}_${date.id}`] || '';
            let iconHtml = '';
            if (status === '+') iconHtml = '<i data-lucide="check-circle-2" class="icon-present" size="18"></i>';
            else if (status === '-') iconHtml = '<i data-lucide="x-circle" class="icon-absent" size="18"></i>';
            else if (status === 'S') iconHtml = '<i data-lucide="user-x" style="color:var(--text-dim);" size="18"></i>';
            const cellCancelClass = cancelled ? ' cell-cancelled' : '';
            row += `<td class="att-cell${cellCancelClass}" data-student-id="${student.id}" data-date-id="${date.id}">${iconHtml}</td>`;
        });
        row += `</tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });

    const footer = document.getElementById('footerRow');
    footer.innerHTML = buildFooterRows();

    attachEventListeners();
}

// ---------------------------------------------------------------
// ADIM 4.1 (1/3) — buildTableHTML
// Yalnızca tablo iskeletini (üst butonlar + thead) string olarak
// döndürür. DOM'a yazmaz, event bağlamaz. Saf fonksiyon.
// ---------------------------------------------------------------
function buildTableHTML() {
    return `
        <div class="view">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                <div class="back-link" id="backToClassesBtn" style="margin-bottom:0;">${escapeHtml(t('nav.backToClasses'))}</div>
                <button id="csvBtn" class="btn-secondary" style="flex:none; min-width:auto; width:auto; padding:8px 12px; font-size:12px;"><i data-lucide="download" size="14" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>CSV İndir</button>
            </div>
            <div class="nav-buttons" style="margin-bottom:10px;">
                <button id="addStudentBtn"><i data-lucide="user-plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${escapeHtml(t('attendance.addStudent'))}</button>
                <button id="addWeekBtn"><i data-lucide="calendar-plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${escapeHtml(t('attendance.addWeek'))}</button>
                <button id="paymentsBtn" class="btn-info"><i data-lucide="credit-card" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${escapeHtml(t('attendance.payments'))}</button>
            </div>
            <h2 id="currClName" style="text-align:center; font-size:18px; color:var(--primary);">${escapeHtml(appState.currentClassName)}</h2>
            <div class="table-wrapper">
                <table>
                    <thead><tr id="headerRow"><th>#</th><th>${escapeHtml(t('attendance.colStudent'))}</th>${appState.courseDates.map((d) => {
                        const cancelled = d.is_cancelled;
                        const thStyle = 'th-date' + (cancelled ? ' th-date-cancelled' : '');
                        const thTitle = cancelled ? t('attendance.thCancelled') : t('attendance.thActive');
                        return `<th class="${thStyle}" data-date-id="${d.id}" data-date="${d.date}" data-cancelled="${cancelled ? '1' : '0'}" title="${thTitle}">${formatDate(d.date)}</th>`;
                    }).join('')}</tr></thead>
                    <tbody id="studentRows"></tbody>
                    <tfoot id="footerRow"></tfoot>
                </table>
            </div>
        </div>
    `;
}

// ---------------------------------------------------------------
// ADIM 4.1 (2/3) — buildFooterRows
// Video, partner ve ders notu satırlarını (string) döndürür.
// Yeni bir footer satırı eklemek istendiğinde yalnızca burası
// değiştirilir.
// ---------------------------------------------------------------
function buildFooterRows() {
    // Class Recaps satırı
    let videoRow = `<tr>`;
    videoRow += `<td class="foot-sticky-first">#</td>`;
    videoRow += `<td class="foot-sticky-label">${escapeHtml(t('attendance.rowClassRecaps'))}</td>`;
    appState.courseDates.forEach(date => {
        const hasVideo = appState.videoMap[date.id];
        const tdCancelClass = date.is_cancelled ? ' cell-cancelled' : '';
        videoRow += `<td class="${tdCancelClass}"><span class="vid-icon ${hasVideo ? 'active' : ''}" data-date-id="${date.id}"><i data-lucide="video" size="20"></i></span></td>`;
    });
    videoRow += `</tr>`;

    // Partner/Teacher satırı
    let partnerRow = `<tr>`;
    partnerRow += `<td class="foot-sticky-first">#</td>`;
    partnerRow += `<td class="foot-sticky-label">${escapeHtml(t('attendance.rowPartner'))}</td>`;
    appState.courseDates.forEach(date => {
        const partner = appState.partnerMap[date.id] || '';
        const iconColor = partner ? 'var(--primary)' : 'var(--text-dim)';
        const tdCancelClass2 = date.is_cancelled ? ' cell-cancelled' : '';
        partnerRow += `<td class="${tdCancelClass2}"><span class="partner-edit" data-date-id="${date.id}" data-partner="${escapeHtml(partner)}" title="${escapeHtml(partner)}" style="cursor:pointer; display:inline-flex; color:${iconColor};"><i data-lucide="notebook-pen" size="18"></i></span></td>`;
    });
    partnerRow += `</tr>`;

    // ADIM 8.2 — Ders Notu satırı
    let noteRow = `<tr>`;
    noteRow += `<td class="foot-sticky-first">#</td>`;
    noteRow += `<td class="foot-sticky-label">${escapeHtml(t('attendance.rowNote'))}</td>`;
    appState.courseDates.forEach(date => {
        const noteText  = appState.notesMap[date.id] || '';
        const iconColor = noteText ? 'var(--primary)' : 'var(--dim-forest)';
        const glowStyle = noteText ? 'filter:drop-shadow(0 0 4px var(--primary));' : '';
        const tdCancelClass3 = date.is_cancelled ? ' cell-cancelled' : '';
        noteRow += `<td class="note-cell${tdCancelClass3}" data-date-id="${date.id}" style="cursor:pointer; padding:8px 4px;">
            <span style="color:${iconColor}; ${glowStyle} display:inline-flex;"><i data-lucide="book-open" size="18"></i></span>
        </td>`;
    });
    noteRow += `</tr>`;

    return videoRow + partnerRow + noteRow;
}

// ---------------------------------------------------------------
// ADIM 4.1 (3/3) — attachEventListeners
// Tüm tıklama olaylarını bağlar. attendanceActions ve
// attendanceModals dinamik import ile yüklenir.
// ---------------------------------------------------------------
function attachEventListeners() {
    (async () => {
        const actions = await import('./attendanceActions.js');
        const modals  = await import('./attendanceModals.js');

        document.getElementById('backToClassesBtn').onclick = () => goBackToClasses();
        document.getElementById('addStudentBtn').onclick    = () => actions.addStudent();
        document.getElementById('addWeekBtn').onclick       = () => actions.addWeek();
        document.getElementById('paymentsBtn').onclick      = () => navigateTo('payments', {
            classId:   appState.currentClassId,
            className: appState.currentClassName
        });
        document.getElementById('csvBtn').onclick = () => downloadAttendanceCsv();

        document.querySelectorAll('.att-cell').forEach(cell => {
            cell.addEventListener('click', async (e) => {
                e.stopPropagation();
                const studentId = parseInt(cell.dataset.studentId);
                const dateId    = parseInt(cell.dataset.dateId);
                const dateObj   = appState.courseDates.find(d => d.id === dateId);
                if (!dateObj) return;
                if (dateObj.is_cancelled) return;
                if (isPastDate(dateObj.date)) {
                    openConfirmModal(
                        t('attendance.pastDateConfirm'),
                        async () => { await actions.toggleAttendance(studentId, dateId); },
                        null,
                        t('common.yes')
                    );
                    return;
                }
                await actions.toggleAttendance(studentId, dateId);
            });
        });

        document.querySelectorAll('.vid-icon').forEach(icon => {
            icon.addEventListener('click', async (e) => {
                e.stopPropagation();
                const dateId = parseInt(icon.dataset.dateId);
                await modals.handleVideo(dateId);
            });
        });

        document.querySelectorAll('.partner-edit').forEach(span => {
            span.addEventListener('click', async () => {
                const dateId  = parseInt(span.dataset.dateId);
                const current = span.dataset.partner || '';
                openPromptModalWithValue(
                    t('attendance.partnerModalTitle'),
                    current,
                    t('attendance.partnerModalPlaceholder'),
                    async (newPartner) => {
                        await modals.updateTeacherPartner(dateId, newPartner);
                    }
                );
            });
        });

        // ADIM 8.2 — Ders notu hücresine tıklayınca not ekle/düzenle
        document.querySelectorAll('.note-cell').forEach(cell => {
            cell.addEventListener('click', async () => {
                const dateId  = parseInt(cell.dataset.dateId);
                const current = appState.notesMap[dateId] || '';
                openPromptModalWithValue(
                    t('attendance.noteModalTitle'),
                    current,
                    t('attendance.noteModalPlaceholder'),
                    async (newNote) => {
                        await modals.updateNote(dateId, newNote);
                    }
                );
            });
        });

        document.querySelectorAll('.btn-icon-edit').forEach(icon => {
            icon.addEventListener('click', async (e) => {
                e.stopPropagation();
                const studentId   = parseInt(icon.dataset.studentId);
                const currentName = icon.dataset.studentName;
                modals.openStudentActionModal(studentId, currentName);
            });
        });

        // ADIM 6.4 — Öğrenci adına tıklayınca profil modalını aç
        document.querySelectorAll('.student-name-link').forEach(span => {
            span.addEventListener('click', async (e) => {
                e.stopPropagation();
                const studentId = parseInt(span.dataset.studentId);
                const student   = appState.students.find(s => s.id === studentId);
                if (student) await modals.openStudentProfileModal(student);
            });
        });

        document.querySelectorAll('#headerRow th[data-date-id]').forEach(th => {
            th.addEventListener('click', async (e) => {
                e.stopPropagation();
                const dateId      = parseInt(th.dataset.dateId);
                const dateStr     = th.dataset.date;
                const isCancelled = th.dataset.cancelled === '1';
                modals.openWeekActionModal(dateId, dateStr, isCancelled);
            });
        });

        refreshIcons();
    })();
}

// ---------------------------------------------------------------
// Geri: bu sınıfın hangi okula ait olduğunu DB'den çekip yönlendirir
// ---------------------------------------------------------------
function goBackToClasses() {
    navigateTo('classes', {
        schoolId:   appState.currentSchoolId,
        schoolName: appState.currentSchoolName
    });
}

// ---------------------------------------------------------------
// ADIM 3.1 — YOKLAMA CSV DIŞA AKTARMA
// ---------------------------------------------------------------
function downloadAttendanceCsv() {
    const headers = ['Öğrenci', ...appState.courseDates.map(d => d.date)];
    const rows = appState.students.map(s => {
        const statusMap = { '+': 'Geldi', '-': 'Gelmedi', 'S': 'Mazeretli', '': '' };
        return [
            s.name,
            ...appState.courseDates.map(d => statusMap[appState.attendanceMap[`${s.id}_${d.id}`] || ''] || '')
        ];
    });
    const csv = [headers, ...rows]
        .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${appState.currentClassName}_yoklama.csv`;
    a.click();
    URL.revokeObjectURL(url);
}