import { supabase } from './supabaseClient.js';
import { formatDate, isPastDate, refreshIcons, openPromptModal, openPromptModalWithValue, openConfirmModal, showToast, escapeHtml } from './utils.js';
import { navigateTo } from './router.js';
import { appState } from './state.js';

export async function showAttendanceView(classId, className) {
    appState.currentClassId = classId;
    appState.currentClassName = className;
    await loadAttendanceData();
    renderAttendanceView();
}

async function loadAttendanceData() {
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
        let row = `<tr><td>${idx+1}</td><td><div style="display:flex;justify-content:space-between;">${escapeHtml(student.name)}<span class="btn-icon-edit" data-student-id="${student.id}" data-student-name="${escapeHtml(student.name)}"><i data-lucide="pencil" size="16"></i></span></div></td>`;
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
        partnerRow += `<td><span class="partner-edit" data-date-id="${date.id}" data-partner="${escapeHtml(partner)}" style="cursor:pointer; color:var(--primary);">${partner ? escapeHtml(partner.substring(0,8)) : '✏️'}</span></td>`;
    });
    partnerRow += `</tr>`;

    footer.innerHTML = videoRow + partnerRow;

    // Event listener'lar
    document.getElementById('backToClassesBtn').onclick = () => goBackToClasses();
    document.getElementById('addStudentBtn').onclick = () => addStudent();
    document.getElementById('addWeekBtn').onclick = () => addWeek();
    document.getElementById('paymentsBtn').onclick = () => navigateTo('payments', { classId: appState.currentClassId, className: appState.currentClassName });

    document.querySelectorAll('.att-cell').forEach(cell => {
        cell.addEventListener('click', async (e) => {
            e.stopPropagation();
            const studentId = parseInt(cell.dataset.studentId);
            const dateId = parseInt(cell.dataset.dateId);
            const dateObj = appState.courseDates.find(d => d.id === dateId);
            if (!dateObj) return;
            if (isPastDate(dateObj.date) && !confirm('Bu geçmiş tarihli bir yoklama. Değişiklik yapmak istediğinizden emin misiniz?')) return;
            await toggleAttendance(studentId, dateId);
        });
    });

    document.querySelectorAll('.vid-icon').forEach(icon => {
        icon.addEventListener('click', async (e) => {
            e.stopPropagation();
            const dateId = parseInt(icon.dataset.dateId);
            await handleVideo(dateId);
        });
    });

    document.querySelectorAll('.partner-edit').forEach(span => {
        span.addEventListener('click', async () => {
            const dateId = parseInt(span.dataset.dateId);
            const current = span.dataset.partner === '✏️' ? '' : span.dataset.partner;
            openPromptModalWithValue(
                'Partner / Teacher Adı',
                current,
                'İsim girin (boş bırakıp Tamam derseniz silinir)',
                async (newPartner) => {
                    await updateTeacherPartner(dateId, newPartner);
                }
            );
        });
    });

    document.querySelectorAll('.btn-icon-edit').forEach(icon => {
        icon.addEventListener('click', async (e) => {
            e.stopPropagation();
            const studentId = parseInt(icon.dataset.studentId);
            const currentName = icon.dataset.studentName;
            openStudentActionModal(studentId, currentName);
        });
    });

    document.querySelectorAll('#headerRow th[data-date-id]').forEach(th => {
        th.addEventListener('click', async (e) => {
            e.stopPropagation();
            const dateId = parseInt(th.dataset.dateId);
            const dateStr = th.dataset.date;
            const formatted = formatDate(dateStr);
            openConfirmModal(
                `${formatted} tarihli haftayı silmek istediğinize emin misiniz?\nTüm yoklama ve video kayıtları da silinecektir.`,
                async () => {
                    await deleteWeek(dateId);
                }
            );
        });
    });

    refreshIcons();
}

async function goBackToClasses() {
    const { data: cls } = await supabase.from('classes').select('school_id').eq('id', appState.currentClassId).single();
    if (cls) {
        const { data: school } = await supabase.from('schools').select('name').eq('id', cls.school_id).single();
        if (school) {
            navigateTo('classes', { schoolId: cls.school_id, schoolName: school.name });
        }
    }
}

function openStudentActionModal(studentId, currentName) {
    const modal = document.getElementById('studentActionModal');
    const viewMode = document.getElementById('studentViewMode');
    const editMode = document.getElementById('studentEditMode');
    const nameDisplay = document.getElementById('studentNameDisplay');
    const editInput = document.getElementById('studentEditInput');
    const editBtn = document.getElementById('studentEditBtn');
    const deleteBtn = document.getElementById('studentDeleteBtn');
    const closeBtn = document.getElementById('studentModalCloseView');
    const saveBtn = document.getElementById('studentSaveBtn');
    const cancelEditBtn = document.getElementById('studentCancelEditBtn');

    editBtn.onclick = null;
    deleteBtn.onclick = null;
    closeBtn.onclick = null;
    saveBtn.onclick = null;
    cancelEditBtn.onclick = null;

    nameDisplay.innerText = currentName;
    viewMode.style.display = 'block';
    editMode.style.display = 'none';
    modal.style.display = 'flex';

    editBtn.onclick = () => {
        viewMode.style.display = 'none';
        editMode.style.display = 'block';
        editInput.value = currentName;
        editInput.focus();
    };

    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        modal.style.display = 'none';
        openConfirmModal(
            'Öğrenciyi silmek istediğinize emin misiniz? Tüm yoklamaları ve ödemeleri de silinecek.',
            async () => {
                await deleteStudent(studentId);
            },
            () => {
                modal.style.display = 'flex';
            }
        );
    };

    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    saveBtn.onclick = async () => {
        const newName = editInput.value.trim();
        if (newName && newName !== currentName) {
            await updateStudentName(studentId, newName);
            nameDisplay.innerText = newName;
            currentName = newName;
        }
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
    };

    cancelEditBtn.onclick = () => {
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
    };
}

