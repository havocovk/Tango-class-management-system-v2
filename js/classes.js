import { supabase } from './supabaseClient.js';
import { refreshIcons, formatDate, openConfirmModal } from './utils.js';
import { showAttendanceView } from './attendance.js';

let currentSchoolId = null;
let currentSchoolName = null;
let classesList = [];

export async function showClassesView(schoolId, schoolName) {
    currentSchoolId = schoolId;
    currentSchoolName = schoolName;
    await loadClasses();
    renderClassesView();
}

async function loadClasses() {
    const { data, error } = await supabase.from('classes').select('*').eq('school_id', currentSchoolId).order('id');
    if (error) console.error(error);
    else classesList = data;
}

function renderClassesView() {
    const container = document.getElementById('dynamicView');
    container.innerHTML = `
        <div class="view">
            <div class="back-link" id="backToSchoolsBtn">← Okullar</div>
            <div class="main-title">Tango Class Management System</div>
            <div class="sub-header">Sınıf Listesi - ${escapeHtml(currentSchoolName)}</div>
            <div id="classesListContainer"></div>
            <div class="nav-buttons">
                <button id="newClassBtn" class="btn-success">➕ Yeni Sınıf</button>
                <button id="weeklyStatsBtn" class="btn-info">📊 Haftalık İstatistikler</button>
            </div>
        </div>
    `;
    document.getElementById('backToSchoolsBtn').onclick = () => {
        import('./schools.js').then(m => m.loadSchools());
    };
    const listDiv = document.getElementById('classesListContainer');
    listDiv.innerHTML = '';
    if (classesList.length === 0) {
        listDiv.innerHTML = '<div style="text-align:center; color:var(--text-dim); padding:20px;">Henüz sınıf yok. Yeni sınıf ekleyin.</div>';
    } else {
        classesList.forEach(cls => {
            const card = document.createElement('div');
            card.className = 'class-card';
            card.innerHTML = `
                <div style="flex:1; cursor:pointer; font-weight:600;" data-id="${cls.id}">${escapeHtml(cls.name)}</div>
                <div style="display:flex; gap:15px;">
                    <span class="btn-icon-edit" data-id="${cls.id}" data-name="${escapeHtml(cls.name)}"><i data-lucide="pencil" size="20"></i></span>
                    <span class="btn-icon-delete" data-id="${cls.id}"><i data-lucide="trash-2" size="20"></i></span>
                </div>
            `;
            card.querySelector('[style*="flex:1"]').addEventListener('click', () => showAttendanceView(cls.id, cls.name));
            card.querySelector('.btn-icon-edit').addEventListener('click', (e) => {
                e.stopPropagation();
                editClass(cls.id, cls.name);
            });
            card.querySelector('.btn-icon-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteClass(cls.id);
            });
            listDiv.appendChild(card);
        });
    }
    document.getElementById('newClassBtn').onclick = () => addClass();
    document.getElementById('weeklyStatsBtn').onclick = () => showWeeklyStats();
    refreshIcons();
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

