// ---------------------------------------------------------------
// workshop_payments.js — ÇALIŞTAY ÖDEMELERİ
// ADIM 4.7 — Çalıştay ödeme takibi (iki ayrı mod)
// ---------------------------------------------------------------
// Çalıştayın payment_type değerine göre iki farklı ekran çizilir:
//
//   payment_type = 'upfront' (Baştan Ödeme):
//       Öğrenci çalıştay başında toplam ücreti bir kez öder.
//       Her öğrenci ya "Ödendi" ya da "Beklemede" durumundadır.
//
//   payment_type = 'weekly' (Haftalık Ödeme):
//       Grup dersi ödemeleri gibi öğrenci × hafta tablosu.
//       Borç = gelen (geçmiş) hafta sayısı − ödenen hafta.
//       Gelecek haftalar henüz "gelmediği" için borç saymaz.
//
// TABLO YAPISI (Supabase):
//   workshop_payments:
//     id, workshop_id, student_id,
//     workshop_date_id  (upfront modda NULL, weekly modda başlangıç haftası),
//     amount, weeks_covered, created_at
// ---------------------------------------------------------------

import { supabase } from './supabaseClient.js';
import { formatDate, refreshIcons, openDoubleInputModal, openPromptModalWithValue, openConfirmModal, showToast, escapeHtml } from './utils.js';
import { navigateTo } from './router.js';
import { appState } from './state.js';

// ---------------------------------------------------------------
// Giriş noktası — router.js çağırır
// ---------------------------------------------------------------
export async function showWorkshopPayments(workshopId, workshopName) {
    appState.currentWorkshopId   = workshopId;
    appState.currentWorkshopName = workshopName;
    await loadWorkshopPaymentsData();
    renderWorkshopPaymentsView();
}

// ---------------------------------------------------------------
// Supabase'den çalıştay ödeme verisini çek
// ---------------------------------------------------------------
async function loadWorkshopPaymentsData() {
    const wid = appState.currentWorkshopId;

    // Çalıştay ana bilgisi (payment_type, total_price, weekly_price, total_weeks)
    const { data: wsData } = await supabase.from('workshops').select('*').eq('id', wid).single();
    appState.currentWorkshop = wsData || null;

    // Öğrenciler
    const { data: students } = await supabase
        .from('workshop_students').select('*').eq('workshop_id', wid).order('id');
    appState.wsStudents = students || [];

    // Haftalar (tarihler)
    const { data: dates } = await supabase
        .from('workshop_dates').select('*').eq('workshop_id', wid).order('week_number');
    appState.wsDates = dates || [];

    // Yoklama — bu çalıştaya ait tüm yoklamaları çek;
    // hem student_id hem workshop_date_id kesinlikle Number olarak sakla
    // (tip uyumsuzluğu anahtar eşleşmesini bozmasın).
    const dateIds = appState.wsDates.map(d => d.id);
    appState.wsAttendanceMap = {};
    if (dateIds.length > 0) {
        const { data: att } = await supabase
            .from('workshop_attendance')
            .select('*')
            .eq('workshop_id', wid)
            .in('workshop_date_id', dateIds);
        if (att) att.forEach(a => {
            const sid = Number(a.student_id);
            const did = Number(a.workshop_date_id);
            appState.wsAttendanceMap[`${sid}_${did}`] = (a.status || '').toString().trim();
        });
    }

    // Ödemeler
    const studentIds = appState.wsStudents.map(s => s.id);
    appState.wsPayments = [];
    if (studentIds.length > 0) {
        const { data: pays } = await supabase
            .from('workshop_payments').select('*').in('student_id', studentIds);
        appState.wsPayments = pays || [];
    }
}

// ---------------------------------------------------------------
// WhatsApp hatırlatma butonu HTML'i üretir
// ---------------------------------------------------------------
function buildWaLink(student, message) {
    if (!student.phone) return '';
    const digits  = student.phone.replace(/\D/g, '');
    const waPhone = digits.startsWith('90') ? digits
                  : digits.startsWith('0')  ? '90' + digits.slice(1)
                  : digits.startsWith('5')  ? '90' + digits
                  : digits;
    return `<a href="https://wa.me/${waPhone}?text=${encodeURIComponent(message)}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;background:#128C7E;color:white;text-decoration:none;padding:4px 8px;border-radius:8px;font-size:10px;font-weight:700;margin-top:4px;">💬 WA</a>`;
}

