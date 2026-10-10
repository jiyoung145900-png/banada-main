// ===================================================================
// 🎡 RouletteGame - 유럽식 룰렛 (0~36)
// ===================================================================
// Props:
//   points: 현재 포인트
//   onPointsChange: 포인트 변경 콜백
//   onBack: 로비로 돌아가기
// ===================================================================

import { useState, useRef, useEffect } from "react";

const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

function getColor(n) {
  if (n === 0) return "green";
  return RED_NUMBERS.includes(n) ? "red" : "black";
}

export default function RouletteGame({ points, onPointsChange, onBack }) {
  const [bets, setBets] = useState({});
  const [chipAmount, setChipAmount] = useState(1000);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [rotation, setRotation] = useState(0);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [lastWinNum, setLastWinNum] = useState(null);

  const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);
  const canSpin = totalBet > 0 && !isSpinning && points >= totalBet;

  const audioCtxRef = useRef(null);
  const wheelRef = useRef(null);

  // 오디오 초기화
  useEffect(() => {
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
  }, []);

  const playSound = (type) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "spin") {
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      gain.gain.value = 0.3;
      osc.type = "sawtooth";
      osc.start();
      setTimeout(() => osc.stop(), 2800);
    } else if (type === "win") {
      osc.frequency.setValueAtTime(920, ctx.currentTime);
      gain.gain.value = 0.6;
      osc.type = "sine";
      osc.start();
      setTimeout(() => osc.stop(), 180);
    } else if (type === "bet") {
      osc.frequency.setValueAtTime(420, ctx.currentTime);
      gain.gain.value = 0.4;
      osc.type = "sawtooth";
      osc.start();
      setTimeout(() => osc.stop(), 120);
    }
  };

  const placeBet = (betType) => {
    if (isSpinning) return;
    setBets(prev => ({ ...prev, [betType]: (prev[betType] || 0) + chipAmount }));
    playSound("bet");
  };

  const clearBets = () => {
    if (isSpinning) return;
    setBets({});
  };

  const spin = async () => {
    if (!canSpin) return;
    setIsSpinning(true);
    setResult(null);
    setWheelRotation(0);
    playSound("spin");

    const winNum = Math.floor(Math.random() * 37);
    const winIdx = WHEEL.indexOf(winNum);
    const slotDeg = 360 / 37;
    const finalRotation = 1800 + (360 - winIdx * slotDeg);

    setWheelRotation(finalRotation);
    setLastWinNum(winNum);

    await new Promise(r => setTimeout(r, 4200));

    const winColor = getColor(winNum);
    let totalPayout = 0;

    for (const [bet, amount] of Object.entries(bets)) {
      let won = false;
      let mult = 0;

      if (bet === String(winNum)) { won = true; mult = 36; }
      else if (bet === "red" && winColor === "red") { won = true; mult = 2; }
      else if (bet === "black" && winColor === "black") { won = true; mult = 2; }
      else if (bet === "even" && winNum % 2 === 0) { won = true; mult = 2; }
      else if (bet === "odd" && winNum % 2 === 1) { won = true; mult = 2; }
      else if (bet === "low" && winNum <= 18) { won = true; mult = 2; }
      else if (bet === "high" && winNum >= 19) { won = true; mult = 2; }
      else if (bet === "dozen1" && winNum <= 12) { won = true; mult = 3; }
      else if (bet === "dozen2" && winNum <= 24) { won = true; mult = 3; }
      else if (bet === "dozen3" && winNum > 24) { won = true; mult = 3; }

      if (won) totalPayout += amount * mult;
    }

    const netChange = totalPayout - totalBet;
    onPointsChange(points + netChange);

    setResult({ number: winNum, color: winColor, payout: totalPayout, netChange });
    setHistory(prev => [{ num: winNum, color: winColor }, ...prev].slice(0, 10));
    setIsSpinning(false);
  };

  const resetRound = () => {
    setBets({});
    setResult(null);
  };

  return (
    <div style={S.container}>
      {/* 헤더 */}
      <div style={S.header}>
        <button onClick={onBack} style={S.backBtn}>← 로비</button>
        <h2 style={S.title}>🎡 Roulette</h2>
        <div style={S.points}>💎 {points.toLocaleString()}</div>
      </div>

      {/* 히스토리 */}
      {history.length > 0 && (
        <div style={S.history}>
          <span style={S.historyLabel}>최근:</span>
          {history.map((h, i) => (
            <span
              key={i}
              style={{
                ...S.historyChip,
                background: h.color === "red" ? "#E63975" : h.color === "black" ? "#1F0817" : "#10B981",
              }}
            >
              {h.num}
            </span>
          ))}
        </div>
      )}

      {/* 룰렛 휠 */}
      <div style={S.wheelWrap}>
        <div style={S.pointer}>▼</div>
        <div
          ref={wheelRef}
          style={{
            ...S.wheel,
            transform: `rotate(${wheelRotation}deg)`,
            transition: isSpinning ? "transform 4.2s cubic-bezier(0.1, 0.7, 0.1, 1)" : "none",
          }}
        >
          {WHEEL.map((n, i) => {
            const angle = (360 / 37) * i;
            const color = getColor(n);
            return (
              <div
                key={i}
                style={{
                  ...S.wheelSlot,
                  background: color === "red" ? "#E63975" : color === "black" ? "#1F0817" : "#10B981",
                  transform: `rotate(${angle}deg) translateY(-108px)`,
                }}
              >
                {n}
              </div>
            );
          })}
          <div style={S.wheelCenter}>🌸</div>
        </div>
      </div>

      {/* 결과 */}
      {result && (
        <div
          style={{
            ...S.resultMsg,
            background: result.netChange > 0
              ? "linear-gradient(135deg, #10B981, #059669)"
              : "linear-gradient(135deg, #EF4444, #DC2626)",
          }}
        >
          🎯 {result.number} ({result.color === "red" ? "빨강" : result.color === "black" ? "검정" : "그린"})
          <div style={S.resultSub}>
            {result.netChange > 0 ? `+${result.netChange.toLocaleString()}P 획득!` : `${result.netChange.toLocaleString()}P`}
          </div>
        </div>
      )}

      {/* 베팅 UI */}
      {!isSpinning && (
        <>
          {/* 칩 선택 */}
          <div style={S.chipRow}>
            {[1000, 5000, 10000, 50000, 100000].map((v) => (
              <button
                key={v}
                onClick={() => setChipAmount(v)}
                style={{ ...S.chip, ...(chipAmount === v ? S.chipActive : {}) }}
              >
                {v >= 10000 ? `${v / 10000}만` : `${v / 1000}천`}
              </button>
            ))}
          </div>

          {/* 베팅 테이블 */}
          <div style={S.betTable}>
            <div style={S.betRow}>
              <BetButton label="RED" color="#E63975" onClick={() => placeBet("red")} active={bets.red} />
              <BetButton label="BLACK" color="#1F0817" onClick={() => placeBet("black")} active={bets.black} />
            </div>
            <div style={S.betRow}>
              <BetButton label="ODD" color="#D4A574" onClick={() => placeBet("odd")} active={bets.odd} />
              <BetButton label="EVEN" color="#D4A574" onClick={() => placeBet("even")} active={bets.even} />
            </div>
            <div style={S.betRow}>
              <BetButton label="1-18" color="#4e1835" onClick={() => placeBet("low")} active={bets.low} />
              <BetButton label="19-36" color="#4e1835" onClick={() => placeBet("high")} active={bets.high} />
            </div>
            <div style={S.betRow}>
              <BetButton label="1-12" color="#FF6B9D" onClick={() => placeBet("dozen1")} active={bets.dozen1} small />
              <BetButton label="13-24" color="#FF6B9D" onClick={() => placeBet("dozen2")} active={bets.dozen2} small />
              <BetButton label="25-36" color="#FF6B9D" onClick={() => placeBet("dozen3")} active={bets.dozen3} small />
            </div>
          </div>

          {/* 현재 베팅 요약 */}
          {totalBet > 0 && (
            <div style={S.betSummary}>
              총 베팅: {totalBet.toLocaleString()}P
              <button onClick={clearBets} style={S.clearBtn}>초기화</button>
            </div>
          )}
        </>
      )}

      {/* 액션 버튼 */}
      <div style={S.actions}>
        {result ? (
          <button onClick={resetRound} style={S.spinBtn}>다시 베팅</button>
        ) : (
          <button
            onClick={spin}
            disabled={!canSpin}
            style={{ ...S.spinBtn, opacity: canSpin ? 1 : 0.4 }}
          >
            {isSpinning ? "🎡 돌아가는 중..." : totalBet > 0 ? "스핀!" : "베팅 먼저"}
          </button>
        )}
      </div>
    </div>
  );
}

