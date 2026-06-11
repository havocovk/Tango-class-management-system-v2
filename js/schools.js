import { supabase } from './supabaseClient.js';
import { refreshIcons, openPromptModal, openConfirmModal, showToast, escapeHtml } from './utils.js';
import { navigateTo } from './router.js';
import { appState } from './state.js';
import { cacheGet, cacheSet } from './offlineStore.js';
import { t } from './i18n.js';

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

    container.innerHTML = `
        <div class="view">
            <div class="main-title">${escapeHtml(t('nav.appTitle'))}</div>
            <div class="sub-header">${escapeHtml(t('schools.header'))}</div>
            <div id="schoolsList"></div>
            <div class="nav-buttons" style="margin-top:30px;">
                <button class="btn-success" id="addSchoolBtn"><i data-lucide="plus" size="15" style="display:inline-block;vertical-align:middle;margin-right:5px;"></i>${escapeHtml(t('schools.add'))}</button>
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
    refreshIcons();
}

async function addSchool() {
    openPromptModal(t('schools.modalAddTitle'), t('schools.modalAddPlaceholder'), async (name) => {
        if (!name) return;
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