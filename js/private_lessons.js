// ---------------------------------------------------------------
// private_lessons.js — ÖZEL DERSLER MODÜLÜ
// ADIM 6.1 + 6.2 + 6.3 + 6.4
// Liste, oluşturma modalı, detay sayfası, arşiv desteği
// Geçmiş tarihli dersler soluk renkte gösterilir
// ---------------------------------------------------------------

import { supabase }          from './supabaseClient.js';
import { refreshIcons, openConfirmModal, showToast, escapeHtml, formatDate } from './utils.js';
import { navigateTo }        from './router.js';
import { appState }          from './state.js';

// ---------------------------------------------------------------
// Yardımcı: TIME string'ini HH:MM formatına dönüştür
// Supabase "19:00:00" döndürebilir → "19:00" göster
// ---------------------------------------------------------------
function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
}

// ---------------------------------------------------------------
// Yardımcı: Bugünün tarihini YYYY-MM-DD formatında döndür
// ---------------------------------------------------------------
function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ---------------------------------------------------------------
// Modal'ı garantili bul — yoksa DOM'a ekle
// index.html'e bağımlılığı ortadan kaldırır
// ---------------------------------------------------------------
function ensureModal() {
    let modal = document.getElementById('privateLessonModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'privateLessonModal';
        modal.className = 'modal';
        modal.innerHTML = '<div class="modal-content"></div>';
        document.body.appendChild(modal);
    }
    return modal;
}

// ---------------------------------------------------------------
// GİRİŞ NOKTASI — router.js tarafından çağrılır (liste ekranı)
// ---------------------------------------------------------------
export async function loadPrivateLessons() {
    await fetchPrivateLessons();
    renderPrivateLessonsView();
}

// ---------------------------------------------------------------
// GİRİŞ NOKTASI — router.js tarafından çağrılır (detay ekranı)
// ---------------------------------------------------------------
export async function showPrivateLessonDetail(lessonId) {
    if (!appState.privateLessonsList) {
        await fetchPrivateLessons();
    }
    const lesson = (appState.privateLessonsList || []).find(l => l.id === lessonId);
    if (!lesson) {
        showToast('Ders bulunamadı.', 'error');
        await loadPrivateLessons();
        return;
    }
    renderDetailView(lesson);
}

// ---------------------------------------------------------------
// Supabase'den özel dersleri çek
// ---------------------------------------------------------------
async function fetchPrivateLessons() {
    const { data, error } = await supabase
        .from('private_lessons')
        .select('*')
        .order('lesson_date', { ascending: false });

    if (error) {
        showToast('Özel dersler yüklenemedi.', 'error');
        appState.privateLessonsList = [];
    } else {
        appState.privateLessonsList = data || [];
    }
}

