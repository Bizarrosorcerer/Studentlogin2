/* ================= FIREBASE IMPORTS ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

/* ================= CONFIG ================= */
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

/* ================= STATE ================= */
let currentUser = null;
let currentSessionId = null;
let sessionExceptions = {};
let sessionData = null;
let viewDate = new Date();

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

function showScreen(id) {
    Object.values(screens).forEach(s => s.classList.add("hidden"));
    screens[id].classList.remove("hidden");
}

/* ================= AUTH ================= */
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        currentUser = null;
        showScreen('login');
        document.getElementById("first-time-setup").classList.add("hidden");
        return;
    }

    currentUser = user;

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists() && snap.data().name) {
        loadProfile(snap.data());
        showScreen('dashboard');
        loadSessions();
        checkAdmin();
    } else {
        // First-time setup: show name input
        document.getElementById("first-time-setup").classList.remove("hidden");
        showScreen('login');
    }
});

/* ================= LOGIN BUTTON ================= */
document.getElementById("login-btn").addEventListener("click", async () => {
    try {
        // Sign in only if not already logged in
        if (!currentUser) {
            const result = await signInWithPopup(auth, provider);
            currentUser = result.user;
        }

        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        // First-time setup: require name
        if (!userSnap.exists() || !userSnap.data().name) {
            const nameInput = document.getElementById("display-name-input").value.trim();
            if (!nameInput) return alert("Please enter your name to continue!");
            
            await setDoc(userRef, {
                name: nameInput,
                email: currentUser.email,
                photo: null
            }, { merge: true });

            loadProfile({ name: nameInput, email: currentUser.email, photo: null });
        }

        showScreen('dashboard');
        loadSessions();
        checkAdmin();

    } catch (err) {
        console.error("Login error:", err);
        alert("Failed to sign in. Try again.");
    }
});

document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));

/* ================= PROFILE ================= */
function loadProfile(data) {
    document.getElementById("user-name").innerHTML = `${data.name} <span id="edit-name-btn">✎</span>`;
    document.getElementById("user-email").innerText = data.email;
    document.getElementById("profile-img").src = data.photo || "https://via.placeholder.com/50";

    document.getElementById("edit-name-btn").onclick = () =>
        document.getElementById("edit-name-modal").classList.remove("hidden");
}

// Save/Edit Name
document.getElementById("save-name-btn").onclick = async () => {
    const newName = document.getElementById("edit-name-input").value.trim();
    if (!newName) return;
    await updateDoc(doc(db, "users", currentUser.uid), { name: newName });
    document.getElementById("user-name").innerHTML = `${newName} <span id="edit-name-btn">✎</span>`;
    document.getElementById("edit-name-modal").classList.add("hidden");
};
document.getElementById("cancel-edit-name").onclick = () =>
    document.getElementById("edit-name-modal").classList.add("hidden");

/* ================= PROFILE PHOTO ================= */
// Click wrapper to open file picker
document.getElementById("profile-pic-wrapper").onclick = () =>
    document.getElementById("photo-modal").classList.remove("hidden");

// Replace photo
document.getElementById("replace-photo").onclick = () => {
    document.getElementById("photo-modal").classList.add("hidden");
    document.getElementById("profile-upload").click();
};

// Remove photo
document.getElementById("remove-photo").onclick = async () => {
    document.getElementById("profile-img").src = "https://via.placeholder.com/50";
    await updateDoc(doc(db, "users", currentUser.uid), { photo: null });
    document.getElementById("photo-modal").classList.add("hidden");
};

// Cancel modal
document.getElementById("cancel-photo").onclick = () =>
    document.getElementById("photo-modal").classList.add("hidden");

// Upload photo (20MB limit)
document.getElementById("profile-upload").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return alert("Max photo size is 20MB");

    const reader = new FileReader();
    reader.onload = async (evt) => {
        document.getElementById("profile-img").src = evt.target.result;
        await updateDoc(doc(db, "users", currentUser.uid), { photo: evt.target.result });
    };
    reader.readAsDataURL(file);
};

