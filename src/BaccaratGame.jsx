// ===================================================================
// 🎰 Premium Baccarat (Evolution Style with Squeeze Animation)
// ===================================================================
import React, { useState, useRef, useEffect } from "react";

// --- 글로벌 3D 스퀴즈 및 플립 애니메이션 주입 ---
const injectKeyframes = () => {
  if (document.getElementById("baccarat-animations")) return;
  const style = document.createElement("style");
  style.id = "baccarat-animations";
  style.innerHTML = `
    @keyframes dealCard {
      0% { transform: translateY(-200px) scale(0.5) rotateY(180deg); opacity: 0; }
      100% { transform: translateY(0) scale(1) rotateY(180deg); opacity: 1; }
    }
    @keyframes flipReveal {
      0% { transform: rotateY(180deg); }
      100% { transform: rotateY(0deg); }
    }
    @keyframes squeezeFlip {
      0% { transform: rotateY(180deg) scale(1) translateY(0); }
      15% { transform: rotateY(180deg) scale(1.6) translateY(40px) translateX(-10px); z-index: 100;}
      40% { transform: rotateY(130deg) scale(1.6) translateY(40px) translateX(-10px); z-index: 100;} /* 모서리 째기 시작 */
      60% { transform: rotateY(110deg) scale(1.6) translateY(40px) translateX(-10px); z-index: 100;} /* 뜸들이기 */
      80% { transform: rotateY(60deg) scale(1.2) translateY(10px); z-index: 100;}
      100% { transform: rotateY(0deg) scale(1) translateY(0); z-index: 1; }
    }
  `;
  document.head.appendChild(style);
};

// --- 게임 로직 유틸리티 ---
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ suit: s, rank: r });
  return deck.sort(() => Math.random() - 0.5);
}

function cardScore(card) {
  if (["J", "Q", "K", "10"].includes(card.rank)) return 0;
  if (card.rank === "A") return 1;
  return parseInt(card.rank, 10);
}

function handScore(hand) {
  return hand.reduce((sum, c) => sum + cardScore(c), 0) % 10;
}

function playBaccarat() {
  const deck = createDeck();
  const player = [deck.pop(), deck.pop()];
  const banker = [deck.pop(), deck.pop()];

  let pScore = handScore(player);
  let bScore = handScore(banker);

  if (pScore >= 8 || bScore >= 8) return { player, banker, pScore, bScore };

  let playerThird = null;
  if (pScore <= 5) {
    playerThird = deck.pop();
    player.push(playerThird);
    pScore = handScore(player);
  }

  if (bScore <= 5) {
    if (!playerThird && bScore <= 5) banker.push(deck.pop());
    else if (playerThird) {
      const t = cardScore(playerThird);
      if (bScore === 0 || bScore === 1 || bScore === 2) banker.push(deck.pop());
      else if (bScore === 3 && t !== 8) banker.push(deck.pop());
      else if (bScore === 4 && t <= 7) banker.push(deck.pop());
      else if (bScore === 5 && t <= 7) banker.push(deck.pop());
      else if (bScore === 6 && (t === 6 || t === 7)) banker.push(deck.pop());
    }
    bScore = handScore(banker);
  }
  return { player, banker, pScore, bScore };
}

