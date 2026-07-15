// ---------------------------------------------------------------
// festival_classes.js — FESTİVAL DERSLERİ MODÜLÜ
// ADIM 5.3 + 5.4 + 5.5
// ---------------------------------------------------------------

import { supabase } from './supabaseClient.js';
import { COUNTRY_CURRENCY } from './festivals.js';
import { refreshIcons, openConfirmModal, showToast, escapeHtml, formatDate } from './utils.js';
import { navigateTo } from './router.js';
import { t } from './i18n.js';
import { appState } from './state.js';

// ---------------------------------------------------------------
// VIDEO PLATFORM TESPİTİ
// ---------------------------------------------------------------
function detectVideoPlatform(url) {
    if (!url) return { name: t('countries.videoPlatformOther'), color: '#94a3b8', canEmbed: false };
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be'))
        return { name: 'YouTube', color: '#FF0000', canEmbed: true };
    if (lower.includes('vimeo.com'))
        return { name: 'Vimeo', color: '#1AB7EA', canEmbed: true };
    if (lower.includes('drive.google.com'))
        return { name: 'Google Drive', color: '#34A853', canEmbed: false };
    if (lower.includes('instagram.com'))
        return { name: 'Instagram', color: '#E1306C', canEmbed: false };
    if (lower.includes('facebook.com') || lower.includes('fb.watch'))
        return { name: 'Facebook', color: '#1877F2', canEmbed: false };
    if (lower.includes('tiktok.com'))
        return { name: 'TikTok', color: '#010101', canEmbed: false };
    return { name: t('countries.videoPlatformOther'), color: '#94a3b8', canEmbed: false };
}

