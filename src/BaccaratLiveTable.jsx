// ===================================================================
// 🎰 BaccaratLiveTable - 라이브 바카라 메인 게임 화면
// ===================================================================
// 흐름:
//   1. 테이블 입장 (joinBaccaratTable)
//   2. 베팅 (칩 선택 후 영역 클릭 → 즉시 포인트 차감)
//   3. READY 버튼 (= DEAL)
//   4. 혼자: 즉시 결과 / 2명+: 모두 READY 시 결과
//   5. 결과 표시 → 다음 라운드
// ===================================================================

import { useState, useEffect, useRef, useMemo } from "react";
import {
  useBaccaratTable,
  useBaccaratHistory,
  useMyLatestBet,
  placeBaccaratBet,
  joinBaccaratTable,
  leaveBaccaratTable,
  sendReady,
  MIN_BET,
  MAX_BET,
} from "./BaccaratFirestore";

const CHIP_VALUES = [10000, 50000, 100000, 500000, 1000000];
const CHIP_LABELS = ["10K", "50K", "100K", "500K", "1M"];
const CHIP_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#E63975", "#8B5CF6"];

export default function BaccaratLiveTable({
  tableId,
  userId,
  userName,
  gamePoints,
  onPointsChange,
  onLeave,
}) {
  const { table, loading } = useBaccaratTable(tableId);
  const history = useBaccaratHistory(tableId, 60);
  
  // 베팅 상태 (로컬)
  const [selectedChip, setSelectedChip] = useState(CHIP_VALUES[0]);
  const [betStacks, setBetStacks] = useState({
    player: [], tie: [], banker: [],
    playerPair: [], bankerPair: [], perfectPair: [],
  });
  const [isReady, setIsReady] = useState(false);
  const [isBetSaving, setIsBetSaving] = useState(false);
  const [resultModal, setResultModal] = useState(null);
  
  const currentRound = table?.currentRound || 1;
  const players = table?.players || [];
  const readyPlayers = table?.readyPlayers || [];
  const lastResult = table?.lastResult;
  const lastResultRound = table?.lastResultRound;
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 입장/퇴장 생명주기
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const joinedRef = useRef(false);
  useEffect(() => {
    if (!tableId || joinedRef.current) return;
    joinedRef.current = true;
    joinBaccaratTable(tableId).catch(err => {
      console.error("입장 실패:", err);
      alert("테이블 입장 실패: " + (err.message || err.code));
    });
    
    // 언마운트 시 퇴장
    return () => {
      leaveBaccaratTable(tableId);
      joinedRef.current = false;
    };
  }, [tableId]);
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 결과 표시 (lastResult 변경 감지)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const myBet = useMyLatestBet(userId, tableId, lastResultRound);
  
  useEffect(() => {
    if (!lastResult || !lastResultRound) return;
    if (resultModal?.round === lastResultRound) return;
    
    setResultModal({
      round: lastResultRound,
      result: lastResult,
      myBet: null,
      waiting: true,
    });
  }, [lastResultRound]);
  
  // myBet 업데이트 시 result modal 에 반영
  useEffect(() => {
    if (!resultModal || !myBet) return;
    if (!myBet.settled) return;
    
    setResultModal(prev => prev ? {
      ...prev,
      myBet,
      waiting: false,
    } : null);
    
    // 베팅 초기화 + READY 리셋
    setBetStacks({ player: [], tie: [], banker: [], playerPair: [], bankerPair: [], perfectPair: [] });
    setIsReady(false);
  }, [myBet]);
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 베팅 계산
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const totalBet = useMemo(() => {
    return Object.values(betStacks).reduce((sum, arr) =>
      sum + arr.reduce((s, v) => s + v, 0), 0
    );
  }, [betStacks]);
  
  const mainTotal = useMemo(() => {
    return [betStacks.player, betStacks.banker, betStacks.tie]
      .reduce((s, arr) => s + arr.reduce((a, b) => a + b, 0), 0);
  }, [betStacks]);
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 베팅 액션
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const placeChip = (target) => {
    if (isReady) return;  // READY 후엔 베팅 불가
    if (gamePoints < selectedChip) {
      alert("포인트 부족!");
      return;
    }
    if (totalBet + selectedChip > MAX_BET) {
      alert(`최대 베팅 ${MAX_BET.toLocaleString()} 초과`);
      return;
    }
    
    // 즉시 포인트 차감
    onPointsChange(gamePoints - selectedChip);
    setBetStacks(prev => ({
      ...prev,
      [target]: [...prev[target], selectedChip],
    }));
  };
  
  const clearBets = () => {
    if (isReady) return;
    if (totalBet > 0) {
      onPointsChange(gamePoints + totalBet);
    }
    setBetStacks({ player: [], tie: [], banker: [], playerPair: [], bankerPair: [], perfectPair: [] });
  };
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // READY 전송 (= DEAL)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleReady = async () => {
    if (mainTotal === 0) {
      alert("Player / Banker / Tie 중 최소 1곳에 베팅하세요");
      return;
    }
    if (totalBet < MIN_BET) {
      alert(`최소 베팅 ${MIN_BET.toLocaleString()}`);
      return;
    }
    if (isBetSaving) return;
    
    setIsBetSaving(true);
    try {
      // 1. 베팅 저장
      const bets = {
        player: sum(betStacks.player),
        banker: sum(betStacks.banker),
        tie: sum(betStacks.tie),
        playerPair: sum(betStacks.playerPair),
        bankerPair: sum(betStacks.bankerPair),
        perfectPair: sum(betStacks.perfectPair),
      };
      
      await placeBaccaratBet({
        userId,
        nickname: userName,
        tableId,
        round: currentRound,
        bets,
        totalBet,
        balanceBeforeBet: gamePoints + totalBet,  // 베팅 전 잔액
      });
      
      // 2. READY 신호
      setIsReady(true);
      await sendReady(tableId);
      
    } catch (err) {
      alert("READY 실패: " + (err.message || err.code));
      setIsReady(false);
    } finally {
      setIsBetSaving(false);
    }
  };
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // UI 렌더링
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  if (loading) {
    return (
      <div style={S.loading}>
        <div style={{ fontSize: 48 }}>🎰</div>
        <div>테이블 입장 중...</div>
      </div>
    );
  }
  
  const amIReady = readyPlayers.includes(userId) || isReady;
  const waitingForOthers = amIReady && readyPlayers.length < players.length;
  
  return (
    <div style={S.container}>
      {/* 헤더 */}
      <div style={S.header}>
        <button onClick={onLeave} style={S.backBtn}>← LOBBY</button>
        <div style={S.headerCenter}>
          <div style={S.tableName}>
            {tableId === "table1" ? "TABLE 1" : "TABLE 2"}
          </div>
          <div style={S.roundInfo}>
            ROUND #{currentRound} · 👥 {players.length}명
          </div>
        </div>
        <div style={S.pointsBadge}>
          💎 {gamePoints.toLocaleString()}
        </div>
      </div>
      
      {/* 최근 결과 로드맵 */}
      {history.length > 0 && (
        <RoadmapStrip history={history} />
      )}
      
      {/* 테이블 (베팅 영역) */}
      <div style={S.table}>
        {/* Player */}
        <BetArea
          label="PLAYER"
          sub="1 : 1"
          color="#3B82F6"
          chips={betStacks.player}
          disabled={isReady}
          onClick={() => placeChip("player")}
        />
        
        {/* Tie */}
        <BetArea
          label="TIE"
          sub="8 : 1"
          color="#10B981"
          chips={betStacks.tie}
          disabled={isReady}
          onClick={() => placeChip("tie")}
          small
        />
        
        {/* Banker */}
        <BetArea
          label="BANKER"
          sub="0.95 : 1"
          color="#E63975"
          chips={betStacks.banker}
          disabled={isReady}
          onClick={() => placeChip("banker")}
        />
      </div>
      
      {/* 사이드 베팅 */}
      <div style={S.sideBets}>
        <SideBetArea
          label="P Pair"
          sub="11:1"
          color="#3B82F6"
          chips={betStacks.playerPair}
          disabled={isReady}
          onClick={() => placeChip("playerPair")}
        />
        <SideBetArea
          label="Perfect"
          sub="25:1"
          color="#D4A574"
          chips={betStacks.perfectPair}
          disabled={isReady}
          onClick={() => placeChip("perfectPair")}
        />
        <SideBetArea
          label="B Pair"
          sub="11:1"
          color="#E63975"
          chips={betStacks.bankerPair}
          disabled={isReady}
          onClick={() => placeChip("bankerPair")}
        />
      </div>
      
      {/* 베팅 정보 */}
      <div style={S.betInfo}>
        <span>총 베팅: <strong>{totalBet.toLocaleString()}</strong></span>
        {!isReady && totalBet > 0 && (
          <button onClick={clearBets} style={S.clearBtn}>모두 지우기</button>
        )}
      </div>
      
      {/* 칩 선택 */}
      <div style={S.chipsRow}>
        {CHIP_VALUES.map((v, i) => (
          <button
            key={v}
            onClick={() => setSelectedChip(v)}
            disabled={isReady}
            style={{
              ...S.chipBtn,
              background: `radial-gradient(circle, ${CHIP_COLORS[i]}, ${CHIP_COLORS[i]}99)`,
              border: selectedChip === v ? `3px solid #FFD700` : `2px solid rgba(255,255,255,0.3)`,
              boxShadow: selectedChip === v ? `0 0 20px ${CHIP_COLORS[i]}80` : "none",
              opacity: isReady ? 0.4 : 1,
            }}
          >
            {CHIP_LABELS[i]}
          </button>
        ))}
      </div>
      
      {/* READY / 대기 */}
      {!amIReady ? (
        <button
          onClick={handleReady}
          disabled={isBetSaving || mainTotal === 0}
          style={{
            ...S.readyBtn,
            background: mainTotal > 0 && !isBetSaving
              ? "linear-gradient(135deg, #D4A574, #F0D4B8)"
              : "rgba(255,255,255,0.1)",
            color: mainTotal > 0 ? "#000" : "rgba(255,255,255,0.4)",
            cursor: mainTotal > 0 && !isBetSaving ? "pointer" : "not-allowed",
          }}
        >
          {isBetSaving ? "⏳ 저장 중..." : players.length > 1 ? "✅ READY" : "🎲 DEAL"}
        </button>
      ) : (
        <div style={S.waitingBox}>
          {waitingForOthers ? (
            <>
              <div style={{ fontSize: 20 }}>⏳</div>
              <div>다른 플레이어 대기 중...</div>
              <div style={S.readyCount}>
                READY: {readyPlayers.length} / {players.length}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 20 }}>🎴</div>
              <div>카드 공개 중...</div>
            </>
          )}
        </div>
      )}
      
      {/* 결과 모달 */}
      {resultModal && (
        <ResultModal
          data={resultModal}
          onClose={() => setResultModal(null)}
        />
      )}
    </div>
  );
}

