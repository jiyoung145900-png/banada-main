// ===================================================================
// 블랙잭 규칙 엔진 (순수 함수: 화면/Firestore 와 무관 → 단독 테스트 가능)
//   6덱 · 딜러 17 에서 스탠드(소프트 17 포함) · 블랙잭 3:2 · 보험 2:1 · 딜러 피크(A/10 업카드)
//   더블: 처음 두 장 / 스플릿 후에도 가능 · 스플릿: 1회(같은 값 두 장, 10·J·Q·K 끼리도 가능)
//   스플릿한 A 는 한 장씩만 받고 끝 · 스플릿 후 21 은 블랙잭이 아님(1:1) · 서렌더 없음
// ===================================================================
export const RULES = Object.freeze({
  decks: 6,
  penetration: 0.75,          // 슈의 75% 를 쓰면 다음 판 시작 때 새로 섞음
  blackjackPays: 1.5,
  insurancePays: 2,
  maxHands: 2,
  dealerHitsSoft17: false,
});
export const SUITS = ["♠", "♥", "♦", "♣"];
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

// 난수: 가능하면 crypto (53비트), 없으면 Math.random
export const secureRng = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const a = new Uint32Array(2);
      crypto.getRandomValues(a);
      return (a[0] * 2097152 + (a[1] >>> 11)) / 9007199254740992;
    }
  } catch (e) { /* fallthrough */ }
  return Math.random();
};

// 균등한 섞기 (Fisher–Yates). sort(() => Math.random() - 0.5) 는 편향되므로 쓰지 않음
export function shuffleInPlace(arr, rng = secureRng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

export function newShoe(decks = RULES.decks, rng = secureRng) {
  const cards = [];
  let id = 0;
  for (let d = 0; d < decks; d++) for (const s of SUITS) for (const r of RANKS) cards.push({ r, s, id: id++ });
  shuffleInPlace(cards, rng);
  return { cards, pos: 0, cut: Math.floor(cards.length * RULES.penetration) };
}

// 테스트/연출용: "As Kh 5d" 같은 문자열로 정해진 순서의 슈를 만듦 (s♠ h♥ d♦ c♣)
const SUIT_OF = { s: "♠", h: "♥", d: "♦", c: "♣" };
export function cardsFrom(str) {
  return str.trim().split(/\s+/).map((t, i) => {
    const r = t.slice(0, -1).toUpperCase(), s = SUIT_OF[t.slice(-1).toLowerCase()];
    if (!RANKS.includes(r) || !s) throw new Error("알 수 없는 카드 표기: " + t);      // 오타가 NaN 으로 조용히 넘어가지 않게
    return { r, s, id: 100000 + i };
  });
}
export const shoeFromCards = (str) => ({ cards: cardsFrom(str), pos: 0, cut: 1e9 });

const draw = (shoe) => {
  if (shoe.pos >= shoe.cards.length) throw new Error("shoe empty");
  return [shoe.cards[shoe.pos], { ...shoe, pos: shoe.pos + 1 }];
};

export const cardValue = (r) => (r === "A" ? 11 : r === "K" || r === "Q" || r === "J" || r === "10" ? 10 : +r);

export function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) { total += cardValue(c.r); if (c.r === "A") aces++; }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0, bust: total > 21 };
}
export const isBlackjack = (cards) => cards.length === 2 && handValue(cards).total === 21;
const sameValue = (a, b) => cardValue(a.r) === cardValue(b.r);

export const dealerShouldHit = (cards) => {
  const v = handValue(cards);
  return v.total < 17 || (RULES.dealerHitsSoft17 && v.total === 17 && v.soft);
};
// 딜러 플레이 (draw 함수 주입 → 무한 덱 시뮬레이션 등 테스트에 사용)
export function dealerPlay(cards, drawFn) {
  const out = [...cards];
  while (dealerShouldHit(out)) out.push(drawFn());
  return out;
}

const newHand = (cards, bet, fromSplit = false) => ({ cards, bet, doubled: false, fromSplit, done: false });

// ── 한 판 시작: 플레이어, 딜러(업), 플레이어, 딜러(홀) 순서로 딜 ──
export function startRound(shoeIn, bet, rng = secureRng) {
  if (!Number.isInteger(bet) || bet <= 0 || bet % 2 !== 0) throw new Error("bad bet");
  let shoe = shoeIn && shoeIn.pos < shoeIn.cut ? shoeIn : newShoe(RULES.decks, rng);
  const reshuffled = shoe !== shoeIn;
  let p1, d1, p2, d2;
  [p1, shoe] = draw(shoe); [d1, shoe] = draw(shoe); [p2, shoe] = draw(shoe); [d2, shoe] = draw(shoe);
  const state = {
    phase: "PLAYER", shoe, dealer: [d1, d2], hands: [newHand([p1, p2], bet)], active: 0,
    insuranceBet: 0, committed: bet, reshuffled, dealerBJ: isBlackjack([d1, d2]), summary: null,
  };
  if (d1.r === "A") return { ...state, phase: "INSURANCE" };
  if (cardValue(d1.r) === 10) return afterPeek(state);
  return startPlayer(state);
}
const afterPeek = (state) => (state.dealerBJ ? finish(state, false) : startPlayer(state));
const startPlayer = (state) => (isBlackjack(state.hands[0].cards) ? finish(state, false) : { ...state, phase: "PLAYER" });

