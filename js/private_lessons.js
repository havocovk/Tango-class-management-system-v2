// ---------------------------------------------------------------
// private_lessons.js — ÖZEL DERSLER MODÜLÜ
// ADIM 6.1 + 6.2 + 6.3 + 6.4
// ---------------------------------------------------------------

import { supabase }          from './supabaseClient.js';
import { refreshIcons, openConfirmModal, showToast, escapeHtml, formatDate, openPromptModal } from './utils.js';
import { navigateTo }        from './router.js';
import { appState }          from './state.js';

// ---------------------------------------------------------------
// Para birimleri: TL önce, altında EUR ve USD, sonra diğerleri
// ---------------------------------------------------------------
const CURRENCIES = [
    { code: 'TRY', symbol: '₺', label: '₺ Türk Lirası' },
    { code: 'EUR', symbol: '€', label: '€ Euro' },
    { code: 'USD', symbol: '$', label: '$ Amerikan Doları' },
    { code: 'GBP', symbol: '£', label: '£ İngiliz Sterlini' },
    { code: 'RUB', symbol: '₽', label: '₽ Rus Rublesi' },
    { code: 'KZT', symbol: '₸', label: '₸ Kazak Tengesi' },
    { code: 'ARS', symbol: '$', label: '$ Arjantin Pesosu' },
    { code: 'BRL', symbol: 'R$', label: 'R$ Brezilya Reali' },
];

function getCurrencySymbol(code) {
    const c = CURRENCIES.find(c => c.code === code);
    return c ? c.symbol : code;
}

function currencySelectHtml(selectedCode) {
    const opts = CURRENCIES.map(c =>
        `<option value="${c.code}" ${c.code === selectedCode ? 'selected' : ''}>${escapeHtml(c.label)}</option>`
    ).join('');
    return `<select id="plModalCurrency"
        style="background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;flex:0 0 auto;min-width:60px;">
        ${opts}
    </select>`;
}

// ---------------------------------------------------------------
// Yardımcı: TIME string'ini HH:MM formatına dönüştür
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
// ---------------------------------------------------------------
function ensureModal(id) {
    let modal = document.getElementById(id);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = id;
        modal.className = 'modal';
        modal.innerHTML = '<div class="modal-content"></div>';
        document.body.appendChild(modal);
    }
    return modal;
}

// ---------------------------------------------------------------
// Platform tespiti — attendanceModals.js ile aynı mantık
// ---------------------------------------------------------------
function detectVideoPlatform(url) {
    if (!url) return { name: 'Diğer', color: '#94a3b8' };
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be'))
        return { name: 'YouTube', color: '#FF0000' };
    if (lower.includes('vimeo.com'))
        return { name: 'Vimeo', color: '#1AB7EA' };
    if (lower.includes('drive.google.com'))
        return { name: 'Google Drive', color: '#34A853' };
    return { name: 'Diğer', color: '#94a3b8' };
}

// ---------------------------------------------------------------
// GİRİŞ NOKTASI — liste ekranı
// ---------------------------------------------------------------
export async function loadPrivateLessons() {
    await fetchPrivateLessons();
    renderPrivateLessonsView();
}