// ---------------------------------------------------------------
// ADIM 6.1 — Özel ders listesini çiz
// ---------------------------------------------------------------
function renderPrivateLessonsView() {
    const container = document.getElementById('dynamicView');
    if (!container) return;

    const today    = todayISO();
    const all      = appState.privateLessonsList || [];
    const showArch = appState.showArchivedPrivate || false;
    const active   = all.filter(l => !l.is_archived);
    const archived = all.filter(l =>  l.is_archived);
    const displayed = showArch ? archived : active;

    let listHtml = '';
    if (displayed.length === 0) {
        listHtml = `<div style="text-align:center; color:var(--text-dim); padding:20px;">
            ${showArch ? 'Arşivlenmiş özel ders yok.' : 'Henüz özel ders eklenmemiş.'}
        </div>`;
    } else {
        displayed.forEach(l => {
            // ADIM 6.4 — Tarih geçmişse soluk göster
            const isPast   = l.lesson_date < today;
            const opacity  = (isPast || l.is_archived) ? 'opacity:0.5;' : '';
            const timeStr  = formatTime(l.lesson_time);
            const dateStr  = l.lesson_date ? formatDate(l.lesson_date) : '';
            const loc      = l.location ? escapeHtml(l.location) + ' · ' : '';
            const earned   = l.earned_amount ? l.earned_amount + ' ₺' : '';

            listHtml += `
            <div class="class-card" style="${opacity}" data-pl-id="${l.id}">
                <div style="flex:1; cursor:pointer;" data-pl-goto="${l.id}">
                    <div style="font-weight:700; font-size:15px; color:var(--text-main);">
                        ${escapeHtml(l.student_name)}
                    </div>
                    <div style="font-size:12px; color:var(--text-dim); margin-top:3px;">
                        ${loc}${dateStr}${timeStr ? ' · ' + timeStr : ''}${earned ? ' · ' + earned : ''}
                    </div>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <div class="pl-btn-edit" data-pl-id="${l.id}"
                        style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; min-width:44px; min-height:44px; color:var(--primary); position:relative; z-index:2;">
                        <i data-lucide="pencil" size="20" style="pointer-events:none;"></i>
                    </div>
                    <div class="pl-btn-archive" data-pl-id="${l.id}" data-pl-archived="${l.is_archived ? '1' : '0'}"
                        style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; min-width:44px; min-height:44px; color:var(--accent); position:relative; z-index:2;">
                        <i data-lucide="${l.is_archived ? 'archive-restore' : 'archive'}" size="20" style="pointer-events:none;"></i>
                    </div>
                    <div class="pl-btn-delete" data-pl-id="${l.id}"
                        style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; min-width:44px; min-height:44px; color:var(--danger); position:relative; z-index:2;">
                        <i data-lucide="trash-2" size="20" style="pointer-events:none;"></i>
                    </div>
                </div>
            </div>`;
        });
    }

    container.innerHTML = `
        <div class="view">
            <!-- Geri butonu ÜSTTE -->
            <span class="back-link" id="plBackBtn">
                <i data-lucide="arrow-left" size="16" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>Ana Menü
            </span>

            <div class="main-title">
                <i data-lucide="user-round" size="22" style="display:inline-block;vertical-align:middle;margin-right:6px;"></i>Özel Dersler
            </div>

            <div class="nav-buttons">
                <button class="btn-success" id="plAddBtn">
                    <i data-lucide="plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>Özel Ders Ekle
                </button>
                <button class="btn-secondary" id="plArchiveToggleBtn">
                    <i data-lucide="${showArch ? 'list' : 'archive'}" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${showArch ? 'Aktif Dersler' : 'Arşiv'}
                </button>
            </div>

            <div id="plList">${listHtml}</div>
        </div>
    `;

    // Geri butonu
    document.getElementById('plBackBtn').onclick = () => navigateTo('mainMenu');

    // Ekle butonu
    document.getElementById('plAddBtn').onclick = () => openLessonModal(null);

    // Arşiv toggle
    document.getElementById('plArchiveToggleBtn').onclick = () => {
        appState.showArchivedPrivate = !showArch;
        renderPrivateLessonsView();
    };

    // Kart tıklama — detay sayfasına git
    container.querySelectorAll('[data-pl-goto]').forEach(el => {
        el.addEventListener('click', () => {
            const id = parseInt(el.dataset.plGoto);
            navigateTo('privateLessonDetail', { lessonId: id });
        });
    });

    // Düzenle butonu
    container.querySelectorAll('.pl-btn-edit').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(el.dataset.plId);
            const lesson = (appState.privateLessonsList || []).find(l => l.id === id);
            if (lesson) openLessonModal(lesson);
        });
    });

    // Arşivle / arşivden çıkar
    container.querySelectorAll('.pl-btn-archive').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const id         = parseInt(el.dataset.plId);
            const isArchived = el.dataset.plArchived === '1';
            archiveLesson(id, !isArchived);
        });
    });

    // Sil
    container.querySelectorAll('.pl-btn-delete').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(el.dataset.plId);
            deleteLesson(id);
        });
    });

    refreshIcons();
}

