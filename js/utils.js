// Ortak yardımcı fonksiyonlar
export function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Görüntüleme için GG.AA.YYYY formatı (readonly inputlarda kullanılır)
export function formatDateForDisplay(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// YYYY-MM-DD formatından GG.AA.YYYY'ye çevirir (tersi için parseDisplayDateToISO)
export function isoToDisplayDate(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// GG.AA.YYYY -> YYYY-MM-DD (kullanıcı manuel giriş yaparsa diye, ama readonly yaptığımız için çok gerekmez, yine de ekleyelim)
export function displayDateToISO(displayDate) {
    if (!displayDate) return '';
    const parts = displayDate.split('/');
    if (parts.length !== 3) return '';
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
}

export function isoDate(dateStr) {
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
}

export function showModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
}

export function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

export function isPastDate(dateStr) {
    const target = new Date(dateStr);
    target.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    return target < today;
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