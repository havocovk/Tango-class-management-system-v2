import { supabase } from './supabaseClient.js';
import { refreshIcons, formatDate, openConfirmModal, isoToDisplayDate, escapeHtml, showToast } from './utils.js';
import { navigateTo } from './router.js';
import { appState } from './state.js';
import { cacheGet, cacheSet } from './offlineStore.js';
import { t } from './i18n.js';

export async function showClassesView(schoolId, schoolName) {
    appState.currentSchoolId = schoolId;
    appState.currentSchoolName = schoolName;
    await loadClasses();
    renderClassesView();
}

async function loadClasses() {
    // ADIM 7.2 — Çevrimiçiyken Supabase'den çek + çevrimdışı için kaydet.
    // Çevrimdışıyken bu okula ait en son sınıf listesini cache'ten oku.
    const cacheKey = `classes_${appState.currentSchoolId}`;
    if (navigator.onLine) {
        const { data, error } = await supabase.from('classes').select('*').eq('school_id', appState.currentSchoolId).order('id');
        if (error) {
            console.error(error);
            appState.classesList = (await cacheGet(cacheKey)) || [];
        } else {
            appState.classesList = data;
            await cacheSet(cacheKey, data);
        }
    } else {
        appState.classesList = (await cacheGet(cacheKey)) || [];
    }
}

