import { supabase } from './supabaseClient.js';
import { refreshIcons, openPromptModal, openConfirmModal, showToast, escapeHtml } from './utils.js';
import { navigateTo } from './router.js';

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
    openPromptModal('Okul Adı', 'Örn: Tango Mia', async (name) => {
        if (!name) return;
        const { error } = await supabase.from('schools').insert({ name });
        if (error) showToast('Okul eklenemedi. Bağlantıyı kontrol edin.', 'error');
        else {
            showToast(`${name} eklendi ✓`, 'success');
            await loadSchools();
        }
    });
}

async function editSchool(id, oldName) {
    openPromptModal('Okul Adını Düzenle', oldName, async (newName) => {
        if (!newName || newName === oldName) return;
        const { error } = await supabase.from('schools').update({ name: newName }).eq('id', id);
        if (error) showToast('Okul adı güncellenemedi. Bağlantıyı kontrol edin.', 'error');
        else {
            showToast('Okul adı güncellendi ✓', 'success');
            await loadSchools();
        }
    });
}

async function deleteSchool(id) {
    openConfirmModal('Okul silinecek. İçindeki tüm sınıflar ve veriler de silinir. Emin misiniz?', async () => {
        const { error } = await supabase.from('schools').delete().eq('id', id);
        if (error) showToast('Okul silinemedi. Bağlantıyı kontrol edin.', 'error');
        else {
            showToast('Okul silindi ✓', 'success');
            await loadSchools();
        }
    });
}