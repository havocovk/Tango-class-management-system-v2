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
import { t } from './i18n.js';
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
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <div class="back-link" id="wsBackToAttendanceBtn" style="margin-bottom:0;">${t('workshopPay.backToAttendance')}</div>
            <button id="wsPayCsvBtn" style="flex:none;min-width:auto;width:auto;display:inline-flex;align-items:center;gap:5px;padding:7px 10px;background:transparent;border:1.5px solid var(--primary);border-radius:10px;color:var(--primary);font-size:11px;font-weight:600;cursor:pointer;"><i data-lucide="download" size="13" style="width:13px;height:13px;display:block;flex-shrink:0;"></i>${t('workshopAtt.csvDownload')}</button>
        </div>
        <div class="main-title">${t('workshopPay.title')}</div>
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
    const csvBtn = document.getElementById('wsPayCsvBtn');
    if (csvBtn) csvBtn.onclick = () => downloadWorkshopPayCsv();
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
                <div class="summary-label">${t('workshopPay.summaryCollected')}</div>
            </div>
            <div class="summary-card summary-danger">
                <div class="summary-value">${pendingCount}</div>
                <div class="summary-label">${t('workshopPay.summaryPending')}</div>
            </div>
            <div class="summary-card summary-dates">
                <div class="summary-value">${visible.length}</div>
                <div class="summary-label">${t('workshopPay.summaryStudents')}</div>
            </div>
        </div>`;

    // Satırlar
    let rowsHtml = '';
    if (visible.length === 0) {
        rowsHtml = `<tr><td colspan="4" style="text-align:center; color:var(--text-dim); padding:20px;">${t('workshopPay.emptyStudents')}</td></tr>`;
    } else {
        visible.forEach((s, idx) => {
            const pay  = appState.wsPayments.find(p => p.student_id === s.id);
            const paid = !!pay;

            const badge = paid
                ? `<span class="debt-badge debt-ok">${t('workshopPay.badgePaid')}</span>`
                : `<span class="debt-badge debt-danger">${t('workshopPay.badgePending')}</span>`;

            const rowStyle = paid ? '' : 'background: rgba(239,68,68,0.07);';

            let wa = '';
            if (!paid && s.phone) {
                const msg = totalPrice
                    ? t('workshopPay.waDebtMsgAmount').replace('{name}', s.name).replace('{ws}', ws.name).replace('{amount}', totalPrice)
                    : t('workshopPay.waDebtMsg').replace('{name}', s.name).replace('{ws}', ws.name);
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
            ${headerHtml(t('workshopPay.modeUpfront'))}
            ${summaryHtml}
            <div class="table-wrapper" style="margin-top:8px;">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>${t('workshopPay.colStudent')}</th>
                            <th style="white-space:nowrap;">${t('workshopPay.colStatus')}</th>
                            <th style="white-space:nowrap;">${t('workshopPay.colAmount')}</th>
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
                openConfirmModal(t('workshopPay.paymentDeleteConfirm'), async () => {
                    const { error } = await supabase.from('workshop_payments').delete().eq('id', existing.id);
                    if (error) { showToast(t('workshopPay.paymentDeleteFail'), 'error'); return; }
                    showToast(t('workshopPay.paymentDeleted'), 'success');
                    await loadWorkshopPaymentsData();
                    renderWorkshopPaymentsView();
                });
            } else {
                const def = totalPrice ? String(totalPrice) : '';
                openPromptModalWithValue(t('workshopPay.addPaymentTitle'), def, t('workshopPay.amountPlaceholder'), async (val) => {
                    const amount = parseFloat(val);
                    if (isNaN(amount) || amount <= 0) { showToast(t('workshopPay.invalidAmount'), 'error'); return; }
                    const { error } = await supabase.from('workshop_payments').insert({
                        workshop_id:      appState.currentWorkshopId,
                        student_id:       sid,
                        workshop_date_id: null,
                        amount:           amount,
                        weeks_covered:    ws.total_weeks || null
                    });
                    if (error) { showToast(t('workshopPay.paymentAddFail').replace('{msg}', error.message), 'error'); return; }
                    showToast(t('workshopPay.paymentAdded'), 'success');
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
        return { cls: 'debt-badge debt-danger',  text: t('workshopPay.badgeDebt').replace('{n}', Math.abs(remaining)) };
    } else if (remaining === 0) {
        return { cls: 'debt-badge debt-ok',       text: t('workshopPay.badgeCurrent') };
    } else if (remaining <= 2) {
        return { cls: 'debt-badge debt-warning',  text: t('workshopPay.badgeWarning').replace('{n}', remaining) };
    } else {
        return { cls: 'debt-badge debt-info',     text: t('workshopPay.badgeAdvance').replace('{n}', remaining) };
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
                <div class="summary-label">${t('workshopPay.summaryCollected')}</div>
            </div>
            <div class="summary-card summary-danger">
                <div class="summary-value">${debtorCount}</div>
                <div class="summary-label">${t('workshopPay.summaryDebtors')}</div>
            </div>
            <div class="summary-card summary-warning">
                <div class="summary-value">${warningCount}</div>
                <div class="summary-label">${t('workshopPay.summaryWarning')}</div>
            </div>
            <div class="summary-card summary-dates">
                <div class="summary-value">${occurredWeeks}</div>
                <div class="summary-label">${t('workshopPay.summaryOccurred')}</div>
            </div>
        </div>`;

    // Tablo başlığı (hafta tarihleri)
    const headCells = appState.wsDates.map(d => {
        const cancelled = d.is_cancelled ? ' th-date-cancelled' : '';
        return `<th class="th-date${cancelled}">${formatDate(d.lesson_date)}</th>`;
    }).join('');

    container.innerHTML = `
        <div class="view">
            ${headerHtml(t('workshopPay.modeWeekly'))}
            ${summaryHtml}
            <div class="table-wrapper" style="margin-top:8px;">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>${t('workshopPay.colStudent')}</th>
                            <th style="white-space:nowrap; min-width:110px;">${t('workshopPay.colStatus')}</th>
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
        tbody.innerHTML = `<tr><td colspan="${3 + appState.wsDates.length}" style="text-align:center; color:var(--text-dim); padding:20px;">${t('workshopPay.emptyStudents')}</td></tr>`;
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
                    ? t('workshopPay.waWeeklyDebt').replace('{name}', student.name).replace('{ws}', ws.name).replace('{n}', Math.abs(remaining))
                    : t('workshopPay.waWeeklyWarn').replace('{name}', student.name).replace('{ws}', ws.name).replace('{n}', remaining);
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
                openConfirmModal(t('workshopPay.paymentDeleteConfirm'), async () => {
                    const { error } = await supabase.from('workshop_payments').delete().eq('id', existing.id);
                    if (error) { showToast(t('workshopPay.paymentDeleteFail'), 'error'); return; }
                    showToast(t('workshopPay.paymentDeleted'), 'success');
                    await loadWorkshopPaymentsData();
                    renderWorkshopPaymentsView();
                });
            } else {
                const defPrice = weeklyPrice ? String(weeklyPrice) : '';
                openDoubleInputModal(t('workshopPay.addPaymentDouble'), t('workshopPay.amountPlaceholder'), t('workshopPay.weeksPlaceholder'), async (amount, weeks) => {
                    const amountNum = parseFloat(amount);
                    const weeksNum  = parseInt(weeks);
                    if (isNaN(amountNum) || amountNum <= 0 || isNaN(weeksNum) || weeksNum <= 0) {
                        showToast(t('workshopPay.invalidAmount'), 'error');
                        return;
                    }
                    const { error } = await supabase.from('workshop_payments').insert({
                        workshop_id:      appState.currentWorkshopId,
                        student_id:       studentId,
                        workshop_date_id: dateId,
                        amount:           amountNum,
                        weeks_covered:    weeksNum
                    });
                    if (error) { showToast(t('workshopPay.paymentAddFail').replace('{msg}', error.message), 'error'); return; }
                    showToast(t('workshopPay.paymentAdded'), 'success');
                    await loadWorkshopPaymentsData();
                    renderWorkshopPaymentsView();
                }, defPrice, '1');
            }
        });
    });

    wireBackButton();
    refreshIcons();
}
// ---------------------------------------------------------------
// Çalıştay Ödemeleri CSV Dışa Aktar
// ---------------------------------------------------------------
function downloadWorkshopPayCsv() {
    const ws      = appState.currentWorkshop;
    const mode    = (ws && ws.payment_type) ? ws.payment_type : 'upfront';
    const visible = appState.wsStudents.filter(s => !s.is_archived);

    let headers, rows;

    if (mode === 'upfront') {
        headers = [t('payments.csvColStudent'), t('payments.csvColStatus'), t('payments.csvColAmount')];
        rows = visible.map(s => {
            const pay  = appState.wsPayments.find(p => p.student_id === s.id);
            const paid = !!pay;
            return [
                s.name,
                paid ? t('payments.csvStatusPaid') : t('payments.csvStatusPending'),
                paid ? (Number(pay.amount).toLocaleString('tr-TR') + '₺') : ''
            ];
        });
    } else {
        headers = [t('payments.csvColStudent'), t('payments.csvColStatus'), ...appState.wsDates.map(d => d.lesson_date)];
        rows = visible.map(s => {
            const d = calcWsStudentDebt(s);
            const status = d.remaining < 0
                ? t('payments.csvStatusDebt', { n: Math.abs(d.remaining) })
                : d.remaining === 0
                    ? t('payments.csvStatusCurrent')
                    : t('payments.csvStatusAdvance', { n: d.remaining });
            const cells = appState.wsDates.map((date, dateIdx) => {
                return checkWsIsPaid(s.id, dateIdx) ? '✓' : '';
            });
            return [s.name, status, ...cells];
        });
    }

    const csv = [headers, ...rows]
        .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    const today4   = new Date().toISOString().split('T')[0];
    const slug4 = str => str.replace(/ç/g,'c').replace(/Ç/g,'C').replace(/ğ/g,'g').replace(/Ğ/g,'G').replace(/ı/g,'i').replace(/İ/g,'I').replace(/ö/g,'o').replace(/Ö/g,'O').replace(/ş/g,'s').replace(/Ş/g,'S').replace(/ü/g,'u').replace(/Ü/g,'U').replace(/[^a-zA-Z0-9 ]/g,'').trim().replace(/ +/g,'_');
    const studio4  = slug4(appState.currentWorkshop && appState.currentWorkshop.studio_name || '');
    const wsName4  = slug4(appState.currentWorkshopName || 'calistay');
    a.download = `${today4}_${studio4}_${wsName4}_${t('workshopAtt.csvSuffixPay')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}