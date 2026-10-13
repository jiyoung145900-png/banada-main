// ===================================================================
// 🎰 BaccaratFirestore - Firestore 실시간 통신 레이어
// ===================================================================
// 책임:
//   - 테이블 상태 실시간 구독
//   - 베팅 저장 (Firestore)
//   - Cloud Function 호출 (playBaccaratRound)
//   - 과거 결과 히스토리 조회
// ===================================================================

import { useState, useEffect } from "react";
import { 
  doc, 
  collection,
  query, 
  where, 
  orderBy, 
  limit,
  addDoc,
  onSnapshot,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "./firebase";
import { getApp } from "firebase/app";

export const TABLES = [
  { id: "table1", name: "Table 1", theme: "ruby" },
  { id: "table2", name: "Table 2", theme: "gold" },
];

export const MIN_BET = 10000;    // 10K
export const MAX_BET = 1000000;  // 1M

// Cloud Function 호출 setup (asia-northeast3)
const functions = getFunctions(getApp(), "asia-northeast3");
const callPlayBaccarat = httpsCallable(functions, "playBaccaratRound");

// ──────────────────────────────────────────────────────────
// 🎯 Hook: 테이블 상태 실시간 구독
// ──────────────────────────────────────────────────────────

export function useBaccaratTable(tableId) {
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tableId) return;
    const tableRef = doc(db, "baccarat_tables", tableId);
    
    const unsub = onSnapshot(tableRef, (snap) => {
      if (snap.exists()) {
        setTable({ id: tableId, ...snap.data() });
      } else {
        // 테이블 처음 생성 전 상태
        setTable({
          id: tableId,
          currentRound: 1,
          players: [],
          readyPlayers: [],
          phase: "waiting",
        });
      }
      setLoading(false);
    }, (err) => {
      console.error("[BaccaratFirestore] 테이블 구독 에러:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [tableId]);

  return { table, loading };
}

// ──────────────────────────────────────────────────────────
// 🎯 Hook: 모든 테이블 상태 (로비용)
// ──────────────────────────────────────────────────────────

export function useAllBaccaratTables() {
  const [tables, setTables] = useState({});

  useEffect(() => {
    const unsubs = TABLES.map(({ id }) => {
      const tableRef = doc(db, "baccarat_tables", id);
      return onSnapshot(tableRef, (snap) => {
        setTables(prev => ({
          ...prev,
          [id]: snap.exists() 
            ? { id, ...snap.data() } 
            : { id, currentRound: 1, players: [], readyPlayers: [], phase: "waiting" }
        }));
      });
    });

    return () => unsubs.forEach(u => u());
  }, []);

  return tables;
}

// ──────────────────────────────────────────────────────────
// 🎯 Hook: 과거 결과 (로드맵용)
// ──────────────────────────────────────────────────────────

export function useBaccaratHistory(tableId, maxCount = 80) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!tableId) return;
    const historyRef = collection(db, "baccarat_history", tableId, "history");
    const q = query(historyRef, orderBy("round", "desc"), limit(maxCount));
    
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs
        .map(d => d.data())
        .reverse(); // 오래된 → 최신
      setHistory(rows);
    }, (err) => {
      console.error("[BaccaratFirestore] 히스토리 구독 에러:", err);
    });

    return () => unsub();
  }, [tableId, maxCount]);

  return history;
}

// ──────────────────────────────────────────────────────────
// 🎯 Hook: 내 베팅 결과 구독 (정산 완료 알림)
// ──────────────────────────────────────────────────────────

export function useMyLatestBet(userId, tableId, round) {
  const [bet, setBet] = useState(null);

  useEffect(() => {
    if (!userId || !tableId || !round) return;
    
    const betsRef = collection(db, "baccarat_bets");
    const q = query(
      betsRef,
      where("userId", "==", userId),
      where("tableId", "==", tableId),
      where("round", "==", round)
    );
    
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setBet(snap.docs[0].data());
      } else {
        setBet(null);
      }
    });

    return () => unsub();
  }, [userId, tableId, round]);

  return bet;
}

// ──────────────────────────────────────────────────────────
// 💰 베팅 저장 (유저 → Firestore)
// ──────────────────────────────────────────────────────────

export async function placeBaccaratBet({
  userId,
  nickname,
  tableId,
  round,
  bets,
  totalBet,
  balanceBeforeBet,
}) {
  if (!userId) throw new Error("userId 필요");
  if (totalBet <= 0) throw new Error("베팅 금액 없음");
  if (totalBet < MIN_BET) throw new Error(`최소 베팅: ${MIN_BET.toLocaleString()}`);
  if (totalBet > MAX_BET) throw new Error(`최대 베팅: ${MAX_BET.toLocaleString()}`);

  const betData = {
    userId,
    nickname: nickname || "GUEST",
    tableId,
    round,
    bets,            // { player, banker, tie, playerPair, bankerPair, perfectPair }
    totalBet,
    balanceBeforeBet: balanceBeforeBet || 0,
    settled: false,
    payout: 0,
    net: 0,
    timestamp: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, "baccarat_bets"), betData);
  console.log(`[BaccaratFirestore] 베팅 저장: ${docRef.id}`, bets);
  return docRef.id;
}

// ──────────────────────────────────────────────────────────
// 🚪 테이블 입장 (Cloud Function)
// ──────────────────────────────────────────────────────────

export async function joinBaccaratTable(tableId) {
  try {
    const result = await callPlayBaccarat({ tableId, action: "join" });
    console.log("[BaccaratFirestore] 입장 성공:", result.data);
    return result.data;
  } catch (err) {
    console.error("[BaccaratFirestore] 입장 실패:", err);
    throw err;
  }
}

// ──────────────────────────────────────────────────────────
// 🚪 테이블 나가기 (Cloud Function)
// ──────────────────────────────────────────────────────────

export async function leaveBaccaratTable(tableId) {
  try {
    const result = await callPlayBaccarat({ tableId, action: "leave" });
    console.log("[BaccaratFirestore] 퇴장 성공:", result.data);
    return result.data;
  } catch (err) {
    console.error("[BaccaratFirestore] 퇴장 실패:", err);
    // 나가기 실패해도 조용히 넘어감 (앱 종료 등)
    return null;
  }
}

// ──────────────────────────────────────────────────────────
// ✅ READY 보내기 (Cloud Function)
// 혼자면 즉시 결과, 2명+면 다 READY 되면 결과
// ──────────────────────────────────────────────────────────

export async function sendReady(tableId) {
  try {
    const result = await callPlayBaccarat({ tableId, action: "ready" });
    console.log("[BaccaratFirestore] READY 전송:", result.data);
    return result.data;
  } catch (err) {
    console.error("[BaccaratFirestore] READY 실패:", err);
    throw err;
  }
}

// ──────────────────────────────────────────────────────────
// 📊 결과 조회 (히스토리에서 특정 라운드)
// ──────────────────────────────────────────────────────────

export async function getRoundResult(tableId, round) {
  try {
    const historyRef = doc(db, "baccarat_history", tableId, "history", String(round));
    const snap = await getDocs(query(
      collection(db, "baccarat_history", tableId, "history"),
      where("round", "==", round),
      limit(1)
    ));
    if (!snap.empty) {
      return snap.docs[0].data();
    }
    return null;
  } catch (err) {
    console.error("[BaccaratFirestore] 결과 조회 실패:", err);
    return null;
  }
}
