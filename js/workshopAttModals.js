// ---------------------------------------------------------------
// workshopAttModals.js — ÇALIŞTAY YOKLAMA MODAL YÖNETİCİSİ
// ---------------------------------------------------------------
// Sorumlulukları:
//   - editWorkshopStudent()    → öğrenci düzenle/arşivle/sil modalı
//   - detectWsVideoPlatform()  → URL'den platform tespiti (yardımcı)
//   - handleWorkshopVideo()    → video ekleme/görüntüleme/silme modalı
//   - updateWorkshopPartner()  → partner adı güncelle
//   - updateWorkshopNote()     → ders notu güncelle
//   - openWorkshopWeekMenu()   → hafta iptal/sil menüsü
//
// BAĞIMLILIK:
//   workshopAttModals.js → workshop_attendance.js  (loadWorkshopData + renderWorkshopAttendance)
//   workshopAttModals.js → workshopAttActions.js   (toggleWorkshopWeekCancel + deleteWorkshopWeek)
//   workshop_attendance.js → workshopAttModals.js  : HAYIR (döngü yok ✓)
// ---------------------------------------------------------------

import { supabase } from './supabaseClient.js';
import { refreshIcons, openPromptModal, openConfirmModal, showToast, escapeHtml } from './utils.js';
import { appState } from './state.js';
import { t } from './i18n.js';
import { loadWorkshopData, renderWorkshopAttendance } from './workshop_attendance.js';
import { toggleWorkshopWeekCancel, deleteWorkshopWeek } from './workshopAttActions.js';

// ---------------------------------------------------------------
// Öğrenci düzenle / arşivle / sil modalı
// .ws-student-edit tıklamasından attachCellListeners çağırır
// ---------------------------------------------------------------
export function editWorkshopStudent(studentId, currentName) {
    const modal         = document.getElementById('studentActionModal');
    const viewMode      = document.getElementById('studentViewMode');
    const editMode      = document.getElementById('studentEditMode');
    const nameDisp      = document.getElementById('studentNameDisplay');
    const editInput     = document.getElementById('studentEditInput');
    const phoneInput    = document.getElementById('studentPhoneInput');
    const editBtn       = document.getElementById('studentEditBtn');
    const phoneBtn      = document.getElementById('studentPhoneBtn');
    const deleteBtn     = document.getElementById('studentDeleteBtn');
    const archiveBtn    = document.getElementById('studentArchiveBtn');
    const closeBtn      = document.getElementById('studentModalCloseView');
    const saveBtn       = document.getElementById('studentSaveBtn');
    const cancelEditBtn = document.getElementById('studentCancelEditBtn');
    const editTitle     = document.getElementById('studentEditModeTitle');
    if (!modal) { showToast('Modal not found.', 'error'); return; }

    const student    = appState.wsStudents.find(s => s.id === studentId);
    const isArchived = student ? !!student.is_archived : false;

    // Tüm onclick'leri temizle (önceki bağlamalardan kalan)
    editBtn.onclick       = null;
    if (phoneBtn) phoneBtn.onclick = null;
    deleteBtn.onclick     = null;
    if (archiveBtn) archiveBtn.onclick = null;
    closeBtn.onclick      = null;
    saveBtn.onclick       = null;
    cancelEditBtn.onclick = null;

    nameDisp.innerText         = currentName;
    viewMode.style.display     = 'block';
    editMode.style.display     = 'none';
    modal.style.display        = 'flex';

    // Arşiv ikonu — duruma göre değiştir
    if (archiveBtn) {
        archiveBtn.innerHTML = isArchived
            ? '<i data-lucide="archive-restore" size="22"></i>'
            : '<i data-lucide="archive" size="22"></i>';
        archiveBtn.title = isArchived ? t('workshopAtt.archiveLabel') : t('workshopAtt.unarchiveLabel');
    }
    refreshIcons();

    // Kalem → sadece isim alanı
    editBtn.onclick = () => {
        viewMode.style.display  = 'none';
        editMode.style.display  = 'block';
        if (editTitle) editTitle.textContent = t('workshopAtt.editName');
        editInput.style.display = 'block';
        if (phoneInput) phoneInput.style.display = 'none';
        editInput.value = currentName;
        editInput.focus();
    };

    // Telefon ikonu → sadece telefon alanı
    if (phoneBtn) {
        phoneBtn.onclick = () => {
            viewMode.style.display  = 'none';
            editMode.style.display  = 'block';
            if (editTitle) editTitle.textContent = t('workshopAtt.editPhone');
            editInput.style.display = 'none';
            if (phoneInput) {
                phoneInput.style.display = 'block';
                phoneInput.value = student ? (student.phone || '') : '';
                phoneInput.focus();
            }
        };
    }

    // Arşivle / arşivden çıkar
    if (archiveBtn) {
        archiveBtn.onclick = async () => {
            const { error } = await supabase.from('workshop_students').update({ is_archived: !isArchived }).eq('id', studentId);
            if (error) { showToast(t('workshopAtt.studentArchiveFail'), 'error'); return; }
            modal.style.display = 'none';
            showToast(!isArchived ? t('workshopAtt.studentArchived') : t('workshopAtt.studentUnarchived'), 'success');
            await loadWorkshopData();
            renderWorkshopAttendance();
        };
    }

    // Sil
    deleteBtn.onclick = () => {
        modal.style.display = 'none';
        openConfirmModal(t('workshopAtt.studentDeleteConfirm'), async () => {
            const { error } = await supabase.from('workshop_students').delete().eq('id', studentId);
            if (error) { showToast(t('workshopAtt.studentDeleteFail'), 'error'); return; }
            showToast(t('workshopAtt.studentDeleted'), 'success');
            await loadWorkshopData();
            renderWorkshopAttendance();
        }, () => { modal.style.display = 'flex'; });
    };

    // Kapat
    closeBtn.onclick = () => { modal.style.display = 'none'; };

    // Kaydet
    saveBtn.onclick = async () => {
        const isNameMode = !phoneInput || editInput.style.display !== 'none';
        if (isNameMode) {
            const newName = editInput.value.trim();
            if (!newName) return;
            const { error } = await supabase.from('workshop_students').update({ name: newName }).eq('id', studentId);
            if (error) { showToast(t('workshopAtt.studentUpdateFail'), 'error'); return; }
            nameDisp.innerText = newName;
            currentName = newName;
        } else {
            const newPhone = phoneInput ? phoneInput.value.trim() : null;
            const { error } = await supabase.from('workshop_students').update({ phone: newPhone || null }).eq('id', studentId);
            if (error) { showToast(t('workshopAtt.studentUpdateFail'), 'error'); return; }
        }
        editInput.style.display = 'block';
        if (phoneInput) phoneInput.style.display = 'block';
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
        showToast(t('workshopAtt.studentUpdated'), 'success');
        await loadWorkshopData();
        renderWorkshopAttendance();
    };

    // İptal
    cancelEditBtn.onclick = () => {
        editInput.style.display = 'block';
        if (phoneInput) phoneInput.style.display = 'block';
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
    };
}