// ---------------------------------------------------------------
// Bir haftanın "gelmiş" (geçmiş veya bugün) olup olmadığını döndürür.
// Gelecekteki haftalar weekly borç hesabında sayılmaz.
// ---------------------------------------------------------------
function isWeekOccurred(dateStr) {
    if (!dateStr) return false;
    const [y, m, d] = dateStr.split('-').map(Number);
    const target = new Date(y, m - 1, d); target.setHours(0, 0, 0, 0);
    const today  = new Date();          today.setHours(0, 0, 0, 0);
    return target <= today;
}

// ---------------------------------------------------------------
// Ortak üst başlık (geri linki + başlık + çalıştay adı + mod etiketi)
// ---------------------------------------------------------------
function headerHtml(modeLabel) {
    return `
        <div class="back-link" id="wsBackToAttendanceBtn">← Yoklamaya Dön</div>
        <div class="main-title">Çalıştay Ödemeleri</div>
        <div style="text-align:center; color:var(--primary); font-size:14px; margin-bottom:4px; font-weight:600;">
            ${escapeHtml(appState.currentWorkshopName || '')}
        </div>
        <div style="text-align:center; color:var(--text-dim); font-size:12px; margin-bottom:16px;">
            ${modeLabel}
        </div>`;
}

function wireBackButton() {
    const btn = document.getElementById('wsBackToAttendanceBtn');
    if (btn) btn.onclick = () => navigateTo('workshopDetail', {
        workshopId:   appState.currentWorkshopId,
        workshopName: appState.currentWorkshopName
    });
}

// ---------------------------------------------------------------
// Hangi ekranın çizileceğine karar ver
// ---------------------------------------------------------------
function renderWorkshopPaymentsView() {
    const ws   = appState.currentWorkshop;
    const mode = (ws && ws.payment_type) ? ws.payment_type : 'upfront';
    if (mode === 'weekly') renderWeeklyPayments();
    else                   renderUpfrontPayments();
}

