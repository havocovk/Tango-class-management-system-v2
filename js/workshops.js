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
                    <span class="btn-icon-edit" data-ws-id="${w.id}" style="cursor:pointer; display:inline-flex; color:var(--primary);">
                        <i data-lucide="pencil" size="20"></i>
                    </span>
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

    // Düzenle butonu
    document.querySelectorAll('.btn-icon-edit[data-ws-id]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const wsId = parseInt(el.dataset.wsId);
            const ws   = (appState.workshopsList || []).find(w => w.id === wsId);
            if (ws) openWorkshopEditModal(ws);
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
    const modal       = document.getElementById('workshopCreateModal');
    if (!modal) { showToast('Modal bulunamadı.', 'error'); return; }

    // Alanları sıfırla
    document.getElementById('wsName').value         = '';
    document.getElementById('wsStudio').value       = '';
    document.getElementById('wsTime').value         = '19:00';
    document.getElementById('wsTotalWeeks').value   = '';
    document.getElementById('wsTheme').value        = '';
    document.getElementById('wsTotalPrice').value   = '';
    document.getElementById('wsWeeklyPrice').value  = '';
    document.getElementById('wsPaymentType').value  = 'upfront';
    document.getElementById('wsStartDateDisplay').value = '';
    document.getElementById('wsHiddenDatePicker').value = '';

    // Ödeme türü değişince fiyat alanını göster/gizle
    document.getElementById('wsUpfrontPriceRow').style.display = 'block';
    document.getElementById('wsWeeklyPriceRow').style.display  = 'none';

    const paymentTypeEl = document.getElementById('wsPaymentType');
    const onPayTypeChange = () => {
        const isUpfront = paymentTypeEl.value === 'upfront';
        document.getElementById('wsUpfrontPriceRow').style.display = isUpfront ? 'block' : 'none';
        document.getElementById('wsWeeklyPriceRow').style.display  = isUpfront ? 'none'  : 'block';
    };
    paymentTypeEl.onchange = onPayTypeChange;

    // Takvim ikonu
    const calIcon  = document.getElementById('wsCalendarIcon');
    const hiddenDP = document.getElementById('wsHiddenDatePicker');
    const display  = document.getElementById('wsStartDateDisplay');

    calIcon.onclick = () => {
        if (hiddenDP.showPicker) hiddenDP.showPicker();
    };
    hiddenDP.onchange = () => {
        if (hiddenDP.value) {
            const [y, m, d] = hiddenDP.value.split('-');
            display.value = `${d}/${m}/${y}`;
        }
    };

    // Butonlar
    document.getElementById('wsCreateConfirmBtn').onclick = () => saveWorkshop(modal);
    document.getElementById('wsCreateCancelBtn').onclick  = () => { modal.style.display = 'none'; };

    modal.style.display = 'flex';
    document.getElementById('wsName').focus();
}

async function saveWorkshop(modal) {
    const name = document.getElementById('wsName').value.trim();
    if (!name) { showToast('Çalıştay adı boş olamaz.', 'warning'); return; }

    const startDateISO = document.getElementById('wsHiddenDatePicker').value;
    if (!startDateISO) { showToast('Başlangıç tarihi seçiniz.', 'warning'); return; }

    const timeVal = document.getElementById('wsTime').value.trim();
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timePattern.test(timeVal)) { showToast('Geçerli bir saat girin (örn: 19:00)', 'warning'); return; }

    const totalWeeks = parseInt(document.getElementById('wsTotalWeeks').value);
    if (!totalWeeks || totalWeeks < 1) { showToast('Hafta sayısı giriniz.', 'warning'); return; }

    const paymentType  = document.getElementById('wsPaymentType').value;
    const totalPrice   = paymentType === 'upfront'  ? (parseFloat(document.getElementById('wsTotalPrice').value)  || null) : null;
    const weeklyPrice  = paymentType === 'weekly'   ? (parseFloat(document.getElementById('wsWeeklyPrice').value) || null) : null;
    const studio       = document.getElementById('wsStudio').value.trim() || null;
    const theme        = document.getElementById('wsTheme').value.trim()  || null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showToast('Oturum bulunamadı.', 'error'); return; }

    const { data: ws, error } = await supabase
        .from('workshops')
        .insert({
            user_id:      user.id,
            name,
            studio_name:  studio,
            start_date:   startDateISO,
            lesson_time:  timeVal,
            total_weeks:  totalWeeks,
            theme,
            payment_type: paymentType,
            total_price:  totalPrice,
            weekly_price: weeklyPrice,
            is_archived:  false
        })
        .select()
        .single();

    if (error) {
        showToast('Çalıştay oluşturulamadı: ' + error.message, 'error');
        return;
    }

    showToast('Çalıştay oluşturuldu ✓', 'success');
    modal.style.display = 'none';
    await fetchWorkshops();
    renderWorkshopsView();
}