// ---------------------------------------------------------------
// Video platformu tespit yardımcısı
// ---------------------------------------------------------------
function detectWsVideoPlatform(url) {
    if (!url) return { name: 'Other', color: '#94a3b8' };
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return { name: 'YouTube',      color: '#FF0000' };
    if (lower.includes('vimeo.com'))                                  return { name: 'Vimeo',        color: '#1AB7EA' };
    if (lower.includes('drive.google.com'))                           return { name: 'Google Drive', color: '#34A853' };
    if (lower.includes('instagram.com'))                              return { name: 'Instagram',    color: '#E1306C' };
    if (lower.includes('facebook.com') || lower.includes('fb.watch'))return { name: 'Facebook',     color: '#1877F2' };
    if (lower.includes('tiktok.com'))                                 return { name: 'TikTok',       color: '#010101' };
    return { name: 'Other', color: '#94a3b8' };
}

// ---------------------------------------------------------------
// Video ekle / göster / sil modalı
// .ws-vid-icon tıklamasından attachCellListeners çağırır
// ---------------------------------------------------------------
export function handleWorkshopVideo(dateId) {
    const existingUrl = appState.wsVideoMap[dateId] || '';

    if (existingUrl) {
        // Video var → mevcut videoModal'ı aç (WhatsApp gizli)
        const modal     = document.getElementById('videoModal');
        const linkDisp  = document.getElementById('videoLinkDisplay');
        const watchBtn  = document.getElementById('watchVideoBtn');
        const deleteBtn = document.getElementById('deleteVideoBtn');
        const closeBtn  = document.getElementById('closeVideoModalBtn');
        const waBtn     = document.getElementById('whatsappVideoShareBtn');
        const noteDisp  = document.getElementById('videoNoteDisplay');
        if (!modal) return;

        const platform = detectWsVideoPlatform(existingUrl);
        const titleEl  = modal.querySelector('h3');
        if (titleEl) {
            titleEl.innerHTML = `
                <i data-lucide="video" size="20" style="color:#2DD4BF;display:inline-block;vertical-align:middle;"></i>
                <span style="vertical-align:middle;"> ${escapeHtml(t('modals.videoTitle'))}</span>
                <span style="display:inline-block;vertical-align:middle;margin-left:8px;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:${platform.color}22;color:${platform.color};border:1px solid ${platform.color}55;">${platform.name}</span>
            `;
        }
        linkDisp.textContent = existingUrl;
        linkDisp.style.color = '#2DD4BF';
        if (waBtn)    waBtn.style.display    = 'none';  // WA gizle
        if (noteDisp) noteDisp.style.display = 'none';  // not gizle

        modal.style.display = 'flex';
        refreshIcons();

        const watchHandler = () => window.open(existingUrl, '_blank');

        const deleteHandler = () => {
            modal.style.display = 'none';
            openConfirmModal(t('workshopAtt.videoDeleteConfirm'), async () => {
                await supabase.from('workshop_videos').delete().eq('workshop_date_id', dateId);
                delete appState.wsVideoMap[dateId];
                showToast(t('workshopAtt.videoDeleted'), 'success');
                const icon = document.querySelector(`.ws-vid-icon[data-wsdate-id="${dateId}"]`);
                if (icon) { icon.style.color = 'var(--dim-forest)'; }
                cleanup();
            }, () => { modal.style.display = 'flex'; refreshIcons(); });
        };

        const closeHandler = () => {
            modal.style.display = 'none';
            if (waBtn) waBtn.style.display = 'inline-flex'; // WA'yı geri aç
            cleanup();
        };

        const outsideHandler = (e) => { if (e.target === modal) closeHandler(); };

        const cleanup = () => {
            watchBtn.removeEventListener('click', watchHandler);
            deleteBtn.removeEventListener('click', deleteHandler);
            closeBtn.removeEventListener('click', closeHandler);
            modal.removeEventListener('click', outsideHandler);
        };

        watchBtn.removeEventListener('click', watchHandler);
        deleteBtn.removeEventListener('click', deleteHandler);
        closeBtn.removeEventListener('click', closeHandler);
        modal.removeEventListener('click', outsideHandler);

        watchBtn.addEventListener('click', watchHandler);
        deleteBtn.addEventListener('click', deleteHandler);
        closeBtn.addEventListener('click', closeHandler);
        modal.addEventListener('click', outsideHandler);

    } else {
        // Video yok → link giriş modalı
        openPromptModal(t('workshopAtt.videoAddTitle'), 'https://...', async (url) => {
            if (!url || !url.startsWith('http')) { showToast(t('workshopAtt.videoUrlInvalid'), 'warning'); return; }
            const { error } = await supabase.from('workshop_videos').insert({
                workshop_date_id: dateId, url: url.trim()
            });
            if (error) { showToast(t('workshopAtt.videoSaveFail').replace('{msg}', error.message), 'error'); return; }
            appState.wsVideoMap[dateId] = url.trim();
            showToast(t('workshopAtt.videoSaved'), 'success');
            const icon = document.querySelector(`.ws-vid-icon[data-wsdate-id="${dateId}"]`);
            if (icon) { icon.style.color = '#2DD4BF'; }
        });
    }
}

