import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDAUrjhba6zQS47RpS4jH0QyvAw3U7dlcw",
    authDomain: "logintester1-e9b27.firebaseapp.com",
    projectId: "logintester1-e9b27",
    storageBucket: "logintester1-e9b27.firebasestorage.app",
    messagingSenderId: "939798745204",
    appId: "1:939798745204:web:cc88423e2ed867734f0121"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let currentSessionId = null;
let sessionExceptions = {}; 
let sessionData = null; 
let viewDate = new Date(); 
let longPressTimer;
let isLongPress = false;
let selectedDateForNote = null;
let trendChart = null; // Chart instance
let distChart = null; // Chart instance

const fixedHolidays = ["-01-01", "-01-26", "-08-15", "-10-02", "-12-25"];

const screens = {
    login: document.getElementById("login-screen"),
    dashboard: document.getElementById("dashboard-screen"),
    detail: document.getElementById("session-detail-screen")
};

function showToast(msg, type="error") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

const themeBtns = document.querySelectorAll(".theme-toggle");
if(localStorage.getItem("theme") === "dark") document.body.setAttribute("data-theme", "dark");
themeBtns.forEach(btn => {
    btn.onclick = () => {
        if(document.body.getAttribute("data-theme") === "dark") {
            document.body.removeAttribute("data-theme");
            localStorage.setItem("theme", "light");
        } else {
            document.body.setAttribute("data-theme", "dark");
            localStorage.setItem("theme", "dark");
        }
    };
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().name) {
            loadProfile(userDoc.data());
            showScreen('dashboard');
            loadSessions();
            checkAdmin();
        } else {
            document.getElementById("first-time-setup").classList.remove("hidden");
        }
    } else {
        currentUser = null;
        showScreen('login');
        document.getElementById("first-time-setup").classList.add("hidden");
    }
});

const loginBtn = document.getElementById("login-btn");
if(loginBtn) {
    loginBtn.addEventListener("click", () => {
        const isSetupMode = !document.getElementById("first-time-setup").classList.contains("hidden");
        const nameInput = document.getElementById("display-name-input").value;
        if(isSetupMode && !nameInput) return showToast("Please enter your name!", "error");

        signInWithPopup(auth, provider).then(async (result) => {
            if(isSetupMode && nameInput) {
                await setDoc(doc(db, "users", result.user.uid), {
                    name: nameInput,
                    email: result.user.email,
                    photo: null
                }, { merge: true });
                window.location.reload(); 
            }
        }).catch(err => showToast(err.message));
    });
}
document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));

function loadProfile(data) {
    document.getElementById("user-name-text").innerText = data.name;
    document.getElementById("user-email").innerText = data.email;
    const img = document.getElementById("profile-img");
    const wrapper = document.getElementById("profile-action-btn");
    const placeholder = document.getElementById("profile-placeholder");
    const gear = document.getElementById("profile-gear");

    if(data.photo) {
        img.src = data.photo;
        img.classList.remove("hidden");
        placeholder.classList.add("hidden");
        gear.classList.remove("hidden");
        wrapper.onclick = () => {
            document.getElementById("modal-profile-preview").src = data.photo;
            document.getElementById("profile-options-modal").classList.remove("hidden");
        };
    } else {
        img.src = "";
        img.classList.add("hidden");
        placeholder.classList.remove("hidden");
        gear.classList.add("hidden");
        wrapper.onclick = () => document.getElementById("profile-upload").click();
    }
}

document.getElementById("edit-name-btn").onclick = () => document.getElementById("edit-name-modal").classList.remove("hidden");
document.getElementById("save-name-btn").onclick = async () => {
    const newName = document.getElementById("edit-name-input").value;
    if(!newName) return;
    await updateDoc(doc(db, "users", currentUser.uid), { name: newName });
    document.getElementById("user-name-text").innerText = newName;
    document.getElementById("edit-name-modal").classList.add("hidden");
    showToast("Name Updated", "success");
};
document.getElementById("cancel-edit-name").onclick = () => document.getElementById("edit-name-modal").classList.add("hidden");

document.getElementById("btn-replace-photo").onclick = () => {
    document.getElementById("profile-options-modal").classList.add("hidden");
    document.getElementById("profile-upload").click();
};
document.getElementById("btn-remove-photo").onclick = async () => {
    document.getElementById("profile-options-modal").classList.add("hidden");
    await updateDoc(doc(db, "users", currentUser.uid), { photo: null });
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    loadProfile(userDoc.data());
    showToast("Photo Removed", "success");
};
document.getElementById("close-profile-options").onclick = () => document.getElementById("profile-options-modal").classList.add("hidden");

