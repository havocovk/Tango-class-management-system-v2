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

    // --- Yoklama ekranı verileri ---
    students: [],
    courseDates: [],
    attendanceMap: {},
    videoMap: {},
    partnerMap: {},

    // --- Ödeme ekranı verileri ---
    payments: []
};