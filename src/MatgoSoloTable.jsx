// ===================================================================
// 🤖 MatgoSoloTable - AI와의 1:1 연습 모드 (로컬 전용)
// ===================================================================
// - 서버 호출 없음 (완전 클라이언트 실행)
// - 포인트 사용 안함 (연습 모드)
// - 어려운 AI 상대
// - UI는 MatgoTable 과 거의 동일
// ===================================================================

import { useEffect, useState, useMemo, useRef } from "react";
import { createGame, applyMove, getLegalMoves, calcScore, CARDS } from "./matgoRules";
import { chooseAIMove, chooseAIFieldCard, chooseAIGoStop } from "./MatgoAI";

const TARGET_SCORE = 7;
const AI_THINK_MS = 800;  // AI 생각하는 시간 (ms)

// 카드 정보 (MatgoTable.jsx와 동일한 체계)
const CARD_INFO = {
  '01-G': { month: 1, type: 'GWANG', name: '송학', emoji: '🌲' },
  '01-T': { month: 1, type: 'TTI', name: '송학띠', emoji: '🎀', hongdan: true },
  '01-P1': { month: 1, type: 'PI', name: '송학피', emoji: '🌲' },
  '01-P2': { month: 1, type: 'PI', name: '송학피', emoji: '🌲' },
  '02-Y': { month: 2, type: 'YEOL', name: '매조', emoji: '🌸' },
  '02-T': { month: 2, type: 'TTI', name: '매조띠', emoji: '🎀', hongdan: true },
  '02-P1': { month: 2, type: 'PI', name: '매조피', emoji: '🌸' },
  '02-P2': { month: 2, type: 'PI', name: '매조피', emoji: '🌸' },
  '03-G': { month: 3, type: 'GWANG', name: '벚꽃', emoji: '🌸' },
  '03-T': { month: 3, type: 'TTI', name: '벚꽃띠', emoji: '🎀', hongdan: true },
  '03-P1': { month: 3, type: 'PI', name: '벚꽃피', emoji: '🌸' },
  '03-P2': { month: 3, type: 'PI', name: '벚꽃피', emoji: '🌸' },
  '04-Y': { month: 4, type: 'YEOL', name: '흑싸리', emoji: '🌿' },
  '04-T': { month: 4, type: 'TTI', name: '흑싸리띠', emoji: '🎀', chodan: true },
  '04-P1': { month: 4, type: 'PI', name: '흑싸리피', emoji: '🌿' },
  '04-P2': { month: 4, type: 'PI', name: '흑싸리피', emoji: '🌿' },
  '05-Y': { month: 5, type: 'YEOL', name: '난초', emoji: '🌼' },
  '05-T': { month: 5, type: 'TTI', name: '난초띠', emoji: '🎀', chodan: true },
  '05-P1': { month: 5, type: 'PI', name: '난초피', emoji: '🌼' },
  '05-P2': { month: 5, type: 'PI', name: '난초피', emoji: '🌼' },
  '06-Y': { month: 6, type: 'YEOL', name: '모란', emoji: '🌺' },
  '06-T': { month: 6, type: 'TTI', name: '모란띠', emoji: '🎀', cheongdan: true },
  '06-P1': { month: 6, type: 'PI', name: '모란피', emoji: '🌺' },
  '06-P2': { month: 6, type: 'PI', name: '모란피', emoji: '🌺' },
  '07-Y': { month: 7, type: 'YEOL', name: '홍싸리', emoji: '🍁' },
  '07-T': { month: 7, type: 'TTI', name: '홍싸리띠', emoji: '🎀', chodan: true },
  '07-P1': { month: 7, type: 'PI', name: '홍싸리피', emoji: '🍁' },
  '07-P2': { month: 7, type: 'PI', name: '홍싸리피', emoji: '🍁' },
  '08-G': { month: 8, type: 'GWANG', name: '공산', emoji: '🌙' },
  '08-Y': { month: 8, type: 'YEOL', name: '공산기러기', emoji: '🦆', godori: true },
  '08-P1': { month: 8, type: 'PI', name: '공산피', emoji: '🌙' },
  '08-P2': { month: 8, type: 'PI', name: '공산피', emoji: '🌙' },
  '09-Y': { month: 9, type: 'YEOL', name: '국화', emoji: '🏵️' },
  '09-T': { month: 9, type: 'TTI', name: '국화띠', emoji: '🎀', cheongdan: true },
  '09-P1': { month: 9, type: 'PI', name: '국화피', emoji: '🏵️' },
  '09-P2': { month: 9, type: 'PI', name: '국화피', emoji: '🏵️' },
  '10-Y': { month: 10, type: 'YEOL', name: '단풍사슴', emoji: '🦌', godori: true },
  '10-T': { month: 10, type: 'TTI', name: '단풍띠', emoji: '🎀', cheongdan: true },
  '10-P1': { month: 10, type: 'PI', name: '단풍피', emoji: '🍂' },
  '10-P2': { month: 10, type: 'PI', name: '단풍피', emoji: '🍂' },
  '11-G': { month: 11, type: 'GWANG', name: '오동', emoji: '🐦' },
  '11-SSANG_PI': { month: 11, type: 'SSANG_PI', name: '오동쌍피', emoji: '✨' },
  '11-P1': { month: 11, type: 'PI', name: '오동피', emoji: '🍃' },
  '11-P2': { month: 11, type: 'PI', name: '오동피', emoji: '🍃' },
  '12-G': { month: 12, type: 'GWANG', name: '비광', emoji: '☔', rain: true },
  '12-Y': { month: 12, type: 'YEOL', name: '비제비', emoji: '🐦', godori: true },
  '12-T': { month: 12, type: 'TTI', name: '비띠', emoji: '🎀' },
  '12-SSANG_PI': { month: 12, type: 'SSANG_PI', name: '비쌍피', emoji: '✨' },
};

