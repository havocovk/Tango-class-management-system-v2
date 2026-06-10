// ---------------------------------------------------------------
// attendanceModals.js — Yoklama Ekranı Modal Yöneticisi
// ---------------------------------------------------------------
// Sorumlulukları:
//   - openStudentActionModal()  → öğrenci düzenle/sil modalı
//   - openStudentProfileModal() → öğrenci istatistik kartı
//   - handleVideo()             → video ekleme/görüntüleme/silme
//   - detectVideoPlatform()     → URL'den platform tespiti (yardımcı)
//   - updateTeacherPartner()    → partner/teacher adı güncelle
//
// BAĞIMLILIK:
//   attendanceModals.js → attendance.js (loadAttendanceData + renderAttendanceView)
//   attendanceModals.js → attendanceActions.js (updateStudentName + deleteStudent)
//   attendance.js       → attendanceModals.js : HAYIR (döngü yok ✓)
// ---------------------------------------------------------------

import { supabase } from './supabaseClient.js';
import { formatDate, refreshIcons, openPromptModal, openConfirmModal, showToast, escapeHtml } from './utils.js';
import { appState } from './state.js';
import { loadAttendanceData, renderAttendanceView } from './attendance.js';
import { updateStudentName, deleteStudent, deleteWeek, toggleWeekCancel } from './attendanceActions.js';

// ---------------------------------------------------------------
// Öğrenci adına tıklanınca açılan aksiyom modalı
// Görünüm modu: isim + kalem + çöp ikonları
// Düzenleme modu: text input + kaydet/iptal
// ---------------------------------------------------------------
export function openStudentActionModal(studentId, currentName) {
    const modal        = document.getElementById('studentActionModal');
    const viewMode     = document.getElementById('studentViewMode');
    const editMode     = document.getElementById('studentEditMode');
    const nameDisplay  = document.getElementById('studentNameDisplay');
    const editInput    = document.getElementById('studentEditInput');
    const phoneInput   = document.getElementById('studentPhoneInput');
    const editBtn      = document.getElementById('studentEditBtn');
    const phoneBtn     = document.getElementById('studentPhoneBtn');
    const deleteBtn    = document.getElementById('studentDeleteBtn');
    const closeBtn     = document.getElementById('studentModalCloseView');
    const saveBtn      = document.getElementById('studentSaveBtn');
    const cancelEditBtn = document.getElementById('studentCancelEditBtn');
    const editTitle    = document.getElementById('studentEditModeTitle');

    editBtn.onclick       = null;
    if (phoneBtn) phoneBtn.onclick = null;
    deleteBtn.onclick     = null;
    closeBtn.onclick      = null;
    saveBtn.onclick       = null;
    cancelEditBtn.onclick = null;

    nameDisplay.innerText      = currentName;
    viewMode.style.display     = 'block';
    editMode.style.display     = 'none';
    modal.style.display        = 'flex';

    // Kalem ikonu → sadece ad düzenleme alanı açılır
    editBtn.onclick = () => {
        viewMode.style.display  = 'none';
        editMode.style.display  = 'block';
        if (editTitle) editTitle.textContent = 'Ad Düzenle';
        editInput.style.display = 'block';
        if (phoneInput) phoneInput.style.display = 'none';
        editInput.value = currentName;
        editInput.focus();
    };

    // Telefon ikonu → sadece telefon düzenleme alanı açılır (element varsa)
    if (phoneBtn) {
        phoneBtn.onclick = () => {
            viewMode.style.display  = 'none';
            editMode.style.display  = 'block';
            if (editTitle) editTitle.textContent = 'Telefon Düzenle';
            editInput.style.display = 'none';
            if (phoneInput) {
                phoneInput.style.display = 'block';
                const studentObj = appState.students.find(s => s.id === studentId);
                phoneInput.value = (studentObj && studentObj.phone) || '';
                phoneInput.focus();
            }
        };
    }

    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        modal.style.display = 'none';
        openConfirmModal(
            'Öğrenciyi silmek istediğinize emin misiniz? Tüm yoklamaları ve ödemeleri de silinecek.',
            async () => {
                await deleteStudent(studentId);
            },
            () => {
                modal.style.display = 'flex';
            }
        );
    };

    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    saveBtn.onclick = async () => {
        const isNameMode = !phoneInput || editInput.style.display !== 'none';
        if (isNameMode) {
            const newName = editInput.value.trim();
            if (!newName) return;
            await updateStudentName(studentId, newName, undefined);
            nameDisplay.innerText = newName;
            currentName = newName;
        } else {
            // Telefon modu — adı değiştirme, sadece telefonu kaydet
            await updateStudentName(studentId, currentName, phoneInput.value.trim());
        }
        editInput.style.display = 'block';
        if (phoneInput) phoneInput.style.display = 'block';
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
    };

    cancelEditBtn.onclick = () => {
        editInput.style.display = 'block';
        if (phoneInput) phoneInput.style.display = 'block';
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
    };
}

