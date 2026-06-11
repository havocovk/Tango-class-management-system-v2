import { supabase } from './supabaseClient.js';
import { refreshIcons, openPromptModal, openConfirmModal, showToast, escapeHtml } from './utils.js';
import { navigateTo } from './router.js';
import { appState } from './state.js';
import { cacheGet, cacheSet } from './offlineStore.js';
import { t } from './i18n.js';
import { exportBackup, importBackup } from './backup.js';

export async function loadSchools() {
    // ADIM 7.2 — Çevrimiçiyken Supabase'den çek + çevrimdışı için kaydet.
    // Çevrimdışıyken en son kaydedilen okul listesini cache'ten oku.
    if (navigator.onLine) {
        const { data, error } = await supabase.from('schools').select('*').order('id');
        if (error) {
            console.error(error);
            appState.currentSchools = (await cacheGet('schools')) || [];
        } else {
            appState.currentSchools = data;
            await cacheSet('schools', data);
        }
    } else {
        appState.currentSchools = (await cacheGet('schools')) || [];
    }
    renderSchoolsView();
}

function renderSchoolsView() {
    const container = document.getElementById('dynamicView');
    if (!container) return;

    // ADIM 2.3 — Son açılan sınıf kısayolu
    let lastClassHtml = '';
    try {
        const raw = localStorage.getItem('tcms_last_class');
        if (raw) {
            const last = JSON.parse(raw);
            // 7 günden eski kayıtları gösterme
            if (last && last.classId && (Date.now() - last.timestamp) < 7 * 24 * 60 * 60 * 1000) {
                lastClassHtml = `
                <div id="lastClassCard" style="
                    background:rgba(45,212,191,0.08);
                    border:1px solid rgba(45,212,191,0.3);
                    border-radius:14px;
                    padding:14px 16px;
                    margin-bottom:16px;
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    cursor:pointer;
                    gap:10px;
                ">
                    <div style="display:flex;flex-direction:column;gap:2px;">
                        <div style="font-size:11px;color:var(--text-dim);">⚡ Son açılan sınıf</div>
                        <div style="font-size:15px;font-weight:700;color:var(--primary);">${escapeHtml(last.className)}</div>
                        <div style="font-size:11px;color:var(--text-dim);">${escapeHtml(last.schoolName)}</div>
                    </div>
                    <i data-lucide="chevron-right" style="color:var(--primary);flex-shrink:0;" size="20"></i>
                </div>`;
            }
        }
    } catch (e) { /* yoksay */ }

    container.innerHTML = `
        <div class="view">
            <div class="main-title">${escapeHtml(t('nav.appTitle'))}</div>
            ${lastClassHtml}
            <div class="sub-header">${escapeHtml(t('schools.header'))}</div>
            <div id="schoolsList"></div>
            <div class="nav-buttons" style="margin-top:30px;">
                <button class="btn-success" id="addSchoolBtn"><i data-lucide="plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${escapeHtml(t('schools.add'))}</button>
            </div>
            <div class="nav-buttons" style="margin-top:10px;">
                <button class="btn-secondary" id="exportBackupBtn"><i data-lucide="hard-drive-download" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>Yedekle</button>
                <button class="btn-secondary" id="importBackupBtn"><i data-lucide="hard-drive-upload" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>Geri Yükle</button>
            </div>
        </div>
    `;

    const listDiv = document.getElementById('schoolsList');
    listDiv.innerHTML = '';
    if (appState.currentSchools.length === 0) {
        listDiv.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:20px;">${escapeHtml(t('schools.empty'))}</div>`;
    } else {
        appState.currentSchools.forEach(school => {
            const card = document.createElement('div');
            card.className = 'class-card';
            card.innerHTML = `
                <div style="flex:1; cursor:pointer; font-weight:600;" data-id="${school.id}">${escapeHtml(school.name)}</div>
                <div style="display:flex; gap:15px;">
                    <span class="btn-icon-edit" data-id="${school.id}" data-name="${escapeHtml(school.name)}"><i data-lucide="pencil" size="20"></i></span>
                    <span class="btn-icon-delete" data-id="${school.id}"><i data-lucide="trash-2" size="20"></i></span>
                </div>
            `;
            card.querySelector('[style*="flex:1"]').addEventListener('click', () => {
                navigateTo('classes', { schoolId: school.id, schoolName: school.name });
            });
            card.querySelector('.btn-icon-edit').addEventListener('click', (e) => {
                e.stopPropagation();
                editSchool(school.id, school.name);
            });
            card.querySelector('.btn-icon-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSchool(school.id);
            });
            listDiv.appendChild(card);
        });
    }
    document.getElementById('addSchoolBtn').onclick = () => addSchool();
    document.getElementById('exportBackupBtn').onclick = () => exportBackup();
    document.getElementById('importBackupBtn').onclick = () => importBackup();

    // ADIM 2.3 — Kısayol kartı tıklama olayı
    const lastCard = document.getElementById('lastClassCard');
    if (lastCard) {
        lastCard.addEventListener('click', () => {
            try {
                const last = JSON.parse(localStorage.getItem('tcms_last_class'));
                if (last && last.classId) {
                    appState.currentSchoolId   = last.schoolId;
                    appState.currentSchoolName = last.schoolName;
                    navigateTo('attendance', { classId: last.classId, className: last.className });
                }
            } catch (e) { /* yoksay */ }
        });
    }

    refreshIcons();
}

async function addSchool() {
    openPromptModal(t('schools.modalAddTitle'), t('schools.modalAddPlaceholder'), async (name) => {
        if (!name) return;
        const duplicate = appState.currentSchools.some(s => s.name.trim().toLowerCase() === name.trim().toLowerCase());
        if (duplicate) { showToast('Bu isimde bir okul zaten mevcut.', 'warning'); return; }
        const { error } = await supabase.from('schools').insert({ name });
        if (error) showToast(t('schools.toastAddFail'), 'error');
        else {
            showToast(t('schools.toastAdded', { name }), 'success');
            await loadSchools();
        }
    });
}

async function editSchool(id, oldName) {
    openPromptModal(t('schools.modalEditTitle'), oldName, async (newName) => {
        if (!newName || newName === oldName) return;
        const duplicate = appState.currentSchools.some(s => s.id !== id && s.name.trim().toLowerCase() === newName.trim().toLowerCase());
        if (duplicate) { showToast('Bu isimde bir okul zaten mevcut.', 'warning'); return; }
        const { error } = await supabase.from('schools').update({ name: newName }).eq('id', id);
        if (error) showToast(t('schools.toastEditFail'), 'error');
        else {
            showToast(t('schools.toastUpdated'), 'success');
            await loadSchools();
        }
    });
}

async function deleteSchool(id) {
    openConfirmModal(t('schools.confirmDelete'), async () => {
        const { error } = await supabase.from('schools').delete().eq('id', id);
        if (error) showToast(t('schools.toastDeleteFail'), 'error');
        else {
            showToast(t('schools.toastDeleted'), 'success');
            await loadSchools();
        }
    });
}