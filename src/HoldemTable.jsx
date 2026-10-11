// ===================================================================
// 🎰 HoldemTable - Evolution 2.5D Poker (모바일 우선 + 안정화)
// ===================================================================

import React, { useState, useEffect, useRef } from "react";
import { subscribeTable, leaveTable, startGame, playerAction, nextRound } from "./HoldemFirestore";
import { evaluateHand } from "./HoldemLogic";

// 에볼루션 전용 애니메이션 주입
const injectAnimations = () => {
  if (document.getElementById("evo-holdem-styles")) return;
  const style = document.createElement("style");
  style.id = "evo-holdem-styles";
  style.innerHTML = `
    @keyframes dealCard { 0% { opacity: 0; transform: translate(0, -100px) scale(0.2); } 100% { opacity: 1; transform: translate(0,0) scale(1); } }
    @keyframes flipCard { 0% { transform: rotateY(90deg); opacity: 0.5; } 100% { transform: rotateY(0deg); opacity: 1; } }
    @keyframes activeTurnPulse { 0% { box-shadow: 0 0 0 0 rgba(212,165,116,0.6); } 70% { box-shadow: 0 0 0 15px rgba(212,165,116,0); } 100% { box-shadow: 0 0 0 0 rgba(212,165,116,0); } }
    @keyframes potGlow { 0%, 100% { text-shadow: 0 0 10px rgba(253,224,71,0.5); } 50% { text-shadow: 0 0 20px rgba(253,224,71,1); } }
    @keyframes errorShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
    .holdem-range-slider { -webkit-appearance: none; width: 100%; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.2); outline: none; }
    .holdem-range-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 22px; height: 22px; border-radius: 50%; background: linear-gradient(135deg, #D4A574, #B07D46); cursor: pointer; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
    .holdem-range-slider::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: linear-gradient(135deg, #D4A574, #B07D46); cursor: pointer; border: none; }
  `;
  document.head.appendChild(style);
};

// 🪑 좌석 포지션 - 플레이어 수에 따라 동적 (내 자리는 항상 하단 중앙)
function getSeatPositions(totalPlayers) {
  const configs = {
    2: [
      { bottom: "0%", left: "50%", transform: "translateX(-50%)" },      // 0: 나 (하단)
      { top: "0%", left: "50%", transform: "translateX(-50%)" },         // 1: 상단
    ],
    3: [
      { bottom: "0%", left: "50%", transform: "translateX(-50%)" },      // 0: 나 (하단)
      { top: "10%", left: "5%" },                                        // 1: 좌측 상단
      { top: "10%", right: "5%" },                                       // 2: 우측 상단
    ],
    4: [
      { bottom: "0%", left: "50%", transform: "translateX(-50%)" },      // 0: 나 (하단)
      { top: "50%", left: "0%", transform: "translateY(-50%)" },         // 1: 좌측 중앙
      { top: "0%", left: "50%", transform: "translateX(-50%)" },         // 2: 상단 중앙
      { top: "50%", right: "0%", transform: "translateY(-50%)" },        // 3: 우측 중앙
    ],
    5: [
      { bottom: "0%", left: "50%", transform: "translateX(-50%)" },      // 0: 나 (하단)
      { bottom: "25%", left: "0%" },                                     // 1: 좌측 하단
      { top: "5%", left: "8%" },                                         // 2: 좌측 상단
      { top: "5%", right: "8%" },                                        // 3: 우측 상단
      { bottom: "25%", right: "0%" },                                    // 4: 우측 하단
    ],
    6: [
      { bottom: "0%", left: "50%", transform: "translateX(-50%)" },      // 0: 나 (하단)
      { bottom: "25%", left: "0%" },                                     // 1: 좌측 하단
      { top: "15%", left: "3%" },                                        // 2: 좌측 상단
      { top: "0%", left: "50%", transform: "translateX(-50%)" },         // 3: 상단 중앙
      { top: "15%", right: "3%" },                                       // 4: 우측 상단
      { bottom: "25%", right: "0%" },                                    // 5: 우측 하단
    ],
  };
  return configs[totalPlayers] || configs[6];
}

