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
        if (status === 'S') return; // bu öğrenci o hafta henüz kayıtlı değildi
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

// ---------------------------------------------------------------
// ADIM 8.4 — AYLIK GELİR GRAFİĞİ
// Her ödemenin başlangıç tarihini ay olarak gruplar ve toplam
// tutarı bar grafik olarak çizer. Grafik CSS sınıfları chart.css'ten
// gelir (classStats.js'teki katılım grafiğiyle aynı altyapı).
// ---------------------------------------------------------------
function buildMonthlyChart() {
    const MONTHS_TR = tList('payments.months');

    // start_date_id → course_dates.date üzerinden ay-yıl grupla
    const monthlyMap = {};
    appState.payments.forEach(p => {
        const dateObj = appState.courseDates.find(d => d.id === p.start_date_id);
        if (!dateObj) return;
        const [year, month] = dateObj.date.split('-').map(Number);
        const key = `${year}-${String(month).padStart(2, '0')}`;
        monthlyMap[key] = (monthlyMap[key] || 0) + p.amount;
    });

    const sorted = Object.entries(monthlyMap).sort((a, b) => a[0].localeCompare(b[0]));
    if (sorted.length === 0) return '';

    const maxAmount = Math.max(...sorted.map(([, v]) => v));

    let barsHtml  = '';
    let datesHtml = '';

    sorted.forEach(([key, amount]) => {
        const [year, month] = key.split('-').map(Number);
        const label      = `${MONTHS_TR[month - 1]} ${String(year).slice(2)}`;
        const barHeight  = Math.min(200, Math.max(4, Math.round((amount / maxAmount) * 200)));
        barsHtml += `
            <div class="bar-col">
                <div class="bar-count" style="font-size:10px;">${amount.toLocaleString('tr-TR')}₺</div>
                <div class="bar" style="height:${barHeight}px;"></div>
            </div>`;
        datesHtml += `<div class="bar-date">${label}</div>`;
    });

    return `
        <div style="margin-top:16px;">
            <div style="font-size:13px; font-weight:700; color:var(--accent); margin-bottom:8px; padding-left:4px;"><i data-lucide="bar-chart-2" size="14" style="display:inline-block;vertical-align:middle;margin-right:6px;"></i>${escapeHtml(t('payments.monthlyIncome'))}</div>
            <div style="border:1px solid var(--border); border-radius:14px; background:var(--card-bg); overflow-x:auto; overflow-y:hidden; padding:10px 0;">
                <div class="chart-container">
                    <div class="chart-bars-zone" style="height:220px;">${barsHtml}</div>
                    <div class="chart-xaxis"></div>
                    <div class="chart-dates-zone">${datesHtml}</div>
                </div>
            </div>
        </div>`;
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

    // ADIM 8.4 — Aylık gelir grafiği
    const monthlyChartHtml = buildMonthlyChart();

    // ---- Tablo HTML ----
    container.innerHTML = `
        <div class="view">
            <div class="back-link" id="backToAttendanceBtn">${escapeHtml(t('nav.backToAttendance'))}</div>
            <div class="main-title">${escapeHtml(t('payments.title'))}</div>
            <div style="text-align:center; color:var(--primary); font-size:14px; margin-bottom:16px; font-weight:600;">
                ${escapeHtml(appState.currentClassName)}
            </div>

            ${summaryHtml}
            ${monthlyChartHtml}

            <div class="table-wrapper" style="margin-top:20px;">
                <table>
                    <thead>
                        <tr id="payHeader">
                            <th>#</th>
                            <th>${escapeHtml(t('payments.colStudent'))}</th>
                            <th style="white-space:nowrap; min-width:110px;">${escapeHtml(t('payments.colStatus'))}</th>
                            ${appState.courseDates.map(d =>
                                `<th style="writing-mode:vertical-rl;transform:rotate(180deg);height:100px;">${formatDate(d.date)}</th>`
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
                openDoubleInputModal(t('payments.addPaymentTitle'), t('payments.amountPlaceholder'), t('payments.weeksPlaceholder'), async (amount, weeks) => {
                    if (!amount || !weeks) return;
                    const { error } = await supabase.from('payments').insert({
                        student_id:    studentId,
                        start_date_id: dateId,
                        amount:        parseInt(amount),
                        weeks_covered: parseInt(weeks)
                    });
                    if (error) {
                        showToast(t('payments.paymentAddFail'), 'error');
                    } else {
                        showToast(t('payments.paymentAdded'), 'success');
                        await loadPaymentsData();
                        renderPaymentsView();
                    }
                });
            }
        });
    });

    document.getElementById('backToAttendanceBtn').onclick = () =>
        navigateTo('attendance', {
            classId:   appState.currentClassId,
            className: appState.currentClassName
        });

    refreshIcons();
}