import { supabase } from './supabaseClient.js';
import { formatDate, isPastDate, refreshIcons, createModal } from './utils.js';
import { showPaymentsView } from './payments.js';
import { showClassesView } from './classes.js';

let currentClassId = null;
let currentClassName = null;
let students = [];
let courseDates = [];
let attendanceMap = {};     // key: `${studentId}_${courseDateId}` -> status
let videoMap = {};          // key: courseDateId -> url
let partnerMap = {};        // key: courseDateId -> teacher_partner

export async function showAttendanceView(classId, className) {
    currentClassId = classId;
    currentClassName = className;
    await loadAttendanceData();
    renderAttendanceView();
}

async function loadAttendanceData() {
    // Öğrenciler
    const { data: studentsData } = await supabase.from('students').select('*').eq('class_id', currentClassId).order('id');
    students = studentsData || [];
    // Ders günleri
    const { data: datesData } = await supabase.from('course_dates').select('*').eq('class_id', currentClassId).order('date');
    courseDates = datesData || [];
    // Yoklamalar
    const { data: attData } = await supabase.from('attendance').select('*').in('course_date_id', courseDates.map(d => d.id));
    attendanceMap = {};
    if (attData) {
        attData.forEach(a => { attendanceMap[`${a.student_id}_${a.course_date_id}`] = a.status; });
    }
    // Videolar
    const { data: videoData } = await supabase.from('videos').select('*').in('course_date_id', courseDates.map(d => d.id));
    videoMap = {};
    if (videoData) videoData.forEach(v => { videoMap[v.course_date_id] = v.url; });
    // Partner bilgileri
    partnerMap = {};
    courseDates.forEach(d => { partnerMap[d.id] = d.teacher_partner || ''; });
}

