// ---------------------------------------------------------------
// i18n.js — ÇOK DİLLİ DESTEK MOTORU
// ---------------------------------------------------------------
// Bu dosya uygulamanın "tercümanı"dır. Tüm metinler artık doğrudan
// koda yazılmaz; bunun yerine bir "anahtar" (key) ile çağrılır ve
// o anki seçili dile göre karşılığı gösterilir.
//
//   t('common.save')  →  Türkçe: "Kaydet"   /   İngilizce: "Save"
//
// ÖZELLİKLER:
//   - Dil seçimi tarayıcıda KALICI saklanır (localStorage).
//   - Uygulama ilk açılışta TÜRKÇE gelir. Kullanıcı İngilizce
//     seçerse, kapatıp açınca İngilizce açılır.
//   - YENİ DİL EKLEMEK ÇOK KOLAY: locales/ klasörüne yeni bir dosya
//     (örn. de.js) ekle, aşağıda DICTS ve AVAILABLE_LANGS listesine
//     bir satır ekle — hepsi bu. Başka hiçbir yeri değiştirmen gerekmez.
// ---------------------------------------------------------------

import { tr } from '../locales/tr.js';
import { en } from '../locales/en.js';

// ---------------------------------------------------------------
// DİL KAYIT DEFTERİ — yeni dil eklemek için tek değişeceğin yer
// ---------------------------------------------------------------
const DICTS = { tr, en };

export const AVAILABLE_LANGS = [
    { code: 'tr', label: 'Türkçe',  short: 'TR' },
    { code: 'en', label: 'English', short: 'EN' }
];

const STORAGE_KEY  = 'tcms_lang';  // tarayıcıda dilin saklandığı anahtar
const DEFAULT_LANG = 'tr';         // ilk açılış dili

let currentLang = DEFAULT_LANG;

// ---------------------------------------------------------------
// initLang() — uygulama açılır açılmaz çağrılır.
// Tarayıcıda kayıtlı dil varsa onu, yoksa varsayılanı (TR) seçer.
// ---------------------------------------------------------------
export function initLang() {
    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { saved = null; }
    currentLang = (saved && DICTS[saved]) ? saved : DEFAULT_LANG;
    document.documentElement.lang = currentLang;
    return currentLang;
}

// ---------------------------------------------------------------
// getLang() — o an aktif dil kodunu döndürür ('tr' / 'en')
// ---------------------------------------------------------------
export function getLang() {
    return currentLang;
}

// ---------------------------------------------------------------
// DİL DEĞİŞİM OLAYLARI — dil değişince haber verilmek isteyen
// modüller (örn. app.js) buraya fonksiyon kaydeder. setLang her
// çağrıldığında bu fonksiyonlar çalışır (örn. bulunulan sayfayı
// yeni dilde yeniden çizmek için).
// ---------------------------------------------------------------
const changeCallbacks = [];

export function onLangChange(cb) {
    if (typeof cb === 'function') changeCallbacks.push(cb);
}

// ---------------------------------------------------------------
// setLang(lang) — dili değiştirir, tarayıcıya kaydeder, sayfadaki
// tüm sabit (HTML) metinleri yeniden çevirir, dil butonunu tazeler
// ve kayıtlı dinleyicileri (callback) tetikler.
// ---------------------------------------------------------------
export function setLang(lang) {
    if (!DICTS[lang]) return;
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* yoksay */ }
    document.documentElement.lang = lang;
    applyTranslations();
    renderLangSwitcher();
    changeCallbacks.forEach(cb => { try { cb(lang); } catch (e) { /* yoksay */ } });
}

// ---------------------------------------------------------------
// İç yardımcı: "a.b.c" gibi noktalı anahtarı sözlükte bulur
// ---------------------------------------------------------------
function lookup(dict, key) {
    return key.split('.').reduce(
        (obj, part) => (obj && obj[part] !== undefined ? obj[part] : undefined),
        dict
    );
}

// ---------------------------------------------------------------
// t(key, params) — METİN ÇEVİRİSİ (ana fonksiyon)
//   t('common.save')                       → "Kaydet"
//   t('schools.toastAdded', { name: 'X' }) → "X eklendi ✓"
//
// {name} gibi yer tutucular params nesnesiyle doldurulur.
// Anahtar bulunamazsa önce varsayılan dile, o da yoksa anahtarın
// kendisine düşer (uygulama asla çökmez).
// ---------------------------------------------------------------
export function t(key, params) {
    const dict = DICTS[currentLang] || DICTS[DEFAULT_LANG];
    let val = lookup(dict, key);
    if (val === undefined) val = lookup(DICTS[DEFAULT_LANG], key);
    if (val === undefined) return key;

    if (params && typeof val === 'string') {
        val = val.replace(/\{(\w+)\}/g, (m, p) =>
            (params[p] !== undefined ? params[p] : m)
        );
    }
    return val;
}