// ---------------------------------------------------------------
// Partner dual-state modal (çalıştay versiyonu)
// ---------------------------------------------------------------
export function openWorkshopPartnerModal(dateId, current, onSave) {
    const modal        = document.getElementById('partnerModal');
    const titleEl      = document.getElementById('partnerModalTitle');
    const viewMode     = document.getElementById('partnerViewMode');
    const inputMode    = document.getElementById('partnerInputMode');
    const nameDisplay  = document.getElementById('partnerNameDisplay');
    const editBtn      = document.getElementById('partnerEditBtn');
    const deleteBtn    = document.getElementById('partnerDeleteBtn');
    const viewCloseBtn = document.getElementById('partnerViewCloseBtn');
    const input        = document.getElementById('partnerInput');
    const saveBtn      = document.getElementById('partnerSaveBtn');
    const cancelBtn    = document.getElementById('partnerCancelBtn');
    if (!modal) return;

    if (titleEl) titleEl.textContent = t('workshopAtt.partnerTitle');

    editBtn.onclick      = null;
    deleteBtn.onclick    = null;
    viewCloseBtn.onclick = null;
    saveBtn.onclick      = null;
    cancelBtn.onclick    = null;

    const showInput = (value) => {
        input.placeholder = t('workshopAtt.partnerPlaceholder');
        input.value       = value || '';
        viewMode.style.display  = 'none';
        inputMode.style.display = 'block';
        modal.style.display     = 'flex';
        refreshIcons();
        setTimeout(() => input.focus(), 50);
    };

    const showView = (name) => {
        nameDisplay.textContent = name;
        viewMode.style.display  = 'block';
        inputMode.style.display = 'none';
        modal.style.display     = 'flex';
        refreshIcons();
    };

    const closeModal = () => { modal.style.display = 'none'; };

    if (current) {
        showView(current);
        editBtn.onclick = () => showInput(current);
        deleteBtn.onclick = () => {
            openConfirmModal(
                t('attendance.partnerDeleteConfirm'),
                async () => {
                    closeModal();
                    await updateWorkshopPartner(dateId, '');
                    if (onSave) onSave('');
                },
                () => { showView(nameDisplay.textContent); }
            );
        };
        viewCloseBtn.onclick = closeModal;
    } else {
        showInput('');
    }

    saveBtn.onclick = async () => {
        const val = input.value.trim();
        await updateWorkshopPartner(dateId, val);
        if (onSave) onSave(val);
        if (val) {
            showView(val);
        } else {
            closeModal();
        }
    };

    cancelBtn.onclick = () => {
        if (current) {
            showView(current);
        } else {
            closeModal();
        }
    };
}