function renderAttendanceView() {
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
            <h2 id="currClName" style="text-align:center; font-size:18px; color:var(--primary);">${escapeHtml(currentClassName)}</h2>
            <div class="table-wrapper">
                <table>
                    <thead><tr id="headerRow">`;
    // Başlık satırı
    html += `<th>#</th><th>Student</th>`;
    courseDates.forEach((d, idx) => {
        html += `<th style="writing-mode:vertical-rl;transform:rotate(180deg);height:100px;" data-date-id="${d.id}" data-date="${d.date}">${formatDate(d.date)}</th>`;
    });
    html += `</tr></thead><tbody id="studentRows"></tbody><tfoot id="footerRow"></tfoot></table></div></div>`;
    container.innerHTML = html;
    // Öğrenci satırları
    const tbody = document.getElementById('studentRows');
    tbody.innerHTML = '';
    students.forEach((student, idx) => {
        let row = `<tr><td>${idx+1}</td><td><div style="display:flex;justify-content:space-between;">${escapeHtml(student.name)}<span class="btn-icon-edit" data-student-id="${student.id}" data-name="${escapeHtml(student.name)}"><i data-lucide="pencil" size="16"></i></span></div></td>`;
        courseDates.forEach(date => {
            const status = attendanceMap[`${student.id}_${date.id}`] || '';
            let iconHtml = '';
            if (status === '+') iconHtml = '<i data-lucide="check-circle-2" class="icon-present" size="18"></i>';
            else if (status === '-') iconHtml = '<i data-lucide="x-circle" class="icon-absent" size="18"></i>';
            else if (status === 'S') iconHtml = '<span style="color:var(--info); font-weight:800;">S</span>';
            row += `<td class="att-cell" data-student-id="${student.id}" data-date-id="${date.id}">${iconHtml}</td>`;
        });
        row += `</tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });
    // Footer: video ve partner satırları
    const footer = document.getElementById('footerRow');
    footer.innerHTML = '';
    // Video satırı
    let videoRow = `<tr><td colspan="2" style="font-weight:800; color:var(--accent);">Class Recaps</td>`;
    courseDates.forEach(date => {
        const hasVideo = videoMap[date.id];
        videoRow += `<td><span class="vid-icon ${hasVideo ? 'active' : ''}" data-date-id="${date.id}"><i data-lucide="video" size="20"></i></span></td>`;
    });
    videoRow += `</tr>`;
    // Partner satırı
    let partnerRow = `<tr><td colspan="2" style="font-weight:800; color:var(--accent);">Partner/Teacher</td>`;
    courseDates.forEach(date => {
        const partner = partnerMap[date.id] || '';
        partnerRow += `<td><span class="partner-edit" data-date-id="${date.id}" data-partner="${escapeHtml(partner)}" style="cursor:pointer; color:var(--primary);">${partner ? escapeHtml(partner.substring(0,8)) : '✏️'}</span></td>`;
    });
    partnerRow += `</tr>`;
    footer.innerHTML = videoRow + partnerRow;
    // Olayları bağla
    document.getElementById('backToClassesBtn').onclick = () => showClassesViewFromAttendance();
    document.getElementById('addStudentBtn').onclick = () => addStudent();
    document.getElementById('addWeekBtn').onclick = () => addWeek();
    document.getElementById('paymentsBtn').onclick = () => showPaymentsView(currentClassId, currentClassName);
    // Yoklama hücreleri
    document.querySelectorAll('.att-cell').forEach(cell => {
        cell.addEventListener('click', async (e) => {
            e.stopPropagation();
            const studentId = parseInt(cell.dataset.studentId);
            const dateId = parseInt(cell.dataset.dateId);
            const dateObj = courseDates.find(d => d.id === dateId);
            if (!dateObj) return;
            if (isPastDate(dateObj.date)) {
                if (!confirm('Bu geçmiş tarihli bir yoklama. Değişiklik yapmak istediğinizden emin misiniz?')) return;
            }
            await toggleAttendance(studentId, dateId);
        });
    });
    // Video ikonları
    document.querySelectorAll('.vid-icon').forEach(icon => {
        icon.addEventListener('click', async (e) => {
            e.stopPropagation();
            const dateId = parseInt(icon.dataset.dateId);
            await handleVideo(dateId);
        });
    });
    // Partner düzenleme
    document.querySelectorAll('.partner-edit').forEach(span => {
        span.addEventListener('click', async () => {
            const dateId = parseInt(span.dataset.dateId);
            const current = span.dataset.partner === '✏️' ? '' : span.dataset.partner;
            const newPartner = prompt('Dersi verdiğiniz kişinin adı:', current);
            if (newPartner !== null) {
                await updateTeacherPartner(dateId, newPartner);
            }
        });
    });
    // Öğrenci düzenleme ikonları
    document.querySelectorAll('.btn-icon-edit').forEach(icon => {
        icon.addEventListener('click', async (e) => {
            e.stopPropagation();
            const studentId = parseInt(icon.dataset.studentId);
            const oldName = icon.dataset.name;
            const newName = prompt('Öğrenci adını düzenle:', oldName);
            if (newName && newName !== oldName) {
                await updateStudentName(studentId, newName);
            }
        });
    });
    refreshIcons();
}

async function toggleAttendance(studentId, courseDateId) {
    const current = attendanceMap[`${studentId}_${courseDateId}`] || '';
    let newStatus = '';
    if (current === '') newStatus = '+';
    else if (current === '+') newStatus = '-';
    else if (current === '-') newStatus = 'S';
    else newStatus = '';
    if (newStatus === '') {
        // Sil
        await supabase.from('attendance').delete().eq('student_id', studentId).eq('course_date_id', courseDateId);
        delete attendanceMap[`${studentId}_${courseDateId}`];
    } else {
        // Upsert
        const { error } = await supabase.from('attendance').upsert({ student_id: studentId, course_date_id: courseDateId, status: newStatus });
        if (!error) attendanceMap[`${studentId}_${courseDateId}`] = newStatus;
        else alert('Hata: ' + error.message);
    }
    // Yeniden render (sadece ilgili hücreyi değiştirmek daha performanslı ama kolaylık için tam render)
    await loadAttendanceData();
    renderAttendanceView();
}

async function handleVideo(courseDateId) {
    const existingUrl = videoMap[courseDateId];
    if (existingUrl) {
        const action = confirm(`Video mevcut: ${existingUrl}\nİzlemek için Tamam, silmek için İptal.`);
        if (action) {
            window.open(existingUrl, '_blank');
        } else {
            if (confirm('Video linkini silmek istediğinize emin misiniz?')) {
                await supabase.from('videos').delete().eq('course_date_id', courseDateId);
                delete videoMap[courseDateId];
                await loadAttendanceData();
                renderAttendanceView();
            }
        }
    } else {
        const url = prompt('YouTube veya video linki girin:', 'https://');
        if (url && url.startsWith('http')) {
            const { error } = await supabase.from('videos').insert({ course_date_id: courseDateId, url });
            if (!error) {
                videoMap[courseDateId] = url;
                await loadAttendanceData();
                renderAttendanceView();
            } else alert('Hata: ' + error.message);
        }
    }
}

async function updateTeacherPartner(courseDateId, newPartner) {
    const { error } = await supabase.from('course_dates').update({ teacher_partner: newPartner }).eq('id', courseDateId);
    if (!error) {
        partnerMap[courseDateId] = newPartner;
        renderAttendanceView();
    } else alert('Hata: ' + error.message);
}

async function addStudent() {
    const name = prompt('Öğrencinin tam adı:', '');
    if (!name) return;
    const { error } = await supabase.from('students').insert({ class_id: currentClassId, name });
    if (error) alert('Hata: ' + error.message);
    else {
        await loadAttendanceData();
        renderAttendanceView();
    }
}

async function addWeek() {
    const lastDate = courseDates.length ? new Date(courseDates[courseDates.length-1].date) : new Date();
    const newDate = new Date(lastDate.getTime() + 7*24*60*60*1000);
    const newDateStr = newDate.toISOString().split('T')[0];
    const { error } = await supabase.from('course_dates').insert({ class_id: currentClassId, date: newDateStr, teacher_partner: null });
    if (!error) {
        await loadAttendanceData();
        renderAttendanceView();
    } else alert('Hata: ' + error.message);
}

async function updateStudentName(studentId, newName) {
    const { error } = await supabase.from('students').update({ name: newName }).eq('id', studentId);
    if (!error) {
        await loadAttendanceData();
        renderAttendanceView();
    } else alert('Hata: ' + error.message);
}

function showClassesViewFromAttendance() {
    // currentSchoolId'yi nereden alacağız? Bunu app state'de tutmak daha doğru. Basitçe classId üzerinden schoolId bulalım.
    (async () => {
        const { data: cls } = await supabase.from('classes').select('school_id').eq('id', currentClassId).single();
        if (cls) {
            const { data: school } = await supabase.from('schools').select('name').eq('id', cls.school_id).single();
            if (school) {
                const { showClassesView } = await import('./classes.js');
                showClassesView(cls.school_id, school.name);
            }
        }
    })();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}