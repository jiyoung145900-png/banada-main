// ===================================================================
// 🃏 VIP BLACKJACK
//   규칙 = BlackjackEngine (순수 함수, 단독 테스트됨) · 그림 = CasinoArt · 여기는 화면과 흐름만
//   6덱 · 블랙잭 3:2 · 딜러 17 스탠드 · 보험 2:1 · 더블 · 스플릿(1회)
//   포인트: 딜할 때 1번 차감 → 끝날 때 1번 지급 (룰렛과 같은 방식). 도중에 닫으면 자동 정산
// ===================================================================
import React, { useState, useRef, useEffect } from "react";
import { ChipStack3D, Shoe3D, CardBack3D, PlayingCardFace, fmtK } from "./CasinoArt";
import {
  startRound, takeInsurance, legalActions, extraCost, hit, stand, double, split,
  forceFinish, handValue, shoeFromCards, secureRng,
} from "./BlackjackEngine";

export const MIN_BET = 1000;
export const MAX_BET = 5000000;
const RESTART_POINTS = 10000;                      // 파산 시 지급 (룰렛/로비 안내와 동일)
const CHIPS = [1000, 5000, 10000, 50000, 100000, 500000];
const fmt = (n) => Math.round(n).toLocaleString();
const EDGE = (h = 4, c = "rgba(0,0,0,0.55)") => `0 ${h}px 0 ${c}, 0 ${h * 2 + 2}px ${h * 3}px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -3px 0 rgba(0,0,0,0.22)`;

// 금액을 큰 칩부터 쪼갬 (REBET / ×2 에서 칩 모양을 복원)
const toChips = (amount) => {
  const out = []; let left = amount;
  for (const v of [...CHIPS].reverse()) while (left >= v) { out.push(v); left -= v; }
  return out;
};
const groupChips = (stack) => {
  const g = [];
  for (const v of stack) { const last = g[g.length - 1]; if (last && last.v === v) last.n += 1; else g.push({ v, n: 1 }); }
  return g;
};

const injectStyles = () => {
  if (typeof document === "undefined" || document.getElementById("bj-styles")) return;
  const el = document.createElement("style");
  el.id = "bj-styles";
  el.innerHTML = `
    @keyframes bjDeal { 0% { transform: translate(var(--dx, 90px), var(--dy, -150px)) rotate(16deg) scale(0.7); opacity: 0; } 55% { opacity: 1; } 100% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; } }
    @keyframes bjFlip { 0% { transform: scaleX(0.04); } 100% { transform: scaleX(1); } }
    @keyframes bjPop { 0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0; } 60% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
    @keyframes bjRing { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
    @keyframes bjDrop { 0% { transform: translateY(-22px) scale(1.5); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
    [data-3d] { transition: transform .12s ease, box-shadow .12s ease, filter .12s ease; }
    [data-3d]:not(:disabled):hover { filter: brightness(1.08); }
    [data-3d]:not(:disabled):active { transform: translateY(3px) !important; box-shadow: 0 1px 0 rgba(0,0,0,0.55), 0 2px 5px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12) !important; filter: brightness(0.96); }
  `;
  document.head.appendChild(el);
};

// ── 효과음 (WebAudio, 첫 터치 때 만들어서 자동재생 차단/구형 브라우저에서도 오류 없음) ──
function makeSfx(getCtx) {
  const tone = (f0, f1, dur, type, vol, delay = 0) => {
    const ctx = getCtx(); if (!ctx) return;
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  };
  const noise = (dur, vol, delay = 0) => {
    const ctx = getCtx(); if (!ctx) return;
    const t = ctx.currentTime + delay, len = Math.max(1, Math.floor(ctx.sampleRate * dur)), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(), gn = ctx.createGain(); src.buffer = buf; gn.gain.value = vol; src.connect(gn); gn.connect(ctx.destination); src.start(t);
  };
  return {
    chip: () => { tone(1400, 900, 0.06, "triangle", 0.08); tone(2100, 1300, 0.05, "sine", 0.05, 0.03); },
    card: () => noise(0.07, 0.12),
    flip: () => { noise(0.09, 0.14); tone(300, 200, 0.08, "triangle", 0.05); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.18, "triangle", 0.1, i * 0.09)),
    bj: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.22, "triangle", 0.11, i * 0.08)),
    lose: () => tone(220, 110, 0.45, "sawtooth", 0.08),
    push: () => tone(440, 440, 0.2, "sine", 0.08),
  };
}