// --- 3D 카드 컴포넌트 ---
function Card3D({ card, state }) {
  // state: "hidden"(안보임), "dealt"(뒷면), "revealed"(앞면), "squeeze"(쪼기 연출)
  const isRed = card?.suit === "♥" || card?.suit === "♦";
  
  let animation = "none";
  let transform = "rotateY(180deg)"; // 기본 뒷면

  if (state === "dealt") {
    animation = "dealCard 0.4s ease-out forwards";
  } else if (state === "revealed") {
    animation = "flipReveal 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards";
    transform = "rotateY(0deg)";
  } else if (state === "squeeze") {
    animation = "squeezeFlip 4.5s ease-in-out forwards"; // 4.5초간 긴장감 있는 스퀴즈
    transform = "rotateY(0deg)";
  } else if (state === "hidden") {
    return <div style={{ width: 70, height: 100, visibility: "hidden" }} />;
  }

  return (
    <div style={{ perspective: "1200px", width: 70, height: 100, margin: "0 5px" }}>
      <div
        style={{
          width: "100%", height: "100%",
          position: "relative",
          transformStyle: "preserve-3d",
          animation: animation,
          transform: transform,
        }}
      >
        {/* 앞면 */}
        <div style={{
          ...S.cardFace, 
          background: "linear-gradient(145deg, #ffffff, #f0f0f0)", 
          color: isRed ? "#E63975" : "#1F0817",
          transform: "rotateY(0deg)",
          boxShadow: "inset 0 0 10px rgba(0,0,0,0.1), 0 8px 20px rgba(0,0,0,0.6)"
        }}>
          <div style={{ position: "absolute", top: 4, left: 6, fontSize: 16, lineHeight: 1 }}>
            <div>{card?.rank}</div>
            <div style={{ fontSize: 14 }}>{card?.suit}</div>
          </div>
          <div style={{ fontSize: 32, opacity: 0.15, transform: "scale(1.5)" }}>{card?.suit}</div>
          <div style={{ position: "absolute", bottom: 4, right: 6, fontSize: 16, lineHeight: 1, transform: "rotate(180deg)" }}>
            <div>{card?.rank}</div>
            <div style={{ fontSize: 14 }}>{card?.suit}</div>
          </div>
        </div>

        {/* 뒷면 */}
        <div style={{
          ...S.cardFace, 
          background: "linear-gradient(135deg, #4A1033, #1A0512)", 
          border: "2px solid #D4A574",
          color: "#D4A574",
          transform: "rotateY(180deg)",
          boxShadow: "0 8px 20px rgba(0,0,0,0.6)"
        }}>
          <div style={{ border: "1px dashed rgba(212,165,116,0.5)", width: "84%", height: "88%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            🂠
          </div>
        </div>
      </div>
    </div>
  );
}

// --- 메인 게임 컴포넌트 ---
export default function BaccaratGame({ points = 100000, onPointsChange = ()=>{}, onBack = ()=>{} }) {
  useEffect(() => { injectKeyframes(); }, []);

  const [bet, setBet] = useState(5000);
  const [side, setSide] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [chips, setChips] = useState([]);
  
  // 🎯 사이드 베팅: Player Pair / Banker Pair / Perfect Pair
  const [sideBets, setSideBets] = useState({ playerPair: 0, bankerPair: 0, perfectPair: 0 });
  const toggleSideBet = (type) => {
    if (isPlaying) return;
    setSideBets(prev => ({ ...prev, [type]: prev[type] > 0 ? 0 : bet }));
  };
  
  // UI 렌더링 상태 (진행 과정에 따라 애니메이션 트리거)
  // state: "hidden" | "dealt" | "revealed" | "squeeze"
  const [pCardsState, setPCardsState] = useState([]); 
  const [bCardsState, setBCardsState] = useState([]);
  const [displayScore, setDisplayScore] = useState({ p: null, b: null });

  const totalBet = bet + sideBets.playerPair + sideBets.bankerPair + sideBets.perfectPair;
  const canPlay = points >= totalBet && side && !isPlaying;
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

    if (type === "deal") {
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
      gain.gain.value = 0.3;
      osc.start(); setTimeout(() => osc.stop(), 100);
    } else if (type === "win") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.value = 0.5;
      osc.type = "sine";
      osc.start(); setTimeout(() => osc.stop(), 300);
    }
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const getWinner = (p, b) => (p > b ? "player" : b > p ? "banker" : "tie");

  const handlePlay = async () => {
    if (!canPlay) return;
    setIsPlaying(true);
    setResult(null);
    setChips([]);
    setDisplayScore({ p: null, b: null });

    // 내부적으로 결과 선 계산
    const game = playBaccarat();
    
    // 초기화: 그려질 카드 공간 확보 (뒷면 딜링 전)
    setPCardsState(game.player.map(() => "hidden"));
    setBCardsState(game.banker.map(() => "hidden"));

    // 1. 순차적 딜링 연출 (P1 -> B1 -> P2 -> B2)
    for (let i = 0; i < 2; i++) {
      await sleep(300);
      playSound("deal");
      setPCardsState(prev => { const n = [...prev]; n[i] = "dealt"; return n; });
      await sleep(300);
      playSound("deal");
      setBCardsState(prev => { const n = [...prev]; n[i] = "dealt"; return n; });
    }

    await sleep(600);

    // 2. 기본 2장 동시 오픈
    setPCardsState(prev => { const n = [...prev]; n[0]="revealed"; n[1]="revealed"; return n; });
    setBCardsState(prev => { const n = [...prev]; n[0]="revealed"; n[1]="revealed"; return n; });
    
    // 임시 점수 계산
    const tempPScore = handScore(game.player.slice(0, 2));
    const tempBScore = handScore(game.banker.slice(0, 2));
    setDisplayScore({ p: tempPScore, b: tempBScore });

    await sleep(1500); // 점수 확인 대기

    // 3. 서드 카드 스퀴즈 연출
    if (game.player.length === 3) {
      playSound("deal");
      setPCardsState(prev => { const n = [...prev]; n[2] = "dealt"; return n; });
      await sleep(500);
      // 스퀴즈 돌입
      setPCardsState(prev => { const n = [...prev]; n[2] = "squeeze"; return n; });
      await sleep(4500); // 스퀴즈 애니메이션 길이 대기
      setDisplayScore(s => ({ ...s, p: game.pScore }));
    }

    if (game.banker.length === 3) {
      playSound("deal");
      setBCardsState(prev => { const n = [...prev]; n[2] = "dealt"; return n; });
      await sleep(500);
      // 스퀴즈 돌입
      setBCardsState(prev => { const n = [...prev]; n[2] = "squeeze"; return n; });
      await sleep(4500);
      setDisplayScore(s => ({ ...s, b: game.bScore }));
    }

    // 4. 최종 정산
    const winner = getWinner(game.pScore, game.bScore);
    let payout = 0;
    if (side === winner) {
      if (winner === "player") payout = bet * 2;
      else if (winner === "banker") payout = Math.floor(bet * 1.95);
      else payout = bet * 9;
      playSound("win");
    }

    // 🎯 사이드 베팅 정산
    const pCard1 = game.player[0], pCard2 = game.player[1];
    const bCard1 = game.banker[0], bCard2 = game.banker[1];
    const sideResults = { playerPair: false, bankerPair: false, perfectPair: false };
    let sidePayout = 0;

    // Player Pair: 플레이어 첫 2장이 같은 랭크 (11:1)
    if (sideBets.playerPair > 0 && pCard1.rank === pCard2.rank) {
      sideResults.playerPair = true;
      sidePayout += sideBets.playerPair * 12;
    }
    // Banker Pair: 뱅커 첫 2장이 같은 랭크 (11:1)
    if (sideBets.bankerPair > 0 && bCard1.rank === bCard2.rank) {
      sideResults.bankerPair = true;
      sidePayout += sideBets.bankerPair * 12;
    }
    // Perfect Pair: 어느 쪽이든 같은 랭크+같은 무늬 (25:1)
    if (sideBets.perfectPair > 0) {
      const pPerfect = pCard1.rank === pCard2.rank && pCard1.suit === pCard2.suit;
      const bPerfect = bCard1.rank === bCard2.rank && bCard1.suit === bCard2.suit;
      if (pPerfect || bPerfect) {
        sideResults.perfectPair = true;
        sidePayout += sideBets.perfectPair * 26;
      }
    }

    const totalSideBet = sideBets.playerPair + sideBets.bankerPair + sideBets.perfectPair;
    const totalPayout = payout + sidePayout;
    const won = side === winner || sidePayout > 0;

    onPointsChange(points - bet - totalSideBet + totalPayout);
    setResult({ ...game, winner, won, payout: totalPayout, sideResults, mainWon: side === winner, sidePayout });
    setHistory(prev => [winner, ...prev].slice(0, 12));
    setIsPlaying(false);
  };

  const resetGame = () => {
    setResult(null);
    setSide(null);
    setPCardsState([]);
    setBCardsState([]);
    setDisplayScore({ p: null, b: null });
    setSideBets({ playerPair: 0, bankerPair: 0, perfectPair: 0 });
  };

  return (
    <div style={S.container}>
      <div style={S.header}>
        <button onClick={onBack} style={S.backBtn}>← LOBBY</button>
        <h2 style={S.title}>VIP BACCARAT</h2>
        <div style={S.points}>💎 {points.toLocaleString()}</div>
      </div>

      {history.length > 0 && (
        <div style={S.historyBar}>
          {history.map((h, i) => (
            <div key={i} style={{...S.historyDot, background: h === "player" ? "#3B82F6" : h === "banker" ? "#E63975" : "#10B981"}} />
          ))}
        </div>
      )}

      {/* 게임 테이블 (카드 영역) */}
      <div style={S.tableArea}>
        <div style={S.tableFelt}>
          
          <div style={S.playerSide}>
            <div style={S.sideTitle}>PLAYER</div>
            <div style={S.cardsContainer}>
              {(result ? result.player : pCardsState).map((c, i) => (
                <Card3D key={`p-${i}`} card={result ? result.player[i] : null} state={pCardsState[i]} />
              ))}
            </div>
            <div style={S.scoreBox}>{displayScore.p !== null ? displayScore.p : "-"}</div>
          </div>

          <div style={S.vsText}>VS</div>

          <div style={S.bankerSide}>
            <div style={{...S.sideTitle, color: "#E63975"}}>BANKER</div>
            <div style={S.cardsContainer}>
              {(result ? result.banker : bCardsState).map((c, i) => (
                <Card3D key={`b-${i}`} card={result ? result.banker[i] : null} state={bCardsState[i]} />
              ))}
            </div>
            <div style={{...S.scoreBox, color: "#E63975", borderColor: "rgba(230,57,117,0.3)"}}>
              {displayScore.b !== null ? displayScore.b : "-"}
            </div>
          </div>

        </div>

        {/* 결과 배너 오버레이 */}
        {result && (
          <div style={S.resultOverlay}>
            <div style={{...S.resultBanner, background: result.won ? "linear-gradient(90deg, transparent, #10B981, transparent)" : "linear-gradient(90deg, transparent, rgba(0,0,0,0.8), transparent)"}}>
              {result.won ? `WIN! +${result.payout.toLocaleString()}` : "LOSE"}
            </div>
          </div>
        )}
      </div>

      {/* 하단 베팅 UI */}
      {!result ? (
        <div style={S.bettingUI}>
          <div style={S.chipSelector}>
            {[5000, 10000, 50000, 100000].map(v => (
              <button key={v} onClick={() => setBet(v)} disabled={isPlaying || points < v}
                style={{...S.chipBtn, ...(bet === v ? S.chipActive : {}), opacity: points < v ? 0.3 : 1}}>
                {v / 1000}K
              </button>
            ))}
          </div>

          <div style={S.boardAreas}>
            <button onClick={() => setSide("player")} disabled={isPlaying}
              style={{...S.betArea, borderColor: side === "player" ? "#3B82F6" : "transparent"}}>
              <span style={{color: "#3B82F6", fontWeight: 900}}>PLAYER</span>
              <span style={S.odds}>1:1</span>
            </button>
            <button onClick={() => setSide("tie")} disabled={isPlaying}
              style={{...S.betArea, borderColor: side === "tie" ? "#10B981" : "transparent"}}>
              <span style={{color: "#10B981", fontWeight: 900}}>TIE</span>
              <span style={S.odds}>8:1</span>
            </button>
            <button onClick={() => setSide("banker")} disabled={isPlaying}
              style={{...S.betArea, borderColor: side === "banker" ? "#E63975" : "transparent"}}>
              <span style={{color: "#E63975", fontWeight: 900}}>BANKER</span>
              <span style={S.odds}>1:0.95</span>
            </button>
          </div>

          {/* 🎯 사이드 베팅 - 현재 베팅 금액만큼 토글 */}
          <div style={S.sideBetSection}>
            <div style={S.sideBetTitle}>SIDE BETS (베팅 선택 → 금액만큼 추가)</div>
            <div style={S.sideBetRow}>
              <button onClick={() => toggleSideBet("playerPair")} disabled={isPlaying || points < totalBet + bet - sideBets.playerPair}
                style={{...S.sideBetBtn, borderColor: sideBets.playerPair > 0 ? "#3B82F6" : "rgba(59,130,246,0.3)",
                  background: sideBets.playerPair > 0 ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.02)"}}>
                <span style={{color: "#3B82F6", fontSize: 10, fontWeight: 800}}>P.PAIR</span>
                <span style={S.sideBetOdds}>11:1</span>
                {sideBets.playerPair > 0 && <span style={S.sideBetAmount}>{(sideBets.playerPair/1000)}K</span>}
              </button>
              <button onClick={() => toggleSideBet("perfectPair")} disabled={isPlaying || points < totalBet + bet - sideBets.perfectPair}
                style={{...S.sideBetBtn, borderColor: sideBets.perfectPair > 0 ? "#D4A574" : "rgba(212,165,116,0.3)",
                  background: sideBets.perfectPair > 0 ? "rgba(212,165,116,0.15)" : "rgba(255,255,255,0.02)"}}>
                <span style={{color: "#D4A574", fontSize: 10, fontWeight: 800}}>PERFECT</span>
                <span style={S.sideBetOdds}>25:1</span>
                {sideBets.perfectPair > 0 && <span style={S.sideBetAmount}>{(sideBets.perfectPair/1000)}K</span>}
              </button>
              <button onClick={() => toggleSideBet("bankerPair")} disabled={isPlaying || points < totalBet + bet - sideBets.bankerPair}
                style={{...S.sideBetBtn, borderColor: sideBets.bankerPair > 0 ? "#E63975" : "rgba(230,57,117,0.3)",
                  background: sideBets.bankerPair > 0 ? "rgba(230,57,117,0.15)" : "rgba(255,255,255,0.02)"}}>
                <span style={{color: "#E63975", fontSize: 10, fontWeight: 800}}>B.PAIR</span>
                <span style={S.sideBetOdds}>11:1</span>
                {sideBets.bankerPair > 0 && <span style={S.sideBetAmount}>{(sideBets.bankerPair/1000)}K</span>}
              </button>
            </div>
            {totalBet > bet && (
              <div style={S.totalBetDisplay}>
                총 베팅: <strong style={{color: "#D4A574"}}>{totalBet.toLocaleString()}P</strong>
              </div>
            )}
          </div>

          <button onClick={handlePlay} disabled={!canPlay} style={{...S.actionBtn, opacity: canPlay ? 1 : 0.5}}>
            {isPlaying ? "NO MORE BETS" : side ? `PLACE BET (${totalBet.toLocaleString()}P)` : "SELECT POSITION"}
          </button>
        </div>
      ) : (
        <button onClick={resetGame} style={S.actionBtn}>REBET / NEXT ROUND</button>
      )}
    </div>
  );
}

// --- 스타일 객체 ---
const S = {
  container: { fontFamily: "'Inter', sans-serif", padding: 16, color: "#fff", background: "#0a0a0a", minHeight: "100vh", boxSizing: "border-box" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  backBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "8px 16px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 700 },
  title: { margin: 0, fontSize: 20, fontWeight: 900, background: "linear-gradient(135deg, #D4A574, #FFF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: 2 },
  points: { background: "linear-gradient(135deg, #FFD700, #D4A574)", color: "#000", padding: "6px 16px", borderRadius: 20, fontWeight: 900, fontSize: 14, boxShadow: "0 0 15px rgba(212,165,116,0.4)" },
  historyBar: { display: "flex", gap: 4, marginBottom: 16, background: "rgba(255,255,255,0.03)", padding: 8, borderRadius: 12, overflow: "hidden" },
  historyDot: { width: 14, height: 14, borderRadius: "50%", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)" },
  
  tableArea: { position: "relative", marginBottom: 24 },
  tableFelt: { background: "radial-gradient(ellipse at top, #1a4f36 0%, #061c12 100%)", borderRadius: 24, border: "4px solid #D4A574", padding: "40px 10px 60px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.8), inset 0 0 60px rgba(0,0,0,0.5)" },
  
  playerSide: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center" },
  bankerSide: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center" },
  sideTitle: { fontSize: 14, fontWeight: 900, letterSpacing: 4, color: "#3B82F6", marginBottom: 20, textShadow: "0 2px 4px rgba(0,0,0,0.5)" },
  cardsContainer: { display: "flex", justifyContent: "center", height: 100, marginBottom: 20 },
  
  scoreBox: { background: "rgba(0,0,0,0.4)", border: "2px solid rgba(59,130,246,0.3)", color: "#3B82F6", fontSize: 28, fontWeight: 900, width: 60, height: 60, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", textShadow: "0 2px 10px rgba(0,0,0,0.5)" },
  vsText: { color: "rgba(255,255,255,0.2)", fontSize: 24, fontWeight: 900, fontStyle: "italic", position: "absolute", left: "50%", transform: "translateX(-50%)" },
  
  resultOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 },
  resultBanner: { width: "100%", textAlign: "center", padding: "20px 0", fontSize: 36, fontWeight: 900, letterSpacing: 4, textShadow: "0 4px 10px rgba(0,0,0,0.8)", animation: "flipReveal 0.5s ease-out forwards" },
  
  bettingUI: { background: "rgba(255,255,255,0.02)", borderRadius: 24, padding: 16 },
  chipSelector: { display: "flex", gap: 10, justifyContent: "center", marginBottom: 20 },
  chipBtn: { width: 60, height: 60, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, #444, #111)", border: "4px dashed #666", color: "#fff", fontWeight: 900, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 4px 10px rgba(0,0,0,0.5)" },
  chipActive: { border: "4px dashed #D4A574", transform: "scale(1.1)", boxShadow: "0 0 20px rgba(212,165,116,0.5)" },
  
  boardAreas: { display: "flex", gap: 12, marginBottom: 16 },
  betArea: { flex: 1, padding: "20px 10px", background: "rgba(255,255,255,0.03)", border: "2px solid", borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", transition: "all 0.2s" },
  odds: { fontSize: 11, opacity: 0.5, marginTop: 6, fontWeight: 600 },
  
  // 🎯 사이드 베팅
  sideBetSection: { marginBottom: 20 },
  sideBetTitle: { fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginBottom: 8, textAlign: "center" },
  sideBetRow: { display: "flex", gap: 8 },
  sideBetBtn: { flex: 1, padding: "10px 6px", border: "2px solid", borderRadius: 10, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "all 0.2s" },
  sideBetOdds: { fontSize: 9, color: "rgba(255,255,255,0.5)", fontWeight: 600 },
  sideBetAmount: { fontSize: 10, color: "#D4A574", fontWeight: 800, marginTop: 2 },
  totalBetDisplay: { textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 10 },
  
  actionBtn: { width: "100%", padding: 20, background: "linear-gradient(135deg, #D4A574, #B07D46)", border: "none", color: "#000", borderRadius: 16, fontSize: 16, fontWeight: 900, letterSpacing: 2, cursor: "pointer", boxShadow: "0 8px 20px rgba(212,165,116,0.3)" },
  
  cardFace: { position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }
};