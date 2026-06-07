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
    document.getElementById('weeklyStatsBtn').onclick = () => showWeeklyStats();
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

// ---------------------------------------------------------------
// ADIM 2.1 — N+1 SORUNU DÜZELTİLDİ
// ESKİ: Her sınıf için ayrı ayrı veritabanına gidip son tarihi soruyordu
//        10 sınıf = 10 gidiş-dönüş
// YENİ: Tek seferde tüm sınıfların tüm tarihlerini çekiyor
//        10 sınıf = 1 gidiş-dönüş, JavaScript içinde gruplama yapılıyor
// ---------------------------------------------------------------
async function showWeeklyStats() {
    const { data: allClasses } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', appState.currentSchoolId);

    if (!allClasses || allClasses.length === 0) {
        alert('Bu okulda henüz sınıf yok.');
        return;
    }

    // TÜM sınıfların TÜM ders tarihlerini TEK SORGUDA çek
    const classIds = allClasses.map(c => c.id);
    const { data: allDates } = await supabase
        .from('course_dates')
        .select('class_id, date')
        .in('class_id', classIds)
        .order('date', { ascending: true });

    // ---------------------------------------------------------------
    // ADIM 6.3 — TÜM HAFTA GÜNLERİNİ GÖSTER
    // ESKİ: Her sınıf için yalnızca son ders tarihinin günü alınıyordu.
    //        Pazartesi + Perşembe dersli bir sınıf yalnızca Perşembe'de görünüyordu.
    // YENİ: Tüm ders tarihlerindeki haftanın günleri bir Set içinde toplanıyor.
    //        Sınıf gerçekte hangi günlerde ders yapıyorsa hepsinde görünüyor.
    // ---------------------------------------------------------------

    // Her sınıf için benzersiz haftanın günlerini bul (Set: tekrar yok)
    const classDaySet = {}; // class_id → Set of dayIndex (Pzt=0 … Paz=6)
    if (allDates) {
        allDates.forEach(d => {
            const [year, month, day] = d.date.split('-').map(Number);
            const dateObj = new Date(year, month - 1, day);
            const dayIndex = dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1;
            if (!classDaySet[d.class_id]) classDaySet[d.class_id] = new Set();
            classDaySet[d.class_id].add(dayIndex);
        });
    }

    const days = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

    // 7 günlük hücre yapısı — her gün için o günde dersi olan sınıfların listesi
    let cells = Array(7).fill().map(() => []);

    for (const cls of allClasses) {
        const daySet = classDaySet[cls.id];
        if (daySet) {
            // Sınıfı ders yaptığı HER günün sütununa ekle
            daySet.forEach(dayIndex => {
                cells[dayIndex].push({ id: cls.id, name: cls.name });
            });
        }
    }

    // HTML oluştur
    let html = `
        <div class="view">
            <div class="back-link" id="statsBackBtn">← Geri</div>
            <div class="main-title">Haftalık Program</div>
            <table class="stats-table">
                <thead>
                    <tr>${days.map(d => `<th>${d}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    <tr>
    `;

    for (let i = 0; i < 7; i++) {
        let cellContent = '';
        const classList = cells[i];
        if (classList.length === 0) {
            cellContent = '<div style="min-height: 50px;">&nbsp;</div>';
        } else {
            let fontSizeClass = '';
            if (classList.length === 1) fontSizeClass = 'dynamic-font-size-1';
            else if (classList.length === 2) fontSizeClass = 'dynamic-font-size-2';
            else if (classList.length >= 3) fontSizeClass = 'dynamic-font-size-3';

            const itemsHtml = classList.map(cls => {
                let displayName = escapeHtml(cls.name);
                let firstPart = displayName;
                let secondPart = '';
                const spaceIndex = displayName.indexOf(' ');
                if (spaceIndex !== -1 && displayName.length > 12) {
                    firstPart = displayName.substring(0, spaceIndex);
                    secondPart = displayName.substring(spaceIndex + 1);
                } else if (displayName.length > 12) {
                    firstPart = displayName.substring(0, 8);
                    secondPart = displayName.substring(8);
                }

                const innerHtml = secondPart
                    ? `<div class="class-multi-line"><span>${firstPart}</span><span>${secondPart}</span></div>`
                    : `<div>${firstPart}</div>`;

                return `<span class="class-item-link ${fontSizeClass}" data-class-id="${cls.id}">${innerHtml}</span>`;
            }).join('');

            cellContent = `<div style="display:flex; flex-direction:column; gap:4px;">${itemsHtml}</div>`;
        }
        html += `<td>${cellContent}</td>`;
    }

    html += `
                    </tr>
                </tbody>
            </table>
            <div id="chartTitle" style="text-align:center; padding:12px 15px 4px; color:var(--accent); font-weight:700;">Bir sınıfa tıkla, katılım grafiğini gör</div>
            <div id="chartSection">
                <div id="chartContainer" class="chart-container" style="justify-content: center; align-items: center;">
                    <div style="color: var(--text-dim); text-align: center; padding: 40px 0;">Henüz bir sınıf seçilmedi.</div>
                </div>
            </div>
        </div>
    `;

    const container = document.getElementById('dynamicView');
    container.innerHTML = html;

    document.getElementById('statsBackBtn').onclick = () => showClassesView(appState.currentSchoolId, appState.currentSchoolName);

    document.querySelectorAll('.class-item-link').forEach(el => {
        el.addEventListener('click', async () => {
            const classId = parseInt(el.dataset.classId);
            await drawChartForClass(classId);
        });
    });

    refreshIcons();
}

async function deleteClass(classId) {
    openConfirmModal('Sınıf silinecek. Tüm öğrenciler, yoklamalar ve videolar da silinir. Emin misiniz?', async () => {
        const { error } = await supabase.from('classes').delete().eq('id', classId);
        if (error) alert('Hata: ' + error.message);
        else await loadClasses();
        renderClassesView();
    });
}

// ---------------------------------------------------------------
// ADIM 2.2 — GRAFİK N+1 SORUNU DÜZELTİLDİ
// ESKİ: Her hafta için ayrı ayrı yoklama sorgusu yapıyordu
//        20 hafta = 20 gidiş-dönüş
// YENİ: Tüm haftaların yoklamalarını tek sorguda çekiyor
//        20 hafta = 1 gidiş-dönüş, JavaScript içinde gruplama yapılıyor
// ---------------------------------------------------------------
async function drawChartForClass(classId) {
    const { data: cls } = await supabase.from('classes').select('name').eq('id', classId).single();
    if (!cls) return;

    const { data: dates } = await supabase
        .from('course_dates')
        .select('id, date')
        .eq('class_id', classId)
        .order('date');

    if (!dates || dates.length === 0) {
        document.getElementById('chartTitle').innerHTML = `<strong>${escapeHtml(cls.name)}</strong> - Ders tarihi yok`;
        const chartContainer = document.getElementById('chartContainer');
        chartContainer.innerHTML = '<div style="color: var(--text-dim); text-align: center;">Bu sınıf için henüz ders tarihi eklenmemiş.</div>';
        chartContainer.style.justifyContent = 'center';
        refreshIcons();
        return;
    }

    const { data: students } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', classId);

    const studentIds = (students || []).map(s => s.id);
    const dateIds = dates.map(d => d.id);

    // TÜM haftaların yoklamalarını TEK SORGUDA çek
    const { data: allAtts } = await supabase
        .from('attendance')
        .select('course_date_id, status')
        .in('course_date_id', dateIds)
        .in('student_id', studentIds);

    // Her haftanın katılım sayısını JavaScript içinde hesapla
    const countByDate = {};
    dateIds.forEach(id => { countByDate[id] = 0; });
    if (allAtts) {
        allAtts.forEach(a => {
            if (a.status === '+' || a.status === '-') {
                countByDate[a.course_date_id] = (countByDate[a.course_date_id] || 0) + 1;
            }
        });
    }

    const chartTitle = document.getElementById('chartTitle');
    chartTitle.innerHTML = `<strong>${escapeHtml(cls.name)}</strong> - Katılım Sayıları (ders haftaları)`;

    const chartContainer = document.getElementById('chartContainer');
    chartContainer.innerHTML = '';
    chartContainer.style.justifyContent = 'flex-start';
    chartContainer.style.alignItems = 'flex-end';

    dates.forEach(dateObj => {
        const count = countByDate[dateObj.id] || 0;
        const barHeight = Math.max(4, count * 8);
        const wrapper = document.createElement('div');
        wrapper.className = 'bar-wrapper';
        wrapper.innerHTML = `
            <div class="bar-label-top">${count}</div>
            <div class="bar-inner">
                <div class="bar" style="height: ${barHeight}px;"></div>
            </div>
            <div class="bar-label-bottom">${formatDate(dateObj.date)}</div>
        `;
        chartContainer.appendChild(wrapper);
    });

    refreshIcons();
}