// YouTube / Vimeo URL'sini embed URL'sine çevir
function toEmbedUrl(url) {
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com/watch')) {
        try {
            const id = new URL(url).searchParams.get('v');
            if (id) return `https://www.youtube.com/embed/${id}`;
        } catch(e) {}
    }
    if (lower.includes('youtu.be/')) {
        const id = url.split('youtu.be/')[1].split('?')[0];
        if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (lower.includes('youtube.com/shorts/')) {
        const id = url.split('/shorts/')[1].split('?')[0];
        if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (lower.includes('vimeo.com/')) {
        const id = url.split('vimeo.com/')[1].split('?')[0].split('/')[0];
        if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
    return null;
}

// ---------------------------------------------------------------
// Para birimi dropdown HTML'i
// ---------------------------------------------------------------
function currencySelectHtml(festivalLocation, savedCurrency) {
    let countryName = '';
    if (festivalLocation) {
        const parts = festivalLocation.split(',');
        countryName = parts.length >= 2 ? parts[parts.length - 1].trim() : '';
    }
    const countryCurrency = COUNTRY_CURRENCY[countryName] || null;

    const allCurrencies = [
        '₺ TRY','$ USD','€ EUR','£ GBP','₽ RUB','¥ JPY','¥ CNY',
        '₩ KRW','₹ INR','R$ BRL','C$ CAD','A$ AUD','Fr CHF',
        'kr SEK','kr NOK','kr DKK','zł PLN','Kč CZK','Ft HUF',
        'lei RON','лв BGN','дин RSD','₴ UAH','$ ARS','$ MXN',
        '$ COP','$ CLP','S/ PEN','$ UYU','R ZAR','£ EGP',
        'د.م. MAD','₦ NGN','KSh KES','ر.س SAR','د.إ AED',
        '₪ ILS','฿ THB','S$ SGD','RM MYR','Rp IDR','₱ PHP',
        '₫ VND','₨ PKR','৳ BDT','NZ$ NZD','HK$ HKD','NT$ TWD',
    ];

    const top = [];
    if (countryCurrency) top.push(countryCurrency);
    if (!top.includes('$ USD')) top.push('$ USD');
    if (!top.includes('€ EUR')) top.push('€ EUR');
    const rest    = allCurrencies.filter(c => !top.includes(c));
    const ordered = [...top, ...rest];
    const selected = savedCurrency || top[0] || '$ USD';

    const opts = ordered.map(c =>
        `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`
    ).join('');

    return `<select id="fcCurrencySelect"
        style="background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;width:42%;box-sizing:border-box;">
        ${opts}
    </select>`;
}

// ---------------------------------------------------------------
// Giriş noktası — router.js çağırır
// ---------------------------------------------------------------
export async function showFestivalDetail(festivalId, festivalName) {
    appState.currentFestivalId   = festivalId;
    appState.currentFestivalName = festivalName;
    await loadFestivalData();
    renderFestivalDetailView();
}

// ---------------------------------------------------------------
// Veri yükle
// ---------------------------------------------------------------
async function loadFestivalData() {
    const fid = appState.currentFestivalId;
    const { data: fest } = await supabase.from('festivals').select('*').eq('id', fid).single();
    appState.currentFestival = fest || null;

    const { data: classes } = await supabase
        .from('festival_classes').select('*')
        .eq('festival_id', fid).order('lesson_date', { ascending: true });
    appState.festivalClasses = classes || [];
}

// ---------------------------------------------------------------
// Festival detay sayfası — ders listesi
// ---------------------------------------------------------------
function renderFestivalDetailView() {
    const container = document.getElementById('dynamicView');
    if (!container) return;

    const fest    = appState.currentFestival;
    const classes = (appState.festivalClasses || []).filter(c => !c.is_archived);

    let infoHtml = '';
    if (fest) {
        const dateStr = fest.start_date ? formatDate(fest.start_date) : '';
        const dateEnd = fest.end_date   ? ' – ' + formatDate(fest.end_date) : '';
        const loc     = fest.location   ? escapeHtml(fest.location) : '';
        infoHtml = `
        <div style="background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.25);border-radius:14px;padding:14px 16px;margin-bottom:16px;">
            <div style="font-size:12px;color:var(--text-dim);line-height:1.9;">
                ${loc     ? '<div><b>' + t('festClasses.locationLabel') + ':</b> ' + loc + '</div>' : ''}
                ${dateStr ? '<div><b>' + t('festClasses.dateLabel') + ':</b> ' + dateStr + dateEnd + '</div>' : ''}
            </div>
        </div>`;
    }

    let classesHtml = '';
    if (classes.length === 0) {
        classesHtml = `<div style="text-align:center;color:var(--text-dim);padding:20px;">${t('festClasses.emptyLessons')}</div>`;
    } else {
        classes.forEach(c => {
            const dateStr = c.lesson_date ? formatDate(c.lesson_date) : '';
            const timeStr = c.lesson_time ? c.lesson_time.substring(0, 5) : '';
            const dt      = [dateStr, timeStr].filter(Boolean).join(' · ');
            const platform = c.video_url ? detectVideoPlatform(c.video_url) : null;

            classesHtml += `
            <div class="class-card" style="cursor:pointer;" data-fc-goto="${c.id}">
                <div style="flex:1;">
                    <div style="font-weight:700;font-size:15px;color:var(--text-main);">${escapeHtml(c.name)}</div>
                    ${dt ? `<div style="font-size:12px;color:var(--text-dim);margin-top:3px;">${dt}</div>` : ''}
                    <div style="font-size:11px;color:var(--primary);margin-top:2px;display:flex;gap:10px;flex-wrap:wrap;">
                        ${c.participant_count ? `<span>\u{1F465} ${c.participant_count} ${t('festClasses.participantLabel').toLowerCase()}</span>` : ''}
                        ${c.earned_amount     ? `<span>💰 ${Number(c.earned_amount).toLocaleString('tr-TR')} ${c.currency || ''}</span>` : ''}
                        ${platform ? `<span style="color:${platform.color};">🎬 ${platform.name}</span>` : ''}
                    </div>
                </div>
                <div style="display:flex;gap:10px;align-items:center;">
                    <div class="fc-btn-edit" data-fc-id="${c.id}" style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;color:var(--primary);z-index:2;">
                        <i data-lucide="pencil" size="18" style="pointer-events:none;"></i>
                    </div>
                    <div class="fc-btn-delete" data-fc-id="${c.id}" style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;color:var(--danger);z-index:2;">
                        <i data-lucide="trash-2" size="18" style="pointer-events:none;"></i>
                    </div>
                </div>
            </div>`;
        });
    }

    container.innerHTML = `
        <div class="view">
            <div class="back-link" id="backToFestivalsBtn">${t('festClasses.backToFestivals')}</div>
            <div class="main-title">${t('festClasses.title')}</div>
            <h2 style="text-align:center;font-size:18px;color:var(--primary);margin-bottom:12px;">${escapeHtml(appState.currentFestivalName || '')}</h2>
            ${infoHtml}
            <div class="nav-buttons" style="margin-bottom:16px;">
                <button class="btn-success" id="addFestClassBtn">
                    <i data-lucide="plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${t('festClasses.addLesson')}
                </button>
            </div>
            <div id="festClassesList">${classesHtml}</div>
        </div>
    `;

    document.getElementById('backToFestivalsBtn').onclick = () => navigateTo('festivals');
    document.getElementById('addFestClassBtn').onclick    = () => openFestClassModal();

    document.querySelectorAll('[data-fc-goto]').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.fc-btn-edit') || e.target.closest('.fc-btn-delete')) return;
            const cid = el.dataset.fcGoto;
            const cls = (appState.festivalClasses || []).find(x => String(x.id) === String(cid));
            if (cls) openFestClassDetail(cls);
        });
    });

    document.querySelectorAll('.fc-btn-edit').forEach(el => {
        el.onclick = (e) => {
            e.stopPropagation();
            const cls = (appState.festivalClasses || []).find(x => String(x.id) === String(el.dataset.fcId));
            if (cls) openFestClassModal(cls);
        };
    });

    document.querySelectorAll('.fc-btn-delete').forEach(el => {
        el.onclick = (e) => {
            e.stopPropagation();
            const cid = el.dataset.fcId;
            openConfirmModal(t('festClasses.confirmDelete'), async () => {
                const { error } = await supabase.from('festival_classes').delete().eq('id', cid);
                if (error) { showToast(t('festClasses.toastDeleteFail'), 'error'); return; }
                showToast(t('festClasses.toastDeleted'), 'success');
                await loadFestivalData();
                renderFestivalDetailView();
            });
        };
    });

    refreshIcons();
}

