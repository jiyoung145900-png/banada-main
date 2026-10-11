// ===================================================================
// ♠ HoldemLogic - Texas Hold'em 핵심 로직
// ===================================================================
// - 덱 생성 / 셔플
// - 핸드 평가 (10단계 족보)
// - 베팅 액션 처리 (Fold / Check / Call / Raise)
// - 라운드/페이즈 관리
// - 승자 결정
// ===================================================================

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RANK_VALUES = {"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14};

// ───────────────────────────────────────────────────
// 덱 생성 & 셔플
// ───────────────────────────────────────────────────
export function createShuffledDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ suit: s, rank: r });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ───────────────────────────────────────────────────
// 핸드 평가 (7장 중 최고 5장 → 족보)
// ───────────────────────────────────────────────────
// 반환: { rank: 0~9, name: "로열플러시"..., values: [높은값 순 배열] }
// rank 높을수록 센 핸드, 같으면 values 로 비교
// ───────────────────────────────────────────────────
const HAND_NAMES = [
  "하이카드",       // 0
  "원페어",         // 1
  "투페어",         // 2
  "트리플",         // 3
  "스트레이트",     // 4
  "플러시",         // 5
  "풀하우스",       // 6
  "포카드",         // 7
  "스트레이트플러시", // 8
  "로열플러시",     // 9
];

export function evaluateHand(cards) {
  if (!cards || cards.length < 5) return { rank: 0, name: "불완전", values: [] };
  
  // 7장이면 C(7,5)=21 조합 중 최고
  // 효율적 평가: 모든 조합 안 돌리고 바로 평가
  
  const values = cards.map(c => RANK_VALUES[c.rank]).sort((a,b) => b-a);
  const suits = cards.map(c => c.suit);
  
  // 랭크별 카운트
  const rankCount = {};
  for (const v of values) rankCount[v] = (rankCount[v]||0) + 1;
  // 수트별 카운트
  const suitCount = {};
  for (const s of suits) suitCount[s] = (suitCount[s]||0) + 1;
  
  const counts = Object.values(rankCount).sort((a,b) => b-a);  // [4,2,1] 같은 것
  const uniqueValues = [...new Set(values)].sort((a,b) => b-a);
  
  // 플러시 체크 (같은 수트 5장 이상)
  let flushSuit = null;
  for (const s in suitCount) if (suitCount[s] >= 5) flushSuit = s;
  
  // 스트레이트 체크
  function findStraight(vals) {
    // vals 는 내림차순
    for (let i = 0; i <= vals.length - 5; i++) {
      let ok = true;
      for (let j = 0; j < 4; j++) {
        if (vals[i+j] - 1 !== vals[i+j+1]) { ok = false; break; }
      }
      if (ok) return vals[i];  // 최고값 반환
    }
    // A-2-3-4-5 (휠 스트레이트)
    if (vals.includes(14) && vals.includes(5) && vals.includes(4) && vals.includes(3) && vals.includes(2)) {
      return 5;
    }
    return null;
  }
  const straightHigh = findStraight(uniqueValues);
  
  // 스트레이트 플러시 (플러시 수트의 카드만으로 스트레이트)
  let straightFlushHigh = null;
  if (flushSuit) {
    const flushCards = cards.filter(c => c.suit === flushSuit).map(c => RANK_VALUES[c.rank]).sort((a,b) => b-a);
    straightFlushHigh = findStraight([...new Set(flushCards)]);
  }
  
  // 9. 로열 플러시 (A-K-Q-J-10 같은 수트)
  if (straightFlushHigh === 14) {
    return { rank: 9, name: HAND_NAMES[9], values: [14,13,12,11,10] };
  }
  
  // 8. 스트레이트 플러시
  if (straightFlushHigh) {
    return { rank: 8, name: HAND_NAMES[8], values: [straightFlushHigh] };
  }
  
  // 7. 포카드 (4개 같은 랭크)
  if (counts[0] === 4) {
    const quadVal = Number(Object.keys(rankCount).find(k => rankCount[k] === 4));
    const kicker = uniqueValues.find(v => v !== quadVal);
    return { rank: 7, name: HAND_NAMES[7], values: [quadVal, kicker] };
  }
  
  // 6. 풀하우스 (트리플 + 페어)
  if (counts[0] === 3 && counts[1] >= 2) {
    const tripleVals = Object.keys(rankCount).filter(k => rankCount[k] === 3).map(Number).sort((a,b)=>b-a);
    const pairVals = Object.keys(rankCount).filter(k => rankCount[k] >= 2 && !tripleVals.includes(Number(k))).map(Number).sort((a,b)=>b-a);
    return { rank: 6, name: HAND_NAMES[6], values: [tripleVals[0], pairVals[0] || tripleVals[1] || 0] };
  }
  
  // 5. 플러시
  if (flushSuit) {
    const flushCards = cards.filter(c => c.suit === flushSuit).map(c => RANK_VALUES[c.rank]).sort((a,b) => b-a).slice(0, 5);
    return { rank: 5, name: HAND_NAMES[5], values: flushCards };
  }
  
  // 4. 스트레이트
  if (straightHigh) {
    return { rank: 4, name: HAND_NAMES[4], values: [straightHigh] };
  }
  
  // 3. 트리플
  if (counts[0] === 3) {
    const tripleVal = Number(Object.keys(rankCount).find(k => rankCount[k] === 3));
    const kickers = uniqueValues.filter(v => v !== tripleVal).slice(0, 2);
    return { rank: 3, name: HAND_NAMES[3], values: [tripleVal, ...kickers] };
  }
  
  // 2. 투페어
  if (counts[0] === 2 && counts[1] === 2) {
    const pairs = Object.keys(rankCount).filter(k => rankCount[k] === 2).map(Number).sort((a,b)=>b-a);
    const kicker = uniqueValues.find(v => !pairs.includes(v));
    return { rank: 2, name: HAND_NAMES[2], values: [pairs[0], pairs[1], kicker] };
  }
  
  // 1. 원페어
  if (counts[0] === 2) {
    const pairVal = Number(Object.keys(rankCount).find(k => rankCount[k] === 2));
    const kickers = uniqueValues.filter(v => v !== pairVal).slice(0, 3);
    return { rank: 1, name: HAND_NAMES[1], values: [pairVal, ...kickers] };
  }
  
  // 0. 하이카드
  return { rank: 0, name: HAND_NAMES[0], values: uniqueValues.slice(0, 5) };
}

