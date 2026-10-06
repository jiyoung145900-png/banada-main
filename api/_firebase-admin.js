// =========================================================================
// Firebase Admin SDK 공용 초기화 모듈
// -------------------------------------------------------------------------
// 모든 서버 함수가 이 파일을 import해서 Firestore에 접근합니다.
// 환경변수:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY (줄바꿈이 \n으로 저장되어 있어 복원 필요)
// =========================================================================

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Vercel의 서버 함수는 호출마다 재사용될 수 있으므로 중복 초기화 방지
function getAdminApp() {
  const apps = getApps();
  if (apps.length > 0) return apps[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Vercel에 저장할 때 \n이 문자열로 저장돼서 실제 줄바꿈으로 복원
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin 환경변수가 설정되지 않았습니다");
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export const adminDb = getFirestore(getAdminApp());