// ---------------------------------------------------------------
// festivals.js — FESTİVAL LİSTESİ MODÜLÜ
// ADIM 5.1 + 5.2 — Festival listesi, oluşturma, düzenleme, arşiv
// Lokasyon: Şehir (metin) + Ülke (dropdown, tüm dünya)
// Para birimi: ülkeye göre otomatik belirlenir
// ---------------------------------------------------------------

import { supabase } from './supabaseClient.js';
import { refreshIcons, openConfirmModal, showToast, escapeHtml, formatDate } from './utils.js';
import { navigateTo } from './router.js';
import { t } from './i18n.js';
import { appState } from './state.js';

// ---------------------------------------------------------------
// ÜLKE → PARA BİRİMİ EŞLEŞTİRME TABLOSU
// Anahtarlar dile bağımsız sıra indeksine (0-based) göre çalışır.
// Her iki dildeki ülke listesi t('countries.list') ile gelir;
// sıra indeksi her iki dilde de aynıdır — para birimi buradan bulunur.
// ---------------------------------------------------------------
const CURRENCY_BY_INDEX = [
    '€ EUR',  // 0  Almanya / Germany
    '$ USD',  // 1  Amerika Birleşik Devletleri / United States
    '$ ARS',  // 2  Arjantin / Argentina
    'A$ AUD', // 3  Avustralya / Australia
    '€ EUR',  // 4  Avusturya / Austria
    '৳ BDT',  // 5  Bangladeş / Bangladesh
    '€ EUR',  // 6  Belçika / Belgium
    'د.إ AED',// 7  Birleşik Arap Emirlikleri / United Arab Emirates
    '£ GBP',  // 8  Birleşik Krallık / United Kingdom
    'R$ BRL', // 9  Brezilya / Brazil
    'лв BGN', // 10 Bulgaristan / Bulgaria
    'Kč CZK', // 11 Çekya / Czech Republic
    '¥ CNY',  // 12 Çin / China
    'kr DKK', // 13 Danimarka / Denmark
    'Rp IDR', // 14 Endonezya / Indonesia
    '€ EUR',  // 15 Estonya / Estonia
    '₱ PHP',  // 16 Filipinler / Philippines
    '€ EUR',  // 17 Finlandiya / Finland
    '€ EUR',  // 18 Fransa / France
    'R ZAR',  // 19 Güney Afrika / South Africa
    '₩ KRW',  // 20 Güney Kore / South Korea
    '₹ INR',  // 21 Hindistan / India
    '€ EUR',  // 22 Hollanda / Netherlands
    'HK$ HKD',// 23 Hong Kong
    '€ EUR',  // 24 Hırvatistan / Croatia
    'Rp IDR', // 25 İndonezya / Indonesia (duplicate entry kept for list parity)
    '€ EUR',  // 26 İrlanda / Ireland
    '€ EUR',  // 27 İspanya / Spain
    '₪ ILS',  // 28 İsrail / Israel
    'kr SEK', // 29 İsveç / Sweden
    'Fr CHF', // 30 İsviçre / Switzerland
    '€ EUR',  // 31 İtalya / Italy
    '¥ JPY',  // 32 Japonya / Japan
    'C$ CAD', // 33 Kanada / Canada
    'KSh KES',// 34 Kenya
    '$ COP',  // 35 Kolombiya / Colombia
    '€ EUR',  // 36 Kıbrıs / Cyprus
    '€ EUR',  // 37 Letonya / Latvia
    '€ EUR',  // 38 Litvanya / Lithuania
    '€ EUR',  // 39 Lüksemburg / Luxembourg
    'RM MYR', // 40 Malezya / Malaysia
    '€ EUR',  // 41 Malta
    'Ft HUF', // 42 Macaristan / Hungary
    'د.م. MAD',// 43 Fas / Morocco
    '$ MXN',  // 44 Meksika / Mexico
    '£ EGP',  // 45 Mısır / Egypt
    '₦ NGN',  // 46 Nijerya / Nigeria
    'kr NOK', // 47 Norveç / Norway
    '₨ PKR',  // 48 Pakistan
    'S/ PEN', // 49 Peru
    'zł PLN', // 50 Polonya / Poland
    '€ EUR',  // 51 Portekiz / Portugal
    'lei RON',// 52 Romanya / Romania
    '₽ RUB',  // 53 Rusya / Russia
    'S$ SGD', // 54 Singapur / Singapore
    'дин RSD',// 55 Sırbistan / Serbia
    '€ EUR',  // 56 Slovakya / Slovakia
    '€ EUR',  // 57 Slovenya / Slovenia
    'ر.س SAR',// 58 Suudi Arabistan / Saudi Arabia
    '$ CLP',  // 59 Şili / Chile
    'NT$ TWD',// 60 Tayvan / Taiwan
    '฿ THB',  // 61 Tayland / Thailand
    '₺ TRY',  // 62 Türkiye / Turkey
    '₴ UAH',  // 63 Ukrayna / Ukraine
    '$ UYU',  // 64 Uruguay
    '₫ VND',  // 65 Vietnam
    'NZ$ NZD',// 66 Yeni Zelanda / New Zealand
    '€ EUR',  // 67 Yunanistan / Greece
];