// ===============================================================
// MOD 1 — BAŞTAN ÖDEME (upfront)
// ===============================================================
function renderUpfrontPayments() {
    const container = document.getElementById('dynamicView');
    if (!container) return;
    const ws = appState.currentWorkshop;
    const totalPrice = (ws && ws.total_price) ? Number(ws.total_price) : 0;

    const visible = appState.wsStudents.filter(s => !s.is_archived);

    // Özet
    let totalCollected = 0;
    let pendingCount   = 0;
    visible.forEach(s => {
        const pay = appState.wsPayments.find(p => p.student_id === s.id);
        if (pay) totalCollected += Number(pay.amount) || 0;
        else     pendingCount++;
    });

    const summaryHtml = `
        <div class="payment-summary">
            <div class="summary-card summary-total">
                <div class="summary-value">${totalCollected.toLocaleString('tr-TR')} ₺</div>
                <div class="summary-label">Toplam Tahsil</div>
            </div>
            <div class="summary-card summary-danger">
                <div class="summary-value">${pendingCount}</div>
                <div class="summary-label">Bekleyen</div>
            </div>
            <div class="summary-card summary-dates">
                <div class="summary-value">${visible.length}</div>
                <div class="summary-label">Öğrenci</div>
            </div>
        </div>`;

    // Satırlar
    let rowsHtml = '';
    if (visible.length === 0) {
        rowsHtml = `<tr><td colspan="4" style="text-align:center; color:var(--text-dim); padding:20px;">Henüz öğrenci eklenmemiş.</td></tr>`;
    } else {
        visible.forEach((s, idx) => {
            const pay  = appState.wsPayments.find(p => p.student_id === s.id);
            const paid = !!pay;

            const badge = paid
                ? `<span class="debt-badge debt-ok">Ödendi</span>`
                : `<span class="debt-badge debt-danger">Beklemede</span>`;

            const rowStyle = paid ? '' : 'background: rgba(239,68,68,0.07);';

            let wa = '';
            if (!paid && s.phone) {
                const msg = `Merhaba ${s.name}, "${ws.name}" çalıştayı ödemesini hatırlatmak isteriz.` + (totalPrice ? ` Tutar: ${totalPrice}₺.` : '');
                wa = buildWaLink(s, msg);
            }

            rowsHtml += `
            <tr style="${rowStyle}">
                <td>${idx + 1}</td>
                <td style="text-align:left; font-weight:600;">
                    <div style="display:flex; flex-direction:column; align-items:flex-start; gap:2px;">
                        <span>${escapeHtml(s.name)}</span>${wa}
                    </div>
                </td>
                <td>${badge}</td>
                <td class="ws-pay-cell ${paid ? 'paid-period' : ''}" data-student-id="${s.id}" style="cursor:pointer;">
                    ${paid ? (Number(pay.amount).toLocaleString('tr-TR') + '₺') : '–'}
                </td>
            </tr>`;
        });
    }

    container.innerHTML = `
        <div class="view">
            ${headerHtml('Baştan Ödeme')}
            ${summaryHtml}
            <div class="table-wrapper" style="margin-top:8px;">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Öğrenci</th>
                            <th style="white-space:nowrap;">Durum</th>
                            <th style="white-space:nowrap;">Tutar</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        </div>`;

    // Tutar hücresine tıklama → ödeme ekle / sil
    document.querySelectorAll('.ws-pay-cell[data-student-id]').forEach(cell => {
        cell.addEventListener('click', () => {
            const sid = parseInt(cell.dataset.studentId);
            if (isNaN(sid)) return;
            const existing = appState.wsPayments.find(p => p.student_id === sid);

            if (existing) {
                openConfirmModal('Bu ödemeyi silmek istediğinizden emin misiniz?', async () => {
                    const { error } = await supabase.from('workshop_payments').delete().eq('id', existing.id);
                    if (error) { showToast('Ödeme silinemedi.', 'error'); return; }
                    showToast('Ödeme silindi ✓', 'success');
                    await loadWorkshopPaymentsData();
                    renderWorkshopPaymentsView();
                });
            } else {
                const def = totalPrice ? String(totalPrice) : '';
                openPromptModalWithValue('Ödeme Ekle (₺)', def, 'Tutar', async (val) => {
                    const amount = parseFloat(val);
                    if (isNaN(amount) || amount <= 0) { showToast('Lütfen geçerli bir tutar girin.', 'error'); return; }
                    const { error } = await supabase.from('workshop_payments').insert({
                        workshop_id:      appState.currentWorkshopId,
                        student_id:       sid,
                        workshop_date_id: null,
                        amount:           amount,
                        weeks_covered:    ws.total_weeks || null
                    });
                    if (error) { showToast('Ödeme eklenemedi: ' + error.message, 'error'); return; }
                    showToast('Ödeme eklendi ✓', 'success');
                    await loadWorkshopPaymentsData();
                    renderWorkshopPaymentsView();
                });
            }
        });
    });

    wireBackButton();
    refreshIcons();
}

// ===============================================================
// MOD 2 — HAFTALIK ÖDEME (weekly)
// ===============================================================

// Bir öğrencinin belirli hafta indeksinde ödeme kapsamında olup
// olmadığını kontrol eder. İptal haftaları kapsam saymaz (grup
// dersi payments.js mantığının çalıştaya uyarlanmış hali).
function checkWsIsPaid(studentId, dateIndex) {
    const dateObj = appState.wsDates[dateIndex];
    if (!dateObj) return false;
    if (dateObj.is_cancelled) return false;

    for (const p of appState.wsPayments) {
        if (p.student_id !== studentId) continue;
        if (!p.workshop_date_id) continue; // upfront kaydı weekly tabloda yer almaz
        const startIdx = appState.wsDates.findIndex(d => d.id === p.workshop_date_id);
        if (startIdx === -1 || dateIndex < startIdx) continue;

        let validOrdinal = 0;
        for (let i = startIdx; i <= dateIndex; i++) {
            if (!appState.wsDates[i].is_cancelled) validOrdinal++;
        }
        if (validOrdinal >= 1 && validOrdinal <= (p.weeks_covered || 0)) return true;
    }
    return false;
}

