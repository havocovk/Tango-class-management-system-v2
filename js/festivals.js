// ---------------------------------------------------------------
// festivals.js — FESTİVAL LİSTESİ MODÜLÜ
// ADIM 5.1 + 5.2 — Festival listesi, oluşturma, düzenleme, arşiv
// ---------------------------------------------------------------

import { supabase } from './supabaseClient.js';
import { refreshIcons, openConfirmModal, showToast, escapeHtml, formatDate } from './utils.js';
import { navigateTo } from './router.js';
import { appState } from './state.js';

// ---------------------------------------------------------------
// Giriş noktası — router.js çağırır
// ---------------------------------------------------------------
export async function loadFestivals() {
    await fetchFestivals();
    renderFestivalsView();
}

// ---------------------------------------------------------------
// Supabase'den festivalleri çek
// ---------------------------------------------------------------
async function fetchFestivals() {
    const { data, error } = await supabase
        .from('festivals')
        .select('*')
        .order('start_date', { ascending: false });

    if (error) {
        showToast('Festivaller yüklenemedi.', 'error');
        appState.festivalsList = [];
    } else {
        appState.festivalsList = data || [];
    }
}

// ---------------------------------------------------------------
// Festival listesini çiz
// ---------------------------------------------------------------
function renderFestivalsView() {
    const container = document.getElementById('dynamicView');
    if (!container) return;

    const active   = (appState.festivalsList || []).filter(f => !f.is_archived);
    const archived = (appState.festivalsList || []).filter(f =>  f.is_archived);
    const showArch = appState.showArchivedFestivals || false;
    const displayed = showArch ? archived : active;

    let listHtml = '';
    if (displayed.length === 0) {
        listHtml = `<div style="text-align:center; color:var(--text-dim); padding:20px;">
            ${showArch ? 'Arşivlenmiş festival yok.' : 'Henüz festival eklenmemiş.'}
        </div>`;
    } else {
        displayed.forEach(f => {
            const opacity  = f.is_archived ? 'opacity:0.5;' : '';
            const dateStr  = f.start_date ? formatDate(f.start_date) : '';
            const dateEnd  = f.end_date   ? ' – ' + formatDate(f.end_date) : '';
            const loc      = f.location   ? escapeHtml(f.location) + ' · ' : '';

            listHtml += `
            <div class="class-card" style="${opacity}" data-festival-id="${f.id}">
                <div style="flex:1; cursor:pointer;" data-fest-goto="${f.id}">
                    <div style="font-weight:700; font-size:15px; color:var(--text-main);">${escapeHtml(f.name)}</div>
                    <div style="font-size:12px; color:var(--text-dim); margin-top:3px;">
                        ${loc}${dateStr}${dateEnd}
                    </div>
                </div>
                <div style="display:flex; gap:15px; align-items:center;">
                    <div class="fest-btn-edit" data-fest-id="${f.id}" style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; min-width:44px; min-height:44px; color:var(--primary); position:relative; z-index:2;">
                        <i data-lucide="pencil" size="20" style="pointer-events:none;"></i>
                    </div>
                    <div class="fest-btn-archive" data-fest-id="${f.id}" data-fest-archived="${f.is_archived ? '1' : '0'}" style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; min-width:44px; min-height:44px; color:var(--accent); position:relative; z-index:2;">
                        <i data-lucide="${f.is_archived ? 'archive-restore' : 'archive'}" size="20" style="pointer-events:none;"></i>
                    </div>
                    <div class="fest-btn-delete" data-fest-id="${f.id}" style="cursor:pointer; display:inline-flex; align-items:center; justify-content:center; min-width:44px; min-height:44px; color:var(--danger); position:relative; z-index:2;">
                        <i data-lucide="trash-2" size="20" style="pointer-events:none;"></i>
                    </div>
                </div>
            </div>`;
        });
    }

    container.innerHTML = `
        <div class="view">
            <div class="back-link" id="backToMenuBtn">← Ana Menü</div>
            <div class="main-title">Festivaller</div>
            <div id="festivalsListContainer">${listHtml}</div>
            <div class="nav-buttons" style="margin-top:20px;">
                <button class="btn-success" id="addFestivalBtn">
                    <i data-lucide="plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>Festival Ekle
                </button>
            </div>
            <div class="nav-buttons" style="margin-top:10px;">
                <button class="btn-secondary" id="toggleArchivedFestivalsBtn">
                    <i data-lucide="archive" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>
                    ${showArch ? 'Arşivi Gizle' : 'Arşivi Göster'}
                </button>
            </div>
        </div>
    `;

    document.getElementById('backToMenuBtn').onclick    = () => navigateTo('mainMenu');
    document.getElementById('addFestivalBtn').onclick   = () => openFestivalModal();
    document.getElementById('toggleArchivedFestivalsBtn').onclick = () => {
        appState.showArchivedFestivals = !appState.showArchivedFestivals;
        renderFestivalsView();
    };

    document.querySelectorAll('[data-fest-goto]').forEach(el => {
        el.addEventListener('click', () => {
            const fid = el.dataset.festGoto;
            const f   = (appState.festivalsList || []).find(x => String(x.id) === String(fid));
            if (f) navigateTo('festivalDetail', { festivalId: f.id, festivalName: f.name });
        });
    });

    document.querySelectorAll('.fest-btn-edit').forEach(el => {
        el.onclick = (e) => {
            e.stopPropagation();
            const fid = el.dataset.festId;
            const f   = (appState.festivalsList || []).find(x => String(x.id) === String(fid));
            if (f) openFestivalModal(f);
        };
    });

    document.querySelectorAll('.fest-btn-archive').forEach(el => {
        el.onclick = (e) => {
            e.stopPropagation();
            const fid        = el.dataset.festId;
            const isArchived = el.dataset.festArchived === '1';
            archiveFestival(fid, !isArchived);
        };
    });

    document.querySelectorAll('.fest-btn-delete').forEach(el => {
        el.onclick = (e) => {
            e.stopPropagation();
            deleteFestival(el.dataset.festId);
        };
    });

    refreshIcons();
}

