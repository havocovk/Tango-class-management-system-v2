// ---------------------------------------------------------------
// locales/en.js — ENGLISH TRANSLATION DICTIONARY
// ---------------------------------------------------------------
// This file mirrors locales/tr.js exactly: every key that exists
// in tr.js must also exist here with the same path.
//
// Placeholders like {name}, {date}, {n} are filled in at runtime
// by the code with real values.
// ---------------------------------------------------------------

export const en = {
    // --- General / used everywhere ---
    common: {
        ok: 'OK',
        cancel: 'Cancel',
        save: 'Save',
        close: 'Close',
        delete: 'Delete',
        yes: 'Yes',
        edit: 'Edit',
        loading: 'Loading...',
        back: 'Back'
    },

    // --- Internet connection warning banner ---
    banner: {
        offline: "📡 No internet connection — changes can't be saved",
        retry: '↺ Retry'
    },

    // --- Top / general navigation ---
    nav: {
        logout: '⎋ Log out',
        appTitle: 'Tango Class Management System',
        backToSchools: '← Schools',
        backToClasses: '← Classes',
        backToAttendance: '← Attendance',
        backGeneric: '← Back'
    },

    // --- Login screen ---
    login: {
        title: 'Tango Class Management',
        subtitle: 'Sign in to continue',
        email: 'Email',
        password: 'Password',
        button: 'Sign In',
        buttonLoading: 'Signing in...',
        errorEmpty: 'Please enter your email and password.',
        errorFail: 'Login failed. Incorrect email or password.',
        errorOffline: 'No internet connection. Please check your connection.'
    },

    // --- Sync / connection notifications (app.js) ---
    sync: {
        done: '{n} offline records synced ✓',
        fail: "{n} records couldn't be sent, will retry.",
        connectionBack: 'Connection restored ✓',
        stillOffline: "You're still offline. Check your connection."
    },

    // --- Pending records badge (offlineStore.js) ---
    offline: {
        pending: '{n} records pending'
    },

    // --- Schools screen (home) ---
    schools: {
        header: 'School List',
        add: 'Add School',
        empty: 'No schools yet. Use the button to add one.',
        modalAddTitle: 'School Name',
        modalAddPlaceholder: 'e.g. Tango Mia',
        modalEditTitle: 'Edit School Name',
        confirmDelete: 'This school will be deleted. All its classes and data will also be removed. Are you sure?',
        toastAdded: '{name} added ✓',
        toastAddFail: "Couldn't add school. Check your connection.",
        toastUpdated: 'School name updated ✓',
        toastEditFail: "Couldn't update school name. Check your connection.",
        toastDeleted: 'School deleted ✓',
        toastDeleteFail: "Couldn't delete school. Check your connection."
    },

    // --- Classes screen ---
    classes: {
        header: 'Class List - {school}',
        newClass: 'New Class',
        weeklyStats: 'Weekly Statistics',
        empty: 'No classes yet. Add a new class.',
        alertNoName: 'Please enter a class name.',
        alertNoDate: 'Please select a valid start date.',
        alertAddFail: "Couldn't add class: {msg}",
        alertDateFail: 'Class created, but an error occurred while adding the start date.',
        browserUnsupported: "Your browser doesn't support this feature.",
        editNameFail: "Couldn't update name: {msg}",
        editDateMustBeAfter: 'The new date must be after the last lesson date ({date}). Not added.',
        editDateExists: 'This date already exists. Not added.',
        editDateInsertFail: 'Error while adding date: {msg}',
        deleteConfirm: 'This class will be deleted. All students, attendance and videos will also be removed. Are you sure?',
        deleteFail: 'Error: {msg}'
    },

    // --- New Class modal (index.html) ---
    newClass: {
        title: 'Create New Class',
        namePlaceholder: 'Enter class name',
        datePlaceholder: 'Day/Month/Year',
        create: 'Create'
    },

    // --- Edit Class modal (index.html) ---
    editClass: {
        title: 'Edit Class',
        namePlaceholder: 'Class name',
        datePlaceholder: 'DD/MM/YYYY',
        info: 'If you enter a new date, it will be added to the current lesson list and future weeks will be added based on it.'
    },

    // --- Attendance screen ---
    attendance: {
        addStudent: 'Add Student',
        addWeek: 'Add Week',
        payments: 'Payments',
        colStudent: 'Student',
        rowClassRecaps: 'Class Recaps',
        rowPartner: 'Partner',
        rowNote: 'Lesson Note',
        profileTooltip: 'View profile',
        thCancelled: 'CANCELLED — click for the action menu',
        thActive: 'Action menu for this week (delete / cancel)',
        pastDateConfirm: 'This is a past-dated attendance entry. Are you sure you want to change it?',
        partnerModalTitle: 'Partner / Teacher Name',
        partnerModalPlaceholder: 'Enter a name (leave empty and press OK to remove)',
        noteModalTitle: 'Lesson Note',
        noteModalPlaceholder: 'e.g. Cruzada, Ocho Cortado (leave empty + OK to delete)'
    },

    // --- Attendance data actions (attendanceActions.js) toasts ---
    actions: {
        studentUpdated: 'Student details updated ✓',
        studentUpdateFail: 'Update failed. Check your connection.',
        studentDeleteFail: "Couldn't delete student. Check your connection.",
        studentDeleted: 'Student deleted ✓',
        newStudentTitle: 'New Student',
        newStudentPlaceholder: 'First and last name',
        studentAddFail: "Couldn't add student. Check your connection.",
        studentAdded: '{name} added to the class ✓',
        weekAdded: 'New week added ✓',
        weekAddFail: "Couldn't add week. Check your connection.",
        weekDeleted: 'Week deleted ✓',
        weekDeleteFail: 'A problem occurred while deleting the week. Check your connection.',
        attUpdateFail: "Couldn't update attendance. Check your connection.",
        weekCancelled: 'Lesson cancelled ✓',
        weekUncancelled: 'Cancellation undone ✓',
        weekToggleFail: 'Action failed. Check your connection.'
    },

    // --- Attendance modals (attendanceModals.js) ---
    modals: {
        editName: 'Edit Name',
        editPhone: 'Edit Phone',
        deleteStudentConfirm: 'Are you sure you want to delete this student? All their attendance and payments will be removed too.',
        videoTitle: 'Lesson Recap',
        videoLinkTitle: 'Video Link',
        videoAdded: 'Video link added ✓',
        videoAddFail: "Couldn't add video. Check your connection.",
        videoUrlInvalid: 'Enter a valid URL (must start with http)',
        videoDeleteConfirm: 'Are you sure you want to delete this video link?',
        videoDeleted: 'Video link deleted ✓',
        videoDeleteFail: "Couldn't delete video. Check your connection.",
        platformOther: 'Other',
        partnerUpdated: 'Partner updated ✓',
        partnerDeleted: 'Partner removed ✓',
        partnerUpdateFail: "Couldn't update partner. Check your connection.",
        noteSaved: 'Lesson note saved ✓',
        noteDeleted: 'Lesson note deleted ✓',
        noteSaveFail: "Couldn't save note. Check your connection.",
        whatsappVideoMsg: "Hi! This week's lesson video is ready 🎵\n{url}",
        weekCancelToggleCancel: 'Cancel This Week',
        weekCancelToggleUndo: 'Undo Cancellation',
        weekDeleteConfirm: 'Are you sure you want to delete the week dated {date}?\nAll attendance and video records will also be removed.'
    },

    // --- Student profile modal ---
    profile: {
        totalDates: 'Total Lessons',
        attendanceRate: 'Attendance Rate',
        absence: 'Absences',
        totalPaid: 'Total Paid',
        lastPayment: 'Last Payment:',
        whatsapp: '💬 Message on WhatsApp'
    },

    // --- Week action menu ---
    week: {
        question: 'What would you like to do for this week?',
        cancelWeek: 'Cancel This Week',
        deleteWeek: 'Delete This Week',
        undoCancel: 'Undo Cancellation'
    },

    // --- Video modal ---
    video: {
        title: 'Lesson Recap'
    },

    // --- Confirmation modal ---
    confirm: {
        title: 'Are you sure?',
        default: 'This action cannot be undone.',
        yesDelete: 'Yes, delete'
    },

    // --- App exit confirmation (Android back button) ---
    exit: {
        title: 'Exit',
        message: 'Do you want to exit the app?',
        yes: 'Yes, exit',
        no: 'No'
    },

    // --- Student edit/delete modal (index.html) ---
    student: {
        namePlaceholder: 'Full Name',
        phonePlaceholder: 'Phone: 905XX... or 05XX...'
    },

    // --- Payments screen ---
    payments: {
        title: 'Payment Tracking',
        colStudent: 'Student',
        colStatus: 'Status',
        summaryTotal: 'Total Collected',
        summaryDebtor: 'Students in Debt',
        summaryWarning: 'Package Ending',
        summaryDates: 'Total Lessons',
        monthlyIncome: 'Monthly Income',
        badgeDebt: '{n} lessons owed',
        badgeCurrent: 'Up to date ✓',
        badgeRemaining: '{n} lessons left',
        badgeAdvance: '{n} lessons in advance',
        addPaymentTitle: 'Add Payment',
        amountPlaceholder: 'Amount (₺)',
        weeksPlaceholder: 'How many weeks?',
        deletePaymentConfirm: 'Are you sure you want to delete this payment?',
        paymentDeleteFail: "Couldn't delete payment. Check your connection.",
        paymentDeleted: 'Payment deleted ✓',
        paymentAddFail: "Couldn't add payment. Check your connection.",
        paymentAdded: 'Payment added ✓',
        waDebtMsg: 'Hi {name}! Your lesson package for the {class} classes has run out 🙏 Feel free to call us for a new package.',
        waRemainMsg: 'Hi {name}! You have {n} lessons left in your {class} class package 🙏 Feel free to call us to renew.',
        months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    },

    // --- Weekly statistics / attendance chart ---
    stats: {
        header: 'Weekly Schedule',
        noClasses: 'No classes in this school yet.',
        chartHint: 'Tap a class to see its attendance chart',
        chartNoneSelected: 'No class selected yet.',
        chartNoDatesTitle: '{name} - No lesson dates',
        chartNoDatesBody: 'No lesson dates have been added for this class yet.',
        chartTitle: '{name} - Attendance Counts (lesson weeks)',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    }
};