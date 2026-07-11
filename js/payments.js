import { supabase } from './supabaseClient.js';
import { formatDate, refreshIcons, openPromptModal, openDoubleInputModal, openConfirmModal, showToast, escapeHtml } from './utils.js';
import { navigateTo } from './router.js';
import { appState } from './state.js';
import { t, tList } from './i18n.js';

export async function showPaymentsView(classId, className) {
    appState.currentClassId = classId;
    appState.currentClassName = className;
    await loadPaymentsData();
    renderPaymentsView();
}

async function loadPaymentsData() {
    // ADIM 5.2 — Sınıfın paket fiyatı ve hafta sayısını da çek
    const { data: classData } = await supabase
        .from('classes').select('id, name, package_price, package_weeks')
        .eq('id', appState.currentClassId).single();
    appState.currentClass = classData || null;

    const { data: studentsData } = await supabase
        .from('students').select('*')
        .eq('class_id', appState.currentClassId).order('id');
    appState.students = studentsData || [];

    const { data: datesData } = await supabase
        .from('course_dates').select('*')
        .eq('class_id', appState.currentClassId).order('date');
    appState.courseDates = datesData || [];

    // ADIM: Borç hesabı "S" (user-x, henüz kayıtlı değil) haftalarını
    // ayırt edebilmek için yoklama verisine ihtiyaç duyar.
    const { data: attData } = await supabase
        .from('attendance').select('*')
        .in('course_date_id', appState.courseDates.map(d => d.id));
    appState.attendanceMap = {};
    if (attData) attData.forEach(a => { appState.attendanceMap[`${a.student_id}_${a.course_date_id}`] = a.status; });

    const { data: paymentsData } = await supabase
        .from('payments').select('*')
        .in('student_id', appState.students.map(s => s.id));
    appState.payments = paymentsData || [];
}

// ---------------------------------------------------------------
// Bir öğrencinin belirli bir hafta indeksinde ödeme kapsamında
// olup olmadığını kontrol eder.
// ADIM: İptal edilen haftalar bir ders hakkı TÜKETMEZ. Yani ödeme
// kapsamı (weeks_covered) yalnızca iptal OLMAYAN haftalar üzerinden
// sayılır; iptal haftaları atlanır ve kapsam bir sonraki gerçek
// derse kayar.
// ---------------------------------------------------------------
function checkIsPaid(studentId, dateIndex) {
    const dateObj = appState.courseDates[dateIndex];
    if (!dateObj) return false;
    if (dateObj.is_cancelled) return false; // İptal haftası asla "ödenmiş" sayılmaz

    for (const p of appState.payments) {
        if (p.student_id !== studentId) continue;
        const startIdx = appState.courseDates.findIndex(d => d.id === p.start_date_id);
        if (startIdx === -1 || dateIndex < startIdx) continue;

        // startIdx'ten dateIndex'e kadar (dahil) iptal OLMAYAN hafta sayısı.
        // Bu sayı, dateIndex'in kaçıncı gerçek ders olduğunu verir (1-tabanlı).
        let validOrdinal = 0;
        for (let i = startIdx; i <= dateIndex; i++) {
            if (!appState.courseDates[i].is_cancelled) validOrdinal++;
        }
        if (validOrdinal >= 1 && validOrdinal <= p.weeks_covered) return true;
    }
    return false;
}