async function updateStudentName(studentId, newName) {
    const { error } = await supabase.from('students').update({ name: newName }).eq('id', studentId);
    if (!error) {
        showToast('Öğrenci adı güncellendi ✓', 'success');
        await loadAttendanceData();
        renderAttendanceView();
    } else {
        showToast('Ad güncellenemedi. Bağlantıyı kontrol edin.', 'error');
    }
}

async function deleteStudent(studentId) {
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
async function toggleAttendance(studentId, courseDateId) {
    const current = appState.attendanceMap[`${studentId}_${courseDateId}`] || '';
    let newStatus = '';
    if (current === '') newStatus = '+';
    else if (current === '+') newStatus = '-';
    else if (current === '-') newStatus = 'S';
    else newStatus = '';

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
        else if (newStatus === 'S') iconHtml = '<span style="color:var(--info); font-weight:800;">S</span>';
        cell.innerHTML = iconHtml;
        refreshIcons();
    }
}

async function handleVideo(courseDateId) {
    const existingUrl = appState.videoMap[courseDateId];
    if (existingUrl) {
        const modal = document.getElementById('videoModal');
        const linkDisplay = document.getElementById('videoLinkDisplay');
        const watchIcon = document.getElementById('watchVideoBtn');
        const deleteIcon = document.getElementById('deleteVideoBtn');
        const closeBtn = document.getElementById('closeVideoModalBtn');

        linkDisplay.innerText = existingUrl;
        linkDisplay.style.color = '#2DD4BF';
        modal.style.display = 'flex';
        refreshIcons();

        const watchHandler = () => {
            window.open(existingUrl, '_blank');
        };

        const deleteHandler = () => {
            modal.style.display = 'none';
            openConfirmModal(
                'Bu video bağlantısını silmek istediğinize emin misiniz?',
                async () => {
                    const { error } = await supabase.from('videos').delete().eq('course_date_id', courseDateId);
                    if (!error) {
                        showToast('Video bağlantısı silindi ✓', 'success');
                        delete appState.videoMap[courseDateId];
                        // Sadece bu sütunun video ikonunu güncelle — tüm tabloyu yeniden çizme!
                        const icon = document.querySelector(`.vid-icon[data-date-id="${courseDateId}"]`);
                        if (icon) icon.classList.remove('active');
                    } else {
                        showToast('Video silinemedi. Bağlantıyı kontrol edin.', 'error');
                    }
                    cleanup();
                },
                () => {
                    modal.style.display = 'flex';
                    refreshIcons();
                }
            );
        };

        const closeHandler = () => {
            modal.style.display = 'none';
            cleanup();
        };

        const cleanup = () => {
            watchIcon.removeEventListener('click', watchHandler);
            deleteIcon.removeEventListener('click', deleteHandler);
            closeBtn.removeEventListener('click', closeHandler);
            modal.removeEventListener('click', outsideClickHandler);
        };

        const outsideClickHandler = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                cleanup();
            }
        };

        watchIcon.removeEventListener('click', watchHandler);
        deleteIcon.removeEventListener('click', deleteHandler);
        closeBtn.removeEventListener('click', closeHandler);
        modal.removeEventListener('click', outsideClickHandler);

        watchIcon.addEventListener('click', watchHandler);
        deleteIcon.addEventListener('click', deleteHandler);
        closeBtn.addEventListener('click', closeHandler);
        modal.addEventListener('click', outsideClickHandler);
    } else {
        openPromptModal('Video Linki', 'https://...', async (url) => {
            if (url && url.startsWith('http')) {
                const { error } = await supabase.from('videos').insert({ course_date_id: courseDateId, url });
                if (!error) {
                    showToast('Video bağlantısı eklendi ✓', 'success');
                    appState.videoMap[courseDateId] = url;
                    // Sadece bu sütunun video ikonunu güncelle — tüm tabloyu yeniden çizme!
                    const icon = document.querySelector(`.vid-icon[data-date-id="${courseDateId}"]`);
                    if (icon) icon.classList.add('active');
                } else {
                    showToast('Video eklenemedi. Bağlantıyı kontrol edin.', 'error');
                }
            } else {
                showToast('Geçerli bir URL girin (http ile başlamalı)', 'warning');
            }
        });
    }
}

async function updateTeacherPartner(courseDateId, newPartner) {
    const { error } = await supabase.from('course_dates').update({ teacher_partner: newPartner }).eq('id', courseDateId);
    if (!error) {
        appState.partnerMap[courseDateId] = newPartner;
        showToast(newPartner ? 'Partner güncellendi ✓' : 'Partner silindi ✓', 'success');
        renderAttendanceView();
    } else {
        showToast('Partner güncellenemedi. Bağlantıyı kontrol edin.', 'error');
    }
}

async function addStudent() {
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

async function addWeek() {
    const lastDate = appState.courseDates.length ? new Date(appState.courseDates[appState.courseDates.length-1].date) : new Date();
    const newDate = new Date(lastDate.getTime() + 7*24*60*60*1000);
    const newDateStr = newDate.toISOString().split('T')[0];
    const { error } = await supabase.from('course_dates').insert({ class_id: appState.currentClassId, date: newDateStr, teacher_partner: null });
    if (!error) {
        showToast('Yeni hafta eklendi ✓', 'success');
        await loadAttendanceData();
        renderAttendanceView();
    } else {
        showToast('Hafta eklenemedi. Bağlantıyı kontrol edin.', 'error');
    }
}

async function deleteWeek(courseDateId) {
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