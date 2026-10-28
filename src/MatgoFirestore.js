// ===================================================================
// 🎴 MatgoFirestore v1 - 서버 상태 구독 + 서버 함수 호출
// ===================================================================
// 2인 맞고 (한 테이블에 2명, 1:1 대전)
// 진행 상태는 전부 matgo_tables/{tableId} 문서 하나에서 옴 (양쪽 플레이어가 같은 화면).
// 손패는 각자 본인만 보이도록 myHand 액션으로 받음.
// 모든 호출에 "앱 유저 ID(userId)" 를 실어 보냄 (서버 식별 기준).
// ===================================================================

import { useState, useEffect, useRef } from "react";
import { doc, collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "./firebase";
import { getApp } from "firebase/app";

export const TABLES = [
  { id: "matgo1", name: "맞고 1번방", theme: "jade" },     // 녹색 톤 (화투 느낌)
  { id: "matgo2", name: "맞고 2번방", theme: "amber" },    // 금색 톤
];

export const ENTRY_FEE = 10000;       // 판당 입장료
export const TARGET_SCORE = 7;         // 7점 달성 시 고/스톱
export const MAX_PLAYERS = 2;          // 2인 전용

const functions = getFunctions(getApp(), "asia-northeast3");
const call = httpsCallable(functions, "playMatgoRound");

// ──────────────────────────────────────────────────────────
// 현재 유저 / 서버 시각 동기화
// ──────────────────────────────────────────────────────────
let currentUserId = null;
let currentNickname = "GUEST";
export function setMatgoUser(userId, nickname) {
  currentUserId = userId;
  if (nickname) currentNickname = nickname;
}

let serverOffset = 0;
export const serverNowMs = () => Date.now() + serverOffset;

async function invoke(payload) {
  if (!currentUserId) throw new Error("로그인 정보가 없습니다");
  const sentAt = Date.now();
  const res = await call({ userId: currentUserId, nickname: currentNickname, ...payload });
  const serverNow = res.data && res.data.serverNow;
  if (serverNow) serverOffset = serverNow - (sentAt + Date.now()) / 2;
  return res.data;
}

// ──────────────────────────────────────────────────────────
// 구독 훅: 테이블 하나
// ──────────────────────────────────────────────────────────
const EMPTY_TABLE = (id) => ({
  id,
  currentRound: 1,
  phase: "waiting",
  players: [],
  names: {},
  field: [],
  captured: {},
  handCounts: {},
  pileRemaining: 0,
  currentTurn: null,
  goCount: {},
  shaking: {},
  choosing: null,
  lastAction: null,
  sessionScore: {},
});

export function useMatgoTable(tableId) {
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!tableId) return;
    const unsub = onSnapshot(
      doc(db, "matgo_tables", tableId),
      (snap) => {
        setTable(snap.exists() ? { id: tableId, ...snap.data() } : EMPTY_TABLE(tableId));
        setLoading(false);
      },
      (err) => { console.error("[Matgo] 테이블 구독 에러:", err); setLoading(false); }
    );
    return () => unsub();
  }, [tableId]);
  return { table, loading };
}

// ──────────────────────────────────────────────────────────
// 구독 훅: 로비에서 모든 테이블 상태
// ──────────────────────────────────────────────────────────
export function useAllMatgoTables() {
  const [tables, setTables] = useState({});
  useEffect(() => {
    const unsubs = TABLES.map(({ id }) =>
      onSnapshot(
        doc(db, "matgo_tables", id),
        (snap) => {
          setTables((prev) => ({ ...prev, [id]: snap.exists() ? { id, ...snap.data() } : EMPTY_TABLE(id) }));
        },
        () => {}
      )
    );
    return () => unsubs.forEach((u) => u());
  }, []);
  return tables;
}

// ──────────────────────────────────────────────────────────
// 구독 훅: 테이블 결과 기록 (최근 N개)
// ──────────────────────────────────────────────────────────
export function useMatgoHistory(tableId, maxCount = 20) {
  const [history, setHistory] = useState([]);
  useEffect(() => {
    if (!tableId) return;
    const q = query(
      collection(db, "matgo_history", tableId, "history"),
      orderBy("round", "desc"),
      limit(maxCount)
    );
    const unsub = onSnapshot(
      q,
      (snap) => setHistory(snap.docs.map((d) => d.data()).reverse()),
      () => {}
    );
    return () => unsub();
  }, [tableId, maxCount]);
  return history;
}