// ====================== 베팅 영역 (큰 거) ======================
function BetArea({ label, sub, color, chips, disabled, onClick, small }) {
  const total = chips.reduce((s, v) => s + v, 0);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...S.betArea,
        flex: small ? 0.7 : 1,
        border: `2px solid ${color}`,
        background: `linear-gradient(135deg, ${color}22, ${color}11)`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div style={{ ...S.betLabel, color }}>{label}</div>
      <div style={S.betSub}>{sub}</div>
      {total > 0 && (
        <div style={{ ...S.betTotal, color }}>
          💎 {total.toLocaleString()}
        </div>
      )}
    </button>
  );
}

// ====================== 사이드 베팅 ======================
function SideBetArea({ label, sub, color, chips, disabled, onClick }) {
  const total = chips.reduce((s, v) => s + v, 0);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...S.sideBet,
        border: `1.5px solid ${color}80`,
        background: total > 0 ? `${color}22` : "rgba(0,0,0,0.3)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div style={{ fontSize: 11, color, fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{sub}</div>
      {total > 0 && (
        <div style={{ fontSize: 10, color: "#F0D4B8", fontWeight: 700, marginTop: 2 }}>
          {total.toLocaleString()}
        </div>
      )}
    </button>
  );
}

// ====================== 로드맵 스트립 ======================
function RoadmapStrip({ history }) {
  return (
    <div style={S.roadmap}>
      <div style={S.roadmapLabel}>최근 결과</div>
      <div style={S.roadmapDots}>
        {history.slice(-30).map((h, i) => {
          const colors = { player: "#3B82F6", banker: "#E63975", tie: "#10B981" };
          const letters = { player: "P", banker: "B", tie: "T" };
          const color = colors[h.winner] || "#444";
          return (
            <div
              key={i}
              style={{
                width: 18, height: 18, borderRadius: "50%",
                background: color, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 900,
                flexShrink: 0,
              }}
              title={`#${h.round} ${h.winner}`}
            >
              {letters[h.winner]}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ====================== 결과 모달 ======================
function ResultModal({ data, onClose }) {
  const { round, result, myBet, waiting } = data;
  
  if (waiting) {
    return (
      <div style={S.resultOverlay} onClick={onClose}>
        <div style={S.resultBox} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 36 }}>⏳</div>
          <div style={S.resultTitle}>결과 집계 중...</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
            Round #{round}
          </div>
        </div>
      </div>
    );
  }
  
  const won = myBet && myBet.net > 0;
  const winnerText = {
    player: "PLAYER WIN",
    banker: "BANKER WIN",
    tie: "TIE",
  }[result.winner];
  const winnerColor = {
    player: "#3B82F6",
    banker: "#E63975",
    tie: "#10B981",
  }[result.winner];
  
  return (
    <div style={S.resultOverlay} onClick={onClose}>
      <div style={S.resultBox} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 36 }}>
          {won ? "🎉" : myBet ? "😢" : "👁"}
        </div>
        <div style={{ ...S.resultTitle, color: winnerColor }}>
          {winnerText}
        </div>
        <div style={S.cardsBox}>
          <div style={S.cardSide}>
            <div style={{ fontSize: 10, color: "#3B82F6", marginBottom: 4 }}>PLAYER ({result.playerValue})</div>
            <div style={S.cards}>
              {result.playerCards?.map((c, i) => <CardMini key={i} card={c} />)}
            </div>
          </div>
          <div style={S.cardSide}>
            <div style={{ fontSize: 10, color: "#E63975", marginBottom: 4 }}>BANKER ({result.bankerValue})</div>
            <div style={S.cards}>
              {result.bankerCards?.map((c, i) => <CardMini key={i} card={c} />)}
            </div>
          </div>
        </div>
        
        {myBet && (
          <div style={S.myResult}>
            <div style={S.myResultRow}>
              <span>베팅:</span>
              <span>{myBet.totalBet.toLocaleString()}</span>
            </div>
            <div style={S.myResultRow}>
              <span>지급:</span>
              <span style={{ color: "#D4A574" }}>{myBet.payout.toLocaleString()}</span>
            </div>
            <div style={{ ...S.myResultRow, fontSize: 18, fontWeight: 900 }}>
              <span>손익:</span>
              <span style={{ color: won ? "#10B981" : "#E63975" }}>
                {won ? "+" : ""}{myBet.net.toLocaleString()}
              </span>
            </div>
          </div>
        )}
        
        <button onClick={onClose} style={S.resultBtn}>
          확인
        </button>
      </div>
    </div>
  );
}

function CardMini({ card }) {
  const isRed = card.suit === "♥" || card.suit === "♦";
  return (
    <div style={{
      width: 36, height: 50,
      background: "#fff", borderRadius: 4,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      color: isRed ? "#E63975" : "#000",
      fontSize: 11, fontWeight: 900,
      border: "1px solid #333",
      boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
    }}>
      <div>{card.rank}</div>
      <div>{card.suit}</div>
    </div>
  );
}

// 유틸
function sum(arr) {
  return arr.reduce((s, v) => s + v, 0);
}

// ====================== 스타일 ======================
const S = {
  container: {
    padding: "16px 20px",
    color: "#fff",
    minHeight: 500,
  },
  loading: {
    padding: 80, textAlign: "center", color: "#D4A574",
  },
  
  // 헤더
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 14, gap: 10,
  },
  backBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(212,165,116,0.3)",
    color: "rgba(212,165,116,0.9)",
    padding: "7px 12px", borderRadius: 8,
    fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
    cursor: "pointer",
  },
  headerCenter: { textAlign: "center", flex: 1 },
  tableName: {
    fontSize: 15, fontWeight: 900, color: "#F0D4B8",
    fontFamily: "'Playfair Display', serif", letterSpacing: 2,
  },
  roundInfo: {
    fontSize: 10, color: "rgba(255,255,255,0.5)",
    fontFamily: "'Courier New', monospace",
  },
  pointsBadge: {
    background: "linear-gradient(135deg, rgba(212,165,116,0.2), rgba(255,107,157,0.15))",
    border: "1px solid rgba(212,165,116,0.4)",
    color: "#F0D4B8",
    padding: "6px 12px", borderRadius: 20,
    fontSize: 11, fontWeight: 800,
  },
  
  // 로드맵
  roadmap: {
    padding: "8px 12px",
    background: "rgba(0,0,0,0.4)",
    borderRadius: 8, marginBottom: 14,
  },
  roadmapLabel: {
    fontSize: 9, color: "#D4A574",
    fontWeight: 700, letterSpacing: 1, marginBottom: 6,
  },
  roadmapDots: {
    display: "flex", gap: 3, overflowX: "auto", padding: "2px 0",
  },
  
  // 테이블
  table: {
    display: "flex", gap: 8, marginBottom: 10,
  },
  betArea: {
    padding: "20px 10px",
    borderRadius: 12,
    textAlign: "center",
    transition: "all 0.2s",
    minHeight: 100,
    display: "flex", flexDirection: "column",
    justifyContent: "center", gap: 4,
  },
  betLabel: {
    fontSize: 14, fontWeight: 900, letterSpacing: 1.5,
    fontFamily: "'Playfair Display', serif",
  },
  betSub: {
    fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: 1,
  },
  betTotal: {
    fontSize: 12, fontWeight: 800, marginTop: 4,
  },
  
  // 사이드 베팅
  sideBets: {
    display: "flex", gap: 6, marginBottom: 10,
  },
  sideBet: {
    flex: 1, padding: "10px 6px",
    borderRadius: 8, textAlign: "center",
    transition: "all 0.2s",
  },
  
  // 베팅 정보
  betInfo: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 12px",
    background: "rgba(0,0,0,0.3)",
    borderRadius: 8,
    fontSize: 12,
    marginBottom: 12,
  },
  clearBtn: {
    background: "rgba(230,57,117,0.2)",
    border: "1px solid rgba(230,57,117,0.4)",
    color: "#E63975",
    padding: "4px 10px", borderRadius: 6,
    fontSize: 10, fontWeight: 700, cursor: "pointer",
  },
  
  // 칩
  chipsRow: {
    display: "flex", gap: 6, justifyContent: "space-between",
    marginBottom: 14,
  },
  chipBtn: {
    flex: 1, height: 46, borderRadius: "50%",
    color: "#fff", fontWeight: 900, fontSize: 11,
    cursor: "pointer",
    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
    transition: "all 0.2s",
  },
  
  // READY 버튼
  readyBtn: {
    width: "100%",
    padding: "16px 20px",
    border: "none",
    borderRadius: 12,
    fontSize: 15, fontWeight: 900, letterSpacing: 3,
    transition: "all 0.3s",
  },
  waitingBox: {
    padding: "20px",
    background: "rgba(212,165,116,0.1)",
    border: "1px dashed rgba(212,165,116,0.4)",
    borderRadius: 12,
    textAlign: "center",
    color: "#D4A574",
    fontSize: 13, fontWeight: 700,
  },
  readyCount: {
    fontSize: 11, color: "rgba(255,255,255,0.6)",
    marginTop: 6, fontFamily: "monospace",
  },
  
  // 결과 모달
  resultOverlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.85)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 10001, padding: 20,
  },
  resultBox: {
    background: "linear-gradient(180deg, #2a0d1f, #120410)",
    border: "2px solid rgba(212,165,116,0.5)",
    borderRadius: 20, padding: 28,
    maxWidth: 400, width: "100%",
    textAlign: "center",
    boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
  },
  resultTitle: {
    fontSize: 22, fontWeight: 900, letterSpacing: 2,
    margin: "10px 0",
    fontFamily: "'Playfair Display', serif",
  },
  cardsBox: {
    display: "flex", gap: 16, justifyContent: "space-around",
    padding: "16px 0",
    marginTop: 10,
  },
  cardSide: {
    display: "flex", flexDirection: "column", alignItems: "center",
  },
  cards: {
    display: "flex", gap: 4,
  },
  myResult: {
    background: "rgba(0,0,0,0.4)",
    padding: 14, borderRadius: 10,
    marginTop: 16,
    textAlign: "left",
  },
  myResultRow: {
    display: "flex", justifyContent: "space-between",
    padding: "4px 0",
    fontSize: 13,
  },
  resultBtn: {
    marginTop: 16,
    width: "100%", padding: "12px",
    background: "linear-gradient(135deg, #D4A574, #F0D4B8)",
    border: "none", borderRadius: 10,
    fontSize: 14, fontWeight: 800, color: "#000",
    cursor: "pointer", letterSpacing: 2,
  },
};
