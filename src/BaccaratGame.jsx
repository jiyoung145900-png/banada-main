// ===================================================================
// 🎰 BaccaratGame - 바카라 미니게임 (서비스 수준)
// ===================================================================
// Props:
//   points: 현재 포인트
//   onPointsChange: 포인트 변경 콜백
//   onBack: 로비로 돌아가기
// ===================================================================

import { useState, useRef, useEffect } from "react";

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
      if (bScore === 0) banker.push(deck.pop());
      else if (bScore === 1) banker.push(deck.pop());
      else if (bScore === 2) banker.push(deck.pop());
      else if (bScore === 3 && t !== 8) banker.push(deck.pop());
      else if (bScore === 4 && t <= 7) banker.push(deck.pop());
      else if (bScore === 5 && t <= 7) banker.push(deck.pop());
      else if (bScore === 6 && (t === 6 || t === 7)) banker.push(deck.pop());
    }
    bScore = handScore(banker);
  }

  return { player, banker, pScore, bScore };
}

export default function BaccaratGame({ points, onPointsChange, onBack }) {
  const [bet, setBet] = useState(5000);
  const [side, setSide] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [cardAnimation, setCardAnimation] = useState({});
  const [chips, setChips] = useState([]);

  const canPlay = points >= bet && side && !isPlaying;
  const canvasRef = useRef(null);
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

    if (type === "win") {
      osc.frequency.setValueAtTime(920, ctx.currentTime);
      gain.gain.value = 0.6;
      osc.type = "sine";
      osc.start();
      setTimeout(() => osc.stop(), 220);
    } else if (type === "bet") {
      osc.frequency.setValueAtTime(480, ctx.currentTime);
      gain.gain.value = 0.45;
      osc.type = "sawtooth";
      osc.start();
      setTimeout(() => osc.stop(), 140);
    } else if (type === "tie") {
      osc.frequency.setValueAtTime(680, ctx.currentTime);
      gain.gain.value = 0.5;
      osc.type = "sine";
      osc.start();
      setTimeout(() => osc.stop(), 90);
    }
  };

  const getWinner = (p, b) => (p > b ? "player" : b > p ? "banker" : "tie");

  const handlePlay = async () => {
    if (!canPlay) return;
    setIsPlaying(true);
    setResult(null);
    setChips([]);
    playSound("bet");

    // 카드 뒤집기 애니메이션
    const player = createDeck().slice(0, 2);
    const banker = createDeck().slice(0, 2);
    const pScore = handScore(player);
    const bScore = handScore(banker);

    setCardAnimation({
      player: player.map((_, i) => ({ back: i === 0 })),
      banker: banker.map((_, i) => ({ back: i === 0 })),
      pScore: null,
      bScore: null,
    });

    await new Promise(r => setTimeout(r, 1300));

    const game = playBaccarat();
    const winner = getWinner(game.pScore, game.bScore);

    let payout = 0;
    if (side === winner) {
      if (winner === "player") payout = bet * 2;
      else if (winner === "banker") payout = Math.floor(bet * 1.95);
      else payout = bet * 9;
      playSound("win");
    } else {
      playSound("tie");
    }

    const newPoints = points - bet + payout;
    onPointsChange(newPoints);

    setResult({ ...game, winner, won: side === winner, payout });
    setHistory(prev => [winner, ...prev].slice(0, 10));

    // 최종 카드 애니메이션
    setCardAnimation({
      player: game.player.map((_, i) => ({ back: false })),
      banker: game.banker.map((_, i) => ({ back: false })),
      pScore: game.pScore,
      bScore: game.bScore,
    });

    setIsPlaying(false);
  };

  const resetGame = () => {
    setResult(null);
    setSide(null);
    setCardAnimation({});
  };

  // 칩 베팅 애니메이션
  useEffect(() => {
    if (result || isPlaying) return;
    if (side && bet) {
      setChips(prev => {
        const newChip = {
          id: Date.now(),
          x: 80 + Math.random() * 80,
          y: 90,
          size: 38,
          color: side === "player" ? "#3B82F6" : side === "banker" ? "#E63975" : "#D4A574",
        };
        return [...prev, newChip];
      });
      setTimeout(() => {
        setChips(prev => prev.slice(1));
      }, 600);
    }
  }, [side, bet, result, isPlaying]);

  // Canvas 애니메이션 (파티클 + 뒤집기)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;

    const ctx = canvas.getContext("2d");
    canvas.width = 280;
    canvas.height = 170;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const pCards = result.player || [];
      const bCards = result.banker || [];

      // Player
      pCards.forEach((card, i) => {
        const flip = cardAnimation.player?.[i]?.back ? 1 : 0;
        const x = 50 + i * 32;
        ctx.save();
        ctx.translate(x, 28);
        ctx.scale(flip, 1);
        ctx.drawImage(canvasRef.current, 0, 0, 58, 82);
        ctx.restore();
      });

      // Banker
      bCards.forEach((card, i) => {
        const flip = cardAnimation.banker?.[i]?.back ? 1 : 0;
        const x = 140 + i * 32;
        ctx.save();
        ctx.translate(x, 28);
        ctx.scale(flip, 1);
        ctx.drawImage(canvasRef.current, 0, 0, 58, 82);
        ctx.restore();
      });

      requestAnimationFrame(animate);
    };

    animate();
  }, [result, cardAnimation]);

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
          <span style={S.historyLabel}>최근 결과</span>
          {history.map((h, i) => (
            <span
              key={i}
              style={{
                ...S.historyChip,
                background: h === "player" ? "#3B82F6" : h === "banker" ? "#E63975" : "#D4A574",
              }}
            >
              {h === "player" ? "P" : h === "banker" ? "B" : "T"}
            </span>
          ))}
        </div>
      )}

      {/* 테이블 */}
      <div style={S.table}>
        <canvas ref={canvasRef} style={{ display: "block", margin: "0 auto" }} />

        <div style={S.vs}>VS</div>

        <div style={S.handArea}>
          <div style={S.handLabel}>PLAYER</div>
          <div style={S.cards}>
            {(result ? result.player : []).map((c, i) => (
              <Card
                key={i}
                card={c}
                isBack={cardAnimation.player?.[i]?.back}
              />
            ))}
          </div>
          {result && <div style={S.scoreNum}>{cardAnimation.pScore}</div>}
        </div>
      </div>

      {/* 결과 메시지 */}
      {result && (
        <div
          style={{
            ...S.resultMsg,
            background: result.won
              ? "linear-gradient(135deg, #10B981, #059669)"
              : "linear-gradient(135deg, #EF4444, #DC2626)",
          }}
        >
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
              {[1000, 5000, 10000, 50000, 100000].map((v) => (
                <button
                  key={v}
                  onClick={() => setBet(v)}
                  disabled={isPlaying || points < v}
                  style={{
                    ...S.chip,
                    ...(bet === v ? S.chipActive : {}),
                    opacity: points < v ? 0.3 : 1,
                  }}
                >
                  {v >= 10000 ? `${v / 10000}만` : `${v / 1000}천`}
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
                style={{ ...S.sideBtn, ...(side === "player" ? S.sideBtnActive : {}) }}
              >
                PLAYER<br />
                <span style={S.sideOdds}>1 : 1</span>
              </button>
              <button
                onClick={() => setSide("tie")}
                disabled={isPlaying}
                style={{ ...S.sideBtn, ...(side === "tie" ? S.sideBtnActive : {}) }}
              >
                TIE<br />
                <span style={S.sideOdds}>8 : 1</span>
              </button>
              <button
                onClick={() => setSide("banker")}
                disabled={isPlaying}
                style={{ ...S.sideBtn, ...(side === "banker" ? S.sideBtnActive : {}) }}
              >
                BANKER<br />
                <span style={S.sideOdds}>1 : 0.95</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* 액션 버튼 */}
      <div style={S.actions}>
        {result ? (
          <button onClick={resetGame} style={S.playBtn}>
            다시 하기
          </button>
        ) : (
          <button
            onClick={handlePlay}
            disabled={!canPlay}
            style={{ ...S.playBtn, opacity: canPlay ? 1 : 0.4 }}
          >
            {isPlaying ? "🎴 카드 뽑는 중..." : side ? `${bet.toLocaleString()}P 베팅하기` : "베팅 위치 선택"}
          </button>
        )}
      </div>

      {/* 베팅 칩 애니메이션 */}
      {chips.map((chip) => (
        <div
          key={chip.id}
          style={{
            position: "absolute",
            left: `${chip.x}px`,
            top: `${chip.y}px`,
            fontSize: `${chip.size}px`,
            transition: "all 0.6s cubic-bezier(0.23, 1, 0.32, 1)",
            transform: "translateY(-40px)",
            zIndex: 30,
          }}
        >
          {chip.size >= 48 ? "💎" : chip.size >= 36 ? "💰" : "🎰"}
        </div>
      ))}
    </div>
  );
}

function Card({ card, isBack }) {
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <div
      style={{
        ...S.card,
        background: isBack
          ? "linear-gradient(135deg, #3d1028, #1f0817)"
          : "#fff",
        color: isBack ? "#D4A574" : red ? "#E63975" : "#1F0817",
        fontSize: isBack ? 32 : 18,
      }}
    >
      {isBack ? "🂠" : `${card.rank}${card.suit}`}
    </div>
  );
}

// 스타일
const S = {
  container: { padding: 16, color: "#fff", minHeight: 520 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  backBtn: { background: "transparent", border: "1px solid rgba(212,165,116,0.5)", color: "#D4A574", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  title: { margin: 0, fontSize: 26, fontWeight: 800, background: "linear-gradient(135deg, #D4A574, #FF6B9D)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  points: { background: "linear-gradient(135deg, #3d1028, #1f0817)", padding: "8px 20px", borderRadius: 50, border: "1px solid #D4A574", color: "#D4A574", fontWeight: 700, fontSize: 15 },
  history: { display: "flex", gap: 6, alignItems: "center", marginBottom: 16 },
  historyLabel: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginRight: 8 },
  historyChip: { width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 },
  table: { background: "radial-gradient(ellipse at center, #4e1835 0%, #1f0817 70%)", border: "3px solid rgba(212,165,116,0.4)", borderRadius: 24, padding: 20, marginBottom: 20, position: "relative" },
  vs: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: 18, fontWeight: 900, color: "#D4A574" },
  handArea: { textAlign: "center" },
  handLabel: { fontSize: 13, fontWeight: 800, letterSpacing: 3, marginBottom: 12, color: "#60A5FA" },
  cards: { display: "flex", gap: 10, justifyContent: "center", marginBottom: 10 },
  card: { width: 58, height: 82, background: "#fff", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(0,0,0,0.5)", transition: "transform 0.3s" },
  scoreNum: { fontSize: 36, fontWeight: 900, color: "#D4A574", marginTop: 8 },
  resultMsg: { padding: 22, borderRadius: 16, textAlign: "center", fontSize: 22, fontWeight: 800, marginBottom: 20 },
  resultSub: { fontSize: 12, opacity: 0.9, marginTop: 6 },
  betSection: { marginBottom: 16 },
  betLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8, letterSpacing: 1 },
  betChips: { display: "flex", gap: 8, flexWrap: "wrap" },
  chip: { padding: "12px 14px", background: "rgba(212,165,116,0.12)", border: "1px solid rgba(212,165,116,0.3)", color: "#D4A574", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13 },
  chipActive: { background: "linear-gradient(135deg, #D4A574, #FF6B9D)", border: "2px solid #FF6B9D", color: "#fff" },
  sideSection: { marginBottom: 16 },
  sideButtons: { display: "flex", gap: 10 },
  sideBtn: { flex: 1, padding: 18, background: "rgba(255,255,255,0.06)", border: "2px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: 14, cursor: "pointer", fontWeight: 800, fontSize: 14 },
  sideBtnActive: { background: "linear-gradient(135deg, #3B82F6aa, #3B82F6)", border: "3px solid #3B82F6", boxShadow: "0 0 25px #3B82F666" },
  sideOdds: { fontSize: 11, opacity: 0.75, display: "block", marginTop: 4 },
  actions: { marginTop: 12 },
  playBtn: { width: "100%", padding: 18, background: "linear-gradient(135deg, #E63975, #FF6B9D)", border: "none", color: "#fff", borderRadius: 14, fontSize: 17, fontWeight: 800, cursor: "pointer", letterSpacing: 2, boxShadow: "0 6px 20px rgba(230,57,117,0.4)" },
};