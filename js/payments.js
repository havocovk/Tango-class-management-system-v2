import { supabase } from './supabaseClient.js';
import { formatDate, refreshIcons } from './utils.js';
import { showAttendanceView } from './attendance.js';

let currentClassId = null;
let currentClassName = null;
let students = [];
let courseDates = [];
let payments = [];

export async function showPaymentsView(classId, className) {
    currentClassId = classId;
    currentClassName = className;
    await loadPaymentsData();
    renderPaymentsView();
}

async function loadPaymentsData() {
    const { data: studentsData } = await supabase.from('students').select('*').eq('class_id', currentClassId).order('id');
    students = studentsData || [];
    const { data: datesData } = await supabase.from('course_dates').select('*').eq('class_id', currentClassId).order('date');
    courseDates = datesData || [];
    const { data: paymentsData } = await supabase.from('payments').select('*').in('student_id', students.map(s => s.id));
    payments = paymentsData || [];
}

function renderPaymentsView() {
    const container = document.getElementById('dynamicView');
    container.innerHTML = `
        <div class="view">
            <div class="back-link" id="backToAttendanceBtn">← Yoklama Sayfası</div>
            <div class="main-title">Ödeme Takibi - ${escapeHtml(currentClassName)}</div>
            <div class="table-wrapper">
                <table>
                    <thead><tr id="payHeader"><th>#</th><th>Student</th>${courseDates.map(d => `<th style="writing-mode:vertical-rl;transform:rotate(180deg);height:100px;">${formatDate(d.date)}</th>`).join('')}</tr></thead>
                    <tbody id="payRows"></tbody>
                </table>
            </div>
        </div>
    `;
    const tbody = document.getElementById('payRows');
    tbody.innerHTML = '';
    students.forEach((student, idx) => {
        let row = `<tr><td>${idx+1}</td><td>${escapeHtml(student.name)}</td>`;
        courseDates.forEach((date, dateIdx) => {
            const isPaid = checkIsPaid(student.id, dateIdx);
            row += `<td class="${isPaid ? 'paid-period' : ''}" data-student-id="${student.id}" data-date-id="${date.id}" data-date-index="${dateIdx}">`;
            const payment = payments.find(p => p.student_id === student.id && p.start_date_id === date.id);
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
                const existing = payments.find(p => p.student_id === studentId && p.start_date_id === dateId);
                if (existing) {
                    if (confirm('Bu ödemeyi silmek istediğinize emin misiniz?')) {
                        await supabase.from('payments').delete().eq('id', existing.id);
                        await loadPaymentsData();
                        renderPaymentsView();
                    }
                } else {
                    const amount = prompt('Ödeme miktarı (TL):', '');
                    if (!amount) return;
                    const weeks = prompt('Kaç hafta geçerli?', '4');
                    if (!weeks) return;
                    const { error } = await supabase.from('payments').insert({
                        student_id: studentId,
                        start_date_id: dateId,
                        amount: parseInt(amount),
                        weeks_covered: parseInt(weeks)
                    });
                    if (!error) {
                        await loadPaymentsData();
                        renderPaymentsView();
                    } else alert('Hata: ' + error.message);
                }
            });
        }
    });
    
    document.getElementById('backToAttendanceBtn').onclick = () => showAttendanceView(currentClassId, currentClassName);
    refreshIcons();
}

function checkIsPaid(studentId, dateIndex) {
    const dateObj = courseDates[dateIndex];
    if (!dateObj) return false;
    for (const p of payments) {
        if (p.student_id !== studentId) continue;
        const startIdx = courseDates.findIndex(d => d.id === p.start_date_id);
        if (startIdx === -1) continue;
        if (dateIndex >= startIdx && dateIndex < startIdx + p.weeks_covered) return true;
    }
    return false;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}