// ── 카드 한 장 (날아오며 등장, 홀카드는 뒤집힘) ──
function PlayCard({ card, faceUp, left, top, cw, z, flipIn, fromX, fromY }) {
  const ch = cw * 1.4;
  return (
    <div data-card={faceUp ? "up" : "down"} data-rank={faceUp ? `${card.r}${card.s}` : undefined}
      style={{ position: "absolute", left, top, width: cw, height: ch, zIndex: z, transition: "left .3s ease", "--dx": `${fromX}px`, "--dy": `${fromY}px`, animation: "bjDeal .42s cubic-bezier(.2,.8,.25,1) both" }}>
      <div style={{ width: "100%", height: "100%", borderRadius: Math.max(3, cw * 0.09), overflow: "hidden", background: "#fff", boxShadow: "0 6px 10px rgba(0,0,0,0.5)", border: "1px solid rgba(0,0,0,0.35)" }}>
        {faceUp
          ? <div key="up" style={{ width: "100%", height: "100%", animation: flipIn ? "bjFlip .45s ease-out both" : "none" }}><PlayingCardFace rank={card.r} suit={card.s} /></div>
          : <CardBack3D />}
      </div>
    </div>
  );
}

// ── 테이블(펠트) 그림: 위는 딜러, 아래는 반원 모양의 플레이어 쪽 ──
function BjTable({ split: isSplit }) {
  const OUTER = "M 8 44 Q 8 12 40 12 L 360 12 Q 392 12 392 44 L 392 214 A 192 150 0 0 1 8 214 Z";
  const INNER = "M 22 52 Q 22 26 48 26 L 352 26 Q 378 26 378 52 L 378 214 A 178 136 0 0 1 22 214 Z";
  const spots = isSplit ? [118, 282] : [200];
  return (
    <svg viewBox="0 0 400 380" width="100%" height="100%" data-bj-table style={{ position: "absolute", top: 0, left: 0, display: "block", filter: "drop-shadow(0 14px 16px rgba(0,0,0,0.6))" }}>
      <defs>
        <linearGradient id="bjRail" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f0cf85" /><stop offset="14%" stopColor="#c9993f" /><stop offset="58%" stopColor="#7a4f16" /><stop offset="100%" stopColor="#3b2308" /></linearGradient>
        <radialGradient id="bjFelt" cx="50%" cy="34%" r="78%"><stop offset="0%" stopColor="#1f8a56" /><stop offset="55%" stopColor="#0d5a37" /><stop offset="100%" stopColor="#05301d" /></radialGradient>
        <radialGradient id="bjSpot" cx="50%" cy="28%" r="52%"><stop offset="0%" stopColor="#fff7c2" stopOpacity="0.3" /><stop offset="100%" stopColor="#fff7c2" stopOpacity="0" /></radialGradient>
        <pattern id="bjWeave" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 0 L6 6 M6 0 L0 6" stroke="#000" strokeOpacity="0.07" strokeWidth="0.6" /></pattern>
        <path id="bjArc1" d="M 96 160 Q 200 144 304 160" />
        <path id="bjArc2" d="M 92 192 Q 200 177 308 192" />
      </defs>
      <path d={OUTER} fill="url(#bjRail)" />
      <path d={OUTER} fill="none" stroke="#fff3c4" strokeOpacity="0.5" strokeWidth="1.2" />
      <path d={INNER} fill="url(#bjFelt)" />
      <path d={INNER} fill="url(#bjWeave)" />
      <ellipse cx="200" cy="90" rx="190" ry="100" fill="url(#bjSpot)" />
      <path d={INNER} fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="4" />
      <path d={INNER} fill="none" stroke="#E3B23C" strokeOpacity="0.65" strokeWidth="1" />
      <text fontSize="11.5" fontWeight="800" letterSpacing="2.2" fill="#E3B23C" fillOpacity="0.5" style={{ fontFamily: "Georgia, serif" }}><textPath href="#bjArc1" xlinkHref="#bjArc1" startOffset="50%" textAnchor="middle">BLACKJACK PAYS 3 TO 2</textPath></text>
      <text fontSize="7.5" fontWeight="700" letterSpacing="1.6" fill="#E3B23C" fillOpacity="0.4" style={{ fontFamily: "Georgia, serif" }}><textPath href="#bjArc2" xlinkHref="#bjArc2" startOffset="50%" textAnchor="middle">INSURANCE PAYS 2 TO 1</textPath></text>
      <text x="200" y="171" textAnchor="middle" fontSize="6.5" letterSpacing="1.4" fill="#fff" fillOpacity="0.28" style={{ fontFamily: "Georgia, serif" }}>DEALER STANDS ON ALL 17s</text>
      {spots.map((x) => (
        <g key={x}>
          <circle cx={x} cy="334" r="18" fill="rgba(0,0,0,0.18)" stroke="#E3B23C" strokeOpacity="0.7" strokeWidth="1.4" strokeDasharray="4 3" />
          <circle cx={x} cy="334" r="22" fill="none" stroke="#E3B23C" strokeOpacity="0.25" strokeWidth="1" />
        </g>
      ))}
    </svg>
  );
}

