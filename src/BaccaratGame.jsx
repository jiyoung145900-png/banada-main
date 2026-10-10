// ===================================================================
// 🎰 BaccaratGame - 바카라 미니게임 (재미용, 실제 돈 X)
// ===================================================================
// Props:
//   points: 현재 포인트
//   onPointsChange: 포인트 변경 콜백 (newPoints) => void
//   onBack: 로비로 돌아가기 콜백
// ===================================================================

import { useState } from "react";

// 카드 덱 생성
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ suit: s, rank: r });
  return deck.sort(() => Math.random() - 0.5);
}

// 바카라 카드 점수
function cardScore(card) {
  if (["J", "Q", "K", "10"].includes(card.rank)) return 0;
  if (card.rank === "A") return 1;
  return parseInt(card.rank, 10);
}

function handScore(hand) {
  return hand.reduce((sum, c) => sum + cardScore(c), 0) % 10;
}

// 바카라 룰 (간소화)
function playBaccarat() {
  const deck = createDeck();
  const player = [deck.pop(), deck.pop()];
  const banker = [deck.pop(), deck.pop()];
  
  let pScore = handScore(player);
  let bScore = handScore(banker);
  
  // Natural win (8 or 9) - 추가 카드 없음
  if (pScore >= 8 || bScore >= 8) {
    return { player, banker, pScore, bScore };
  }
  
  // Player 룰: 0-5면 추가 카드
  let playerThirdCard = null;
  if (pScore <= 5) {
    playerThirdCard = deck.pop();
    player.push(playerThirdCard);
    pScore = handScore(player);
  }
  
  // Banker 룰 (간소화)
  if (bScore <= 5) {
    // Player가 추가 안 받았을 때
    if (!playerThirdCard && bScore <= 5) {
      banker.push(deck.pop());
    } else if (playerThirdCard) {
      const t = cardScore(playerThirdCard);
      // 간소화된 Banker 룰
      if (bScore <= 2) banker.push(deck.pop());
      else if (bScore === 3 && t !== 8) banker.push(deck.pop());
      else if (bScore === 4 && t >= 2 && t <= 7) banker.push(deck.pop());
      else if (bScore === 5 && t >= 4 && t <= 7) banker.push(deck.pop());
      else if (bScore === 6 && (t === 6 || t === 7)) banker.push(deck.pop());
    }
    bScore = handScore(banker);
  }
  
  return { player, banker, pScore, bScore };
}