// ---------------------------------------------------------------
// GİRİŞ NOKTASI — detay ekranı
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
// LİSTE EKRANI
// ---------------------------------------------------------------
function renderPrivateLessonsView() {
    const container = document.getElementById('dynamicView');
    if (!container) return;

    const today     = todayISO();
    const all       = appState.privateLessonsList || [];
    const showArch  = appState.showArchivedPrivate || false;
    const active    = all.filter(l => !l.is_archived);
    const archived  = all.filter(l =>  l.is_archived);
    const displayed = showArch ? archived : active;

    let listHtml = '';
    if (displayed.length === 0) {
        listHtml = `<div style="text-align:center; color:var(--text-dim); padding:20px;">
            ${showArch ? 'Arşivlenmiş özel ders yok.' : 'Henüz özel ders eklenmemiş.'}
        </div>`;
    } else {
        displayed.forEach(l => {
            const isPast   = l.lesson_date < today;
            const opacity  = (isPast || l.is_archived) ? 'opacity:0.5;' : '';
            const timeStr  = formatTime(l.lesson_time);
            const dateStr  = l.lesson_date ? formatDate(l.lesson_date) : '';
            const loc      = l.location ? escapeHtml(l.location) + ' · ' : '';
            const symbol   = l.currency ? getCurrencySymbol(l.currency) : '₺';
            const earned   = l.earned_amount ? l.earned_amount + ' ' + symbol : '';

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
                        style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;color:var(--primary);position:relative;z-index:2;">
                        <i data-lucide="pencil" size="20" style="pointer-events:none;"></i>
                    </div>
                    <div class="pl-btn-archive" data-pl-id="${l.id}" data-pl-archived="${l.is_archived ? '1' : '0'}"
                        style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;color:var(--accent);position:relative;z-index:2;">
                        <i data-lucide="${l.is_archived ? 'archive-restore' : 'archive'}" size="20" style="pointer-events:none;"></i>
                    </div>
                    <div class="pl-btn-delete" data-pl-id="${l.id}"
                        style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;color:var(--danger);position:relative;z-index:2;">
                        <i data-lucide="trash-2" size="20" style="pointer-events:none;"></i>
                    </div>
                </div>
            </div>`;
        });
    }

    container.innerHTML = `
        <div class="view">
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

    document.getElementById('plBackBtn').onclick    = () => navigateTo('mainMenu');
    document.getElementById('plAddBtn').onclick     = () => openLessonModal(null);
    document.getElementById('plArchiveToggleBtn').onclick = () => {
        appState.showArchivedPrivate = !showArch;
        renderPrivateLessonsView();
    };

    container.querySelectorAll('[data-pl-goto]').forEach(el => {
        el.addEventListener('click', () => {
            navigateTo('privateLessonDetail', { lessonId: parseInt(el.dataset.plGoto) });
        });
    });

    container.querySelectorAll('.pl-btn-edit').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const lesson = (appState.privateLessonsList || []).find(l => l.id === parseInt(el.dataset.plId));
            if (lesson) openLessonModal(lesson);
        });
    });

    container.querySelectorAll('.pl-btn-archive').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            archiveLesson(parseInt(el.dataset.plId), el.dataset.plArchived !== '1');
        });
    });

    container.querySelectorAll('.pl-btn-delete').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteLesson(parseInt(el.dataset.plId));
        });
    });

    refreshIcons();
}