async function addClass() {
    // Sınıf adı sor
    const modal = document.getElementById('dynamicModal');
    const titleEl = document.getElementById('dynamicModalTitle');
    const input = document.getElementById('dynamicInput');
    titleEl.innerText = 'Sınıf Adı';
    input.placeholder = 'Örn: Pazartesi 19:30';
    input.value = '';
    modal.style.display = 'flex';
    input.focus();

    const confirmHandler = () => {
        const className = input.value.trim();
        if (!className) {
            modal.style.display = 'none';
            cleanup();
            return;
        }
        modal.style.display = 'none';
        cleanup();
        // Başlangıç tarihi sor
        const dateModal = document.getElementById('dynamicModal');
        const dateTitle = document.getElementById('dynamicModalTitle');
        const dateInput = document.getElementById('dynamicInput');
        dateTitle.innerText = 'Başlangıç Tarihi';
        dateInput.placeholder = 'YYYY-MM-DD (örn: 2025-06-01)';
        dateInput.value = '';
        dateModal.style.display = 'flex';
        dateInput.focus();

        const dateConfirmHandler = async () => {
            const startDate = dateInput.value.trim();
            if (!startDate) {
                dateModal.style.display = 'none';
                dateCleanup();
                return;
            }
            dateModal.style.display = 'none';
            dateCleanup();
            const { data: newClass, error: classError } = await supabase.from('classes').insert({ school_id: currentSchoolId, name: className }).select().single();
            if (classError) { alert('Sınıf eklenemedi: ' + classError.message); return; }
            const { error: dateError } = await supabase.from('course_dates').insert({ class_id: newClass.id, date: startDate, teacher_partner: null });
            if (dateError) console.error(dateError);
            await loadClasses();
            renderClassesView();
        };
        const dateCancelHandler = () => {
            dateModal.style.display = 'none';
            dateCleanup();
        };
        const dateCleanup = () => {
            document.getElementById('dynamicModalConfirm').removeEventListener('click', dateConfirmHandler);
            document.getElementById('dynamicModalCancel').removeEventListener('click', dateCancelHandler);
            dateInput.removeEventListener('keypress', dateKeyHandler);
        };
        const dateKeyHandler = (e) => { if (e.key === 'Enter') dateConfirmHandler(); };
        document.getElementById('dynamicModalConfirm').onclick = dateConfirmHandler;
        document.getElementById('dynamicModalCancel').onclick = dateCancelHandler;
        dateInput.addEventListener('keypress', dateKeyHandler);
    };
    const cancelHandler = () => {
        modal.style.display = 'none';
        cleanup();
    };
    const cleanup = () => {
        document.getElementById('dynamicModalConfirm').removeEventListener('click', confirmHandler);
        document.getElementById('dynamicModalCancel').removeEventListener('click', cancelHandler);
        input.removeEventListener('keypress', keyHandler);
    };
    const keyHandler = (e) => { if (e.key === 'Enter') confirmHandler(); };
    document.getElementById('dynamicModalConfirm').onclick = confirmHandler;
    document.getElementById('dynamicModalCancel').onclick = cancelHandler;
    input.addEventListener('keypress', keyHandler);
}