document.getElementById("profile-upload").onchange = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    if (file.size > 5 * 1024 * 1024) return showToast("Image too large (Max 5MB)");
    const reader = new FileReader();
    reader.onload = async function(evt) {
        const base64 = evt.target.result;
        await updateDoc(doc(db, "users", currentUser.uid), { photo: base64 });
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        loadProfile(userDoc.data());
        showToast("Photo Updated", "success");
    };
    reader.readAsDataURL(file);
};

async function loadSessions() {
    const container = document.getElementById("sessions-container");
    container.innerHTML = "<p>Loading...</p>";
    const q = query(collection(db, `users/${currentUser.uid}/sessions`), orderBy("startDate", "desc"));
    const snapshot = await getDocs(q);
    container.innerHTML = "";
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const div = document.createElement("div");
        div.className = "session-card";
        const statusClass = data.status === 'Ongoing' ? 'ongoing' : 'ended';
        div.innerHTML = `
            <div class="card-header">
                <div class="card-title-row">
                    <h3>${data.name}</h3>
                    <span class="status-badge ${statusClass}">${data.status}</span>
                </div>
                <button class="delete-session-icon" onclick="event.stopPropagation(); confirmDeleteSession('${docSnap.id}', '${data.name}')">🗑️</button>
            </div>
            <p>Started: ${data.startDate}</p>
        `;
        div.onclick = () => openSession(docSnap.id, data);
        container.appendChild(div);
    });
}

window.confirmDeleteSession = (id, name) => {
    const modal = document.getElementById("delete-confirm-modal");
    document.getElementById("del-session-name").innerText = name;
    modal.classList.remove("hidden");
    document.getElementById("confirm-delete").onclick = async () => {
        await deleteDoc(doc(db, `users/${currentUser.uid}/sessions`, id));
        modal.classList.add("hidden");
        showToast("Session deleted", "success");
        loadSessions();
    };
};
document.getElementById("cancel-delete").onclick = () => document.getElementById("delete-confirm-modal").classList.add("hidden");

document.getElementById("add-session-fab").onclick = () => document.getElementById("create-modal").classList.remove("hidden");
document.getElementById("cancel-create").onclick = () => document.getElementById("create-modal").classList.add("hidden");
document.getElementById("confirm-create").onclick = async () => {
    const name = document.getElementById("new-session-name").value;
    const date = document.getElementById("new-session-date").value;
    let target = document.getElementById("new-session-target").value;
    if(!name || !date) return showToast("Fill all fields");
    if(!target) target = 75; 
    await addDoc(collection(db, `users/${currentUser.uid}/sessions`), {
        name: name,
        startDate: date,
        endDate: null,
        status: "Ongoing",
        target: Number(target)
    });
    document.getElementById("create-modal").classList.add("hidden");
    loadSessions();
};

async function openSession(sessId, data) {
    currentSessionId = sessId;
    sessionData = data;
    if(sessionData.target === undefined) sessionData.target = 75; 
    sessionExceptions = {};

    document.getElementById("detail-title").innerText = data.name;
    document.getElementById("detail-dates").innerText = `${data.startDate} — ${data.status === 'Ended' ? data.endDate : 'Ongoing'}`;
    document.getElementById("edit-target-btn").innerText = `Target: ${sessionData.target}% ✎`;

    if(data.status === "Ended") document.getElementById("end-session-btn").classList.add("hidden");
    else document.getElementById("end-session-btn").classList.remove("hidden");

    const snap = await getDocs(collection(db, `users/${currentUser.uid}/sessions/${sessId}/exceptions`));
    snap.forEach(d => { sessionExceptions[d.id] = d.data(); });

    viewDate = new Date(); 
    // Default to Calendar View
    switchTab('calendar');
    renderCalendar();
    calculateAttendance(); 
    showScreen('detail');
}

// TAB SWITCHING LOGIC
const tabCal = document.getElementById("tab-calendar");
const tabIns = document.getElementById("tab-insights");
tabCal.onclick = () => switchTab('calendar');
tabIns.onclick = () => switchTab('insights');

function switchTab(tabName) {
    if(tabName === 'calendar') {
        document.getElementById("view-calendar").classList.remove("hidden");
        document.getElementById("view-insights").classList.add("hidden");
        tabCal.classList.add("active");
        tabIns.classList.remove("active");
    } else {
        document.getElementById("view-calendar").classList.add("hidden");
        document.getElementById("view-insights").classList.remove("hidden");
        tabCal.classList.remove("active");
        tabIns.classList.add("active");
        renderAnalytics(); // RENDER CHARTS
    }
}