// ---------------------------------------------------------------
// Festival oluşturma / düzenleme modalı
// ---------------------------------------------------------------
function openFestivalModal(existing) {
    const modal = document.getElementById('festivalCreateModal');
    if (!modal) { showToast('Modal bulunamadı.', 'error'); return; }

    const isEdit = !!existing;
    modal.querySelector('h3').textContent = isEdit ? 'Festivali Düzenle' : 'Yeni Festival Ekle';

    // Alanları doldur / sıfırla
    document.getElementById('festName').value     = existing ? (existing.name     || '') : '';
    document.getElementById('festLocation').value = existing ? (existing.location || '') : '';

    const startDisp   = document.getElementById('festStartDateDisplay');
    const startHidden = document.getElementById('festHiddenStartDate');
    const endDisp     = document.getElementById('festEndDateDisplay');
    const endHidden   = document.getElementById('festHiddenEndDate');

    if (existing && existing.start_date) {
        startHidden.value = existing.start_date;
        startDisp.value   = formatDate(existing.start_date);
    } else {
        startHidden.value = '';
        startDisp.value   = '';
    }
    if (existing && existing.end_date) {
        endHidden.value = existing.end_date;
        endDisp.value   = formatDate(existing.end_date);
    } else {
        endHidden.value = '';
        endDisp.value   = '';
    }

    // Takvim ikonları
    document.getElementById('festStartCalIcon').onclick = () => {
        if (startHidden.showPicker) startHidden.showPicker();
    };
    startHidden.onchange = () => {
        startDisp.value = startHidden.value ? formatDate(startHidden.value) : '';
    };
    document.getElementById('festEndCalIcon').onclick = () => {
        if (endHidden.showPicker) endHidden.showPicker();
    };
    endHidden.onchange = () => {
        endDisp.value = endHidden.value ? formatDate(endHidden.value) : '';
    };

    document.getElementById('festSaveBtn').onclick = () =>
        isEdit ? updateFestival(existing.id, modal) : createFestival(modal);
    document.getElementById('festCancelBtn').onclick = () => {
        modal.style.display = 'none';
    };

    modal.style.display = 'flex';
    document.getElementById('festName').focus();
}

// ---------------------------------------------------------------
// Festival oluştur
// ---------------------------------------------------------------
async function createFestival(modal) {
    const name     = document.getElementById('festName').value.trim();
    if (!name) { showToast('Festival adı boş olamaz.', 'warning'); return; }

    const location   = document.getElementById('festLocation').value.trim()       || null;
    const start_date = document.getElementById('festHiddenStartDate').value        || null;
    const end_date   = document.getElementById('festHiddenEndDate').value          || null;

    if (!start_date) { showToast('Başlangıç tarihi seçiniz.', 'warning'); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showToast('Oturum bulunamadı.', 'error'); return; }

    const { error } = await supabase.from('festivals').insert({
        user_id: user.id, name, location, start_date, end_date
    });

    if (error) { showToast('Festival oluşturulamadı: ' + error.message, 'error'); return; }

    showToast('Festival oluşturuldu ✓', 'success');
    modal.style.display = 'none';
    await fetchFestivals();
    renderFestivalsView();
}

// ---------------------------------------------------------------
// Festival güncelle
// ---------------------------------------------------------------
async function updateFestival(festId, modal) {
    const name = document.getElementById('festName').value.trim();
    if (!name) { showToast('Festival adı boş olamaz.', 'warning'); return; }

    const location   = document.getElementById('festLocation').value.trim()  || null;
    const start_date = document.getElementById('festHiddenStartDate').value   || null;
    const end_date   = document.getElementById('festHiddenEndDate').value     || null;

    if (!start_date) { showToast('Başlangıç tarihi seçiniz.', 'warning'); return; }

    const { error } = await supabase.from('festivals').update({
        name, location, start_date, end_date
    }).eq('id', festId);

    if (error) { showToast('Güncelleme başarısız: ' + error.message, 'error'); return; }

    showToast('Festival güncellendi ✓', 'success');
    modal.querySelector('h3').textContent = 'Yeni Festival Ekle';
    modal.style.display = 'none';
    await fetchFestivals();
    renderFestivalsView();
}

// ---------------------------------------------------------------
// Arşivle / arşivden çıkar
// ---------------------------------------------------------------
async function archiveFestival(festId, makeArchived) {
    const { error } = await supabase.from('festivals')
        .update({ is_archived: makeArchived }).eq('id', festId);
    if (error) { showToast('İşlem başarısız.', 'error'); return; }
    showToast(makeArchived ? 'Festival arşivlendi ✓' : 'Festival arşivden çıkarıldı ✓', 'success');
    if (makeArchived) appState.showArchivedFestivals = false;
    await fetchFestivals();
    renderFestivalsView();
}

// ---------------------------------------------------------------
// Sil
// ---------------------------------------------------------------
async function deleteFestival(festId) {
    openConfirmModal('Bu festivali silmek istediğinizden emin misiniz? Tüm dersler de silinir.', async () => {
        const { error } = await supabase.from('festivals').delete().eq('id', festId);
        if (error) { showToast('Silme işlemi başarısız.', 'error'); return; }
        showToast('Festival silindi ✓', 'success');
        await fetchFestivals();
        renderFestivalsView();
    });
}