// ---------------------------------------------------------------
// ADIM 6.4 — ÖĞRENCİ PROFİL MODALI
// Öğrenci adına tıklanınca şunları hesaplayıp gösterir:
//   - Toplam ders sayısı (sınıftaki tüm haftalar)
//   - Katılım oranı (gelen / (gelen + gitmeyen) × 100)
//   - Devamsızlık sayısı ('-' statüsündeki kayıtlar)
//   - Toplam ödenen tutar (tüm payments.amount toplamı)
//   - Son ödeme tarihi (ödemelerin başlangıç tarihine göre en son)
// appState içindeki mevcut veriyi kullanır — ekstra DB sorgusu yok.
// ---------------------------------------------------------------
export async function openStudentProfileModal(student) {
    const modal   = document.getElementById('studentProfileModal');
    const loading = document.getElementById('profileLoadingMsg');
    const content = document.getElementById('profileContent');

    // İsmi yaz, içeriği gizle, modalı aç
    document.getElementById('profileStudentName').textContent = student.name;
    loading.style.display = 'block';
    content.style.display = 'none';
    modal.style.display   = 'flex';
    refreshIcons();

    // ---- Hesaplamalar (appState verisinden, DB'ye gitmeden) ----
    const totalDates = appState.courseDates.length;

    let presentCount = 0; // '+' statüsü
    let absentCount  = 0; // '-' statüsü

    appState.courseDates.forEach(d => {
        const status = appState.attendanceMap[`${student.id}_${d.id}`] || '';
        if (status === '+') presentCount++;
        else if (status === '-') absentCount++;
    });

    // Katılım oranı: sadece işaretlenmiş hücreler üzerinden hesapla
    const markedCount    = presentCount + absentCount;
    const attendanceRate = markedCount > 0
        ? Math.round((presentCount / markedCount) * 100)
        : 0;

    // Ödeme bilgileri
    const studentPayments = appState.payments.filter(p => p.student_id === student.id);
    const totalPaid       = studentPayments.reduce((sum, p) => sum + p.amount, 0);

    // Son ödemenin başlangıç tarihi: start_date_id → courseDates içinde bul
    let lastPaymentDateStr = null;
    if (studentPayments.length > 0) {
        // En yüksek start_date_id'ye sahip ödemeyi bul (sırayla eklendiği varsayılır)
        const lastPayment = studentPayments.reduce((latest, p) => {
            const latestDate = appState.courseDates.find(d => d.id === latest.start_date_id);
            const curDate    = appState.courseDates.find(d => d.id === p.start_date_id);
            if (!latestDate) return p;
            if (!curDate)    return latest;
            return curDate.date > latestDate.date ? p : latest;
        });
        const dateObj = appState.courseDates.find(d => d.id === lastPayment.start_date_id);
        if (dateObj) lastPaymentDateStr = formatDate(dateObj.date);
    }

    // ---- DOM güncelleme ----
    document.getElementById('profileTotalDates').textContent     = totalDates;
    document.getElementById('profileAttendanceRate').textContent = `%${attendanceRate}`;
    document.getElementById('profileAbsenceCount').textContent   = absentCount;
    document.getElementById('profileTotalPaid').textContent      = `${totalPaid.toLocaleString('tr-TR')}₺`;

    const lastPaymentRow = document.getElementById('profileLastPaymentRow');
    if (lastPaymentDateStr) {
        document.getElementById('profileLastPaymentDate').textContent = lastPaymentDateStr;
        lastPaymentRow.style.display = 'flex';
    } else {
        lastPaymentRow.style.display = 'none';
    }

    // ADIM 8.1 — Telefon ve WhatsApp butonu
    const phoneRow     = document.getElementById('profilePhoneRow');
    const phoneDisplay = document.getElementById('profilePhoneDisplay');
    const waBtn        = document.getElementById('profileWhatsAppBtn');
    if (student.phone && phoneRow) {
        const digits  = student.phone.replace(/\D/g, '');
        const waPhone = digits.startsWith('90') ? digits
                      : digits.startsWith('0')  ? '90' + digits.slice(1)
                      : digits.startsWith('5')  ? '90' + digits
                      : digits;
        phoneDisplay.textContent = student.phone;
        waBtn.href               = `https://wa.me/${waPhone}`;
        phoneRow.style.display   = 'block';
    } else if (phoneRow) {
        phoneRow.style.display = 'none';
    }

    loading.style.display = 'none';
    content.style.display = 'block';
    refreshIcons(); // Profil içindeki Lucide ikonlarını render et

    // ---- Kapat butonu ----
    const closeBtn = document.getElementById('profileCloseBtn');
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // Modalın dışına tıklayınca da kapat
    const outsideHandler = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            modal.removeEventListener('click', outsideHandler);
        }
    };
    modal.removeEventListener('click', outsideHandler);
    modal.addEventListener('click', outsideHandler);
}

