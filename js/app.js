import { supabase } from './supabaseClient.js';
import { loadSchools } from './schools.js';

// Uygulama başlangıcı
(async () => {
    // Supabase bağlantı testi
    const { error } = await supabase.from('schools').select('id').limit(1);
    if (error) {
        console.error('Supabase bağlantı hatası:', error);
        document.getElementById('dynamicView').innerHTML = `<div class="view"><div class="main-title">Bağlantı Hatası</div><p style="color:red;">Supabase ayarlarını kontrol edin. ${error.message}</p></div>`;
        return;
    }
    await loadSchools();
})();