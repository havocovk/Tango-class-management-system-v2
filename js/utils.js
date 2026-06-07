// Ortak yardımcı fonksiyonlar

// ---------------------------------------------------------------
// TARİH YARDIMCILARI
// Önemli: "2026-06-07" gibi YYYY-MM-DD formatındaki tarihleri
// new Date() ile oluştururken UTC gece yarısı olarak yorumlanır.
// Türkiye UTC+3 olduğu için bu 1 gün kaymaya yol açar.
// Çözüm: tarihi parçalara ayırıp yerel saatle oluşturmak.
// ---------------------------------------------------------------

// YYYY-MM-DD → yerel saat dilimine göre Date nesnesi oluşturur (kayma olmaz)
function parseDateLocal(dateStr) {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day); // Yerel saat dilimine göre
}

// YYYY-MM-DD → GG/AA/YYYY formatına çevirir (tabloda gösterim için)
export function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = parseDateLocal(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Görüntüleme için GG/AA/YYYY formatı (readonly inputlarda kullanılır)
export function formatDateForDisplay(dateStr) {
    if (!dateStr) return '';
    const d = parseDateLocal(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// YYYY-MM-DD → GG/AA/YYYY (takvim ikonuyla seçilen tarihi göstermek için)
export function isoToDisplayDate(isoDate) {
    if (!isoDate) return '';
    const d = parseDateLocal(isoDate);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// GG/AA/YYYY → YYYY-MM-DD
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

// Tarih geçmiş mi? (saat dilimi kayması olmadan, yerel tarihe göre karşılaştırır)
export function isPastDate(dateStr) {
    const target = parseDateLocal(dateStr);
    if (!target) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return target < today;
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

// Tek girdili modal (boş değere izin VERMEZ - eski davranış)
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

// Tek girdili modal – mevcut değeri gösterir ve boş değere izin verir
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

// İki girdili modal (miktar + hafta)
export function openDoubleInputModal(title, placeholder1, placeholder2, callback) {
    const modal = document.getElementById('doubleInputModal');
    const titleEl = document.getElementById('doubleModalTitle');
    const input1 = document.getElementById('doubleInput1');
    const input2 = document.getElementById('doubleInput2');
    titleEl.innerText = title;
    input1.placeholder = placeholder1 || '';
    input2.placeholder = placeholder2 || '';
    input1.value = '';
    input2.value = '';
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

// Onay modalı (silme) - isteğe bağlı onCancel callback desteği
export function openConfirmModal(message, onConfirm, onCancel) {
    const modal = document.getElementById('confirmModal');
    if (!modal) return;
    const msgSpan = document.getElementById('confirmMessage');
    const yesBtn = document.getElementById('confirmModalYes');
    const noBtn = document.getElementById('confirmModalNo');
    if (!yesBtn || !noBtn) return;

    msgSpan.innerText = message;

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

// Lucide ikonlarını yenile
export function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
}