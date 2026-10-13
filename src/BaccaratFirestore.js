// ===================================================================
// 🎰 BaccaratFirestore v3 - 서버 상태 구독 + 서버 함수 호출
// ===================================================================
// 진행 상태는 전부 table 문서 하나에서 옴 (모든 플레이어가 같은 화면).
// 서버 시각과의 차이(offset)를 맞춰서 같은 타이밍에 연출.
// ===================================================================

import { useState, useEffect, useRef } from "react";
import {
  doc, collection, query, where, orderBy, limit, onSnapshot,
} from "firebase/firestore";
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
// 서버 시각 동기화: 응답의 serverNow 와 내 시계 차이를 보관
// ──────────────────────────────────────────────────────────
let serverOffset = 0;
function syncClock(serverNow, sentAt, recvAt) {
  if (!serverNow) return;
  const mid = (sentAt + recvAt) / 2;
  serverOffset = serverNow - mid;
}
export const serverNowMs = () => Date.now() + serverOffset;

async function invoke(payload) {
  const sentAt = Date.now();
  const res = await call(payload);
  syncClock(res.data && res.data.serverNow, sentAt, Date.now());
  return res.data;
}

// ──────────────────────────────────────────────────────────
// 구독 훅
// ──────────────────────────────────────────────────────────
export function useBaccaratTable(tableId) {
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!tableId) return;
    const unsub = onSnapshot(
      doc(db, "baccarat_tables", tableId),
      (snap) => {
        setTable(snap.exists() ? { id: tableId, ...snap.data() } : { id: tableId, currentRound: 1, phase: "betting", players: [], roundBets: {} });
        setLoading(false);
      },
      (err) => { console.error("[Baccarat] 테이블 구독 에러:", err); setLoading(false); }
    );
    return () => unsub();
  }, [tableId]);
  return { table, loading };
}

// 이 라운드에 모든 플레이어가 건 베팅 (칩 위치 공유용)
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
        setTables((prev) => ({ ...prev, [id]: snap.exists() ? { id, ...snap.data() } : { id, currentRound: 1, phase: "betting", players: [], roundBets: {} } }));
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
export const joinBaccaratTable = (tableId, nickname) => invoke({ tableId, action: "join", nickname });
export const heartbeatBaccarat = (tableId) => invoke({ tableId, action: "heartbeat" }).catch(() => {});
export const leaveBaccaratTable = (tableId) => invoke({ tableId, action: "leave" }).catch(() => null);

// 베팅 확정/수정 (같은 라운드 재호출 = 덮어쓰기, 서버가 차액만 처리)
export const placeBaccaratBet = ({ userId, nickname, tableId, bets }) =>
  invoke({ tableId, action: "bet", userId, nickname, bets });

export const dealBaccarat = (tableId) => invoke({ tableId, action: "deal" });
export const peekBaccarat = (tableId, side, idx) => invoke({ tableId, action: "peek", side, idx });
export const naturalBaccarat = (tableId) => invoke({ tableId, action: "natural" }).catch(() => null);
export const revealAllBaccarat = (tableId) => invoke({ tableId, action: "reveal" });
// 자기 쪽(소유자) 카드 전체 공개: side = "player" | "banker"
export const revealSideBaccarat = (tableId, side) => invoke({ tableId, action: "reveal", side });