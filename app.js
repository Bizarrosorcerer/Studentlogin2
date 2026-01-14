import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// --- CONFIG ---
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

// --- STATE ---
let currentUser = null;
let currentSessionId = null;
let sessionExceptions = {}; 
let sessionData = null; 
let viewDate = new Date(); 
let selectedDateForNote = null; 

const fixedHolidays = [
    "-01-01", "-01-26", "-08-15", "-10-02", "-12-25",
    "2026-03-04", "2026-04-03", "2026-03-20", "2026-10-20", "2026-11-08",
    "2027-03-22", "2027-03-26", "2027-03-09", "2027-10-09", "2027-10-29"
];

const screens = {
    login: document.getElementById("login-screen"),
    dashboard: document.getElementById("dashboard-screen"),
    detail: document.getElementById("session-detail-screen")
};

// --- DARK MODE TOGGLE (SAFE VERSION) ---
// This section is now wrapped in an IF check to prevent crashing on the Login Screen
const themeBtn = document.getElementById("theme-toggle");
if (themeBtn) {
    if(localStorage.getItem("theme") === "dark") {
        document.body.setAttribute("data-theme", "dark");
        themeBtn.innerText = "☀️";
    }

    themeBtn.onclick = () => {
        if(document.body.getAttribute("data-theme") === "dark") {
            document.body.removeAttribute("data-theme");
            localStorage.setItem("theme", "light");
            themeBtn.innerText = "🌙";
        } else {
            document.body.setAttribute("data-theme", "dark");
            localStorage.setItem("theme", "dark");
            themeBtn.innerText = "☀️";
        }
    };
}

// --- AUTH ---
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

function loadProfile(data) {
    document.getElementById("user-name").innerHTML = ${data.name} <span id="edit-name-btn">✎</span>;
    document.getElementById("user-email").innerText = data.email;
    
    const img = document.getElementById("profile-img");
    const removeBtn = document.getElementById("remove-photo-btn");
    
    if(data.photo) {
        img.src = data.photo;
        removeBtn.classList.remove("hidden");
    } else {
        img.src = "https://via.placeholder.com/50";
        removeBtn.classList.add("hidden");
    }
    document.getElementById("edit-name-btn").onclick = () => document.getElementById("edit-name-modal").classList.remove("hidden");
}

document.getElementById("login-btn").addEventListener("click", () => {
    const isSetupMode = !document.getElementById("first-time-setup").classList.contains("hidden");
    const nameInput = document.getElementById("display-name-input").value;
    if(isSetupMode && !nameInput) return alert("Please enter your name!");

    signInWithPopup(auth, provider).then(async (result) => {
        if(isSetupMode && nameInput) {
            await setDoc(doc(db, "users", result.user.uid), {
                name: nameInput,
                email: result.user.email,
                photo: null
            }, { merge: true });
            window.location.reload(); 
        }
    });
});
document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));


// --- PROFILE ACTIONS ---
document.getElementById("save-name-btn").onclick = async () => {
    const newName = document.getElementById("edit-name-input").value;
    if(!newName) return;
    await updateDoc(doc(db, "users", currentUser.uid), { name: newName });
    document.getElementById("user-name").innerHTML = ${newName} <span id="edit-name-btn">✎</span>;
    document.getElementById("edit-name-modal").classList.add("hidden");
};
document.getElementById("cancel-edit-name").onclick = () => document.getElementById("edit-name-modal").classList.add("hidden");

document.getElementById("profile-pic-wrapper").onclick = () => document.getElementById("profile-upload").click();
document.getElementById("profile-upload").onchange = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    if (file.size > 5 * 1024 * 1024) return alert("Image too large (Max 5MB)");

    const reader = new FileReader();
    reader.onload = async function(evt) {
        const base64 = evt.target.result;
        document.getElementById("profile-img").src = base64;
        document.getElementById("remove-photo-btn").classList.remove("hidden");
        await updateDoc(doc(db, "users", currentUser.uid), { photo: base64 });
    };
    reader.readAsDataURL(file);
};