const cardInfo = (id) => CARD_INFO[id] || { month: 0, type: '?', name: '?', emoji: '?' };

const MONTH_COLOR = {
  1: "#2E7D32", 2: "#C62828", 3: "#AD1457", 4: "#1B5E20",
  5: "#F57F17", 6: "#6A1B9A", 7: "#D32F2F", 8: "#424242",
  9: "#F9A825", 10: "#D84315", 11: "#4527A0", 12: "#1565C0",
};

const TYPE_BORDER = {
  GWANG: "#FFD700",
  YEOL: "#FF6B9D",
  TTI: "#FF9800",
  PI: "#9E9E9E",
  SSANG_PI: "#E91E63",
};

// ──────────────────────────────────────────────────────────
// 메인 컴포넌트
// ──────────────────────────────────────────────────────────
export default function MatgoSoloTable({ userId, userName, onBack }) {
  const [gameState, setGameState] = useState(() => createGame({
    player: userId || 'me',
    opponent: 'ai',
    targetScore: TARGET_SCORE,
  }));
  const [aiThinking, setAIThinking] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showResult, setShowResult] = useState(null);
  const [wins, setWins] = useState({ me: 0, ai: 0 });

  // CSS 애니메이션
  useEffect(() => {
    if (document.getElementById("matgo-solo-anims")) return;
    const style = document.createElement("style");
    style.id = "matgo-solo-anims";
    style.innerHTML = `
      @keyframes matgoSoloCard {
        from { transform: translateY(-30px) scale(0.8); opacity: 0; }
        to { transform: translateY(0) scale(1); opacity: 1; }
      }
      @keyframes matgoSoloTurn {
        0%, 100% { box-shadow: 0 0 0 0 rgba(76,175,80,0.6); }
        50% { box-shadow: 0 0 0 10px rgba(76,175,80,0); }
      }
      @keyframes matgoSoloThinking {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // AI 턴 자동 처리
  useEffect(() => {
    if (gameState.gameOver) return;
    if (gameState.turn !== 'ai') return;
    if (aiThinking) return;

    setAIThinking(true);

    const timer = setTimeout(async () => {
      try {
        if (gameState.phase === 'HAND') {
          // AI 수 선택
          const aiState = {
            hand: gameState.hands.ai,
            field: gameState.field,
            captured: gameState.captured.ai,
            opponent: { captured: gameState.captured[userId || 'me'] },
          };
          const move = chooseAIMove(aiState);
          if (move) {
            setGameState(prev => applyMove(prev, {
              type: 'PLAY_HAND',
              cardId: move.cardId,
              player: 'ai',
            }));
          }
        } else if (gameState.phase === 'CHOOSE' && gameState.pendingChoose) {
          // 바닥 2장 중 선택
          const chosen = chooseAIFieldCard(
            gameState.pendingChoose.cards,
            gameState.captured.ai,
            gameState.captured[userId || 'me'],
          );
          setGameState(prev => applyMove(prev, {
            type: 'CHOOSE_FIELD_CARD',
            cardId: chosen,
            player: 'ai',
          }));
        } else if (gameState.phase === 'GO_STOP') {
          // GO/STOP 결정
          const decision = chooseAIGoStop({
            captured: gameState.captured.ai,
            opponent: { captured: gameState.captured[userId || 'me'] },
            hand: gameState.hands.ai,
            pile: gameState.pile.length,
            goCount: gameState.goCount.ai || 0,
            score: calcScore(gameState.captured.ai, gameState.captured[userId || 'me'] || [], gameState).score,
          });
          setGameState(prev => applyMove(prev, {
            type: decision === 'go' ? 'GO' : 'STOP',
            player: 'ai',
          }));
        }
      } catch (e) {
        console.error('AI 수 오류:', e);
        setActionError('AI 수 처리 중 오류: ' + e.message);
      } finally {
        setAIThinking(false);
      }
    }, AI_THINK_MS);

    return () => clearTimeout(timer);
  }, [gameState.turn, gameState.phase, gameState.gameOver, aiThinking, userId]);

  // 게임 종료 감지
  useEffect(() => {
    if (gameState.gameOver && !showResult) {
      const myScore = calcScore(gameState.captured[userId || 'me'] || [], gameState.captured.ai || [], gameState).score;
      const aiScore = calcScore(gameState.captured.ai || [], gameState.captured[userId || 'me'] || [], gameState).score;
      const winner = gameState.winner || (myScore > aiScore ? (userId || 'me') : (aiScore > myScore ? 'ai' : null));

      setShowResult({ winner, myScore, aiScore });
      if (winner === 'ai') setWins(w => ({ ...w, ai: w.ai + 1 }));
      else if (winner) setWins(w => ({ ...w, me: w.me + 1 }));
    }
  }, [gameState.gameOver]);

  // 플레이어가 카드 내기
  function handleCardClick(cardId) {
    if (gameState.turn !== (userId || 'me')) return;
    if (gameState.phase !== 'HAND') return;
    setActionError("");
    try {
      setGameState(prev => applyMove(prev, {
        type: 'PLAY_HAND',
        cardId,
        player: userId || 'me',
      }));
    } catch (e) {
      setActionError(e.message || '카드를 낼 수 없습니다');
      setTimeout(() => setActionError(""), 3000);
    }
  }

  // 바닥 2장 선택
  function handleChooseField(cardId) {
    try {
      setGameState(prev => applyMove(prev, {
        type: 'CHOOSE_FIELD_CARD',
        cardId,
        player: userId || 'me',
      }));
    } catch (e) {
      setActionError(e.message);
      setTimeout(() => setActionError(""), 3000);
    }
  }

  // GO/STOP
  function handleGoStop(decision) {
    try {
      setGameState(prev => applyMove(prev, {
        type: decision === 'go' ? 'GO' : 'STOP',
        player: userId || 'me',
      }));
    } catch (e) {
      setActionError(e.message);
      setTimeout(() => setActionError(""), 3000);
    }
  }

  // 다음 판
  function handleNextRound() {
    setGameState(createGame({
      player: userId || 'me',
      opponent: 'ai',
      targetScore: TARGET_SCORE,
    }));
    setShowResult(null);
  }

  // 나가기 확인
  function handleLeave() {
    if (!gameState.gameOver && !confirm('진행 중인 게임을 포기하고 나가시겠습니까?')) return;
    onBack();
  }

  const me = userId || 'me';
  const myTurn = gameState.turn === me;
  const myHand = gameState.hands[me] || [];
  const aiHand = gameState.hands.ai || [];
  const myCaptured = gameState.captured[me] || [];
  const aiCaptured = gameState.captured.ai || [];
  const myScore = calcScore(myCaptured, aiCaptured, gameState).score;
  const aiScore = calcScore(aiCaptured, myCaptured, gameState).score;
  const fieldByMonth = groupByMonth(gameState.field || []);
  const isMyChoosing = gameState.phase === 'CHOOSE' && gameState.pendingChoose?.userId === me;

  return (
    <div style={S.container}>
      {/* 상단 바 */}
      <div style={S.topBar}>
        <button onClick={handleLeave} style={S.leaveBtn}>← 나가기</button>
        <div style={S.topCenter}>
          <div style={S.topLabel}>🤖 AI 연습 모드</div>
          <div style={S.topPhase}>
            {wins.me}승 {wins.ai}패
          </div>
        </div>
        <div style={S.pointsBadge}>🎯 연습</div>
      </div>

      {/* 에러 */}
      {actionError && <div style={S.errorBanner}>⚠️ {actionError}</div>}

      {/* AI 영역 */}
      <PlayerBoard
        name="🤖 AI (어려움)"
        isOpponent={true}
        handCount={aiHand.length}
        captured={classifyCards(aiCaptured)}
        score={aiScore}
        isMyTurn={gameState.turn === 'ai'}
        aiThinking={aiThinking}
        goCount={gameState.goCount?.ai || 0}
      />

      {/* 바닥패 */}
      <FieldBoard fieldByMonth={fieldByMonth} />

      {/* 더미 */}
      <PileArea remaining={gameState.pile?.length || 0} />

      {/* 내 영역 */}
      <PlayerBoard
        name={userName || '나'}
        isOpponent={false}
        handCount={myHand.length}
        captured={classifyCards(myCaptured)}
        score={myScore}
        isMyTurn={myTurn}
        goCount={gameState.goCount?.[me] || 0}
      />

      {/* 내 손패 */}
      {!gameState.gameOver && (
        <HandArea
          hand={myHand}
          isMyTurn={myTurn && gameState.phase === 'HAND'}
          onCardClick={handleCardClick}
          field={gameState.field || []}
        />
      )}

      {/* 바닥 선택 모달 */}
      {isMyChoosing && (
        <ChooseFieldModal
          options={gameState.pendingChoose.cards}
          onChoose={handleChooseField}
        />
      )}

      {/* GO/STOP 모달 */}
      {gameState.phase === 'GO_STOP' && myTurn && (
        <GoStopModal
          score={myScore}
          goCount={gameState.goCount?.[me] || 0}
          onDecide={handleGoStop}
        />
      )}

      {/* AI 생각 중 오버레이 */}
      {aiThinking && gameState.phase === 'GO_STOP' && gameState.turn === 'ai' && (
        <div style={S.waitingOverlay}>
          <div style={S.waitingModal}>
            <div style={S.waitingTitle}>🤖 AI가 GO/STOP 고민 중...</div>
          </div>
        </div>
      )}

      {/* 결과 모달 */}
      {showResult && (
        <ResultModal
          result={showResult}
          userId={me}
          onNext={handleNextRound}
          onBack={onBack}
        />
      )}
    </div>
  );
}

// ─────────────── 서브 컴포넌트: 플레이어 영역 ───────────────
function PlayerBoard({ name, isOpponent, handCount, captured, score, isMyTurn, aiThinking, goCount }) {
  const borderColor = isMyTurn ? "#4CAF50" : "rgba(255,255,255,0.1)";
  return (
    <div
      style={{
        ...S.playerBoard,
        border: `2px solid ${borderColor}`,
        animation: isMyTurn ? "matgoSoloTurn 2s ease-in-out infinite" : "none",
      }}
    >
      <div style={S.playerBoardTop}>
        <div style={S.playerName}>
          {isOpponent ? "" : "🙋"} {name}
          {isMyTurn && (
            <span style={S.turnTag}>
              · {aiThinking ? '🤔 생각 중...' : '차례'}
            </span>
          )}
          {goCount > 0 && <span style={S.goTag}>{goCount}고!</span>}
        </div>
        <div style={S.handCountBox}>
          {Array.from({ length: handCount }).map((_, i) => (
            <div key={i} style={S.cardBack} />
          ))}
          <span style={S.handCountLabel}>{handCount}장</span>
        </div>
      </div>

      <div style={S.capturedBoard}>
        <CapturedGroup label="광" cards={captured.gwang} typeKey="GWANG" />
        <CapturedGroup label="띠" cards={captured.tti} typeKey="TTI" />
        <CapturedGroup label="열끗" cards={captured.yeol} typeKey="YEOL" />
        <CapturedGroup label="피" cards={[...captured.pi, ...captured.ssangPi]} typeKey="PI" ssangCount={captured.ssangPi.length} />
      </div>

      <div style={S.scoreBar}>
        <span style={S.scoreLabel}>점수</span>
        <span style={{
          ...S.scoreValue,
          color: score >= TARGET_SCORE ? "#FFD700" : "#fff",
        }}>
          {score}점
          {score >= TARGET_SCORE && " 🏆"}
        </span>
      </div>
    </div>
  );
}

function CapturedGroup({ label, cards, typeKey, ssangCount = 0 }) {
  const count = typeKey === "PI"
    ? cards.filter(c => cardInfo(c).type === "PI").length + ssangCount * 2
    : cards.length;
  return (
    <div style={S.capturedGroup}>
      <div style={{ ...S.capturedLabel, color: TYPE_BORDER[typeKey] }}>
        {label}
      </div>
      <div style={S.capturedCount}>
        {count}
        {ssangCount > 0 && <span style={S.ssangTag}> (쌍{ssangCount})</span>}
      </div>
    </div>
  );
}

function FieldBoard({ fieldByMonth }) {
  const months = Object.keys(fieldByMonth).map(Number).sort((a, b) => a - b);
  return (
    <div style={S.fieldBoard}>
      <div style={S.fieldLabel}>🀄 바닥패</div>
      <div style={S.fieldCards}>
        {months.length === 0 ? (
          <div style={S.emptyText}>바닥에 카드가 없습니다</div>
        ) : (
          months.map(m => (
            <div key={m} style={S.monthGroup}>
              <div style={{ ...S.monthLabel, background: MONTH_COLOR[m] || "#333" }}>{m}月</div>
              <div style={S.monthCards}>
                {fieldByMonth[m].map(id => (
                  <SmallCard key={id} cardId={id} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PileArea({ remaining }) {
  return (
    <div style={S.pileArea}>
      <div style={S.pileStack}>
        {Array.from({ length: Math.min(remaining, 5) }).map((_, i) => (
          <div
            key={i}
            style={{
              ...S.pileCard,
              transform: `translate(${i * -1}px, ${i * -1}px)`,
              zIndex: 10 - i,
            }}
          />
        ))}
      </div>
      <div style={S.pileLabel}>더미 {remaining}장</div>
    </div>
  );
}

function HandArea({ hand, isMyTurn, onCardClick, field }) {
  return (
    <div style={S.handArea}>
      <div style={S.handLabel}>
        🖐️ 내 손패 ({hand.length}장)
        {isMyTurn && <span style={S.myTurnTag}> · 내 차례</span>}
      </div>
      <div style={S.handCards}>
        {hand.map(cardId => {
          const info = cardInfo(cardId);
          const hasMatch = (field || []).some(fid => cardInfo(fid).month === info.month);
          return (
            <Card
              key={cardId}
              cardId={cardId}
              onClick={() => onCardClick(cardId)}
              disabled={!isMyTurn}
              highlight={hasMatch && isMyTurn}
            />
          );
        })}
      </div>
    </div>
  );
}

function Card({ cardId, onClick, disabled, highlight }) {
  const info = cardInfo(cardId);
  const bgColor = MONTH_COLOR[info.month] || "#333";
  const borderColor = TYPE_BORDER[info.type] || "#666";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...S.card,
        background: `linear-gradient(135deg, ${bgColor}EE, ${bgColor})`,
        border: `2px solid ${highlight ? "#FFD700" : borderColor}`,
        boxShadow: highlight ? "0 0 15px rgba(255,215,0,0.6)" : "0 2px 6px rgba(0,0,0,0.3)",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        animation: "matgoSoloCard 0.3s ease",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.transform = "translateY(-6px)";
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={S.cardMonth}>{info.month}月</div>
      <div style={S.cardEmoji}>{info.emoji}</div>
      <div style={S.cardTypeTag}>
        {info.type === "GWANG" ? "光" :
         info.type === "YEOL" ? "열" :
         info.type === "TTI" ? "띠" :
         info.type === "SSANG_PI" ? "쌍피" : "피"}
      </div>
    </button>
  );
}

function SmallCard({ cardId }) {
  const info = cardInfo(cardId);
  const bgColor = MONTH_COLOR[info.month] || "#333";
  const borderColor = TYPE_BORDER[info.type] || "#666";
  return (
    <div
      style={{
        ...S.smallCard,
        background: `linear-gradient(135deg, ${bgColor}EE, ${bgColor})`,
        border: `1.5px solid ${borderColor}`,
      }}
    >
      <div style={S.smallCardMonth}>{info.month}</div>
      <div style={S.smallCardEmoji}>{info.emoji}</div>
    </div>
  );
}

function ChooseFieldModal({ options, onChoose }) {
  return (
    <div style={S.modalOverlay}>
      <div style={S.modal}>
        <div style={S.modalTitle}>🎯 바닥에서 가져올 카드 선택</div>
        <div style={S.chooseCards}>
          {options.map(cardId => (
            <Card key={cardId} cardId={cardId} onClick={() => onChoose(cardId)} disabled={false} highlight={true} />
          ))}
        </div>
      </div>
    </div>
  );
}

function GoStopModal({ score, goCount, onDecide }) {
  return (
    <div style={S.modalOverlay}>
      <div style={{ ...S.modal, maxWidth: 380 }}>
        <div style={{ ...S.modalTitle, color: "#FFD700" }}>🏆 {score}점 달성!</div>
        <div style={S.modalSub}>GO로 더 큰 점수 노리기 or STOP으로 승리 확정</div>
        <div style={S.goStopButtons}>
          <button
            onClick={() => onDecide("stop")}
            style={{ ...S.goStopBtn, background: "linear-gradient(135deg, #FFD700, #FFA000)", color: "#000" }}
          >
            🛑 STOP
          </button>
          <button
            onClick={() => onDecide("go")}
            style={{ ...S.goStopBtn, background: "linear-gradient(135deg, #4CAF50, #2E7D32)" }}
          >
            🚀 GO ({goCount + 1}고)
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultModal({ result, userId, onNext, onBack }) {
  const won = result.winner === userId;
  const draw = !result.winner;
  return (
    <div style={S.modalOverlay}>
      <div style={{ ...S.modal, maxWidth: 400 }}>
        <div
          style={{
            fontSize: 32, fontWeight: 900, textAlign: "center",
            color: won ? "#FFD700" : draw ? "#9E9E9E" : "#E57373",
            marginBottom: 20,
          }}
        >
          {won ? "🏆 승리!" : draw ? "🤝 무승부" : "😢 패배"}
        </div>

        <div style={S.resultScores}>
          <div style={S.resultScoreRow}>
            <span>나</span>
            <strong style={{ color: won ? "#FFD700" : "#fff" }}>{result.myScore}점</strong>
          </div>
          <div style={S.resultScoreRow}>
            <span>🤖 AI</span>
            <strong style={{ color: !won && !draw ? "#FFD700" : "#fff" }}>{result.aiScore}점</strong>
          </div>
        </div>

        <div style={S.goStopButtons}>
          <button onClick={onBack} style={{ ...S.goStopBtn, background: "rgba(255,255,255,0.1)" }}>
            나가기
          </button>
          <button
            onClick={onNext}
            style={{ ...S.goStopBtn, background: "linear-gradient(135deg, #4CAF50, #2E7D32)" }}
          >
            다음 판 →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────── 유틸 ───────────────
function groupByMonth(cardIds) {
  const map = {};
  for (const id of cardIds) {
    const m = cardInfo(id).month;
    if (!map[m]) map[m] = [];
    map[m].push(id);
  }
  return map;
}

function classifyCards(cardIds) {
  const cards = cardIds.map(id => ({ id, ...cardInfo(id) }));
  return {
    gwang: cards.filter(c => c.type === 'GWANG').map(c => c.id),
    yeol: cards.filter(c => c.type === 'YEOL').map(c => c.id),
    tti: cards.filter(c => c.type === 'TTI').map(c => c.id),
    pi: cards.filter(c => c.type === 'PI').map(c => c.id),
    ssangPi: cards.filter(c => c.type === 'SSANG_PI').map(c => c.id),
  };
}

// ─────────────── 스타일 (MatgoTable과 동일) ───────────────
const S = {
  container: {
    minHeight: "100%",
    background: "linear-gradient(180deg, #0a1a0e 0%, #0d1612 50%, #0a1a0e 100%)",
    color: "#fff",
    padding: 14,
    boxSizing: "border-box",
  },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 12, gap: 8,
  },
  leaveBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,100,100,0.3)",
    color: "#FF8A80",
    padding: "6px 12px", borderRadius: 8,
    fontSize: 11, fontWeight: 700, cursor: "pointer",
  },
  topCenter: { textAlign: "center", flex: 1 },
  topLabel: { fontSize: 11, letterSpacing: 2, color: "#81C784", fontWeight: 700 },
  topPhase: { fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 1 },
  pointsBadge: {
    background: "rgba(76,175,80,0.15)",
    border: "1px solid rgba(76,175,80,0.4)",
    color: "#E8F5E9",
    padding: "6px 10px", borderRadius: 16,
    fontSize: 11, fontWeight: 800,
  },
  errorBanner: {
    background: "rgba(244,67,54,0.15)",
    border: "1px solid rgba(244,67,54,0.4)",
    color: "#FFCDD2",
    padding: "8px 12px", borderRadius: 8,
    fontSize: 11, textAlign: "center", marginBottom: 10,
  },
  playerBoard: {
    background: "rgba(0,0,0,0.3)",
    borderRadius: 12, padding: 10, marginBottom: 10,
    transition: "all 0.3s ease",
  },
  playerBoardTop: {
    display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8,
  },
  playerName: { fontSize: 12, fontWeight: 700, color: "#fff" },
  turnTag: { marginLeft: 6, fontSize: 10, color: "#4CAF50", fontWeight: 800 },
  goTag: {
    marginLeft: 6, fontSize: 10, color: "#FFD700", fontWeight: 900,
    background: "rgba(255,215,0,0.15)", padding: "2px 6px", borderRadius: 10,
  },
  handCountBox: { display: "flex", alignItems: "center", gap: 2 },
  cardBack: {
    width: 12, height: 18,
    background: "linear-gradient(135deg, #1B5E20, #2E7D32)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 2, marginLeft: -4,
  },
  handCountLabel: { marginLeft: 6, fontSize: 10, color: "rgba(255,255,255,0.6)" },
  capturedBoard: {
    display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 8,
  },
  capturedGroup: {
    background: "rgba(0,0,0,0.4)", padding: "6px 8px", borderRadius: 6, textAlign: "center",
  },
  capturedLabel: { fontSize: 10, fontWeight: 700, letterSpacing: 1 },
  capturedCount: { fontSize: 16, fontWeight: 900, color: "#fff", marginTop: 2 },
  ssangTag: { fontSize: 9, color: "#E91E63", fontWeight: 700 },
  scoreBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "rgba(0,0,0,0.4)", padding: "6px 10px", borderRadius: 6,
  },
  scoreLabel: { fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1 },
  scoreValue: { fontSize: 14, fontWeight: 900 },
  fieldBoard: {
    background: "linear-gradient(180deg, rgba(27,94,32,0.3), rgba(27,94,32,0.1))",
    border: "1px solid rgba(76,175,80,0.3)",
    borderRadius: 12, padding: 10, marginBottom: 10, minHeight: 90,
  },
  fieldLabel: { fontSize: 11, color: "#81C784", fontWeight: 700, letterSpacing: 1, marginBottom: 8 },
  fieldCards: { display: "flex", flexWrap: "wrap", gap: 8 },
  emptyText: { fontSize: 11, color: "rgba(255,255,255,0.4)", padding: "10px 0" },
  monthGroup: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  monthLabel: {
    fontSize: 9, fontWeight: 700, color: "#fff",
    padding: "1px 5px", borderRadius: 4, letterSpacing: 0.5,
  },
  monthCards: { display: "flex", gap: 2 },
  pileArea: {
    display: "flex", alignItems: "center", gap: 10,
    justifyContent: "center", marginBottom: 10,
  },
  pileStack: { position: "relative", width: 32, height: 46 },
  pileCard: {
    position: "absolute", width: 32, height: 46,
    background: "linear-gradient(135deg, #1B5E20, #2E7D32)",
    border: "1.5px solid rgba(255,215,0,0.4)", borderRadius: 4,
  },
  pileLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)" },
  handArea: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(76,175,80,0.2)",
    borderRadius: 12, padding: 10, marginTop: 10,
  },
  handLabel: { fontSize: 11, fontWeight: 700, color: "#81C784", letterSpacing: 1, marginBottom: 8 },
  myTurnTag: { color: "#FFD700", fontWeight: 900 },
  handCards: { display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  card: {
    width: 52, height: 76, borderRadius: 6, padding: 0,
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "space-between",
    color: "#fff", transition: "all 0.2s ease", userSelect: "none",
  },
  cardMonth: {
    fontSize: 10, fontWeight: 900, padding: "2px 4px",
    width: "100%", textAlign: "center",
    background: "rgba(0,0,0,0.4)", borderRadius: "5px 5px 0 0",
  },
  cardEmoji: { fontSize: 24, flex: 1, display: "flex", alignItems: "center" },
  cardTypeTag: {
    fontSize: 9, fontWeight: 700, padding: "1px 4px",
    width: "100%", textAlign: "center",
    background: "rgba(0,0,0,0.5)", borderRadius: "0 0 5px 5px", letterSpacing: 0.5,
  },
  smallCard: {
    width: 32, height: 46, borderRadius: 4,
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "space-between", color: "#fff",
  },
  smallCardMonth: {
    fontSize: 8, fontWeight: 900, padding: "1px 2px",
    width: "100%", textAlign: "center",
    background: "rgba(0,0,0,0.4)", borderRadius: "3px 3px 0 0",
  },
  smallCardEmoji: { fontSize: 16, flex: 1, display: "flex", alignItems: "center" },
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 20,
  },
  waitingOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
  },
  waitingModal: {
    background: "linear-gradient(135deg, rgba(27,94,32,0.95), rgba(10,30,15,0.95))",
    border: "1px solid rgba(76,175,80,0.5)",
    padding: 24, borderRadius: 16, textAlign: "center",
  },
  waitingTitle: {
    fontSize: 14, fontWeight: 800, color: "#81C784",
    animation: "matgoSoloThinking 1.5s infinite",
  },
  modal: {
    background: "linear-gradient(135deg, rgba(27,94,32,0.95), rgba(10,30,15,0.95))",
    border: "1px solid rgba(76,175,80,0.5)",
    padding: 24, borderRadius: 16,
    maxWidth: 320, width: "100%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
  },
  modalTitle: {
    fontSize: 16, fontWeight: 800, color: "#fff",
    textAlign: "center", marginBottom: 6,
  },
  modalSub: {
    fontSize: 11, color: "rgba(255,255,255,0.7)",
    textAlign: "center", marginBottom: 16,
  },
  chooseCards: { display: "flex", gap: 12, justifyContent: "center" },
  goStopButtons: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
  },
  goStopBtn: {
    padding: "14px 20px", border: "none", borderRadius: 10,
    color: "#fff", fontSize: 14, fontWeight: 900, letterSpacing: 1,
    cursor: "pointer", transition: "transform 0.1s",
  },
  resultScores: {
    background: "rgba(0,0,0,0.4)", padding: 12, borderRadius: 8, marginBottom: 16,
  },
  resultScoreRow: {
    display: "flex", justifyContent: "space-between",
    padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.1)", fontSize: 13,
  },
};
