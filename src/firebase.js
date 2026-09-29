import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// ═════════════════════════════════════════════════════════════════════
// ★ BANADA NEW - 새 Firebase 프로젝트 연결
// ─────────────────────────────────────────────────────────────────────
// 기존 daisy-vip 프로젝트와 완전 분리된 새 Firebase 프로젝트 사용
// .env 파일에 새 Firebase 프로젝트 정보 입력 필요
// ═════════════════════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// 1) Firebase 초기화
const app = initializeApp(firebaseConfig);

// 2) Firestore export
export const db = getFirestore(app);

// 3) Analytics (안전 처리)
export let analytics = null;
isSupported()
  .then((ok) => {
    if (ok) analytics = getAnalytics(app);
  })
  .catch(() => {
    analytics = null;
  });

// ═════════════════════════════════════════════════════════════════════
// ★ Anonymous Authentication - Firestore 보안 규칙용
// ═════════════════════════════════════════════════════════════════════
export const auth = getAuth(app);

// 익명 로그인 완료 대기 Promise
export const authReady = new Promise((resolve) => {
  const unsub = onAuthStateChanged(auth, (user) => {
    if (user) {
      unsub();
      resolve(user);
    }
  });
});

// 앱 시작 시 익명 로그인 자동 시작
signInAnonymously(auth).catch((err) => {
  console.warn("⚠️ 익명 로그인 실패:", err.code);
});