/* ================= DASHBOARD ================= */
async function loadSessions() {
    const container = document.getElementById("sessions-container");
    container.innerHTML = "<p>Loading...</p>";

    const q = query(collection(db, `users/${currentUser.uid}/sessions`), orderBy("startDate", "desc"));
    const snap = await getDocs(q);

    container.innerHTML = "";
    snap.forEach(docSnap => {
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

document.getElementById("add-session-fab").onclick = () =>
    document.getElementById("create-modal").classList.remove("hidden");
document.getElementById("cancel-create").onclick = () =>
    document.getElementById("create-modal").classList.add("hidden");

document.getElementById("confirm-create").onclick = async () => {
    const name = document.getElementById("new-session-name").value;
    const date = document.getElementById("new-session-date").value;

    if (!name || !date) return alert("Fill all fields");
    if (new Date(date) > new Date()) return alert("Cannot start in future");
    if (new Date(date) < new Date("2026-01-01")) return alert("Cannot start before 2026");

    await addDoc(collection(db, `users/${currentUser.uid}/sessions`), {
        name: name,
        startDate: date,
        endDate: null,
        status: "Ongoing"
    });

    document.getElementById("create-modal").classList.add("hidden");
    loadSessions();
};

/* ================= SESSION DETAIL ================= */
async function openSession(sessId, data) {
    currentSessionId = sessId;
    sessionData = data;
    sessionExceptions = {};

    document.getElementById("detail-title").innerText = data.name;
    document.getElementById("detail-dates").innerText = `${data.startDate} — ${data.status === 'Ended' ? data.endDate : 'Ongoing'}`;
    document.getElementById("attendance-percent").innerText = "--%";

    if (data.status === "Ended") document.getElementById("end-session-btn").classList.add("hidden");
    else document.getElementById("end-session-btn").classList.remove("hidden");

    const snap = await getDocs(collection(db, `users/${currentUser.uid}/sessions/${sessId}/exceptions`));
    snap.forEach(d => sessionExceptions[d.id] = d.data().status);

    viewDate = new Date();
    renderCalendar();

    showScreen('detail');
}

// BACK BUTTON
document.getElementById("back-btn").onclick = () => showScreen('dashboard');

/* ================= CALENDAR ================= */
function renderCalendar() {
    const grid = document.getElementById("calendar-days");
    grid.innerHTML = "";

    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    document.getElementById("calendar-month-year").innerText = `${monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth()+1, 0).getDate();

    // Empty slots
    for(let i=0;i<firstDay;i++) grid.appendChild(document.createElement("div"));

    for(let i=1;i<=daysInMonth;i++){
        const div = document.createElement("div");
        div.className = "day-box";
        div.innerText = i;

        const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth()+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const currentObj = new Date(dateStr);
        const startObj = new Date(sessionData.startDate);
        const endObj = sessionData.endDate ? new Date(sessionData.endDate) : new Date();
        const today = new Date();

        if(currentObj < startObj || (sessionData.status==='Ongoing' && currentObj>today) || (sessionData.status==='Ended' && currentObj>endObj)) {
            div.classList.add("day-future");
        } else {
            let status = "Present";
            if(isDefaultHoliday(dateStr)) status = "Holiday";
            if(sessionExceptions[dateStr]) status = sessionExceptions[dateStr];

            div.classList.add(`day-${status.toLowerCase()}`);
            div.onclick = () => toggleDay(dateStr, status);
        }

        if(dateStr===sessionData.startDate) div.classList.add("start-date-marker");
        if(sessionData.status==='Ended' && dateStr===sessionData.endDate) div.classList.add("end-date-marker");

        grid.appendChild(div);
    }
}

function isDefaultHoliday(dateStr){
    const d=new Date(dateStr);
    if(d.getDay()===0) return true;
    for(let h of fixedHolidays){
        if(dateStr.endsWith(h) || dateStr===h) return true;
    }
    return false;
}

async function toggleDay(dateStr, currentStatus){
    if(sessionData.status==="Ended") return alert("Session Ended");

    let newStatus="Present";
    if(currentStatus==="Present") newStatus="Absent";
    else if(currentStatus==="Absent") newStatus="Holiday";
    else if(currentStatus==="Holiday") newStatus="Present";

    sessionExceptions[dateStr]=newStatus;
    renderCalendar();

    const ref=doc(db, `users/${currentUser.uid}/sessions/${currentSessionId}/exceptions`, dateStr);
    if(newStatus==="Present"){
        if(isDefaultHoliday(dateStr)) await setDoc(ref,{status:"Present"});
        else await deleteDoc(ref);
    } else await setDoc(ref,{status:newStatus});

    // Real-time attendance update
    updateAttendancePercent();
}

/* ================= ATTENDANCE CALCULATION ================= */
function updateAttendancePercent(){
    if(!sessionData) return;

    let total=0, present=0;
    let loopDate=new Date(sessionData.startDate);
    const stopDate=sessionData.endDate ? new Date(sessionData.endDate) : new Date();

    while(loopDate<=stopDate){
        const dStr=loopDate.toISOString().split('T')[0];
        let status="Present";
        if(isDefaultHoliday(dStr)) status="Holiday";
        if(sessionExceptions[dStr]) status=sessionExceptions[dStr];

        if(status!=="Holiday"){ total++; if(status==="Present") present++; }
        loopDate.setDate(loopDate.getDate()+1);
    }

    const percent = total ? (present/total)*100 : 100;
    document.getElementById("attendance-percent").innerText = percent.toFixed(2)+"%";
}

document.getElementById("check-btn").onclick = () => updateAttendancePercent();

/* ================= END SESSION ================= */
document.getElementById("end-session-btn").onclick = () => document.getElementById("end-modal").classList.remove("hidden");
document.getElementById("cancel-end").onclick = () => document.getElementById("end-modal").classList.add("hidden");
document.getElementById("confirm-end").onclick = async () => {
    const date = document.getElementById("end-session-date").value;
    if(!date) return;
    if(new Date(date)<new Date(sessionData.startDate)) return alert("Invalid date");
    await updateDoc(doc(db, `users/${currentUser.uid}/sessions`, currentSessionId), { endDate: date, status: "Ended" });
    document.getElementById("end-modal").classList.add("hidden");
    loadSessions();
    showScreen('dashboard');
};

/* ================= MONTH NAVIGATION ================= */
document.getElementById("prev-month-btn").onclick = () => { viewDate.setMonth(viewDate.getMonth()-1); renderCalendar(); };
document.getElementById("next-month-btn").onclick = () => { viewDate.setMonth(viewDate.getMonth()+1); renderCalendar(); };

/* ================= ADMIN ================= */
async function checkAdmin(){
    const docSnap=await getDoc(doc(db,"users",currentUser.uid));
    if(docSnap.exists() && docSnap.data().isAdmin){
        const link=document.getElementById("admin-link");
        link.classList.remove("hidden");
        link.onclick=async ()=>{
            document.getElementById("admin-modal").classList.remove("hidden");
            const list=document.getElementById("admin-list");
            list.innerHTML="Loading...";
            const allUsers=await getDocs(collection(db,"users"));
            list.innerHTML="";
            allUsers.forEach(u=>{
                const d=u.data();
                list.innerHTML+=`
                <div style="display:flex;align-items:center;gap:10px;padding:5px;border-bottom:1px solid #eee;">
                    <img src="${d.photo||'https://via.placeholder.com/40'}" width="40" height="40" style="border-radius:50%">
                    <div>
                        <b>${d.name}</b><br>
                        <small>${d.email}</small>
                    </div>
                </div>
                `;
            });
        };
        document.getElementById("close-admin").onclick=()=>document.getElementById("admin-modal").classList.add("hidden");
    }
                                                                    }
