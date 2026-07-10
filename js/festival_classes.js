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
import { refreshIcons, openConfirmModal, openPromptModalWithValue, showToast, escapeHtml, formatDate } from './utils.js';
import { navigateTo } from './router.js';
import { appState } from './state.js';

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
                        ${c.earned_amount     ? `<span>💰 ${Number(c.earned_amount).toLocaleString('tr-TR')}₺</span>` : ''}
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
// ADIM 5.5 — Ders detay sayfası (inline düzenleme)
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

            <div style="display:flex;flex-direction:column;gap:14px;">

                <!-- Katılımcı Sayısı -->
                <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;">
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;font-weight:600;">
                        <i data-lucide="users" size="13" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>Katılımcı Sayısı
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <input type="number" id="fcParticipantInput" value="${cls.participant_count || ''}"
                            placeholder="Katılımcı sayısı" min="0"
                            style="flex:1;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:14px;">
                        <button id="fcSaveParticipant" class="btn-success" style="flex:none;min-width:auto;width:auto;padding:10px 14px;font-size:13px;">
                            <i data-lucide="check" size="14" style="display:inline-block;vertical-align:middle;"></i>
                        </button>
                    </div>
                </div>

                <!-- Kazanılan Para -->
                <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;">
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;font-weight:600;">
                        <i data-lucide="banknote" size="13" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>Kazanılan Para (₺)
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <input type="number" id="fcEarnedInput" value="${cls.earned_amount || ''}"
                            placeholder="Tutar" min="0"
                            style="flex:1;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:14px;">
                        <button id="fcSaveEarned" class="btn-success" style="flex:none;min-width:auto;width:auto;padding:10px 14px;font-size:13px;">
                            <i data-lucide="check" size="14" style="display:inline-block;vertical-align:middle;"></i>
                        </button>
                    </div>
                </div>

                <!-- Video URL -->
                <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;">
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;font-weight:600;">
                        <i data-lucide="video" size="13" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>Video URL
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <input type="text" id="fcVideoInput" value="${escapeHtml(cls.video_url || '')}"
                            placeholder="https://youtube.com/..."
                            style="flex:1;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;">
                        <button id="fcSaveVideo" class="btn-success" style="flex:none;min-width:auto;width:auto;padding:10px 14px;font-size:13px;">
                            <i data-lucide="check" size="14" style="display:inline-block;vertical-align:middle;"></i>
                        </button>
                    </div>
                    ${cls.video_url ? `<a href="${escapeHtml(cls.video_url)}" target="_blank" style="display:inline-block;margin-top:8px;font-size:11px;color:var(--primary);">🎬 Videoyu Aç</a>` : ''}
                </div>

                <!-- Partner Adı -->
                <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;">
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;font-weight:600;">
                        <i data-lucide="user-round" size="13" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>Partner Adı
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <input type="text" id="fcPartnerInput" value="${escapeHtml(cls.partner_name || '')}"
                            placeholder="Partner adı (opsiyonel)"
                            style="flex:1;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;">
                        <button id="fcSavePartner" class="btn-success" style="flex:none;min-width:auto;width:auto;padding:10px 14px;font-size:13px;">
                            <i data-lucide="check" size="14" style="display:inline-block;vertical-align:middle;"></i>
                        </button>
                    </div>
                </div>

                <!-- Ders Notu -->
                <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;">
                    <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;font-weight:600;">
                        <i data-lucide="notebook-pen" size="13" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>Ders Notu
                    </div>
                    <textarea id="fcNoteInput" rows="4" placeholder="Ders notları..."
                        style="width:100%;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;resize:vertical;box-sizing:border-box;">${escapeHtml(cls.note || '')}</textarea>
                    <button id="fcSaveNote" class="btn-success" style="margin-top:8px;width:100%;">
                        <i data-lucide="check" size="14" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>Notu Kaydet
                    </button>
                </div>

                <!-- Düzenle / Sil -->
                <div style="display:flex;gap:10px;margin-top:4px;">
                    <button id="fcEditBtn" class="btn-secondary" style="flex:1;">
                        <i data-lucide="pencil" size="14" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>Dersi Düzenle
                    </button>
                    <button id="fcDeleteBtn" class="btn-danger" style="flex:1;">
                        <i data-lucide="trash-2" size="14" style="display:inline-block;vertical-align:middle;margin-right:4px;"></i>Dersi Sil
                    </button>
                </div>

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

    // Kaydet butonları
    document.getElementById('fcSaveParticipant').onclick = () =>
        saveFestClassField(cls.id, 'participant_count',
            parseInt(document.getElementById('fcParticipantInput').value) || 0, 'Katılımcı sayısı kaydedildi ✓');

    document.getElementById('fcSaveEarned').onclick = () =>
        saveFestClassField(cls.id, 'earned_amount',
            parseFloat(document.getElementById('fcEarnedInput').value) || 0, 'Tutar kaydedildi ✓');

    document.getElementById('fcSaveVideo').onclick = () =>
        saveFestClassField(cls.id, 'video_url',
            document.getElementById('fcVideoInput').value.trim() || null, 'Video kaydedildi ✓');

    document.getElementById('fcSavePartner').onclick = () =>
        saveFestClassField(cls.id, 'partner_name',
            document.getElementById('fcPartnerInput').value.trim() || null, 'Partner kaydedildi ✓');

    document.getElementById('fcSaveNote').onclick = () =>
        saveFestClassField(cls.id, 'note',
            document.getElementById('fcNoteInput').value.trim() || null, 'Not kaydedildi ✓');

    // Düzenle
    document.getElementById('fcEditBtn').onclick = () => openFestClassModal(cls);

    // Sil
    document.getElementById('fcDeleteBtn').onclick = () => {
        openConfirmModal('Bu dersi silmek istediğinizden emin misiniz?', async () => {
            const { error } = await supabase.from('festival_classes').delete().eq('id', cls.id);
            if (error) { showToast('Silme başarısız.', 'error'); return; }
            showToast('Ders silindi ✓', 'success');
            await loadFestivalData();
            renderFestivalDetailView();
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