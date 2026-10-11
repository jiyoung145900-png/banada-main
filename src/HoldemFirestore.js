// ===================================================================
// 🔥 HoldemFirestore - 홀덤 테이블 DB 레이어
// ===================================================================
// Firestore 구조:
// 
// holdem_tables/{tableId}
//   - name, maxPlayers, buyIn, smallBlind, bigBlind
//   - status: "waiting" | "playing" | "ended"
//   - players: [{ userId, nickname, chips, cards, bet, folded, allIn, acted, sittingOut }]
//   - communityCards: []
//   - pot, currentBet, currentPlayerIdx, dealerIdx
//   - phase: "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown"
//   - deck: [], history: []
//   - lastActionAt: timestamp
// ===================================================================

import { 
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, onSnapshot, runTransaction, serverTimestamp,
  getDocs, orderBy, limit,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  createShuffledDeck, applyAction, collectBetsToPot, postBlinds,
  isBettingRoundComplete, nextActivePlayerIdx, determineWinners
} from "./HoldemLogic";

const COL = "holdem_tables";

// ───────────────────────────────────────────────────
// 테이블 CRUD
// ───────────────────────────────────────────────────

export async function createTable({ name, maxPlayers = 6, buyIn = 10000, smallBlind = 100, bigBlind = 200, creatorId, creatorNickname }) {
  const tableId = `tbl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const tableData = {
    id: tableId,
    name,
    maxPlayers,
    buyIn,
    smallBlind,
    bigBlind,
    status: "waiting",
    phase: "waiting",
    players: [],
    communityCards: [],
    pot: 0,
    currentBet: 0,
    currentPlayerIdx: -1,
    dealerIdx: -1,
    deck: [],
    history: [],
    createdBy: creatorId,
    createdAt: Date.now(),
    lastActionAt: Date.now(),
  };
  await setDoc(doc(db, COL, tableId), tableData);
  return tableId;
}

export function subscribeTable(tableId, callback) {
  return onSnapshot(doc(db, COL, tableId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
    else callback(null);
  });
}

export function subscribeTableList(callback) {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"), limit(20));
  return onSnapshot(q, (snap) => {
    const tables = [];
    snap.forEach(d => tables.push({ id: d.id, ...d.data() }));
    callback(tables);
  });
}

export async function deleteTable(tableId) {
  await deleteDoc(doc(db, COL, tableId));
}

// ───────────────────────────────────────────────────
// 플레이어 입장/퇴장
// ───────────────────────────────────────────────────

export async function joinTable({ tableId, userId, nickname, buyInAmount }) {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, COL, tableId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("테이블 없음");
    
    const table = snap.data();
    if (table.players.length >= table.maxPlayers) throw new Error("테이블 가득참");
    if (table.players.find(p => p.userId === userId)) throw new Error("이미 입장함");
    
    const newPlayer = {
      userId, nickname,
      chips: buyInAmount,
      cards: [],
      bet: 0,
      folded: false,
      allIn: false,
      acted: false,
      sittingOut: false,
      joinedAt: Date.now(),
    };
    
    tx.update(ref, {
      players: [...table.players, newPlayer],
      lastActionAt: Date.now(),
    });
  });
}

export async function leaveTable({ tableId, userId }) {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, COL, tableId);
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    
    const table = snap.data();
    const players = table.players.filter(p => p.userId !== userId);
    
    // 모두 나가면 테이블 삭제
    if (players.length === 0) {
      tx.delete(ref);
      return;
    }
    
    tx.update(ref, {
      players,
      lastActionAt: Date.now(),
    });
  });
}

// ───────────────────────────────────────────────────
// 게임 시작
// ───────────────────────────────────────────────────

export async function startGame(tableId) {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, COL, tableId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("테이블 없음");
    
    const table = snap.data();
    if (table.players.length < 2) throw new Error("2명 이상 필요");
    
    const deck = createShuffledDeck();
    
    // 플레이어에게 카드 2장씩
    let players = table.players.map(p => ({
      ...p,
      cards: [deck.pop(), deck.pop()],
      bet: 0,
      folded: false,
      allIn: false,
      acted: false,
    }));
    
    // 딜러 포지션 (랜덤 또는 이전 라운드 + 1)
    const dealerIdx = table.dealerIdx === -1 
      ? Math.floor(Math.random() * players.length)
      : (table.dealerIdx + 1) % players.length;
    
    // 블라인드 포스팅
    const { players: afterBlinds } = postBlinds(players, dealerIdx, table.smallBlind, table.bigBlind);
    players = afterBlinds;
    
    // Preflop: BB 다음부터 액션
    const firstActionIdx = (dealerIdx + 3) % players.length;
    
    tx.update(ref, {
      status: "playing",
      phase: "preflop",
      players,
      deck,
      communityCards: [],
      pot: 0,
      currentBet: table.bigBlind,
      currentPlayerIdx: firstActionIdx,
      dealerIdx,
      history: [...(table.history || []), { event: "라운드 시작", at: Date.now() }],
      lastActionAt: Date.now(),
    });
  });
}

// ───────────────────────────────────────────────────
// 플레이어 액션 (fold / check / call / raise / all-in)
// ───────────────────────────────────────────────────

export async function playerAction({ tableId, userId, action, amount = 0 }) {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, COL, tableId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("테이블 없음");
    
    const table = snap.data();
    const playerIdx = table.players.findIndex(p => p.userId === userId);
    if (playerIdx === -1) throw new Error("플레이어 없음");
    if (playerIdx !== table.currentPlayerIdx) throw new Error("당신 차례 아님");
    
    const player = table.players[playerIdx];
    const updated = applyAction(player, action, amount, table.currentBet);
    if (!updated) throw new Error("유효하지 않은 액션");
    
    let players = [...table.players];
    players[playerIdx] = updated;
    
    // 레이즈면 다른 플레이어들 acted = false (재액션 필요)
    if (action === "raise" || action === "all-in") {
      if (updated.bet > table.currentBet) {
        players = players.map((p, i) => 
          i !== playerIdx && !p.folded && !p.allIn 
            ? { ...p, acted: false } 
            : p
        );
      }
    }
    
    const newCurrentBet = Math.max(table.currentBet, updated.bet);
    
    // 라운드 끝났는지
    const roundDone = isBettingRoundComplete(players, newCurrentBet);
    
    const historyEntry = {
      event: `${player.nickname} ${action}${amount > 0 ? ` ${amount}` : ""}`,
      at: Date.now(),
    };
    
    if (roundDone) {
      // 베팅을 팟에 넣고 다음 phase로
      const { players: afterCollect, pot: newPot } = collectBetsToPot(players, table.pot);
      
      // 활성 플레이어 1명만 남으면 바로 쇼다운
      const active = afterCollect.filter(p => !p.folded);
      if (active.length === 1) {
        return finalizeRoundInTransaction(tx, ref, table, afterCollect, newPot, []);
      }
      
      // 다음 phase 진행
      const nextData = advancePhase(table, afterCollect, newPot);
      tx.update(ref, {
        ...nextData,
        history: [...(table.history || []), historyEntry],
        lastActionAt: Date.now(),
      });
    } else {
      // 다음 플레이어로
      const nextIdx = nextActivePlayerIdx(players, playerIdx);
      tx.update(ref, {
        players,
        currentBet: newCurrentBet,
        currentPlayerIdx: nextIdx,
        history: [...(table.history || []), historyEntry],
        lastActionAt: Date.now(),
      });
    }
  });
}

// phase 진행 (preflop → flop → turn → river → showdown)
function advancePhase(table, players, pot) {
  const deck = [...table.deck];
  let communityCards = [...table.communityCards];
  let nextPhase = table.phase;
  
  if (table.phase === "preflop") {
    // Flop: 3장
    deck.pop();  // 번 카드
    communityCards = [deck.pop(), deck.pop(), deck.pop()];
    nextPhase = "flop";
  } else if (table.phase === "flop") {
    deck.pop();
    communityCards.push(deck.pop());
    nextPhase = "turn";
  } else if (table.phase === "turn") {
    deck.pop();
    communityCards.push(deck.pop());
    nextPhase = "river";
  } else if (table.phase === "river") {
    nextPhase = "showdown";
  }
  
  // 액션 재시작: dealer 다음 활성 플레이어부터
  const firstActionIdx = nextActivePlayerIdx(players, table.dealerIdx);
  
  // 올인한 사람만 남으면 바로 쇼다운
  const canAct = players.filter(p => !p.folded && !p.allIn).length;
  if (canAct <= 1 && nextPhase !== "showdown") {
    // 남은 카드 전부 공개 후 쇼다운
    while (communityCards.length < 5) {
      deck.pop();
      communityCards.push(deck.pop());
    }
    nextPhase = "showdown";
  }
  
  if (nextPhase === "showdown") {
    return {
      players,
      pot,
      communityCards,
      deck,
      phase: "showdown",
      currentPlayerIdx: -1,
      currentBet: 0,
      lastActionAt: Date.now(),
    };
  }
  
  return {
    players,
    pot,
    communityCards,
    deck,
    phase: nextPhase,
    currentBet: 0,
    currentPlayerIdx: firstActionIdx,
    lastActionAt: Date.now(),
  };
}

// 라운드 종료 (쇼다운 or 단독 승리)
function finalizeRoundInTransaction(tx, ref, table, players, pot, communityCards) {
  const winners = determineWinners(players, communityCards);
  const share = Math.floor(pot / winners.length);
  
  const updated = players.map(p => {
    const win = winners.find(w => w.player.userId === p.userId);
    if (win) return { ...p, chips: p.chips + share };
    return p;
  });
  
  const winnerNames = winners.map(w => {
    const name = w.player.nickname;
    const handName = w.hand ? ` (${w.hand.name})` : "";
    return `${name}${handName}`;
  }).join(", ");
  
  tx.update(ref, {
    players: updated,
    pot: 0,
    communityCards,
    phase: "showdown",
    status: "waiting",
    currentPlayerIdx: -1,
    currentBet: 0,
    history: [...(table.history || []), { 
      event: `🏆 ${winnerNames} 승리! +${share.toLocaleString()}`, 
      at: Date.now() 
    }],
    lastActionAt: Date.now(),
  });
}

// 쇼다운에서 다음 라운드 준비
export async function nextRound(tableId) {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, COL, tableId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("테이블 없음");
    
    const table = snap.data();
    
    // 칩 0인 플레이어 제거
    const players = table.players.filter(p => p.chips > 0);
    if (players.length < 2) {
      tx.update(ref, {
        status: "ended",
        phase: "ended",
        players,
        lastActionAt: Date.now(),
      });
      return;
    }
    
    tx.update(ref, {
      status: "waiting",
      phase: "waiting",
      players,
      communityCards: [],
      pot: 0,
      currentBet: 0,
      currentPlayerIdx: -1,
      lastActionAt: Date.now(),
    });
  });
}