// 핸드 비교: 반환 > 0 → a 이김, < 0 → b 이김, 0 → 무승부
export function compareHands(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.max(a.values.length, b.values.length); i++) {
    const av = a.values[i] || 0;
    const bv = b.values[i] || 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

// ───────────────────────────────────────────────────
// 게임 플로우 유틸
// ───────────────────────────────────────────────────

// 라운드 끝났는지 (모든 활성 플레이어가 액션했고 베팅 매칭됨)
export function isBettingRoundComplete(players, currentBet) {
  const active = players.filter(p => !p.folded && !p.sittingOut);
  if (active.length <= 1) return true;  // 1명만 남으면 바로 끝
  
  // 모두 액션했고, 올인 아닌 사람은 currentBet 과 같은 금액 베팅
  for (const p of active) {
    if (p.allIn) continue;
    if (!p.acted) return false;
    if (p.bet !== currentBet) return false;
  }
  return true;
}

// 다음 활성 플레이어 인덱스
export function nextActivePlayerIdx(players, fromIdx) {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIdx + i) % n;
    const p = players[idx];
    if (!p.folded && !p.sittingOut && !p.allIn) return idx;
  }
  return -1;  // 액션 가능한 사람 없음 (모두 올인 or fold)
}

// 쇼다운 - 승자 결정
export function determineWinners(players, communityCards) {
  const active = players.filter(p => !p.folded);
  if (active.length === 0) return [];
  if (active.length === 1) return [{ player: active[0], hand: null }];
  
  // 각 플레이어의 최고 핸드 평가
  const evaluated = active.map(p => ({
    player: p,
    hand: evaluateHand([...p.cards, ...communityCards]),
  }));
  
  // 최고 핸드 찾기
  evaluated.sort((a, b) => compareHands(b.hand, a.hand));
  const best = evaluated[0].hand;
  const winners = evaluated.filter(e => compareHands(e.hand, best) === 0);
  
  return winners;
}

// 베팅 액션 (단일 플레이어)
// 반환: 수정된 player 객체 또는 null (실패)
export function applyAction(player, action, amount, currentBet) {
  const p = { ...player };
  
  if (action === "fold") {
    p.folded = true;
    p.acted = true;
  } 
  else if (action === "check") {
    if (p.bet !== currentBet) return null;  // 체크 불가 (베팅 매칭 필요)
    p.acted = true;
  }
  else if (action === "call") {
    const diff = currentBet - p.bet;
    const callAmt = Math.min(diff, p.chips);
    p.chips -= callAmt;
    p.bet += callAmt;
    if (p.chips === 0) p.allIn = true;
    p.acted = true;
  }
  else if (action === "raise") {
    if (amount <= currentBet) return null;  // 레이즈는 현재 베팅보다 커야
    const diff = amount - p.bet;
    if (diff > p.chips) return null;  // 칩 부족
    p.chips -= diff;
    p.bet = amount;
    if (p.chips === 0) p.allIn = true;
    p.acted = true;
  }
  else if (action === "all-in") {
    const newBet = p.bet + p.chips;
    p.bet = newBet;
    p.chips = 0;
    p.allIn = true;
    p.acted = true;
  }
  else {
    return null;
  }
  
  return p;
}

// 모든 플레이어 베팅을 팟에 넣고 베팅 초기화
export function collectBetsToPot(players, currentPot) {
  let pot = currentPot;
  const updated = players.map(p => {
    pot += p.bet;
    return { ...p, bet: 0, acted: false };
  });
  return { players: updated, pot };
}

// 블라인드 포스팅
export function postBlinds(players, dealerIdx, smallBlind, bigBlind) {
  const n = players.length;
  const sbIdx = (dealerIdx + 1) % n;
  const bbIdx = (dealerIdx + 2) % n;
  
  const updated = players.map((p, i) => {
    if (i === sbIdx) {
      const amt = Math.min(smallBlind, p.chips);
      return { ...p, chips: p.chips - amt, bet: amt, allIn: p.chips - amt === 0 };
    }
    if (i === bbIdx) {
      const amt = Math.min(bigBlind, p.chips);
      return { ...p, chips: p.chips - amt, bet: amt, allIn: p.chips - amt === 0 };
    }
    return p;
  });
  
  return { players: updated, sbIdx, bbIdx };
}

// 포지션 라벨 (상대적)
export function getPositionLabel(playerIdx, dealerIdx, totalPlayers) {
  const diff = (playerIdx - dealerIdx + totalPlayers) % totalPlayers;
  if (diff === 0) return "D";    // Dealer (Button)
  if (diff === 1) return "SB";   // Small Blind
  if (diff === 2) return "BB";   // Big Blind
  if (diff === 3) return "UTG";  // Under The Gun
  return "";
}

// 유틸: 카드 표시용
export function cardToString(card) {
  return `${card.rank}${card.suit}`;
}
