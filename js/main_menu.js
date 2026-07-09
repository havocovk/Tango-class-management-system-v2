// ---------------------------------------------------------------
// main_menu.js — ANA MENÜ MODÜLÜ
// ADIM 2.3 — Ana menüyü yükle ve göster
// ---------------------------------------------------------------
// Bu modül uygulama açılınca ilk görünen ekranı çizer.
// 4 büyük buton: Grup Dersleri, Çalıştaylar, Festivaller, Özel Dersler
// Borçlu özet paneli ve son açılan sınıf kısayolu da burada gösterilir.
// ---------------------------------------------------------------

import { navigateTo } from './router.js';
import { appState } from './state.js';
import { refreshIcons, escapeHtml } from './utils.js';
import { t } from './i18n.js';

// ---------------------------------------------------------------
// loadMainMenu — router.js tarafından çağrılır.
// Borçlu özetini schools.js'den alır (zaten appState'te hazır),
// ardından ana menüyü çizer.
// ---------------------------------------------------------------
export async function loadMainMenu() {
    // Borçlu özet verisi appState._debtSummary içinde schools.js
    // tarafından doldurulur. Henüz doldurulmamışsa schools.js'i çağırarak
    // doldur (ilk açılışta bu durum oluşabilir).
    if (!appState._debtSummary) {
        const schoolsModule = await import('./schools.js');
        await schoolsModule.loadSchools();
        // loadSchools zaten renderSchoolsView çağırır; biz sadece
        // borçlu özetini doldurmak için çağırıyoruz ama renderSchoolsView
        // dynamicView'e yazacak — biz hemen üzerine mainMenu'yü yazacağız.
    }

    renderMainMenu();
}

// ---------------------------------------------------------------
// renderMainMenu — DOM'u günceller, event listener'ları bağlar.
// ---------------------------------------------------------------
function renderMainMenu() {
    const view = document.getElementById('mainMenuView');
    if (!view) return;

    // Borçlu özet paneli HTML'i
    const debtHtml = buildDebtSummaryHtml();

    // Son açılan sınıf kısayol kartı HTML'i
    const lastClassHtml = buildLastClassHtml();

    view.innerHTML = `
        <div class="main-menu-view">
            <div class="main-menu-title">${escapeHtml(t('nav.appTitle'))}</div>

            ${lastClassHtml}
            ${debtHtml}

            <div class="main-menu-grid">

                <!-- Grup Dersleri -->
                <button class="menu-btn menu-btn-group" id="menuBtnGroup">
                    <div class="menu-btn-icon">
                        <i data-lucide="school" size="26"></i>
                    </div>
                    <span class="menu-btn-label">${escapeHtml(t('mainMenu.groupClasses'))}</span>
                </button>

                <!-- Çalıştaylar -->
                <button class="menu-btn menu-btn-workshop" id="menuBtnWorkshop">
                    <div class="menu-btn-icon">
                        <i data-lucide="layers" size="26"></i>
                    </div>
                    <span class="menu-btn-label">${escapeHtml(t('mainMenu.workshops'))}</span>
                </button>

                <!-- Festivaller -->
                <button class="menu-btn menu-btn-festival" id="menuBtnFestival">
                    <div class="menu-btn-icon">
                        <i data-lucide="music-2" size="26"></i>
                    </div>
                    <span class="menu-btn-label">${escapeHtml(t('mainMenu.festivals'))}</span>
                </button>

                <!-- Özel Dersler -->
                <button class="menu-btn menu-btn-private" id="menuBtnPrivate">
                    <div class="menu-btn-icon">
                        <i data-lucide="user-round" size="26"></i>
                    </div>
                    <span class="menu-btn-label">${escapeHtml(t('mainMenu.privateLessons'))}</span>
                </button>

            </div>
        </div>
    `;

    // mainMenuView'i göster, dynamicView'i gizle
    view.style.display = 'block';
    const dynView = document.getElementById('dynamicView');
    if (dynView) dynView.style.display = 'none';

    // Buton click olayları
    document.getElementById('menuBtnGroup').onclick = () => {
        navigateTo('schools');
    };

    document.getElementById('menuBtnWorkshop').onclick = () => {
        // Adım 4'te geliştirilecek; şimdilik placeholder toast
        navigateTo('workshops');
    };

    document.getElementById('menuBtnFestival').onclick = () => {
        // Adım 5'te geliştirilecek; şimdilik placeholder toast
        navigateTo('festivals');
    };

    document.getElementById('menuBtnPrivate').onclick = () => {
        // Adım 6'da geliştirilecek; şimdilik placeholder toast
        navigateTo('privateLessons');
    };

    // Son açılan sınıf kısayol kartı click olayı
    const lastCard = document.getElementById('lastClassCardMenu');
    if (lastCard) {
        lastCard.addEventListener('click', () => {
            try {
                const last = JSON.parse(localStorage.getItem('tcms_last_class'));
                if (last && last.classId) {
                    appState.currentSchoolId   = last.schoolId;
                    appState.currentSchoolName = last.schoolName;
                    navigateTo('attendance', { classId: last.classId, className: last.className });
                }
            } catch (e) { /* yoksay */ }
        });
    }

    // Borçlu paneli tıklama olayları
    document.querySelectorAll('[data-debt-class]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const classId   = parseInt(el.dataset.debtClass);
            const className = el.dataset.debtCname;
            const school = appState.currentSchools
                ? appState.currentSchools.find(s =>
                    appState._debtSummary &&
                    appState._debtSummary.classSchoolMap &&
                    appState._debtSummary.classSchoolMap[classId] === s.id
                  )
                : null;
            if (school) {
                appState.currentSchoolId   = school.id;
                appState.currentSchoolName = school.name;
            }
            navigateTo('payments', { classId, className });
        });
    });

    refreshIcons();
}