// ---------------------------------------------------------------
// Ders oluşturma / düzenleme modalı
// ---------------------------------------------------------------
function openFestClassModal(existing) {
    const modal = document.getElementById('festClassModal');
    if (!modal) { showToast('Modal not found.', 'error'); return; }

    const isEdit = !!existing;
    modal.querySelector('h3').textContent = isEdit ? t('festClasses.modalEditTitle') : t('festClasses.modalCreateTitle');

    document.getElementById('fcName').value = existing ? (existing.name || '') : '';
    document.getElementById('fcName').placeholder        = t('festClasses.namePlaceholder');
    document.getElementById('fcDateDisplay').placeholder  = t('festClasses.datePlaceholder') || 'Date';
    document.getElementById('fcTime').placeholder         = t('festClasses.timePlaceholder') || 'HH:MM';
    document.getElementById('fcSaveBtn').textContent      = isEdit ? t('common.save') : t('festClasses.saveBtn');
    document.getElementById('fcCancelBtn').textContent    = t('common.cancel');
    document.getElementById('fcTime').value = existing && existing.lesson_time
        ? existing.lesson_time.substring(0, 5) : '19:00';

    const dateDisp   = document.getElementById('fcDateDisplay');
    const dateHidden = document.getElementById('fcHiddenDate');
    if (existing && existing.lesson_date) {
        dateHidden.value = existing.lesson_date;
        dateDisp.value   = formatDate(existing.lesson_date);
    } else {
        dateHidden.value = '';
        dateDisp.value   = '';
    }

    document.getElementById('fcCalIcon').onclick = () => {
        if (dateHidden.showPicker) dateHidden.showPicker();
    };
    dateHidden.onchange = () => {
        dateDisp.value = dateHidden.value ? formatDate(dateHidden.value) : '';
    };

    document.getElementById('fcSaveBtn').onclick = () =>
        isEdit ? updateFestClass(existing.id, modal) : createFestClass(modal);
    document.getElementById('fcCancelBtn').onclick = () => { modal.style.display = 'none'; };

    modal.style.display = 'flex';
    document.getElementById('fcName').focus();
}