// ---------------------------------------------------------------
// openWorkshopEditModal — Mevcut çalıştayı düzenleme modalı
// ---------------------------------------------------------------
function openWorkshopEditModal(ws) {
    const modal = document.getElementById('workshopCreateModal');
    if (!modal) { showToast('Modal bulunamadı.', 'error'); return; }

    // Başlığı güncelle
    modal.querySelector('h3').textContent = 'Çalıştayı Düzenle';

    // Mevcut değerleri doldur
    document.getElementById('wsName').value        = ws.name || '';
    document.getElementById('wsStudio').value      = ws.studio_name || '';
    document.getElementById('wsTime').value        = ws.lesson_time ? ws.lesson_time.substring(0,5) : '19:00';
    document.getElementById('wsTotalWeeks').value  = ws.total_weeks || '';
    document.getElementById('wsTheme').value       = ws.theme || '';
    document.getElementById('wsPaymentType').value = ws.payment_type || 'upfront';
    document.getElementById('wsTotalPrice').value  = ws.total_price || '';
    document.getElementById('wsWeeklyPrice').value = ws.weekly_price || '';

    // Tarihi göster
    const display  = document.getElementById('wsStartDateDisplay');
    const hiddenDP = document.getElementById('wsHiddenDatePicker');
    if (ws.start_date) {
        const d = ws.start_date.split('T')[0];
        hiddenDP.value = d;
        const [y, m, day] = d.split('-');
        display.value = `${day}/${m}/${y}`;
    } else {
        hiddenDP.value = '';
        display.value  = '';
    }

    // Ödeme türüne göre fiyat alanı göster/gizle
    const isUpfront = (ws.payment_type || 'upfront') === 'upfront';
    document.getElementById('wsUpfrontPriceRow').style.display = isUpfront ? 'block' : 'none';
    document.getElementById('wsWeeklyPriceRow').style.display  = isUpfront ? 'none'  : 'block';

    const paymentTypeEl = document.getElementById('wsPaymentType');
    paymentTypeEl.onchange = () => {
        const up = paymentTypeEl.value === 'upfront';
        document.getElementById('wsUpfrontPriceRow').style.display = up ? 'block' : 'none';
        document.getElementById('wsWeeklyPriceRow').style.display  = up ? 'none'  : 'block';
    };

    // Takvim ikonu
    const calIcon = document.getElementById('wsCalendarIcon');
    calIcon.onclick = () => { if (hiddenDP.showPicker) hiddenDP.showPicker(); };
    hiddenDP.onchange = () => {
        if (hiddenDP.value) {
            const [y, m, d] = hiddenDP.value.split('-');
            display.value = `${d}/${m}/${y}`;
        }
    };

    // Kaydet / İptal
    document.getElementById('wsCreateConfirmBtn').onclick = () => updateWorkshop(ws.id, modal);
    document.getElementById('wsCreateCancelBtn').onclick  = () => {
        modal.querySelector('h3').textContent = 'Yeni Çalıştay Oluştur';
        modal.style.display = 'none';
    };

    modal.style.display = 'flex';
    document.getElementById('wsName').focus();
}

async function updateWorkshop(wsId, modal) {
    const name = document.getElementById('wsName').value.trim();
    if (!name) { showToast('Çalıştay adı boş olamaz.', 'warning'); return; }

    const startDateISO = document.getElementById('wsHiddenDatePicker').value || null;
    const timeVal      = document.getElementById('wsTime').value.trim();
    const timePattern  = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (timeVal && !timePattern.test(timeVal)) { showToast('Geçerli bir saat girin (örn: 19:00)', 'warning'); return; }

    const totalWeeks  = parseInt(document.getElementById('wsTotalWeeks').value) || null;
    const paymentType = document.getElementById('wsPaymentType').value;
    const totalPrice  = paymentType === 'upfront' ? (parseFloat(document.getElementById('wsTotalPrice').value)  || null) : null;
    const weeklyPrice = paymentType === 'weekly'  ? (parseFloat(document.getElementById('wsWeeklyPrice').value) || null) : null;
    const studio      = document.getElementById('wsStudio').value.trim() || null;
    const theme       = document.getElementById('wsTheme').value.trim()  || null;

    const { error } = await supabase
        .from('workshops')
        .update({
            name,
            studio_name:  studio,
            start_date:   startDateISO,
            lesson_time:  timeVal || null,
            total_weeks:  totalWeeks,
            theme,
            payment_type: paymentType,
            total_price:  totalPrice,
            weekly_price: weeklyPrice
        })
        .eq('id', wsId);

    if (error) { showToast('Güncelleme başarısız: ' + error.message, 'error'); return; }

    showToast('Çalıştay güncellendi ✓', 'success');
    modal.querySelector('h3').textContent = 'Yeni Çalıştay Oluştur';
    modal.style.display = 'none';
    await fetchWorkshops();
    renderWorkshopsView();
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