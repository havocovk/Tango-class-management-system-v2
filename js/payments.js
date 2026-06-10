import { supabase } from './supabaseClient.js';
import { formatDate, refreshIcons, openPromptModal, openDoubleInputModal, openConfirmModal, showToast, escapeHtml } from './utils.js';
import { navigateTo } from './router.js';
import { appState } from './state.js';

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

    const { data: paymentsData } = await supabase
        .from('payments').select('*')
        .in('student_id', appState.students.map(s => s.id));
    appState.payments = paymentsData || [];
}

// ---------------------------------------------------------------
// Bir öğrencinin belirli bir hafta indeksinde ödeme kapsamında
// olup olmadığını kontrol eder.
// ---------------------------------------------------------------
function checkIsPaid(studentId, dateIndex) {
    const dateObj = appState.courseDates[dateIndex];
    if (!dateObj) return false;
    for (const p of appState.payments) {
        if (p.student_id !== studentId) continue;
        const startIdx = appState.courseDates.findIndex(d => d.id === p.start_date_id);
        if (startIdx === -1) continue;
        if (dateIndex >= startIdx && dateIndex < startIdx + p.weeks_covered) return true;
    }
    return false;
}

// ---------------------------------------------------------------
// ADIM 6.1 — BORÇ TAKİBİ
// Her öğrenci için:
//   - Toplam ödenen hafta sayısı hesaplanır
//   - Toplam ders sayısıyla kıyaslanır
//   - Kalan ders sayısı (artı = avans, eksi = borç) bulunur
// ---------------------------------------------------------------
function calcStudentDebt(student) {
    const totalDates = appState.courseDates.length;

    // Bu öğrenciye ait tüm ödemelerin toplam hafta kapsamını topla
    const studentPayments = appState.payments.filter(p => p.student_id === student.id);
    const totalPaidWeeks = studentPayments.reduce((sum, p) => sum + p.weeks_covered, 0);

    // Kaç ders ödendi, kaç ders gerçekleşti?
    const remaining = totalPaidWeeks - totalDates;
    // remaining > 0  → avans (fazla ödedi)
    // remaining === 0 → tam ödedi
    // remaining < 0  → borçlu (eksik ödedi)

    const totalAmount = studentPayments.reduce((sum, p) => sum + p.amount, 0);

    return { remaining, totalPaidWeeks, totalDates, totalAmount };
}

// ---------------------------------------------------------------
// Kalan ders durumuna göre CSS sınıfı ve rozet metni döndürür
// ---------------------------------------------------------------
function getDebtBadge(remaining) {
    if (remaining < 0) {
        // Borçlu: kırmızı
        return {
            cls: 'debt-badge debt-danger',
            text: `${Math.abs(remaining)} ders borçlu`
        };
    } else if (remaining === 0) {
        // Tam ödedi: yeşil
        return {
            cls: 'debt-badge debt-ok',
            text: 'Güncel ✓'
        };
    } else if (remaining <= 2) {
        // 1-2 ders kaldı: turuncu uyarı
        return {
            cls: 'debt-badge debt-warning',
            text: `${remaining} ders kaldı`
        };
    } else {
        // Avans: mavi/gri bilgi
        return {
            cls: 'debt-badge debt-info',
            text: `${remaining} ders avans`
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
    const MONTHS_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

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
            <div style="font-size:13px; font-weight:700; color:var(--accent); margin-bottom:8px; padding-left:4px;">📊 Aylık Gelir</div>
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
    const totalDates = appState.courseDates.length;

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
                <div class="summary-label">Toplam Tahsilat</div>
            </div>
            <div class="summary-card summary-danger">
                <div class="summary-value">${debtorCount}</div>
                <div class="summary-label">Borçlu Öğrenci</div>
            </div>
            <div class="summary-card summary-warning">
                <div class="summary-value">${warningCount}</div>
                <div class="summary-label">Paketi Bitiyor</div>
            </div>
            <div class="summary-card summary-dates">
                <div class="summary-value">${totalDates}</div>
                <div class="summary-label">Toplam Ders</div>
            </div>
        </div>
    `;

    // ADIM 8.4 — Aylık gelir grafiği
    const monthlyChartHtml = buildMonthlyChart();

    // ---- Tablo HTML ----
    container.innerHTML = `
        <div class="view">
            <div class="back-link" id="backToAttendanceBtn">← Yoklama Sayfası</div>
            <div class="main-title">Ödeme Takibi</div>
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
                            <th>Öğrenci</th>
                            <th style="white-space:nowrap; min-width:110px;">Durum</th>
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
                ? `Merhaba ${student.name}! ${appState.currentClassName} derslerindeki ders paketiniz doldu 🙏 Yeni paket için bizi arayabilirsiniz.`
                : `Merhaba ${student.name}! ${appState.currentClassName} derslerindeki ders paketinizden ${remaining} ders hakkınız kaldı 🙏 Paketi yenilemek için bizi arayabilirsiniz.`;
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
                openConfirmModal('Bu ödemeyi silmek istediğinize emin misiniz?', async () => {
                    const { error } = await supabase.from('payments').delete().eq('id', existing.id);
                    if (error) {
                        showToast('Ödeme silinemedi. Bağlantıyı kontrol edin.', 'error');
                    } else {
                        showToast('Ödeme silindi ✓', 'success');
                        await loadPaymentsData();
                        renderPaymentsView();
                    }
                });
            } else {
                openDoubleInputModal('Ödeme Ekle', 'Miktar (₺)', 'Kaç hafta geçerli?', async (amount, weeks) => {
                    if (!amount || !weeks) return;
                    const { error } = await supabase.from('payments').insert({
                        student_id:    studentId,
                        start_date_id: dateId,
                        amount:        parseInt(amount),
                        weeks_covered: parseInt(weeks)
                    });
                    if (error) {
                        showToast('Ödeme eklenemedi. Bağlantıyı kontrol edin.', 'error');
                    } else {
                        showToast('Ödeme eklendi ✓', 'success');
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