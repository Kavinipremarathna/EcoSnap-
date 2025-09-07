import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, increment,
  collection, query, orderBy, limit, getDocs
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export async function ensureAnonUser() {
  await signInAnonymously(auth);
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (u) => {
      if (u) {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) await setDoc(ref, { points: 0, totalCO2: 0 });
        resolve(u);
      }
    });
  });
}

export async function addPoints(uid, points = 10, co2 = 0.02) {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { points: increment(points), totalCO2: increment(co2) });
}

export async function topUsers() {
  const q = query(collection(db, "users"), orderBy("points", "desc"), limit(10));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