document.getElementById("remove-photo-btn").onclick = async (e) => {
    e.stopPropagation(); 
    if(!confirm("Remove profile photo?")) return;
    await updateDoc(doc(db, "users", currentUser.uid), { photo: null });
    document.getElementById("profile-img").src = "https://via.placeholder.com/50";
    document.getElementById("remove-photo-btn").classList.add("hidden");
};


// --- DASHBOARD ---
async function loadSessions() {
    const container = document.getElementById("sessions-container");
    container.innerHTML = "<p>Loading...</p>";
    
    const q = query(collection(db, users/${currentUser.uid}/sessions), orderBy("startDate", "desc"));
    const snapshot = await getDocs(q);
    
    container.innerHTML = "";
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const div = document.createElement("div");
        div.className = "session-card";
        div.innerHTML = `
            <h3>${data.name}</h3>
            <p>Started: ${data.startDate}</p>
            <span class="badge ${data.status.toLowerCase()}">${data.status}</span>
        `;
        div.onclick = () => openSession(docSnap.id, data);
        container.appendChild(div);
    });
}

document.getElementById("add-session-fab").onclick = () => document.getElementById("create-modal").classList.remove("hidden");
document.getElementById("cancel-create").onclick = () => document.getElementById("create-modal").classList.add("hidden");

document.getElementById("confirm-create").onclick = async () => {
    const name = document.getElementById("new-session-name").value;
    const date = document.getElementById("new-session-date").value;
    let target = document.getElementById("new-session-target").value;

    if(!name || !date) return alert("Fill all fields");
    if(!target) target = 75; 

    if(new Date(date) > new Date()) return alert("Cannot start in future");
    if(new Date(date) < new Date("2026-01-01")) return alert("Cannot start before 2026");

    await addDoc(collection(db, users/${currentUser.uid}/sessions), {
        name: name,
        startDate: date,
        endDate: null,
        status: "Ongoing",
        target: Number(target)
    });
    
    document.getElementById("create-modal").classList.add("hidden");
    loadSessions();
};


// --- SESSION DETAIL ---
async function openSession(sessId, data) {
    currentSessionId = sessId;
    sessionData = data;
    if(sessionData.target === undefined) sessionData.target = 75; 

    sessionExceptions = {};
    document.getElementById("note-input-container").classList.add("hidden"); 

    document.getElementById("detail-title").innerText = data.name;
    document.getElementById("detail-dates").innerText = ${data.startDate} — ${data.status === 'Ended' ? data.endDate : 'Ongoing'};
    
    const btnText = sessionData.target === 0 ? "Target: OFF" : Target: ${sessionData.target}%;
    document.getElementById("edit-target-btn").innerText = btnText;

    if(data.status === "Ended") {
        document.getElementById("end-session-btn").classList.add("hidden");
    } else {
        document.getElementById("end-session-btn").classList.remove("hidden");
    }

    const snap = await getDocs(collection(db, users/${currentUser.uid}/sessions/${sessId}/exceptions));
    snap.forEach(d => { 
        sessionExceptions[d.id] = d.data(); 
    });

    viewDate = new Date(); 
    renderCalendar();
    calculateAttendance(); 
    
    showScreen('detail');
}
document.getElementById("edit-target-btn").onclick = async () => {
    if(sessionData.status === "Ended") return alert("Session Ended.");
    let input = prompt("Enter new target percentage (0 to turn off):", sessionData.target);
    if(input === null) return;
    let newTarget = Number(input);
    if(isNaN(newTarget) || newTarget < 0 || newTarget > 100) return alert("Invalid number");

    await updateDoc(doc(db, users/${currentUser.uid}/sessions, currentSessionId), { target: newTarget });
    sessionData.target = newTarget;
    const btnText = newTarget === 0 ? "Target: OFF" : Target: ${newTarget}%;
    document.getElementById("edit-target-btn").innerText = btnText;
    calculateAttendance(); 
};