export default function BaccaratGame({ points, onPointsChange, onBack }) {
  const [bet, setBet] = useState(1000);
  const [side, setSide] = useState(null); // "player" | "banker" | "tie"
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  
  const canPlay = points >= bet && side && !isPlaying;
  
  const handlePlay = async () => {
    if (!canPlay) return;
    setIsPlaying(true);
    setResult(null);
    
    // 애니메이션 지연
    await new Promise(r => setTimeout(r, 800));
    
    const game = playBaccarat();
    const winner = game.pScore > game.bScore ? "player" :
                   game.bScore > game.pScore ? "banker" : "tie";
    
    let payout = 0;
    let won = false;
    
    if (side === winner) {
      won = true;
      if (winner === "player") payout = bet * 2;         // 1:1
      else if (winner === "banker") payout = Math.floor(bet * 1.95); // 1:0.95
      else payout = bet * 9;                              // 8:1 (Tie)
    }
    
    const newPoints = points - bet + payout;
    onPointsChange(newPoints);
    
    setResult({ ...game, winner, won, payout });
    setHistory(prev => [winner, ...prev].slice(0, 10));
    setIsPlaying(false);
  };
  
  const resetGame = () => {
    setResult(null);
    setSide(null);
  };
  
  return (
    <div style={S.container}>
      {/* 헤더 */}
      <div style={S.header}>
        <button onClick={onBack} style={S.backBtn}>← 로비</button>
        <h2 style={S.title}>🎴 Baccarat</h2>
        <div style={S.points}>💎 {points.toLocaleString()}</div>
      </div>
      
      {/* 히스토리 */}
      {history.length > 0 && (
        <div style={S.history}>
          <span style={S.historyLabel}>최근:</span>
          {history.map((h, i) => (
            <span key={i} style={{...S.historyChip, 
              background: h === "player" ? "#3B82F6" : h === "banker" ? "#E63975" : "#D4A574"
            }}>
              {h === "player" ? "P" : h === "banker" ? "B" : "T"}
            </span>
          ))}
        </div>
      )}
      
      {/* 테이블 */}
      <div style={S.table}>
        {/* Player 쪽 */}
        <div style={S.handArea}>
          <div style={{...S.handLabel, color: "#60A5FA"}}>PLAYER</div>
          <div style={S.cards}>
            {result ? result.player.map((c, i) => <Card key={i} card={c} />) : 
              <><CardBack /><CardBack /></>
            }
          </div>
          {result && <div style={S.scoreNum}>{result.pScore}</div>}
        </div>
        
        <div style={S.vs}>VS</div>
        
        {/* Banker 쪽 */}
        <div style={S.handArea}>
          <div style={{...S.handLabel, color: "#F472B6"}}>BANKER</div>
          <div style={S.cards}>
            {result ? result.banker.map((c, i) => <Card key={i} card={c} />) :
              <><CardBack /><CardBack /></>
            }
          </div>
          {result && <div style={S.scoreNum}>{result.bScore}</div>}
        </div>
      </div>
      
      {/* 결과 메시지 */}
      {result && (
        <div style={{
          ...S.resultMsg,
          background: result.won ? "linear-gradient(135deg, #10B981, #059669)" : "linear-gradient(135deg, #EF4444, #DC2626)"
        }}>
          {result.won ? `🎉 승리! +${result.payout.toLocaleString()}P` : `💔 패배 -${bet.toLocaleString()}P`}
          <div style={S.resultSub}>
            {result.winner === "player" ? "PLAYER WIN" : result.winner === "banker" ? "BANKER WIN" : "TIE"}
          </div>
        </div>
      )}
      
      {/* 베팅 UI */}
      {!result && (
        <>
          <div style={S.betSection}>
            <div style={S.betLabel}>베팅 금액</div>
            <div style={S.betChips}>
              {[1000, 5000, 10000, 50000, 100000].map(v => (
                <button
                  key={v}
                  onClick={() => setBet(v)}
                  disabled={isPlaying || points < v}
                  style={{
                    ...S.chip,
                    ...(bet === v ? S.chipActive : {}),
                    opacity: points < v ? 0.3 : 1
                  }}
                >
                  {v >= 10000 ? `${v/10000}만` : `${v/1000}천`}
                </button>
              ))}
            </div>
          </div>
          
          <div style={S.sideSection}>
            <div style={S.betLabel}>어디에 베팅?</div>
            <div style={S.sideButtons}>
              <button
                onClick={() => setSide("player")}
                disabled={isPlaying}
                style={{...S.sideBtn, ...(side === "player" ? S.sideBtnActive("#3B82F6") : {})}}
              >
                PLAYER<br/><span style={S.sideOdds}>1 : 1</span>
              </button>
              <button
                onClick={() => setSide("tie")}
                disabled={isPlaying}
                style={{...S.sideBtn, ...(side === "tie" ? S.sideBtnActive("#D4A574") : {})}}
              >
                TIE<br/><span style={S.sideOdds}>8 : 1</span>
              </button>
              <button
                onClick={() => setSide("banker")}
                disabled={isPlaying}
                style={{...S.sideBtn, ...(side === "banker" ? S.sideBtnActive("#E63975") : {})}}
              >
                BANKER<br/><span style={S.sideOdds}>1 : 0.95</span>
              </button>
            </div>
          </div>
        </>
      )}
      
      {/* 액션 버튼 */}
      <div style={S.actions}>
        {result ? (
          <button onClick={resetGame} style={S.playBtn}>다시 하기</button>
        ) : (
          <button onClick={handlePlay} disabled={!canPlay} style={{...S.playBtn, opacity: canPlay ? 1 : 0.4}}>
            {isPlaying ? "🎴 카드 뽑는 중..." : side ? `${bet.toLocaleString()}P 베팅하기` : "베팅 위치 선택"}
          </button>
        )}
      </div>
    </div>
  );
}

