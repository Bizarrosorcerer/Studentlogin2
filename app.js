// ========================= PHOTO UPLOAD + REMOVE =========================
document.getElementById("profile-pic-wrapper").onclick = () =>
    document.getElementById("photo-modal").classList.remove("hidden");

document.getElementById("replace-photo").onclick = () => {
    document.getElementById("photo-modal").classList.add("hidden");
    document.getElementById("profile-upload").click();
};

document.getElementById("remove-photo").onclick = async () => {
    document.getElementById("profile-img").src = "https://via.placeholder.com/50";
    await updateDoc(doc(db, "users", currentUser.uid), { photo: null });
    document.getElementById("photo-modal").classList.add("hidden");
};

document.getElementById("cancel-photo").onclick = () =>
    document.getElementById("photo-modal").classList.add("hidden");

document.getElementById("profile-upload").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return alert("Max photo size is 20MB");

    const reader = new FileReader();
    reader.onload = async function (evt) {
        const base64 = evt.target.result;
        document.getElementById("profile-img").src = base64;
        await updateDoc(doc(db, "users", currentUser.uid), { photo: base64 });
    };
    reader.readAsDataURL(file);
};

// ========================= SESSION PANEL UPGRADES =========================
// Back button border + hover
const backBtn = document.getElementById("back-btn");
backBtn.style.border = "1px solid #333";
backBtn.style.padding = "4px 8px";
backBtn.style.borderRadius = "4px";
backBtn.style.cursor = "pointer";
backBtn.onmouseover = () => backBtn.style.background = "#eee";
backBtn.onmouseout = () => backBtn.style.background = "transparent";

// Color badges as squares
function updateCalendarDaySquares() {
    document.querySelectorAll(".day-present, .day-absent, .day-holiday").forEach(d => {
        d.style.borderRadius = "0"; // square
    });
}

// ========================= REAL-TIME ATTENDANCE =========================
function updateAttendance() {
    if (!sessionData) return;
    let total = 0, present = 0;
    const start = new Date(sessionData.startDate);
    const end = sessionData.endDate ? new Date(sessionData.endDate) : new Date();

    let d = new Date(start);
    while (d <= end) {
        const ds = d.toISOString().split("T")[0];
        let status = "Present";
        if (isDefaultHoliday(ds)) status = "Holiday";
        if (sessionExceptions[ds]) status = sessionExceptions[ds];

        if (status !== "Holiday") {
            total++;
            if (status === "Present") present++;
        }
        d.setDate(d.getDate() + 1);
    }
    const percent = total ? ((present / total) * 100).toFixed(2) : "100";
    document.getElementById("attendance-percent").innerText = percent + "%";
}

// Override toggleDay to update attendance in real-time
async function toggleDay(dateStr, currentStatus) {
    if (sessionData.status === "Ended") return alert("Session Ended. Cannot edit.");
    
    let newStatus = currentStatus === "Present" ? "Absent" :
                    currentStatus === "Absent" ? "Holiday" : "Present";

    sessionExceptions[dateStr] = newStatus;
    renderCalendar();
    updateCalendarDaySquares();   // Make badges square
    updateAttendance();           // Update attendance in real-time

    const ref = doc(db, `users/${currentUser.uid}/sessions/${currentSessionId}/exceptions`, dateStr);
    if (newStatus === "Present") {
        if (isDefaultHoliday(dateStr)) await setDoc(ref, { status: "Present" });
        else await deleteDoc(ref);
    } else {
        await setDoc(ref, { status: newStatus });
    }
}

// ========================= ADMIN PANEL PHOTO =========================
async function checkAdmin() {
    const docSnap = await getDoc(doc(db, "users", currentUser.uid));
    if (docSnap.exists() && docSnap.data().isAdmin) {
        const link = document.getElementById("admin-link");
        link.classList.remove("hidden");
        link.onclick = async () => {
            document.getElementById("admin-modal").classList.remove("hidden");
            const list = document.getElementById("admin-list");
            list.innerHTML = "Loading...";
            const allUsers = await getDocs(collection(db, "users"));
            list.innerHTML = "";
            allUsers.forEach(u => {
                const d = u.data();
                list.innerHTML += `
                    <div style="display:flex;gap:10px;align-items:center;border-bottom:1px solid #eee;padding:6px;">
                        <img src="${d.photo || "https://via.placeholder.com/40"}" width="40" height="40" style="border-radius:50%">
                        <div>
                            <b>${d.name}</b><br>
                            <small>${d.email}</small>
                        </div>
                    </div>
                `;
            });
        };
        document.getElementById("close-admin").onclick = () => document.getElementById("admin-modal").classList.add("hidden");
    }
      }
