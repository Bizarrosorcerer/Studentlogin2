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

/* ================= SCREENS ================= */
const screens = {
  login: document.getElementById("login-screen"),
  dashboard: document.getElementById("dashboard-screen"),
  detail: document.getElementById("session-detail-screen")
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

/* ================= AUTH ================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null;
    showScreen("login");
    return;
  }

  currentUser = user;

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    loadProfile(snap.data());
    showScreen("dashboard");
    loadSessions();
    checkAdmin();
  } else {
    document.getElementById("first-time-setup").classList.remove("hidden");
  }
});

/* ================= LOGIN ================= */
document.getElementById("login-btn").addEventListener("click", async () => {
  const nameInput = document.getElementById("display-name-input");
  const name = nameInput ? nameInput.value.trim() : "";

  const result = await signInWithPopup(auth, provider);

  if (name) {
    await setDoc(doc(db, "users", result.user.uid), {
      name: name,
      email: result.user.email,
      photo: null
    }, { merge: true });

    location.reload(); // SAFE reload
  }
});

document.getElementById("logout-btn")
  .addEventListener("click", () => signOut(auth));

/* ================= PROFILE ================= */
function loadProfile(data) {
  document.getElementById("user-name").innerHTML =
    `${data.name} <span id="edit-name-btn">✎</span>`;
  document.getElementById("user-email").innerText = data.email;

  const img = document.getElementById("profile-img");
  img.src = data.photo || "https://via.placeholder.com/50";

  document.getElementById("edit-name-btn").onclick = () =>
    document.getElementById("edit-name-modal").classList.remove("hidden");
}

/* ================= PHOTO (20MB + REMOVE) ================= */
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
  if (file.size > 20 * 1024 * 1024) {
    alert("Max photo size is 20MB");
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    document.getElementById("profile-img").src = reader.result;
    await updateDoc(doc(db, "users", currentUser.uid), {
      photo: reader.result
    });
  };
  reader.readAsDataURL(file);
};

/* ================= DASHBOARD ================= */
async function loadSessions() {
  const container = document.getElementById("sessions-container");
  container.innerHTML = "Loading...";

  const q = query(
    collection(db, `users/${currentUser.uid}/sessions`),
    orderBy("startDate", "desc")
  );

  const snap = await getDocs(q);
  container.innerHTML = "";

  snap.forEach(d => {
    const data = d.data();
    const div = document.createElement("div");
    div.className = "session-card";
    div.innerHTML = `
      <h3>${data.name}</h3>
      <p>Started: ${data.startDate}</p>
      <span class="badge ${data.status.toLowerCase()}">${data.status}</span>
    `;
    container.appendChild(div);
  });
}

/* ================= ADMIN ================= */
async function checkAdmin() {
  const snap = await getDoc(doc(db, "users", currentUser.uid));
  if (!snap.exists() || !snap.data().isAdmin) return;

  const link = document.getElementById("admin-link");
  link.classList.remove("hidden");

  link.onclick = async () => {
    document.getElementById("admin-modal").classList.remove("hidden");
    const list = document.getElementById("admin-list");
    list.innerHTML = "Loading...";

    const users = await getDocs(collection(db, "users"));
    list.innerHTML = "";

    users.forEach(u => {
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

  document.getElementById("close-admin").onclick = () =>
    document.getElementById("admin-modal").classList.add("hidden");
  }