// Öğrencinin borç durumu.
// Geçerli (borç doğuran) hafta = iptal DEĞİL + "S" DEĞİL + tarihi gelmiş.
function calcWsStudentDebt(student) {
    let validDates = 0;
    appState.wsDates.forEach(d => {
        if (d.is_cancelled) return;                  // iptal hafta → kimseye sayılmaz
        if (!isWeekOccurred(d.lesson_date)) return;  // gelecek hafta → henüz sayılmaz
        // Map her zaman Number(id) ile doldurulduğundan burada da Number kullan.
        const sid    = Number(student.id);
        const did    = Number(d.id);
        const status = (appState.wsAttendanceMap[`${sid}_${did}`] || '').toString().trim();
        // Sadece '+' (geldi) işaretli haftalar borç doğurur.
        // '-' (gelmedi), 'S' (sınıfta yoktu) ve boş → borç yok.
        if (status !== '+') return;
        validDates++;
    });

    const sp = appState.wsPayments.filter(p => p.student_id === student.id && p.workshop_date_id);
    const totalPaidWeeks = sp.reduce((sum, p) => sum + (p.weeks_covered || 0), 0);
    const remaining      = totalPaidWeeks - validDates;
    const totalAmount    = appState.wsPayments
        .filter(p => p.student_id === student.id)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    return { remaining, totalPaidWeeks, totalDates: validDates, totalAmount };
}

function getWsDebtBadge(remaining) {
    if (remaining < 0) {
        return { cls: 'debt-badge debt-danger',  text: `${Math.abs(remaining)} hafta borçlu` };
    } else if (remaining === 0) {
        return { cls: 'debt-badge debt-ok',       text: 'Güncel' };
    } else if (remaining <= 2) {
        return { cls: 'debt-badge debt-warning',  text: `${remaining} hafta kaldı` };
    } else {
        return { cls: 'debt-badge debt-info',     text: `${remaining} hafta avans` };
    }
}