// ---------------------------------------------------------------
// tList(key) — DİZİ (liste) çevirisi
// Gün adları, ay adları gibi liste halindeki çeviriler için.
//   tList('stats.days')   → ["Pzt","Sal",...] / ["Mon","Tue",...]
// ---------------------------------------------------------------
export function tList(key) {
    const dict = DICTS[currentLang] || DICTS[DEFAULT_LANG];
    let val = lookup(dict, key);
    if (val === undefined) val = lookup(DICTS[DEFAULT_LANG], key);
    return Array.isArray(val) ? val : [];
}

// ---------------------------------------------------------------
// applyTranslations(root) — SABİT (HTML) METİNLERİ ÇEVİRİR
// index.html içindeki şu işaretli öğeleri tarar ve çevirir:
//   data-i18n="key"             → öğenin metnini (textContent) değiştirir
//   data-i18n-placeholder="key" → input placeholder'ını değiştirir
//   data-i18n-html="key"        → öğenin iç HTML'ini değiştirir
// Dil her değiştiğinde otomatik yeniden çağrılır.
// ---------------------------------------------------------------
export function applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
        el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
}

// ---------------------------------------------------------------
// DİL SEÇİCİ (DROPDOWN) — TÜM SAYFALARDA görünen tek buton.
// Butona tıklayınca diller açılır menü olarak listelenir; biri
// seçilince site o dile döner. AVAILABLE_LANGS'ten otomatik üretilir:
// yeni dil eklenince menüye kendiliğinden gelir.
//
// index.html'deki sabit (#langSwitcher) kabına çizilir. Bu kap
// #dynamicView dışında olduğu için sayfa değişse de yerinde kalır.
// ---------------------------------------------------------------
let switcherContainerId = null;

export function mountLangSwitcher(containerId) {
    switcherContainerId = containerId;
    renderLangSwitcher();
}

function renderLangSwitcher() {
    if (!switcherContainerId) return;
    const container = document.getElementById(switcherContainerId);
    if (!container) return;

    const active = AVAILABLE_LANGS.find(l => l.code === currentLang) || AVAILABLE_LANGS[0];

    const optionsHtml = AVAILABLE_LANGS.map(l => {
        const isActive = l.code === currentLang;
        const optStyle = [
            'display:flex', 'align-items:center', 'gap:8px',
            'padding:10px 14px', 'cursor:pointer', 'font-size:13px',
            'font-weight:700', 'white-space:nowrap',
            'color:' + (isActive ? '#000' : 'var(--text-main)'),
            'background:' + (isActive ? 'var(--primary)' : 'transparent')
        ].join(';');
        return `<div class="lang-option" data-lang="${l.code}" style="${optStyle}">
                    <span style="opacity:0.7; min-width:22px;">${l.short}</span>
                    <span>${l.label}</span>
                </div>`;
    }).join('');

    const btnStyle = [
        'display:inline-flex', 'align-items:center', 'gap:6px',
        'padding:7px 12px', 'border-radius:10px', 'cursor:pointer',
        'font-size:12px', 'font-weight:700', 'letter-spacing:0.3px',
        'background:var(--card-bg)', 'color:var(--primary)',
        'border:1px solid var(--primary)', 'box-shadow:0 4px 14px rgba(0,0,0,0.35)'
    ].join(';');

    const menuStyle = [
        'display:none', 'position:absolute', 'top:calc(100% + 6px)', 'right:0',
        'min-width:150px', 'background:var(--card-bg)',
        'border:1px solid var(--border)', 'border-radius:12px',
        'overflow:hidden', 'box-shadow:0 10px 30px rgba(0,0,0,0.5)'
    ].join(';');

    container.innerHTML = `
        <button id="langSwitchBtn" type="button" style="${btnStyle}">
            <span>🌐</span><span>${active.short}</span><span style="font-size:10px;">▾</span>
        </button>
        <div id="langSwitchMenu" style="${menuStyle}">${optionsHtml}</div>
    `;

    const btn  = container.querySelector('#langSwitchBtn');
    const menu = container.querySelector('#langSwitchMenu');

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    });

    container.querySelectorAll('.lang-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.style.display = 'none';
            const lang = opt.dataset.lang;
            if (lang !== currentLang) setLang(lang);
        });
    });

    // Menü dışına tıklayınca kapansın (tek dinleyici, tekrarı önlemek için önce kaldır)
    document.removeEventListener('click', closeLangMenuOnOutside);
    document.addEventListener('click', closeLangMenuOnOutside);
}

function closeLangMenuOnOutside() {
    const menu = document.getElementById('langSwitchMenu');
    if (menu) menu.style.display = 'none';
}