// ---------------------------------------------------------------
// DETAY SAYFASI
// ---------------------------------------------------------------
function renderDetailView(lesson) {
    const container = document.getElementById('dynamicView');
    if (!container) return;

    const symbol  = lesson.currency ? getCurrencySymbol(lesson.currency) : '₺';
    const earned  = lesson.earned_amount ? lesson.earned_amount + ' ' + symbol : '—';
    const hasVideo = !!(lesson.video_url);

    // video ikonu: link varsa parlak, yoksa soluk
    const vidIconClass = hasVideo ? 'vid-icon active' : 'vid-icon';

    container.innerHTML = `
        <div class="view">
            <span class="back-link" id="plDetailBackBtn">
                <i data-lucide="arrow-left" size="16" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>Özel Dersler
            </span>

            <!-- BAŞLIK -->
            <div class="main-title" style="margin-top:10px;">Özel Ders</div>
            <div style="text-align:center; font-size:15px; font-weight:600; color:var(--text-main); margin-bottom:24px;">
                Öğrenci: <span style="color:var(--primary);">${escapeHtml(lesson.student_name)}</span>
            </div>

            <!-- DERS PARTNERİ -->
            <div class="sub-header">Ders Partneri</div>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
                ${lesson.partner_name
                    ? `<span style="color:var(--text-main); font-size:14px;">${escapeHtml(lesson.partner_name)}</span>
                       <button class="btn-secondary" id="plPartnerEditBtn" style="flex:0 0 auto; min-width:70px; padding:8px 12px;">Düzenle</button>`
                    : `<button class="btn-secondary" id="plPartnerEditBtn" style="flex:0 0 auto;">
                           <i data-lucide="plus" size="14" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>Ekle
                       </button>`
                }
            </div>

            <!-- DERS VİDEOSU -->
            <div class="sub-header">Ders Videosu</div>
            <div style="margin-bottom:20px;">
                <span class="${vidIconClass}" id="plVideoIcon" style="font-size:0;">
                    <i data-lucide="video" size="28"></i>
                </span>
            </div>

            <!-- ALINAN ÜCRET -->
            <div class="sub-header">Alınan Ücret</div>
            <div style="font-size:16px; font-weight:700; color:var(--primary); margin-bottom:20px;">
                ${earned}
            </div>

            <!-- DERS NOTU -->
            <div class="sub-header">Ders Notu</div>
            <textarea id="plDetailNote" rows="5"
                style="width:100%;background:#1e293b;color:white;border:1px solid var(--border);border-radius:10px;padding:10px;font-size:13px;resize:vertical;margin-bottom:16px;box-sizing:border-box;"
                placeholder="Ders notları, figürler, gözlemler...">${escapeHtml(lesson.note || '')}</textarea>

            <!-- KAYDET -->
            <button class="btn-success" id="plDetailSaveBtn" style="width:100%; margin-bottom:8px;">
                <i data-lucide="save" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>Kaydet
            </button>
        </div>
    `;

    // Geri
    document.getElementById('plDetailBackBtn').onclick = () => {
        appState.privateLessonsList = null;
        navigateTo('privateLessons');
    };

    // Partner ekle / düzenle
    document.getElementById('plPartnerEditBtn').onclick = () => {
        openPromptModal(
            'Ders Partneri',
            lesson.partner_name || '',
            async (val) => {
                await updateLessonField(lesson.id, { partner_name: val || null }, 'Partner kaydedildi ✓');
                lesson.partner_name = val || null;
                renderDetailView(lesson);
            }
        );
    };

    // Video ikonu
    document.getElementById('plVideoIcon').onclick = () => {
        if (lesson.video_url) {
            openPrivateVideoModal(lesson);
        } else {
            openPromptModal('Video Linki Ekle', 'https://...', async (url) => {
                if (!url || !url.startsWith('http')) {
                    showToast('Geçerli bir URL giriniz.', 'warning');
                    return;
                }
                await updateLessonField(lesson.id, { video_url: url }, 'Video kaydedildi ✓');
                lesson.video_url = url;
                renderDetailView(lesson);
            });
        }
    };

    // Kaydet (sadece not)
    document.getElementById('plDetailSaveBtn').onclick = async () => {
        const note = document.getElementById('plDetailNote').value.trim() || null;
        await updateLessonField(lesson.id, { note }, 'Kaydedildi ✓');
        lesson.note = note;
    };

    refreshIcons();
}

