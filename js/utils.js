// Ortak yardımcı fonksiyonlar

import { t } from './i18n.js';

// ---------------------------------------------------------------
// TARİH YARDIMCILARI
// ---------------------------------------------------------------

function parseDateLocal(dateStr) {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

export function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = parseDateLocal(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}


export function isoToDisplayDate(isoDate) {
    if (!isoDate) return '';
    const d = parseDateLocal(isoDate);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function displayDateToISO(displayDate) {
    if (!displayDate) return '';
    const parts = displayDate.split('/');
    if (parts.length !== 3) return '';
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
}

export function isoDate(dateStr) {
    const d = parseDateLocal(dateStr);
    if (!d) return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function isPastDate(dateStr) {
    const target = parseDateLocal(dateStr);
    if (!target) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return target < today;
}

// ---------------------------------------------------------------
// ADIM 4.1 — TOAST BİLDİRİMLERİ
// alert() yerine ekranın sağ altında beliren, 3 saniye sonra
// kendi kendine kaybolan şık bildirim kutuları.
// Kullanım: showToast('Mesaj', 'success' | 'error' | 'warning')
// ---------------------------------------------------------------

export function showToast(message, type = 'success') {
    // Konteyner yoksa oluştur
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // İkon seç
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠'
    };
    const icon = icons[type] || '✓';

    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
    container.appendChild(toast);

    // Animasyonlu giriş için kısa gecikme
    setTimeout(() => toast.classList.add('toast-visible'), 10);

    // 3 saniye sonra kaybol ve DOM'dan sil
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        toast.classList.add('toast-hiding');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 400);
    }, 3000);
}

// ---------------------------------------------------------------
// MODAL YARDIMCILARI
// ---------------------------------------------------------------

export function showModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
}

export function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

export function openPromptModal(title, placeholder, callback) {
    const modal = document.getElementById('dynamicModal');
    const titleEl = document.getElementById('dynamicModalTitle');
    const input = document.getElementById('dynamicInput');
    titleEl.innerText = title;
    input.placeholder = placeholder || '';
    input.value = '';
    modal.style.display = 'flex';
    input.focus();
    const confirmHandler = () => {
        const val = input.value.trim();
        if (val) callback(val);
        modal.style.display = 'none';
        cleanup();
    };
    const cancelHandler = () => {
        modal.style.display = 'none';
        cleanup();
    };
    const cleanup = () => {
        document.getElementById('dynamicModalConfirm').removeEventListener('click', confirmHandler);
        document.getElementById('dynamicModalCancel').removeEventListener('click', cancelHandler);
        input.removeEventListener('keypress', keyHandler);
    };
    const keyHandler = (e) => { if (e.key === 'Enter') confirmHandler(); };
    document.getElementById('dynamicModalConfirm').onclick = confirmHandler;
    document.getElementById('dynamicModalCancel').onclick = cancelHandler;
    input.addEventListener('keypress', keyHandler);
}

export function openPromptModalWithValue(title, defaultValue, placeholder, callback) {
    const modal = document.getElementById('dynamicModal');
    const titleEl = document.getElementById('dynamicModalTitle');
    const input = document.getElementById('dynamicInput');
    titleEl.innerText = title;
    input.placeholder = placeholder || '';
    input.value = defaultValue !== undefined ? defaultValue : '';
    modal.style.display = 'flex';
    input.focus();
    input.select();

    const confirmHandler = () => {
        const val = input.value;
        callback(val);
        modal.style.display = 'none';
        cleanup();
    };
    const cancelHandler = () => {
        modal.style.display = 'none';
        cleanup();
    };
    const cleanup = () => {
        document.getElementById('dynamicModalConfirm').removeEventListener('click', confirmHandler);
        document.getElementById('dynamicModalCancel').removeEventListener('click', cancelHandler);
        input.removeEventListener('keypress', keyHandler);
    };
    const keyHandler = (e) => { if (e.key === 'Enter') confirmHandler(); };

    document.getElementById('dynamicModalConfirm').onclick = confirmHandler;
    document.getElementById('dynamicModalCancel').onclick = cancelHandler;
    input.addEventListener('keypress', keyHandler);
}

export function openDoubleInputModal(title, placeholder1, placeholder2, callback, defaultVal1 = '', defaultVal2 = '') {
    const modal = document.getElementById('doubleInputModal');
    const titleEl = document.getElementById('doubleModalTitle');
    const input1 = document.getElementById('doubleInput1');
    const input2 = document.getElementById('doubleInput2');
    titleEl.innerText = title;
    input1.placeholder = placeholder1 || '';
    input2.placeholder = placeholder2 || '';
    input1.value = defaultVal1;
    input2.value = defaultVal2;
    modal.style.display = 'flex';
    input1.focus();
    const confirmHandler = () => {
        const val1 = input1.value.trim();
        const val2 = input2.value.trim();
        if (val1 && val2) callback(val1, val2);
        modal.style.display = 'none';
        cleanup();
    };
    const cancelHandler = () => {
        modal.style.display = 'none';
        cleanup();
    };
    const cleanup = () => {
        document.getElementById('doubleModalConfirm').removeEventListener('click', confirmHandler);
        document.getElementById('doubleModalCancel').removeEventListener('click', cancelHandler);
    };
    document.getElementById('doubleModalConfirm').onclick = confirmHandler;
    document.getElementById('doubleModalCancel').onclick = cancelHandler;
}

