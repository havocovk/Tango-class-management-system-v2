// ---------------------------------------------------------------
// main_menu.js — ANA MENÜ MODÜLÜ
// ADIM 2.3 — Ana menüyü yükle ve göster
// ---------------------------------------------------------------
// Bu modül uygulama açılınca ilk görünen ekranı çizer.
// 4 büyük buton: Grup Dersleri, Çalıştaylar, Festivaller, Özel Dersler
// Borçlu özet paneli ve son açılan sınıf kısayolu da burada gösterilir.
// ---------------------------------------------------------------

import { navigateTo } from './router.js';
import { refreshIcons, escapeHtml } from './utils.js';
import { t } from './i18n.js';

// ---------------------------------------------------------------
// loadMainMenu — router.js tarafından çağrılır.
// Borçlu özetini schools.js'den alır (zaten appState'te hazır),
// ardından ana menüyü çizer.
// ---------------------------------------------------------------
export async function loadMainMenu() {
    renderMainMenu();
}

// ---------------------------------------------------------------
// renderMainMenu — DOM'u günceller, event listener'ları bağlar.
// ---------------------------------------------------------------
function renderMainMenu() {
    const view = document.getElementById('mainMenuView');
    if (!view) return;

    view.innerHTML = `
        <div class="main-menu-view">
            <div class="main-menu-title">${escapeHtml(t('nav.appTitle'))}</div>

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

    // Görünürlük router.js tarafından yönetilir

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

    refreshIcons();
}