// ---------------------------------------------------------------
// ADIM 6.3 — Detay sayfasını çiz
// ---------------------------------------------------------------
function renderDetailView(lesson) {
    const container = document.getElementById('dynamicView');
    if (!container) return;

    const today   = todayISO();
    const isPast  = lesson.lesson_date < today;
    const dateStr = lesson.lesson_date ? formatDate(lesson.lesson_date) : '';
    const timeStr = formatTime(lesson.lesson_time);

    container.innerHTML = `
        <div class="view">
            <!-- Geri butonu ÜSTTE -->
            <span class="back-link" id="plDetailBackBtn">
                <i data-lucide="arrow-left" size="16" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>Özel Dersler
            </span>

            <div class="main-title" style="margin-top:10px;">
                <i data-lucide="user-round" size="20" style="display:inline-block;vertical-align:middle;margin-right:6px;"></i>${escapeHtml(lesson.student_name)}
            </div>
            <div style="text-align:center; color:var(--text-dim); font-size:13px; margin-top:-12px; margin-bottom:20px;">
                ${dateStr}${timeStr ? ' · ' + timeStr : ''}${lesson.location ? ' · ' + escapeHtml(lesson.location) : ''}
                ${isPast ? ' <span style="color:var(--accent); font-size:11px;">(Geçmiş)</span>' : ''}
            </div>

            <!-- Video URL -->
            <div class="sub-header">Video</div>
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:16px;">
                <input type="text" id="plDetailVideo" placeholder="Video URL (YouTube, Drive vb.)"
                    style="flex:1;"
                    value="${escapeHtml(lesson.video_url || '')}">
                <button class="btn-secondary" id="plDetailVideoSaveBtn" style="flex:0 0 auto; min-width:70px;">Kaydet</button>
            </div>

            <!-- Partner -->
            <div class="sub-header">Partner</div>
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:16px;">
                <input type="text" id="plDetailPartner" placeholder="Partner adı"
                    style="flex:1;"
                    value="${escapeHtml(lesson.partner_name || '')}">
                <button class="btn-secondary" id="plDetailPartnerSaveBtn" style="flex:0 0 auto; min-width:70px;">Kaydet</button>
            </div>

            <!-- Alınan Ücret -->
            <div class="sub-header">Alınan Ücret</div>
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:16px;">
                <input type="number" id="plDetailEarned" placeholder="0"
                    style="flex:1;"
                    value="${lesson.earned_amount || ''}">
                <span style="color:var(--text-dim); font-size:14px;">₺</span>
                <button class="btn-secondary" id="plDetailEarnedSaveBtn" style="flex:0 0 auto; min-width:70px;">Kaydet</button>
            </div>

            <!-- Ders Notu -->
            <div class="sub-header">Ders Notu</div>
            <textarea id="plDetailNote" rows="4"
                style="width:100%; background:#1e293b; color:white; border:1px solid var(--border); border-radius:10px; padding:10px; font-size:13px; resize:vertical; margin-bottom:8px;"
                placeholder="Ders notları, figürler, gözlemler...">${escapeHtml(lesson.note || '')}</textarea>
            <button class="btn-secondary" id="plDetailNoteSaveBtn" style="width:100%; margin-bottom:24px;">Notu Kaydet</button>

            <!-- Sil -->
            <button class="btn-danger" id="plDetailDeleteBtn" style="width:100%;">
                <i data-lucide="trash-2" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>Bu Dersi Sil
            </button>
        </div>
    `;

    // Geri
    document.getElementById('plDetailBackBtn').onclick = () => {
        appState.privateLessonsList = null;
        navigateTo('privateLessons');
    };

    // Video kaydet
    document.getElementById('plDetailVideoSaveBtn').onclick = async () => {
        const val = document.getElementById('plDetailVideo').value.trim() || null;
        await updateLessonField(lesson.id, { video_url: val }, 'Video kaydedildi ✓');
    };

    // Partner kaydet
    document.getElementById('plDetailPartnerSaveBtn').onclick = async () => {
        const val = document.getElementById('plDetailPartner').value.trim() || null;
        await updateLessonField(lesson.id, { partner_name: val }, 'Partner kaydedildi ✓');
    };

    // Ücret kaydet
    document.getElementById('plDetailEarnedSaveBtn').onclick = async () => {
        const raw = document.getElementById('plDetailEarned').value;
        const val = raw !== '' ? parseFloat(raw) : 0;
        await updateLessonField(lesson.id, { earned_amount: val }, 'Ücret kaydedildi ✓');
    };

    // Not kaydet
    document.getElementById('plDetailNoteSaveBtn').onclick = async () => {
        const val = document.getElementById('plDetailNote').value.trim() || null;
        await updateLessonField(lesson.id, { note: val }, 'Not kaydedildi ✓');
    };

    // Sil
    document.getElementById('plDetailDeleteBtn').onclick = () => {
        openConfirmModal('Bu özel dersi silmek istediğinizden emin misiniz?', async () => {
            const { error } = await supabase.from('private_lessons').delete().eq('id', lesson.id);
            if (error) { showToast('Silme başarısız.', 'error'); return; }
            showToast('Ders silindi ✓', 'success');
            appState.privateLessonsList = null;
            navigateTo('privateLessons');
        });
    };

    refreshIcons();
}