async function createFestClass(modal) {
    const name = document.getElementById('fcName').value.trim();
    if (!name) { showToast(t('festClasses.nameEmpty'), 'warning'); return; }
    const lesson_date = document.getElementById('fcHiddenDate').value || null;
    if (!lesson_date) { showToast(t('festClasses.dateRequired'), 'warning'); return; }
    const lesson_time = document.getElementById('fcTime').value.trim() || null;

    const { error } = await supabase.from('festival_classes').insert({
        festival_id: appState.currentFestivalId, name, lesson_date, lesson_time
    });
    if (error) { showToast(t('festClasses.toastCreateFail').replace('{msg}', error.message), 'error'); return; }
    showToast(t('festClasses.toastCreated'), 'success');
    modal.style.display = 'none';
    await loadFestivalData();
    renderFestivalDetailView();
}

async function updateFestClass(classId, modal) {
    const name = document.getElementById('fcName').value.trim();
    if (!name) { showToast(t('festClasses.nameEmpty'), 'warning'); return; }
    const lesson_date = document.getElementById('fcHiddenDate').value || null;
    if (!lesson_date) { showToast(t('festClasses.dateRequired'), 'warning'); return; }
    const lesson_time = document.getElementById('fcTime').value.trim() || null;

    const { error } = await supabase.from('festival_classes').update({
        name, lesson_date, lesson_time
    }).eq('id', classId);
    if (error) { showToast(t('festClasses.toastUpdateFail').replace('{msg}', error.message), 'error'); return; }
    showToast(t('festClasses.toastUpdated'), 'success');
    modal.style.display = 'none';
    await loadFestivalData();
    renderFestivalDetailView();
}