// ---------------------------------------------------------------
// Özel ders video modalı — grup dersleri videoModal ile aynı yapı
// ---------------------------------------------------------------
function openPrivateVideoModal(lesson) {
    const modal = ensureModal('plVideoModal');
    const platform = detectVideoPlatform(lesson.video_url);

    modal.querySelector('.modal-content').innerHTML = `
        <h3 style="margin-top:0; text-align:center;">
            <i data-lucide="video" size="20" style="color:#2DD4BF;display:inline-block;vertical-align:middle;"></i>
            <span style="vertical-align:middle;"> Özel Ders Videosu</span>
            <span style="
                display:inline-block;vertical-align:middle;margin-left:8px;
                padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;
                background:${platform.color}22;color:${platform.color};border:1px solid ${platform.color}55;
            ">${escapeHtml(platform.name)}</span>
        </h3>
        <p style="word-break:break-all;background:rgba(45,212,191,0.1);padding:12px;border-radius:8px;font-size:13px;margin:16px 0;color:#2DD4BF;border:1px solid rgba(45,212,191,0.3);">
            ${escapeHtml(lesson.video_url)}
        </p>
        <div style="display:flex;gap:24px;justify-content:center;align-items:center;margin-bottom:16px;">
            <span id="plVidPlay" style="cursor:pointer;color:#2DD4BF;">
                <i data-lucide="play" size="32"></i>
            </span>
            <span id="plVidDelete" style="cursor:pointer;color:var(--danger);">
                <i data-lucide="trash-2" size="32"></i>
            </span>
            <a id="plVidWa" href="https://wa.me/?text=${encodeURIComponent(lesson.video_url)}"
                target="_blank"
                style="cursor:pointer;color:#25D366;display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;">
                <i data-lucide="message-circle" size="32"></i>
            </a>
        </div>
        <button id="plVidClose" class="btn-secondary" style="width:100%;">Kapat</button>
    `;

    modal.style.display = 'flex';
    refreshIcons();

    document.getElementById('plVidPlay').onclick = () => window.open(lesson.video_url, '_blank');

    document.getElementById('plVidDelete').onclick = () => {
        modal.style.display = 'none';
        openConfirmModal('Video silinsin mi?', async () => {
            await updateLessonField(lesson.id, { video_url: null }, 'Video silindi ✓');
            lesson.video_url = null;
            renderDetailView(lesson);
        }, () => {
            modal.style.display = 'flex';
        });
    };

    document.getElementById('plVidClose').onclick = () => { modal.style.display = 'none'; };

    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
}

// ---------------------------------------------------------------
// OLUŞTURMA / DÜZENLEME MODALI
// ---------------------------------------------------------------
function openLessonModal(existing) {
    const modal  = ensureModal('privateLessonModal');
    const isEdit = !!existing;
    const title  = isEdit ? 'Özel Dersi Düzenle' : 'Yeni Özel Ders Ekle';
    const selCur = existing && existing.currency ? existing.currency : 'TRY';

    modal.querySelector('.modal-content').innerHTML = `
        <h3 style="margin-top:0;color:var(--primary);text-align:left;">${title}</h3>

        <input type="text" id="plModalName" placeholder="Öğrenci / kişi adı *" autocomplete="off"
            style="width:100%;margin-bottom:12px;"
            value="${escapeHtml(existing ? existing.student_name || '' : '')}">

        <input type="text" id="plModalLocation" placeholder="Lokasyon (opsiyonel)" autocomplete="off"
            style="width:100%;margin-bottom:12px;"
            value="${escapeHtml(existing ? existing.location || '' : '')}">

        <!-- Tarih -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <input type="text" id="plModalDateDisplay" readonly placeholder="Tarih seçin *"
                style="flex:1;background:#1e293b;color:white;cursor:pointer;"
                value="${existing && existing.lesson_date ? formatDate(existing.lesson_date) : ''}">
            <span id="plModalCalIcon" style="cursor:pointer;color:var(--primary);display:inline-flex;align-items:center;min-width:36px;min-height:36px;justify-content:center;">
                <i data-lucide="calendar" size="22"></i>
            </span>
        </div>
        <input type="date" id="plModalHiddenDate" style="display:none;"
            value="${existing && existing.lesson_date ? existing.lesson_date : ''}">

        <!-- Saat: doğrudan time input, HH:MM zorunlu -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <input type="time" id="plModalTime"
                style="flex:1;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;"
                placeholder="Saat (opsiyonel)"
                value="${existing && existing.lesson_time ? formatTime(existing.lesson_time) : ''}">
            <span style="color:var(--text-dim);font-size:12px;flex-shrink:0;">SS:DD</span>
        </div>

        <!-- Ücret + Para Birimi -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;">
            <input type="number" id="plModalEarned" placeholder="Alınan ücret *"
                style="flex:1;"
                value="${existing && existing.earned_amount ? existing.earned_amount : ''}">
            ${currencySelectHtml(selCur)}
        </div>

        <div style="display:flex;gap:10px;">
            <button class="btn-success" id="plModalSaveBtn">Kaydet</button>
            <button class="btn-secondary" id="plModalCancelBtn">İptal</button>
        </div>
    `;

    // Takvim
    const hiddenDate = document.getElementById('plModalHiddenDate');
    const dispDate   = document.getElementById('plModalDateDisplay');
    document.getElementById('plModalCalIcon').onclick = () => {
        if (hiddenDate.showPicker) hiddenDate.showPicker(); else hiddenDate.click();
    };
    dispDate.onclick = () => {
        if (hiddenDate.showPicker) hiddenDate.showPicker(); else hiddenDate.click();
    };
    hiddenDate.onchange = () => {
        dispDate.value = hiddenDate.value ? formatDate(hiddenDate.value) : '';
    };

    document.getElementById('plModalSaveBtn').onclick  = () =>
        isEdit ? updateLesson(existing.id, modal) : createLesson(modal);
    document.getElementById('plModalCancelBtn').onclick = () => {
        modal.style.display = 'none';
    };

    modal.style.display = 'flex';
    document.getElementById('plModalName').focus();
    refreshIcons();
}