document.getElementById("back-btn").onclick = () => showScreen('dashboard');

function renderCalendar() {
    const grid = document.getElementById("calendar-days");
    grid.innerHTML = "";
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById("calendar-month-year").innerText = ${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()};

    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();

    for(let i=0; i<firstDay; i++) {
        const div = document.createElement("div");
        grid.appendChild(div);
    }

    for(let i=1; i<=daysInMonth; i++) {
        const div = document.createElement("div");
        div.className = "day-box";
        div.innerText = i;
        
        const dateStr = ${viewDate.getFullYear()}-${String(viewDate.getMonth()+1).padStart(2,'0')}-${String(i).padStart(2,'0')};
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
            
            // Check Exceptions from DB
            if(sessionExceptions[dateStr]) {
                status = sessionExceptions[dateStr].status;
                if(sessionExceptions[dateStr].note) hasNote = true;
            }

            div.classList.add(day-${status.toLowerCase()});
            if(hasNote) div.classList.add("note-marker");

            div.onclick = () => toggleDay(dateStr, status);
        }

        if(dateStr === sessionData.startDate) div.classList.add("start-date-marker");
        if(sessionData.status === 'Ended' && dateStr === sessionData.endDate) div.classList.add("end-date-marker");
        
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

// --- TOGGLE DAY & NOTE LOGIC ---
async function toggleDay(dateStr, currentStatus) {
    if(sessionData.status === "Ended") return alert("Session Ended. Cannot edit.");
    
    // Cycle: Present -> Absent -> Holiday -> Present
    let newStatus = "Present";
    if(currentStatus === "Present") newStatus = "Absent";
    else if(currentStatus === "Absent") newStatus = "Holiday";
    else if(currentStatus === "Holiday") newStatus = "Present"; 

    // Update Local State
    if(!sessionExceptions[dateStr]) sessionExceptions[dateStr] = {};
    sessionExceptions[dateStr].status = newStatus;

    if(newStatus === "Absent") {
        openNoteInput(dateStr);
    } else {
        document.getElementById("note-input-container").classList.add("hidden");
    }

    renderCalendar(); 
    calculateAttendance(); 

    const ref = doc(db, users/${currentUser.uid}/sessions/${currentSessionId}/exceptions, dateStr);
    
    // DB SAVE
    const dataToSave = { status: newStatus };
    if(sessionExceptions[dateStr].note) dataToSave.note = sessionExceptions[dateStr].note;

    if(newStatus === "Present") {
        if(isDefaultHoliday(dateStr)) await setDoc(ref, { status: "Present" });
        else await deleteDoc(ref);
        delete sessionExceptions[dateStr]; 
    } else {
        await setDoc(ref, dataToSave);
    }
}

function openNoteInput(dateStr) {
    selectedDateForNote = dateStr;
    const container = document.getElementById("note-input-container");
    const input = document.getElementById("day-note-input");
    const label = document.getElementById("note-date-label");
    
    container.classList.remove("hidden");
    label.innerText = Reason for absence on ${dateStr}:;
    
    if(sessionExceptions[dateStr] && sessionExceptions[dateStr].note) {
        input.value = sessionExceptions[dateStr].note;
    } else {
        input.value = "";
    }
    input.focus();
}

document.getElementById("save-note-btn").onclick = async () => {
    const noteText = document.getElementById("day-note-input").value;
    if(!selectedDateForNote) return;

    if(!sessionExceptions[selectedDateForNote]) sessionExceptions[selectedDateForNote] = { status: "Absent" };
    sessionExceptions[selectedDateForNote].note = noteText;

    const ref = doc(db, users/${currentUser.uid}/sessions/${currentSessionId}/exceptions, selectedDateForNote);
    await setDoc(ref, { 
        status: sessionExceptions[selectedDateForNote].status, 
        note: noteText 
    }, { merge: true });

    document.getElementById("note-input-container").classList.add("hidden");
    renderCalendar(); 
};

// --- HYBRID ATTENDANCE SYSTEM ---
function calculateAttendance() {
    let totalWorkingDays = 0;
    let daysPresent = 0;
    let loopDate = new Date(sessionData.startDate);
    const stopDate = sessionData.endDate ? new Date(sessionData.endDate) : new Date();

    while(loopDate <= stopDate) {
        const dStr = loopDate.toISOString().split('T')[0];
        let status = "Present";
        
        if(sessionExceptions[dStr] && sessionExceptions[dStr].status) {
            status = sessionExceptions[dStr].status;
        } else if(isDefaultHoliday(dStr)) {
            status = "Holiday";
        }

        if(status !== "Holiday") {
            totalWorkingDays++;
            if(status === "Present") daysPresent++;
        }
        loopDate.setDate(loopDate.getDate() + 1);
    }
    
    let percent = 100;
    if(totalWorkingDays > 0) percent = (daysPresent / totalWorkingDays) * 100;
    
    document.getElementById("attendance-percent").innerText = ${percent.toFixed(2)}%;
    updateBunkCalculator(daysPresent, totalWorkingDays, percent, sessionData.target);
}

function updateBunkCalculator(present, total, currentPercent, targetPercent) {
    const oldMsg = document.getElementById("bunk-msg");
    if(oldMsg) oldMsg.remove();
    
    if(targetPercent === 0) return; 

    const parent = document.querySelector(".percentage-box");
    const msgDiv = document.createElement("small");
    msgDiv.id = "bunk-msg";
    msgDiv.style.marginTop = "5px";
    msgDiv.style.fontSize = "0.7em";
    
    const TARGET = targetPercent;

    if (currentPercent >= TARGET) {
        let daysToBunk = Math.floor((present / (TARGET / 100)) - total);
        if (daysToBunk > 0) {
            msgDiv.innerText = ✅ Safe! You can bunk ${daysToBunk} days.;
            msgDiv.style.color = "#0F9D58"; 
        } else {
            msgDiv.innerText = ⚠️ On the edge! Don't miss next class.;
            msgDiv.style.color = "#f39c12"; 
        }
    } else {
        let needed = Math.ceil(((TARGET / 100) * total - present) / (1 - (TARGET / 100)));
        if(needed < 0) needed = 0;
        msgDiv.innerText = 🚨 Danger! Attend next ${needed} days to hit ${TARGET}%.;
        msgDiv.style.color = "#d63031"; 
    }
    parent.appendChild(msgDiv);
}

// --- NAV & ADMIN ---
document.getElementById("prev-month-btn").onclick = () => {
    if(viewDate.getFullYear() === 2026 && viewDate.getMonth() === 0) return;
    viewDate.setMonth(viewDate.getMonth() - 1);
    renderCalendar();
};
document.getElementById("next-month-btn").onclick = () => {
    if(viewDate.getFullYear() === 2027 && viewDate.getMonth() === 11) return;
    viewDate.setMonth(viewDate.getMonth() + 1);
    renderCalendar();
};

document.getElementById("end-session-btn").onclick = () => document.getElementById("end-modal").classList.remove("hidden");
document.getElementById("cancel-end").onclick = () => document.getElementById("end-modal").classList.add("hidden");
document.getElementById("confirm-end").onclick = async () => {
    const date = document.getElementById("end-session-date").value;
    if(!date) return;
    if(new Date(date) < new Date(sessionData.startDate)) return alert("Invalid date");
    await updateDoc(doc(db, users/${currentUser.uid}/sessions, currentSessionId), { endDate: date, status: "Ended" });
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
                list.innerHTML += `
                    <div style="border-bottom:1px solid #eee; padding:8px; display:flex; align-items:center; gap:10px;">
                        <img src="${pic}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
                        <div>
                            <b>${d.name}</b><br><small>${d.email}</small>
                        </div>
                    </div>`;
            });
        };
        document.getElementById("close-admin").onclick = () => document.getElementById("admin-modal").classList.add("hidden");
    }
}