function BetButton({ label, color, onClick, active, small }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: small ? "10px 8px" : "14px",
        background: color,
        border: active ? "2px solid #FFD700" : "1px solid rgba(255,255,255,0.2)",
        color: "#fff",
        borderRadius: 8,
        cursor: "pointer",
        fontWeight: 800,
        fontSize: small ? 12 : 14,
        position: "relative",
        boxShadow: active ? "0 0 15px #FFD70088" : "none",
      }}
    >
      {label}
      {active > 0 && (
        <div
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            background: "#FFD700",
            color: "#1F0817",
            borderRadius: "50%",
            width: 24,
            height: 24,
            fontSize: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
          }}
        >
          {active >= 10000 ? `${Math.floor(active / 1000)}k` : active}
        </div>
      )}
    </button>
  );
}

// 스타일
const S = {
  container: { padding: 16, color: "#fff", minHeight: 520 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  backBtn: { background: "transparent", border: "1px solid rgba(212,165,116,0.5)", color: "#D4A574", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  title: { margin: 0, fontSize: 26, fontWeight: 800, background: "linear-gradient(135deg, #D4A574, #FF6B9D)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  points: { background: "linear-gradient(135deg, #3d1028, #1f0817)", padding: "8px 20px", borderRadius: 50, border: "1px solid #D4A574", color: "#D4A574", fontWeight: 700, fontSize: 15 },
  history: { display: "flex", gap: 6, alignItems: "center", marginBottom: 16, flexWrap: "wrap" },
  historyLabel: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginRight: 8 },
  historyChip: { width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 },
  wheelWrap: { position: "relative", width: 240, height: 240, margin: "20px auto" },
  pointer: { position: "absolute", top: -12, zIndex: 10, color: "#FFD700", fontSize: 32, left: "50%", transform: "translateX(-50%)" },
  wheel: { position: "relative", width: 240, height: 240, borderRadius: "50%", border: "5px solid #D4A574", background: "#1F0817", boxShadow: "0 0 40px rgba(255,215,0,0.4)" },
  wheelSlot: { position: "absolute", top: "50%", left: "50%", width: 26, height: 34, marginLeft: -13, marginTop: -17, transformOrigin: "50% 120px", color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" },
  wheelCenter: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: 36, color: "#FFD700" },
  resultMsg: { padding: 20, borderRadius: 16, textAlign: "center", fontSize: 21, fontWeight: 800, marginBottom: 20 },
  resultSub: { fontSize: 13, opacity: 0.9, marginTop: 6 },
  chipRow: { display: "flex", gap: 8, marginBottom: 14 },
  chip: { flex: 1, padding: "10px 8px", background: "rgba(212,165,116,0.12)", border: "1px solid rgba(212,165,116,0.3)", color: "#D4A574", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13 },
  chipActive: { background: "linear-gradient(135deg, #D4A574, #FF6B9D)", border: "2px solid #FF6B9D", color: "#fff" },
  betTable: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 },
  betRow: { display: "flex", gap: 8 },
  betSummary: { padding: 14, background: "rgba(212,165,116,0.12)", borderRadius: 10, textAlign: "center", color: "#D4A574", fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 },
  clearBtn: { background: "transparent", border: "1px solid rgba(255,107,157,0.5)", color: "#FF6B9D", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12 },
  actions: { marginTop: 12 },
  spinBtn: { width: "100%", padding: 18, background: "linear-gradient(135deg, #E63975, #FF6B9D)", border: "none", color: "#fff", borderRadius: 14, fontSize: 17, fontWeight: 800, cursor: "pointer", letterSpacing: 2, boxShadow: "0 6px 20px rgba(230,57,117,0.4)" },
};