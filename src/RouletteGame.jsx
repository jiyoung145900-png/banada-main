// ===================================================================
// 🎡 EUROPEAN ROULETTE v2
// ===================================================================
// · 실제 유럽식 휠(0~36, 정확한 숫자 순서/색) + 공 물리 애니메이션
//   (당첨 번호를 먼저 정하고, 공이 그 칸에 정확히 떨어지도록 계산)
// · 표준 베팅 테이블: 싱글/스플릿/스트리트/트리오/코너/퍼스트포/식스라인/
//   더즌/컬럼/홀짝·색·하이로우  (총 157개 자리, 전부 환수율 36/37)
// · 취소/전체지움/리벳/2배/자동스핀, 통계, 배당표, 사운드, 파산 처리
// 연결: points / onPointsChange(새 포인트) / onBack  (기존 로비와 동일)
// ===================================================================

import React, { useState, useRef, useEffect, useMemo } from "react";

// ────────────────────────────────────────────────────
// 1. 데이터
// ────────────────────────────────────────────────────
export const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const RED_SET = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = (n) => (n === 0 ? "green" : RED_SET.has(n) ? "red" : "black");
export const POCKET_DEG = 360 / 37;

const CHIPS = [500, 1000, 5000, 10000, 50000, 100000];
const MIN_CHIP = CHIPS[0];
const RESTART_POINTS = 10000; // 파산 시 지급 (로비 안내와 동일)

const rowOf = (n) => Math.floor((n - 1) / 3);
const colOf = (n) => (n - 1) % 3;

// ────────────────────────────────────────────────────
// 2. 베팅 자리 (정의 + 정산) — 순수 함수
// ────────────────────────────────────────────────────
export function buildSpots() {
  const spots = [];
  const add = (id, kind, nums, label) => spots.push({ id, kind, nums, pay: 36 / nums.length - 1, label });
  for (let n = 0; n <= 36; n++) add(`n:${n}`, "straight", [n], `싱글 ${n}`);
  // 스플릿: 가로(같은 줄 이웃) / 세로(위아래 이웃) / 0 과 첫 줄
  for (let r = 0; r < 12; r++) for (let c = 0; c < 2; c++) { const a = 3 * r + c + 1; add(`sp:${a}-${a + 1}`, "split", [a, a + 1], `스플릿 ${a}/${a + 1}`); }
  for (let r = 0; r < 11; r++) for (let c = 0; c < 3; c++) { const a = 3 * r + c + 1; add(`sp:${a}-${a + 3}`, "split", [a, a + 3], `스플릿 ${a}/${a + 3}`); }
  for (let c = 1; c <= 3; c++) add(`sp:0-${c}`, "split", [0, c], `스플릿 0/${c}`);
  for (let r = 0; r < 12; r++) add(`st:${r}`, "street", [3 * r + 1, 3 * r + 2, 3 * r + 3], `스트리트 ${3 * r + 1}-${3 * r + 3}`);
  add("tr:0-1-2", "trio", [0, 1, 2], "트리오 0/1/2");
  add("tr:0-2-3", "trio", [0, 2, 3], "트리오 0/2/3");
  for (let r = 0; r < 11; r++) for (let c = 0; c < 2; c++) { const a = 3 * r + c + 1; add(`co:${a}`, "corner", [a, a + 1, a + 3, a + 4], `코너 ${a}/${a + 1}/${a + 3}/${a + 4}`); }
  add("fo", "four", [0, 1, 2, 3], "퍼스트 포 0/1/2/3");
  for (let r = 0; r < 11; r++) add(`ln:${r}`, "line", [3 * r + 1, 3 * r + 2, 3 * r + 3, 3 * r + 4, 3 * r + 5, 3 * r + 6], `식스라인 ${3 * r + 1}-${3 * r + 6}`);
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  add("dz:1", "dozen", range(1, 12), "1st 12 (1-12)");
  add("dz:2", "dozen", range(13, 24), "2nd 12 (13-24)");
  add("dz:3", "dozen", range(25, 36), "3rd 12 (25-36)");
  for (let c = 0; c < 3; c++) add(`col:${c + 1}`, "column", range(1, 36).filter((n) => colOf(n) === c), `컬럼 ${c + 1}`);
  add("eo:low", "even-money", range(1, 18), "1-18");
  add("eo:even", "even-money", range(1, 36).filter((n) => n % 2 === 0), "짝수");
  add("eo:red", "even-money", range(1, 36).filter((n) => RED_SET.has(n)), "빨강");
  add("eo:black", "even-money", range(1, 36).filter((n) => !RED_SET.has(n)), "검정");
  add("eo:odd", "even-money", range(1, 36).filter((n) => n % 2 === 1), "홀수");
  add("eo:high", "even-money", range(19, 36), "19-36");
  return spots;
}
export const SPOTS = buildSpots();
export const SPOT_MAP = Object.fromEntries(SPOTS.map((s) => [s.id, s]));

export const sumBets = (bets) => Object.values(bets || {}).reduce((a, b) => a + (b > 0 ? b : 0), 0);

// 정산: 당첨 자리는 (원금 + 원금×배당) 을 돌려줌. 0 이 나오면 바깥 베팅은 전부 패.
export function settleBets(bets, win) {
  let payout = 0, stake = 0;
  const won = [];
  for (const [id, amt] of Object.entries(bets || {})) {
    const s = SPOT_MAP[id];
    if (!s || !(amt > 0)) continue;
    stake += amt;
    if (s.nums.includes(win)) { payout += amt * (s.pay + 1); won.push(id); }
  }
  return { payout, stake, net: payout - stake, won };
}

// 균일 난수 0..max-1 (crypto, rejection sampling)
export function secureInt(max) {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : null;
  if (!c || !c.getRandomValues) return Math.floor(Math.random() * max);
  const lim = Math.floor(0x100000000 / max) * max;
  const a = new Uint32Array(1);
  do { c.getRandomValues(a); } while (a[0] >= lim);
  return a[0] % max;
}

// ────────────────────────────────────────────────────
// 3. 공 / 휠 움직임 (당첨 번호에 정확히 안착하도록 닫힌 수식으로 계산)
// ────────────────────────────────────────────────────
export const R_TRACK = 160;  // 공이 도는 바깥 트랙 반경
export const R_POCKET = 111; // 포켓 안에 앉은 공 반경 (숫자 글씨 아래쪽 바닥 → 숫자를 가리지 않음)
export const WHEEL_IDLE = 16;   // 평상시 휠 회전 속도 (°/s)
const WHEEL_PEAK = 170;         // 스핀 직후 최고 속도 (°/s)
const S3 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export function makeSpinPlan({ win, wheel0 = 0, rel0 = 0, laps = 7, ms = 7600 }) {
  const k = WHEEL_ORDER.indexOf(win);
  if (k < 0) throw new Error("잘못된 번호");
  const pocketAngle = k * POCKET_DEG;
  // 시작 위치가 이전에 앉아 있던 자리와 같도록 laps 의 소수부를 맞춤 (시작할 때 공이 튀지 않음)
  const frac = ((((rel0 - pocketAngle) % 360) + 360) % 360) / 360;
  return { win, k, pocketAngle, wheel0, T: ms / 1000, L: laps + frac };
}

function wheelPhi(plan, t) {
  const T = plan.T, tA = 0.08 * T, v1 = WHEEL_IDLE, d = WHEEL_PEAK - WHEEL_IDLE, K = 1.8;
  const phiA = v1 * tA + 0.5 * d * tA;
  const phiAt = (tt) => {
    if (tt <= tA) { const x = tt / tA; return v1 * tt + d * tA * (x ** 3 - 0.5 * x ** 4); }
    const s = Math.min(1, (tt - tA) / (T - tA));
    return phiA + v1 * (tt - tA) + d * (T - tA) * (1 - (1 - s) ** (K + 1)) / (K + 1);
  };
  return t <= T ? phiAt(t) : phiAt(T) + v1 * (t - T);
}

