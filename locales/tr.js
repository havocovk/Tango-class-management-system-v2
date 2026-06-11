// ---------------------------------------------------------------
// locales/tr.js — TÜRKÇE ÇEVİRİ SÖZLÜĞÜ
// ---------------------------------------------------------------
// Bu dosya uygulamadaki TÜM Türkçe metinleri içerir.
// Yapı, en.js (İngilizce) ile birebir aynıdır — bir anahtar
// burada varsa, en.js'te de aynı anahtar bulunmalıdır.
//
// {name}, {date}, {n} gibi kıvırcık parantezli yerler, kod
// tarafından çalışma anında gerçek değerlerle doldurulur.
// ---------------------------------------------------------------

export const tr = {
    // --- Genel / her yerde kullanılan ---
    common: {
        ok: 'Tamam',
        cancel: 'İptal',
        save: 'Kaydet',
        close: 'Kapat',
        delete: 'Sil',
        yes: 'Evet',
        edit: 'Düzenle',
        loading: 'Yükleniyor...',
        back: 'Geri'
    },

    // --- İnternet bağlantı uyarı bandı ---
    banner: {
        offline: '📡 İnternet bağlantısı yok — değişiklikler kaydedilemiyor',
        retry: '↺ Tekrar Dene'
    },

    // --- Üst/genel navigasyon ---
    nav: {
        logout: '⎋ Çıkış',
        appTitle: 'Tango Sınıf Yönetim Sistemi',
        backToSchools: '← Okullar',
        backToClasses: '← Sınıflar',
        backToAttendance: '← Yoklama Sayfası',
        backGeneric: '← Geri'
    },

    // --- Giriş (login) ekranı ---
    login: {
        title: 'Tango Sınıf Yönetimi',
        subtitle: 'Devam etmek için giriş yapın',
        email: 'E-posta',
        password: 'Şifre',
        button: 'Giriş Yap',
        buttonLoading: 'Giriş yapılıyor...',
        errorEmpty: 'Lütfen e-posta ve şifrenizi girin.',
        errorFail: 'Giriş başarısız. E-posta veya şifre hatalı.',
        errorOffline: 'İnternet bağlantısı yok. Lütfen bağlantınızı kontrol edin.'
    },

    // --- Senkronizasyon / bağlantı bildirimleri (app.js) ---
    sync: {
        done: '{n} çevrimdışı kayıt senkronize edildi ✓',
        fail: '{n} kayıt gönderilemedi, tekrar denenecek.',
        connectionBack: 'Bağlantı geri geldi ✓',
        stillOffline: 'Hâlâ çevrimdışısınız. Bağlantıyı kontrol edin.'
    },

    // --- Bekleyen kayıt rozeti (offlineStore.js) ---
    offline: {
        pending: '{n} kayıt bekleniyor'
    },

    // --- Okullar ekranı (ana sayfa) ---
    schools: {
        header: 'Okul Listesi',
        add: 'Okul Ekle',
        empty: 'Henüz okul yok. Okul eklemek için butonu kullanın.',
        modalAddTitle: 'Okul Adı',
        modalAddPlaceholder: 'Örn: Tango Mia',
        modalEditTitle: 'Okul Adını Düzenle',
        confirmDelete: 'Okul silinecek. İçindeki tüm sınıflar ve veriler de silinir. Emin misiniz?',
        toastAdded: '{name} eklendi ✓',
        toastAddFail: 'Okul eklenemedi. Bağlantıyı kontrol edin.',
        toastUpdated: 'Okul adı güncellendi ✓',
        toastEditFail: 'Okul adı güncellenemedi. Bağlantıyı kontrol edin.',
        toastDeleted: 'Okul silindi ✓',
        toastDeleteFail: 'Okul silinemedi. Bağlantıyı kontrol edin.'
    },

    // --- Sınıflar ekranı ---
    classes: {
        header: 'Sınıf Listesi - {school}',
        newClass: 'Yeni Sınıf',
        weeklyStats: 'Haftalık İstatistikler',
        empty: 'Henüz sınıf yok. Yeni sınıf ekleyin.',
        alertNoName: 'Lütfen bir sınıf adı giriniz.',
        alertNoDate: 'Lütfen geçerli bir başlangıç tarihi seçiniz.',
        alertAddFail: 'Sınıf eklenemedi: {msg}',
        alertDateFail: 'Sınıf oluşturuldu ancak başlangıç tarihi eklenirken hata oluştu.',
        browserUnsupported: 'Tarayıcınız bu özelliği desteklemiyor.',
        editNameFail: 'Ad güncellenemedi: {msg}',
        editDateMustBeAfter: 'Yeni tarih, son ders tarihinden ({date}) sonra olmalıdır. Eklenmedi.',
        editDateExists: 'Bu tarih zaten mevcut. Eklenmedi.',
        editDateInsertFail: 'Tarih eklenirken hata: {msg}',
        deleteConfirm: 'Sınıf silinecek. Tüm öğrenciler, yoklamalar ve videolar da silinir. Emin misiniz?',
        deleteFail: 'Hata: {msg}'
    },

    // --- Yeni Sınıf modalı (index.html) ---
    newClass: {
        title: 'Yeni Sınıf Oluştur',
        namePlaceholder: 'Sınıf adını giriniz',
        datePlaceholder: 'Gün/Ay/Yıl',
        create: 'Oluştur'
    },

    // --- Sınıf Düzenle modalı (index.html) ---
    editClass: {
        title: 'Sınıf Düzenle',
        namePlaceholder: 'Sınıf adı',
        datePlaceholder: 'GG/AA/YYYY',
        info: 'Yeni tarih girerseniz, bu tarih mevcut ders listesine eklenir ve sonraki haftalar bu tarihe göre eklenir.'
    },

    // --- Yoklama ekranı ---
    attendance: {
        addStudent: 'Öğrenci Ekle',
        addWeek: 'Hafta Ekle',
        payments: 'Ödemeler',
        colStudent: 'Öğrenci',
        rowClassRecaps: 'Ders Videoları',
        rowPartner: 'Partner',
        rowNote: 'Ders Notu',
        profileTooltip: 'Profili gör',
        thCancelled: 'İPTAL EDİLDİ — işlem menüsü için tıklayın',
        thActive: 'Bu hafta için işlem menüsü (sil / iptal)',
        pastDateConfirm: 'Bu geçmiş tarihli bir yoklama. Değişiklik yapmak istediğinize emin misiniz?',
        partnerModalTitle: 'Partner Adı',
        partnerModalPlaceholder: 'İsim girin (boş bırakıp Tamam derseniz silinir)',
        noteModalTitle: 'Ders Notu',
        noteModalPlaceholder: 'Örn: Cruzada, Ocho Cortado (boş bırakıp Tamam → notu siler)'
    },

    // --- Yoklama veri işlemleri (attendanceActions.js) toast'ları ---
    actions: {
        studentUpdated: 'Öğrenci bilgileri güncellendi ✓',
        studentUpdateFail: 'Güncelleme başarısız. Bağlantıyı kontrol edin.',
        studentDeleteFail: 'Öğrenci silinemedi. Bağlantıyı kontrol edin.',
        studentDeleted: 'Öğrenci silindi ✓',
        newStudentTitle: 'Yeni Öğrenci',
        newStudentPlaceholder: 'Adı ve soyadı',
        studentAddFail: 'Öğrenci eklenemedi. Bağlantıyı kontrol edin.',
        studentAdded: '{name} sınıfa eklendi ✓',
        weekAdded: 'Yeni hafta eklendi ✓',
        weekAddFail: 'Hafta eklenemedi. Bağlantıyı kontrol edin.',
        weekDeleted: 'Hafta silindi ✓',
        weekDeleteFail: 'Hafta silinirken sorun oluştu. Bağlantıyı kontrol edin.',
        attUpdateFail: 'Yoklama güncellenemedi. Bağlantıyı kontrol edin.',
        weekCancelled: 'Ders iptal edildi ✓',
        weekUncancelled: 'İptal geri alındı ✓',
        weekToggleFail: 'İşlem başarısız. Bağlantıyı kontrol edin.'
    },

    // --- Yoklama modalları (attendanceModals.js) ---
    modals: {
        editName: 'Ad Düzenle',
        editPhone: 'Telefon Düzenle',
        deleteStudentConfirm: 'Öğrenciyi silmek istediğinize emin misiniz? Tüm yoklamaları ve ödemeleri de silinecek.',
        videoTitle: 'Ders Videosu',
        videoLinkTitle: 'Video Linki',
        videoAdded: 'Video bağlantısı eklendi ✓',
        videoAddFail: 'Video eklenemedi. Bağlantıyı kontrol edin.',
        videoUrlInvalid: 'Geçerli bir URL girin (http ile başlamalı)',
        videoDeleteConfirm: 'Bu video bağlantısını silmek istediğinize emin misiniz?',
        videoDeleted: 'Video bağlantısı silindi ✓',
        videoDeleteFail: 'Video silinemedi. Bağlantıyı kontrol edin.',
        platformOther: 'Diğer',
        partnerUpdated: 'Partner güncellendi ✓',
        partnerDeleted: 'Partner silindi ✓',
        partnerUpdateFail: 'Partner güncellenemedi. Bağlantıyı kontrol edin.',
        noteSaved: 'Ders notu kaydedildi ✓',
        noteDeleted: 'Ders notu silindi ✓',
        noteSaveFail: 'Not kaydedilemedi. Bağlantıyı kontrol edin.',
        whatsappVideoMsg: 'Merhaba! Bu haftanın ders videosu hazır 🎵\n{url}',
        weekCancelToggleCancel: 'Haftayı İptal Et',
        weekCancelToggleUndo: 'İptali Geri Al',
        weekDeleteConfirm: '{date} tarihli haftayı silmek istediğinize emin misiniz?\nTüm yoklama ve video kayıtları da silinecektir.'
    },

    // --- Öğrenci profil modalı ---
    profile: {
        totalDates: 'Toplam Ders',
        attendanceRate: 'Katılım Oranı',
        absence: 'Devamsızlık',
        totalPaid: 'Toplam Ödeme',
        lastPayment: 'Son Ödeme:',
        whatsapp: "💬 WhatsApp'ta Yaz"
    },

    // --- Hafta aksiyon menüsü ---
    week: {
        question: 'Bu hafta için ne yapmak istersiniz?',
        cancelWeek: 'Haftayı İptal Et',
        deleteWeek: 'Haftayı Sil',
        undoCancel: 'İptali Geri Al'
    },

    // --- Video modalı ---
    video: {
        title: 'Ders Videosu'
    },

    // --- Onay modalı ---
    confirm: {
        title: 'Emin misiniz?',
        default: 'Bu işlem geri alınamaz.',
        yesDelete: 'Evet, sil'
    },

    // --- Uygulama çıkış onayı (Android geri tuşu) ---
    exit: {
        title: 'Çıkış',
        message: 'Uygulamadan çıkmak istiyor musunuz?',
        yes: 'Evet, çık',
        no: 'Hayır'
    },

    // --- Öğrenci düzenle/sil modalı (index.html) ---
    student: {
        namePlaceholder: 'Ad Soyad',
        phonePlaceholder: 'Telefon: 905XX... veya 05XX...'
    },

    // --- Ödemeler ekranı ---
    payments: {
        title: 'Ödeme Takibi',
        colStudent: 'Öğrenci',
        colStatus: 'Durum',
        summaryTotal: 'Toplam Tahsilat',
        summaryDebtor: 'Borçlu Öğrenci',
        summaryWarning: 'Paketi Bitiyor',
        summaryDates: 'Toplam Ders',
        monthlyIncome: 'Aylık Gelir',
        badgeDebt: '{n} ders borçlu',
        badgeCurrent: 'Güncel ✓',
        badgeRemaining: '{n} ders kaldı',
        badgeAdvance: '{n} ders avans',
        addPaymentTitle: 'Ödeme Ekle',
        amountPlaceholder: 'Miktar (₺)',
        weeksPlaceholder: 'Kaç hafta geçerli?',
        deletePaymentConfirm: 'Bu ödemeyi silmek istediğinize emin misiniz?',
        paymentDeleteFail: 'Ödeme silinemedi. Bağlantıyı kontrol edin.',
        paymentDeleted: 'Ödeme silindi ✓',
        paymentAddFail: 'Ödeme eklenemedi. Bağlantıyı kontrol edin.',
        paymentAdded: 'Ödeme eklendi ✓',
        waDebtMsg: 'Merhaba {name}! {class} derslerindeki ders paketiniz doldu 🙏 Yeni paket için bizi arayabilirsiniz.',
        waRemainMsg: 'Merhaba {name}! {class} derslerindeki ders paketinizden {n} ders hakkınız kaldı 🙏 Paketi yenilemek için bizi arayabilirsiniz.',
        months: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
    },

    // --- Haftalık istatistikler / katılım grafiği ---
    stats: {
        header: 'Haftalık Program',
        noClasses: 'Bu okulda henüz sınıf yok.',
        chartHint: 'Bir sınıfa tıkla, katılım grafiğini gör',
        chartNoneSelected: 'Henüz bir sınıf seçilmedi.',
        chartNoDatesTitle: '{name} - Ders tarihi yok',
        chartNoDatesBody: 'Bu sınıf için henüz ders tarihi eklenmemiş.',
        chartTitle: '{name} - Katılım Sayıları (ders haftaları)',
        days: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
    }
};