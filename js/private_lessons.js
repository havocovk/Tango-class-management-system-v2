// ---------------------------------------------------------------
// private_lessons.js — ÖZEL DERSLER MODÜLÜ
// ---------------------------------------------------------------

import { supabase }       from './supabaseClient.js';
import { refreshIcons, openConfirmModal, showToast, escapeHtml, formatDate, openPromptModal } from './utils.js';
import { navigateTo }     from './router.js';
import { appState }       from './state.js';

// ---------------------------------------------------------------
// Para birimleri — festival_classes.js ile aynı kısa format
// ₺ TRY üstte, altında € EUR ve $ USD, sonra diğerleri
// ---------------------------------------------------------------
const ALL_CURRENCIES = [
    '₺ TRY','€ EUR','$ USD','£ GBP','₽ RUB','₸ KZT',
    '¥ JPY','¥ CNY','₩ KRW','₹ INR','R$ BRL','C$ CAD',
    'A$ AUD','Fr CHF','kr SEK','kr NOK','kr DKK','zł PLN',
    'Kč CZK','Ft HUF','lei RON','лв BGN','дин RSD','₴ UAH',
    '$ ARS','$ MXN','$ COP','$ CLP','S/ PEN','$ UYU',
    'R ZAR','£ EGP','د.م. MAD','₦ NGN','KSh KES',
    'ر.س SAR','د.إ AED','₪ ILS','฿ THB','S$ SGD',
    'RM MYR','Rp IDR','₱ PHP','₫ VND','₨ PKR',
    '৳ BDT','NZ$ NZD','HK$ HKD','NT$ TWD',
];

function currencySelectHtml(selectedCurrency) {
    const sel = selectedCurrency || '₺ TRY';
    const opts = ALL_CURRENCIES.map(c =>
        `<option value="${c}" ${c === sel ? 'selected' : ''}>${escapeHtml(c)}</option>`
    ).join('');
    return `<select id="plModalCurrency"
        style="background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;min-width:110px;flex:0 0 auto;">
        ${opts}
    </select>`;
}

// ---------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------
function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
}

function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

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

function detectVideoPlatform(url) {
    if (!url) return { name: 'Diğer', color: '#94a3b8' };
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be'))
        return { name: 'YouTube', color: '#FF0000' };
    if (lower.includes('vimeo.com'))
        return { name: 'Vimeo', color: '#1AB7EA' };
    if (lower.includes('drive.google.com'))
        return { name: 'Google Drive', color: '#34A853' };
    if (lower.includes('instagram.com'))
        return { name: 'Instagram', color: '#E1306C' };
    if (lower.includes('facebook.com') || lower.includes('fb.watch'))
        return { name: 'Facebook', color: '#1877F2' };
    if (lower.includes('tiktok.com'))
        return { name: 'TikTok', color: '#010101' };
    return { name: 'Diğer', color: '#94a3b8' };
}

// ---------------------------------------------------------------
// GİRİŞ NOKTASI — liste
// ---------------------------------------------------------------
export async function loadPrivateLessons() {
    await fetchPrivateLessons();
    renderPrivateLessonsView();
}

// ---------------------------------------------------------------
// GİRİŞ NOKTASI — detay
// ---------------------------------------------------------------
export async function showPrivateLessonDetail(lessonId) {
    if (!appState.privateLessonsList) await fetchPrivateLessons();
    const lesson = (appState.privateLessonsList || []).find(l => l.id === lessonId);
    if (!lesson) {
        showToast('Ders bulunamadı.', 'error');
        await loadPrivateLessons();
        return;
    }
    renderDetailView(lesson);
}