// ---------------------------------------------------------------
// Ders notu dual-state modal (çalıştay versiyonu)
// ---------------------------------------------------------------
export function openWorkshopNoteModal(dateId, current, onSave) {
    const modal        = document.getElementById('noteModal');
    const titleEl      = document.getElementById('noteModalTitle');
    const viewMode     = document.getElementById('noteViewMode');
    const inputMode    = document.getElementById('noteInputMode');
    const textDisplay  = document.getElementById('noteTextDisplay');
    const editBtn      = document.getElementById('noteEditBtn');
    const deleteBtn    = document.getElementById('noteDeleteBtn');
    const viewCloseBtn = document.getElementById('noteViewCloseBtn');
    const textarea     = document.getElementById('noteTextarea');
    const saveBtn      = document.getElementById('noteSaveBtn');
    const cancelBtn    = document.getElementById('noteCancelBtn');
    if (!modal) return;

    if (titleEl) titleEl.textContent = t('workshopAtt.noteTitle');

    editBtn.onclick      = null;
    deleteBtn.onclick    = null;
    viewCloseBtn.onclick = null;
    saveBtn.onclick      = null;
    cancelBtn.onclick    = null;

    // partnerModal butonlarında kalıntı handler olabilir — temizle.
    const _pEdit  = document.getElementById('partnerEditBtn');
    const _pDel   = document.getElementById('partnerDeleteBtn');
    const _pClose = document.getElementById('partnerViewCloseBtn');
    const _pSave  = document.getElementById('partnerSaveBtn');
    const _pCanc  = document.getElementById('partnerCancelBtn');
    if (_pEdit)  _pEdit.onclick  = null;
    if (_pDel)   _pDel.onclick   = null;
    if (_pClose) _pClose.onclick = null;
    if (_pSave)  _pSave.onclick  = null;
    if (_pCanc)  _pCanc.onclick  = null;

    const showInput = (value) => {
        textarea.placeholder = t('workshopAtt.notePlaceholder');
        textarea.value       = value || '';
        viewMode.style.display  = 'none';
        inputMode.style.display = 'block';
        modal.style.display     = 'flex';
        setTimeout(() => textarea.focus(), 50);
    };

    const showView = (text) => {
        textDisplay.textContent = text;
        viewMode.style.display  = 'block';
        inputMode.style.display = 'none';
        modal.style.display     = 'flex';
        refreshIcons();
    };

    const closeModal = () => { modal.style.display = 'none'; };

    if (current) {
        showView(current);
        editBtn.onclick = () => showInput(current);
        deleteBtn.onclick = () => {
            openConfirmModal(
                t('attendance.noteDeleteConfirm'),
                async () => {
                    closeModal();
                    await updateWorkshopNote(dateId, '');
                    if (onSave) onSave('');
                },
                () => { showView(textDisplay.textContent); }
            );
        };
        viewCloseBtn.onclick = closeModal;
    } else {
        showInput('');
    }

    saveBtn.onclick = async () => {
        const val = textarea.value.trim();
        await updateWorkshopNote(dateId, val);
        if (onSave) onSave(val);
        if (val) {
            showView(val);
        } else {
            closeModal();
        }
    };

    cancelBtn.onclick = () => {
        if (current) {
            showView(current);
        } else {
            closeModal();
        }
    };
}