// ---------------------------------------------------------------
// buildDebtSummaryHtml — Borçlu/bitiyor öğrenci özet paneli
// Mevcut schools.js'deki aynı mantığın kopyası
// ---------------------------------------------------------------
function buildDebtSummaryHtml() {
    if (!appState._debtSummary) return '';
    const { debtors, warning } = appState._debtSummary;
    if (!debtors.length && !warning.length) return '';

    const debtorItems = debtors.map(d =>
        `<span style="cursor:pointer;text-decoration:underline;color:#ef4444;"
            data-debt-class="${d.classId}"
            data-debt-cname="${escapeHtml(d.className)}"
         >${escapeHtml(d.studentName)}</span>`
    ).join(', ');

    const warningItems = warning.map(d =>
        `<span style="cursor:pointer;text-decoration:underline;color:var(--accent);"
            data-debt-class="${d.classId}"
            data-debt-cname="${escapeHtml(d.className)}"
         >${escapeHtml(d.studentName)}</span>`
    ).join(', ');

    let html = `<div id="debtSummaryPanel" style="
        background:rgba(239,68,68,0.07);
        border:1px solid rgba(239,68,68,0.3);
        border-radius:14px;
        padding:14px 16px;
        margin-bottom:16px;
        font-size:13px;
        line-height:1.8;
    ">`;
    html += `<div style="font-weight:700;color:#ef4444;margin-bottom:6px;">⚠ Ödeme Durumu</div>`;
    if (debtors.length)
        html += `<div><span style="color:#ef4444;font-weight:700;">${debtors.length} borçlu:</span> ${debtorItems}</div>`;
    if (warning.length)
        html += `<div><span style="color:var(--accent);font-weight:700;">${warning.length} bitiyor:</span> ${warningItems}</div>`;
    html += `</div>`;
    return html;
}

// ---------------------------------------------------------------
// buildLastClassHtml — Son açılan sınıf kısayol kartı
// ---------------------------------------------------------------
function buildLastClassHtml() {
    try {
        const raw = localStorage.getItem('tcms_last_class');
        if (!raw) return '';
        const last = JSON.parse(raw);
        if (!last || !last.classId) return '';
        // 7 günden eski kayıtları gösterme
        if ((Date.now() - last.timestamp) >= 7 * 24 * 60 * 60 * 1000) return '';

        return `
        <div id="lastClassCardMenu" style="
            background:rgba(45,212,191,0.08);
            border:1px solid rgba(45,212,191,0.3);
            border-radius:14px;
            padding:14px 16px;
            margin-bottom:16px;
            display:flex;
            align-items:center;
            justify-content:space-between;
            cursor:pointer;
            gap:10px;
        ">
            <div style="display:flex;flex-direction:column;gap:2px;">
                <div style="font-size:11px;color:var(--text-dim);">⚡ Son açılan sınıf</div>
                <div style="font-size:15px;font-weight:700;color:var(--primary);">${escapeHtml(last.className)}</div>
                <div style="font-size:11px;color:var(--text-dim);">${escapeHtml(last.schoolName)}</div>
            </div>
            <i data-lucide="chevron-right" style="color:var(--primary);flex-shrink:0;" size="20"></i>
        </div>`;
    } catch (e) {
        return '';
    }
}