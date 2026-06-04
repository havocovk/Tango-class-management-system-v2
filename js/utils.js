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

// Tarih karşılaştırma (bugünden küçük mü)
export function isPastDate(dateStr) {
    const target = new Date(dateStr);
    target.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    return target < today;
}

// Dinamik modal oluşturma (basit)
export function createModal(title, inputPlaceholder, callback) {
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal';
    modalDiv.id = 'dynamicModal';
    modalDiv.innerHTML = `
        <div class="modal-content">
            <h3>${title}</h3>
            <input type="text" id="dynamicInput" placeholder="${inputPlaceholder}" autocomplete="off">
            <div style="display:flex; gap:10px; margin-top:15px;">
                <button class="btn-success" id="modalConfirm">Tamam</button>
                <button class="btn-secondary" id="modalCancel">İptal</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalDiv);
    modalDiv.style.display = 'flex';
    const input = modalDiv.querySelector('#dynamicInput');
    input.focus();
    const confirm = () => {
        const val = input.value.trim();
        if (val) callback(val);
        modalDiv.remove();
    };
    modalDiv.querySelector('#modalConfirm').onclick = confirm;
    modalDiv.querySelector('#modalCancel').onclick = () => modalDiv.remove();
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') confirm(); });
}

// Lucide ikonlarını yenile
export function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
}