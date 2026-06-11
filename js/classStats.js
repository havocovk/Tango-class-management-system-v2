// ---------------------------------------------------------------
// classStats.js — Haftalık İstatistikler ve Katılım Grafiği
// ---------------------------------------------------------------
// Bu modül classes.js'ten ayrıldı. Sorumlulukları:
//   1. showWeeklyStats()    → haftalık program tablosunu çizer
//   2. drawChartForClass()  → seçilen sınıfın katılım bar grafiğini çizer
//
// Geri butonu navigateTo('classes', ...) ile router üzerinden çalışır.
// Bu sayede classes.js ile karşılıklı (döngüsel) import oluşmaz.
//
// BAĞIMLILIK HARİTASI:
//   classStats.js → supabaseClient.js  (DB sorguları)
//   classStats.js → utils.js           (refreshIcons, formatDate, escapeHtml)
//   classStats.js → state.js           (appState.currentSchoolId/Name)
//   classStats.js → router.js          (navigateTo — geri butonu için)
//   classes.js    → classStats.js      (dinamik import, çalışma anında)
// ---------------------------------------------------------------

import { supabase } from './supabaseClient.js';
import { refreshIcons, formatDate, escapeHtml } from './utils.js';
import { navigateTo } from './router.js';
import { appState } from './state.js';
import { t, tList } from './i18n.js';