// ---------------------------------------------------------------
// Ders detay sayfası
// ---------------------------------------------------------------
function openFestClassDetail(cls) {
    appState.currentFestClassId = cls.id;
    const container = document.getElementById('dynamicView');
    if (!container) return;

    const dateStr  = cls.lesson_date ? formatDate(cls.lesson_date) : '';
    const timeStr  = cls.lesson_time ? cls.lesson_time.substring(0, 5) : '';
    const dt       = [dateStr, timeStr].filter(Boolean).join(' · ');
    const hasVideo = !!cls.video_url;

    container.innerHTML = `
        <div class="view">
            <div class="back-link" id="backToFestDetailBtn">${t('festClasses.backToFestDetail')}</div>
            <div class="main-title">${escapeHtml(cls.name)}</div>
            ${dt ? `<div style="text-align:center;color:var(--text-dim);font-size:13px;margin-bottom:20px;">${dt}</div>` : ''}

            <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:16px;">

                <!-- Katılımcı Sayısı -->
                <div>
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;font-weight:600;">
                        <i data-lucide="users" size="13" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>${t('festClasses.participantLabel')}
                    </div>
                    <input type="number" id="fcParticipantInput" value="${cls.participant_count || ''}"
                        placeholder="${t('festClasses.participantPlaceholder')}" min="0"
                        style="width:100%;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:14px;box-sizing:border-box;">
                </div>

                <!-- Kazanılan Para + Para Birimi -->
                <div>
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;font-weight:600;">
                        <i data-lucide="banknote" size="13" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>${t('festClasses.earnedLabel')}
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <input type="number" id="fcEarnedInput" value="${cls.earned_amount || ''}"
                            placeholder="${t('festClasses.earnedPlaceholder')}" min="0"
                            style="width:55%;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:14px;box-sizing:border-box;">
                        ${currencySelectHtml(appState.currentFestival ? appState.currentFestival.location : '', cls.currency || '')}
                    </div>
                </div>

                <!-- Ders Videosu — kamera ikonu (soluk=yok, canlı=var) -->
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:12px;color:var(--text-dim);font-weight:600;">
                        ${t('festClasses.videoLabel')}
                    </span>
                    <span id="fcVideoIcon" class="vid-icon ${hasVideo ? 'active' : ''}" style="display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;">
                        <i data-lucide="video" size="22" style="pointer-events:none;"></i>
                    </span>
                </div>

                <!-- Partner Adı -->
                <div>
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;font-weight:600;">
                        <i data-lucide="user-round" size="13" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>${t('festClasses.partnerLabel')}
                    </div>
                    <input type="text" id="fcPartnerInput" value="${escapeHtml(cls.partner_name || '')}"
                        placeholder="${t('festClasses.partnerPlaceholder')}"
                        style="width:100%;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;box-sizing:border-box;">
                </div>

                <!-- Ders Notu -->
                <div>
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;font-weight:600;">
                        <i data-lucide="notebook-pen" size="13" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>${t('festClasses.noteLabel')}
                    </div>
                    <textarea id="fcNoteInput" rows="4" placeholder="${t('festClasses.notePlaceholder')}"
                        style="width:100%;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;resize:vertical;box-sizing:border-box;">${escapeHtml(cls.note || '')}</textarea>
                </div>

                <!-- Kaydet -->
                <button id="fcSaveAllBtn" class="btn-success" style="width:100%;padding:13px;font-size:14px;font-weight:700;">
                    <i data-lucide="save" size="15" style="display:inline-block;vertical-align:middle;margin-right:6px;"></i>${t('festClasses.saveAll')}
                </button>

            </div>
        </div>
    `;

    // Geri
    document.getElementById('backToFestDetailBtn').onclick = () => {
        navigateTo('festivalDetail', {
            festivalId:   appState.currentFestivalId,
            festivalName: appState.currentFestivalName
        });
    };

    // Video ikonu tıklama
    document.getElementById('fcVideoIcon').onclick = () => {
        if (cls.video_url) {
            openFestVideoModal(cls);
        } else {
            openFestVideoAddModal(cls);
        }
    };

    // Kaydet
    document.getElementById('fcSaveAllBtn').onclick = async () => {
        const participant_count = parseInt(document.getElementById('fcParticipantInput').value) || 0;
        const earned_amount     = parseFloat(document.getElementById('fcEarnedInput').value)    || 0;
        const currency          = document.getElementById('fcCurrencySelect')
                                  ? document.getElementById('fcCurrencySelect').value : null;
        const partner_name      = document.getElementById('fcPartnerInput').value.trim() || null;
        const note              = document.getElementById('fcNoteInput').value.trim()    || null;

        const { error } = await supabase.from('festival_classes').update({
            participant_count, earned_amount, currency, partner_name, note
        }).eq('id', cls.id);

        if (error) { showToast(t('festClasses.toastSaveFail').replace('{msg}', error.message), 'error'); return; }
        showToast(t('festClasses.toastSaved'), 'success');

        const idx = (appState.festivalClasses || []).findIndex(c => String(c.id) === String(cls.id));
        if (idx !== -1) Object.assign(appState.festivalClasses[idx], {
            participant_count, earned_amount, currency, partner_name, note
        });
    };

    refreshIcons();
}

