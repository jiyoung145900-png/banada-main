// ===================================================================
// 🎡 Premium 3D Roulette (Evolution Style with Ball Physics & Real Table)
// ===================================================================
import React, { useState, useRef, useEffect, useMemo } from "react";

// --- 글로벌 3D 스핀 & 공 역회전 애니메이션 주입 ---
const injectKeyframes = () => {
  if (document.getElementById("roulette-animations")) return;
  const style = document.createElement("style");
  style.id = "roulette-animations";
  style.innerHTML = `
    /* 휠 자체의 회전 (시계 방향) */
    @keyframes wheelSpin {
      0% { transform: rotateX(55deg) rotateZ(0deg); }
      100% { transform: rotateX(55deg) rotateZ(360deg); }
    }
    /* 공의 회전 (반시계 방향, 점차 궤도가 안으로 줄어듦) */
    @keyframes ballSpin {
      0% { transform: rotateZ(0deg) translateY(-145px); }
      20% { transform: rotateZ(-720deg) translateY(-145px); }
      50% { transform: rotateZ(-1440deg) translateY(-120px); }
      80% { transform: rotateZ(-2160deg) translateY(-95px); }
      100% { transform: rotateZ(-2520deg) translateY(-80px); } /* 최종 슬롯 위치 반경 */
    }
    /* 칩 베팅 시 떨어지는 애니메이션 */
    @keyframes dropChip {
      0% { transform: scale(1.5) translateY(-20px); opacity: 0; }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
};

// 유럽식 룰렛 휠 숫자 배열 (0부터 시계방향)
const WHEEL_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

function getColor(n) {
  if (n === 0) return "green";
  return RED_NUMBERS.includes(n) ? "red" : "black";
}

export default function RouletteGame({ points = 100000, onPointsChange = ()=>{}, onBack = ()=>{} }) {
  useEffect(() => { injectKeyframes(); }, []);

  const [bets, setBets] = useState({}); // { "red": 5000, "17": 1000, ... }
  const [chipAmount, setChipAmount] = useState(1000);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  
  // 회전 상태 관리
  const [wheelRotation, setWheelRotation] = useState(0); // 멈출 때 휠의 각도
  const [ballRotation, setBallRotation] = useState(0);   // 멈출 때 공의 상대 각도

  const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);
  const canSpin = totalBet > 0 && !isSpinning && points >= totalBet;

  const audioCtxRef = useRef(null);

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

    if (type === "bet") {
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
      gain.gain.value = 0.4;
      osc.start(); setTimeout(() => osc.stop(), 100);
    } else if (type === "win") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.value = 0.5;
      osc.start(); setTimeout(() => osc.stop(), 400);
    } else if (type === "spin") {
      // 틱틱틱 돌아가는 소리 흉내
      let time = ctx.currentTime;
      for(let i=0; i<30; i++) {
        const tick = ctx.createOscillator();
        const tickGain = ctx.createGain();
        tick.connect(tickGain);
        tickGain.connect(ctx.destination);
        tick.frequency.value = 150;
        tickGain.gain.value = 0.2 * (1 - i/30);
        tick.start(time);
        tick.stop(time + 0.05);
        time += 0.05 + (i * 0.005); // 점점 느려지게
      }
    }
  };

  const placeBet = (betType) => {
    if (isSpinning) return;
    setBets(prev => ({ ...prev, [betType]: (prev[betType] || 0) + chipAmount }));
    playSound("bet");
  };

  const clearBets = () => { if (!isSpinning) setBets({}); };

  const spin = async () => {
    if (!canSpin) return;
    setIsSpinning(true);
    setResult(null);
    playSound("spin");

    // 1. 결과 생성
    const winNum = Math.floor(Math.random() * 37); // 0~36
    const winIdx = WHEEL_NUMBERS.indexOf(winNum);
    const winColor = getColor(winNum);
    
    // 2. 휠과 공의 물리적 회전 각도 계산
    // 휠은 시계방향(+)으로 엄청 돌다가 특정 각도에 멈춤 (예: 5바퀴 = 1800도 + 알파)
    const baseWheelSpin = 1800; 
    const finalWheelDeg = baseWheelSpin + Math.floor(Math.random() * 360);
    
    // 공은 반시계방향(-)으로 엄청 돌다가 휠의 해당 숫자 슬롯(winIdx)에 안착해야 함
    // 슬롯 각도 = 360 / 37 * winIdx.
    const slotAngle = (360 / 37) * winIdx;
    const baseBallSpin = -2520; // -7바퀴 반시계
    // 최종 공의 위치가 휠의 위치와 일치하도록 보정
    const finalBallDeg = baseBallSpin + (finalWheelDeg % 360) - slotAngle;

    setWheelRotation(finalWheelDeg);
    setBallRotation(finalBallDeg);

    // 스핀 애니메이션 대기 (CSS transition 5초)
    await new Promise(r => setTimeout(r, 5200));

    // 3. 정산 로직
    let totalPayout = 0;
    for (const [betStr, amount] of Object.entries(bets)) {
      let won = false; let mult = 0;
      
      // 스트레이트 업 (숫자 단일)
      if (betStr === String(winNum)) { won = true; mult = 36; }
      // 컬러
      else if (betStr === "red" && winColor === "red") { won = true; mult = 2; }
      else if (betStr === "black" && winColor === "black") { won = true; mult = 2; }
      // 홀짝 / 하이로우
      else if (betStr === "even" && winNum !== 0 && winNum % 2 === 0) { won = true; mult = 2; }
      else if (betStr === "odd" && winNum !== 0 && winNum % 2 === 1) { won = true; mult = 2; }
      else if (betStr === "low" && winNum >= 1 && winNum <= 18) { won = true; mult = 2; }
      else if (betStr === "high" && winNum >= 19 && winNum <= 36) { won = true; mult = 2; }
      // 다즌 (Dozen)
      else if (betStr === "dozen1" && winNum >= 1 && winNum <= 12) { won = true; mult = 3; }
      else if (betStr === "dozen2" && winNum >= 13 && winNum <= 24) { won = true; mult = 3; }
      else if (betStr === "dozen3" && winNum >= 25 && winNum <= 36) { won = true; mult = 3; }
      
      if (won) totalPayout += amount * mult;
    }

    if (totalPayout > 0) playSound("win");
    
    const netChange = totalPayout - totalBet;
    onPointsChange(points + netChange);

    setResult({ number: winNum, color: winColor, payout: totalPayout, netChange });
    setHistory(prev => [{ num: winNum, color: winColor }, ...prev].slice(0, 15));
    setIsSpinning(false);
  };

  const resetRound = () => { setBets({}); setResult(null); };

  // 베팅 칩 렌더러 (테이블 위에 놓인 칩 표시)
  const renderChipOnBoard = (betType) => {
    const amount = bets[betType];
    if (!amount) return null;
    return (
      <div style={S.placedChip}>
        {amount >= 10000 ? `${Math.floor(amount/1000)}k` : amount}
      </div>
    );
  };

  return (
    <div style={S.container}>
      {/* 헤더 */}
      <div style={S.header}>
        <button onClick={onBack} style={S.backBtn}>← LOBBY</button>
        <h2 style={S.title}>PREMIUM ROULETTE</h2>
        <div style={S.points}>💎 {points.toLocaleString()}</div>
      </div>

      {/* 히스토리 바 */}
      {history.length > 0 && (
        <div style={S.historyBar}>
          {history.map((h, i) => (
            <div key={i} style={{...S.historyDot, background: h.color === "red" ? "#E63975" : h.color === "black" ? "#222" : "#10B981", opacity: i === 0 ? 1 : 0.7 - (i*0.04)}}>
              {h.num}
            </div>
          ))}
        </div>
      )}

      {/* 3D 휠 영역 (에볼루션 스타일 상단 배치) */}
      <div style={S.wheelContainer}>
        <div style={S.wheelPerspective}>
          {/* 휠 본체 */}
          <div style={{
            ...S.wheelBody,
            transform: `rotateX(55deg) rotateZ(${wheelRotation}deg)`,
            transition: isSpinning ? "transform 5s cubic-bezier(0.2, 0.8, 0.1, 1)" : "none",
          }}>
            {/* 휠 내부 숫자 슬롯들 */}
            {WHEEL_NUMBERS.map((n, i) => {
              const angle = (360 / 37) * i;
              const color = getColor(n);
              return (
                <div key={`slot-${n}`} style={{
                  ...S.wheelSlot,
                  transform: `rotateZ(${angle}deg)`
                }}>
                  <div style={{
                    ...S.slotColor,
                    background: color === "red" ? "#E63975" : color === "black" ? "#111" : "#10B981"
                  }} />
                  <span style={S.slotNumber}>{n}</span>
                </div>
              );
            })}
            
            {/* 휠 중심 축 (장식) */}
            <div style={S.wheelCenterCone} />
          </div>
          
          {/* 역회전 하는 공 (Ball) */}
          <div style={{
            ...S.ballTrack,
            transform: `rotateX(55deg) rotateZ(${ballRotation}deg)`,
            transition: isSpinning ? "transform 5s cubic-bezier(0.1, 0.7, 0.3, 1)" : "none",
          }}>
            <div style={{
              ...S.ball,
              animation: isSpinning ? "ballSpin 5s cubic-bezier(0.1, 0.7, 0.3, 1) forwards" : "none",
              transform: `translateY(${isSpinning ? -80 : -80}px)`, // 멈춰있을 땐 안쪽 궤도(-80px) 유지
            }} />
          </div>
        </div>
        
        {/* 결과 배너 오버레이 (휠 위에 표시) */}
        {result && (
          <div style={S.resultBanner}>
            <div style={{fontSize: 48, fontWeight: 900, color: result.color === "red" ? "#E63975" : result.color === "black" ? "#888" : "#10B981"}}>
              {result.number}
            </div>
            <div style={{fontSize: 16, color: result.netChange > 0 ? "#FFD700" : "#aaa"}}>
              {result.netChange > 0 ? `+${result.netChange.toLocaleString()} WIN!` : "NO WIN"}
            </div>
          </div>
        )}
      </div>

      {/* 리얼 카지노 베팅 테이블 보드 */}
      <div style={S.tableBoard}>
        {/* 숫자판 (1~36 & 0) */}
        <div style={S.numbersGrid}>
          {/* Zero (0) - 왼쪽에 길게 배치 */}
          <div onClick={() => placeBet("0")} style={{...S.gridCell, ...S.zeroCell}}>
            0 {renderChipOnBoard("0")}
          </div>
          
          {/* 1~36 Grid (3x12) */}
          <div style={S.grid3x12}>
            {/* 3열: 3, 6, 9...36 */}
            {[3,6,9,12,15,18,21,24,27,30,33,36].map(n => (
              <div key={n} onClick={() => placeBet(String(n))} style={{...S.gridCell, background: getColor(n)==="red"?"#8B1E3F":"#222"}}>
                {n} {renderChipOnBoard(String(n))}
              </div>
            ))}
            {/* 2열: 2, 5, 8...35 */}
            {[2,5,8,11,14,17,20,23,26,29,32,35].map(n => (
              <div key={n} onClick={() => placeBet(String(n))} style={{...S.gridCell, background: getColor(n)==="red"?"#8B1E3F":"#222"}}>
                {n} {renderChipOnBoard(String(n))}
              </div>
            ))}
            {/* 1열: 1, 4, 7...34 */}
            {[1,4,7,10,13,16,19,22,25,28,31,34].map(n => (
              <div key={n} onClick={() => placeBet(String(n))} style={{...S.gridCell, background: getColor(n)==="red"?"#8B1E3F":"#222"}}>
                {n} {renderChipOnBoard(String(n))}
              </div>
            ))}
          </div>
        </div>

        {/* 하단 특수 베팅 (Dozen, Color, Odd/Even 등) */}
        <div style={S.specialBets}>
          <div style={S.dozenRow}>
            <div onClick={()=>placeBet("dozen1")} style={S.specialCell}>1st 12 {renderChipOnBoard("dozen1")}</div>
            <div onClick={()=>placeBet("dozen2")} style={S.specialCell}>2nd 12 {renderChipOnBoard("dozen2")}</div>
            <div onClick={()=>placeBet("dozen3")} style={S.specialCell}>3rd 12 {renderChipOnBoard("dozen3")}</div>
          </div>
          <div style={S.outsideRow}>
            <div onClick={()=>placeBet("low")} style={S.specialCell}>1 TO 18 {renderChipOnBoard("low")}</div>
            <div onClick={()=>placeBet("even")} style={S.specialCell}>EVEN {renderChipOnBoard("even")}</div>
            <div onClick={()=>placeBet("red")} style={{...S.specialCell, color:"#E63975"}}>RED {renderChipOnBoard("red")}</div>
            <div onClick={()=>placeBet("black")} style={{...S.specialCell, color:"#aaa"}}>BLACK {renderChipOnBoard("black")}</div>
            <div onClick={()=>placeBet("odd")} style={S.specialCell}>ODD {renderChipOnBoard("odd")}</div>
            <div onClick={()=>placeBet("high")} style={S.specialCell}>19 TO 36 {renderChipOnBoard("high")}</div>
          </div>
        </div>
      </div>

      {/* 하단 컨트롤 UI */}
      <div style={S.controlPanel}>
        <div style={S.chipSelector}>
          {[1000, 5000, 10000, 50000, 100000].map(v => (
            <div key={v} onClick={() => setChipAmount(v)} 
              style={{...S.selectChip, ...(chipAmount === v ? S.selectChipActive : {}), opacity: points < v ? 0.3 : 1}}>
              {v >= 10000 ? `${v/1000}k` : v/1000}
            </div>
          ))}
        </div>
        
        <div style={S.actionRow}>
          <div style={S.betTotalInfo}>
            <div style={{fontSize: 12, color: "#888"}}>TOTAL BET</div>
            <div style={{fontSize: 18, color: "#FFD700", fontWeight: 900}}>{totalBet.toLocaleString()}</div>
          </div>
          
          <button onClick={clearBets} disabled={isSpinning || totalBet===0} style={S.clearBtn}>CLEAR</button>
          
          {result ? (
            <button onClick={resetRound} style={S.spinBtn}>REBET</button>
          ) : (
            <button onClick={spin} disabled={!canSpin} style={{...S.spinBtn, opacity: canSpin ? 1 : 0.5}}>
              {isSpinning ? "SPINNING.." : "SPIN!"}
            </button>
          )}
        </div>
      </div>

    </div>
  );
}

// --- 스타일 객체 ---
const S = {
  container: { fontFamily: "'Inter', sans-serif", padding: "16px 8px", color: "#fff", background: "#050505", minHeight: "100vh", boxSizing: "border-box" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 8px" },
  backBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "6px 12px", borderRadius: 16, cursor: "pointer", fontSize: 11, fontWeight: 700 },
  title: { margin: 0, fontSize: 18, fontWeight: 900, background: "linear-gradient(135deg, #D4A574, #FFF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: 1 },
  points: { background: "linear-gradient(135deg, #FFD700, #D4A574)", color: "#000", padding: "6px 12px", borderRadius: 16, fontWeight: 900, fontSize: 13, boxShadow: "0 0 10px rgba(212,165,116,0.4)" },
  
  historyBar: { display: "flex", gap: 4, padding: "8px 12px", overflowX: "auto", borderBottom: "1px solid #222" },
  historyDot: { minWidth: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, textShadow: "0 1px 2px rgba(0,0,0,0.8)" },

  // --- 3D 휠 뷰 ---
  wheelContainer: { position: "relative", height: 260, display: "flex", justifyContent: "center", alignItems: "center", overflow: "hidden", background: "radial-gradient(circle at center, #1a1a1a 0%, #000 70%)" },
  wheelPerspective: { perspective: "800px", width: 300, height: 300, position: "relative" },
  
  wheelBody: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: "50%", border: "16px solid #2a2a2a", background: "#111", boxShadow: "inset 0 0 40px rgba(0,0,0,0.9), 0 20px 50px rgba(0,0,0,0.5)", transformStyle: "preserve-3d" },
  wheelCenterCone: { position: "absolute", top: "50%", left: "50%", width: 60, height: 60, transform: "translate(-50%, -50%) translateZ(20px)", borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, #D4A574, #8B5A2B)", boxShadow: "0 10px 20px rgba(0,0,0,0.6)" },
  
  wheelSlot: { position: "absolute", top: 0, left: "50%", width: 24, height: 150, marginLeft: -12, transformOrigin: "bottom center", display: "flex", flexDirection: "column", alignItems: "center" },
  slotColor: { width: "100%", height: 35, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, border: "1px solid #333", borderTop: "none" },
  slotNumber: { color: "#fff", fontSize: 10, fontWeight: 900, marginTop: 4, transform: "rotate(90deg)" },
  
  ballTrack: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: "50%", pointerEvents: "none" },
  ball: { position: "absolute", top: "50%", left: "50%", width: 12, height: 12, marginLeft: -6, marginTop: -6, background: "radial-gradient(circle at 30% 30%, #fff, #ddd)", borderRadius: "50%", boxShadow: "0 4px 8px rgba(0,0,0,0.6), inset -2px -2px 4px rgba(0,0,0,0.3)" },
  
  resultBanner: { position: "absolute", bottom: 20, right: 20, background: "rgba(0,0,0,0.8)", border: "2px solid #D4A574", padding: "10px 20px", borderRadius: 12, textAlign: "center", backdropFilter: "blur(4px)", animation: "dropChip 0.4s ease-out" },

  // --- 리얼 테이블 보드 ---
  tableBoard: { padding: 12, background: "#0a3a22", borderRadius: 16, border: "4px solid #5a3825", margin: "16px 8px", boxShadow: "inset 0 0 50px rgba(0,0,0,0.8)" },
  numbersGrid: { display: "flex", marginBottom: 4 },
  zeroCell: { width: 50, border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, fontWeight: 900, cursor: "pointer", position: "relative" },
  grid3x12: { flex: 1, display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gridTemplateRows: "repeat(3, 1fr)", gap: 0 },
  gridCell: { border: "1px solid rgba(255,255,255,0.2)", height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", position: "relative", transition: "background 0.2s" },
  
  specialBets: { display: "flex", flexDirection: "column", gap: 4, marginLeft: 50 }, // 0영역만큼 띄움
  dozenRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0 },
  outsideRow: { display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 0 },
  specialCell: { border: "1px solid rgba(255,255,255,0.2)", height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", position: "relative" },
  
  placedChip: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 24, height: 24, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, #FFD700, #B8860B)", border: "2px dashed #000", color: "#000", fontSize: 10, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, animation: "dropChip 0.2s cubic-bezier(0.1, 0.7, 0.1, 1)" },

  // --- 하단 컨트롤 ---
  controlPanel: { background: "#111", padding: "16px 12px", borderRadius: "20px 20px 0 0", marginTop: "auto" },
  chipSelector: { display: "flex", justifyContent: "center", gap: 12, marginBottom: 20 },
  selectChip: { width: 44, height: 44, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, #444, #1a1a1a)", border: "3px dashed #666", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, cursor: "pointer", transition: "all 0.2s" },
  selectChipActive: { border: "3px dashed #FFD700", transform: "scale(1.15) translateY(-5px)", boxShadow: "0 10px 15px rgba(255,215,0,0.3)" },
  
  actionRow: { display: "flex", alignItems: "center", gap: 12 },
  betTotalInfo: { flex: 1, background: "#222", padding: "10px", borderRadius: 12, textAlign: "center" },
  clearBtn: { padding: "14px 20px", background: "transparent", border: "1px solid #FF6B9D", color: "#FF6B9D", borderRadius: 12, fontWeight: 800, cursor: "pointer" },
  spinBtn: { flex: 2, padding: "14px", background: "linear-gradient(135deg, #E63975, #FF6B9D)", border: "none", color: "#fff", borderRadius: 12, fontSize: 18, fontWeight: 900, cursor: "pointer", boxShadow: "0 6px 20px rgba(230,57,117,0.4)" }
};