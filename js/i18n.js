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
// setLang(lang) — dili değiştirir, tarayıcıya kaydeder ve
// sayfadaki tüm sabit (HTML) metinleri yeniden çevirir.
// ---------------------------------------------------------------
export function setLang(lang) {
    if (!DICTS[lang]) return;
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* yoksay */ }
    document.documentElement.lang = lang;
    applyTranslations();
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