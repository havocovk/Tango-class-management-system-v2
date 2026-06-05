import { supabase } from './supabaseClient.js';
import { refreshIcons, formatDate, openConfirmModal, isoToDisplayDate, displayDateToISO } from './utils.js';
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
    document.getElementById('newClassBtn').onclick = () => openNewClassModal();
    document.getElementById('weeklyStatsBtn').onclick = () => showWeeklyStats();
    refreshIcons();
}

// ================= YENİ: Tek Modal ile Sınıf Oluşturma =================
function openNewClassModal() {
    const modal = document.getElementById('newClassModal');
    const nameInput = document.getElementById('newClassName');
    const dateDisplay = document.getElementById('newClassDateDisplay');
    const hiddenDatePicker = document.getElementById('hiddenDatePicker');
    const calendarIcon = document.getElementById('calendarIconBtn');
    const confirmBtn = document.getElementById('newClassConfirmBtn');
    const cancelBtn = document.getElementById('newClassCancelBtn');

    // Bugünün tarihini ayarla (GG.AA.YYYY)
    const todayISO = new Date().toISOString().split('T')[0];
    const todayDisplay = isoToDisplayDate(todayISO);
    dateDisplay.value = todayDisplay;
    hiddenDatePicker.value = todayISO;

    nameInput.value = '';
    modal.style.display = 'flex';
    nameInput.focus();

    // Takvim ikonuna tıklayınca gizli date picker'ı aç
    const openDatePicker = () => {
        if (hiddenDatePicker.showPicker) {
            hiddenDatePicker.showPicker();
        } else {
            alert('Tarayıcınız bu özelliği desteklemiyor. Lütfen manuel olarak girin.');
        }
    };
    calendarIcon.addEventListener('click', openDatePicker);

    // Tarih değiştiğinde görüntü alanını güncelle
    const onDateChange = () => {
        const isoVal = hiddenDatePicker.value;
        if (isoVal) {
            dateDisplay.value = isoToDisplayDate(isoVal);
        } else {
            // Eğer kullanıcı temizlerse bugünü geri koy
            const today = new Date().toISOString().split('T')[0];
            hiddenDatePicker.value = today;
            dateDisplay.value = isoToDisplayDate(today);
        }
    };
    hiddenDatePicker.addEventListener('change', onDateChange);

    const saveHandler = async () => {
        const className = nameInput.value.trim();
        if (!className) {
            alert('Lütfen bir sınıf adı giriniz.');
            return;
        }
        const selectedISO = hiddenDatePicker.value;
        if (!selectedISO) {
            alert('Lütfen geçerli bir başlangıç tarihi seçiniz.');
            return;
        }

        // 1. Sınıfı ekle
        const { data: newClass, error: classError } = await supabase
            .from('classes')
            .insert({ school_id: currentSchoolId, name: className })
            .select()
            .single();

        if (classError) {
            alert('Sınıf eklenemedi: ' + classError.message);
            return;
        }

        // 2. İlk ders tarihini ekle
        const { error: dateError } = await supabase
            .from('course_dates')
            .insert({ class_id: newClass.id, date: selectedISO, teacher_partner: null });

        if (dateError) {
            console.error('Tarih eklenirken hata:', dateError);
            alert('Sınıf oluşturuldu ancak başlangıç tarihi eklenirken hata oluştu. Lütfen manuel olarak hafta ekleyin.');
        }

        // 3. Modalı kapat ve listeyi yenile
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
        calendarIcon.removeEventListener('click', openDatePicker);
        hiddenDatePicker.removeEventListener('change', onDateChange);
        confirmBtn.removeEventListener('click', saveHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
    };

    confirmBtn.onclick = saveHandler;
    cancelBtn.onclick = cancelHandler;
}

// ================= MEVCUT FONKSİYONLAR (hiçbir değişiklik yok) =================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Sınıf düzenleme (mevcut, değişmedi)
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
    const keyHandler = (e) => { if (e.key === 'Enter') saveHandler(); };
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
    let html = `<div class="view"><div class="back-link" id="statsBackBtn">← Geri</div><div class="main-title">Haftalık Program</div><table class="stats-table"><thead><tr>${days.map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody><tr>`;
    for (let i = 0; i < 7; i++) {
        let cell = '<tr>';
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