// ──────────────────────────────────────────────────────────
// 훅: 내 손패 (서버에서 폴링)
// ──────────────────────────────────────────────────────────
// 손패는 비밀이라 onSnapshot으로 구독할 수 없음.
// 턴이 바뀌거나 라운드가 바뀔 때마다 서버에서 받아옴.
export function useMyHand(tableId, round, phase) {
  const [hand, setHand] = useState([]);
  const [loading, setLoading] = useState(false);
  const prevKey = useRef("");

  useEffect(() => {
    if (!tableId || !round) { setHand([]); return; }
    if (phase === "waiting" || phase === "ended") { setHand([]); return; }

    // 같은 라운드/페이즈면 재요청 안 함 (서버 호출 아끼기)
    const key = `${tableId}:${round}:${phase}`;
    if (prevKey.current === key) return;
    prevKey.current = key;

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await invoke({ tableId, action: "myHand" });
        if (!cancelled) setHand(res.hand || []);
      } catch (e) {
        if (!cancelled) {
          console.error("[Matgo] 내 손패 조회 실패:", e);
          setHand([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [tableId, round, phase]);

  // 수동 새로고침 (턴이 돌아왔을 때 호출)
  const refresh = async () => {
    if (!tableId) return;
    try {
      const res = await invoke({ tableId, action: "myHand" });
      setHand(res.hand || []);
    } catch (e) {
      console.error("[Matgo] 내 손패 새로고침 실패:", e);
    }
  };

  return { hand, loading, refresh };
}

// ──────────────────────────────────────────────────────────
// 하트비트 훅 (일정 주기로 서버에 "살아있음" 신호)
// ──────────────────────────────────────────────────────────
export function useMatgoHeartbeat(tableId, enabled = true, intervalMs = 10000) {
  useEffect(() => {
    if (!tableId || !enabled) return;
    const tick = () => heartbeatMatgo(tableId);
    tick();  // 즉시 1회
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [tableId, enabled, intervalMs]);
}

// ──────────────────────────────────────────────────────────
// 액션 (서버 호출)
// ──────────────────────────────────────────────────────────

// 테이블 입장 (자리 있으면 입장, 가득 차면 실패)
export const joinMatgoTable = (tableId) =>
  invoke({ tableId, action: "join" });

// 하트비트 (주기적으로 호출)
export const heartbeatMatgo = (tableId) =>
  invoke({ tableId, action: "heartbeat" }).catch(() => {});

// 테이블 퇴장
export const leaveMatgoTable = (tableId) =>
  invoke({ tableId, action: "leave" }).catch(() => null);

// 게임 시작 (2명 모이면 자동으로도 시작되지만, 수동으로도 호출 가능)
export const startMatgo = (tableId) =>
  invoke({ tableId, action: "start" });

// 손패에서 카드 1장 내기
export const playMatgoCard = (tableId, cardId) =>
  invoke({ tableId, action: "playCard", cardId });

// 바닥 2장 중 선택 (매칭 2개일 때)
export const chooseMatgoField = (tableId, cardId) =>
  invoke({ tableId, action: "chooseField", cardId });

// 고/스톱 결정 (7점 달성 시)
export const decideMatgoGoStop = (tableId, decision) =>
  invoke({ tableId, action: "goStop", decision });  // "go" | "stop"

// 💣 폭탄: 손패에 같은 월 3장을 한꺼번에 던지기
export const bombMatgo = (tableId, month) =>
  invoke({ tableId, action: "bomb", month });

// 🎲 흔듦: 손패에 같은 월 3장이라고 선언 (완성 시 ×2)
export const shakeMatgo = (tableId, month) =>
  invoke({ tableId, action: "shake", month });

// 내 손패 직접 조회 (useMyHand 훅 쓰는 게 더 편함)
export const fetchMyHand = (tableId) =>
  invoke({ tableId, action: "myHand" });