export function openConfirmModal(message, onConfirm, onCancel, confirmLabel) {
    const modal = document.getElementById('confirmModal');
    if (!modal) return;
    const msgSpan = document.getElementById('confirmMessage');
    const yesBtn = document.getElementById('confirmModalYes');
    const noBtn = document.getElementById('confirmModalNo');
    if (!yesBtn || !noBtn) return;

    msgSpan.innerText = message;
    // Onay butonu metni verilmemişse seçili dile göre "Evet, sil" / "Yes, delete"
    yesBtn.innerText = (confirmLabel !== undefined && confirmLabel !== null)
        ? confirmLabel
        : t('confirm.yesDelete');
    // İptal butonu her zaman seçili dile göre
    noBtn.innerText = t('common.cancel');

    yesBtn.onclick = () => {
        modal.style.display = 'none';
        if (onConfirm) onConfirm();
    };
    noBtn.onclick = () => {
        modal.style.display = 'none';
        if (onCancel) onCancel();
    };

    modal.style.display = 'flex';
}

export function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
}

// ---------------------------------------------------------------
// ADIM 3.2 — escapeHtml TEK YERDE TANIMLI
// Eskiden attendance.js, classes.js, payments.js, schools.js
// dosyalarında ayrı ayrı kopyası vardı. Artık sadece burada.
// ---------------------------------------------------------------
export function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        if (m === "'") return '&#39;';
        return m;
    });
}
// ---------------------------------------------------------------
// GOOGLE CALENDAR ENTEGRASYONU
// Etkinliği doğrudan Google Calendar'da açar.
// Kullanıcı "Takvime Ekle" butonuna basınca Google Calendar
// web sayfası önceden doldurulmuş şekilde açılır.
//
// PARAMETRELER:
//   title        — Etkinlik başlığı (örn: "Grup Dersi - Pazartesi")
//   startDateISO — Başlangıç tarihi "YYYY-MM-DD" formatında
//   startTimeHM  — Başlangıç saati "HH:MM" formatında (Türkiye saati)
//   rrule        — Tekrar kuralı (örn: "FREQ=WEEKLY" veya
//                  "FREQ=WEEKLY;COUNT=5") — tekrar yoksa null
//   description  — Etkinlik açıklaması — yoksa null
//
// SAAT DİLİMİ:
//   Sistem Türkiye saatini (UTC+3) saklar.
//   Google Calendar URL'i UTC ister (YYYYMMDDTHHmmssZ).
//   Bu fonksiyon Türkiye saatini UTC'ye çevirir (3 saat çıkarır).
// ---------------------------------------------------------------
export function openGoogleCalendarEvent(title, startDateISO, startTimeHM, rrule, description) {
    if (!startDateISO || !startTimeHM) return;

    // "YYYY-MM-DD" + "HH:MM" → Date nesnesi (Türkiye saati olarak yorumla)
    const [year, month, day]   = startDateISO.split('-').map(Number);
    const [hour, minute]       = startTimeHM.split(':').map(Number);

    // Türkiye saati UTC+3 → UTC'ye çevir: 3 saat çıkar
    const startUTC = new Date(Date.UTC(year, month - 1, day, hour - 3, minute, 0));

    // Etkinlik süresi: 1 saat
    const endUTC = new Date(startUTC.getTime() + 60 * 60 * 1000);

    // Google Calendar URL formatı: YYYYMMDDTHHmmssZ
    function toGCalFormat(d) {
        const yy  = d.getUTCFullYear();
        const mo  = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd  = String(d.getUTCDate()).padStart(2, '0');
        const hh  = String(d.getUTCHours()).padStart(2, '0');
        const mi  = String(d.getUTCMinutes()).padStart(2, '0');
        const ss  = String(d.getUTCSeconds()).padStart(2, '0');
        return `${yy}${mo}${dd}T${hh}${mi}${ss}Z`;
    }

    const startStr = toGCalFormat(startUTC);
    const endStr   = toGCalFormat(endUTC);

    // Temel parametreler
    const params = new URLSearchParams();
    params.set('action', 'TEMPLATE');
    params.set('text',   title || '');
    params.set('dates',  `${startStr}/${endStr}`);
    if (description) params.set('details', description);

    // Tekrar kuralı varsa ekle
    // Google Calendar "recur" parametresi RRULE: önekiyle bekler
    if (rrule) params.set('recur', `RRULE:${rrule}`);

    const url = `https://www.google.com/calendar/render?${params.toString()}`;
    window.open(url, '_blank');
}