export function spinState(plan, tSec) {
  const T = plan.T;
  const t = Math.max(0, tSec);
  const p = Math.min(1, t / T);
  const wheelDeg = plan.wheel0 + wheelPhi(plan, t);
  // 휠 기준 공의 각도: 휠 반대 방향으로 여러 바퀴 돌다가 감속하며 포켓 각도에 정확히 도착
  const e = 1 - (1 - p) ** 2.6;
  let rel = plan.pocketAngle + plan.L * 360 * (1 - e);
  let hop = 0;
  const B0 = 0.86;
  if (p > B0 && p < 1) { // 마지막에 포켓 사이를 튕기며 안착
    const u = (p - B0) / (1 - B0);
    const damp = (1 - u) * (1 - u);
    rel += 20 * Math.sin(2 * Math.PI * 2.5 * u) * damp;
    hop = 4.5 * Math.abs(Math.sin(2 * Math.PI * 2.5 * u)) * damp;
  }
  let r;
  if (p < 0.05) r = R_POCKET + (R_TRACK - R_POCKET) * S3(p / 0.05);
  else if (p < 0.62) r = R_TRACK;
  else if (p < 0.9) r = R_TRACK - (R_TRACK - R_POCKET) * S3((p - 0.62) / 0.28);
  else r = R_POCKET;
  r += hop;
  return { wheelDeg, ballDeg: wheelDeg + rel, rel, r, p, done: t >= T };
}

// ────────────────────────────────────────────────────
// 4. 테이블 레이아웃 (SVG 좌표) — 칸/클릭 영역 계산
// ────────────────────────────────────────────────────
const TP = 12, DZ = 48, CW = 72, RH = 30, ZH = 34, CBH = 30, EM = 48;
const X0 = TP + DZ;            // 숫자판 시작 x
const Y0 = TP + ZH;            // 1~36 시작 y
const X1 = X0 + 3 * CW;        // 숫자판 끝 x
const YB = Y0 + 12 * RH;       // 컬럼 베팅 줄 y
export const TABLE_VIEW = { w: X1 + EM + TP, h: YB + CBH + TP };
const EO_ORDER = ["low", "even", "red", "black", "odd", "high"];

export function buildTableLayout() {
  const area = {};      // 큰 칸 (싱글/더즌/컬럼/바깥)
  const hot = [];       // 경계/모서리 클릭 영역 (그리는 순서 = 겹칠 때 위에 올라오는 순서)
  const center = {};    // 칩을 올릴 중심 좌표
  const rect = (id, x, y, w, h) => { area[id] = { id, x, y, w, h }; center[id] = { cx: x + w / 2, cy: y + h / 2 }; };
  rect("n:0", X0, TP, 3 * CW, ZH);
  for (let n = 1; n <= 36; n++) rect(`n:${n}`, X0 + colOf(n) * CW, Y0 + rowOf(n) * RH, CW, RH);
  for (let k = 1; k <= 3; k++) rect(`dz:${k}`, TP, Y0 + (k - 1) * 4 * RH, DZ, 4 * RH);
  EO_ORDER.forEach((k, i) => rect(`eo:${k}`, X1, Y0 + i * 2 * RH, EM, 2 * RH));
  for (let c = 0; c < 3; c++) rect(`col:${c + 1}`, X0 + c * CW, YB, CW, CBH);

  const spot = (id, cx, cy, w, h) => { hot.push({ id, x: cx - w / 2, y: cy - h / 2, w, h, cx, cy }); center[id] = { cx, cy }; };
  for (let r = 0; r < 12; r++) for (let c = 0; c < 2; c++) { const a = 3 * r + c + 1; spot(`sp:${a}-${a + 1}`, X0 + (c + 1) * CW, Y0 + r * RH + RH / 2, 12, RH - 14); }
  for (let r = 0; r < 11; r++) for (let c = 0; c < 3; c++) { const a = 3 * r + c + 1; spot(`sp:${a}-${a + 3}`, X0 + c * CW + CW / 2, Y0 + (r + 1) * RH, CW - 18, 12); }
  for (let c = 0; c < 3; c++) spot(`sp:0-${c + 1}`, X0 + c * CW + CW / 2, Y0, CW - 18, 12);
  for (let r = 0; r < 12; r++) spot(`st:${r}`, X0, Y0 + r * RH + RH / 2, 14, RH - 14);
  for (let r = 0; r < 11; r++) spot(`ln:${r}`, X0, Y0 + (r + 1) * RH, 14, 14);
  spot("tr:0-1-2", X0 + CW, Y0, 14, 14);
  spot("tr:0-2-3", X0 + 2 * CW, Y0, 14, 14);
  spot("fo", X0, Y0, 14, 14);
  for (let r = 0; r < 11; r++) for (let c = 0; c < 2; c++) { const a = 3 * r + c + 1; spot(`co:${a}`, X0 + (c + 1) * CW, Y0 + (r + 1) * RH, 14, 14); }
  return { area, hot, center };
}
export const LAYOUT = buildTableLayout();

// 칩을 올릴 위치: 싱글은 숫자 글씨를 피해 칸의 오른쪽 아래로, 큰 칸은 라벨을 피한 곳으로
export function chipPos(id) {
  const a = LAYOUT.area[id];
  if (!a) return LAYOUT.center[id];
  if (id === "n:0") return { cx: a.x + a.w - 22, cy: a.y + a.h / 2 };
  if (id.startsWith("n:")) return { cx: a.x + a.w - 17, cy: a.y + a.h - 11.5 };
  if (id.startsWith("dz:")) return { cx: a.x + a.w / 2, cy: a.y + a.h - 24 };
  if (id.startsWith("col:")) return { cx: a.x + a.w - 12, cy: a.y + a.h / 2 + 1 };
  if (id.startsWith("eo:")) return { cx: a.x + a.w / 2, cy: a.y + a.h / 2 + (id === "eo:red" || id === "eo:black" ? 17 : 15) };
  return LAYOUT.center[id];
}

// ────────────────────────────────────────────────────
// 5. 표시 도우미
// ────────────────────────────────────────────────────
export const fmtAmt = (n) => (n >= 1000000 ? `${+(n / 1e6).toFixed(2)}M` : n >= 1000 ? `${+(n / 1000).toFixed(1)}K` : String(n));
const fmtP = (n) => Math.round(n).toLocaleString();

function chipTier(amount) {
  if (amount >= 100000) return { a: "#3a3a44", b: "#0d0d12", ring: "#E3B23C", text: "#E3B23C" };
  if (amount >= 50000) return { a: "#34d399", b: "#047857", ring: "#d1fae5", text: "#fff" };
  if (amount >= 10000) return { a: "#60a5fa", b: "#1d4ed8", ring: "#dbeafe", text: "#fff" };
  if (amount >= 5000) return { a: "#f87171", b: "#b91c1c", ring: "#fee2e2", text: "#fff" };
  if (amount >= 1000) return { a: "#fdfdfd", b: "#cfd3da", ring: "#9ca3af", text: "#1f2937" };
  return { a: "#d1d5db", b: "#6b7280", ring: "#f3f4f6", text: "#111827" };
}
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";