async function editClass(classId, oldName) {
    const modal = document.getElementById('editClassModal');
    const nameInput = document.getElementById('editClassNameInput');
    const dateInput = document.getElementById('editClassNewDateInput');
    const saveBtn = document.getElementById('editClassSaveBtn');
    const cancelBtn = document.getElementById('editClassCancelBtn');

    nameInput.value = oldName;
    dateInput.value = '';
    modal.style.display = 'flex';
    nameInput.focus();

    const saveHandler = async () => {
        const newName = nameInput.value.trim();
        const newDateStr = dateInput.value;

        if (newName && newName !== oldName) {
            const { error } = await supabase.from('classes').update({ name: newName }).eq('id', classId);
            if (error) alert('Ad güncellenemedi: ' + error.message);
        }

        if (newDateStr) {
            const { data: existingDates } = await supabase
                .from('course_dates')
                .select('date')
                .eq('class_id', classId)
                .order('date', { ascending: false });
            
            let lastDate = null;
            if (existingDates && existingDates.length > 0) {
                lastDate = new Date(existingDates[0].date);
            }
            const newDate = new Date(newDateStr);
            
            if (lastDate && newDate <= lastDate) {
                alert(`Yeni tarih, son ders tarihinden (${formatDate(lastDate.toISOString().split('T')[0])}) sonra olmalıdır. Eklenmedi.`);
            } else {
                const { data: alreadyExists } = await supabase
                    .from('course_dates')
                    .select('id')
                    .eq('class_id', classId)
                    .eq('date', newDateStr)
                    .maybeSingle();
                
                if (alreadyExists) {
                    alert('Bu tarih zaten mevcut. Eklenmedi.');
                } else {
                    const { error: insertError } = await supabase
                        .from('course_dates')
                        .insert({ class_id: classId, date: newDateStr, teacher_partner: null });
                    if (insertError) {
                        alert('Tarih eklenirken hata: ' + insertError.message);
                    }
                }
            }
        }

        modal.style.display = 'none';
        await loadClasses();
        renderClassesView();
        cleanup();
    };

    const cancelHandler = () => {
        modal.style.display = 'none';
        cleanup();
    };

    const cleanup = () => {
        saveBtn.removeEventListener('click', saveHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
    };

    saveBtn.addEventListener('click', saveHandler);
    cancelBtn.addEventListener('click', cancelHandler);
    const keyHandler = (e) => {
        if (e.key === 'Enter') saveHandler();
    };
    nameInput.addEventListener('keypress', keyHandler);
    dateInput.addEventListener('keypress', keyHandler);
}

async function deleteClass(classId) {
    openConfirmModal('Sınıf silinecek. Tüm öğrenciler, yoklamalar ve videolar da silinir. Emin misiniz?', async () => {
        const { error } = await supabase.from('classes').delete().eq('id', classId);
        if (error) alert('Hata: ' + error.message);
        else await loadClasses();
        renderClassesView();
    });
}

async function showWeeklyStats() {
    const { data: allClasses } = await supabase.from('classes').select('id, name').eq('school_id', currentSchoolId);
    if (!allClasses) return;
    const classLastDate = {};
    for (const cls of allClasses) {
        const { data: dates } = await supabase.from('course_dates').select('date').eq('class_id', cls.id).order('date', { ascending: false }).limit(1);
        if (dates && dates.length) classLastDate[cls.id] = dates[0].date;
    }
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let html = `<div class="view"><div class="back-link" id="statsBackBtn">← Geri</div><div class="main-title">Haftalık Program</div><table class="stats-table"><thead><tr>${days.map(d => `<th>${d}</th>`).join('')}</table></thead><tbody><tr>`;
    for (let i = 0; i < 7; i++) {
        let cell = '</td>';
        for (const cls of allClasses) {
            const lastDateStr = classLastDate[cls.id];
            if (lastDateStr) {
                const d = new Date(lastDateStr);
                let dayIndex = d.getDay() === 0 ? 6 : d.getDay() - 1;
                if (dayIndex === i) {
                    cell += `<div class="class-item-link" data-class-id="${cls.id}">${escapeHtml(cls.name)}</div>`;
                }
            }
        }
        cell += '</td>';
        html += cell;
    }
    html += `</tr></tbody></table><div id="chartSection" style="margin-top:20px; border:1px solid var(--border); border-radius:14px; background: var(--card-bg);"><div id="chartTitle" style="text-align:center; padding:15px; color:var(--accent);">Bir sınıfa tıkla, katılım grafiğini gör</div><div id="chartContainer" class="chart-container"></div></div></div>`;
    const container = document.getElementById('dynamicView');
    container.innerHTML = html;
    document.getElementById('statsBackBtn').onclick = () => showClassesView(currentSchoolId, currentSchoolName);
    document.querySelectorAll('.class-item-link').forEach(el => {
        el.addEventListener('click', async () => {
            const classId = parseInt(el.dataset.classId);
            await drawChartForClass(classId);
        });
    });
    refreshIcons();
}

async function drawChartForClass(classId) {
    const { data: dates } = await supabase.from('course_dates').select('id, date').eq('class_id', classId).order('date');
    if (!dates || dates.length === 0) return;
    const { data: students } = await supabase.from('students').select('id').eq('class_id', classId);
    const studentIds = students.map(s => s.id);
    const attendanceCounts = [];
    for (const date of dates) {
        const { data: atts } = await supabase.from('attendance').select('status').eq('course_date_id', date.id).in('student_id', studentIds);
        let count = 0;
        if (atts) count = atts.filter(a => a.status === '+' || a.status === '-').length;
        attendanceCounts.push({ date: date.date, count });
    }
    const chartContainer = document.getElementById('chartContainer');
    const chartTitle = document.getElementById('chartTitle');
    const cls = await supabase.from('classes').select('name').eq('id', classId).single();
    chartTitle.innerHTML = `<strong>${cls.data.name}</strong> - Katılım Sayıları`;
    chartContainer.innerHTML = '';
    attendanceCounts.forEach(item => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.alignItems = 'center';
        div.innerHTML = `<div class="bar-label-top">${item.count}</div><div class="bar" style="height:${item.count * 15 + 5}px"></div><div class="bar-label-bottom">${formatDate(item.date)}</div>`;
        chartContainer.appendChild(div);
    });
}