// ---------------------------------------------------------------
// ADIM 6.2 — VIDEO PLATFORM TESPİTİ
// URL içindeki anahtar kelimelere göre platform adı ve rengi döndürür.
// Desteklenen platformlar: YouTube, Vimeo, Google Drive, Diğer
// ---------------------------------------------------------------
function detectVideoPlatform(url) {
    if (!url) return { name: 'Diğer', color: '#94a3b8' };
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
        return { name: 'YouTube', color: '#FF0000' };
    }
    if (lower.includes('vimeo.com')) {
        return { name: 'Vimeo', color: '#1AB7EA' };
    }
    if (lower.includes('drive.google.com')) {
        return { name: 'Google Drive', color: '#34A853' };
    }
    return { name: 'Diğer', color: '#94a3b8' };
}

// ---------------------------------------------------------------
// Video ekleme / görüntüleme / silme
// Mevcut video varsa → video modal'ı aç (izle + sil)
// Mevcut video yoksa → URL prompt modal'ı aç
// ---------------------------------------------------------------
export async function handleVideo(courseDateId) {
    const existingUrl = appState.videoMap[courseDateId];
    if (existingUrl) {
        const modal       = document.getElementById('videoModal');
        const linkDisplay = document.getElementById('videoLinkDisplay');
        const watchIcon   = document.getElementById('watchVideoBtn');
        const deleteIcon  = document.getElementById('deleteVideoBtn');
        const closeBtn    = document.getElementById('closeVideoModalBtn');

        // Platform tespiti
        const platform = detectVideoPlatform(existingUrl);

        // Modalın başlığını platform badge'i ile güncelle
        const modalTitle = modal.querySelector('h3');
        if (modalTitle) {
            modalTitle.innerHTML = `
                <i data-lucide="video" size="20" style="color:#2DD4BF; display:inline-block; vertical-align:middle;"></i>
                <span style="vertical-align:middle;">Lesson Recap</span>
                <span style="
                    display:inline-block;
                    vertical-align:middle;
                    margin-left:8px;
                    padding:2px 8px;
                    border-radius:12px;
                    font-size:11px;
                    font-weight:700;
                    letter-spacing:0.5px;
                    background:${platform.color}22;
                    color:${platform.color};
                    border:1px solid ${platform.color}55;
                ">${platform.name}</span>
            `;
        }

        linkDisplay.innerText    = existingUrl;
        linkDisplay.style.color  = '#2DD4BF';
        modal.style.display      = 'flex';

        // ADIM 8.1 — WhatsApp paylaşım butonunu ayarla (alıcıyı WhatsApp'tan seçer)
        const waVideoBtn = document.getElementById('whatsappVideoShareBtn');
        if (waVideoBtn) {
            const waMsg   = `Merhaba! Bu haftanın ders videosu hazır 🎵\n${existingUrl}`;
            waVideoBtn.href = `https://wa.me/?text=${encodeURIComponent(waMsg)}`;
        }

        // ADIM 8.2 — Bu haftanın ders notunu video modalında göster
        const noteDisplay = document.getElementById('videoNoteDisplay');
        if (noteDisplay) {
            const weekNote = (appState.notesMap && appState.notesMap[courseDateId]) || '';
            if (weekNote) {
                noteDisplay.textContent = '📝 ' + weekNote;
                noteDisplay.style.display = 'block';
            } else {
                noteDisplay.style.display = 'none';
            }
        }

        refreshIcons();

        const watchHandler = () => {
            window.open(existingUrl, '_blank');
        };

        const deleteHandler = () => {
            modal.style.display = 'none';
            openConfirmModal(
                'Bu video bağlantısını silmek istediğinize emin misiniz?',
                async () => {
                    const { error } = await supabase.from('videos').delete().eq('course_date_id', courseDateId);
                    if (!error) {
                        showToast('Video bağlantısı silindi ✓', 'success');
                        delete appState.videoMap[courseDateId];
                        // Sadece bu sütunun video ikonunu güncelle — tüm tabloyu yeniden çizme!
                        const icon = document.querySelector(`.vid-icon[data-date-id="${courseDateId}"]`);
                        if (icon) icon.classList.remove('active');
                    } else {
                        showToast('Video silinemedi. Bağlantıyı kontrol edin.', 'error');
                    }
                    cleanup();
                },
                () => {
                    modal.style.display = 'flex';
                    refreshIcons();
                }
            );
        };

        const closeHandler = () => {
            modal.style.display = 'none';
            // Başlığı orijinal haline sıfırla (bir sonraki açılışta temiz gelsin)
            const modalTitle = modal.querySelector('h3');
            if (modalTitle) {
                modalTitle.innerHTML = `
                    <i data-lucide="video" size="20" style="color:#2DD4BF; display: inline-block; vertical-align: middle;"></i>
                    <span style="vertical-align: middle;">Lesson Recap</span>
                `;
            }
            // ADIM 8.2 — Not göstergesini sıfırla
            const noteDisplay = document.getElementById('videoNoteDisplay');
            if (noteDisplay) noteDisplay.style.display = 'none';
            cleanup();
        };

        const cleanup = () => {
            watchIcon.removeEventListener('click', watchHandler);
            deleteIcon.removeEventListener('click', deleteHandler);
            closeBtn.removeEventListener('click', closeHandler);
            modal.removeEventListener('click', outsideClickHandler);
        };

        const outsideClickHandler = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                cleanup();
            }
        };

        watchIcon.removeEventListener('click', watchHandler);
        deleteIcon.removeEventListener('click', deleteHandler);
        closeBtn.removeEventListener('click', closeHandler);
        modal.removeEventListener('click', outsideClickHandler);

        watchIcon.addEventListener('click', watchHandler);
        deleteIcon.addEventListener('click', deleteHandler);
        closeBtn.addEventListener('click', closeHandler);
        modal.addEventListener('click', outsideClickHandler);
    } else {
        openPromptModal('Video Linki', 'https://...', async (url) => {
            if (url && url.startsWith('http')) {
                const { error } = await supabase.from('videos').insert({ course_date_id: courseDateId, url });
                if (!error) {
                    showToast('Video bağlantısı eklendi ✓', 'success');
                    appState.videoMap[courseDateId] = url;
                    // Sadece bu sütunun video ikonunu güncelle — tüm tabloyu yeniden çizme!
                    const icon = document.querySelector(`.vid-icon[data-date-id="${courseDateId}"]`);
                    if (icon) icon.classList.add('active');
                } else {
                    showToast('Video eklenemedi. Bağlantıyı kontrol edin.', 'error');
                }
            } else {
                showToast('Geçerli bir URL girin (http ile başlamalı)', 'warning');
            }
        });
    }
}

