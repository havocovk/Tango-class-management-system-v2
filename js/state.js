// ---------------------------------------------------------------
// ADIM 3.3 — MERKEZİ STATE (DURUM) YÖNETİMİ
// ---------------------------------------------------------------
// Eskiden her modül kendi içinde ayrı ayrı değişken tutuyordu
// (currentClassId, students, courseDates ...). Bu yüzden bir
// modüldeki veri diğerinden habersizdi — "hafıza kaybı" sorunu.
//
// Artık uygulama genelinde paylaşılan TÜM veriler tek bir yerde,
// bu "appState" nesnesinin içinde tutulur. Tüm modüller buradan
// okur ve buraya yazar. Tek "ortak pano".
//
// ÖNEMLİ: appState'in kendisi (const) değiştirilemez, AMA içindeki
// değerler serbestçe güncellenebilir. Doğru kullanım:
//     appState.currentClassId = 5;          // ✓ doğru
//     appState.students = [...];             // ✓ doğru
//     appState.attendanceMap[key] = '+';     // ✓ doğru
// ---------------------------------------------------------------

export const appState = {
    // --- Okullar ekranı ---
    currentSchools: [],

    // --- Seçili okul (sınıflar ekranı) ---
    currentSchoolId: null,
    currentSchoolName: null,
    classesList: [],

    // --- Seçili sınıf (yoklama + ödeme ekranları ortak kullanır) ---
    currentClassId: null,
    currentClassName: null,
    currentClass: null,   // ADIM 5.2 — paket fiyatı ve hafta sayısı için

    // --- Yoklama ekranı verileri ---
    students: [],
    courseDates: [],
    attendanceMap: {},
    videoMap: {},
    partnerMap: {},
    notesMap: {},

    // --- Ödeme ekranı verileri ---
    payments: [],

    // --- ADIM 5.1 — Arşiv görünürlük bayrakları ---
    // true ise arşivlenmiş kayıtlar da listede gösterilir.
    showArchivedClasses: false,
    showArchivedStudents: false,

    // --- ÇALIŞTAY verileri ---
    workshopsList: [],
    showArchivedWorkshops: false,
    currentWorkshopId: null,
    currentWorkshopName: null,
    currentWorkshop: null,
    wsStudents: [],
    wsDates: [],
    wsAttendanceMap: {},
    wsVideoMap: {},
    wsPartnerMap: {},
    wsNotesMap: {}
};