// ---------------------------------------------------------------
// ADIM 6.2 — Oluşturma / Düzenleme Modalı
// Modal yoksa DOM'a dinamik olarak eklenir (ensureModal)
// ---------------------------------------------------------------
function openLessonModal(existing) {
    const modal  = ensureModal();
    const isEdit = !!existing;
    const title  = isEdit ? 'Özel Dersi Düzenle' : 'Yeni Özel Ders Ekle';

    modal.querySelector('.modal-content').innerHTML = `
        <h3 style="margin-top:0; color:var(--primary); text-align:left;">${title}</h3>

        <input type="text" id="plModalName" placeholder="Öğrenci / kişi adı *" autocomplete="off"
            style="width:100%; margin-bottom:12px;"
            value="${escapeHtml(existing ? existing.student_name || '' : '')}">

        <input type="text" id="plModalLocation" placeholder="Lokasyon (opsiyonel)" autocomplete="off"
            style="width:100%; margin-bottom:12px;"
            value="${escapeHtml(existing ? existing.location || '' : '')}">

        <!-- Tarih seçici -->
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <input type="text" id="plModalDateDisplay" readonly placeholder="Tarih seçin *"
                style="flex:1; background:#1e293b; color:white; cursor:pointer;"
                value="${existing && existing.lesson_date ? formatDate(existing.lesson_date) : ''}">
            <span id="plModalCalIcon" style="cursor:pointer; color:var(--primary); display:inline-flex; align-items:center; min-width:36px; min-height:36px; justify-content:center;">
                <i data-lucide="calendar" size="22"></i>
            </span>
        </div>
        <input type="date" id="plModalHiddenDate" style="display:none;"
            value="${existing && existing.lesson_date ? existing.lesson_date : ''}">

        <!-- Saat seçici -->
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <input type="text" id="plModalTimeDisplay" readonly placeholder="Saat seçin (opsiyonel)"
                style="flex:1; background:#1e293b; color:white; cursor:pointer;"
                value="${existing && existing.lesson_time ? formatTime(existing.lesson_time) : ''}">
            <span id="plModalTimeIcon" style="cursor:pointer; color:var(--primary); display:inline-flex; align-items:center; min-width:36px; min-height:36px; justify-content:center;">
                <i data-lucide="clock" size="22"></i>
            </span>
        </div>
        <input type="time" id="plModalHiddenTime" style="display:none;"
            value="${existing && existing.lesson_time ? formatTime(existing.lesson_time) : ''}">

        <!-- Ücret -->
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:20px;">
            <input type="number" id="plModalEarned" placeholder="Alınan ücret (opsiyonel)"
                style="flex:1;"
                value="${existing && existing.earned_amount ? existing.earned_amount : ''}">
            <span style="color:var(--text-dim); font-size:14px; flex-shrink:0;">₺</span>
        </div>

        <div style="display:flex; gap:10px;">
            <button class="btn-success" id="plModalSaveBtn">Kaydet</button>
            <button class="btn-secondary" id="plModalCancelBtn">İptal</button>
        </div>
    `;

    // Takvim ikonu → gizli date input'u açar
    const hiddenDate = document.getElementById('plModalHiddenDate');
    const dispDate   = document.getElementById('plModalDateDisplay');
    document.getElementById('plModalCalIcon').onclick = () => {
        if (hiddenDate.showPicker) hiddenDate.showPicker();
        else hiddenDate.click();
    };
    hiddenDate.onchange = () => {
        dispDate.value = hiddenDate.value ? formatDate(hiddenDate.value) : '';
    };
    dispDate.onclick = () => {
        if (hiddenDate.showPicker) hiddenDate.showPicker();
        else hiddenDate.click();
    };

    // Saat ikonu → gizli time input'u açar
    const hiddenTime = document.getElementById('plModalHiddenTime');
    const dispTime   = document.getElementById('plModalTimeDisplay');
    document.getElementById('plModalTimeIcon').onclick = () => {
        if (hiddenTime.showPicker) hiddenTime.showPicker();
        else hiddenTime.click();
    };
    hiddenTime.onchange = () => {
        dispTime.value = hiddenTime.value ? hiddenTime.value : '';
    };
    dispTime.onclick = () => {
        if (hiddenTime.showPicker) hiddenTime.showPicker();
        else hiddenTime.click();
    };

    // Kaydet
    document.getElementById('plModalSaveBtn').onclick = () =>
        isEdit ? updateLesson(existing.id, modal) : createLesson(modal);

    // İptal
    document.getElementById('plModalCancelBtn').onclick = () => {
        modal.style.display = 'none';
    };

    modal.style.display = 'flex';
    document.getElementById('plModalName').focus();
    refreshIcons();
}

