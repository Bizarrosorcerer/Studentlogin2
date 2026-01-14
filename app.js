// Firebase imports unchanged
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

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

let currentUser = null;
let sessionExceptions = {};
let sessionData = null;

// AUTH (UNCHANGED FLOW)
onAuthStateChanged(auth, async user => {
  if(user){
    currentUser = user;
    const snap = await getDoc(doc(db,"users",user.uid));
    if(snap.exists()){
      loadProfile(snap.data());
      show("dashboard");
      loadSessions();
      checkAdmin();
    } else {
      document.getElementById("first-time-setup").classList.remove("hidden");
    }
  } else show("login");
});

document.getElementById("login-btn").onclick = async ()=>{
  const name = display-name-input.value;
  const res = await signInWithPopup(auth,provider);
  if(name){
    await setDoc(doc(db,"users",res.user.uid),{
      name,email:res.user.email,photo:null
    });
    location.reload();
  }
};

document.getElementById("logout-btn").onclick = ()=>signOut(auth);

// PHOTO LOGIC (20MB + remove)
profile-pic-wrapper.onclick = ()=>photo-modal.classList.remove("hidden");

replace-photo.onclick = ()=>{ photo-modal.classList.add("hidden"); profile-upload.click(); };
remove-photo.onclick = async ()=>{
  profile-img.src="https://via.placeholder.com/50";
  await updateDoc(doc(db,"users",currentUser.uid),{photo:null});
  photo-modal.classList.add("hidden");
};
cancel-photo.onclick = ()=>photo-modal.classList.add("hidden");

profile-upload.onchange = async e=>{
  const file=e.target.files[0];
  if(!file||file.size>20*1024*1024) return alert("Max 20MB");
  const r=new FileReader();
  r.onload=async ()=>{
    profile-img.src=r.result;
    await updateDoc(doc(db,"users",currentUser.uid),{photo:r.result});
  };
  r.readAsDataURL(file);
};

// REAL TIME ATTENDANCE
function autoUpdateAttendance(){
  if(!sessionData) return;
  let total=0,present=0;
  let d=new Date(sessionData.startDate);
  while(d<=new Date()){
    const ds=d.toISOString().split("T")[0];
    let st=sessionExceptions[ds]||"Present";
    if(st!=="Holiday"){ total++; if(st==="Present")present++; }
    d.setDate(d.getDate()+1);
  }
  attendance-percent.innerText=((present/total)*100||100).toFixed(2)+"%";
}

function show(id){
  ["login","dashboard","session-detail"].forEach(s=>{
    document.getElementById(s+"-screen")?.classList.add("hidden");
  });
  document.getElementById(id+"-screen").classList.remove("hidden");
}
