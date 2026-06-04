import { supabase } from './supabaseClient.js';
import { showModal, closeModal, refreshIcons } from './utils.js';
import { showClassesView } from './classes.js';
import { app } from './app.js';

let currentSchools = [];

export async function loadSchools() {
    const { data, error } = await supabase.from('schools').select('*').order('id');
    if (error) console.error(error);
    else currentSchools = data;
    renderSchoolsView();
}

function renderSchoolsView() {
    const container = document.getElementById('dynamicView');
    if (!container) return;
    container.innerHTML = `
        <div class="view">
            <div class="main-title">Tango Class Management System</div>
            <div class="sub-header">Okul Listesi</div>
            <div id="schoolsList"></div>
            <div class="nav-buttons" style="margin-top:30px;">
                <button class="btn-success" id="addSchoolBtn">➕ Okul Ekle</button>
            </div>
        </div>
    `;
    const listDiv = document.getElementById('schoolsList');
    listDiv.innerHTML = '';
    if (currentSchools.length === 0) {
        listDiv.innerHTML = '<div style="text-align:center; color:var(--text-dim); padding:20px;">Henüz okul yok. Okul eklemek için butonu kullanın.</div>';
    } else {
        currentSchools.forEach(school => {
            const card = document.createElement('div');
            card.className = 'class-card';
            card.innerHTML = `
                <div style="flex:1; cursor:pointer; font-weight:600;" data-id="${school.id}">${escapeHtml(school.name)}</div>
                <div style="display:flex; gap:15px;">
                    <span class="btn-icon-edit" data-id="${school.id}" data-name="${escapeHtml(school.name)}"><i data-lucide="pencil" size="20"></i></span>
                    <span class="btn-icon-delete" data-id="${school.id}"><i data-lucide="trash-2" size="20"></i></span>
                </div>
            `;
            card.querySelector('[style*="flex:1"]').addEventListener('click', () => showClassesView(school.id, school.name));
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

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

async function addSchool() {
    const name = prompt('Okul adını girin:', '');
    if (!name) return;
    const { data, error } = await supabase.from('schools').insert({ name }).select().single();
    if (error) alert('Hata: ' + error.message);
    else {
        await loadSchools();
    }
}

async function editSchool(id, oldName) {
    const newName = prompt('Okul adını düzenle:', oldName);
    if (!newName || newName === oldName) return;
    const { error } = await supabase.from('schools').update({ name: newName }).eq('id', id);
    if (error) alert('Hata: ' + error.message);
    else await loadSchools();
}

async function deleteSchool(id) {
    if (!confirm('Okul silinecek. İçindeki tüm sınıflar ve veriler de silinir. Emin misiniz?')) return;
    const { error } = await supabase.from('schools').delete().eq('id', id);
    if (error) alert('Hata: ' + error.message);
    else await loadSchools();
}

export { renderSchoolsView };