// ---------------------------------------------------------------
// Yeni özel ders oluştur
// ---------------------------------------------------------------
async function createLesson(modal) {
    const student_name  = document.getElementById('plModalName').value.trim();
    if (!student_name) { showToast('Öğrenci adı boş olamaz.', 'warning'); return; }

    const lesson_date = document.getElementById('plModalHiddenDate').value || null;
    if (!lesson_date)  { showToast('Tarih seçiniz.', 'warning'); return; }

    const lesson_time   = document.getElementById('plModalHiddenTime').value || null;
    const location      = document.getElementById('plModalLocation').value.trim() || null;
    const earned_raw    = document.getElementById('plModalEarned').value;
    const earned_amount = earned_raw !== '' ? parseFloat(earned_raw) : 0;

    const { error } = await supabase.from('private_lessons').insert({
        student_name, lesson_date, lesson_time, location, earned_amount
    });

    if (error) { showToast('Ders oluşturulamadı: ' + error.message, 'error'); return; }

    showToast('Özel ders eklendi ✓', 'success');
    modal.style.display = 'none';
    appState.privateLessonsList = null;
    await fetchPrivateLessons();
    renderPrivateLessonsView();
}

// ---------------------------------------------------------------
// Mevcut özel dersi güncelle
// ---------------------------------------------------------------
async function updateLesson(lessonId, modal) {
    const student_name  = document.getElementById('plModalName').value.trim();
    if (!student_name) { showToast('Öğrenci adı boş olamaz.', 'warning'); return; }

    const lesson_date = document.getElementById('plModalHiddenDate').value || null;
    if (!lesson_date)  { showToast('Tarih seçiniz.', 'warning'); return; }

    const lesson_time   = document.getElementById('plModalHiddenTime').value || null;
    const location      = document.getElementById('plModalLocation').value.trim() || null;
    const earned_raw    = document.getElementById('plModalEarned').value;
    const earned_amount = earned_raw !== '' ? parseFloat(earned_raw) : 0;

    const { error } = await supabase.from('private_lessons').update({
        student_name, lesson_date, lesson_time, location, earned_amount
    }).eq('id', lessonId);

    if (error) { showToast('Güncelleme başarısız: ' + error.message, 'error'); return; }

    showToast('Ders güncellendi ✓', 'success');
    modal.style.display = 'none';
    appState.privateLessonsList = null;
    await fetchPrivateLessons();
    renderPrivateLessonsView();
}

// ---------------------------------------------------------------
// Detay sayfasında tek alan güncelle
// ---------------------------------------------------------------
async function updateLessonField(lessonId, fields, successMsg) {
    const { error } = await supabase.from('private_lessons')
        .update(fields).eq('id', lessonId);
    if (error) { showToast('Kayıt başarısız: ' + error.message, 'error'); return; }
    showToast(successMsg, 'success');
    const idx = (appState.privateLessonsList || []).findIndex(l => l.id === lessonId);
    if (idx !== -1) Object.assign(appState.privateLessonsList[idx], fields);
}

// ---------------------------------------------------------------
// Arşivle / Arşivden çıkar
// ---------------------------------------------------------------
async function archiveLesson(lessonId, makeArchived) {
    const { error } = await supabase.from('private_lessons')
        .update({ is_archived: makeArchived }).eq('id', lessonId);
    if (error) { showToast('İşlem başarısız.', 'error'); return; }
    showToast(makeArchived ? 'Ders arşivlendi ✓' : 'Ders arşivden çıkarıldı ✓', 'success');
    if (makeArchived) appState.showArchivedPrivate = false;
    appState.privateLessonsList = null;
    await fetchPrivateLessons();
    renderPrivateLessonsView();
}

// ---------------------------------------------------------------
// Sil
// ---------------------------------------------------------------
async function deleteLesson(lessonId) {
    openConfirmModal('Bu özel dersi silmek istediğinizden emin misiniz?', async () => {
        const { error } = await supabase.from('private_lessons').delete().eq('id', lessonId);
        if (error) { showToast('Silme başarısız.', 'error'); return; }
        showToast('Ders silindi ✓', 'success');
        appState.privateLessonsList = null;
        await fetchPrivateLessons();
        renderPrivateLessonsView();
    });
}