function renderClassesView() {
    const container = document.getElementById('dynamicView');
    container.innerHTML = `
        <div class="view">
            <div class="back-link" id="backToSchoolsBtn">${escapeHtml(t('nav.backToSchools'))}</div>
            <div class="main-title">${escapeHtml(t('nav.appTitle'))}</div>
            <div class="sub-header">${escapeHtml(t('classes.header', { school: appState.currentSchoolName }))}</div>
            <div id="classesListContainer"></div>
            <div class="nav-buttons">
                <button id="newClassBtn" class="btn-success"><i data-lucide="plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${escapeHtml(t('classes.newClass'))}</button>
                <button id="weeklyStatsBtn" class="btn-info"><i data-lucide="bar-chart-2" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${escapeHtml(t('classes.weeklyStats'))}</button>
            </div>
            <div class="nav-buttons" style="margin-top:10px;">
                <button id="toggleArchivedClassesBtn" class="btn-secondary"><i data-lucide="archive" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${appState.showArchivedClasses ? 'Arşivi Gizle' : 'Arşivi Göster'}</button>
            </div>
        </div>
    `;
    document.getElementById('backToSchoolsBtn').onclick = () => {
        navigateTo('schools');
    };
    const listDiv = document.getElementById('classesListContainer');
    listDiv.innerHTML = '';

    // ADIM 5.1 — Arşiv filtresi: showArchivedClasses kapalıyken
    // yalnızca arşivlenmemiş sınıfları göster.
    const visibleClasses = appState.classesList.filter(cls =>
        appState.showArchivedClasses ? true : !cls.is_archived
    );

    if (visibleClasses.length === 0) {
        listDiv.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:20px;">${escapeHtml(t('classes.empty'))}</div>`;
    } else {
        visibleClasses.forEach(cls => {
            const card = document.createElement('div');
            card.className = 'class-card';
            if (cls.is_archived) card.style.opacity = '0.5';
            const archiveIcon = cls.is_archived ? 'archive-restore' : 'archive';
            card.innerHTML = `
                <div style="flex:1; cursor:pointer; font-weight:600;" data-id="${cls.id}">${escapeHtml(cls.name)}${cls.is_archived ? ' <span style="font-size:11px;color:var(--text-dim);">(arşiv)</span>' : ''}</div>
                <div style="display:flex; gap:15px;">
                    <span class="btn-icon-edit" data-id="${cls.id}" data-name="${escapeHtml(cls.name)}"><i data-lucide="pencil" size="20"></i></span>
                    <span class="btn-icon-archive" data-id="${cls.id}" style="color:var(--accent); cursor:pointer; display:inline-flex;"><i data-lucide="${archiveIcon}" size="20"></i></span>
                    <span class="btn-icon-delete" data-id="${cls.id}"><i data-lucide="trash-2" size="20"></i></span>
                </div>
            `;
            card.querySelector('[style*="flex:1"]').addEventListener('click', () => navigateTo('attendance', { classId: cls.id, className: cls.name }));
            card.querySelector('.btn-icon-edit').addEventListener('click', (e) => {
                e.stopPropagation();
                editClass(cls.id, cls.name);
            });
            card.querySelector('.btn-icon-archive').addEventListener('click', (e) => {
                e.stopPropagation();
                archiveClass(cls.id, !cls.is_archived);
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
    // Haftalık İstatistikler — router üzerinden 'stats' ekranına git.
    // Router üzerinden gitmek, dil değişiminde reloadCurrentView'ın bu
    // ekranı doğru şekilde yeniden çizebilmesini sağlar.
    // ---------------------------------------------------------------
    document.getElementById('weeklyStatsBtn').onclick = () => {
        navigateTo('stats');
    };

    // ADIM 5.1 — Arşivi Göster/Gizle
    document.getElementById('toggleArchivedClassesBtn').onclick = () => {
        appState.showArchivedClasses = !appState.showArchivedClasses;
        renderClassesView();
    };

    refreshIcons();
}

// ---------------------------------------------------------------
// ADIM 5.1 — SINIFI ARŞİVLE / ARŞİVDEN ÇIKAR
// Silmez; yalnızca is_archived bayrağını değiştirir.
// ---------------------------------------------------------------
async function archiveClass(classId, makeArchived) {
    const { error } = await supabase
        .from('classes')
        .update({ is_archived: makeArchived })
        .eq('id', classId);
    if (error) {
        showToast('İşlem başarısız. Bağlantıyı kontrol edin.', 'error');
        return;
    }
    showToast(makeArchived ? 'Sınıf arşivlendi ✓' : 'Sınıf arşivden çıkarıldı ✓', 'success');

    // ADIM 5.1 — Sınıf arşivlendiğinde "arşivi göster" modunu kapat ki
    // sınıf listeden hemen gizlensin.
    if (makeArchived) {
        appState.showArchivedClasses = false;
    }

    await loadClasses();
    renderClassesView();
}

function openNewClassModal() {
    const modal = document.getElementById('newClassModal');
    const nameInput = document.getElementById('newClassName');
    const dateDisplay = document.getElementById('newClassDateDisplay');
    const hiddenDatePicker = document.getElementById('hiddenDatePicker');
    const calendarIcon = document.getElementById('calendarIconBtn');
    const confirmBtn = document.getElementById('newClassConfirmBtn');
    const cancelBtn = document.getElementById('newClassCancelBtn');
    const priceInput = document.getElementById('newClassPackagePrice');
    const weeksInput = document.getElementById('newClassPackageWeeks');

    const todayISO = new Date().toISOString().split('T')[0];
    const todayDisplay = isoToDisplayDate(todayISO);
    dateDisplay.value = todayDisplay;
    if (priceInput) priceInput.value = '';
    if (weeksInput) weeksInput.value = '';
    hiddenDatePicker.value = todayISO;

    nameInput.value = '';
    modal.style.display = 'flex';
    nameInput.focus();

    const openDatePicker = () => {
        if (hiddenDatePicker.showPicker) {
            hiddenDatePicker.showPicker();
        } else {
            alert(t('classes.browserUnsupported'));
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
            alert(t('classes.alertNoName'));
            return;
        }
        const duplicate = appState.classesList.some(c => c.name.trim().toLowerCase() === className.trim().toLowerCase());
        if (duplicate) { showToast('Bu isimde bir sınıf zaten mevcut.', 'warning'); return; }
        const selectedISO = hiddenDatePicker.value;
        if (!selectedISO) {
            alert(t('classes.alertNoDate'));
            return;
        }

        const packagePrice = priceInput && priceInput.value ? parseInt(priceInput.value) : null;
        const packageWeeks = weeksInput && weeksInput.value ? parseInt(weeksInput.value) : null;
        const { data: newClass, error: classError } = await supabase
            .from('classes')
            .insert({ school_id: appState.currentSchoolId, name: className, package_price: packagePrice, package_weeks: packageWeeks })
            .select()
            .single();

        if (classError) {
            alert(t('classes.alertAddFail', { msg: classError.message }));
            return;
        }

        const { error: dateError } = await supabase
            .from('course_dates')
            .insert({ class_id: newClass.id, date: selectedISO, teacher_partner: null });

        if (dateError) {
            console.error('Tarih eklenirken hata:', dateError);
            alert(t('classes.alertDateFail'));
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
    const priceInput = document.getElementById('editClassPackagePrice');
    const weeksInput = document.getElementById('editClassPackageWeeks');

    // Mevcut paket değerlerini göster
    const clsObj = appState.classesList.find(c => c.id === classId);
    if (priceInput) priceInput.value = (clsObj && clsObj.package_price) ? clsObj.package_price : '';
    if (weeksInput) weeksInput.value = (clsObj && clsObj.package_weeks) ? clsObj.package_weeks : '';

    nameInput.value = oldName;
    dateDisplay.value = '';
    hiddenDatePicker.value = '';

    modal.style.display = 'flex';
    nameInput.focus();

    const openDatePicker = () => {
        if (hiddenDatePicker.showPicker) {
            hiddenDatePicker.showPicker();
        } else {
            alert(t('classes.browserUnsupported'));
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

        // ADIM 5.2 — paket fiyatı ve hafta sayısını güncelle
        const updateData = {};
        if (newName && newName !== oldName) updateData.name = newName;
        if (priceInput) updateData.package_price = priceInput.value ? parseInt(priceInput.value) : null;
        if (weeksInput) updateData.package_weeks = weeksInput.value ? parseInt(weeksInput.value) : null;
        if (Object.keys(updateData).length > 0) {
            const { error } = await supabase.from('classes').update(updateData).eq('id', classId);
            if (error) alert(t('classes.editNameFail', { msg: error.message }));
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
                alert(t('classes.editDateMustBeAfter', { date: formatDate(lastDate.toISOString().split('T')[0]) }));
            } else {
                const { data: alreadyExists } = await supabase
                    .from('course_dates')
                    .select('id')
                    .eq('class_id', classId)
                    .eq('date', newDateISO)
                    .maybeSingle();

                if (alreadyExists) {
                    alert(t('classes.editDateExists'));
                } else {
                    const { error: insertError } = await supabase
                        .from('course_dates')
                        .insert({ class_id: classId, date: newDateISO, teacher_partner: null });
                    if (insertError) {
                        alert(t('classes.editDateInsertFail', { msg: insertError.message }));
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
    openConfirmModal(t('classes.deleteConfirm'), async () => {
        const { error } = await supabase.from('classes').delete().eq('id', classId);
        if (error) alert(t('classes.deleteFail', { msg: error.message }));
        else await loadClasses();
        renderClassesView();
    });
}