// ---------------------------------------------------------------
// Partner/Teacher adı güncelleme
// renderAttendanceView'daki .partner-edit click'ten çağırılır
// Sadece DOM + supabase — veri yenileme gerektirmiyor (surgical update)
// ---------------------------------------------------------------
export async function updateTeacherPartner(courseDateId, newPartner) {
    const { error } = await supabase.from('course_dates').update({ teacher_partner: newPartner }).eq('id', courseDateId);
    if (!error) {
        appState.partnerMap[courseDateId] = newPartner;
        showToast(newPartner ? 'Partner güncellendi ✓' : 'Partner silindi ✓', 'success');
        // Sadece ilgili ikonu güncelle — tüm tabloyu yeniden çizme!
        const span = document.querySelector(`.partner-edit[data-date-id="${courseDateId}"]`);
        if (span) {
            span.dataset.partner = newPartner;
            span.title           = newPartner;
            span.style.color     = newPartner ? 'var(--primary)' : 'var(--text-dim)';
        }
    } else {
        showToast('Partner güncellenemedi. Bağlantıyı kontrol edin.', 'error');
    }
}

// ---------------------------------------------------------------
// ADIM 8.2 — Ders notu güncelleme
// renderAttendanceView'daki .note-cell click'ten çağırılır.
// Surgical update: sadece ilgili hücreyi günceller, tabloyu yeniden çizmez.
// ---------------------------------------------------------------
export async function updateNote(courseDateId, newNote) {
    const { error } = await supabase
        .from('course_dates')
        .update({ notes: newNote || null })
        .eq('id', courseDateId);

    if (!error) {
        appState.notesMap[courseDateId] = newNote || '';
        showToast(newNote ? 'Ders notu kaydedildi ✓' : 'Ders notu silindi ✓', 'success');

        // Sadece ilgili not hücresini güncelle — tüm tabloyu yeniden çizme!
        const cell = document.querySelector(`.note-cell[data-date-id="${courseDateId}"]`);
        if (cell) {
            const noteText  = newNote || '';
            const iconColor = noteText ? 'var(--primary)' : 'var(--dim-forest)';
            const glowStyle = noteText ? 'filter:drop-shadow(0 0 4px var(--primary));' : '';
            cell.innerHTML = `
                <span style="color:${iconColor}; ${glowStyle} display:inline-flex;"><i data-lucide="book-open" size="18"></i></span>
            `;
            refreshIcons();
        }
    } else {
        showToast('Not kaydedilemedi. Bağlantıyı kontrol edin.', 'error');
    }
}

