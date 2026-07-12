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
    'Af AFN',  //   0  Afganistan / Afghanistan
    '€ EUR',  //   1  Almanya / Germany
    '$ USD',  //   2  Amerika Birleşik Devletleri / United States
    '€ EUR',  //   3  Andorra / Andorra
    'Kz AOA',  //   4  Angola / Angola
    '$ XCD',  //   5  Antigua ve Barbuda / Antigua and Barbuda
    '$ ARS',  //   6  Arjantin / Argentina
    'L ALL',  //   7  Arnavutluk / Albania
    'A$ AUD',  //   8  Avustralya / Australia
    '€ EUR',  //   9  Avusturya / Austria
    '₼ AZN',  //  10  Azerbaycan / Azerbaijan
    '$ BSD',  //  11  Bahamalar / Bahamas
    'BD BHD',  //  12  Bahreyn / Bahrain
    '৳ BDT',  //  13  Bangladeş / Bangladesh
    '$ BBD',  //  14  Barbados / Barbados
    '€ EUR',  //  15  Belçika / Belgium
    '$ BZD',  //  16  Belize / Belize
    'Fr XOF',  //  17  Benin / Benin
    'Br BYN',  //  18  Beyaz Rusya / Belarus
    'Nu BTN',  //  19  Bhutan / Bhutan
    'د.إ AED',  //  20  Birleşik Arap Emirlikleri / United Arab Emirates
    '£ GBP',  //  21  Birleşik Krallık / United Kingdom
    'Bs BOB',  //  22  Bolivya / Bolivia
    'KM BAM',  //  23  Bosna Hersek / Bosnia and Herzegovina
    'P BWP',  //  24  Botsvana / Botswana
    'R$ BRL',  //  25  Brezilya / Brazil
    'B$ BND',  //  26  Brunei / Brunei
    'лв BGN',  //  27  Bulgaristan / Bulgaria
    'Fr XOF',  //  28  Burkina Faso / Burkina Faso
    'Fr BIF',  //  29  Burundi / Burundi
    'Fr DJF',  //  30  Cibuti / Djibouti
    'د.ج DZD',  //  31  Cezayir / Algeria
    'Fr XAF',  //  32  Çad / Chad
    'Kč CZK',  //  33  Çekya / Czech Republic
    '¥ CNY',  //  34  Çin / China
    'kr DKK',  //  35  Danimarka / Denmark
    'Fr CDF',  //  36  Demokratik Kongo Cumhuriyeti / Democratic Republic of the Congo
    'RD$ DOP',  //  37  Dominik Cumhuriyeti / Dominican Republic
    '$ XCD',  //  38  Dominika / Dominica
    '$ USD',  //  39  Ekvador / Ecuador
    'Fr XAF',  //  40  Ekvator Ginesi / Equatorial Guinea
    '$ USD',  //  41  El Salvador / El Salvador
    'Rp IDR',  //  42  Endonezya / Indonesia
    'Nfk ERN',  //  43  Eritre / Eritrea
    '֏ AMD',  //  44  Ermenistan / Armenia
    '€ EUR',  //  45  Estonya / Estonia
    'Br ETB',  //  46  Etiyopya / Ethiopia
    'د.م. MAD',  //  47  Fas / Morocco
    '$ FJD',  //  48  Fiji / Fiji
    '₱ PHP',  //  49  Filipinler / Philippines
    '€ EUR',  //  50  Finlandiya / Finland
    '€ EUR',  //  51  Fransa / France
    'Fr XAF',  //  52  Gabon / Gabon
    'D GMD',  //  53  Gambiya / Gambia
    'GH₵ GHS',  //  54  Gana / Ghana
    '$ XCD',  //  55  Grenada / Grenada
    'Q GTQ',  //  56  Guatemala / Guatemala
    'R ZAR',  //  57  Güney Afrika / South Africa
    '₩ KRW',  //  58  Güney Kore / South Korea
    '£ SSP',  //  59  Güney Sudan / South Sudan
    '₾ GEL',  //  60  Gürcistan / Georgia
    'Fr GNF',  //  61  Gine / Guinea
    'Fr XOF',  //  62  Gine-Bissau / Guinea-Bissau
    '$ GYD',  //  63  Guyana / Guyana
    'G HTG',  //  64  Haiti / Haiti
    '₹ INR',  //  65  Hindistan / India
    '€ EUR',  //  66  Hollanda / Netherlands
    'L HNL',  //  67  Honduras / Honduras
    'HK$ HKD',  //  68  Hong Kong / Hong Kong
    '€ EUR',  //  69  Hırvatistan / Croatia
    'ع.د IQD',  //  70  Irak / Iraq
    '﷼ IRR',  //  71  İran / Iran
    '€ EUR',  //  72  İrlanda / Ireland
    '€ EUR',  //  73  İspanya / Spain
    '₪ ILS',  //  74  İsrail / Israel
    'kr SEK',  //  75  İsveç / Sweden
    'Fr CHF',  //  76  İsviçre / Switzerland
    '€ EUR',  //  77  İtalya / Italy
    'kr ISK',  //  78  İzlanda / Iceland
    '$ JMD',  //  79  Jamaika / Jamaica
    '¥ JPY',  //  80  Japonya / Japan
    '₭ KHR',  //  81  Kamboçya / Cambodia
    'Fr XAF',  //  82  Kamerun / Cameroon
    'C$ CAD',  //  83  Kanada / Canada
    '€ EUR',  //  84  Karadağ / Montenegro
    'ر.ق QAR',  //  85  Katar / Qatar
    '₸ KZT',  //  86  Kazakistan / Kazakhstan
    'KSh KES',  //  87  Kenya / Kenya
    '€ EUR',  //  88  Kıbrıs / Cyprus
    'с KGS',  //  89  Kırgızistan / Kyrgyzstan
    'A$ AUD',  //  90  Kiribati / Kiribati
    '$ COP',  //  91  Kolombiya / Colombia
    'Fr KMF',  //  92  Komorlar / Comoros
    'Fr XAF',  //  93  Kongo / Congo
    '€ EUR',  //  94  Kosova / Kosovo
    '₡ CRC',  //  95  Kosta Rika / Costa Rica
    '₱ CUP',  //  96  Küba / Cuba
    'KD KWD',  //  97  Kuveyt / Kuwait
    '₭ LAK',  //  98  Laos / Laos
    'L LSL',  //  99  Lesoto / Lesotho
    '€ EUR',  // 100  Letonya / Latvia
    '$ LRD',  // 101  Liberya / Liberia
    'LD LYD',  // 102  Libya / Libya
    'Fr CHF',  // 103  Liechtenstein / Liechtenstein
    '€ EUR',  // 104  Litvanya / Lithuania
    '€ EUR',  // 105  Lüksemburg / Luxembourg
    'Ft HUF',  // 106  Macaristan / Hungary
    'Ar MGA',  // 107  Madagaskar / Madagascar
    'MK MWK',  // 108  Malavi / Malawi
    'Rf MVR',  // 109  Maldivler / Maldives
    'RM MYR',  // 110  Malezya / Malaysia
    'Fr XOF',  // 111  Mali / Mali
    '€ EUR',  // 112  Malta / Malta
    '$ USD',  // 113  Marshall Adaları / Marshall Islands
    'UM MRU',  // 114  Moritanya / Mauritania
    '₨ MUR',  // 115  Moritius / Mauritius
    'MT MZN',  // 116  Mozambik / Mozambique
    '$ MXN',  // 117  Meksika / Mexico
    '$ USD',  // 118  Mikronezya / Micronesia
    '₮ MNT',  // 119  Moğolistan / Mongolia
    'L MDL',  // 120  Moldova / Moldova
    '€ EUR',  // 121  Monako / Monaco
    'K MMK',  // 122  Myanmar / Myanmar
    '$ NAD',  // 123  Namibya / Namibia
    'A$ AUD',  // 124  Nauru / Nauru
    'रू NPR',  // 125  Nepal / Nepal
    'C$ NIO',  // 126  Nikaragua / Nicaragua
    'Fr XOF',  // 127  Nijer / Niger
    '₦ NGN',  // 128  Nijerya / Nigeria
    'kr NOK',  // 129  Norveç / Norway
    'Fr XAF',  // 130  Orta Afrika Cumhuriyeti / Central African Republic
    'so'm UZS',  // 131  Özbekistan / Uzbekistan
    '₨ PKR',  // 132  Pakistan / Pakistan
    '$ USD',  // 133  Palau / Palau
    'B/. PAB',  // 134  Panama / Panama
    'K PGK',  // 135  Papua Yeni Gine / Papua New Guinea
    '₲ PYG',  // 136  Paraguay / Paraguay
    'S/ PEN',  // 137  Peru / Peru
    'zł PLN',  // 138  Polonya / Poland
    '€ EUR',  // 139  Portekiz / Portugal
    'lei RON',  // 140  Romanya / Romania
    'Fr RWF',  // 141  Ruanda / Rwanda
    '₽ RUB',  // 142  Rusya / Russia
    '$ XCD',  // 143  Saint Kitts ve Nevis / Saint Kitts and Nevis
    '$ XCD',  // 144  Saint Lucia / Saint Lucia
    '$ XCD',  // 145  Saint Vincent ve Grenadinler / Saint Vincent and the Grenadines
    'T WST',  // 146  Samoa / Samoa
    '€ EUR',  // 147  San Marino / San Marino
    'Db STN',  // 148  Sao Tome ve Principe / Sao Tome and Principe
    'Fr XOF',  // 149  Senegal / Senegal
    '₨ SCR',  // 150  Seyşeller / Seychelles
    'Le SLL',  // 151  Sierra Leone / Sierra Leone
    'S$ SGD',  // 152  Singapur / Singapore
    '€ EUR',  // 153  Slovakya / Slovakia
    '€ EUR',  // 154  Slovenya / Slovenia
    '$ SBD',  // 155  Solomon Adaları / Solomon Islands
    'Sh SOS',  // 156  Somali / Somalia
    '₨ LKR',  // 157  Sri Lanka / Sri Lanka
    '£ SDG',  // 158  Sudan / Sudan
    '$ SRD',  // 159  Surinam / Suriname
    '£ SYP',  // 160  Suriye / Syria
    'ر.س SAR',  // 161  Suudi Arabistan / Saudi Arabia
    'дин RSD',  // 162  Sırbistan / Serbia
    'L SZL',  // 163  Svaziland / Eswatini
    '$ CLP',  // 164  Şili / Chile
    'SM TJS',  // 165  Tacikistan / Tajikistan
    'Sh TZS',  // 166  Tanzanya / Tanzania
    'NT$ TWD',  // 167  Tayvan / Taiwan
    '฿ THB',  // 168  Tayland / Thailand
    'Fr XOF',  // 169  Togo / Togo
    'T$ TOP',  // 170  Tonga / Tonga
    '$ TTD',  // 171  Trinidad ve Tobago / Trinidad and Tobago
    'DT TND',  // 172  Tunus / Tunisia
    '₺ TRY',  // 173  Türkiye / Turkey
    'T TMT',  // 174  Türkmenistan / Turkmenistan
    'A$ AUD',  // 175  Tuvalu / Tuvalu
    'Sh UGX',  // 176  Uganda / Uganda
    '₴ UAH',  // 177  Ukrayna / Ukraine
    '$ UYU',  // 178  Uruguay / Uruguay
    'Vt VUV',  // 179  Vanuatu / Vanuatu
    '€ EUR',  // 180  Vatikan / Vatican City
    'Bs VES',  // 181  Venezuela / Venezuela
    '₫ VND',  // 182  Vietnam / Vietnam
    'ر.ي YER',  // 183  Yemen / Yemen
    'NZ$ NZD',  // 184  Yeni Zelanda / New Zealand
    '€ EUR',  // 185  Yunanistan / Greece
    'K ZMW',  // 186  Zambiya / Zambia
    'ZW$ ZWL',  // 187  Zimbabwe / Zimbabwe
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