// Seçilen ülke ismine karşılık gelen para birimini döndürür.
// Ülke ismi hangi dilde olursa olsun, listedeki sıra indeksi aynıdır.
export function getCurrencyForCountry(countryName) {
    const list = t('countries.list');
    const idx  = list.indexOf(countryName);
    if (idx >= 0 && idx < CURRENCY_BY_INDEX.length) return CURRENCY_BY_INDEX[idx];
    return '₺ TRY';
}

// Geriye dönük uyumluluk için COUNTRY_CURRENCY export'u
// (festival_classes.js bu adla import ediyor — o dosyayı da güncelleyeceğiz)
export const COUNTRY_CURRENCY = new Proxy({}, {
    get(_, countryName) { return getCurrencyForCountry(countryName); }
});

// Ülke listesi — her zaman aktif dilden alınır
function getCountries() {
    return t('countries.list');
}

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
    const opts = getCountries().map(c =>
        `<option value="${escapeHtml(c)}" ${c === selectedCountry ? 'selected' : ''}>${escapeHtml(c)}</option>`
    ).join('');
    return `<select id="festCountry"
        style="width:100%;background:#1e293b;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:13px;margin-bottom:12px;">
        <option value="">${t('festivals.countryPlaceholder')}</option>
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
        showToast(t('festivals.toastLoadFail'), 'error');
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
            ${showArch ? t('festivals.emptyArchived') : t('festivals.empty')}
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
            <div class="back-link" id="backToMenuBtn">${t('festivals.backToMenu')}</div>
            <div class="main-title">${t('festivals.title')}</div>
            <div id="festivalsListContainer">${listHtml}</div>
            <div class="nav-buttons" style="margin-top:20px;">
                <button class="btn-success" id="addFestivalBtn">
                    <i data-lucide="plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${t('festivals.add')}
                </button>
            </div>
            <div class="nav-buttons" style="margin-top:10px;">
                <button class="btn-secondary" id="toggleArchivedFestivalsBtn">
                    <i data-lucide="archive" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>
                    ${showArch ? t('festivals.hideArchive') : t('festivals.showArchive')}
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
    if (!modal) { showToast('Modal not found.', 'error'); return; }

    const isEdit = !!existing;
    modal.querySelector('h3').textContent = isEdit ? t('festivals.modalEditTitle') : t('festivals.modalCreateTitle');

    // Mevcut lokasyonu şehir/ülke olarak ayır
    const { city, country } = parseLocation(existing ? existing.location : '');

    // Modal içeriğini dinamik olarak oluştur
    modal.querySelector('.modal-content').innerHTML = `
        <h3 style="margin-top:0; color:var(--primary);">${isEdit ? t('festivals.modalEditTitle') : t('festivals.modalCreateTitle')}</h3>

        <input type="text" id="festName" placeholder="${t('festivals.namePlaceholder')}" autocomplete="off"
            style="width:100%; margin-bottom:12px;" value="${escapeHtml(existing ? existing.name || '' : '')}">

        <input type="text" id="festCity" placeholder="${t('festivals.cityPlaceholder')}" autocomplete="off"
            style="width:100%; margin-bottom:12px;" value="${escapeHtml(city)}">

        ${countrySelectHtml(country)}

        <!-- Başlangıç tarihi -->
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <input type="text" id="festStartDateDisplay" readonly placeholder="${t('festivals.startDatePlaceholder')}"
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
            <input type="text" id="festEndDateDisplay" readonly placeholder="${t('festivals.endDatePlaceholder')}"
                style="flex:1; background:#1e293b; color:white;"
                value="${existing && existing.end_date ? formatDate(existing.end_date) : ''}">
            <span id="festEndCalIcon" style="cursor:pointer; color:var(--primary); display:inline-flex; align-items:center;">
                <i data-lucide="calendar" size="22"></i>
            </span>
        </div>
        <input type="date" id="festHiddenEndDate" style="display:none;"
            value="${existing && existing.end_date ? existing.end_date : ''}">

        <div style="display:flex; gap:10px;">
            <button class="btn-success" id="festSaveBtn">${t('festivals.save')}</button>
            <button class="btn-secondary" id="festCancelBtn">${t('common.cancel')}</button>
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
    if (!name) { showToast(t('festivals.nameEmpty'), 'warning'); return; }

    const city       = document.getElementById('festCity').value.trim();
    const country    = document.getElementById('festCountry').value;
    const location   = buildLocation(city, country) || null;
    const start_date = document.getElementById('festHiddenStartDate').value || null;
    const end_date   = document.getElementById('festHiddenEndDate').value   || null;

    if (!start_date) { showToast(t('festivals.startDateEmpty'), 'warning'); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showToast(t('festivals.sessionNotFound'), 'error'); return; }

    const { error } = await supabase.from('festivals').insert({
        user_id: user.id, name, location, start_date, end_date
    });

    if (error) { showToast(t('festivals.toastCreateFail').replace('{msg}', error.message), 'error'); return; }

    showToast(t('festivals.toastCreated'), 'success');
    modal.style.display = 'none';
    await fetchFestivals();
    renderFestivalsView();
}

