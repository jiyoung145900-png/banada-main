// ===================================================================
// 🎰 BaccaratFirestore v4 - 서버 상태 구독 + 서버 함수 호출
// ===================================================================
// 진행 상태는 전부 table 문서 하나에서 옴 (모든 플레이어가 같은 화면).
// 모든 호출에 "앱 유저 ID(userId)" 를 실어 보냄 (서버 식별 기준).
// ===================================================================

import { useState, useEffect } from "react";
import { doc, collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "./firebase";
import { getApp } from "firebase/app";

export const TABLES = [
  { id: "table1", name: "Table 1", theme: "ruby" },
  { id: "table2", name: "Table 2", theme: "gold" },
];

export const MIN_BET = 10000;
export const MAX_BET = 100000000; // 1억

const functions = getFunctions(getApp(), "asia-northeast3");
const call = httpsCallable(functions, "playBaccaratRound");

// ──────────────────────────────────────────────────────────
// 현재 유저 / 서버 시각 동기화
// ──────────────────────────────────────────────────────────
let currentUserId = null;
let currentNickname = "GUEST";
export function setBaccaratUser(userId, nickname) {
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
// 구독 훅
// ──────────────────────────────────────────────────────────
const EMPTY_TABLE = (id) => ({ id, currentRound: 1, phase: "betting", players: [], roundBets: {} });

export function useBaccaratTable(tableId) {
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!tableId) return;
    const unsub = onSnapshot(
      doc(db, "baccarat_tables", tableId),
      (snap) => {
        setTable(snap.exists() ? { id: tableId, ...snap.data() } : EMPTY_TABLE(tableId));
        setLoading(false);
      },
      (err) => { console.error("[Baccarat] 테이블 구독 에러:", err); setLoading(false); }
    );
    return () => unsub();
  }, [tableId]);
  return { table, loading };
}

// 이 라운드에 모든 플레이어가 건 베팅
export function useRoundBets(tableId, round) {
  const [bets, setBets] = useState([]);
  useEffect(() => {
    if (!tableId || !round) return;
    const q = query(collection(db, "baccarat_bets"), where("tableId", "==", tableId), where("round", "==", round));
    const unsub = onSnapshot(q, (snap) => setBets(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
    return () => unsub();
  }, [tableId, round]);
  return bets;
}

export function useBaccaratHistory(tableId, maxCount = 80) {
  const [history, setHistory] = useState([]);
  useEffect(() => {
    if (!tableId) return;
    const q = query(collection(db, "baccarat_history", tableId, "history"), orderBy("round", "desc"), limit(maxCount));
    const unsub = onSnapshot(q, (snap) => setHistory(snap.docs.map((d) => d.data()).reverse()), () => {});
    return () => unsub();
  }, [tableId, maxCount]);
  return history;
}

// 로비용: 두 테이블 상태
export function useAllBaccaratTables() {
  const [tables, setTables] = useState({});
  useEffect(() => {
    const unsubs = TABLES.map(({ id }) =>
      onSnapshot(doc(db, "baccarat_tables", id), (snap) => {
        setTables((prev) => ({ ...prev, [id]: snap.exists() ? { id, ...snap.data() } : EMPTY_TABLE(id) }));
      }, () => {})
    );
    return () => unsubs.forEach((u) => u());
  }, []);
  return tables;
}

// 내 베팅 (이번 라운드)
export function useMyBet(userId, tableId, round) {
  const [bet, setBet] = useState(null);
  useEffect(() => {
    if (!userId || !tableId || !round) { setBet(null); return; }
    const id = `${tableId}_${round}_${userId}`.replace(/[\/\s]/g, "_").slice(0, 200);
    const unsub = onSnapshot(doc(db, "baccarat_bets", id), (snap) => setBet(snap.exists() ? snap.data() : null), () => {});
    return () => unsub();
  }, [userId, tableId, round]);
  return bet;
}

// ──────────────────────────────────────────────────────────
// 액션
// ──────────────────────────────────────────────────────────
export const joinBaccaratTable = (tableId) => invoke({ tableId, action: "join" });
export const heartbeatBaccarat = (tableId, engaged = false) => invoke({ tableId, action: "heartbeat", engaged }).catch(() => {});
export const leaveBaccaratTable = (tableId) => invoke({ tableId, action: "leave" }).catch(() => null);

// 베팅 확정/수정 (같은 라운드 재호출 = 덮어쓰기, 서버가 차액만 처리)
export const placeBaccaratBet = ({ tableId, bets }) => invoke({ tableId, action: "bet", bets });

// 시작 요청 (여러 번 호출해도 안전): 조건이 되면 시작, 아니면 { waiting: true }
export const startBaccarat = (tableId) => invoke({ tableId, action: "start" });

// 자리 앉기/옮기기 (빈 자리만, 확정 전에만)
export const sitBaccarat = (tableId, seat) => invoke({ tableId, action: "sit", seat });
// 실시간 칩: 확정 전에 올려둔 칩을 다른 플레이어 화면에 보여줌 (돈은 움직이지 않음)
export const draftBaccarat = (tableId, bets) => invoke({ tableId, action: "draft", bets }).catch(() => null);
// START(준비): 2명 이상이면 모두 눌러야 시작. on=false 면 취소
export const readyBaccarat = (tableId, on = true) => invoke({ tableId, action: "ready", on });
// 재촉: 시작을 막고 있는 플레이어에게 경고
export const nudgeBaccarat = (tableId, target) => invoke({ tableId, action: "nudge", target });

// 카드 한 장 열기 (손으로 충분히 깐 카드를 모두에게 공개). side: "player" | "banker"
export const openBaccarat = (tableId, side, idx) => invoke({ tableId, action: "open", side, idx });
// 내가 깔 수 있는 카드의 실제 앞면 (담당자에게만 내려옴)
export const myCardsBaccarat = (tableId) => invoke({ tableId, action: "myCards" });
export const naturalBaccarat = (tableId) => invoke({ tableId, action: "natural" }).catch(() => null);
// 내가 깔 수 있는 쪽 카드 모두 열기
export const revealMineBaccarat = (tableId) => invoke({ tableId, action: "reveal" });