// ── 메인 ──
export default function BlackjackGame({ points = 100000, onPointsChange = () => {}, onBack = () => {}, __test }) {
  const T = __test || {};
  const speed = T.speed === undefined ? 1 : T.speed;
  const [bank, setBank] = useState(points);
  const bankRef = useRef(points);
  const onPointsRef = useRef(onPointsChange); onPointsRef.current = onPointsChange;
  const [stage, setStage] = useState("BETTING");           // BETTING DEALING INSURANCE PLAYER DEALER RESULT
  const stageRef = useRef("BETTING");
  const setStageBoth = (s) => { stageRef.current = s; setStage(s); };
  const [stack, setStack] = useState([]);                  // 지금 올려둔 칩
  const [selChip, setSelChip] = useState(10000);
  const [lastBet, setLastBet] = useState(0);
  const [g, setG] = useState(null);
  const gRef = useRef(null);
  const setGame = (x) => { gRef.current = x; setG(x); };
  const [view, setView] = useState({ p: [0], d: 0, hole: false });
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState("");
  const [sessionNet, setSessionNet] = useState(0);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false); mutedRef.current = muted;
  const [W, setW] = useState(T.width || 480);
  const sceneRef = useRef(null);
  const shoeRef = useRef(T.shoe ? shoeFromCards(T.shoe) : null);
  const roundId = useRef(0), settled = useRef(0);
  const timers = useRef([]), toastTimer = useRef(null), alive = useRef(true), ctxRef = useRef(null);

  useEffect(() => { alive.current = true; injectStyles(); }, []);          // StrictMode(개발)의 마운트→정리→재마운트에서도 타이머가 살아 있게
  // 장면 너비 측정 → 카드/좌표 크기를 거기에 맞춤
  useEffect(() => {
    const el = sceneRef.current; if (!el) return;
    const measure = () => { const w = el.getBoundingClientRect().width; if (w > 0) setW(w); };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 베팅 단계에서는 부모 포인트를 따라감 (진행 중에는 내 계산을 유지)
  useEffect(() => { if (stageRef.current === "BETTING") { bankRef.current = points; setBank(points); } }, [points]);
  // 화면을 닫으면: 진행 중인 판은 자동으로 끝내서 정산 (돈이 사라지지 않음)
  useEffect(() => () => {
    alive.current = false; timers.current.forEach(clearTimeout); clearTimeout(toastTimer.current);
    const cur = gRef.current;
    if (cur && settled.current !== roundId.current) {
      settled.current = roundId.current;
      let pay;
      try { pay = (cur.phase === "DONE" ? cur : forceFinish(cur)).summary.payout; }
      catch (e) { pay = cur.committed; }                    // 정산에 실패하면 걸었던 금액을 돌려줌 (돈이 말없이 사라지지 않게)
      if (pay > 0) onPointsRef.current(bankRef.current + pay);
    }
  }, []);

  const sfx = useRef(null);
  if (!sfx.current) {
    sfx.current = makeSfx(() => {
      if (T.sfx === false || mutedRef.current) return null;
      try {
        if (!ctxRef.current) { const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext); if (!AC) return null; ctxRef.current = new AC(); }
        if (ctxRef.current.state === "suspended") ctxRef.current.resume();
        return ctxRef.current;
      } catch (e) { return null; }
    });
  }
  const play = (k) => { try { sfx.current[k](); } catch (e) { /* 소리 실패는 무시 */ } };
  const buzz = (p) => { try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(p); } catch (e) { /* noop */ } };
  const later = (ms, fn) => { const id = setTimeout(() => { if (alive.current) fn(); }, ms * speed); timers.current.push(id); };
  const showToast = (m) => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 2400); };
  const commit = (nb) => { bankRef.current = nb; setBank(nb); onPointsRef.current(nb); };

  // ── 베팅 ──
  const betTotal = stack.reduce((a, b) => a + b, 0);
  const maxNow = Math.min(MAX_BET, bank);
  const addChip = (v) => {
    if (stageRef.current !== "BETTING") return;
    if (betTotal + v > maxNow) { showToast(betTotal + v > MAX_BET ? "최대 베팅 금액이에요" : "포인트가 부족해요"); return; }
    setSelChip(v); setStack((s) => [...s, v]); play("chip");
  };
  const undo = () => { setStack((s) => s.slice(0, -1)); play("chip"); };
  const clearBet = () => setStack([]);
  const rebet = () => { if (!lastBet) return showToast("지난 베팅이 없어요"); if (lastBet > maxNow) return showToast("지난 베팅이 지금 한도를 넘어요"); setStack(toChips(lastBet)); play("chip"); };
  const doubleBet = () => { if (!betTotal) return; if (betTotal * 2 > maxNow) return showToast("2배는 한도/포인트를 넘어요"); setStack(toChips(betTotal * 2)); play("chip"); };

  // ── 딜 ──
  const deal = (override) => {
    if (stageRef.current !== "BETTING") return;
    const amount = override === undefined ? betTotal : override;
    if (amount < MIN_BET) return showToast(`최소 베팅은 ${fmt(MIN_BET)} 이에요`);
    if (amount > MAX_BET) return showToast("최대 베팅 금액이에요");
    if (amount > bankRef.current) return showToast("포인트가 부족해요");
    let state;
    try { state = startRound(shoeRef.current, amount, T.rng || secureRng); } catch (e) { return showToast("딜 오류가 났어요"); }
    shoeRef.current = state.shoe;
    roundId.current += 1;
    commit(bankRef.current - amount);                       // 베팅금 차감 (1번 저장)
    setLastBet(amount); setStack(toChips(amount)); setResult(null);
    setGame(state); setView({ p: [0], d: 0, hole: false }); setStageBoth("DEALING");
    if (state.reshuffled) showToast("🔀 새 슈를 섞었어요");
    play("chip");
    const st = 340;
    later(250, () => { setView((v) => ({ ...v, p: [1] })); play("card"); });
    later(250 + st, () => { setView((v) => ({ ...v, d: 1 })); play("card"); });
    later(250 + st * 2, () => { setView((v) => ({ ...v, p: [2] })); play("card"); });
    later(250 + st * 3, () => { setView((v) => ({ ...v, d: 2 })); play("card"); });
    later(250 + st * 3 + 500, () => {
      if (state.phase === "INSURANCE") setStageBoth("INSURANCE");
      else if (state.phase === "DONE") finish(state);
      else setStageBoth("PLAYER");
    });
  };

  const chooseInsurance = (yes) => {
    const cur = gRef.current; if (!cur || cur.phase !== "INSURANCE" || stageRef.current !== "INSURANCE") return;
    const cost = extraCost(cur, "insurance");
    if (yes && cost > bankRef.current) return showToast("보험료가 부족해요");
    if (yes) { commit(bankRef.current - cost); play("chip"); }
    const next = takeInsurance(cur, yes); setGame(next);
    if (next.phase === "DONE") { setStageBoth("DEALER"); later(350, () => finish(next)); } else setStageBoth("PLAYER");
  };

  const act = (name) => {
    const cur = gRef.current;
    if (!cur || stageRef.current !== "PLAYER" || cur.phase !== "PLAYER" || !legalActions(cur)[name]) return;
    const cost = extraCost(cur, name);
    if (cost > bankRef.current) return showToast("포인트가 부족해요");
    if (cost) commit(bankRef.current - cost);
    const next = { hit, stand, double, split }[name](cur);
    setGame(next);
    setView((v) => ({ ...v, p: next.hands.map((h) => h.cards.length) }));
    play(name === "double" || name === "split" ? "chip" : "card");
    if (next.phase === "DONE") { setStageBoth("DEALER"); later(650, () => finish(next)); }
  };

  // 딜러 차례 연출: 홀카드 공개 → 한 장씩 뽑기 → 결과
  const finish = (state) => {
    setStageBoth("DEALER");
    let t = 450;
    later(t, () => { setView((v) => ({ ...v, hole: true, d: 2 })); play("flip"); });
    for (let k = 2; k < state.dealer.length; k++) { t += 800; const n = k + 1; later(t, () => { setView((v) => ({ ...v, d: n })); play("card"); }); }
    t += 700;
    later(t, () => settle(state));
  };
  const settle = (state) => {
    if (settled.current === roundId.current) return;
    settled.current = roundId.current;
    const m = state.summary;
    if (m.payout > 0) commit(bankRef.current + m.payout);   // 결과 지급 (1번 저장)
    setSessionNet((n) => n + m.net);
    setResult(m); setView((v) => ({ ...v, hole: true, d: state.dealer.length })); setStageBoth("RESULT");
    const bj = m.results.some((r) => r.label === "BLACKJACK");
    if (bj) { play("bj"); buzz([40, 30, 80]); } else if (m.net > 0) { play("win"); buzz(60); } else if (m.net < 0) { play("lose"); buzz([30, 40, 30]); } else play("push");
  };

  const toBetting = (keep) => {
    setGame(null); setView({ p: [0], d: 0, hole: false }); setResult(null); setStageBoth("BETTING");
    setStack(keep && lastBet && lastBet <= Math.min(MAX_BET, bankRef.current) ? toChips(lastBet) : []);
  };
  const againDeal = () => { toBetting(true); deal(lastBet); };
  const claimRestart = () => { commit(RESTART_POINTS); showToast(`파산! ${fmt(RESTART_POINTS)}P 를 지급했어요`); };

  // ── 화면 계산 ──
  const u = W / 400;
  const hands = g ? g.hands : [];
  const isSplit = hands.length > 1;
  const legal = g ? legalActions(g) : { hit: false, stand: false, double: false, split: false };
  const busy = stage === "DEALING" || stage === "DEALER";
  const dealerShown = g ? g.dealer.slice(0, view.d) : [];
  const dealerScore = !g || view.d === 0 ? null : view.hole ? handValue(dealerShown) : handValue(dealerShown.slice(0, 1));
  const layout = (n, cx, scale) => {
    const cw = 52 * u * scale, step = cw * (n > 4 ? 0.46 : 0.6), total = cw + Math.max(0, n - 1) * step;
    return { cw, step, left: cx * u - total / 2 };
  };
  const balanceShown = stage === "BETTING" ? bank - betTotal : bank;
  const canAfford = (name) => !g || extraCost(g, name) <= bank;
  const handLabel = (i) => (result ? result.results[i] : null);
  const labelColor = (l) => (l === "WIN" || l === "BLACKJACK" ? "#FFD76A" : l === "PUSH" ? "#cbd5e1" : "#f87171");
  const showBetCircle = (x, i) => {
    const betStack = stage === "BETTING" ? stack : toChips(hands[i] ? hands[i].bet : 0);
    const groups = groupChips(betStack).slice(-3);
    const amount = stage === "BETTING" ? betTotal : hands[i] ? hands[i].bet : 0;
    return (
      <div key={x} style={{ position: "absolute", left: `${x / 4}%`, top: `${334 / 3.8}%`, transform: "translate(-50%, -50%)", display: "flex", alignItems: "center", pointerEvents: "none" }}>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          {groups.map((gr, k) => <span key={`${gr.v}-${gr.n}-${k}`} style={{ marginLeft: k ? -8 * u : 0, animation: "bjDrop .25s ease-out" }}><ChipStack3D value={gr.v} count={gr.n} size={34 * u} /></span>)}
        </div>
        {amount > 0 && <span data-bet-amount style={{ ...S.betPill, fontSize: Math.max(9, 10 * u) }}>{fmt(amount)}</span>}
      </div>
    );
  };

  return (
    <div style={S.root} data-stage={stage}>
      {/* 상단 바 */}
      <div style={S.topBar}>
        <button data-3d onClick={onBack} style={S.backBtn} aria-label="lobby">←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.title}>VIP BLACKJACK</div>
          <div style={S.sub}>6덱 · 블랙잭 3:2 · 딜러 17 스탠드 · 보험 2:1</div>
        </div>
        {sessionNet !== 0 && <span data-session style={{ ...S.net, color: sessionNet > 0 ? "#86EFAC" : "#FCA5A5", borderColor: sessionNet > 0 ? "rgba(134,239,172,.4)" : "rgba(252,165,165,.4)" }}>{sessionNet > 0 ? "+" : "-"}{fmt(Math.abs(sessionNet))}</span>}
        <button data-3d onClick={() => setMuted((m) => !m)} style={S.iconBtn} aria-label="sound">{muted ? "🔇" : "🔊"}</button>
        <div style={S.points}>💎 <span data-balance>{fmt(balanceShown)}</span></div>
      </div>

      {/* 테이블 */}
      <div style={S.sceneWrap}>
        <div ref={sceneRef} style={S.scene} data-scene>
          <BjTable split={isSplit} />
          <div style={{ position: "absolute", right: "1.5%", top: "-1%", zIndex: 30, pointerEvents: "none" }}><Shoe3D width={Math.max(60, 84 * u)} shaking={stage === "DEALING"} /></div>

          {/* 딜러 카드 */}
          {dealerShown.map((c, i) => {
            const L = layout(dealerShown.length, 200, 1);
            return <PlayCard key={c.id} card={c} faceUp={i !== 1 || view.hole} flipIn={i === 1} left={L.left + i * L.step} top={34 * u} cw={L.cw} z={i + 1} fromX={120 * u} fromY={-40 * u} />;
          })}
          {dealerScore && (
            <div data-dealer-score style={{ ...S.badge, left: "50%", top: 34 * u + 52 * u * 1.4 + 4 * u, fontSize: Math.max(10, 11 * u) }}>
              {dealerScore.bust ? "BUST" : dealerScore.total}{dealerScore.soft && !dealerScore.bust ? <small style={{ opacity: 0.7, marginLeft: 3 }}>soft</small> : null}
            </div>
          )}

          {/* 플레이어 손 */}
          {hands.map((h, i) => {
            const cx = isSplit ? (i === 0 ? 118 : 282) : 200, sc = isSplit ? 0.82 : 1;
            const shown = Math.min(h.cards.length, view.p[i] === undefined ? h.cards.length : view.p[i]);
            const cards = h.cards.slice(0, shown), L = layout(shown, cx, sc), v = handValue(cards);
            const top = (isSplit ? 218 : 212) * u, active = stage === "PLAYER" && g.active === i && !h.done;
            const lab = handLabel(i);
            return (
              <React.Fragment key={i}>
                {active && <div data-active-hand style={{ position: "absolute", left: L.left - 6, top: top - 6, width: L.cw + Math.max(0, shown - 1) * L.step + 12, height: L.cw * 1.4 + 12, transition: "left .3s ease, width .3s ease", border: "2px solid #FFD76A", borderRadius: 10, boxShadow: "0 0 14px rgba(255,215,106,.6)", animation: "bjRing 1.2s ease-in-out infinite", pointerEvents: "none", zIndex: 0 }} />}
                {cards.map((c, k) => <PlayCard key={c.id} card={c} faceUp left={L.left + k * L.step} top={top} cw={L.cw} z={k + 1} fromX={140 * u} fromY={-210 * u} />)}
                {shown > 0 && (
                  <div data-hand-score={i} style={{ ...S.badge, left: `${cx / 4}%`, top: top + L.cw * 1.4 + 4 * u, fontSize: Math.max(10, 11 * u), background: v.bust ? "#b91c1c" : v.total === 21 ? "linear-gradient(135deg,#FFD76A,#B8860B)" : "rgba(0,0,0,.78)", color: v.total === 21 && !v.bust ? "#1b1204" : "#fff" }}>
                    {v.bust ? "BUST" : v.total}{v.soft && !v.bust ? <small style={{ opacity: 0.7, marginLeft: 3 }}>soft</small> : null}
                    {lab && <span data-hand-result style={{ marginLeft: 6, color: labelColor(lab.label), fontWeight: 900 }}>{lab.label}</span>}
                  </div>
                )}
              </React.Fragment>
            );
          })}

          {/* 베팅 원 */}
          {(isSplit ? [118, 282] : [200]).map((x, i) => showBetCircle(x, i))}
          {stage === "BETTING" && (
            <button data-bet-circle onClick={() => addChip(selChip)} aria-label="bet"
              style={{ position: "absolute", left: "50%", top: `${334 / 3.8}%`, width: 50 * u, height: 50 * u, transform: "translate(-50%, -50%)", borderRadius: "50%", border: "2px solid rgba(255,215,106,.8)", background: "transparent", cursor: "pointer", animation: stack.length ? "none" : "bjRing 1.4s ease-in-out infinite", zIndex: 5 }} />
          )}
          {stage === "BETTING" && !stack.length && <div style={{ ...S.hint, top: `${244 / 3.8}%` }}>PLACE YOUR BET</div>}

          {/* 보험 */}
          {stage === "INSURANCE" && g && (
            <div data-insurance style={{ ...S.overlay, top: `${158 / 3.8}%`, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: Math.max(10, 11 * u), fontWeight: 900, letterSpacing: 1, color: "#FFD76A", lineHeight: 1.25, textAlign: "left" }}>INSURANCE?<br /><span style={{ fontSize: Math.max(8, 9 * u), fontWeight: 700, color: "#fff", opacity: 0.85 }}>보험료 {fmt(extraCost(g, "insurance"))} · 2:1</span></span>
              <button data-3d data-act="ins-yes" onClick={() => chooseInsurance(true)} disabled={extraCost(g, "insurance") > bank} style={{ ...S.btn, ...S.btnBlue, flex: "none", padding: "7px 12px", opacity: extraCost(g, "insurance") > bank ? 0.4 : 1 }}>들기</button>
              <button data-3d data-act="ins-no" onClick={() => chooseInsurance(false)} style={{ ...S.btn, ...S.btnGray, flex: "none", padding: "7px 12px" }}>안 들기</button>
            </div>
          )}

          {/* 결과 */}
          {stage === "RESULT" && result && (
            <div data-result style={{ ...S.overlay, top: `${158 / 3.8}%`, animation: "bjPop .5s cubic-bezier(.2,.9,.3,1.2) both", display: "flex", alignItems: "baseline", gap: 10, borderColor: result.net > 0 ? "rgba(255,215,106,.8)" : result.net < 0 ? "rgba(248,113,113,.7)" : "rgba(203,213,225,.6)" }}>
              <span style={{ fontSize: Math.max(14, 17 * u), fontWeight: 900, letterSpacing: 2, color: result.net > 0 ? "#FFD76A" : result.net < 0 ? "#f87171" : "#cbd5e1", fontFamily: "Georgia, serif" }}>
                {result.results.some((r) => r.label === "BLACKJACK") ? "BLACKJACK!" : result.net > 0 ? "YOU WIN" : result.net < 0 ? (result.results.every((r) => r.label === "BUST") ? "BUST" : "DEALER WINS") : "PUSH"}
              </span>
              <span data-result-net style={{ fontSize: Math.max(11, 13 * u), fontWeight: 900, color: result.net > 0 ? "#86efac" : result.net < 0 ? "#fca5a5" : "#e2e8f0" }}>
                {result.net > 0 ? "+" : result.net < 0 ? "-" : ""}{fmt(Math.abs(result.net))} P
              </span>
            </div>
          )}
        </div>
      </div>

      {toast && <div data-toast style={S.toast}>{toast}</div>}

      {/* 조작판 */}
      <div style={S.panel}>
        {stage === "BETTING" && (
          <>
            <div style={S.chipRow}>
              {CHIPS.map((v) => {
                const dis = betTotal + v > maxNow;
                return (
                  <button key={v} data-chip={v} data-dim={dis ? "1" : "0"} onClick={() => addChip(v)} style={{ ...S.chipBtn, opacity: dis ? 0.3 : 1, transform: selChip === v ? "translateY(-4px) scale(1.1)" : "none" }}>
                    <ChipStack3D value={v} size={46} />
                    <span style={S.chipLabel}>{fmtK(v)}</span>
                  </button>
                );
              })}
            </div>
            <div style={S.info}>내 베팅 <b data-bet-total style={{ color: "#FFD76A" }}>{fmt(betTotal)}</b> · 최소 {fmtK(MIN_BET)} · 최대 {fmtK(MAX_BET)}</div>
            <div style={S.row}>
              <button data-3d data-act="undo" onClick={undo} disabled={!betTotal} style={{ ...S.btn, ...S.btnGray, opacity: betTotal ? 1 : 0.4 }}>↩ 취소</button>
              <button data-3d data-act="clear" onClick={clearBet} disabled={!betTotal} style={{ ...S.btn, ...S.btnDark, opacity: betTotal ? 1 : 0.4 }}>🗑 리셋</button>
              <button data-3d data-act="rebet" onClick={rebet} disabled={!lastBet} style={{ ...S.btn, ...S.btnBlue, opacity: lastBet ? 1 : 0.4 }}>⟲ REBET</button>
              <button data-3d data-act="x2" onClick={doubleBet} disabled={!betTotal} style={{ ...S.btn, ...S.btnGold, opacity: betTotal ? 1 : 0.4 }}>×2</button>
            </div>
            {bank < MIN_BET && !betTotal ? (
              <button data-3d data-act="restart" onClick={claimRestart} style={{ ...S.big, ...S.btnGreen }}>💸 포인트가 부족해요 · {fmt(RESTART_POINTS)}P 받기</button>
            ) : (
              <button data-3d data-act="deal" onClick={() => deal()} disabled={betTotal < MIN_BET} style={{ ...S.big, ...S.btnGold, opacity: betTotal < MIN_BET ? 0.5 : 1 }}>DEAL · {fmt(betTotal)}</button>
            )}
          </>
        )}

        {(stage === "PLAYER" || stage === "INSURANCE" || stage === "DEALING" || stage === "DEALER") && (
          <>
            <div style={S.row}>
              <button data-3d data-act="hit" onClick={() => act("hit")} disabled={stage !== "PLAYER" || !legal.hit} style={{ ...S.play, ...S.btnGreen, opacity: stage === "PLAYER" && legal.hit ? 1 : 0.4 }}>HIT</button>
              <button data-3d data-act="stand" onClick={() => act("stand")} disabled={stage !== "PLAYER" || !legal.stand} style={{ ...S.play, ...S.btnRed, opacity: stage === "PLAYER" && legal.stand ? 1 : 0.4 }}>STAND</button>
            </div>
            <div style={S.row}>
              <button data-3d data-act="double" onClick={() => act("double")} disabled={stage !== "PLAYER" || !legal.double || !canAfford("double")} style={{ ...S.play, ...S.btnGold, opacity: stage === "PLAYER" && legal.double && canAfford("double") ? 1 : 0.4 }}>DOUBLE<small style={S.cost}>{g && legal.double ? `+${fmtK(extraCost(g, "double"))}` : ""}</small></button>
              <button data-3d data-act="split" onClick={() => act("split")} disabled={stage !== "PLAYER" || !legal.split || !canAfford("split")} style={{ ...S.play, ...S.btnBlue, opacity: stage === "PLAYER" && legal.split && canAfford("split") ? 1 : 0.4 }}>SPLIT<small style={S.cost}>{g && legal.split ? `+${fmtK(extraCost(g, "split"))}` : ""}</small></button>
            </div>
            <div style={S.status} data-status>{busy ? "카드를 나눠요…" : stage === "INSURANCE" ? "보험을 선택하세요" : isSplit ? `손 ${g.active + 1} / 2 차례` : "당신의 차례예요"}</div>
          </>
        )}

        {stage === "RESULT" && (
          <>
            <button data-3d data-act="again" onClick={againDeal} disabled={!lastBet || lastBet > bank} style={{ ...S.big, ...S.btnGold, opacity: !lastBet || lastBet > bank ? 0.5 : 1 }}>▶ 같은 금액으로 한 판 더 · {fmt(lastBet)}</button>
            <button data-3d data-act="newbet" onClick={() => toBetting(false)} style={{ ...S.big, ...S.btnGray, marginTop: 8 }}>베팅 바꾸기</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── 스타일 ──
const S = {
  root: { fontFamily: "'Inter', system-ui, sans-serif", color: "#fff", background: "linear-gradient(180deg,#1a0a14 0%,#0d0309 100%)", padding: "10px 12px 18px", boxSizing: "border-box", minHeight: "100%" },
  topBar: { display: "flex", alignItems: "center", gap: 8, paddingRight: 40, marginBottom: 8 },
  backBtn: { width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 16, cursor: "pointer", flexShrink: 0, boxShadow: EDGE(3) },
  title: { fontSize: 15, fontWeight: 900, letterSpacing: 1.5, color: "#E8C676", fontFamily: "Georgia, serif", whiteSpace: "nowrap" },
  sub: { fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  net: { fontSize: 10, fontWeight: 900, padding: "3px 9px", borderRadius: 12, border: "1px solid", background: "rgba(0,0,0,0.35)", whiteSpace: "nowrap" },
  iconBtn: { width: 32, height: 28, borderRadius: 8, border: "1px solid rgba(212,165,116,0.3)", background: "rgba(255,255,255,0.05)", color: "#fff", cursor: "pointer", fontSize: 13, boxShadow: EDGE(3) },
  points: { background: "linear-gradient(135deg, #FFD700, #D4A574)", color: "#000", padding: "6px 12px", borderRadius: 20, fontWeight: 900, fontSize: 13, whiteSpace: "nowrap", boxShadow: "0 3px 0 #8A5A14, 0 7px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.6)" },
  sceneWrap: { position: "relative", width: "100%", paddingBottom: "95%" },
  scene: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  badge: { position: "absolute", transform: "translateX(-50%)", padding: "2px 11px", borderRadius: 12, background: "rgba(0,0,0,0.78)", border: "1px solid rgba(255,255,255,0.22)", fontWeight: 900, whiteSpace: "nowrap", boxShadow: "0 3px 0 rgba(0,0,0,0.45)", zIndex: 20 },
  betPill: { marginLeft: 4, padding: "1px 9px", borderRadius: 10, background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,215,106,0.5)", color: "#FFD76A", fontWeight: 900 },
  hint: { position: "absolute", left: "50%", transform: "translateX(-50%)", fontSize: 12, fontWeight: 900, letterSpacing: 3, color: "#E3B23C", opacity: 0.85, animation: "bjRing 1.6s ease-in-out infinite", whiteSpace: "nowrap" },
  overlay: { position: "absolute", left: "50%", transform: "translate(-50%, -50%)", zIndex: 40, textAlign: "center", padding: "5px 16px", borderRadius: 12, background: "rgba(8,4,8,0.92)", border: "1.5px solid rgba(255,215,106,0.7)", boxShadow: "0 6px 16px rgba(0,0,0,0.7)", whiteSpace: "nowrap" },
  toast: { margin: "8px auto 0", maxWidth: 360, textAlign: "center", padding: "7px 12px", borderRadius: 12, background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,215,106,0.4)", fontSize: 12, fontWeight: 700, color: "#FFD76A" },
  panel: { marginTop: 12, padding: "12px 10px 12px", borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,165,116,0.2)" },
  chipRow: { display: "flex", justifyContent: "center", gap: 6, marginBottom: 6 },
  chipBtn: { position: "relative", display: "flex", flexDirection: "column", alignItems: "center", background: "transparent", border: "none", padding: 0, cursor: "pointer", transition: "transform .18s" },
  chipLabel: { fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.65)", marginTop: -2 },
  info: { textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 8 },
  row: { display: "flex", gap: 6, marginBottom: 6 },
  btn: { flex: 1, minWidth: 0, padding: "10px 4px", borderRadius: 10, border: "none", color: "#fff", fontSize: 11, fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" },
  play: { flex: 1, minWidth: 0, padding: "15px 4px", borderRadius: 14, border: "none", color: "#fff", fontSize: 15, fontWeight: 900, letterSpacing: 1, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 },
  cost: { fontSize: 9, fontWeight: 800, opacity: 0.85, minHeight: 11 },
  big: { width: "100%", padding: 16, borderRadius: 16, border: "none", fontSize: 15, fontWeight: 900, letterSpacing: 2, cursor: "pointer" },
  status: { textAlign: "center", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  btnGray: { background: "linear-gradient(135deg, #6B7280, #4B5563)", boxShadow: EDGE(4, "#1F2937") },
  btnDark: { background: "linear-gradient(135deg, #DC2626, #991B1B)", boxShadow: EDGE(4, "#450A0A") },
  btnBlue: { background: "linear-gradient(135deg, #3B82F6, #1D4ED8)", boxShadow: EDGE(4, "#1E3A8A") },
  btnGreen: { background: "linear-gradient(135deg, #10B981, #047857)", boxShadow: EDGE(5, "#064E3B") },
  btnRed: { background: "linear-gradient(135deg, #EF4444, #B91C1C)", boxShadow: EDGE(5, "#7F1D1D") },
  btnGold: { background: "linear-gradient(180deg, #FFF0B6 0%, #D7AD58 42%, #986526 100%)", color: "#1c1408", boxShadow: "0 6px 0 #63451F, 0 14px 22px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.65)", textShadow: "0 1px 0 rgba(255,255,255,0.25)" },
};