// ---------------------------------------------------------------
// HAFTA AKSİYON MENÜSÜ
// Tablo başlığındaki tarihe tıklayınca açılır. Üç seçenek sunar:
//   - Dersi İptal Et / İptali Geri Al (is_cancelled bayrağı)
//   - Haftayı Sil (kalıcı silme — onaylı)
//   - Kapat
// index.html'deki #weekActionModal öğesini kullanır.
// ---------------------------------------------------------------
export function openWeekActionModal(dateId, dateStr, isCancelled) {
    const modal     = document.getElementById('weekActionModal');
    const titleEl   = document.getElementById('weekActionTitle');
    const cancelBtn = document.getElementById('weekActionCancelToggleBtn');
    const deleteBtn = document.getElementById('weekActionDeleteBtn');
    const closeBtn  = document.getElementById('weekActionCloseBtn');
    if (!modal) return;

    titleEl.textContent = formatDate(dateStr);

    // İptal/geri-al butonunun metnini ve rengini duruma göre ayarla
    if (isCancelled) {
        cancelBtn.innerHTML = '<i data-lucide="check-circle" size="15"></i>İptali Geri Al';
        cancelBtn.style.cssText = 'flex:1; background:#2DD4BF; border:none; color:#000; border-radius:12px; padding:12px 8px; font-size:13px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px; cursor:pointer;';
    } else {
        cancelBtn.innerHTML = '<i data-lucide="ban" size="15"></i>Haftayı İptal Et';
        cancelBtn.style.cssText = 'flex:1; background:#2DD4BF; border:none; color:#000; border-radius:12px; padding:12px 8px; font-size:13px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px; cursor:pointer;';
    }

    modal.style.display = 'flex';
    refreshIcons();

    const cleanup = () => {
        cancelBtn.onclick = null;
        deleteBtn.onclick = null;
        closeBtn.onclick  = null;
    };

    cancelBtn.onclick = async () => {
        modal.style.display = 'none';
        cleanup();
        await toggleWeekCancel(dateId, !isCancelled);
    };

    deleteBtn.onclick = () => {
        modal.style.display = 'none';
        cleanup();
        openConfirmModal(
            `${formatDate(dateStr)} tarihli haftayı silmek istediğinize emin misiniz?\nTüm yoklama ve video kayıtları da silinecektir.`,
            async () => {
                await deleteWeek(dateId);
            }
        );
    };

    closeBtn.onclick = () => {
        modal.style.display = 'none';
        cleanup();
    };
}