// ---------------------------------------------------------------
// Supabase'den çek
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
        listHtml = `<div style="text-align:center;color:var(--text-dim);padding:20px;">
            ${showArch ? 'Arşivlenmiş özel ders yok.' : 'Henüz özel ders eklenmemiş.'}
        </div>`;
    } else {
        displayed.forEach(l => {
            const isPast  = l.lesson_date < today;
            const opacity = (isPast || l.is_archived) ? 'opacity:0.5;' : '';
            const timeStr = formatTime(l.lesson_time);
            const dateStr = l.lesson_date ? formatDate(l.lesson_date) : '';
            const loc     = l.location ? escapeHtml(l.location) + ' · ' : '';
            const earned  = l.earned_amount ? l.earned_amount + ' ' + (l.currency || '₺ TRY').split(' ')[0] : '';

            listHtml += `
            <div class="class-card" style="${opacity}" data-pl-id="${l.id}">
                <div style="flex:1;cursor:pointer;" data-pl-goto="${l.id}">
                    <div style="font-weight:700;font-size:15px;color:var(--text-main);">
                        ${escapeHtml(l.student_name)}
                    </div>
                    <div style="font-size:12px;color:var(--text-dim);margin-top:3px;">
                        ${loc}${dateStr}${timeStr ? ' · ' + timeStr : ''}${earned ? ' · ' + earned : ''}
                    </div>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
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

    document.getElementById('plBackBtn').onclick = () => navigateTo('mainMenu');
    document.getElementById('plAddBtn').onclick  = () => openLessonModal(null);
    document.getElementById('plArchiveToggleBtn').onclick = () => {
        appState.showArchivedPrivate = !showArch;
        renderPrivateLessonsView();
    };

    container.querySelectorAll('[data-pl-goto]').forEach(el => {
        el.addEventListener('click', () =>
            navigateTo('privateLessonDetail', { lessonId: parseInt(el.dataset.plGoto) })
        );
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

    // Para birimi sembolü: '₺ TRY' → '₺'
    const currSymbol  = (lesson.currency || '₺ TRY').split(' ')[0];
    const earned      = lesson.earned_amount ? lesson.earned_amount + ' ' + currSymbol : '—';
    const hasVideo    = !!(lesson.video_url);
    const vidClass    = hasVideo ? 'vid-icon active' : 'vid-icon';
    const hasPartner  = !!(lesson.partner_name);

    container.innerHTML = `
        <div class="view">
            <span class="back-link" id="plDetailBackBtn">
                <i data-lucide="arrow-left" size="16" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>Özel Dersler
            </span>

            <div class="main-title" style="margin-top:10px;">Özel Ders</div>
            <div style="text-align:center;font-size:15px;font-weight:600;color:var(--text-main);margin-bottom:24px;">
                Öğrenci: <span style="color:var(--primary);">${escapeHtml(lesson.student_name)}</span>
            </div>

            <!-- DERS PARTNERİ -->
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
                <span class="sub-header" style="margin:0;border:none;padding:0;font-size:14px;color:var(--accent);">Ders Partneri</span>
                ${hasPartner
                    ? `<span style="color:var(--text-main);font-size:14px;font-weight:600;">${escapeHtml(lesson.partner_name)}</span>
                       <span id="plPartnerEditBtn" style="cursor:pointer;color:var(--primary);display:inline-flex;align-items:center;min-width:32px;min-height:32px;justify-content:center;">
                           <i data-lucide="pencil" size="18"></i>
                       </span>`
                    : `<span id="plPartnerEditBtn" style="cursor:pointer;color:var(--primary);display:inline-flex;align-items:center;min-width:32px;min-height:32px;justify-content:center;">
                           <i data-lucide="circle-plus" size="22"></i>
                       </span>`
                }
            </div>

            <!-- DERS VİDEOSU -->
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
                <span class="sub-header" style="margin:0;border:none;padding:0;font-size:14px;color:var(--accent);">Ders Videosu</span>
                <span class="${vidClass}" id="plVideoIcon" style="display:inline-flex;align-items:center;min-width:32px;min-height:32px;justify-content:center;">
                    <i data-lucide="video" size="22"></i>
                </span>
            </div>

            <!-- ALINAN ÜCRET -->
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
                <span class="sub-header" style="margin:0;border:none;padding:0;font-size:14px;color:var(--accent);">Alınan Ücret</span>
                <span style="color:var(--primary);font-size:16px;font-weight:700;">${earned}</span>
            </div>

            <!-- DERS NOTU -->
            <div class="sub-header">Ders Notu</div>
            <textarea id="plDetailNote" rows="5"
                style="width:100%;background:#1e293b;color:white;border:1px solid var(--border);border-radius:10px;padding:10px;font-size:13px;resize:vertical;margin-bottom:16px;box-sizing:border-box;"
                placeholder="Ders notları, figürler, gözlemler...">${escapeHtml(lesson.note || '')}</textarea>

            <button class="btn-success" id="plDetailSaveBtn" style="width:100%;">
                <i data-lucide="save" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>Kaydet
            </button>
        </div>
    `;

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
                const partner_name = val.trim() || null;
                await updateLessonField(lesson.id, { partner_name }, 'Partner kaydedildi ✓');
                lesson.partner_name = partner_name;
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

    // Sadece notu kaydet
    document.getElementById('plDetailSaveBtn').onclick = async () => {
        const note = document.getElementById('plDetailNote').value.trim() || null;
        await updateLessonField(lesson.id, { note }, 'Kaydedildi ✓');
        lesson.note = note;
    };

    refreshIcons();
}

// ---------------------------------------------------------------
// ÖZEL DERS VİDEO MODALI
// festVideoModal'ı yeniden kullanır (aynı HTML yapısı)
// ---------------------------------------------------------------
function openPrivateVideoModal(lesson) {
    const modal    = document.getElementById('festVideoModal');
    const titleEl  = document.getElementById('festVideoModalTitle');
    const linkDisp = document.getElementById('festVideoLinkDisplay');
    const embedCont= document.getElementById('festVideoEmbedContainer');
    const playBtn  = document.getElementById('festVideoPlayBtn');
    const deleteBtn= document.getElementById('festVideoDeleteBtn');
    const closeBtn = document.getElementById('festVideoCloseBtn');
    if (!modal) return;

    const url      = lesson.video_url;
    const platform = detectVideoPlatform(url);

    if (embedCont) embedCont.style.display = 'none';

    titleEl.innerHTML = `
        <i data-lucide="video" size="20" style="color:#2DD4BF;display:inline-block;vertical-align:middle;"></i>
        <span style="vertical-align:middle;"> Özel Ders Videosu</span>
        <span style="display:inline-block;vertical-align:middle;margin-left:8px;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;
            background:${platform.color}22;color:${platform.color};border:1px solid ${platform.color}55;">${escapeHtml(platform.name)}</span>
    `;

    linkDisp.textContent   = url;
    linkDisp.style.display = 'block';
    modal.style.display    = 'flex';
    refreshIcons();

    // WhatsApp butonu
    const waBtn = document.getElementById('festVideoPlayBtn');
    const waShare = modal.querySelector('a[id*="whatsapp"], a[id*="Wa"], #whatsappVideoShareBtn');
    if (waShare) waShare.href = `https://wa.me/?text=${encodeURIComponent(url)}`;

    const watchHandler  = () => window.open(url, '_blank');
    const deleteHandler = () => {
        modal.style.display = 'none';
        openConfirmModal('Bu videoyu silmek istediğinizden emin misiniz?', async () => {
            await updateLessonField(lesson.id, { video_url: null }, 'Video silindi ✓');
            lesson.video_url = null;
            renderDetailView(lesson);
            cleanup();
        }, () => { modal.style.display = 'flex'; refreshIcons(); });
    };
    const closeHandler  = () => { modal.style.display = 'none'; cleanup(); };
    const outsideHandler= (e) => { if (e.target === modal) closeHandler(); };

    const cleanup = () => {
        playBtn.removeEventListener('click', watchHandler);
        deleteBtn.removeEventListener('click', deleteHandler);
        closeBtn.removeEventListener('click', closeHandler);
        modal.removeEventListener('click', outsideHandler);
    };

    cleanup(); // önceki listener'ları temizle
    playBtn.addEventListener('click', watchHandler);
    deleteBtn.addEventListener('click', deleteHandler);
    closeBtn.addEventListener('click', closeHandler);
    modal.addEventListener('click', outsideHandler);
}

// ---------------------------------------------------------------
// OLUŞTURMA / DÜZENLEME MODALI
// Saat: type="text" maxlength="5" placeholder="SS:DD" — mevcut sistemle aynı
// Para birimi: kısa format '₺ TRY', '€ EUR' vb.
// ---------------------------------------------------------------
function openLessonModal(existing) {
    const modal  = ensureModal('privateLessonModal');
    const isEdit = !!existing;

    modal.querySelector('.modal-content').innerHTML = `
        <h3 style="margin-top:0;color:var(--primary);text-align:left;">
            ${isEdit ? 'Özel Dersi Düzenle' : 'Yeni Özel Ders Ekle'}
        </h3>

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

        <!-- Saat: zorunlu, 24 saat formatı, varsayılan 19:00 -->
        <input type="text" id="plModalTime"
            placeholder="SS:DD (örn: 19:00)"
            maxlength="5"
            autocomplete="off"
            style="width:100%;margin-bottom:12px;"
            value="${existing && existing.lesson_time ? formatTime(existing.lesson_time) : '19:00'}">

        <!-- Ücret -->
        <input type="number" id="plModalEarned" placeholder="Alınan ücret *"
            style="width:100%;margin-bottom:8px;"
            value="${existing && existing.earned_amount ? existing.earned_amount : ''}">
        <!-- Para Birimi -->
        ${currencySelectHtml(existing ? existing.currency || '₺ TRY' : '₺ TRY')}
        <div style="margin-bottom:12px;"></div>

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

    const timeVal = document.getElementById('plModalTime').value.trim();
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timePattern.test(timeVal)) { showToast('Geçerli bir saat girin (örn: 19:00)', 'warning'); return; }
    const lesson_time = timeVal;
    const location      = document.getElementById('plModalLocation').value.trim() || null;
    const earned_raw    = document.getElementById('plModalEarned').value;
    if (earned_raw === '') { showToast('Alınan ücreti giriniz.', 'warning'); return; }
    const earned_amount = parseFloat(earned_raw);
    const currency      = document.getElementById('plModalCurrency').value || '₺ TRY';

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

    const timeVal = document.getElementById('plModalTime').value.trim();
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timePattern.test(timeVal)) { showToast('Geçerli bir saat girin (örn: 19:00)', 'warning'); return; }
    const lesson_time = timeVal;
    const location      = document.getElementById('plModalLocation').value.trim() || null;
    const earned_raw    = document.getElementById('plModalEarned').value;
    if (earned_raw === '') { showToast('Alınan ücreti giriniz.', 'warning'); return; }
    const earned_amount = parseFloat(earned_raw);
    const currency      = document.getElementById('plModalCurrency').value || '₺ TRY';

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
// Tek alan güncelle
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