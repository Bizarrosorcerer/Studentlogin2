// Firebase imports unchanged
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// Config unchanged
const firebaseConfig = {
  apiKey: "AIzaSyDAUrjhba6zQS47RpS4jH0QyvAw3U7dlcw",
  authDomain: "logintester1-e9b27.firebaseapp.com",
  projectId: "logintester1-e9b27"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// DOM references (THIS WAS MISSING)
const displayNameInput = document.getElementById("display-name-input");
const profilePicWrapper = document.getElementById("profile-pic-wrapper");
const profileImg = document.getElementById("profile-img");
const profileUpload = document.getElementById("profile-upload");
const attendancePercent = document.getElementById("attendance-percent");

let currentUser = null;
let sessionExceptions = {};
let sessionData = null;

// AUTH (UNCHANGED FLOW)
onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;
    const snap = await getDoc(doc(db, "users", user.uid));

    if (snap.exists()) {
      loadProfile(snap.data());
      show("dashboard");
      loadSessions();
      checkAdmin();
    } else {
      document.getElementById("first-time-setup").classList.remove("hidden");
    }
  } else {
    show("login");
  }
});

document.getElementById("login-btn").onclick = async () => {
  const name = displayNameInput.value.trim();
  const res = await signInWithPopup(auth, provider);

  if (name) {
    await setDoc(doc(db, "users", res.user.uid), {
      name,
      email: res.user.email,
      photo: null
    });
    location.reload();
  }
};

document.getElementById("logout-btn").onclick = () => signOut(auth);

// PHOTO LOGIC (20MB + remove)
profilePicWrapper.onclick = () => {
  profileUpload.click();
};

profileUpload.onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) return alert("Max image size is 20MB");

  const reader = new FileReader();
  reader.onload = async () => {
    profileImg.src = reader.result;
    await updateDoc(doc(db, "users", currentUser.uid), {
      photo: reader.result
    });
  };
  reader.readAsDataURL(file);
};

// REAL TIME ATTENDANCE (NO BUG FIXED)
function autoUpdateAttendance() {
  if (!sessionData) return;

  let total = 0, present = 0;
  let d = new Date(sessionData.startDate);

  while (d <= new Date()) {
    const ds = d.toISOString().split("T")[0];
    let st = sessionExceptions[ds] || "Present";

    if (st !== "Holiday") {
      total++;
      if (st === "Present") present++;
    }
    d.setDate(d.getDate() + 1);
  }

  attendancePercent.innerText =
    ((present / total) * 100 || 100).toFixed(2) + "%";
}

// SCREEN HANDLER
function show(id) {
  ["login", "dashboard", "session-detail"].forEach(s => {
    document.getElementById(s + "-screen")?.classList.add("hidden");
  });
  document.getElementById(id + "-screen").classList.remove("hidden");
}