export default function HoldemTable({ tableId, userId, userName, gamePoints, onPointsChange, onLeave }) {
  const [table, setTable] = useState(null);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const prevChipsRef = useRef({});

  useEffect(() => { injectAnimations(); }, []);

  useEffect(() => {
    const unsub = subscribeTable(tableId, (t) => {
      if (!t) return onLeave();
      const me = t.players.find(p => p.userId === userId);
      if (me) prevChipsRef.current[userId] = me.chips;
      setTable(t);
    });
    return unsub;
  }, [tableId, userId, onLeave]);

  // 에러 자동 숨김
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const handleAction = async (action, amount = 0) => {
    setActionLoading(true);
    setError("");
    try { 
      await playerAction({ tableId, userId, action, amount }); 
    } catch (e) {
      setError("액션 실패: " + e.message);
    }
    setActionLoading(false);
  };

  const handleStart = async () => {
    setActionLoading(true);
    setError("");
    try {
      await startGame(tableId);
    } catch (e) {
      setError("게임 시작 실패: " + e.message);
    }
    setActionLoading(false);
  };

  const handleNextRound = async () => {
    setActionLoading(true);
    setError("");
    try {
      await nextRound(tableId);
    } catch (e) {
      setError("다음 라운드 실패: " + e.message);
    }
    setActionLoading(false);
  };

  const handleLeave = async () => {
    const me = table?.players.find(p => p.userId === userId);
    if (me && me.chips > 0 && table.status !== "playing") {
      onPointsChange(gamePoints + me.chips);
    }
    try {
      await leaveTable({ tableId, userId });
    } catch (e) {}
    onLeave();
  };

  if (!table) return <div style={S.loadingScreen}>LOADING VIP ROOM...</div>;

  const me = table.players.find(p => p.userId === userId);
  const myIdx = table.players.findIndex(p => p.userId === userId);
  const isMyTurn = myIdx === table.currentPlayerIdx && table.status === "playing";
  const isShowdown = table.phase === "showdown";
  const callAmount = me ? Math.max(0, table.currentBet - me.bet) : 0;
  const minRaise = table.currentBet + table.bigBlind;

  // 🔹 Hero Centering - 플레이어 수에 따른 동적 좌석
  const totalPlayers = table.players.length;
  const seatPositions = getSeatPositions(totalPlayers);
  
  const getVisualSeatStyle = (actualIdx) => {
    if (myIdx === -1) return seatPositions[actualIdx] || seatPositions[0]; // 관전자
    const visualIdx = (actualIdx - myIdx + totalPlayers) % totalPlayers;
    return seatPositions[visualIdx];
  };

  return (
    <div style={S.container}>
      {/* 상단 바 */}
      <div style={S.topBar}>
        <button onClick={handleLeave} style={S.backBtn}>❮ LEAVE</button>
        <div style={S.tableTitle}>
          {table.name} 
          <span style={S.blindText}>{table.smallBlind}/{table.bigBlind}</span>
        </div>
        <div style={S.phaseBadge}>{table.phase.toUpperCase()}</div>
      </div>

      {/* 에러 */}
      {error && (
        <div style={{...S.errorBanner, animation: "errorShake 0.3s"}}>
          ⚠ {error}
        </div>
      )}

      {/* 🔹 2.5D 테이블 영역 */}
      <div style={S.room}>
        <div style={S.tableMat}>
          <div style={S.tableInnerRing}>
            
            {/* 중앙 팟 & 커뮤니티 카드 */}
            <div style={S.centerArea}>
              <div style={S.mainPot}>
                <div style={S.potLabel}>POT</div>
                <div style={S.potValue}>{table.pot.toLocaleString()}</div>
              </div>

              <div style={S.communityBoard}>
                {[0, 1, 2, 3, 4].map((i) => {
                  const card = table.communityCards[i];
                  return card ? (
                    <div key={i} style={{animation: "flipCard 0.4s ease-out forwards"}}>
                      <PremiumCard card={card} />
                    </div>
                  ) : (
                    <div key={i} style={S.cardOutline} />
                  );
                })}
              </div>

              {table.currentBet > 0 && (
                <div style={S.currentBetInfo}>Current Bet: {table.currentBet.toLocaleString()}</div>
              )}
            </div>

            {/* 플레이어 좌석 (동적 배치) */}
            {table.players.map((p, i) => (
              <div 
                key={p.userId} 
                style={{
                  ...S.seatContainer, 
                  ...getVisualSeatStyle(i), 
                  zIndex: i === table.currentPlayerIdx ? 20 : 10
                }}
              >
                <PlayerNode 
                  player={p} 
                  isMe={p.userId === userId} 
                  isActive={i === table.currentPlayerIdx && table.status === "playing"} 
                  isDealer={i === table.dealerIdx}
                  showCards={isShowdown || p.userId === userId} 
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 🔹 하단 HUD */}
      <div style={S.hud}>
        {/* 대기 중 */}
        {table.status === "waiting" && !isShowdown && (
          <div style={S.centerBox}>
            <p style={S.waitingText}>
              Waiting for players... ({table.players.length}/{table.maxPlayers})
            </p>
            {table.players.length >= 2 && (
              <button 
                onClick={handleStart} 
                disabled={actionLoading} 
                style={{...S.startBtn, opacity: actionLoading ? 0.5 : 1}}
              >
                {actionLoading ? "DEALING..." : "DEAL CARDS"}
              </button>
            )}
          </div>
        )}

        {/* 쇼다운 */}
        {isShowdown && (
          <div style={S.showdownPanel}>
            <ShowdownResult table={table} userId={userId} />
            <button 
              onClick={handleNextRound} 
              disabled={actionLoading} 
              style={{...S.nextRoundBtn, opacity: actionLoading ? 0.5 : 1}}
            >
              {actionLoading ? "..." : "NEXT HAND ❯"}
            </button>
          </div>
        )}

        {/* 플레이 중 */}
        {table.status === "playing" && !isShowdown && me && (
          <div style={S.actionPanel}>
            {!isMyTurn ? (
              <div style={S.waitingTurnText}>
                Waiting for <strong style={{color:"#D4A574"}}>{table.players[table.currentPlayerIdx]?.nickname}</strong>...
              </div>
            ) : (
              <div style={S.myControls}>
                {/* 레이즈 슬라이더 */}
                {me.chips > callAmount + table.bigBlind && (
                  <div style={S.raiseArea}>
                    <div style={S.raiseHeader}>
                      <span>Raise to: <strong style={S.raiseValue}>{(raiseAmount || minRaise).toLocaleString()}</strong></span>
                      <div style={S.quickBtnGroup}>
                        <button onClick={()=>setRaiseAmount(minRaise)} style={S.quickBtn}>MIN</button>
                        <button onClick={()=>setRaiseAmount(Math.min(me.chips + me.bet, Math.max(table.pot, minRaise)))} style={S.quickBtn}>POT</button>
                        <button onClick={()=>setRaiseAmount(me.chips + me.bet)} style={S.quickBtn}>MAX</button>
                      </div>
                    </div>
                    <input 
                      type="range" 
                      min={minRaise} 
                      max={me.chips + me.bet} 
                      value={raiseAmount || minRaise} 
                      onChange={(e)=>setRaiseAmount(Number(e.target.value))} 
                      className="holdem-range-slider" 
                    />
                  </div>
                )}
                
                {/* 메인 액션 버튼 */}
                <div style={S.buttonGroup}>
                  <button 
                    onClick={() => handleAction("fold")} 
                    disabled={actionLoading} 
                    style={{...S.actionBtn, background: "linear-gradient(to bottom, #4B5563, #374151)"}}
                  >
                    FOLD
                  </button>
                  {callAmount === 0 ? (
                    <button 
                      onClick={() => handleAction("check")} 
                      disabled={actionLoading} 
                      style={{...S.actionBtn, background: "linear-gradient(to bottom, #10B981, #059669)"}}
                    >
                      CHECK
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleAction("call")} 
                      disabled={actionLoading || callAmount > me.chips} 
                      style={{...S.actionBtn, background: "linear-gradient(to bottom, #3B82F6, #2563EB)"}}
                    >
                      CALL {callAmount.toLocaleString()}
                    </button>
                  )}
                  {me.chips > callAmount && (
                    <button 
                      onClick={() => handleAction(
                        me.chips > callAmount + table.bigBlind ? "raise" : "all-in", 
                        raiseAmount || minRaise
                      )} 
                      disabled={actionLoading} 
                      style={{...S.actionBtn, background: "linear-gradient(to bottom, #D4A574, #B07D46)", color:"#000"}}
                    >
                      {me.chips > callAmount + table.bigBlind ? "RAISE" : "ALL-IN"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------
// 서브 컴포넌트
// -----------------------------------------------------
function PremiumCard({ card, isHole = false }) {
  const isRed = card.suit === "♥" || card.suit === "♦";
  return (
    <div style={{
      ...S.cardBody, 
      width: isHole ? 32 : 44, 
      height: isHole ? 46 : 64, 
      color: isRed ? "#EF4444" : "#111827"
    }}>
      <div style={{fontSize: isHole ? 12 : 18, fontWeight: 900, lineHeight: 1}}>{card.rank}</div>
      <div style={{fontSize: isHole ? 14 : 22, lineHeight: 1, marginTop: -2}}>{card.suit}</div>
    </div>
  );
}

function PlayerNode({ player, isMe, isActive, isDealer, showCards }) {
  const folded = player.folded;
  return (
    <div style={{
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      opacity: folded ? 0.4 : 1,
      position: "relative",
    }}>
      
      {/* 홀카드 (아바타 위에) */}
      {player.cards?.length > 0 && (
        <div style={S.holeCardsWrap}>
          {player.cards.map((c, i) => (
            <div 
              key={i} 
              style={{
                transform: i === 1 ? "rotate(10deg) translateX(-10px)" : "rotate(-10deg)", 
                animation: "dealCard 0.4s ease-out forwards", 
                animationDelay: `${i*0.1}s`,
              }}
            >
              {showCards ? <PremiumCard card={c} isHole /> : <div style={S.cardBack} />}
            </div>
          ))}
        </div>
      )}

      {/* 베팅 디스플레이 */}
      {player.bet > 0 && (
        <div style={S.betDisplay}>🪙 {player.bet.toLocaleString()}</div>
      )}

      {/* 아바타 패널 */}
      <div style={{
        ...S.avatarBox, 
        borderColor: isActive ? "#D4A574" : isMe ? "#10B981" : "rgba(255,255,255,0.1)", 
        animation: isActive ? "activeTurnPulse 1.5s infinite" : "none"
      }}>
        {/* 딜러 버튼 */}
        {isDealer && <div style={S.dealerButton}>D</div>}
        
        <div style={S.avatarName}>
          {player.nickname} {isMe && <span style={{color: "#10B981"}}>(ME)</span>}
        </div>
        <div style={S.avatarChips}>$ {player.chips.toLocaleString()}</div>
        
        {folded && <div style={S.statusTag}>FOLD</div>}
        {player.allIn && <div style={{...S.statusTag, background:"#DC2626"}}>ALL-IN</div>}
      </div>
    </div>
  );
}

function ShowdownResult({ table, userId }) {
  const active = table.players.filter(p => !p.folded);
  const results = active.map(p => ({ 
    player: p, 
    hand: evaluateHand([...p.cards, ...table.communityCards]) 
  })).sort((a,b) => b.hand.rank - a.hand.rank);
  const won = results[0]?.player.userId === userId;
  
  return (
    <div>
      <h2 style={{
        color: won ? "#10B981" : "#D4A574", 
        margin: "0 0 10px 0", 
        fontSize: 20,
        textAlign: "center",
        letterSpacing: 2,
      }}>
        {won ? "🏆 WINNER!" : `🏆 ${results[0]?.player.nickname} WINS`}
      </h2>
      <div style={{background:"rgba(0,0,0,0.5)", padding:12, borderRadius:10}}>
        {results.map((r, i) => (
          <div key={i} style={{
            display:"flex", justifyContent:"space-between", 
            padding:"6px 0", 
            borderBottom: i < results.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none", 
            fontSize:12,
          }}>
            <span>{r.player.nickname}</span>
            <span style={{color: i===0 ? "#FDE047" : "#aaa", fontWeight: i===0 ? 900 : 400}}>
              {r.hand.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------
// 스타일 (모바일 우선)
// -----------------------------------------------------
const S = {
  loadingScreen: { 
    display: "flex", justifyContent: "center", alignItems: "center", 
    height: "100vh", background: "#050A10", 
    color: "#D4A574", fontSize: 16, fontWeight: 900, letterSpacing: 4,
  },
  container: { 
    display: "flex", flexDirection: "column", 
    minHeight: "100vh", 
    background: "radial-gradient(circle at 50% -20%, #1a2a3a 0%, #030712 100%)", 
    fontFamily: "'Inter', sans-serif", color: "#fff", 
  },
  
  topBar: { 
    display: "flex", justifyContent: "space-between", alignItems: "center", 
    padding: "12px 16px", 
    background: "linear-gradient(180deg, rgba(0,0,0,0.6), transparent)", 
    zIndex: 100,
  },
  backBtn: { 
    background: "rgba(255,255,255,0.08)", 
    border: "1px solid rgba(255,255,255,0.2)", 
    padding: "6px 12px", borderRadius: 20, 
    color: "#fff", fontSize: 10, fontWeight: 800, 
    cursor: "pointer", backdropFilter: "blur(4px)",
  },
  tableTitle: { 
    fontSize: 13, fontWeight: 900, letterSpacing: 1, 
    color: "#fff", display: "flex", flexDirection: "column", alignItems: "center",
    maxWidth: "50%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  blindText: { 
    color: "#D4A574", fontWeight: 700, fontSize: 10, letterSpacing: 2, marginTop: 2,
  },
  phaseBadge: { 
    background: "rgba(212,165,116,0.15)", 
    border: "1px solid rgba(212,165,116,0.3)", 
    color: "#D4A574", padding: "4px 10px", borderRadius: 8, 
    fontSize: 10, fontWeight: 800, letterSpacing: 1,
  },

  errorBanner: {
    margin: "0 16px 10px",
    background: "rgba(239,68,68,0.2)", color: "#FCA5A5", 
    padding: "10px 14px", borderRadius: 8, 
    border: "1px solid #EF4444", fontWeight: 600, fontSize: 12,
  },
  
  room: { 
    flex: 1, position: "relative", 
    display: "flex", justifyContent: "center", alignItems: "center", 
    padding: "20px 12px", minHeight: 320,
  },
  tableMat: { 
    width: "100%", maxWidth: 500, 
    aspectRatio: "1.3/1",   // 더 둥글게 (모바일 친화)
    background: "radial-gradient(ellipse at center, #0F5132 0%, #062817 100%)", 
    borderRadius: "50% / 40%", 
    border: "8px solid #1a1a1a", 
    boxShadow: "0 20px 50px rgba(0,0,0,0.8), inset 0 0 40px rgba(0,0,0,0.8)", 
    position: "relative",
  },
  tableInnerRing: { 
    position: "absolute", 
    top: "8%", left: "4%", right: "4%", bottom: "8%", 
    border: "1px solid rgba(212,165,116,0.2)", 
    borderRadius: "50% / 40%", 
    display: "flex", justifyContent: "center", alignItems: "center",
  },
  
  centerArea: { 
    display: "flex", flexDirection: "column", alignItems: "center", 
    zIndex: 1,
  },
  mainPot: { 
    background: "rgba(0,0,0,0.7)", 
    border: "1px solid rgba(253,224,71,0.3)", 
    padding: "6px 18px", borderRadius: 16, 
    textAlign: "center", marginBottom: 12, 
    boxShadow: "0 6px 16px rgba(0,0,0,0.5)",
  },
  potLabel: { fontSize: 8, color: "rgba(255,255,255,0.6)", letterSpacing: 2, fontWeight: 700 },
  potValue: { 
    fontSize: 18, fontWeight: 900, color: "#FDE047", 
    animation: "potGlow 2s infinite",
  },
  communityBoard: { 
    display: "flex", gap: 4, 
    background: "rgba(0,0,0,0.3)", padding: 8, borderRadius: 10,
  },
  cardOutline: { 
    width: 44, height: 64, 
    border: "2px dashed rgba(255,255,255,0.1)", borderRadius: 6,
  },
  currentBetInfo: {
    marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.6)",
    fontWeight: 700, letterSpacing: 1,
  },
  
  seatContainer: { 
    position: "absolute", 
    transformOrigin: "center center",
  },
  avatarBox: { 
    background: "linear-gradient(180deg, #1F2937, #111827)", 
    border: "2px solid", 
    padding: "6px 10px", borderRadius: 10, 
    minWidth: 70, textAlign: "center", 
    boxShadow: "0 6px 16px rgba(0,0,0,0.5)", 
    position: "relative", zIndex: 10,
  },
  avatarName: { 
    fontSize: 10, fontWeight: 800, color: "#fff", 
    marginBottom: 2, whiteSpace: "nowrap", 
    textOverflow: "ellipsis", overflow: "hidden", maxWidth: 90,
  },
  avatarChips: { fontSize: 11, fontWeight: 900, color: "#FDE047" },
  statusTag: { 
    position: "absolute", bottom: -8, left: "50%", 
    transform: "translateX(-50%)", 
    background: "#4B5563", fontSize: 8, fontWeight: 900, 
    padding: "2px 6px", borderRadius: 4, letterSpacing: 1,
  },
  dealerButton: { 
    background: "#fff", color: "#000", 
    width: 18, height: 18, borderRadius: "50%", 
    display: "flex", justifyContent: "center", alignItems: "center", 
    fontSize: 10, fontWeight: 900, 
    boxShadow: "0 2px 6px rgba(0,0,0,0.5)", 
    position: "absolute", right: -8, top: -8, zIndex: 2,
  },
  betDisplay: { 
    background: "rgba(0,0,0,0.85)", 
    border: "1px solid rgba(212,165,116,0.5)", 
    color: "#FDE047", padding: "3px 10px", borderRadius: 10, 
    fontSize: 10, fontWeight: 800, 
    display: "flex", alignItems: "center", gap: 4, 
    marginBottom: 4,
    boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
  },
  holeCardsWrap: { 
    display: "flex", marginBottom: 2, 
    position: "relative",
    paddingLeft: 10,  // 겹침 보정
  },
  cardBody: { 
    background: "#fff", borderRadius: 4, 
    display: "flex", flexDirection: "column", 
    justifyContent: "center", alignItems: "center", 
    boxShadow: "0 2px 6px rgba(0,0,0,0.6)",
  },
  cardBack: { 
    width: 32, height: 46, 
    background: "repeating-linear-gradient(45deg, #7F1D1D, #7F1D1D 5px, #991B1B 5px, #991B1B 10px)", 
    border: "1px solid #fff", borderRadius: 4, 
    boxShadow: "0 2px 6px rgba(0,0,0,0.6)",
  },

  hud: { 
    background: "linear-gradient(180deg, transparent, #030712 20%)", 
    padding: "16px", zIndex: 100, 
    minHeight: 140,
  },
  centerBox: { textAlign: "center" },
  waitingText: { 
    color: "rgba(255,255,255,0.6)", marginBottom: 12, 
    fontSize: 12,
  },
  startBtn: { 
    background: "linear-gradient(135deg, #D4A574, #B07D46)", 
    border: "none", padding: "14px 32px", borderRadius: 25, 
    color: "#000", fontSize: 13, fontWeight: 900, 
    letterSpacing: 2, cursor: "pointer", 
    boxShadow: "0 8px 16px rgba(0,0,0,0.5)",
  },
  
  showdownPanel: { 
    background: "rgba(30,41,59,0.95)", 
    border: "1px solid #D4A574", padding: 16, borderRadius: 14, 
    textAlign: "center", maxWidth: 400, margin: "0 auto",
    boxShadow: "0 16px 32px rgba(0,0,0,0.8)",
  },
  nextRoundBtn: { 
    width: "100%", padding: 12, marginTop: 12, 
    background: "linear-gradient(135deg, #D4A574, #B07D46)", 
    border: "none", color: "#000", borderRadius: 10, 
    fontWeight: 900, cursor: "pointer", letterSpacing: 1, fontSize: 13,
  },
  
  actionPanel: {},
  waitingTurnText: { 
    textAlign: "center", 
    background: "rgba(0,0,0,0.5)", padding: 16, borderRadius: 12, 
    fontSize: 13, color: "rgba(255,255,255,0.5)", 
    border: "1px dashed rgba(255,255,255,0.1)",
  },
  myControls: { display: "flex", flexDirection: "column", gap: 10 },
  raiseArea: { 
    background: "rgba(0,0,0,0.6)", padding: 12, borderRadius: 10, 
    border: "1px solid rgba(255,255,255,0.1)",
  },
  raiseHeader: { 
    display: "flex", justifyContent: "space-between", 
    alignItems: "center", fontSize: 11, fontWeight: 700, marginBottom: 8,
    flexWrap: "wrap", gap: 6,
  },
  raiseValue: { color: "#D4A574", fontSize: 14 },
  quickBtnGroup: { display: "flex", gap: 4 },
  quickBtn: { 
    background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", 
    padding: "4px 8px", borderRadius: 4, fontSize: 9, fontWeight: 800, cursor: "pointer",
  },
  buttonGroup: { display: "flex", gap: 8 },
  actionBtn: { 
    flex: 1, padding: "14px 8px", border: "none", borderRadius: 10, 
    color: "#fff", fontSize: 13, fontWeight: 900, 
    cursor: "pointer", 
    boxShadow: "0 6px 12px rgba(0,0,0,0.4)", 
    textShadow: "0 2px 4px rgba(0,0,0,0.5)",
    letterSpacing: 1,
  },
};