// ---------------------------------------------------------------
// router.js — YÖNLENDİRİCİ MODÜLÜ
// ---------------------------------------------------------------
//
// KULLANIM:
//   navigateTo('mainMenu');
//   navigateTo('schools');
//   navigateTo('classes',       { schoolId, schoolName });
//   navigateTo('attendance',    { classId, className });
//   navigateTo('payments',      { classId, className });
//   navigateTo('stats');
//   navigateTo('workshops');
//   navigateTo('festivals');
//   navigateTo('privateLessons');
//   navigateTo('privateLessonDetail', { lessonId });
// ---------------------------------------------------------------

import { showToast } from './utils.js';

let currentRoute = { screen: 'mainMenu', params: {} };

// ---------------------------------------------------------------
// setViewVisibility — hangi div görünür olacak
// ---------------------------------------------------------------
function setViewVisibility(screen) {
    const mainMenuView = document.getElementById('mainMenuView');
    const dynamicView  = document.getElementById('dynamicView');
    if (screen === 'mainMenu') {
        if (mainMenuView) mainMenuView.style.display = 'block';
        if (dynamicView)  dynamicView.style.display  = 'none';
    } else {
        if (mainMenuView) mainMenuView.style.display = 'none';
        if (dynamicView)  dynamicView.style.display  = 'block';
    }
}

// ---------------------------------------------------------------
// renderScreen — ekranı çizer, history'e dokunmaz
// ---------------------------------------------------------------
async function renderScreen(screen, params) {
    // workshops/festivals/privateLessons henüz kendi sayfası olmayan
    // placeholder ekranlar — görünürlüğü DEĞİŞTİRME, menüde kal
    const placeholders = [];
    if (!placeholders.includes(screen)) {
        setViewVisibility(screen);
    }

    switch (screen) {
        case 'mainMenu': {
            const module = await import('./main_menu.js');
            await module.loadMainMenu();
            break;
        }
        case 'schools': {
            const module = await import('./schools.js');
            await module.loadSchools();
            break;
        }
        case 'classes': {
            const module = await import('./classes.js');
            await module.showClassesView(params.schoolId, params.schoolName);
            break;
        }
        case 'attendance': {
            const module = await import('./attendance.js');
            await module.showAttendanceView(params.classId, params.className);
            break;
        }
        case 'payments': {
            const module = await import('./payments.js');
            await module.showPaymentsView(params.classId, params.className);
            break;
        }
        case 'stats': {
            const module = await import('./classStats.js');
            await module.showWeeklyStats();
            break;
        }
        case 'workshops': {
            const module = await import('./workshops.js');
            await module.loadWorkshops();
            break;
        }
        case 'workshopDetail': {
            const module = await import('./workshop_attendance.js');
            await module.showWorkshopAttendance(params.workshopId, params.workshopName);
            break;
        }
        case 'festivals': {
            const module = await import('./festivals.js');
            await module.loadFestivals();
            break;
        }
        case 'festivalDetail': {
            const module = await import('./festival_classes.js');
            await module.showFestivalDetail(params.festivalId, params.festivalName);
            break;
        }
        case 'privateLessons': {
            const module = await import('./private_lessons.js');
            await module.loadPrivateLessons();
            break;
        }
        case 'privateLessonDetail': {
            const module = await import('./private_lessons.js');
            await module.showPrivateLessonDetail(params.lessonId);
            break;
        }
        default:
            console.error('Bilinmeyen ekran adı:', screen);
    }
}

// ---------------------------------------------------------------
// navigateTo — buton/link tıklandığında çağrılır
// ---------------------------------------------------------------
export async function navigateTo(screen, params = {}) {
    currentRoute = { screen, params };
    history.pushState({ screen, params }, '');
    await renderScreen(screen, params);
}

// ---------------------------------------------------------------
// reloadCurrentView — dil değişiminde çağrılır
// ---------------------------------------------------------------
export async function reloadCurrentView() {
    await renderScreen(currentRoute.screen, currentRoute.params);
}