const injectCss = () => {
  if (typeof document === "undefined" || document.getElementById("roulette-v2-css")) return;
  const el = document.createElement("style");
  el.id = "roulette-v2-css";
  el.innerHTML = `
    @keyframes rlPulse { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
    @keyframes rlPop { 0% { transform: translate(-50%, 8px) scale(.85); opacity: 0 } 100% { transform: translate(-50%, 0) scale(1); opacity: 1 } }
    @keyframes rlCoin { 0% { transform: translateY(-30px) rotate(0deg); opacity: 0 } 12% { opacity: 1 } 100% { transform: translateY(300px) rotate(540deg); opacity: 0 } }
    @keyframes rlGlow { 0%,100% { filter: drop-shadow(0 0 2px #E3B23C) } 50% { filter: drop-shadow(0 0 7px #FFD76A) } }
  `;
  document.head.appendChild(el);
};

// ────────────────────────────────────────────────────
// 6. 휠 (SVG)
// ────────────────────────────────────────────────────
const WC = 200;
const pt = (r, deg) => { const a = (deg * Math.PI) / 180; return [WC + r * Math.sin(a), WC - r * Math.cos(a)]; };
const RO = 146, RI = 104, RL = 126;
function wedge(k) {
  const a0 = (k - 0.5) * POCKET_DEG, a1 = (k + 0.5) * POCKET_DEG;
  const [x0, y0] = pt(RI, a0), [x1, y1] = pt(RO, a0), [x2, y2] = pt(RO, a1), [x3, y3] = pt(RI, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} L${x1.toFixed(2)} ${y1.toFixed(2)} A${RO} ${RO} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L${x3.toFixed(2)} ${y3.toFixed(2)} A${RI} ${RI} 0 0 0 ${x0.toFixed(2)} ${y0.toFixed(2)}Z`;
}
const POCKET_FILL = { red: "url(#rlRed)", black: "url(#rlBlack)", green: "url(#rlGreen)" };

export function WheelSvg({ rotorRef, ballRef, shadowRef, init = {}, highlight = null }) {
  const wd = init.wheelDeg || 0, bd = init.ballDeg || 0, br = init.ballR || R_POCKET;
  const [bx, by] = pt(br, bd);
  const hk = highlight == null ? -1 : WHEEL_ORDER.indexOf(highlight);
  return (
    <svg viewBox="0 0 400 400" width="100%" style={{ display: "block", maxWidth: 380, margin: "0 auto" }} data-wheel>
      <defs>
        <radialGradient id="rlRim" cx="50%" cy="40%" r="70%"><stop offset="0%" stopColor="#7a4222" /><stop offset="60%" stopColor="#4a2312" /><stop offset="100%" stopColor="#200c05" /></radialGradient>
        <radialGradient id="rlTrack" cx="50%" cy="50%" r="50%"><stop offset="86%" stopColor="#2a1208" /><stop offset="94%" stopColor="#5b2f18" /><stop offset="100%" stopColor="#2a1208" /></radialGradient>
        <linearGradient id="rlRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d6283a" /><stop offset="100%" stopColor="#8f1322" /></linearGradient>
        <linearGradient id="rlBlack" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2b2b33" /><stop offset="100%" stopColor="#0c0c10" /></linearGradient>
        <linearGradient id="rlGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14a05a" /><stop offset="100%" stopColor="#0a6a3a" /></linearGradient>
        <radialGradient id="rlCone" cx="50%" cy="38%" r="70%"><stop offset="0%" stopColor="#4a2b1a" /><stop offset="100%" stopColor="#170a05" /></radialGradient>
        <radialGradient id="rlGold" cx="35%" cy="30%" r="80%"><stop offset="0%" stopColor="#FFF1B8" /><stop offset="45%" stopColor="#E3B23C" /><stop offset="100%" stopColor="#8a5a14" /></radialGradient>
        <radialGradient id="rlBall" cx="35%" cy="30%" r="75%"><stop offset="0%" stopColor="#ffffff" /><stop offset="70%" stopColor="#d6d9e0" /><stop offset="100%" stopColor="#8d92a0" /></radialGradient>
        <linearGradient id="rlGloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity=".12" /><stop offset="55%" stopColor="#fff" stopOpacity="0" /></linearGradient>
      </defs>

      {/* 바깥 목재 테두리 + 금장 */}
      <circle cx={WC} cy={WC} r="196" fill="url(#rlRim)" stroke="#E3B23C" strokeWidth="3" />
      <circle cx={WC} cy={WC} r="188" fill="none" stroke="#1a0903" strokeWidth="2" />
      {/* 공이 도는 트랙 (고정) */}
      <circle cx={WC} cy={WC} r="181" fill="url(#rlTrack)" stroke="#E3B23C" strokeOpacity=".55" strokeWidth="1" />
      <circle cx={WC} cy={WC} r="152" fill="#1b0a04" stroke="#E3B23C" strokeOpacity=".7" strokeWidth="1.5" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const [x, y] = pt(166, a);
        return <polygon key={a} points={`${x},${y - 6} ${x + 3.6},${y} ${x},${y + 6} ${x - 3.6},${y}`} transform={`rotate(${a} ${x} ${y})`} fill="url(#rlGold)" stroke="#5a3a0a" strokeWidth=".6" />;
      })}

      {/* 회전하는 휠 */}
      <g ref={rotorRef} transform={`rotate(${wd.toFixed(3)} ${WC} ${WC})`}>
        <circle cx={WC} cy={WC} r={RO + 3} fill="#0a0402" stroke="#E3B23C" strokeWidth="1.6" />
        {WHEEL_ORDER.map((n, k) => <path key={n} d={wedge(k)} fill={POCKET_FILL[colorOf(n)]} stroke="#E3B23C" strokeOpacity=".85" strokeWidth=".9" data-pocket={n} />)}
        {WHEEL_ORDER.map((n, k) => (
          <text key={`t${n}`} transform={`rotate(${(k * POCKET_DEG).toFixed(3)} ${WC} ${WC})`} x={WC} y={WC - RL} textAnchor="middle" dominantBaseline="central"
            fontSize="11.5" fontWeight="800" fill="#fff" stroke="rgba(0,0,0,.45)" strokeWidth=".4" style={{ fontFamily: "Inter, Arial, sans-serif" }}>{n}</text>
        ))}
        {hk >= 0 && <path d={wedge(hk)} fill="none" stroke="#FFE08A" strokeWidth="3" style={{ animation: "rlGlow 1.1s ease-in-out infinite" }} data-hit={highlight} />}
        <circle cx={WC} cy={WC} r={RI} fill="url(#rlCone)" stroke="#E3B23C" strokeWidth="2" />
        <circle cx={WC} cy={WC} r="86" fill="none" stroke="#E3B23C" strokeOpacity=".28" strokeWidth="1" />
        {[0, 90, 180, 270].map((a) => <path key={a} d={`M${WC} ${WC - 22} L${WC} ${WC - 84}`} stroke="url(#rlGold)" strokeWidth="5" strokeLinecap="round" transform={`rotate(${a} ${WC} ${WC})`} />)}
        {[45, 135, 225, 315].map((a) => { const [x, y] = pt(66, a); return <circle key={a} cx={x} cy={y} r="3.4" fill="#E3B23C" opacity=".85" />; })}
        <circle cx={WC} cy={WC} r="26" fill="url(#rlGold)" stroke="#5a3a0a" strokeWidth="1.5" />
        <circle cx={WC} cy={WC} r="9" fill="#5a3a0a" />
        <circle cx={WC - 3} cy={WC - 3} r="3" fill="#FFF1B8" opacity=".8" />
      </g>

      {/* 공 + 그림자 */}
      <circle ref={shadowRef} cx={(bx + 2).toFixed(2)} cy={(by + 3).toFixed(2)} r="7.4" fill="#000" opacity=".42" />
      <circle ref={ballRef} cx={bx.toFixed(2)} cy={by.toFixed(2)} r="7.4" fill="url(#rlBall)" stroke="rgba(0,0,0,.35)" strokeWidth=".6" data-ball />
      {/* 유리 반사 */}
      <ellipse cx="150" cy="118" rx="118" ry="64" transform="rotate(-28 150 118)" fill="url(#rlGloss)" pointerEvents="none" />
    </svg>
  );
}

// ────────────────────────────────────────────────────
// 7. 테이블 (SVG)
// ────────────────────────────────────────────────────
function ChipMark({ cx, cy, amount, glow, dim, small }) {
  const t = chipTier(amount);
  const k = small ? 0.8 : 1;
  const stack = amount >= 50000 ? 3 : amount >= 5000 ? 2 : 1;
  const label = fmtAmt(amount);
  return (
    <g pointerEvents="none" opacity={dim ? 0.28 : 1} transform={dim ? `translate(${cx} ${cy}) scale(${0.72 * k}) translate(${-cx} ${-cy})` : k !== 1 ? `translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})` : undefined} style={glow ? { animation: "rlGlow 1s ease-in-out infinite" } : undefined} data-chip={amount}>
      {Array.from({ length: stack }).map((_, i) => {
        const y = cy + (stack - 1 - i) * -1.8 + (stack - 1) * 0.9;
        return <ellipse key={i} cx={cx} cy={y + 1.4} rx="10.4" ry="9.6" fill="#000" opacity=".35" />;
      })}
      {Array.from({ length: stack }).map((_, i) => {
        const y = cy + (stack - 1 - i) * -1.8 + (stack - 1) * 0.9;
        return (
          <g key={`c${i}`}>
            <circle cx={cx} cy={y} r="10" fill={`url(#chip${t.a.slice(1)})`} stroke={t.ring} strokeWidth="1.1" />
            <circle cx={cx} cy={y} r="7.4" fill="none" stroke={t.ring} strokeOpacity=".75" strokeWidth=".7" strokeDasharray="2.2 2.2" />
          </g>
        );
      })}
      <text x={cx} y={cy - (stack - 1) * 0.9 + 0.2} textAnchor="middle" dominantBaseline="central" fontSize={label.length > 3 ? 6.4 : 7.6} fontWeight="800" fill={t.text} style={{ fontFamily: "Inter, Arial, sans-serif" }}>{label}</text>
    </g>
  );
}