// ---------------------------------------------------------------
// ADIM 6.1 — BORÇ TAKİBİ (güncellendi)
// Her öğrenci için "geçerli ders sayısı" şu kurallarla hesaplanır:
//   - İptal edilen haftalar (is_cancelled) HİÇ KİMSE için sayılmaz.
//   - Öğrencinin "S" (user-x, henüz kayıtlı değil) işaretli olduğu
//     haftalar O ÖĞRENCİ için sayılmaz.
// Böylece derse sonradan başlayan veya iptal olan haftalar borç
// olarak yansımaz.
// ---------------------------------------------------------------
function calcStudentDebt(student) {
    // Bu öğrenci için geçerli (borç doğuran) ders sayısını say
    let studentValidDates = 0;
    appState.courseDates.forEach(d => {
        if (d.is_cancelled) return; // iptal → kimseye sayılmaz
        const status = appState.attendanceMap[`${student.id}_${d.id}`] || '';
        if (status !== '+' && status !== '-') return; // sadece + ve - say
        studentValidDates++;
    });

    // Bu öğrenciye ait tüm ödemelerin toplam hafta kapsamını topla
    const studentPayments = appState.payments.filter(p => p.student_id === student.id);
    const totalPaidWeeks = studentPayments.reduce((sum, p) => sum + p.weeks_covered, 0);

    // Kaç ders ödendi, kaç geçerli ders gerçekleşti?
    const remaining = totalPaidWeeks - studentValidDates;
    // remaining > 0  → avans (fazla ödedi)
    // remaining === 0 → tam ödedi
    // remaining < 0  → borçlu (eksik ödedi)

    const totalAmount = studentPayments.reduce((sum, p) => sum + p.amount, 0);

    return { remaining, totalPaidWeeks, totalDates: studentValidDates, totalAmount };
}

// ---------------------------------------------------------------
// Kalan ders durumuna göre CSS sınıfı ve rozet metni döndürür
// ---------------------------------------------------------------
function getDebtBadge(remaining) {
    if (remaining < 0) {
        // Borçlu: kırmızı
        return {
            cls: 'debt-badge debt-danger',
            text: t('payments.badgeDebt', { n: Math.abs(remaining) })
        };
    } else if (remaining === 0) {
        // Tam ödedi: yeşil
        return {
            cls: 'debt-badge debt-ok',
            text: t('payments.badgeCurrent')
        };
    } else if (remaining <= 2) {
        // 1-2 ders kaldı: turuncu uyarı
        return {
            cls: 'debt-badge debt-warning',
            text: t('payments.badgeRemaining', { n: remaining })
        };
    } else {
        // Avans: mavi/gri bilgi
        return {
            cls: 'debt-badge debt-info',
            text: t('payments.badgeAdvance', { n: remaining })
        };
    }
}

