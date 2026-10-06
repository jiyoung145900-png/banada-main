// =========================================================================
// 고객 로그인 서버 함수
// -------------------------------------------------------------------------
// - 비밀번호 비교를 서버에서 수행 (브라우저에 비밀번호 노출 방지)
// - Firestore 규칙과 무관하게 Admin SDK로 users 접근
// - 성공 시 해당 유저의 공개 정보만 반환 (password 제외)
// - 로그인 시도 제한: IP당 10분 내 10회
// =========================================================================

import { adminDb } from "./_firebase-admin.js";

// 간단한 메모리 기반 Rate Limit (Vercel 서버 재시작 시 초기화)
const attempts = new Map();
const MAX_ATTEMPTS = 10;
const LOCKOUT_MS = 10 * 60 * 1000;

function isLockedOut(ip) {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.lastAt > LOCKOUT_MS) {
    attempts.delete(ip);
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

function recordAttempt(ip, success) {
  if (success) { attempts.delete(ip); return; }
  const rec = attempts.get(ip) || { count: 0, lastAt: 0 };
  rec.count += 1;
  rec.lastAt = Date.now();
  attempts.set(ip, rec);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 허용됩니다" });
  }

  try {
    const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";

    if (isLockedOut(ip)) {
      return res.status(429).json({ 
        error: "로그인 시도가 너무 많습니다. 10분 후 다시 시도하세요." 
      });
    }

    const { id, pw } = req.body || {};

    if (!id || !pw) {
      return res.status(400).json({ error: "아이디와 비밀번호를 입력하세요" });
    }

    // Firestore에서 유저 조회
    const userRef = adminDb.collection("users").doc(id);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      recordAttempt(ip, false);
      return res.status(401).json({ error: "존재하지 않는 아이디입니다" });
    }

    const userData = userSnap.data();
    const storedPw = userData.password || userData.pw;

    if (storedPw !== pw) {
      recordAttempt(ip, false);
      return res.status(401).json({ error: "비밀번호가 일치하지 않습니다" });
    }

    // 로그인 성공 - 비밀번호 빼고 유저 정보 반환
    recordAttempt(ip, true);
    const { password, pw: _pw, ...publicData } = userData;

    return res.status(200).json({
      success: true,
      user: { id, ...publicData },
    });

  } catch (e) {
    console.error("login error:", e);
    return res.status(500).json({ error: "로그인 처리 중 오류: " + e.message });
  }
}