import { supabase } from './supabaseClient.js';
import { refreshIcons, formatDate, openConfirmModal, isoToDisplayDate, escapeHtml } from './utils.js';
import { navigateTo } from './router.js';
import { appState } from './state.js';

export async function showClassesView(schoolId, schoolName) {
    appState.currentSchoolId = schoolId;
    appState.currentSchoolName = schoolName;
    await loadClasses();
    renderClassesView();
}

async function loadClasses() {
    const { data, error } = await supabase.from('classes').select('*').eq('school_id', appState.currentSchoolId).order('id');
    if (error) console.error(error);
    else appState.classesList = data;
}

function renderClassesView() {
    const container = document.getElementById('dynamicView');
    container.innerHTML = `
        <div class="view">
            <div class="back-link" id="backToSchoolsBtn">← Okullar</div>
            <div class="main-title">Tango Class Management System</div>
            <div class="sub-header">Sınıf Listesi - ${escapeHtml(appState.currentSchoolName)}</div>
            <div id="classesListContainer"></div>
            <div class="nav-buttons">
                <button id="newClassBtn" class="btn-success">➕ Yeni Sınıf</button>
                <button id="weeklyStatsBtn" class="btn-info">📊 Haftalık İstatistikler</button>
            </div>
        </div>
    `;
    document.getElementById('backToSchoolsBtn').onclick = () => {
        navigateTo('schools');
    };
    const listDiv = document.getElementById('classesListContainer');
    listDiv.innerHTML = '';
    if (appState.classesList.length === 0) {
        listDiv.innerHTML = '<div style="text-align:center; color:var(--text-dim); padding:20px;">Henüz sınıf yok. Yeni sınıf ekleyin.</div>';
    } else {
        appState.classesList.forEach(cls => {
            const card = document.createElement('div');
            card.className = 'class-card';
            card.innerHTML = `
                <div style="flex:1; cursor:pointer; font-weight:600;" data-id="${cls.id}">${escapeHtml(cls.name)}</div>
                <div style="display:flex; gap:15px;">
                    <span class="btn-icon-edit" data-id="${cls.id}" data-name="${escapeHtml(cls.name)}"><i data-lucide="pencil" size="20"></i></span>
                    <span class="btn-icon-delete" data-id="${cls.id}"><i data-lucide="trash-2" size="20"></i></span>
                </div>
            `;
            card.querySelector('[style*="flex:1"]').addEventListener('click', () => navigateTo('attendance', { classId: cls.id, className: cls.name }));
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

    // ---------------------------------------------------------------
    // Haftalık İstatistikler butonu — classStats.js dinamik import ile
    // yükleniyor. classes.js, classStats.js'i statik olarak import
    // etmiyor; böylece aralarında döngüsel bağımlılık oluşmuyor.
    // Bu pattern router.js'in kullandığı tekniğin aynısıdır.
    // ---------------------------------------------------------------
    document.getElementById('weeklyStatsBtn').onclick = async () => {
        const module = await import('./classStats.js');
        await module.showWeeklyStats();
    };

    refreshIcons();
}

function openNewClassModal() {
    const modal = document.getElementById('newClassModal');
    const nameInput = document.getElementById('newClassName');
    const dateDisplay = document.getElementById('newClassDateDisplay');
    const hiddenDatePicker = document.getElementById('hiddenDatePicker');
    const calendarIcon = document.getElementById('calendarIconBtn');
    const confirmBtn = document.getElementById('newClassConfirmBtn');
    const cancelBtn = document.getElementById('newClassCancelBtn');

    const todayISO = new Date().toISOString().split('T')[0];
    const todayDisplay = isoToDisplayDate(todayISO);
    dateDisplay.value = todayDisplay;
    hiddenDatePicker.value = todayISO;

    nameInput.value = '';
    modal.style.display = 'flex';
    nameInput.focus();

    const openDatePicker = () => {
        if (hiddenDatePicker.showPicker) {
            hiddenDatePicker.showPicker();
        } else {
            alert('Tarayıcınız bu özelliği desteklemiyor.');
        }
    };
    calendarIcon.addEventListener('click', openDatePicker);

    const onDateChange = () => {
        const isoVal = hiddenDatePicker.value;
        if (isoVal) {
            dateDisplay.value = isoToDisplayDate(isoVal);
        } else {
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

        const { data: newClass, error: classError } = await supabase
            .from('classes')
            .insert({ school_id: appState.currentSchoolId, name: className })
            .select()
            .single();

        if (classError) {
            alert('Sınıf eklenemedi: ' + classError.message);
            return;
        }

        const { error: dateError } = await supabase
            .from('course_dates')
            .insert({ class_id: newClass.id, date: selectedISO, teacher_partner: null });

        if (dateError) {
            console.error('Tarih eklenirken hata:', dateError);
            alert('Sınıf oluşturuldu ancak başlangıç tarihi eklenirken hata oluştu.');
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
        calendarIcon.removeEventListener('click', openDatePicker);
        hiddenDatePicker.removeEventListener('change', onDateChange);
        confirmBtn.removeEventListener('click', saveHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
    };

    confirmBtn.onclick = saveHandler;
    cancelBtn.onclick = cancelHandler;
}

async function editClass(classId, oldName) {
    const modal = document.getElementById('editClassModal');
    const nameInput = document.getElementById('editClassNameInput');
    const dateDisplay = document.getElementById('editClassNewDateDisplay');
    const hiddenDatePicker = document.getElementById('hiddenEditClassDatePicker');
    const calendarIcon = document.getElementById('editClassCalendarIcon');
    const saveBtn = document.getElementById('editClassSaveBtn');
    const cancelBtn = document.getElementById('editClassCancelBtn');

    nameInput.value = oldName;
    dateDisplay.value = '';
    hiddenDatePicker.value = '';

    modal.style.display = 'flex';
    nameInput.focus();

    const openDatePicker = () => {
        if (hiddenDatePicker.showPicker) {
            hiddenDatePicker.showPicker();
        } else {
            alert('Tarayıcınız bu özelliği desteklemiyor.');
        }
    };
    calendarIcon.addEventListener('click', openDatePicker);

    const onDateChange = () => {
        const isoVal = hiddenDatePicker.value;
        if (isoVal) {
            dateDisplay.value = isoToDisplayDate(isoVal);
        } else {
            dateDisplay.value = '';
        }
    };
    hiddenDatePicker.addEventListener('change', onDateChange);

    const saveHandler = async () => {
        const newName = nameInput.value.trim();
        const newDateISO = hiddenDatePicker.value;

        if (newName && newName !== oldName) {
            const { error } = await supabase.from('classes').update({ name: newName }).eq('id', classId);
            if (error) alert('Ad güncellenemedi: ' + error.message);
        }

        if (newDateISO) {
            const { data: existingDates } = await supabase
                .from('course_dates')
                .select('date')
                .eq('class_id', classId)
                .order('date', { ascending: false });

            let lastDate = null;
            if (existingDates && existingDates.length > 0) {
                lastDate = new Date(existingDates[0].date);
            }
            const newDate = new Date(newDateISO);

            if (lastDate && newDate <= lastDate) {
                alert(`Yeni tarih, son ders tarihinden (${formatDate(lastDate.toISOString().split('T')[0])}) sonra olmalıdır. Eklenmedi.`);
            } else {
                const { data: alreadyExists } = await supabase
                    .from('course_dates')
                    .select('id')
                    .eq('class_id', classId)
                    .eq('date', newDateISO)
                    .maybeSingle();

                if (alreadyExists) {
                    alert('Bu tarih zaten mevcut. Eklenmedi.');
                } else {
                    const { error: insertError } = await supabase
                        .from('course_dates')
                        .insert({ class_id: classId, date: newDateISO, teacher_partner: null });
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
        calendarIcon.removeEventListener('click', openDatePicker);
        hiddenDatePicker.removeEventListener('change', onDateChange);
        saveBtn.removeEventListener('click', saveHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
    };

    saveBtn.onclick = saveHandler;
    cancelBtn.onclick = cancelHandler;
}

async function deleteClass(classId) {
    openConfirmModal('Sınıf silinecek. Tüm öğrenciler, yoklamalar ve videolar da silinir. Emin misiniz?', async () => {
        const { error } = await supabase.from('classes').delete().eq('id', classId);
        if (error) alert('Hata: ' + error.message);
        else await loadClasses();
        renderClassesView();
    });
}