function renderWeeklyPayments() {
    const container = document.getElementById('dynamicView');
    if (!container) return;
    const ws = appState.currentWorkshop;
    const weeklyPrice = (ws && ws.weekly_price) ? Number(ws.weekly_price) : 0;

    const visible = appState.wsStudents.filter(s => !s.is_archived);

    // Gelmiş (geçmiş/bugün) ve iptal olmayan hafta sayısı — özet kartı için
    const occurredWeeks = appState.wsDates.filter(d => !d.is_cancelled && isWeekOccurred(d.lesson_date)).length;

    // Borç haritası + özetler
    let totalCollected = 0;
    let debtorCount    = 0;
    let warningCount   = 0;
    const debtMap = {};
    visible.forEach(s => {
        const d = calcWsStudentDebt(s);
        debtMap[s.id] = d;
        totalCollected += d.totalAmount;
        if (d.remaining < 0)       debtorCount++;
        else if (d.remaining <= 2) warningCount++;
    });

    const summaryHtml = `
        <div class="payment-summary">
            <div class="summary-card summary-total">
                <div class="summary-value">${totalCollected.toLocaleString('tr-TR')} ₺</div>
                <div class="summary-label">Toplam Tahsil</div>
            </div>
            <div class="summary-card summary-danger">
                <div class="summary-value">${debtorCount}</div>
                <div class="summary-label">Borçlu</div>
            </div>
            <div class="summary-card summary-warning">
                <div class="summary-value">${warningCount}</div>
                <div class="summary-label">Az Kaldı</div>
            </div>
            <div class="summary-card summary-dates">
                <div class="summary-value">${occurredWeeks}</div>
                <div class="summary-label">Ders Yapılan Hafta</div>
            </div>
        </div>`;

    // Tablo başlığı (hafta tarihleri)
    const headCells = appState.wsDates.map(d => {
        const cancelled = d.is_cancelled ? ' th-date-cancelled' : '';
        return `<th class="th-date${cancelled}">${formatDate(d.lesson_date)}</th>`;
    }).join('');

    container.innerHTML = `
        <div class="view">
            ${headerHtml('Haftalık Ödeme')}
            ${summaryHtml}
            <div class="table-wrapper" style="margin-top:8px;">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Öğrenci</th>
                            <th style="white-space:nowrap; min-width:110px;">Durum</th>
                            ${headCells}
                        </tr>
                    </thead>
                    <tbody id="wsPayRows"></tbody>
                </table>
            </div>
        </div>`;

    const tbody = document.getElementById('wsPayRows');
    tbody.innerHTML = '';

    if (visible.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${3 + appState.wsDates.length}" style="text-align:center; color:var(--text-dim); padding:20px;">Henüz öğrenci eklenmemiş.</td></tr>`;
    } else {
        visible.forEach((student, idx) => {
            const { remaining } = debtMap[student.id];
            const badge = getWsDebtBadge(remaining);

            let rowStyle = '';
            if (remaining < 0)       rowStyle = 'background: rgba(239,68,68,0.07);';
            else if (remaining <= 2) rowStyle = 'background: rgba(251,191,36,0.07);';

            let wa = '';
            if (student.phone && (remaining < 0 || remaining <= 2)) {
                const msg = remaining < 0
                    ? `Merhaba ${student.name}, "${ws.name}" çalıştayı için ${Math.abs(remaining)} haftalık ödemeniz bekleniyor.`
                    : `Merhaba ${student.name}, "${ws.name}" çalıştayı ödemenizin ${remaining} hafta içinde yenilenmesi gerekiyor.`;
                wa = buildWaLink(student, msg);
            }

            let row = `<tr style="${rowStyle}">`;
            row += `<td>${idx + 1}</td>`;
            row += `<td style="text-align:left; font-weight:600;"><div style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;"><span>${escapeHtml(student.name)}</span>${wa}</div></td>`;
            row += `<td><span class="${badge.cls}">${badge.text}</span></td>`;

            appState.wsDates.forEach((date, dateIdx) => {
                const isPaid  = checkWsIsPaid(student.id, dateIdx);
                const payment = appState.wsPayments.find(
                    p => p.student_id === student.id && p.workshop_date_id === date.id
                );
                row += `<td class="${isPaid ? 'paid-period' : ''}"
                            data-student-id="${student.id}"
                            data-date-id="${date.id}">`;
                if (payment) row += `${Number(payment.amount).toLocaleString('tr-TR')}₺<br><small style="color:var(--text-dim)">${payment.weeks_covered || 0}h</small>`;
                else         row += `–`;
                row += `</td>`;
            });

            row += `</tr>`;
            tbody.insertAdjacentHTML('beforeend', row);
        });
    }

    // Hücre tıklama: ödeme ekle / sil
    document.querySelectorAll('#wsPayRows td[data-student-id]').forEach(cell => {
        const studentId = parseInt(cell.dataset.studentId);
        const dateId    = parseInt(cell.dataset.dateId);
        if (isNaN(studentId) || isNaN(dateId)) return;

        cell.style.cursor = 'pointer';
        cell.addEventListener('click', async (e) => {
            e.stopPropagation();
            const existing = appState.wsPayments.find(
                p => p.student_id === studentId && p.workshop_date_id === dateId
            );
            if (existing) {
                openConfirmModal('Bu ödemeyi silmek istediğinizden emin misiniz?', async () => {
                    const { error } = await supabase.from('workshop_payments').delete().eq('id', existing.id);
                    if (error) { showToast('Ödeme silinemedi.', 'error'); return; }
                    showToast('Ödeme silindi ✓', 'success');
                    await loadWorkshopPaymentsData();
                    renderWorkshopPaymentsView();
                });
            } else {
                const defPrice = weeklyPrice ? String(weeklyPrice) : '';
                openDoubleInputModal('Ödeme Ekle', 'Tutar (₺)', 'Hafta sayısı', async (amount, weeks) => {
                    const amountNum = parseFloat(amount);
                    const weeksNum  = parseInt(weeks);
                    if (isNaN(amountNum) || amountNum <= 0 || isNaN(weeksNum) || weeksNum <= 0) {
                        showToast('Lütfen geçerli pozitif değerler girin.', 'error');
                        return;
                    }
                    const { error } = await supabase.from('workshop_payments').insert({
                        workshop_id:      appState.currentWorkshopId,
                        student_id:       studentId,
                        workshop_date_id: dateId,
                        amount:           amountNum,
                        weeks_covered:    weeksNum
                    });
                    if (error) { showToast('Ödeme eklenemedi: ' + error.message, 'error'); return; }
                    showToast('Ödeme eklendi ✓', 'success');
                    await loadWorkshopPaymentsData();
                    renderWorkshopPaymentsView();
                }, defPrice, '1');
            }
        });
    });

    wireBackButton();
    refreshIcons();
}