// ---------------------------------------------------------------
// Partner adı güncelle
// ---------------------------------------------------------------
export async function updateWorkshopPartner(dateId, partner) {
    const { error } = await supabase.from('workshop_dates')
        .update({ teacher_partner: partner || null }).eq('id', dateId);
    if (error) { showToast(t('workshopAtt.partnerSaveFail'), 'error'); return; }
    appState.wsPartnerMap[dateId] = partner || '';
    showToast(partner ? t('workshopAtt.partnerSaved') : t('modals.partnerDeleted'), 'success');
    const el = document.querySelector(`.ws-partner-edit[data-wsdate-id="${dateId}"]`);
    if (el) {
        el.dataset.partner = partner;
        el.title           = partner;
        el.style.color     = partner ? 'var(--primary)' : 'var(--text-dim)';
    }
}

// ---------------------------------------------------------------
// Ders notu güncelle (surgical update)
// ---------------------------------------------------------------
export async function updateWorkshopNote(dateId, note) {
    const { error } = await supabase.from('workshop_dates')
        .update({ note: note || null }).eq('id', dateId);
    if (error) { showToast(t('workshopAtt.noteSaveFail'), 'error'); return; }
    appState.wsNotesMap[dateId] = note || '';
    showToast(note ? t('workshopAtt.noteSaved') : t('modals.noteDeleteBtn'), 'success');
    const el = document.querySelector(`.ws-note-cell[data-wsdate-id="${dateId}"] span`);
    if (el) { el.style.color = note ? 'var(--primary)' : 'var(--text-dim)'; }
}

// ---------------------------------------------------------------
// Hafta menüsü (iptal et / sil)
// Tablo başlığındaki tarihe tıklayınca attachCellListeners çağırır
// toggleWorkshopWeekCancel ve deleteWorkshopWeek → workshopAttActions.js'den gelir
// ---------------------------------------------------------------
export function openWorkshopWeekMenu(dateId, isCancelled) {
    const modal     = document.getElementById('weekActionModal');
    const title     = document.getElementById('weekActionTitle');
    const cancelBtn = document.getElementById('weekActionCancelToggleBtn');
    const deleteBtn = document.getElementById('weekActionDeleteBtn');
    const closeBtn  = document.getElementById('weekActionCloseBtn');
    if (!modal) { showToast('Menu not found.', 'error'); return; }

    title.textContent   = t('workshopAtt.weekActions');
    deleteBtn.innerHTML = `<i data-lucide="trash-2" size="15"></i>${t('workshopAtt.weekDeleteLabel') || 'Delete Week'}`;

    // İptal butonu metnini duruma göre ayarla
    cancelBtn.innerHTML = isCancelled
        ? `<i data-lucide="rotate-ccw" size="15"></i>${t('workshopAtt.undoCancel')}`
        : `<i data-lucide="ban" size="15"></i>${t('workshopAtt.cancelWeek')}`;

    cancelBtn.onclick = async () => {
        modal.style.display = 'none';
        await toggleWorkshopWeekCancel(dateId, !isCancelled);
    };

    deleteBtn.onclick = () => {
        modal.style.display = 'none';
        openConfirmModal(t('workshopAtt.weekDeleteConfirm'), async () => {
            await deleteWorkshopWeek(dateId);
        });
    };

    closeBtn.onclick = () => { modal.style.display = 'none'; };

    modal.style.display = 'flex';
    refreshIcons();
}