// ---------------------------------------------------------------
// festivals.js — FESTİVAL LİSTESİ MODÜLÜ
// ADIM 5.1 + 5.2 — Festival listesi, oluşturma, düzenleme, arşiv
// Lokasyon: Şehir (metin) + Ülke (dropdown, tüm dünya)
// Para birimi: ülkeye göre otomatik belirlenir
// ---------------------------------------------------------------

import { supabase } from './supabaseClient.js';
import { refreshIcons, openConfirmModal, showToast, escapeHtml, formatDate } from './utils.js';
import { navigateTo } from './router.js';
import { appState } from './state.js';

// ---------------------------------------------------------------
// ÜLKE → PARA BİRİMİ EŞLEŞTİRME TABLOSU
// ---------------------------------------------------------------
export const COUNTRY_CURRENCY = {
    'Türkiye': '₺ TRY', 'Amerika Birleşik Devletleri': '$ USD',
    'Almanya': '€ EUR', 'Fransa': '€ EUR', 'İtalya': '€ EUR',
    'İspanya': '€ EUR', 'Hollanda': '€ EUR', 'Belçika': '€ EUR',
    'Avusturya': '€ EUR', 'Portekiz': '€ EUR', 'Yunanistan': '€ EUR',
    'Finlandiya': '€ EUR', 'İrlanda': '€ EUR', 'Lüksemburg': '€ EUR',
    'Malta': '€ EUR', 'Kıbrıs': '€ EUR', 'Slovenya': '€ EUR',
    'Slovakya': '€ EUR', 'Estonya': '€ EUR', 'Letonya': '€ EUR',
    'Litvanya': '€ EUR', 'Hırvatistan': '€ EUR',
    'Birleşik Krallık': '£ GBP', 'Rusya': '₽ RUB',
    'Japonya': '¥ JPY', 'Çin': '¥ CNY', 'Güney Kore': '₩ KRW',
    'Hindistan': '₹ INR', 'Brezilya': 'R$ BRL', 'Kanada': 'C$ CAD',
    'Avustralya': 'A$ AUD', 'İsviçre': 'Fr CHF', 'İsveç': 'kr SEK',
    'Norveç': 'kr NOK', 'Danimarka': 'kr DKK', 'Polonya': 'zł PLN',
    'Çekya': 'Kč CZK', 'Macaristan': 'Ft HUF', 'Romanya': 'lei RON',
    'Bulgaristan': 'лв BGN', 'Sırbistan': 'дин RSD', 'Ukrayna': '₴ UAH',
    'Arjantin': '$ ARS', 'Meksika': '$ MXN', 'Kolombiya': '$ COP',
    'Şili': '$ CLP', 'Peru': 'S/ PEN', 'Uruguay': '$ UYU',
    'Güney Afrika': 'R ZAR', 'Mısır': '£ EGP', 'Fas': 'د.م. MAD',
    'Nijerya': '₦ NGN', 'Kenya': 'KSh KES',
    'Suudi Arabistan': 'ر.س SAR', 'Birleşik Arap Emirlikleri': 'د.إ AED',
    'İsrail': '₪ ILS', 'Tayland': '฿ THB', 'Singapur': 'S$ SGD',
    'Malezya': 'RM MYR', 'Endonezya': 'Rp IDR', 'Filipinler': '₱ PHP',
    'Vietnam': '₫ VND', 'Pakistan': '₨ PKR', 'Bangladeş': '৳ BDT',
    'Yeni Zelanda': 'NZ$ NZD', 'Hong Kong': 'HK$ HKD',
    'Tayvan': 'NT$ TWD',
};

// Ülke listesi — dropdown için alfabetik sırada
const COUNTRIES = [
    'Almanya','Amerika Birleşik Devletleri','Arjantin','Avustralya','Avusturya',
    'Bangladeş','Belçika','Birleşik Arap Emirlikleri','Birleşik Krallık',
    'Brezilya','Bulgaristan','Çekya','Çin','Danimarka','Endonezya',
    'Estonya','Filipinler','Finlandiya','Fransa','Güney Afrika','Güney Kore',
    'Hindistan','Hollanda','Hong Kong','Hırvatistan','İndonezya','İrlanda',
    'İspanya','İsrail','İsveç','İsviçre','İtalya','Japonya','Kanada',
    'Kenya','Kolombiya','Kıbrıs','Letonya','Litvanya','Lüksemburg',
    'Malezya','Malta','Macaristan','Fas','Meksika','Mısır','Nijerya',
    'Norveç','Pakistan','Peru','Polonya','Portekiz','Romanya','Rusya',
    'Singapur','Sırbistan','Slovakya','Slovenya','Suudi Arabistan',
    'Şili','Tayvan','Tayland','Türkiye','Ukrayna','Uruguay',
    'Vietnam','Yeni Zelanda','Yunanistan',
];

// ---------------------------------------------------------------
// Lokasyon string'ini şehir ve ülkeye ayır: "Paris, Fransa"
// ---------------------------------------------------------------
function parseLocation(locationStr) {
    if (!locationStr) return { city: '', country: '' };
    const parts = locationStr.split(',');
    if (parts.length >= 2) {
        return { city: parts[0].trim(), country: parts.slice(1).join(',').trim() };
    }
    return { city: locationStr.trim(), country: '' };
}

// Şehir + ülkeden location string'i oluştur
function buildLocation(city, country) {
    city    = (city    || '').trim();
    country = (country || '').trim();
    if (city && country) return `${city}, ${country}`;
    if (city)            return city;
    if (country)         return country;
    return null;
}

