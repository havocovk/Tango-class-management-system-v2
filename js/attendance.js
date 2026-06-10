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

// ---------------------------------------------------------------
// Dışarıya export edilen tek giriş noktası
// router.js bu fonksiyonu çağırır
// ---------------------------------------------------------------
export async function showAttendanceView(classId, className) {
    appState.currentClassId = classId;
    appState.currentClassName = className;
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
    let html = `
        <div class="view">
            <div class="back-link" id="backToClassesBtn">← Sınıflar</div>
            <div class="nav-buttons" style="margin-bottom:10px;">
                <button id="addStudentBtn">👤 Add Student</button>
                <button id="addWeekBtn">📅 Add Week</button>
                <button id="paymentsBtn" class="btn-info">💰 Payments</button>
            </div>
            <h2 id="currClName" style="text-align:center; font-size:18px; color:var(--primary);">${escapeHtml(appState.currentClassName)}</h2>
            <div class="table-wrapper">
                <table>
                    <thead><tr id="headerRow"><th>#</th><th>Student</th>${appState.courseDates.map((d) => `<th style="writing-mode:vertical-rl;transform:rotate(180deg);height:100px; cursor:pointer;" data-date-id="${d.id}" data-date="${d.date}" title="Bu haftayı silmek için tıklayın">${formatDate(d.date)}</th>`).join('')}</tr></thead>
                    <tbody id="studentRows"></tbody>
                    <tfoot id="footerRow"></tfoot>
                </table>
            </div>
        </div>
    `;
    container.innerHTML = html;
    const tbody = document.getElementById('studentRows');
    tbody.innerHTML = '';
    appState.students.forEach((student, idx) => {
        let row = `<tr><td>${idx+1}</td><td><div style="display:flex;justify-content:space-between;"><span class="student-name-link" data-student-id="${student.id}" style="cursor:pointer; color:var(--text-main);" title="Profili gör">${escapeHtml(student.name)}</span><span class="btn-icon-edit" data-student-id="${student.id}" data-student-name="${escapeHtml(student.name)}"><i data-lucide="pencil" size="16"></i></span></div></td>`;
        appState.courseDates.forEach(date => {
            const status = appState.attendanceMap[`${student.id}_${date.id}`] || '';
            let iconHtml = '';
            if (status === '+') iconHtml = '<i data-lucide="check-circle-2" class="icon-present" size="18"></i>';
            else if (status === '-') iconHtml = '<i data-lucide="x-circle" class="icon-absent" size="18"></i>';
            else if (status === 'S') iconHtml = '<span style="color:var(--info); font-weight:800;">S</span>';
            row += `<td class="att-cell" data-student-id="${student.id}" data-date-id="${date.id}">${iconHtml}</td>`;
        });
        row += `</tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });

    const footer = document.getElementById('footerRow');
    footer.innerHTML = '';

    // Class Recaps satırı
    let videoRow = `<tr>`;
    videoRow += `<td style="position:sticky; left:0; background:var(--card-bg); z-index:10;">#</td>`;
    videoRow += `<td style="position:sticky; left:30px; background:var(--card-bg); z-index:10; font-weight:800; color:var(--accent);">Class Recaps</td>`;
    appState.courseDates.forEach(date => {
        const hasVideo = appState.videoMap[date.id];
        videoRow += `<td><span class="vid-icon ${hasVideo ? 'active' : ''}" data-date-id="${date.id}"><i data-lucide="video" size="20"></i></span></td>`;
    });
    videoRow += `</tr>`;

    // Partner/Teacher satırı
    let partnerRow = `<tr>`;
    partnerRow += `<td style="position:sticky; left:0; background:var(--card-bg); z-index:10;">#</td>`;
    partnerRow += `<td style="position:sticky; left:30px; background:var(--card-bg); z-index:10; font-weight:800; color:var(--accent);">Partner/Teacher</td>`;
    appState.courseDates.forEach(date => {
        const partner = appState.partnerMap[date.id] || '';
        const iconColor = partner ? 'var(--primary)' : 'var(--text-dim)';
        partnerRow += `<td><span class="partner-edit" data-date-id="${date.id}" data-partner="${escapeHtml(partner)}" title="${escapeHtml(partner)}" style="cursor:pointer; display:inline-flex; color:${iconColor};"><i data-lucide="notebook-pen" size="18"></i></span></td>`;
    });
    partnerRow += `</tr>`;

    // ADIM 8.2 — Ders Notu satırı
    let noteRow = `<tr>`;
    noteRow += `<td style="position:sticky; left:0; background:var(--card-bg); z-index:10;">#</td>`;
    noteRow += `<td style="position:sticky; left:30px; background:var(--card-bg); z-index:10; font-weight:800; color:var(--accent);">Ders Notu</td>`;
    appState.courseDates.forEach(date => {
        const noteText   = appState.notesMap[date.id] || '';
        const iconColor  = noteText ? 'var(--primary)' : 'var(--dim-forest)';
        const glowStyle  = noteText ? 'filter:drop-shadow(0 0 4px var(--primary));' : '';
        const preview    = noteText
            ? `<div style="font-size:9px;color:var(--text-dim);margin-top:3px;word-break:break-word;white-space:normal;max-width:44px;line-height:1.3;">${escapeHtml(noteText.substring(0,30))}${noteText.length > 30 ? '…' : ''}</div>`
            : '';
        noteRow += `<td class="note-cell" data-date-id="${date.id}" style="cursor:pointer; vertical-align:top; padding:8px 4px;">
            <span style="color:${iconColor}; ${glowStyle} display:inline-flex;"><i data-lucide="book-open" size="18"></i></span>
            ${preview}
        </td>`;
    });
    noteRow += `</tr>`;

    footer.innerHTML = videoRow + partnerRow + noteRow;

    // ---------------------------------------------------------------
    // Event listener'lar — attendanceActions ve attendanceModals
    // dinamik import ile yüklenir. renderAttendanceView her çağrıldığında
    // modüller zaten cache'de olduğu için ikinci çağrıdan itibaren
    // ek ağ isteği olmaz (ES module cache).
    // ---------------------------------------------------------------
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

        document.querySelectorAll('.att-cell').forEach(cell => {
            cell.addEventListener('click', async (e) => {
                e.stopPropagation();
                const studentId = parseInt(cell.dataset.studentId);
                const dateId    = parseInt(cell.dataset.dateId);
                const dateObj   = appState.courseDates.find(d => d.id === dateId);
                if (!dateObj) return;
                if (isPastDate(dateObj.date) && !confirm('Bu geçmiş tarihli bir yoklama. Değişiklik yapmak istediğinizden emin misiniz?')) return;
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
                    'Partner / Teacher Adı',
                    current,
                    'İsim girin (boş bırakıp Tamam derseniz silinir)',
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
                    'Ders Notu',
                    current,
                    'Örn: Cruzada, Ocho Cortado (boş bırakıp Tamam → notu siler)',
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
                const dateId    = parseInt(th.dataset.dateId);
                const dateStr   = th.dataset.date;
                const formatted = formatDate(dateStr);
                openConfirmModal(
                    `${formatted} tarihli haftayı silmek istediğinize emin misiniz?\nTüm yoklama ve video kayıtları da silinecektir.`,
                    async () => {
                        await actions.deleteWeek(dateId);
                    }
                );
            });
        });

        refreshIcons();
    })();
}

// ---------------------------------------------------------------
// Geri: bu sınıfın hangi okula ait olduğunu DB'den çekip yönlendirir
// ---------------------------------------------------------------
async function goBackToClasses() {
    const { data: cls } = await supabase.from('classes').select('school_id').eq('id', appState.currentClassId).single();
    if (cls) {
        const { data: school } = await supabase.from('schools').select('name').eq('id', cls.school_id).single();
        if (school) {
            navigateTo('classes', { schoolId: cls.school_id, schoolName: school.name });
        }
    }
}