// --- ANALYTICS ENGINE (Chart.js) ---
function renderAnalytics() {
    // DESTROY OLD CHARTS
    if(trendChart) trendChart.destroy();
    if(distChart) distChart.destroy();

    // 1. DATA PREP (Time Travel Loop)
    let total = 0, present = 0, absent = 0, holiday = 0;
    let labels = [], dataPoints = [];
    
    let loopDate = new Date(sessionData.startDate);
    let today = new Date();
    
    // Iterate from Start -> Today
    while(loopDate <= today) {
        const dStr = loopDate.toISOString().split('T')[0];
        let status = "Present"; // Default
        
        if(sessionExceptions[dStr] && sessionExceptions[dStr].status) status = sessionExceptions[dStr].status;
        else if(isDefaultHoliday(dStr)) status = "Holiday";

        if(status !== "Holiday") {
            total++;
            if(status === "Present") present++;
            else absent++;
            
            // Record Point for Graph
            let pct = (present / total) * 100;
            labels.push(dStr.substring(5)); // "MM-DD"
            dataPoints.push(pct.toFixed(1));
        } else {
            holiday++;
        }
        loopDate.setDate(loopDate.getDate() + 1);
    }

    // 2. RENDER TREND CHART (Line)
    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Attendance %',
                data: dataPoints,
                borderColor: '#6C5CE7',
                backgroundColor: 'rgba(108, 92, 231, 0.1)',
                fill: true,
                tension: 0.3
            }, {
                label: 'Target',
                data: Array(labels.length).fill(sessionData.target),
                borderColor: '#FF4757',
                borderDash: [5, 5],
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            scales: { y: { min: 0, max: 100 } }
        }
    });

    // 3. RENDER DISTRIBUTION CHART (Doughnut)
    const ctxDist = document.getElementById('distributionChart').getContext('2d');
    distChart = new Chart(ctxDist, {
        type: 'doughnut',
        data: {
            labels: ['Present', 'Absent', 'Holidays'],
            datasets: [{
                data: [present, absent, holiday],
                backgroundColor: ['#00B894', '#FF4757', '#0984e3']
            }]
        }
    });
}

document.getElementById("edit-target-btn").onclick = () => {
    if(sessionData.status === "Ended") return showToast("Session Frozen", "error");
    document.getElementById("target-input-field").value = sessionData.target;
    document.getElementById("target-modal").classList.remove("hidden");
};
document.getElementById("cancel-target-edit").onclick = () => document.getElementById("target-modal").classList.add("hidden");
document.getElementById("save-target-btn").onclick = async () => {
    let val = Number(document.getElementById("target-input-field").value);
    if(val < 1 || val > 100) return showToast("Invalid Target", "error");
    await updateDoc(doc(db, `users/${currentUser.uid}/sessions`, currentSessionId), { target: val });
    sessionData.target = val;
    document.getElementById("edit-target-btn").innerText = `Target: ${val}% ✎`;
    document.getElementById("target-modal").classList.add("hidden");
    calculateAttendance(); 
    showToast("Target Updated", "success");
};

document.getElementById("back-btn").onclick = () => showScreen('dashboard');

