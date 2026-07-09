// ---------------------------------------------------------------
// workshops.js — ÇALIŞTAY LİSTESİ MODÜLÜ
// ADIM 4.1 — Çalıştayları listele, arşivle, sil
// ---------------------------------------------------------------

import { supabase } from './supabaseClient.js';
import { refreshIcons, openConfirmModal, showToast, escapeHtml } from './utils.js';
import { navigateTo } from './router.js';
import { appState } from './state.js';

// ---------------------------------------------------------------
// loadWorkshops — router.js tarafından çağrılır
// ---------------------------------------------------------------
export async function loadWorkshops() {
    await fetchWorkshops();
    renderWorkshopsView();
}

// ---------------------------------------------------------------
// fetchWorkshops — Supabase'den çalıştayları çeker
// ---------------------------------------------------------------
async function fetchWorkshops() {
    const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .order('start_date', { ascending: false });

    if (error) {
        showToast('Çalıştaylar yüklenemedi.', 'error');
        appState.workshopsList = [];
    } else {
        appState.workshopsList = data || [];
    }
}

// ---------------------------------------------------------------
// renderWorkshopsView — DOM'a yazar
// ---------------------------------------------------------------
function renderWorkshopsView() {
    const container = document.getElementById('dynamicView');
    if (!container) return;

    const active   = (appState.workshopsList || []).filter(w => !w.is_archived);
    const archived = (appState.workshopsList || []).filter(w =>  w.is_archived);
    const showArch = appState.showArchivedWorkshops || false;

    let listHtml = '';
    const displayed = showArch ? archived : active;

    if (displayed.length === 0) {
        listHtml = `<div style="text-align:center; color:var(--text-dim); padding:20px;">
            ${showArch ? 'Arşivlenmiş çalıştay yok.' : 'Henüz çalıştay eklenmemiş.'}
        </div>`;
    } else {
        displayed.forEach(w => {
            const payType  = w.payment_type === 'upfront' ? 'Baştan Ödeme' : 'Haftalık Ödeme';
            const weeks    = w.total_weeks ? `${w.total_weeks} hafta` : '';
            const dateStr  = w.start_date ? w.start_date.split('T')[0] : '';
            const opacity  = w.is_archived ? 'opacity:0.5;' : '';

            listHtml += `
            <div class="class-card" style="${opacity}" data-workshop-id="${w.id}">
                <div style="flex:1; cursor:pointer;" data-ws-goto="${w.id}">
                    <div style="font-weight:700; font-size:15px; color:var(--text-main);">${escapeHtml(w.name)}</div>
                    <div style="font-size:12px; color:var(--text-dim); margin-top:3px;">
                        ${w.studio_name ? escapeHtml(w.studio_name) + ' · ' : ''}${weeks}${weeks && dateStr ? ' · ' : ''}${dateStr}
                    </div>
                    <div style="font-size:11px; color:var(--primary); margin-top:2px;">${payType}</div>
                </div>
                <div style="display:flex; gap:15px; align-items:center;">
                    <span class="btn-icon-archive" data-ws-id="${w.id}" data-ws-archived="${w.is_archived ? '1' : '0'}" style="color:var(--accent); cursor:pointer; display:inline-flex;">
                        <i data-lucide="${w.is_archived ? 'archive-restore' : 'archive'}" size="20"></i>
                    </span>
                    <span class="btn-icon-delete" data-ws-id="${w.id}" style="cursor:pointer; display:inline-flex; color:var(--danger);">
                        <i data-lucide="trash-2" size="20"></i>
                    </span>
                </div>
            </div>`;
        });
    }

    container.innerHTML = `
        <div class="view">
            <div class="back-link" id="backToMenuBtn">← Ana Menü</div>
            <div class="main-title">Çalıştaylar</div>
            <div id="workshopsListContainer">${listHtml}</div>
            <div class="nav-buttons" style="margin-top:20px;">
                <button class="btn-success" id="addWorkshopBtn">
                    <i data-lucide="plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>Çalıştay Ekle
                </button>
            </div>
            <div class="nav-buttons" style="margin-top:10px;">
                <button class="btn-secondary" id="toggleArchivedWorkshopsBtn">
                    <i data-lucide="archive" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>
                    ${showArch ? 'Arşivi Gizle' : 'Arşivi Göster'}
                </button>
            </div>
        </div>
    `;

    // Geri butonu
    document.getElementById('backToMenuBtn').onclick = () => navigateTo('mainMenu');

    // Çalıştay ekleme
    document.getElementById('addWorkshopBtn').onclick = () => openWorkshopCreateModal();

    // Arşiv toggle
    document.getElementById('toggleArchivedWorkshopsBtn').onclick = () => {
        appState.showArchivedWorkshops = !appState.showArchivedWorkshops;
        renderWorkshopsView();
    };

    // Çalıştay kartına tıklayınca detaya git
    document.querySelectorAll('[data-ws-goto]').forEach(el => {
        el.addEventListener('click', () => {
            const wsId = parseInt(el.dataset.wsGoto);
            const ws   = (appState.workshopsList || []).find(w => w.id === wsId);
            if (ws) navigateTo('workshopDetail', { workshopId: ws.id, workshopName: ws.name });
        });
    });

    // Arşiv butonu
    document.querySelectorAll('.btn-icon-archive[data-ws-id]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const wsId      = parseInt(el.dataset.wsId);
            const isArchived = el.dataset.wsArchived === '1';
            archiveWorkshop(wsId, !isArchived);
        });
    });

    // Sil butonu
    document.querySelectorAll('.btn-icon-delete[data-ws-id]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const wsId = parseInt(el.dataset.wsId);
            deleteWorkshop(wsId);
        });
    });

    refreshIcons();
}

// ---------------------------------------------------------------
// openWorkshopCreateModal — Çalıştay oluşturma modalını açar
// (Modal HTML adım 4.2'de eklenecek; şimdilik toast)
// ---------------------------------------------------------------
function openWorkshopCreateModal() {
    const modal = document.getElementById('workshopCreateModal');
    if (!modal) {
        showToast('Çalıştay oluşturma modalı yakında eklenecek.', 'warning');
        return;
    }
    modal.style.display = 'flex';
}

// ---------------------------------------------------------------
// archiveWorkshop — is_archived bayrağını değiştirir
// ---------------------------------------------------------------
async function archiveWorkshop(wsId, makeArchived) {
    const { error } = await supabase
        .from('workshops')
        .update({ is_archived: makeArchived })
        .eq('id', wsId);

    if (error) {
        showToast('İşlem başarısız.', 'error');
        return;
    }
    showToast(makeArchived ? 'Çalıştay arşivlendi ✓' : 'Çalıştay arşivden çıkarıldı ✓', 'success');
    if (makeArchived) appState.showArchivedWorkshops = false;
    await fetchWorkshops();
    renderWorkshopsView();
}

// ---------------------------------------------------------------
// deleteWorkshop — Çalıştayı siler (CASCADE ile alt tablolar da silinir)
// ---------------------------------------------------------------
async function deleteWorkshop(wsId) {
    openConfirmModal('Bu çalıştayı silmek istediğinizden emin misiniz? Tüm tarihler, öğrenciler ve ödemeler de silinir.', async () => {
        const { error } = await supabase
            .from('workshops')
            .delete()
            .eq('id', wsId);

        if (error) {
            showToast('Silme işlemi başarısız.', 'error');
            return;
        }
        showToast('Çalıştay silindi ✓', 'success');
        await fetchWorkshops();
        renderWorkshopsView();
    });
}