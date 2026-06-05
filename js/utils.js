// Ortak yardımcı fonksiyonlar
export function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
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

// Tek girdili modal (prompt yerine)
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

// Onay modalı (silme) - BASİT VE GARANTİLİ VERSİYON
// Butonlara doğrudan onclick atar, her çağrıda önceki event'leri temizler.
export function openConfirmModal(message, onConfirm, onCancel = null) {
    const modal = document.getElementById('confirmModal');
    if (!modal) return;
    const msgSpan = document.getElementById('confirmMessage');
    const yesBtn = document.getElementById('confirmModalYes');
    const noBtn = document.getElementById('confirmModalNo');
    if (!yesBtn || !noBtn) return;
    
    msgSpan.innerText = message;
    
    // Eski onclick'leri kaldır
    yesBtn.onclick = null;
    noBtn.onclick = null;
    
    // Yeni onclick'leri ata
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