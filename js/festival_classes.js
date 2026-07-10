// ---------------------------------------------------------------
// festival_classes.js — FESTİVAL DERSLERİ MODÜLÜ
// ADIM 5.3 + 5.4 + 5.5 — Ders listesi, oluşturma, detay sayfası
// ---------------------------------------------------------------
// Festival dersleri YOKLAMA İÇERMEZ, ÖĞRENCİ LİSTESİ YOKTUR.
// Her ders için: ad, tarih, saat, katılımcı sayısı,
//               kazanılan para, video, partner, not.
//
// TABLO YAPISI (Supabase):
//   festivals:       id, user_id, name, location, start_date, end_date, is_archived
//   festival_classes: id, festival_id, name, lesson_date, lesson_time,
//                    participant_count, earned_amount, video_url,
//                    partner_name, note, is_archived
// ---------------------------------------------------------------

import { supabase } from './supabaseClient.js';
import { COUNTRY_CURRENCY } from './festivals.js';
import { refreshIcons, openConfirmModal, openPromptModalWithValue, showToast, escapeHtml, formatDate } from './utils.js';
import { navigateTo } from './router.js';
import { appState } from './state.js';

// ---------------------------------------------------------------
// VIDEO PLATFORM TESPİTİ VE EMBED
// ---------------------------------------------------------------
function detectVideoPlatform(url) {
    if (!url) return { name: 'Diğer', color: '#94a3b8', canEmbed: false };
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
    return { name: 'Diğer', color: '#94a3b8', canEmbed: false };
}