const CHIP_TIERS = [500, 1000, 5000, 10000, 50000, 100000].map((v) => chipTier(v));

export function TableSvg({ bets = {}, resolved = null, winNumber = null, hoverId = null, flashNums = null, onSpot, onHover, onRemove, disabled }) {
  const hoverSpot = hoverId ? SPOT_MAP[hoverId] : null;
  const hl = new Set(flashNums || (hoverSpot ? hoverSpot.nums : []));
  const showBets = Object.keys(bets).length ? bets : resolved ? resolved.bets : {};
  const wonSet = new Set(!Object.keys(bets).length && resolved ? resolved.won : []);
  const isResolved = !Object.keys(bets).length && !!resolved;

  const cell = (n) => {
    const a = LAYOUT.area[`n:${n}`];
    const col = colorOf(n);
    const fill = col === "red" ? "url(#tbRed)" : col === "black" ? "url(#tbBlack)" : "url(#tbGreen)";
    return (
      <g key={n}>
        <rect x={a.x} y={a.y} width={a.w} height={a.h} fill={fill} stroke="#E3B23C" strokeOpacity=".55" strokeWidth=".9" />
        <text x={a.x + a.w / 2} y={a.y + a.h / 2 + (n === 0 ? 1 : 0)} textAnchor="middle" dominantBaseline="central" fontSize={n === 0 ? 18 : 15} fontWeight="800" fill="#fff" pointerEvents="none" style={{ fontFamily: SERIF }}>{n}</text>
      </g>
    );
  };
  const box = (id, label, opts = {}) => {
    const a = LAYOUT.area[id];
    const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
    return (
      <g key={id}>
        <rect x={a.x} y={a.y} width={a.w} height={a.h} fill="url(#tbFelt2)" stroke="#E3B23C" strokeOpacity=".55" strokeWidth=".9" />
        {opts.diamond ? (
          <>
            <rect x={cx - 10} y={cy - 22} width="20" height="20" transform={`rotate(45 ${cx} ${cy - 12})`} fill={opts.diamond} stroke="#E3B23C" strokeOpacity=".8" strokeWidth="1" pointerEvents="none" />
            <text x={cx} y={cy - 12} textAnchor="middle" dominantBaseline="central" fontSize="6.4" fontWeight="800" fill="#fff" letterSpacing=".4" pointerEvents="none" style={{ fontFamily: SERIF }}>{opts.name}</text>
          </>
        ) : (
          <text x={cx} y={cy + (/^eo:(low|even|odd|high)/.test(id) ? -10 : 0)} transform={opts.rot ? `rotate(${opts.rot} ${cx} ${cy})` : undefined} textAnchor="middle" dominantBaseline="central" fontSize={opts.fs || 11} fontWeight="800" fill="#F3E3C0" letterSpacing=".6" pointerEvents="none" style={{ fontFamily: SERIF }}>{label}</text>
        )}
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${TABLE_VIEW.w} ${TABLE_VIEW.h}`} width="100%" style={{ display: "block", touchAction: "manipulation", userSelect: "none", WebkitUserSelect: "none" }} data-table>
      <defs>
        <linearGradient id="tbFelt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0d6a42" /><stop offset="100%" stopColor="#06402a" /></linearGradient>
        <linearGradient id="tbFelt2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0c5a38" /><stop offset="100%" stopColor="#074a2e" /></linearGradient>
        <linearGradient id="tbRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#cf2a3b" /><stop offset="100%" stopColor="#97172a" /></linearGradient>
        <linearGradient id="tbBlack" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#272730" /><stop offset="100%" stopColor="#0e0e13" /></linearGradient>
        <linearGradient id="tbGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#13a05a" /><stop offset="100%" stopColor="#0a6c3b" /></linearGradient>
        {CHIP_TIERS.map((t) => <radialGradient key={t.a} id={`chip${t.a.slice(1)}`} cx="35%" cy="30%" r="80%"><stop offset="0%" stopColor={t.a} /><stop offset="100%" stopColor={t.b} /></radialGradient>)}
      </defs>
      <rect x="0" y="0" width={TABLE_VIEW.w} height={TABLE_VIEW.h} rx="10" fill="url(#tbFelt)" />
      <rect x="3" y="3" width={TABLE_VIEW.w - 6} height={TABLE_VIEW.h - 6} rx="8" fill="none" stroke="#E3B23C" strokeOpacity=".5" strokeWidth="1.4" />

      {Array.from({ length: 37 }, (_, n) => cell(n))}
      {box("dz:1", "1ST 12", { rot: -90 })}{box("dz:2", "2ND 12", { rot: -90 })}{box("dz:3", "3RD 12", { rot: -90 })}
      {box("eo:low", "1-18")}{box("eo:even", "EVEN")}{box("eo:red", "", { diamond: "#c01f31", name: "RED" })}{box("eo:black", "", { diamond: "#0e0e13", name: "BLK" })}{box("eo:odd", "ODD")}{box("eo:high", "19-36")}
      {box("col:1", "2:1", { fs: 12 })}{box("col:2", "2:1", { fs: 12 })}{box("col:3", "2:1", { fs: 12 })}

      {/* 선택한 자리가 덮는 숫자 강조 */}
      {[...hl].map((n) => { const a = LAYOUT.area[`n:${n}`]; return a ? <rect key={`h${n}`} x={a.x} y={a.y} width={a.w} height={a.h} fill="#fff" fillOpacity=".24" stroke="#FFE08A" strokeWidth="1.4" pointerEvents="none" data-hl={n} /> : null; })}
      {hoverSpot && !hoverSpot.nums.length ? null : hoverId && LAYOUT.area[hoverId] && !hoverId.startsWith("n:") ? <rect x={LAYOUT.area[hoverId].x} y={LAYOUT.area[hoverId].y} width={LAYOUT.area[hoverId].w} height={LAYOUT.area[hoverId].h} fill="#fff" fillOpacity=".12" stroke="#FFE08A" strokeWidth="1.4" pointerEvents="none" /> : null}
      {winNumber != null && (() => { const a = LAYOUT.area[`n:${winNumber}`]; return <rect x={a.x + 1} y={a.y + 1} width={a.w - 2} height={a.h - 2} fill="none" stroke="#FFE08A" strokeWidth="3" style={{ animation: "rlPulse 1s ease-in-out infinite" }} pointerEvents="none" data-win={winNumber} />; })()}

      {/* 모서리/경계 힌트 점 */}
      {LAYOUT.hot.filter((h) => /^(co|ln|tr|fo)/.test(h.id)).map((h) => <circle key={`d${h.id}`} cx={h.cx} cy={h.cy} r="1.7" fill="#FFE08A" opacity=".42" pointerEvents="none" />)}

      {/* 클릭 영역: 큰 칸 → 경계(스플릿/스트리트) → 모서리 순으로 위에 쌓임 */}
      {Object.values(LAYOUT.area).map((a) => (
        <rect key={`a${a.id}`} x={a.x} y={a.y} width={a.w} height={a.h} fill="transparent" style={{ cursor: disabled ? "default" : "pointer" }} data-spot={a.id}
          onClick={() => onSpot && onSpot(a.id)} onContextMenu={(e) => { e.preventDefault(); onRemove && onRemove(a.id); }}
          onPointerEnter={() => onHover && onHover(a.id)} onPointerLeave={() => onHover && onHover(null)} />
      ))}
      {LAYOUT.hot.map((h) => (
        <rect key={`s${h.id}`} x={h.x} y={h.y} width={h.w} height={h.h} fill="transparent" style={{ cursor: disabled ? "default" : "pointer" }} data-spot={h.id}
          onClick={(e) => { e.stopPropagation(); onSpot && onSpot(h.id); }} onContextMenu={(e) => { e.preventDefault(); onRemove && onRemove(h.id); }}
          onPointerEnter={() => onHover && onHover(h.id)} onPointerLeave={() => onHover && onHover(null)} />
      ))}

      {/* 올려둔 칩 */}
      {Object.entries(showBets).map(([id, amt]) => {
        const c = chipPos(id);
        if (!c || !(amt > 0)) return null;
        return <ChipMark key={`c${id}`} cx={c.cx} cy={c.cy} amount={amt} glow={isResolved && wonSet.has(id)} dim={isResolved && !wonSet.has(id)} small={id.startsWith("n:") || id.startsWith("eo:") && false} />;
      })}
    </svg>
  );
}

// ────────────────────────────────────────────────────
// 8. 메인 컴포넌트
// ────────────────────────────────────────────────────
export default function RouletteGame({ points = 100000, onPointsChange = () => {}, onBack = () => {}, rng = secureInt, spinMs = 7600 }) {
  injectCss();

  // ── 상태 ──
  const [bets, setBets] = useState({});
  const [betLog, setBetLog] = useState([]);                 // 칩 올린 순서 (취소용)
  const [chip, setChip] = useState(CHIPS[1]);
  const [phase, setPhase] = useState("betting");            // betting | spinning
  const [result, setResult] = useState(null);               // 마지막 결과 배너
  const [resolved, setResolved] = useState(null);           // 직전 판의 베팅/당첨 표시
  const [history, setHistory] = useState([]);               // 최근 결과 (최신이 앞)
  const [lastBets, setLastBets] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [flash, setFlash] = useState(null);
  const [auto, setAuto] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [toast, setToast] = useState("");
  const [coins, setCoins] = useState(false);
  const [showPay, setShowPay] = useState(false);

  // ── ref (최신 값을 타이머/애니메이션에서 읽기 위함) ──
  const rotorRef = useRef(null), ballRef = useRef(null), shadowRef = useRef(null), wheelCardRef = useRef(null);
  const simRef = useRef(null), pendingRef = useRef(null);
  const wheelDegRef = useRef(0), ballRelRef = useRef(0);
  const pointsRef = useRef(points); pointsRef.current = points;
  const onPointsRef = useRef(onPointsChange); onPointsRef.current = onPointsChange;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const betsRef = useRef(bets); betsRef.current = bets;
  const lastBetsRef = useRef(null); lastBetsRef.current = lastBets;
  const soundRef = useRef(soundOn); soundRef.current = soundOn;
  const aliveRef = useRef(true);
  const timersRef = useRef([]);
  const audioRef = useRef(null);
  const finishRef = useRef(null);
  const lastTickRef = useRef(0);

  const totalBet = sumBets(bets);
  const spinning = phase === "spinning";
  const available = points - totalBet;                      // 베팅 전: 아직 차감 안 된 포인트에서 올려둔 칩을 뺀 값
  const shownPoints = spinning ? points : Math.max(0, available);

  const showToast = (m) => {
    setToast(m);
    const id = setTimeout(() => setToast((t) => (t === m ? "" : t)), 2400);
    timersRef.current.push(id);
  };

  // ── 사운드 (AudioContext 하나를 재사용) ──
  const tone = (f1, f2, dur, vol, type = "triangle", delay = 0) => {
    if (!soundRef.current || typeof window === "undefined") return;
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const t = ctx.currentTime + delay;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f1, t);
      if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* 소리 실패는 무시 */ }
  };
  const sfx = {
    chip: () => tone(900, 600, 0.06, 0.05, "square"),
    undo: () => tone(500, 300, 0.08, 0.05, "sine"),
    launch: () => { tone(90, 240, 0.9, 0.05, "sawtooth"); tone(1400, 900, 0.12, 0.04, "square", 0.05); },
    tick: (v) => tone(2000, 1500, 0.025, Math.min(0.06, 0.02 + v * 0.04), "triangle"),
    drop: () => { tone(160, 60, 0.18, 0.12, "sine"); tone(1100, 700, 0.07, 0.05, "square"); },
    win: (big) => (big ? [523, 659, 784, 1047, 1319] : [523, 659, 784]).forEach((f, i) => tone(f, f, 0.22, 0.09, "triangle", i * 0.1)),
    lose: () => tone(220, 110, 0.35, 0.07, "sine"),
  };

  // ── 휠/공 애니메이션 루프 (React 상태가 아니라 DOM 속성을 직접 갱신 → 부드럽게) ──
  useEffect(() => {
    let raf = 0, last = null;
    const apply = (wheelDeg, ballDeg, r) => {
      if (rotorRef.current) rotorRef.current.setAttribute("transform", `rotate(${wheelDeg.toFixed(3)} ${WC} ${WC})`);
      const [x, y] = pt(r, ballDeg);
      if (ballRef.current) { ballRef.current.setAttribute("cx", x.toFixed(2)); ballRef.current.setAttribute("cy", y.toFixed(2)); }
      if (shadowRef.current) { shadowRef.current.setAttribute("cx", (x + 2).toFixed(2)); shadowRef.current.setAttribute("cy", (y + 3).toFixed(2)); }
    };
    const frame = (ts) => {
      raf = requestAnimationFrame(frame);
      if (typeof document !== "undefined" && document.hidden) { last = null; return; }
      const dt = last == null ? 0 : Math.min(0.1, (ts - last) / 1000);
      last = ts;
      const sim = simRef.current;
      if (sim) {
        if (sim.start == null) sim.start = ts;
        const s = spinState(sim.plan, (ts - sim.start) / 1000);
        wheelDegRef.current = s.wheelDeg;
        ballRelRef.current = s.rel;
        apply(s.wheelDeg, s.ballDeg, s.r);
        if (s.p > 0.7) { // 포켓 사이를 지날 때마다 '틱'
          const idx = Math.floor((((s.rel % 360) + 360) % 360 + POCKET_DEG / 2) / POCKET_DEG);
          if (idx !== sim.lastIdx && ts - lastTickRef.current > 45) { sim.lastIdx = idx; lastTickRef.current = ts; sfx.tick(1 - s.p); }
          if (!sim.dropped && s.p > 0.88) { sim.dropped = true; sfx.drop(); }
        }
        if (s.done) { simRef.current = null; finishRef.current && finishRef.current(); }
      } else {
        wheelDegRef.current += WHEEL_IDLE * dt;
        apply(wheelDegRef.current, wheelDegRef.current + ballRelRef.current, R_POCKET);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 정산 (결과 확정): 애니메이션이 끝나거나, 도중에 화면을 나갈 때 즉시 호출 ──
  const settleNow = () => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    simRef.current = null;
    const r = settleBets(p.bets, p.win);
    // 차감이 아직 화면에 반영되기 전이어도 이중 지급이 없도록 p.base 이하로 계산
    const base = Math.min(pointsRef.current, p.base);
    if (r.payout > 0) onPointsRef.current(base + r.payout);
    if (!aliveRef.current) return;
    ballRelRef.current = WHEEL_ORDER.indexOf(p.win) * POCKET_DEG;
    setResult({ win: p.win, color: colorOf(p.win), payout: r.payout, stake: r.stake, net: r.net });
    setResolved({ bets: p.bets, win: p.win, won: r.won });
    setHistory((h) => [p.win, ...h].slice(0, 60));
    setLastBets(p.bets);
    setBets({}); setBetLog([]);
    setPhase("betting");
    if (r.net > 0) {
      sfx.win(r.net >= r.stake * 10);
      setCoins(true);
      timersRef.current.push(setTimeout(() => aliveRef.current && setCoins(false), 2600));
    } else sfx.lose();
  };
  finishRef.current = settleNow;

  // 화면을 닫거나 페이지를 떠날 때 결과를 즉시 정산 (베팅금이 사라지지 않게)
  useEffect(() => {
    aliveRef.current = true;
    const onHide = () => settleNow();
    window.addEventListener("pagehide", onHide);
    return () => {
      aliveRef.current = false;
      window.removeEventListener("pagehide", onHide);
      timersRef.current.forEach(clearTimeout);
      settleNow();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 베팅 조작 ──
  const placeChip = (id) => {
    if (phaseRef.current !== "betting") return;
    if (chip > points - sumBets(betsRef.current)) { showToast("포인트가 부족합니다"); return; }
    sfx.chip();
    setResolved(null);
    setBets((b) => ({ ...b, [id]: (b[id] || 0) + chip }));
    setBetLog((l) => [...l, { id, amount: chip }]);
    const s = SPOT_MAP[id];
    setFlash(s ? s.nums : null);
    timersRef.current.push(setTimeout(() => aliveRef.current && setFlash(null), 520));
  };
  const removeFromSpot = (id) => {
    if (phaseRef.current !== "betting" || !betsRef.current[id]) return;
    const idx = [...betLog].reverse().findIndex((e) => e.id === id);
    if (idx < 0) return;
    const real = betLog.length - 1 - idx;
    const e = betLog[real];
    sfx.undo();
    setBetLog((l) => l.filter((_, i) => i !== real));
    setBets((b) => { const n = { ...b }; n[id] -= e.amount; if (n[id] <= 0) delete n[id]; return n; });
  };
  const undo = () => {
    if (phaseRef.current !== "betting" || !betLog.length) return;
    const e = betLog[betLog.length - 1];
    sfx.undo();
    setBetLog((l) => l.slice(0, -1));
    setBets((b) => { const n = { ...b }; n[e.id] -= e.amount; if (n[e.id] <= 0) delete n[e.id]; return n; });
  };
  const clearAll = () => { if (phaseRef.current !== "betting") return; if (totalBet) sfx.undo(); setBets({}); setBetLog([]); };
  const rebet = () => {
    if (phaseRef.current !== "betting" || !lastBets) return;
    const t = sumBets(lastBets);
    if (t > points) { showToast("포인트가 부족합니다"); return; }
    sfx.chip(); setResolved(null);
    setBets({ ...lastBets });
    setBetLog(Object.entries(lastBets).map(([id, amount]) => ({ id, amount })));
  };
  const doubleBets = () => {
    if (phaseRef.current !== "betting" || !totalBet) return;
    if (totalBet * 2 > points) { showToast("포인트가 부족합니다"); return; }
    sfx.chip();
    setBets((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v * 2])));
    setBetLog((l) => [...l, ...l.map((e) => ({ ...e }))]);
  };

  // ── 스핀 시작 ──
  const startSpin = (betsToUse) => {
    if (phaseRef.current !== "betting") return false;
    const total = sumBets(betsToUse);
    if (total < MIN_CHIP) { showToast("베팅을 먼저 해주세요"); return false; }
    if (total > pointsRef.current) { showToast("포인트가 부족합니다"); return false; }
    const win = rng(37);
    const plan = makeSpinPlan({ win, wheel0: wheelDegRef.current, rel0: ballRelRef.current, laps: 6 + rng(3), ms: spinMs });
    const base = pointsRef.current - total;
    pendingRef.current = { bets: { ...betsToUse }, win, total, base };
    onPointsRef.current(base);                               // 베팅금 차감 (1번만 저장)
    setBets({ ...betsToUse });
    setResult(null); setResolved(null); setCoins(false);
    setPhase("spinning"); phaseRef.current = "spinning";
    simRef.current = { plan, start: null, lastIdx: -1, dropped: false };
    sfx.launch();
    if (wheelCardRef.current && wheelCardRef.current.scrollIntoView) { try { wheelCardRef.current.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {} }
    return true;
  };
  const spin = () => startSpin(bets);

  // 자동 스핀: 결과가 나온 뒤 같은 베팅으로 다시 돌림
  useEffect(() => {
    if (!auto || phase !== "betting" || !result) return;
    const id = setTimeout(() => {
      const lb = lastBetsRef.current;
      if (!lb || sumBets(lb) > pointsRef.current) { setAuto(false); showToast("포인트가 부족해 자동 스핀을 멈췄어요"); return; }
      setBets({ ...lb }); setBetLog(Object.entries(lb).map(([id2, amount]) => ({ id: id2, amount })));
      startSpin(lb);
    }, 2600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, phase, result]);
  const toggleAuto = () => {
    if (auto) { setAuto(false); return; }
    setAuto(true);
    if (phase === "betting") {
      if (totalBet) startSpin(bets);
      else if (lastBets) { setBets({ ...lastBets }); setBetLog(Object.entries(lastBets).map(([id, amount]) => ({ id, amount }))); startSpin(lastBets); }
    }
  };

  // 파산 시 지급 (로비 안내: 파산 시 자동으로 10,000P)
  useEffect(() => {
    if (phase !== "betting" || pendingRef.current || points >= MIN_CHIP) return;
    const id = setTimeout(() => {
      if (pointsRef.current < MIN_CHIP && !pendingRef.current) { onPointsRef.current(RESTART_POINTS); showToast(`파산! ${fmtP(RESTART_POINTS)}P 를 지급했어요`); setAuto(false); }
    }, 1200);
    return () => clearTimeout(id);
  }, [points, phase]);

  // ── 통계 ──
  const stats = useMemo(() => {
    const n = history.length;
    const cnt = (f) => history.filter(f).length;
    const freq = {};
    history.forEach((h) => { freq[h] = (freq[h] || 0) + 1; });
    const ranked = Object.entries(freq).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const cold = Array.from({ length: 37 }, (_, i) => i).map((i) => ({ i, last: history.indexOf(i) })).sort((a, b) => (b.last < 0 ? 999 : b.last) - (a.last < 0 ? 999 : a.last) || a.i - b.i);
    return {
      n,
      red: cnt((h) => colorOf(h) === "red"), black: cnt((h) => colorOf(h) === "black"), zero: cnt((h) => h === 0),
      hot: ranked.slice(0, 3).map(([k, v]) => ({ n: +k, c: v })), cold: cold.slice(0, 3).map((x) => x.i),
    };
  }, [history]);
  const pct = (v) => (stats.n ? Math.round((v / stats.n) * 100) : 0);
  const hoverSpot = hoverId ? SPOT_MAP[hoverId] : null;
  const canSpin = !spinning && totalBet >= MIN_CHIP && totalBet <= points;
  const resColor = result ? (result.color === "red" ? "#d6283a" : result.color === "black" ? "#16161c" : "#12a05a") : "#16161c";

  return (
    <div style={S.container} data-roulette>
      {/* 헤더 */}
      <div style={S.header}>
        <button onClick={() => !spinning && onBack()} disabled={spinning} style={{ ...S.backBtn, opacity: spinning ? 0.4 : 1 }}>← LOBBY</button>
        <h2 style={S.title}>EUROPEAN ROULETTE</h2>
        <div style={S.points}>💎 {fmtP(shownPoints)}</div>
      </div>
      <div style={S.subHeader}>
        <span style={S.tag}><span style={{ color: "#EF4444" }}>●</span> LIVE · 싱글 제로 · 환수율 97.3%</span>
        <button onClick={() => setSoundOn((v) => !v)} style={S.iconBtn} aria-label="sound">{soundOn ? "🔊" : "🔇"}</button>
      </div>

      {/* 최근 결과 */}
      <div style={S.historyBar}>
        {history.length === 0 && <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>첫 스핀을 기다리는 중…</span>}
        {history.slice(0, 18).map((h, i) => (
          <div key={`${i}-${h}`} style={{ ...S.dot, background: colorOf(h) === "red" ? "#c9283a" : colorOf(h) === "black" ? "#1b1b22" : "#12a05a", opacity: i === 0 ? 1 : Math.max(0.45, 1 - i * 0.04), boxShadow: i === 0 ? "0 0 0 2px #E3B23C" : "none" }}>{h}</div>
        ))}
      </div>

      {/* 휠 */}
      <div ref={wheelCardRef} style={S.wheelCard}>
        <WheelSvg rotorRef={rotorRef} ballRef={ballRef} shadowRef={shadowRef} highlight={!spinning && result ? result.win : null}
          init={{ wheelDeg: 0, ballDeg: 0, ballR: R_POCKET }} />
        {spinning && <div style={S.spinBadge}>NO MORE BETS</div>}
        {result && !spinning && (
          <div style={S.resultBox} data-result>
            <div style={{ ...S.resultBall, background: resColor }}>{result.win}</div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", letterSpacing: 2 }}>RESULT</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: result.net > 0 ? "#FFD76A" : result.net === 0 ? "#fff" : "#9aa0ad", fontFamily: SERIF }}>
                {result.stake === 0 ? "—" : result.net > 0 ? `+${fmtP(result.net)}` : result.net === 0 ? "원금 반환" : `-${fmtP(Math.abs(result.net))}`}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.55)" }}>{result.payout > 0 ? `지급 ${fmtP(result.payout)}` : "당첨 없음"}</div>
            </div>
          </div>
        )}
        {coins && (
          <div style={S.coinLayer} aria-hidden>
            {Array.from({ length: 16 }).map((_, i) => (
              <span key={i} style={{ position: "absolute", top: 0, left: `${(i * 37) % 92 + 2}%`, fontSize: 22 + (i % 3) * 4, animation: `rlCoin ${1.6 + (i % 5) * 0.18}s ${(i % 8) * 0.09}s ease-in forwards` }}>🪙</span>
            ))}
          </div>
        )}
      </div>

      {/* 통계 */}
      {stats.n >= 5 && (
        <div style={S.statsRow}>
          <span style={{ color: "#f87171" }}>RED {pct(stats.red)}%</span>
          <span style={{ color: "#cbd0da" }}>BLACK {pct(stats.black)}%</span>
          <span style={{ color: "#34d399" }}>0 {pct(stats.zero)}%</span>
          <span>HOT {stats.hot.map((h) => h.n).join("·") || "-"}</span>
          <span>COLD {stats.cold.join("·")}</span>
        </div>
      )}

      {/* 베팅 테이블 */}
      <div style={S.tableCard}>
        <div style={S.tableHead}>
          <span style={{ fontFamily: SERIF, fontWeight: 800, letterSpacing: 2, color: "#E3B23C", fontSize: 12 }}>BETTING TABLE</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,.5)" }}>숫자 사이 경계·모서리를 누르면 스플릿/코너</span>
        </div>
        <TableSvg bets={bets} resolved={resolved} winNumber={!spinning && result ? result.win : null}
          hoverId={spinning ? null : hoverId} flashNums={flash} disabled={spinning}
          onSpot={placeChip} onRemove={removeFromSpot} onHover={setHoverId} />
        <div style={S.hoverInfo}>
          {hoverSpot ? <><b style={{ color: "#FFE08A" }}>{hoverSpot.label}</b> · 배당 <b>{hoverSpot.pay}:1</b> · {hoverSpot.nums.length}칸</> : "자리를 누르면 배당과 적용 숫자가 보여요 · 우클릭으로 칩 하나 빼기"}
        </div>
      </div>

      {/* 배당표 */}
      <div style={S.payBox}>
        <button onClick={() => setShowPay((v) => !v)} style={S.payToggle}>{showPay ? "▲" : "▼"} 배당표 · 베팅 종류</button>
        {showPay && (
          <div style={S.payGrid}>
            {[["싱글 (숫자 1개)", "35 : 1"], ["스플릿 (2개)", "17 : 1"], ["스트리트·트리오 (3개)", "11 : 1"], ["코너·퍼스트 포 (4개)", "8 : 1"], ["식스라인 (6개)", "5 : 1"], ["더즌·컬럼 (12개)", "2 : 1"], ["빨강·검정·홀짝·1-18·19-36", "1 : 1"]].map(([a, b]) => (
              <React.Fragment key={a}><span>{a}</span><b style={{ color: "#E3B23C" }}>{b}</b></React.Fragment>
            ))}
            <span style={{ gridColumn: "1 / -1", fontSize: 10, color: "rgba(255,255,255,.45)" }}>0 이 나오면 빨강·검정·홀짝·더즌·컬럼 등 바깥 베팅은 모두 집니다.</span>
          </div>
        )}
      </div>

      {toast && <div style={S.toast}>{toast}</div>}

      {/* 하단 고정 컨트롤 */}
      <div style={S.controlBar}>
        <div style={S.chipRow}>
          {CHIPS.map((v) => {
            const t = chipTier(v);
            const sel = chip === v;
            return (
              <button key={v} onClick={() => setChip(v)} disabled={spinning} data-chip-btn={v}
                style={{ ...S.chipBtn, background: `radial-gradient(circle at 35% 30%, ${t.a}, ${t.b})`, color: t.text, border: sel ? "3px solid #FFD76A" : `2px dashed ${t.ring}`,
                  transform: sel ? "translateY(-4px) scale(1.08)" : "none", boxShadow: sel ? "0 8px 16px rgba(255,215,106,.35)" : "0 3px 8px rgba(0,0,0,.5)", opacity: spinning ? 0.5 : 1 }}>
                {fmtAmt(v)}
              </button>
            );
          })}
        </div>
        <div style={S.actionRow}>
          <div style={S.totalBox}><div style={{ fontSize: 9, letterSpacing: 2, color: "rgba(255,255,255,.5)" }}>TOTAL BET</div><div data-total style={{ fontSize: 16, fontWeight: 900, color: "#FFD76A" }}>{fmtP(totalBet)}</div></div>
          <button onClick={undo} disabled={spinning || !betLog.length} style={{ ...S.smallBtn, opacity: spinning || !betLog.length ? 0.35 : 1 }} data-act="undo">↶ 취소</button>
          <button onClick={clearAll} disabled={spinning || !totalBet} style={{ ...S.smallBtn, opacity: spinning || !totalBet ? 0.35 : 1 }} data-act="clear">🗑 지우기</button>
          <button onClick={rebet} disabled={spinning || !lastBets} style={{ ...S.smallBtn, opacity: spinning || !lastBets ? 0.35 : 1 }} data-act="rebet">⟲ 리벳</button>
          <button onClick={doubleBets} disabled={spinning || !totalBet} style={{ ...S.smallBtn, opacity: spinning || !totalBet ? 0.35 : 1 }} data-act="double">×2</button>
        </div>
        <div style={S.spinRow}>
          <button onClick={toggleAuto} disabled={spinning && !auto} style={{ ...S.autoBtn, background: auto ? "linear-gradient(135deg,#34d399,#047857)" : "rgba(255,255,255,.06)", color: auto ? "#fff" : "#E3B23C" }} data-act="auto">{auto ? "■ AUTO ON" : "▶ AUTO"}</button>
          <button onClick={spin} disabled={!canSpin} style={{ ...S.spinBtn, opacity: canSpin ? 1 : 0.5 }} data-act="spin">{spinning ? "SPINNING…" : `SPIN${totalBet ? ` · ${fmtP(totalBet)}` : ""}`}</button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────
// 9. 스타일
// ────────────────────────────────────────────────────
const S = {
  container: { fontFamily: "'Inter', sans-serif", padding: "14px 12px 0", color: "#fff", position: "relative", boxSizing: "border-box" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6, paddingRight: 44 },
  backBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", padding: "7px 12px", borderRadius: 18, cursor: "pointer", fontSize: 11, fontWeight: 700 },
  title: { margin: 0, fontSize: 15, fontWeight: 900, letterSpacing: 2, background: "linear-gradient(135deg, #E3B23C, #fff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontFamily: SERIF },
  points: { background: "linear-gradient(135deg, #FFD700, #D4A574)", color: "#000", padding: "6px 13px", borderRadius: 18, fontWeight: 900, fontSize: 13, whiteSpace: "nowrap" },
  subHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  tag: { fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: "rgba(212,165,116,.85)" },
  iconBtn: { width: 32, height: 28, borderRadius: 8, border: "1px solid rgba(212,165,116,.3)", background: "rgba(255,255,255,.05)", color: "#fff", cursor: "pointer", fontSize: 13 },
  historyBar: { display: "flex", gap: 4, alignItems: "center", overflowX: "auto", padding: "6px 2px", marginBottom: 8, minHeight: 34 },
  dot: { minWidth: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 },
  wheelCard: { position: "relative", padding: "10px 6px 6px", borderRadius: 22, background: "radial-gradient(circle at 50% 40%, #2a0f1f 0%, #12050d 75%)", border: "1px solid rgba(227,178,60,.3)", boxShadow: "0 14px 40px rgba(0,0,0,.5), inset 0 0 40px rgba(0,0,0,.5)", marginBottom: 10, overflow: "hidden" },
  spinBadge: { position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", fontSize: 10, fontWeight: 900, letterSpacing: 3, color: "#fff", background: "rgba(239,68,68,.85)", padding: "4px 12px", borderRadius: 12 },
  resultBox: { position: "absolute", left: "50%", bottom: 12, display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", borderRadius: 16, background: "rgba(8,3,6,.88)", border: "1.5px solid #E3B23C", backdropFilter: "blur(4px)", animation: "rlPop .45s ease-out forwards", transform: "translateX(-50%)" },
  resultBall: { width: 46, height: 46, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, fontWeight: 900, border: "2.5px solid #E3B23C", fontFamily: SERIF },
  coinLayer: { position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" },
  statsRow: { display: "flex", flexWrap: "wrap", gap: "4px 12px", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.65)", letterSpacing: .6, marginBottom: 8 },
  tableCard: { padding: 8, borderRadius: 18, background: "linear-gradient(180deg, #3a1d10, #22100a)", border: "1px solid rgba(227,178,60,.35)", boxShadow: "0 10px 28px rgba(0,0,0,.45)", marginBottom: 8 },
  tableHead: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 6px 8px", gap: 8, flexWrap: "wrap" },
  hoverInfo: { textAlign: "center", fontSize: 11, color: "rgba(255,255,255,.7)", padding: "8px 4px 2px", minHeight: 20 },
  payBox: { marginBottom: 8 },
  payToggle: { width: "100%", padding: "9px 12px", background: "rgba(255,255,255,.04)", border: "1px dashed rgba(227,178,60,.3)", borderRadius: 12, color: "#E3B23C", fontSize: 11, fontWeight: 800, cursor: "pointer", textAlign: "left", letterSpacing: 1 },
  payGrid: { display: "grid", gridTemplateColumns: "1fr auto", gap: "6px 14px", padding: "10px 14px", fontSize: 12, color: "rgba(255,255,255,.8)", background: "rgba(255,255,255,.03)", borderRadius: 12, marginTop: 6 },
  toast: { position: "fixed", bottom: 168, left: "50%", transform: "translateX(-50%)", background: "rgba(20,20,25,.96)", border: "1px solid rgba(227,178,60,.5)", color: "#F0D4B8", padding: "9px 18px", borderRadius: 22, fontSize: 12, fontWeight: 700, zIndex: 10100, boxShadow: "0 8px 24px rgba(0,0,0,.5)", maxWidth: "90vw", textAlign: "center" },
  controlBar: { position: "sticky", bottom: 0, margin: "0 -12px", padding: "10px 12px 14px", background: "linear-gradient(180deg, rgba(18,4,14,.92), rgba(12,2,9,.98))", backdropFilter: "blur(8px)", borderTop: "1px solid rgba(227,178,60,.3)", zIndex: 20 },
  chipRow: { display: "flex", justifyContent: "space-between", gap: 6, marginBottom: 10 },
  chipBtn: { flex: 1, maxWidth: 52, height: 46, borderRadius: "50%", fontWeight: 900, fontSize: 11, cursor: "pointer", transition: "all .18s" },
  actionRow: { display: "flex", gap: 6, alignItems: "stretch", marginBottom: 8 },
  totalBox: { flex: 1.3, background: "rgba(255,255,255,.06)", borderRadius: 12, padding: "6px 10px", textAlign: "center" },
  smallBtn: { flex: 1, minWidth: 0, background: "rgba(255,255,255,.07)", border: "1px solid rgba(227,178,60,.25)", color: "#F0D4B8", borderRadius: 12, fontSize: 11, fontWeight: 800, cursor: "pointer", padding: "0 2px" },
  spinRow: { display: "flex", gap: 8 },
  autoBtn: { flex: 1, padding: "14px 6px", borderRadius: 14, border: "1px solid rgba(227,178,60,.35)", fontSize: 12, fontWeight: 900, cursor: "pointer", letterSpacing: 1 },
  spinBtn: { flex: 2.4, padding: 14, borderRadius: 14, border: "none", background: "linear-gradient(135deg, #E63975, #FF6B9D)", color: "#fff", fontSize: 16, fontWeight: 900, letterSpacing: 2, cursor: "pointer", boxShadow: "0 8px 22px rgba(230,57,117,.4)" },
};