function renderPaymentsView() {
    const container = document.getElementById('dynamicView');
    // "Toplam Ders" kartı: iptal edilen haftalar hariç gerçekleşen ders sayısı
    const totalDates = appState.courseDates.filter(d => !d.is_cancelled).length;

    // ---- Özet hesaplamaları ----
    let totalCollected = 0;
    let debtorCount    = 0;
    let warningCount   = 0;

    const debtMap = {}; // student.id → { remaining, totalAmount }
    appState.students.forEach(s => {
        const d = calcStudentDebt(s);
        debtMap[s.id] = d;
        totalCollected += d.totalAmount;
        if (d.remaining < 0)         debtorCount++;
        else if (d.remaining <= 2)   warningCount++;
    });

    // ---- Özet kartları HTML ----
    const summaryHtml = `
        <div class="payment-summary">
            <div class="summary-card summary-total">
                <div class="summary-value">${totalCollected.toLocaleString('tr-TR')} ₺</div>
                <div class="summary-label">${escapeHtml(t('payments.summaryTotal'))}</div>
            </div>
            <div class="summary-card summary-danger">
                <div class="summary-value">${debtorCount}</div>
                <div class="summary-label">${escapeHtml(t('payments.summaryDebtor'))}</div>
            </div>
            <div class="summary-card summary-warning">
                <div class="summary-value">${warningCount}</div>
                <div class="summary-label">${escapeHtml(t('payments.summaryWarning'))}</div>
            </div>
            <div class="summary-card summary-dates">
                <div class="summary-value">${totalDates}</div>
                <div class="summary-label">${escapeHtml(t('payments.summaryDates'))}</div>
            </div>
        </div>
    `;
    // ---- Tablo HTML ----
    container.innerHTML = `
        <div class="view">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                <div class="back-link" id="backToAttendanceBtn" style="margin-bottom:0;">${escapeHtml(t('nav.backToAttendance'))}</div>
                <button id="paymentCsvBtn" style="flex:none;min-width:auto;width:auto;display:inline-flex;align-items:center;gap:5px;padding:7px 10px;background:transparent;border:1.5px solid var(--primary);border-radius:10px;color:var(--primary);font-size:11px;font-weight:600;cursor:pointer;"><i data-lucide="download" size="13" style="width:13px;height:13px;display:block;flex-shrink:0;"></i>${t('attendance.csvDownload')}</button>
            </div>
            <div class="main-title">${escapeHtml(t('payments.title'))}</div>
            <div style="text-align:center; color:var(--primary); font-size:14px; margin-bottom:16px; font-weight:600;">
                ${escapeHtml(appState.currentClassName)}
            </div>

            ${summaryHtml}

            <div style="margin:8px 0 6px;">
                <input id="paySearchInput" type="text" placeholder="${t('attendance.searchPlaceholder')}" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:#1e293b;color:white;font-size:13px;box-sizing:border-box;">
            </div>
            <div class="table-wrapper" style="margin-top:8px;">
                <table>
                    <thead>
                        <tr id="payHeader">
                            <th>#</th>
                            <th>${escapeHtml(t('payments.colStudent'))}</th>
                            <th style="white-space:nowrap; min-width:110px;">${escapeHtml(t('payments.colStatus'))}</th>
                            ${appState.courseDates.map(d =>
                                `<th class="th-date">${formatDate(d.date)}</th>`
                            ).join('')}
                        </tr>
                    </thead>
                    <tbody id="payRows"></tbody>
                </table>
            </div>
        </div>
    `;

    const tbody = document.getElementById('payRows');
    tbody.innerHTML = '';

    appState.students.forEach((student, idx) => {
        const { remaining } = debtMap[student.id];
        const badge = getDebtBadge(remaining);

        // Satır arka plan rengi: borçluysa hafif kırmızı, uyarıysa hafif turuncu
        let rowStyle = '';
        if (remaining < 0)        rowStyle = 'background: rgba(239,68,68,0.07);';
        else if (remaining <= 2)   rowStyle = 'background: rgba(251,191,36,0.07);';

        // ADIM 8.1 — Telefon varsa ve borçlu/paketi yakınsa WhatsApp hatırlatma butonu
        let waButton = '';
        if (student.phone && (remaining < 0 || remaining <= 2)) {
            const digits  = student.phone.replace(/\D/g, '');
            const waPhone = digits.startsWith('90') ? digits
                          : digits.startsWith('0')  ? '90' + digits.slice(1)
                          : digits.startsWith('5')  ? '90' + digits
                          : digits;
            const waMsg   = remaining < 0
                ? t('payments.waDebtMsg', { name: student.name, class: appState.currentClassName })
                : t('payments.waRemainMsg', { name: student.name, class: appState.currentClassName, n: remaining });
            waButton = `<a href="https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;background:#128C7E;color:white;text-decoration:none;padding:4px 8px;border-radius:8px;font-size:10px;font-weight:700;margin-top:4px;">💬 WA</a>`;
        }

        let row = `<tr style="${rowStyle}">`;
        row += `<td>${idx + 1}</td>`;
        row += `<td style="text-align:left; font-weight:600;"><div style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;"><span>${escapeHtml(student.name)}</span>${waButton}</div></td>`;
        row += `<td><span class="${badge.cls}">${badge.text}</span></td>`;

        appState.courseDates.forEach((date, dateIdx) => {
            const isPaid = checkIsPaid(student.id, dateIdx);
            const payment = appState.payments.find(
                p => p.student_id === student.id && p.start_date_id === date.id
            );
            row += `<td class="${isPaid ? 'paid-period' : ''}"
                        data-student-id="${student.id}"
                        data-date-id="${date.id}"
                        data-date-index="${dateIdx}">`;
            if (payment) row += `${payment.amount}₺<br><small style="color:var(--text-dim)">${payment.weeks_covered}h</small>`;
            else         row += `–`;
            row += `</td>`;
        });

        row += `</tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });

    // ---- Hücre tıklama: ödeme ekle / sil ----
    document.querySelectorAll('#payRows td[data-student-id]').forEach(cell => {
        const studentId = parseInt(cell.dataset.studentId);
        const dateId    = parseInt(cell.dataset.dateId);
        if (isNaN(studentId) || isNaN(dateId)) return;

        cell.style.cursor = 'pointer';
        cell.addEventListener('click', async (e) => {
            e.stopPropagation();
            const existing = appState.payments.find(
                p => p.student_id === studentId && p.start_date_id === dateId
            );
            if (existing) {
                openConfirmModal(t('payments.deletePaymentConfirm'), async () => {
                    const { error } = await supabase.from('payments').delete().eq('id', existing.id);
                    if (error) {
                        showToast(t('payments.paymentDeleteFail'), 'error');
                    } else {
                        showToast(t('payments.paymentDeleted'), 'success');
                        await loadPaymentsData();
                        renderPaymentsView();
                    }
                });
            } else {
                const defPrice = (appState.currentClass && appState.currentClass.package_price) ? String(appState.currentClass.package_price) : '';
                const defWeeks = (appState.currentClass && appState.currentClass.package_weeks) ? String(appState.currentClass.package_weeks) : '';
                openDoubleInputModal(t('payments.addPaymentTitle'), t('payments.amountPlaceholder'), t('payments.weeksPlaceholder'), async (amount, weeks) => {
                    if (!amount || !weeks) return;
                    const amountNum = parseInt(amount);
                    const weeksNum  = parseInt(weeks);
                    if (isNaN(amountNum) || amountNum <= 0 || isNaN(weeksNum) || weeksNum <= 0) {
                        showToast('Lütfen geçerli pozitif değerler girin.', 'error');
                        return;
                    }
                    const { error } = await supabase.from('payments').insert({
                        student_id:    studentId,
                        start_date_id: dateId,
                        amount:        amountNum,
                        weeks_covered: weeksNum
                    });
                    if (error) {
                        showToast(t('payments.paymentAddFail'), 'error');
                    } else {
                        showToast(t('payments.paymentAdded'), 'success');
                        await loadPaymentsData();
                        renderPaymentsView();
                    }
                }, defPrice, defWeeks);
            }
        });
    });

    document.getElementById('backToAttendanceBtn').onclick = () =>
        navigateTo('attendance', {
            classId:   appState.currentClassId,
            className: appState.currentClassName
        });

    document.getElementById('paymentCsvBtn').onclick = () => downloadPaymentsCsv();

    // ADIM 4.3 — Ödeme tablosu öğrenci arama / filtreleme
    const paySearch = document.getElementById('paySearchInput');
    if (paySearch) {
        paySearch.addEventListener('keyup', () => {
            const query = paySearch.value.trim().toLowerCase();
            document.querySelectorAll('#payRows tr').forEach(row => {
                const nameCell = row.querySelector('td:nth-child(2)');
                if (!nameCell) return;
                const name = nameCell.textContent.trim().toLowerCase();
                row.style.display = name.includes(query) ? '' : 'none';
            });
        });
    }

    refreshIcons();
}

// ---------------------------------------------------------------
// ADIM 3.1 — ÖDEME CSV DIŞA AKTARMA
// ---------------------------------------------------------------
function downloadPaymentsCsv() {
    const headers = ['Öğrenci', 'Durum', ...appState.courseDates.map(d => d.date)];
    const rows = appState.students.map(s => {
        const studentPayments = appState.payments.filter(p => p.student_id === s.id);
        const totalWeeks = studentPayments.reduce((sum, p) => sum + (p.weeks_covered || 0), 0);
        const usedDates  = appState.courseDates.filter(d => !d.is_cancelled).length;
        const diff = totalWeeks - usedDates;
        const status = diff < 0 ? `${Math.abs(diff)} ders borçlu` : diff === 0 ? 'Güncel' : `${diff} ders avans`;
        const cells = appState.courseDates.map(d => {
            const paid = studentPayments.some(p => {
                const startIdx = appState.courseDates.findIndex(cd => cd.id === p.start_date_id);
                const endIdx   = startIdx + (p.weeks_covered || 0) - 1;
                const thisIdx  = appState.courseDates.findIndex(cd => cd.id === d.id);
                return thisIdx >= startIdx && thisIdx <= endIdx;
            });
            return paid ? '✓' : '';
        });
        return [s.name, status, ...cells];
    });
    const csv = [headers, ...rows]
        .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${appState.currentClassName}_odemeler.csv`;
    a.click();
    URL.revokeObjectURL(url);
}