export function takeInsurance(state, yes) {
  if (state.phase !== "INSURANCE") throw new Error("not insurance phase");
  const ins = yes ? state.hands[0].bet / 2 : 0;
  return afterPeek({ ...state, insuranceBet: ins, committed: state.committed + ins });
}

export function legalActions(state) {
  const none = { hit: false, stand: false, double: false, split: false };
  if (!state || state.phase !== "PLAYER") return none;
  const h = state.hands[state.active];
  if (!h || h.done) return none;
  const two = h.cards.length === 2;
  return {
    hit: true,
    stand: true,
    double: two && !h.doubled,
    split: two && state.hands.length < RULES.maxHands && sameValue(h.cards[0], h.cards[1]),
  };
}
// 해당 행동에 추가로 필요한 포인트 (UI 가 잔액 부족을 미리 막는 데 사용)
export function extraCost(state, action) {
  if (action === "insurance") return state.hands[0].bet / 2;
  if (action === "double" || action === "split") return state.hands[state.active].bet;
  return 0;
}

const replaceHand = (state, idx, hand) => ({ ...state, hands: state.hands.map((h, i) => (i === idx ? hand : h)) });
const assertLegal = (state, action) => { if (!legalActions(state)[action]) throw new Error("illegal action: " + action); };

export function hit(state) {
  assertLegal(state, "hit");
  const h = state.hands[state.active];
  let c, shoe; [c, shoe] = draw(state.shoe);
  const cards = [...h.cards, c], v = handValue(cards);
  return advance(replaceHand({ ...state, shoe }, state.active, { ...h, cards, done: v.bust || v.total >= 21 }));
}
export function stand(state) {
  assertLegal(state, "stand");
  return advance(replaceHand(state, state.active, { ...state.hands[state.active], done: true }));
}
export function double(state) {
  assertLegal(state, "double");
  const h = state.hands[state.active];
  let c, shoe; [c, shoe] = draw(state.shoe);
  const next = { ...h, cards: [...h.cards, c], bet: h.bet * 2, doubled: true, done: true };
  return advance({ ...replaceHand({ ...state, shoe }, state.active, next), committed: state.committed + h.bet });
}
export function split(state) {
  assertLegal(state, "split");
  const h = state.hands[state.active];
  let c1, c2, shoe = state.shoe;
  [c1, shoe] = draw(shoe); [c2, shoe] = draw(shoe);
  const aces = h.cards[0].r === "A";
  const mk = (card, extra) => { const cards = [card, extra]; return { ...newHand(cards, h.bet, true), done: aces || handValue(cards).total >= 21 }; };
  return advance({ ...state, shoe, hands: [mk(h.cards[0], c1), mk(h.cards[1], c2)], active: 0, committed: state.committed + h.bet });
}

function advance(state) {
  const next = state.hands.findIndex((h) => !h.done);
  if (next === -1) return runDealer(state);
  return { ...state, active: next };
}

function runDealer(state) {
  const anyLive = state.hands.some((h) => !handValue(h.cards).bust);
  let shoe = state.shoe, dealer = state.dealer;
  if (anyLive) {
    dealer = dealerPlay(state.dealer, () => { let c; [c, shoe] = draw(shoe); return c; });
  }
  return finish({ ...state, shoe, dealer }, true);
}

function finish(state, dealerPlayed) {
  const dv = handValue(state.dealer);
  const results = state.hands.map((h) => {
    const v = handValue(h.cards);
    let label, payout;
    if (v.bust) { label = "BUST"; payout = 0; }
    else if (isBlackjack(h.cards) && !h.fromSplit) {
      if (state.dealerBJ) { label = "PUSH"; payout = h.bet; }
      else { label = "BLACKJACK"; payout = h.bet + h.bet * RULES.blackjackPays; }
    }
    else if (state.dealerBJ) { label = "LOSE"; payout = 0; }
    else if (dv.bust) { label = "WIN"; payout = h.bet * 2; }
    else if (v.total > dv.total) { label = "WIN"; payout = h.bet * 2; }
    else if (v.total < dv.total) { label = "LOSE"; payout = 0; }
    else { label = "PUSH"; payout = h.bet; }
    return { label, payout, bet: h.bet };
  });
  const insurancePayout = state.dealerBJ && state.insuranceBet > 0 ? state.insuranceBet * (1 + RULES.insurancePays) : 0;
  const payout = results.reduce((a, r) => a + r.payout, 0) + insurancePayout;
  return { ...state, phase: "DONE", summary: { results, insurancePayout, payout, committed: state.committed, net: payout - state.committed, dealerPlayed } };
}

// 화면을 갑자기 닫았을 때: 보험은 거절, 남은 손은 모두 스탠드로 끝내고 정산
export function forceFinish(state) {
  let s = state;
  if (s.phase === "INSURANCE") s = takeInsurance(s, false);
  let guard = 0;
  while (s.phase === "PLAYER" && guard++ < 10) s = stand(s);
  return s;
}
