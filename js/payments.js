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
    const { data: studentsData } = await supabase.from('students').select('*').eq('class_id', appState.currentClassId).order('id');
    appState.students = studentsData || [];
    const { data: datesData } = await supabase.from('course_dates').select('*').eq('class_id', appState.currentClassId).order('date');
    appState.courseDates = datesData || [];
    const { data: paymentsData } = await supabase.from('payments').select('*').in('student_id', appState.students.map(s => s.id));
    appState.payments = paymentsData || [];
}

function renderPaymentsView() {
    const container = document.getElementById('dynamicView');
    container.innerHTML = `
        <div class="view">
            <div class="back-link" id="backToAttendanceBtn">← Yoklama Sayfası</div>
            <div class="main-title">Ödeme Takibi - ${escapeHtml(appState.currentClassName)}</div>
            <div class="table-wrapper">
                <table>
                    <thead><tr id="payHeader"><th>#</th><th>Student</th>${appState.courseDates.map(d => `<th style="writing-mode:vertical-rl;transform:rotate(180deg);height:100px;">${formatDate(d.date)}</th>`).join('')}</tr></thead>
                    <tbody id="payRows"></tbody>
                </table>
            </div>
        </div>
    `;
    const tbody = document.getElementById('payRows');
    tbody.innerHTML = '';
    appState.students.forEach((student, idx) => {
        let row = `<tr><td>${idx+1}</td><td>${escapeHtml(student.name)}</td>`;
        appState.courseDates.forEach((date, dateIdx) => {
            const isPaid = checkIsPaid(student.id, dateIdx);
            row += `<td class="${isPaid ? 'paid-period' : ''}" data-student-id="${student.id}" data-date-id="${date.id}" data-date-index="${dateIdx}">`;
            const payment = appState.payments.find(p => p.student_id === student.id && p.start_date_id === date.id);
            if (payment) row += `${payment.amount}₺ (${payment.weeks_covered} hafta)`;
            else row += `-`;
            row += `</td>`;
        });
        row += `</tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
    });
    document.querySelectorAll('#payRows td').forEach(cell => {
        const studentId = parseInt(cell.dataset.studentId);
        const dateId = parseInt(cell.dataset.dateId);
        if (!isNaN(studentId) && !isNaN(dateId)) {
            cell.style.cursor = 'pointer';
            cell.addEventListener('click', async (e) => {
                e.stopPropagation();
                const existing = appState.payments.find(p => p.student_id === studentId && p.start_date_id === dateId);
                if (existing) {
                    openConfirmModal('Bu ödemeyi silmek istediğinize emin misiniz?', async () => {
                        await supabase.from('payments').delete().eq('id', existing.id);
                        await loadPaymentsData();
                        renderPaymentsView();
                    });
                } else {
                    openDoubleInputModal('Ödeme Ekle', 'Miktar (₺)', 'Kaç hafta geçerli?', async (amount, weeks) => {
                        if (!amount || !weeks) return;
                        const { error } = await supabase.from('payments').insert({
                            student_id: studentId,
                            start_date_id: dateId,
                            amount: parseInt(amount),
                            weeks_covered: parseInt(weeks)
                        });
                        if (!error) {
                            showToast('Ödeme eklendi ✓', 'success');
                            await loadPaymentsData();
                            renderPaymentsView();
                        } else {
                            showToast('Ödeme eklenemedi. Bağlantıyı kontrol edin.', 'error');
                        }
                    });
                }
            });
        }
    });
    document.getElementById('backToAttendanceBtn').onclick = () => navigateTo('attendance', { classId: appState.currentClassId, className: appState.currentClassName });
    refreshIcons();
}

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