function renderCalendar() {
    const grid = document.getElementById("calendar-days");
    grid.innerHTML = "";
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById("calendar-month-year").innerText = `${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();

    for(let i=0; i<firstDay; i++) grid.appendChild(document.createElement("div"));

    for(let i=1; i<=daysInMonth; i++) {
        const div = document.createElement("div");
        div.className = "day-box";
        div.innerText = i;
        
        const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth()+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const currentObj = new Date(dateStr);
        const startObj = new Date(sessionData.startDate);
        const endObj = sessionData.endDate ? new Date(sessionData.endDate) : new Date();
        const today = new Date();

        if(currentObj < startObj || (sessionData.status === 'Ongoing' && currentObj > today) || (sessionData.status === 'Ended' && currentObj > endObj)) {
            div.classList.add("day-future");
        } else {
            let status = "Present";
            let hasNote = false;
            if(isDefaultHoliday(dateStr)) status = "Holiday";
            if(sessionExceptions[dateStr]) {
                status = sessionExceptions[dateStr].status;
                if(sessionExceptions[dateStr].note) hasNote = true;
            }

            div.classList.add(`day-${status.toLowerCase()}`);
            if(hasNote) div.classList.add("note-marker");

            if(dateStr === sessionData.startDate) div.classList.add("start-date-marker");
            if(sessionData.status === 'Ended' && dateStr === sessionData.endDate) div.classList.add("end-date-marker");

            div.onmousedown = div.ontouchstart = () => { isLongPress = false; longPressTimer = setTimeout(() => { isLongPress = true; openNoteModal(dateStr); }, 600); };
            div.onmouseup = div.ontouchend = (e) => { clearTimeout(longPressTimer); if(!isLongPress) toggleDay(dateStr, status); };
            div.oncontextmenu = (e) => { e.preventDefault(); return false; };
        }
        grid.appendChild(div);
    }
}

function isDefaultHoliday(dateStr) {
    const d = new Date(dateStr);
    if(d.getDay() === 0) return true; 
    for(let h of fixedHolidays) {
        if(dateStr.endsWith(h) || dateStr === h) return true;
    }
    return false;
}

async function toggleDay(dateStr, currentStatus) {
    if(sessionData.status === "Ended") return showToast("Session Frozen", "error");
    let newStatus = "Present";
    if(currentStatus === "Present") newStatus = "Absent";
    else if(currentStatus === "Absent") newStatus = "Holiday";
    else if(currentStatus === "Holiday") newStatus = "Present"; 

    if(!sessionExceptions[dateStr]) sessionExceptions[dateStr] = {};
    sessionExceptions[dateStr].status = newStatus;
    renderCalendar();
    calculateAttendance();

    const ref = doc(db, `users/${currentUser.uid}/sessions/${currentSessionId}/exceptions`, dateStr);
    const dataToSave = { status: newStatus };
    if(sessionExceptions[dateStr].note) dataToSave.note = sessionExceptions[dateStr].note;

    if(newStatus === "Present" && !dataToSave.note) {
        if(isDefaultHoliday(dateStr)) await setDoc(ref, { status: "Present" });
        else await deleteDoc(ref);
        if(!isDefaultHoliday(dateStr)) delete sessionExceptions[dateStr];
    } else {
        await setDoc(ref, dataToSave);
    }
}

function openNoteModal(dateStr) {
    selectedDateForNote = dateStr;
    const modal = document.getElementById("note-modal");
    document.getElementById("note-date-display").innerText = `Note for ${dateStr}`;
    const input = document.getElementById("note-input-area");
    input.value = (sessionExceptions[dateStr] && sessionExceptions[dateStr].note) ? sessionExceptions[dateStr].note : "";
    modal.classList.remove("hidden");
    input.focus();
}

document.getElementById("save-note-btn").onclick = async () => {
    const text = document.getElementById("note-input-area").value;
    const dateStr = selectedDateForNote;
    if(!sessionExceptions[dateStr]) sessionExceptions[dateStr] = { status: "Absent" }; 
    sessionExceptions[dateStr].note = text;
    await setDoc(doc(db, `users/${currentUser.uid}/sessions/${currentSessionId}/exceptions`, dateStr), sessionExceptions[dateStr]);
    document.getElementById("note-modal").classList.add("hidden");
    renderCalendar();
    showToast("Note Saved", "success");
};

document.getElementById("delete-note-btn").onclick = async () => {
    const dateStr = selectedDateForNote;
    if(sessionExceptions[dateStr]) {
        delete sessionExceptions[dateStr].note;
        await setDoc(doc(db, `users/${currentUser.uid}/sessions/${currentSessionId}/exceptions`, dateStr), sessionExceptions[dateStr]);
    }
    document.getElementById("note-modal").classList.add("hidden");
    renderCalendar();
    showToast("Note Deleted", "success");
};
document.getElementById("close-note-modal").onclick = () => document.getElementById("note-modal").classList.add("hidden");

function calculateAttendance() {
    let total = 0, present = 0;
    let loopDate = new Date(sessionData.startDate);
    const stopDate = sessionData.endDate ? new Date(sessionData.endDate) : new Date();

    while(loopDate <= stopDate) {
        const dStr = loopDate.toISOString().split('T')[0];
        let status = "Present";
        if(sessionExceptions[dStr] && sessionExceptions[dStr].status) status = sessionExceptions[dStr].status;
        else if(isDefaultHoliday(dStr)) status = "Holiday";

        if(status !== "Holiday") {
            total++;
            if(status === "Present") present++;
        }
        loopDate.setDate(loopDate.getDate() + 1);
    }
    
    let percent = total === 0 ? 100 : (present / total) * 100;
    document.getElementById("attendance-percent").innerText = `${percent.toFixed(2)}%`;
    updateBunkCard(present, total, percent, sessionData.target);
}

function updateBunkCard(P, N, currentPct, T_pct) {
    const card = document.getElementById("bunk-status-card");
    const T = T_pct / 100;
    card.className = "bunk-card"; 
    
    if(currentPct < T_pct) {
        let R = Math.ceil((T*N - P) / (1-T));
        if(R < 0) R = 0;
        card.classList.add("danger");
        card.innerHTML = `<span>🚨 <b>Danger!</b> Below Target.<br>Attend next <b>${R} classes</b> to recover.</span>`;
    }
    else if ((P / (N+1)) >= T) {
        let B = Math.floor(P/T - N);
        card.classList.add("safe");
        card.innerHTML = `<span>☕ <b>Safe Zone.</b><br>You can bunk <b>${B} classes</b> safely.</span>`;
    }
    else {
        let D = Math.ceil((T*N + T - P) / (1-T));
        card.classList.add("buffer");
        card.innerHTML = `<span>🛡️ <b>On Track.</b> No bunks yet.<br>Attend <b>${D} more</b> to earn a bunk.</span>`;
    }
}

document.getElementById("notebook-btn").onclick = () => {
    const list = document.getElementById("notebook-list");
    list.innerHTML = "";
    let hasNotes = false;
    Object.keys(sessionExceptions).sort().forEach(date => {
        if(sessionExceptions[date].note) {
            hasNotes = true;
            list.innerHTML += `
                <div class="notebook-item" onclick="jumpToDate('${date}')">
                    <div class="notebook-date">${date}</div>
                    <div class="notebook-text">${sessionExceptions[date].note}</div>
                </div>`;
        }
    });
    if(!hasNotes) list.innerHTML = "<p style='padding:20px; color:#999; text-align:center;'>No notes found.</p>";
    document.getElementById("notebook-hub-modal").classList.remove("hidden");
};
document.getElementById("close-notebook").onclick = () => document.getElementById("notebook-hub-modal").classList.add("hidden");
window.jumpToDate = (date) => {
    document.getElementById("notebook-hub-modal").classList.add("hidden");
    const d = new Date(date);
    viewDate = new Date(d.getFullYear(), d.getMonth(), 1);
    renderCalendar();
};

document.getElementById("prev-month-btn").onclick = () => { viewDate.setMonth(viewDate.getMonth() - 1); renderCalendar(); };
document.getElementById("next-month-btn").onclick = () => { viewDate.setMonth(viewDate.getMonth() + 1); renderCalendar(); };

document.getElementById("end-session-btn").onclick = () => document.getElementById("end-modal").classList.remove("hidden");
document.getElementById("cancel-end").onclick = () => document.getElementById("end-modal").classList.add("hidden");
document.getElementById("confirm-end").onclick = async () => {
    const date = document.getElementById("end-session-date").value;
    if(!date) return;
    await updateDoc(doc(db, `users/${currentUser.uid}/sessions`, currentSessionId), { endDate: date, status: "Ended" });
    document.getElementById("end-modal").classList.add("hidden");
    loadSessions();
    showScreen('dashboard');
};

function showScreen(id) {
    Object.values(screens).forEach(s => s.classList.add("hidden"));
    screens[id].classList.remove("hidden");
}

async function checkAdmin() {
    const docSnap = await getDoc(doc(db, "users", currentUser.uid));
    if(docSnap.exists() && docSnap.data().isAdmin) {
        document.getElementById("admin-link").classList.remove("hidden");
        document.getElementById("admin-link").onclick = async () => {
            document.getElementById("admin-modal").classList.remove("hidden");
            const list = document.getElementById("admin-list");
            list.innerHTML = "Loading...";
            const allUsers = await getDocs(collection(db, "users"));
            list.innerHTML = "";
            allUsers.forEach(u => {
                const d = u.data();
                const pic = d.photo ? d.photo : "https://via.placeholder.com/30";
                list.innerHTML += `<div style="border-bottom:1px solid #eee; padding:10px; display:flex; align-items:center; gap:10px;">
                        <img src="${pic}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
                        <div><b>${d.name}</b><br><small>${d.email}</small></div>
                    </div>`;
            });
        };
        document.getElementById("close-admin").onclick = () => document.getElementById("admin-modal").classList.add("hidden");
    }
}