// 카드 컴포넌트
function Card({ card }) {
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <div style={{...S.card, color: red ? "#E63975" : "#1F0817"}}>
      <div style={S.cardRank}>{card.rank}</div>
      <div style={S.cardSuit}>{card.suit}</div>
    </div>
  );
}

function CardBack() {
  return (
    <div style={{...S.card, background: "linear-gradient(135deg, #3d1028, #1f0817)", border: "2px solid #D4A574"}}>
      <div style={{color: "#D4A574", fontSize: 28}}>🂠</div>
    </div>
  );
}

// 스타일
const S = {
  container: { padding: 16, color: "#fff", minHeight: 500 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  backBtn: { background: "transparent", border: "1px solid rgba(212,165,116,0.4)", color: "#D4A574", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  title: { margin: 0, fontSize: 22, fontWeight: 700, background: "linear-gradient(135deg, #D4A574, #FF6B9D)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  points: { background: "linear-gradient(135deg, #3d1028, #1f0817)", padding: "8px 16px", borderRadius: 50, border: "1px solid #D4A574", color: "#D4A574", fontWeight: 700, fontSize: 14 },
  history: { display: "flex", gap: 6, alignItems: "center", marginBottom: 16, flexWrap: "wrap" },
  historyLabel: { fontSize: 11, color: "rgba(255,255,255,0.5)" },
  historyChip: { width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" },
  table: { background: "radial-gradient(ellipse at center, #4e1835 0%, #1f0817 70%)", border: "2px solid rgba(212,165,116,0.3)", borderRadius: 20, padding: 24, marginBottom: 20, display: "flex", justifyContent: "space-around", alignItems: "center" },
  handArea: { textAlign: "center", flex: 1 },
  handLabel: { fontSize: 12, fontWeight: 800, letterSpacing: 2, marginBottom: 12 },
  cards: { display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 },
  card: { width: 60, height: 85, background: "#fff", borderRadius: 8, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" },
  cardRank: { fontSize: 16, fontWeight: 800 },
  cardSuit: { fontSize: 22, textAlign: "right" },
  scoreNum: { fontSize: 32, fontWeight: 800, color: "#D4A574" },
  vs: { fontSize: 14, color: "rgba(212,165,116,0.6)", fontWeight: 700 },
  resultMsg: { padding: 20, borderRadius: 12, textAlign: "center", fontSize: 20, fontWeight: 800, marginBottom: 16, color: "#fff" },
  resultSub: { fontSize: 11, opacity: 0.9, marginTop: 4, letterSpacing: 2 },
  betSection: { marginBottom: 16 },
  betLabel: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 8, letterSpacing: 1 },
  betChips: { display: "flex", gap: 6, flexWrap: "wrap" },
  chip: { flex: 1, minWidth: 50, padding: "10px 8px", background: "rgba(212,165,116,0.1)", border: "1px solid rgba(212,165,116,0.3)", color: "#D4A574", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12 },
  chipActive: { background: "linear-gradient(135deg, #D4A574, #FF6B9D)", border: "1px solid #FF6B9D", color: "#fff" },
  sideSection: { marginBottom: 16 },
  sideButtons: { display: "flex", gap: 8 },
  sideBtn: { flex: 1, padding: 16, background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: 12, cursor: "pointer", fontWeight: 800, fontSize: 13 },
  sideBtnActive: (color) => ({ background: `linear-gradient(135deg, ${color}aa, ${color})`, border: `2px solid ${color}`, boxShadow: `0 0 20px ${color}66` }),
  sideOdds: { fontSize: 11, opacity: 0.8, fontWeight: 500 },
  actions: { marginTop: 20 },
  playBtn: { width: "100%", padding: 16, background: "linear-gradient(135deg, #E63975, #FF6B9D)", border: "none", color: "#fff", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer", letterSpacing: 1 },
};