// ---------------------------------------------------------------
// Yeni ders oluştur
// ---------------------------------------------------------------
async function createLesson(modal) {
    const student_name = document.getElementById('plModalName').value.trim();
    if (!student_name) { showToast('Öğrenci adı boş olamaz.', 'warning'); return; }

    const lesson_date = document.getElementById('plModalHiddenDate').value || null;
    if (!lesson_date)  { showToast('Tarih seçiniz.', 'warning'); return; }

    const lesson_time   = document.getElementById('plModalTime').value || null;
    const location      = document.getElementById('plModalLocation').value.trim() || null;
    const earned_raw    = document.getElementById('plModalEarned').value;
    if (earned_raw === '') { showToast('Alınan ücreti giriniz.', 'warning'); return; }
    const earned_amount = parseFloat(earned_raw);
    const currency      = document.getElementById('plModalCurrency').value || 'TRY';

    const { error } = await supabase.from('private_lessons').insert({
        student_name, lesson_date, lesson_time, location, earned_amount, currency
    });

    if (error) { showToast('Ders oluşturulamadı: ' + error.message, 'error'); return; }

    showToast('Özel ders eklendi ✓', 'success');
    modal.style.display = 'none';
    appState.privateLessonsList = null;
    await fetchPrivateLessons();
    renderPrivateLessonsView();
}

// ---------------------------------------------------------------
// Mevcut dersi güncelle
// ---------------------------------------------------------------
async function updateLesson(lessonId, modal) {
    const student_name = document.getElementById('plModalName').value.trim();
    if (!student_name) { showToast('Öğrenci adı boş olamaz.', 'warning'); return; }

    const lesson_date = document.getElementById('plModalHiddenDate').value || null;
    if (!lesson_date)  { showToast('Tarih seçiniz.', 'warning'); return; }

    const lesson_time   = document.getElementById('plModalTime').value || null;
    const location      = document.getElementById('plModalLocation').value.trim() || null;
    const earned_raw    = document.getElementById('plModalEarned').value;
    if (earned_raw === '') { showToast('Alınan ücreti giriniz.', 'warning'); return; }
    const earned_amount = parseFloat(earned_raw);
    const currency      = document.getElementById('plModalCurrency').value || 'TRY';

    const { error } = await supabase.from('private_lessons').update({
        student_name, lesson_date, lesson_time, location, earned_amount, currency
    }).eq('id', lessonId);

    if (error) { showToast('Güncelleme başarısız: ' + error.message, 'error'); return; }

    showToast('Ders güncellendi ✓', 'success');
    modal.style.display = 'none';
    appState.privateLessonsList = null;
    await fetchPrivateLessons();
    renderPrivateLessonsView();
}

// ---------------------------------------------------------------
// Tek alan güncelle (video, partner, note)
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