// ---------------------------------------------------------------
// ADIM 2.1 — N+1 SORUNU DÜZELTİLDİ
// ESKİ: Her sınıf için ayrı ayrı veritabanına gidip son tarihi soruyordu
//        10 sınıf = 10 gidiş-dönüş
// YENİ: Tek seferde tüm sınıfların tüm tarihlerini çekiyor
//        10 sınıf = 1 gidiş-dönüş, JavaScript içinde gruplama yapılıyor
// ---------------------------------------------------------------
export async function showWeeklyStats() {
    const { data: allClasses } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', appState.currentSchoolId);

    if (!allClasses || allClasses.length === 0) {
        alert(t('stats.noClasses'));
        return;
    }

    // TÜM sınıfların ders tarihlerini TEK SORGUDA çek (azalan sırayla — en son önce gelir)
    const classIds = allClasses.map(c => c.id);
    const { data: allDates } = await supabase
        .from('course_dates')
        .select('class_id, date')
        .in('class_id', classIds)
        .order('date', { ascending: false });

    // Her sınıfın YALNIZCA EN SON ders tarihini al.
    // Rationale: Bir sınıfın günü değiştiğinde (örn. Cumartesi → Pazartesi),
    // eski Cumartesi dersleri veritabanında kalmaya devam eder. Tüm günleri
    // gösterirsek sınıf hem Cumartesi hem Pazartesi sütununda görünür — yanlış.
    // Yalnızca son tarihin günü sınıfın "şu anki" gününü doğru yansıtır.
    const classLastDate = {};
    if (allDates) {
        allDates.forEach(d => {
            // Azalan sırayla geldiği için ilk karşılaşılan = en son tarih
            if (!classLastDate[d.class_id]) {
                classLastDate[d.class_id] = d.date;
            }
        });
    }

    const days = tList('stats.days');

    // 7 günlük hücre yapısı — her gün için o günde ders yapan sınıfların listesi
    let cells = Array(7).fill().map(() => []);

    for (const cls of allClasses) {
        const lastDateStr = classLastDate[cls.id];
        if (lastDateStr) {
            const [year, month, day] = lastDateStr.split('-').map(Number);
            const dateObj = new Date(year, month - 1, day);
            const dayIndex = dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1;
            if (dayIndex >= 0 && dayIndex < 7) {
                cells[dayIndex].push({ id: cls.id, name: cls.name });
            }
        }
    }

    // HTML oluştur
    let html = `
        <div class="view">
            <div class="back-link" id="statsBackBtn">${escapeHtml(t('nav.backGeneric'))}</div>
            <div class="main-title">${escapeHtml(t('stats.header'))}</div>
            <table class="stats-table">
                <thead>
                    <tr>${days.map(d => `<th>${d}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    <tr>
    `;

    for (let i = 0; i < 7; i++) {
        let cellContent = '';
        const classList = cells[i];
        if (classList.length === 0) {
            cellContent = '<div style="min-height: 50px;">&nbsp;</div>';
        } else {
            let fontSizeClass = '';
            if (classList.length === 1) fontSizeClass = 'dynamic-font-size-1';
            else if (classList.length === 2) fontSizeClass = 'dynamic-font-size-2';
            else if (classList.length >= 3) fontSizeClass = 'dynamic-font-size-3';

            const itemsHtml = classList.map(cls => {
                let displayName = escapeHtml(cls.name);
                let firstPart = displayName;
                let secondPart = '';
                const spaceIndex = displayName.indexOf(' ');
                if (spaceIndex !== -1 && displayName.length > 12) {
                    firstPart = displayName.substring(0, spaceIndex);
                    secondPart = displayName.substring(spaceIndex + 1);
                } else if (displayName.length > 12) {
                    firstPart = displayName.substring(0, 8);
                    secondPart = displayName.substring(8);
                }

                const innerHtml = secondPart
                    ? `<div class="class-multi-line"><span>${firstPart}</span><span>${secondPart}</span></div>`
                    : `<div>${firstPart}</div>`;

                return `<span class="class-item-link ${fontSizeClass}" data-class-id="${cls.id}">${innerHtml}</span>`;
            }).join('');

            cellContent = `<div style="display:flex; flex-direction:column; gap:4px;">${itemsHtml}</div>`;
        }
        html += `<td>${cellContent}</td>`;
    }

    html += `
                    </tr>
                </tbody>
            </table>
            <div id="chartTitle" style="text-align:center; padding:12px 15px 4px; color:var(--accent); font-weight:700;">${escapeHtml(t('stats.chartHint'))}</div>
            <div id="chartSection">
                <div id="chartContainer" class="chart-container" style="justify-content: center; align-items: center;">
                    <div style="color: var(--text-dim); text-align: center; padding: 40px 0;">${escapeHtml(t('stats.chartNoneSelected'))}</div>
                </div>
            </div>
        </div>
    `;

    const container = document.getElementById('dynamicView');
    container.innerHTML = html;

    // ---------------------------------------------------------------
    // Geri butonu: navigateTo('classes', ...) kullanıyor.
    // Doğrudan showClassesView import etmek classes.js ↔ classStats.js
    // arasında döngüsel bağımlılık yaratırdı. Router bu sorunu çözer.
    // ---------------------------------------------------------------
    document.getElementById('statsBackBtn').onclick = () =>
        navigateTo('classes', {
            schoolId:   appState.currentSchoolId,
            schoolName: appState.currentSchoolName
        });

    document.querySelectorAll('.class-item-link').forEach(el => {
        el.addEventListener('click', async () => {
            const classId = parseInt(el.dataset.classId);
            await drawChartForClass(classId);
        });
    });

    refreshIcons();
}

// ---------------------------------------------------------------
// ADIM 2.2 — GRAFİK N+1 SORUNU DÜZELTİLDİ
// ESKİ: Her hafta için ayrı ayrı yoklama sorgusu yapıyordu
//        20 hafta = 20 gidiş-dönüş
// YENİ: Tüm haftaların yoklamalarını tek sorguda çekiyor
//        20 hafta = 1 gidiş-dönüş, JavaScript içinde gruplama yapılıyor
// ---------------------------------------------------------------
async function drawChartForClass(classId) {
    const { data: cls } = await supabase.from('classes').select('name').eq('id', classId).single();
    if (!cls) return;

    const { data: dates } = await supabase
        .from('course_dates')
        .select('id, date')
        .eq('class_id', classId)
        .order('date');

    if (!dates || dates.length === 0) {
        document.getElementById('chartTitle').innerHTML = t('stats.chartNoDatesTitle', { name: `<strong>${escapeHtml(cls.name)}</strong>` });
        const chartContainer = document.getElementById('chartContainer');
        chartContainer.innerHTML = `<div style="color: var(--text-dim); text-align: center;">${escapeHtml(t('stats.chartNoDatesBody'))}</div>`;
        chartContainer.style.justifyContent = 'center';
        refreshIcons();
        return;
    }

    const { data: students } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', classId);

    const studentIds = (students || []).map(s => s.id);
    const dateIds = dates.map(d => d.id);

    // TÜM haftaların yoklamalarını TEK SORGUDA çek
    const { data: allAtts } = await supabase
        .from('attendance')
        .select('course_date_id, status')
        .in('course_date_id', dateIds)
        .in('student_id', studentIds);

    // Her haftanın katılım sayısını JavaScript içinde hesapla
    const countByDate = {};
    dateIds.forEach(id => { countByDate[id] = 0; });
    if (allAtts) {
        allAtts.forEach(a => {
            if (a.status === '+' || a.status === '-') {
                countByDate[a.course_date_id] = (countByDate[a.course_date_id] || 0) + 1;
            }
        });
    }

    const chartTitle = document.getElementById('chartTitle');
    chartTitle.innerHTML = t('stats.chartTitle', { name: `<strong>${escapeHtml(cls.name)}</strong>` });

    const chartContainer = document.getElementById('chartContainer');
    chartContainer.innerHTML = '';
    chartContainer.style.justifyContent = '';
    chartContainer.style.alignItems = '';

    // ----- KATMAN 1: Çubuk alanı -----
    const barsZone = document.createElement('div');
    barsZone.className = 'chart-bars-zone';

    // ----- KATMAN 2: X ekseni çizgisi -----
    const xAxis = document.createElement('div');
    xAxis.className = 'chart-xaxis';

    // ----- KATMAN 3: Tarih etiketi alanı -----
    const datesZone = document.createElement('div');
    datesZone.className = 'chart-dates-zone';

    dates.forEach(dateObj => {
        const count = countByDate[dateObj.id] || 0;
        const barHeight = Math.min(270, Math.max(4, count * 22));

        // Çubuk sütunu (sayı + çubuk)
        const col = document.createElement('div');
        col.className = 'bar-col';
        col.innerHTML = `
            <div class="bar-count">${count}</div>
            <div class="bar" style="height:${barHeight}px;"></div>
        `;
        barsZone.appendChild(col);

        // Tarih etiketi
        const dateLabel = document.createElement('div');
        dateLabel.className = 'bar-date';
        dateLabel.textContent = formatDate(dateObj.date);
        datesZone.appendChild(dateLabel);
    });

    chartContainer.appendChild(barsZone);
    chartContainer.appendChild(xAxis);
    chartContainer.appendChild(datesZone);

    refreshIcons();
}