// ---------------------------------------------------------------
// Video ekleme modalı (URL giriş)
// ---------------------------------------------------------------
function openFestVideoAddModal(cls) {
    const { openPromptModal } = window._tcmsUtils || {};
    // utils'ten openPromptModal'ı kullanalım
    import('./utils.js').then(({ openPromptModal }) => {
        openPromptModal(t('festClasses.videoAddTitle'), 'https://youtube.com/...', async (url) => {
            if (!url || !url.startsWith('http')) {
                showToast(t('festClasses.videoUrlInvalid'), 'warning');
                return;
            }
            const { error } = await supabase.from('festival_classes')
                .update({ video_url: url }).eq('id', cls.id);
            if (error) { showToast(t('festClasses.videoSaveFail'), 'error'); return; }
            showToast(t('festClasses.videoAdded'), 'success');
            cls.video_url = url;
            const idx = (appState.festivalClasses || []).findIndex(c => String(c.id) === String(cls.id));
            if (idx !== -1) appState.festivalClasses[idx].video_url = url;
            // Detay sayfasını yenile
            openFestClassDetail(cls);
        });
    });
}

// ---------------------------------------------------------------
// Video görüntüleme modalı — embed yok, yeni sekmede/uygulamada açar
// ---------------------------------------------------------------
function openFestVideoModal(cls) {
    const modal     = document.getElementById('festVideoModal');
    const titleEl   = document.getElementById('festVideoModalTitle');
    const linkDisp  = document.getElementById('festVideoLinkDisplay');
    const embedCont = document.getElementById('festVideoEmbedContainer');
    const playBtn   = document.getElementById('festVideoPlayBtn');
    const deleteBtn = document.getElementById('festVideoDeleteBtn');
    const closeBtn  = document.getElementById('festVideoCloseBtn');
    if (!modal) return;

    const url      = cls.video_url;
    const platform = detectVideoPlatform(url);

    // Embed container gizle — tüm videolar yeni sekmede/uygulamada açılır
    if (embedCont) embedCont.style.display = 'none';

    // Başlık — platform rozeti
    titleEl.innerHTML = `
        <i data-lucide="video" size="20" style="color:#2DD4BF;display:inline-block;vertical-align:middle;"></i>
        <span style="vertical-align:middle;"> Ders Videosu</span>
        <span style="display:inline-block;vertical-align:middle;margin-left:8px;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:${platform.color}22;color:${platform.color};border:1px solid ${platform.color}55;">${platform.name}</span>
    `;

    linkDisp.textContent    = url;
    linkDisp.style.display  = 'block';
    modal.style.display     = 'flex';
    refreshIcons();

    const watchHandler = () => window.open(url, '_blank');

    const deleteHandler = () => {
        modal.style.display = 'none';
        openConfirmModal(t('festClasses.videoDeleteConfirm'), async () => {
            const { error } = await supabase.from('festival_classes')
                .update({ video_url: null }).eq('id', cls.id);
            if (error) { showToast(t('festClasses.videoDeleteFail'), 'error'); return; }
            showToast(t('festClasses.videoDeleted'), 'success');
            cls.video_url = null;
            const idx = (appState.festivalClasses || []).findIndex(c => String(c.id) === String(cls.id));
            if (idx !== -1) appState.festivalClasses[idx].video_url = null;
            // Sayfayı yenile
            openFestClassDetail(cls);
            cleanup();
        }, () => { modal.style.display = 'flex'; refreshIcons(); });
    };

    const closeHandler = () => { modal.style.display = 'none'; cleanup(); };
    const outsideHandler = (e) => { if (e.target === modal) closeHandler(); };

    const cleanup = () => {
        playBtn.removeEventListener('click', watchHandler);
        deleteBtn.removeEventListener('click', deleteHandler);
        closeBtn.removeEventListener('click', closeHandler);
        modal.removeEventListener('click', outsideHandler);
    };

    playBtn.removeEventListener('click', watchHandler);
    deleteBtn.removeEventListener('click', deleteHandler);
    closeBtn.removeEventListener('click', closeHandler);
    modal.removeEventListener('click', outsideHandler);

    playBtn.addEventListener('click', watchHandler);
    deleteBtn.addEventListener('click', deleteHandler);
    closeBtn.addEventListener('click', closeHandler);
    modal.addEventListener('click', outsideHandler);
}