// ---------------------------------------------------------------
// Festival güncelle
// ---------------------------------------------------------------
async function updateFestival(festId, modal) {
    const name = document.getElementById('festName').value.trim();
    if (!name) { showToast(t('festivals.nameEmpty'), 'warning'); return; }

    const city       = document.getElementById('festCity').value.trim();
    const country    = document.getElementById('festCountry').value;
    const location   = buildLocation(city, country) || null;
    const start_date = document.getElementById('festHiddenStartDate').value || null;
    const end_date   = document.getElementById('festHiddenEndDate').value   || null;

    if (!start_date) { showToast(t('festivals.startDateEmpty'), 'warning'); return; }

    const { error } = await supabase.from('festivals').update({
        name, location, start_date, end_date
    }).eq('id', festId);

    if (error) { showToast(t('festivals.toastUpdateFail').replace('{msg}', error.message), 'error'); return; }

    showToast(t('festivals.toastUpdated'), 'success');
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
    if (error) { showToast(t('festivals.toastArchiveFail'), 'error'); return; }
    showToast(makeArchived ? t('festivals.toastArchived') : t('festivals.toastUnarchived'), 'success');
    if (makeArchived) appState.showArchivedFestivals = false;
    await fetchFestivals();
    renderFestivalsView();
}

// ---------------------------------------------------------------
// Sil
// ---------------------------------------------------------------
async function deleteFestival(festId) {
    openConfirmModal(t('festivals.confirmDelete'), async () => {
        const { error } = await supabase.from('festivals').delete().eq('id', festId);
        if (error) { showToast(t('festivals.toastDeleteFail'), 'error'); return; }
        showToast(t('festivals.toastDeleted'), 'success');
        await fetchFestivals();
        renderFestivalsView();
    });
}