// YouTube veya Vimeo URL'sini embed URL'sine çevir
function toEmbedUrl(url) {
    const lower = url.toLowerCase();
    // YouTube: watch?v=ID veya youtu.be/ID → embed/ID
    if (lower.includes('youtube.com/watch')) {
        try {
            const u  = new URL(url);
            const id = u.searchParams.get('v');
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
    // Vimeo: vimeo.com/ID → player.vimeo.com/video/ID
    if (lower.includes('vimeo.com/')) {
        const id = url.split('vimeo.com/')[1].split('?')[0].split('/')[0];
        if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
    return null;
}

// Video bölümü HTML'i — embed veya link
function buildVideoHtml(videoUrl) {
    if (!videoUrl) return '';
    const platform  = detectVideoPlatform(videoUrl);
    const embedUrl  = platform.canEmbed ? toEmbedUrl(videoUrl) : null;
    const badge     = `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:${platform.color}22;color:${platform.color};border:1px solid ${platform.color}55;margin-left:6px;vertical-align:middle;">${platform.name}</span>`;

    if (embedUrl) {
        return `
            <div style="margin-top:6px;">
                <div style="position:relative;padding-bottom:56.25%;height:0;border-radius:10px;overflow:hidden;background:#000;">
                    <iframe src="${embedUrl}" frameborder="0" allowfullscreen
                        style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe>
                </div>
                <div style="margin-top:6px;">${badge} <a href="${escapeHtml(videoUrl)}" target="_blank" style="font-size:11px;color:var(--primary);">Yeni sekmede aç</a></div>
            </div>`;
    }
    return `<div style="margin-top:6px;">${badge} <a href="${escapeHtml(videoUrl)}" target="_blank" style="font-size:11px;color:var(--primary);">Videoyu Aç</a></div>`;
}

// ---------------------------------------------------------------
// Para birimi dropdown HTML'i
// Festivaldeki ülkeye göre o ülkenin para birimi en üstte gelir,
// ardından $ USD ve € EUR sabit olarak yer alır, sonra diğerleri.
// ---------------------------------------------------------------
function currencySelectHtml(festivalLocation, savedCurrency) {
    // Ülkeyi location string'inden al: 'Paris, Fransa' → 'Fransa'
    let countryName = '';
    if (festivalLocation) {
        const parts = festivalLocation.split(',');
        countryName = parts.length >= 2 ? parts[parts.length - 1].trim() : '';
    }
    const countryCurrency = COUNTRY_CURRENCY[countryName] || null;

    // Sabit listeler
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

    // Önce ülke para birimi, sonra USD/EUR (zaten listede yoksa), sonra kalanlar
    const top = [];
    if (countryCurrency) top.push(countryCurrency);
    if (!top.includes('$ USD')) top.push('$ USD');
    if (!top.includes('€ EUR')) top.push('€ EUR');
    const rest = allCurrencies.filter(c => !top.includes(c));
    const ordered = [...top, ...rest];

    const selected = savedCurrency || top[0] || '$ USD';
    const opts = ordered.map(c =>
        `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`
    ).join('');

    return `<select id="fcCurrencySelect"
        style="background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;min-width:110px;">
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
        .from('festival_classes')
        .select('*')
        .eq('festival_id', fid)
        .order('lesson_date', { ascending: true });
    appState.festivalClasses = classes || [];
}

// ---------------------------------------------------------------
// Festival detay sayfasını çiz (ders listesi)
// ---------------------------------------------------------------
function renderFestivalDetailView() {
    const container = document.getElementById('dynamicView');
    if (!container) return;

    const fest    = appState.currentFestival;
    const classes = (appState.festivalClasses || []).filter(c => !c.is_archived);

    // Üst bilgi kutusu
    let infoHtml = '';
    if (fest) {
        const dateStr  = fest.start_date ? formatDate(fest.start_date) : '';
        const dateEnd  = fest.end_date   ? ' – ' + formatDate(fest.end_date) : '';
        const loc      = fest.location   ? escapeHtml(fest.location) : '';
        infoHtml = `
        <div style="background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.25);border-radius:14px;padding:14px 16px;margin-bottom:16px;">
            <div style="font-size:12px;color:var(--text-dim);line-height:1.9;">
                ${loc  ? '<div><b>Lokasyon:</b> ' + loc + '</div>' : ''}
                ${dateStr ? '<div><b>Tarih:</b> ' + dateStr + dateEnd + '</div>' : ''}
            </div>
        </div>`;
    }

    // Ders kartları
    let classesHtml = '';
    if (classes.length === 0) {
        classesHtml = `<div style="text-align:center;color:var(--text-dim);padding:20px;">Henüz ders eklenmemiş.</div>`;
    } else {
        classes.forEach(c => {
            const dateStr = c.lesson_date ? formatDate(c.lesson_date) : '';
            const timeStr = c.lesson_time ? c.lesson_time.substring(0, 5) : '';
            const dt      = [dateStr, timeStr].filter(Boolean).join(' · ');

            classesHtml += `
            <div class="class-card" style="cursor:pointer;" data-fc-goto="${c.id}">
                <div style="flex:1;">
                    <div style="font-weight:700;font-size:15px;color:var(--text-main);">${escapeHtml(c.name)}</div>
                    ${dt ? `<div style="font-size:12px;color:var(--text-dim);margin-top:3px;">${dt}</div>` : ''}
                    <div style="font-size:11px;color:var(--primary);margin-top:2px;display:flex;gap:10px;flex-wrap:wrap;">
                        ${c.participant_count ? `<span>👥 ${c.participant_count} katılımcı</span>` : ''}
                        ${c.earned_amount     ? `<span>💰 ${Number(c.earned_amount).toLocaleString('tr-TR')} ${c.currency || ''}</span>` : ''}
                        ${c.video_url         ? `<span>🎬 Video</span>` : ''}
                    </div>
                </div>
                <i data-lucide="chevron-right" size="20" style="color:var(--primary);flex-shrink:0;pointer-events:none;"></i>
            </div>`;
        });
    }

    container.innerHTML = `
        <div class="view">
            <div class="back-link" id="backToFestivalsBtn">← Festivaller</div>
            <div class="main-title">Festival Dersleri</div>
            <h2 style="text-align:center;font-size:18px;color:var(--primary);margin-bottom:12px;">${escapeHtml(appState.currentFestivalName || '')}</h2>
            ${infoHtml}
            <div class="nav-buttons" style="margin-bottom:16px;">
                <button class="btn-success" id="addFestClassBtn">
                    <i data-lucide="plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>Ders Ekle
                </button>
            </div>
            <div id="festClassesList">${classesHtml}</div>
        </div>
    `;

    document.getElementById('backToFestivalsBtn').onclick = () => navigateTo('festivals');
    document.getElementById('addFestClassBtn').onclick    = () => openFestClassModal();

    document.querySelectorAll('[data-fc-goto]').forEach(el => {
        el.addEventListener('click', () => {
            const cid = el.dataset.fcGoto;
            const cls = (appState.festivalClasses || []).find(x => String(x.id) === String(cid));
            if (cls) openFestClassDetail(cls);
        });
    });

    refreshIcons();
}

// ---------------------------------------------------------------
// ADIM 5.4 — Ders oluşturma modalı
// ---------------------------------------------------------------
function openFestClassModal(existing) {
    const modal = document.getElementById('festClassModal');
    if (!modal) { showToast('Modal bulunamadı.', 'error'); return; }

    const isEdit = !!existing;
    modal.querySelector('h3').textContent = isEdit ? 'Dersi Düzenle' : 'Yeni Ders Ekle';

    document.getElementById('fcName').value = existing ? (existing.name || '') : '';
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
    if (!name) { showToast('Ders adı boş olamaz.', 'warning'); return; }

    const lesson_date = document.getElementById('fcHiddenDate').value || null;
    if (!lesson_date) { showToast('Tarih seçiniz.', 'warning'); return; }

    const timeVal = document.getElementById('fcTime').value.trim();
    const lesson_time = timeVal || null;

    const { error } = await supabase.from('festival_classes').insert({
        festival_id:  appState.currentFestivalId,
        name,
        lesson_date,
        lesson_time
    });

    if (error) { showToast('Ders oluşturulamadı: ' + error.message, 'error'); return; }

    showToast('Ders oluşturuldu ✓', 'success');
    modal.style.display = 'none';
    await loadFestivalData();
    renderFestivalDetailView();
}

async function updateFestClass(classId, modal) {
    const name = document.getElementById('fcName').value.trim();
    if (!name) { showToast('Ders adı boş olamaz.', 'warning'); return; }

    const lesson_date = document.getElementById('fcHiddenDate').value || null;
    if (!lesson_date) { showToast('Tarih seçiniz.', 'warning'); return; }

    const timeVal = document.getElementById('fcTime').value.trim();

    const { error } = await supabase.from('festival_classes').update({
        name,
        lesson_date,
        lesson_time: timeVal || null
    }).eq('id', classId);

    if (error) { showToast('Güncelleme başarısız: ' + error.message, 'error'); return; }

    showToast('Ders güncellendi ✓', 'success');
    modal.style.display = 'none';
    await loadFestivalData();
    renderFestivalDetailView();
}

// ---------------------------------------------------------------
// ADIM 5.5 — Ders detay sayfası
// Tüm alanlar tek Kaydet butonuyla kaydedilir.
// Düzenle/Sil: ders listesindeki ikonlardan yapılır.
// ---------------------------------------------------------------
function openFestClassDetail(cls) {
    appState.currentFestClassId = cls.id;
    const container = document.getElementById('dynamicView');
    if (!container) return;

    const dateStr = cls.lesson_date ? formatDate(cls.lesson_date) : '';
    const timeStr = cls.lesson_time ? cls.lesson_time.substring(0, 5) : '';
    const dt      = [dateStr, timeStr].filter(Boolean).join(' · ');

    container.innerHTML = `
        <div class="view">
            <div class="back-link" id="backToFestDetailBtn">← Festival Dersleri</div>
            <div class="main-title">${escapeHtml(cls.name)}</div>
            ${dt ? `<div style="text-align:center;color:var(--text-dim);font-size:13px;margin-bottom:20px;">${dt}</div>` : ''}

            <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:14px;">

                <!-- Katılımcı Sayısı -->
                <div>
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;font-weight:600;">
                        <i data-lucide="users" size="13" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>Katılımcı Sayısı
                    </div>
                    <input type="number" id="fcParticipantInput" value="${cls.participant_count || ''}"
                        placeholder="Katılımcı sayısı" min="0"
                        style="width:100%;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:14px;box-sizing:border-box;">
                </div>

                <!-- Kazanılan Para + Para Birimi -->
                <div>
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;font-weight:600;">
                        <i data-lucide="banknote" size="13" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>Kazanılan Para
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <input type="number" id="fcEarnedInput" value="${cls.earned_amount || ''}"
                            placeholder="Tutar" min="0"
                            style="flex:1;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:14px;box-sizing:border-box;">
                        ${currencySelectHtml(appState.currentFestival ? appState.currentFestival.location : '', cls.currency || '')}
                    </div>
                </div>

                <!-- Video URL -->
                <div>
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;font-weight:600;">
                        <i data-lucide="video" size="13" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>Video URL
                    </div>
                    <input type="text" id="fcVideoInput" value="${escapeHtml(cls.video_url || '')}"
                        placeholder="YouTube, Vimeo, Google Drive, Instagram..."
                        style="width:100%;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;box-sizing:border-box;">
                    ${buildVideoHtml(cls.video_url)}
                </div>

                <!-- Partner Adı -->
                <div>
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;font-weight:600;">
                        <i data-lucide="user-round" size="13" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>Partner Adı
                    </div>
                    <input type="text" id="fcPartnerInput" value="${escapeHtml(cls.partner_name || '')}"
                        placeholder="Partner adı (opsiyonel)"
                        style="width:100%;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;box-sizing:border-box;">
                </div>

                <!-- Ders Notu -->
                <div>
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;font-weight:600;">
                        <i data-lucide="notebook-pen" size="13" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>Ders Notu
                    </div>
                    <textarea id="fcNoteInput" rows="4" placeholder="Ders notları..."
                        style="width:100%;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;resize:vertical;box-sizing:border-box;">${escapeHtml(cls.note || '')}</textarea>
                </div>

                <!-- TEK KAYDET BUTONU -->
                <button id="fcSaveAllBtn" class="btn-success" style="width:100%;padding:13px;font-size:14px;font-weight:700;">
                    <i data-lucide="save" size="15" style="display:inline-block;vertical-align:middle;margin-right:6px;"></i>Kaydet
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

    // Tek Kaydet butonu — tüm alanları tek seferde kaydeder
    document.getElementById('fcSaveAllBtn').onclick = async () => {
        const participant_count = parseInt(document.getElementById('fcParticipantInput').value) || 0;
        const earned_amount     = parseFloat(document.getElementById('fcEarnedInput').value)    || 0;
        const currency          = document.getElementById('fcCurrencySelect') ? document.getElementById('fcCurrencySelect').value : null;
        const video_url         = document.getElementById('fcVideoInput').value.trim()           || null;
        const partner_name      = document.getElementById('fcPartnerInput').value.trim()         || null;
        const note              = document.getElementById('fcNoteInput').value.trim()             || null;

        const { error } = await supabase.from('festival_classes').update({
            participant_count, earned_amount, currency, video_url, partner_name, note
        }).eq('id', cls.id);

        if (error) { showToast('Kayıt başarısız: ' + error.message, 'error'); return; }
        showToast('Kaydedildi ✓', 'success');

        // Lokal state güncelle
        const idx = (appState.festivalClasses || []).findIndex(c => String(c.id) === String(cls.id));
        if (idx !== -1) Object.assign(appState.festivalClasses[idx], {
            participant_count, earned_amount, currency, video_url, partner_name, note
        });
    };

    refreshIcons();
}
// ---------------------------------------------------------------
// Tek alan kaydetme yardımcısı
// ---------------------------------------------------------------
async function saveFestClassField(classId, field, value, successMsg) {
    const { error } = await supabase.from('festival_classes')
        .update({ [field]: value }).eq('id', classId);
    if (error) { showToast('Kayıt başarısız: ' + error.message, 'error'); return; }
    showToast(successMsg, 'success');

    // Lokal state güncelle (sayfayı yeniden çizmeden)
    const idx = (appState.festivalClasses || []).findIndex(c => String(c.id) === String(classId));
    if (idx !== -1) appState.festivalClasses[idx][field] = value;
}