// ---------------------------------------------------------------
// Ülke dropdown HTML'i üret
// ---------------------------------------------------------------
function countrySelectHtml(selectedCountry) {
    const opts = COUNTRIES.map(c =>
        `<option value="${escapeHtml(c)}" ${c === selectedCountry ? 'selected' : ''}>${escapeHtml(c)}</option>`
    ).join('');
    return `<select id="festCountry"
        style="width:100%;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;margin-bottom:12px;">
        <option value="">-- Ülke seçin --</option>
        ${opts}
    </select>`;
}

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

    const active    = (appState.festivalsList || []).filter(f => !f.is_archived);
    const archived  = (appState.festivalsList || []).filter(f =>  f.is_archived);
    const showArch  = appState.showArchivedFestivals || false;
    const displayed = showArch ? archived : active;

    let listHtml = '';
    if (displayed.length === 0) {
        listHtml = `<div style="text-align:center; color:var(--text-dim); padding:20px;">
            ${showArch ? 'Arşivlenmiş festival yok.' : 'Henüz festival eklenmemiş.'}
        </div>`;
    } else {
        displayed.forEach(f => {
            const opacity = f.is_archived ? 'opacity:0.5;' : '';
            const dateStr = f.start_date ? formatDate(f.start_date) : '';
            const dateEnd = f.end_date   ? ' – ' + formatDate(f.end_date) : '';
            const loc     = f.location   ? escapeHtml(f.location) + ' · ' : '';

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

    document.getElementById('backToMenuBtn').onclick  = () => navigateTo('mainMenu');
    document.getElementById('addFestivalBtn').onclick = () => openFestivalModal();
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

    // Mevcut lokasyonu şehir/ülke olarak ayır
    const { city, country } = parseLocation(existing ? existing.location : '');

    // Modal içeriğini dinamik olarak oluştur
    modal.querySelector('.modal-content').innerHTML = `
        <h3 style="margin-top:0; color:var(--primary);">${isEdit ? 'Festivali Düzenle' : 'Yeni Festival Ekle'}</h3>

        <input type="text" id="festName" placeholder="Festival adı" autocomplete="off"
            style="width:100%; margin-bottom:12px;" value="${escapeHtml(existing ? existing.name || '' : '')}">

        <input type="text" id="festCity" placeholder="Şehir" autocomplete="off"
            style="width:100%; margin-bottom:12px;" value="${escapeHtml(city)}">

        ${countrySelectHtml(country)}

        <!-- Başlangıç tarihi -->
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <input type="text" id="festStartDateDisplay" readonly placeholder="Başlangıç tarihi"
                style="flex:1; background:#1e293b; color:white;"
                value="${existing && existing.start_date ? formatDate(existing.start_date) : ''}">
            <span id="festStartCalIcon" style="cursor:pointer; color:var(--primary); display:inline-flex; align-items:center;">
                <i data-lucide="calendar" size="22"></i>
            </span>
        </div>
        <input type="date" id="festHiddenStartDate" style="display:none;"
            value="${existing && existing.start_date ? existing.start_date : ''}">

        <!-- Bitiş tarihi -->
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:20px;">
            <input type="text" id="festEndDateDisplay" readonly placeholder="Bitiş tarihi (opsiyonel)"
                style="flex:1; background:#1e293b; color:white;"
                value="${existing && existing.end_date ? formatDate(existing.end_date) : ''}">
            <span id="festEndCalIcon" style="cursor:pointer; color:var(--primary); display:inline-flex; align-items:center;">
                <i data-lucide="calendar" size="22"></i>
            </span>
        </div>
        <input type="date" id="festHiddenEndDate" style="display:none;"
            value="${existing && existing.end_date ? existing.end_date : ''}">

        <div style="display:flex; gap:10px;">
            <button class="btn-success" id="festSaveBtn">Kaydet</button>
            <button class="btn-secondary" id="festCancelBtn">İptal</button>
        </div>
    `;

    // Takvim ikonları
    const startHidden = document.getElementById('festHiddenStartDate');
    const startDisp   = document.getElementById('festStartDateDisplay');
    const endHidden   = document.getElementById('festHiddenEndDate');
    const endDisp     = document.getElementById('festEndDateDisplay');

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
    document.getElementById('festCancelBtn').onclick = () => { modal.style.display = 'none'; };

    modal.style.display = 'flex';
    document.getElementById('festName').focus();
    refreshIcons();
}

// ---------------------------------------------------------------
// Festival oluştur
// ---------------------------------------------------------------
async function createFestival(modal) {
    const name = document.getElementById('festName').value.trim();
    if (!name) { showToast('Festival adı boş olamaz.', 'warning'); return; }

    const city       = document.getElementById('festCity').value.trim();
    const country    = document.getElementById('festCountry').value;
    const location   = buildLocation(city, country) || null;
    const start_date = document.getElementById('festHiddenStartDate').value || null;
    const end_date   = document.getElementById('festHiddenEndDate').value   || null;

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

    const city       = document.getElementById('festCity').value.trim();
    const country    = document.getElementById('festCountry').value;
    const location   = buildLocation(city, country) || null;
    const start_date = document.getElementById('festHiddenStartDate').value || null;
    const end_date   = document.getElementById('festHiddenEndDate').value   || null;

    if (!start_date) { showToast('Başlangıç tarihi seçiniz.', 'warning'); return; }

    const { error } = await supabase.from('festivals').update({
        name, location, start_date, end_date
    }).eq('id', festId);

    if (error) { showToast('Güncelleme başarısız: ' + error.message, 'error'); return; }

    showToast('Festival güncellendi ✓', 'success');
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