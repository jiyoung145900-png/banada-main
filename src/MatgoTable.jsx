// ===================================================================
// 🎴 MatgoTable - 2인 맞고 플레이 화면
// ===================================================================
// 레이아웃:
//   상단: 상대방 (손패 뒷면, 획득 카드, 점수)
//   중앙: 바닥패 (월별 그룹) + 더미
//   하단: 내 획득 카드 + 내 손패 + 내 점수
//
// 모달:
//   - 바닥 2장 중 선택
//   - 고/스톱 선택
//   - 라운드 종료 (승자)
// ===================================================================

import { useEffect, useState, useMemo } from "react";
import {
  useMatgoTable,
  useMyHand,
  useMatgoHeartbeat,
  playMatgoCard,
  chooseMatgoField,
  decideMatgoGoStop,
  leaveMatgoTable,
  startMatgo,
  TARGET_SCORE,
  ENTRY_FEE,
} from "./MatgoFirestore";

// ──────────────────────────────────────────────────────────
// 카드 정보 (matgoRules.js 와 동일한 ID 체계)
// ──────────────────────────────────────────────────────────
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

// 월별 배경색 (화투 느낌)
const MONTH_COLOR = {
  1: "#2E7D32", 2: "#C62828", 3: "#AD1457", 4: "#1B5E20",
  5: "#F57F17", 6: "#6A1B9A", 7: "#D32F2F", 8: "#424242",
  9: "#F9A825", 10: "#D84315", 11: "#4527A0", 12: "#1565C0",
};

// 타입별 테두리
const TYPE_BORDER = {
  GWANG: "#FFD700",       // 광 = 금색
  YEOL: "#FF6B9D",        // 열끗 = 핑크
  TTI: "#FF9800",         // 띠 = 주황
  PI: "#9E9E9E",          // 피 = 회색
  SSANG_PI: "#E91E63",    // 쌍피 = 자홍
};

// ──────────────────────────────────────────────────────────
// 메인 컴포넌트
// ──────────────────────────────────────────────────────────
export default function MatgoTable({
  tableId,
  userId,
  userName,
  gamePoints,
  onPointsChange,
  onBack,
}) {
  const { table, loading } = useMatgoTable(tableId);
  const { hand: myHand, refresh: refreshHand } = useMyHand(
    tableId,
    table?.currentRound,
    table?.phase
  );
  useMatgoHeartbeat(tableId, true);

  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showRoundResult, setShowRoundResult] = useState(null);  // { winner, scores }

  // CSS 애니메이션 주입
  useEffect(() => {
    if (document.getElementById("matgo-table-anims")) return;
    const style = document.createElement("style");
    style.id = "matgo-table-anims";
    style.innerHTML = `
      @keyframes matgoDealCard {
        from { transform: translateY(-30px) scale(0.8); opacity: 0; }
        to { transform: translateY(0) scale(1); opacity: 1; }
      }
      @keyframes matgoFlipCard {
        0% { transform: rotateY(180deg); opacity: 0; }
        100% { transform: rotateY(0); opacity: 1; }
      }
      @keyframes matgoTurnPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(76,175,80,0.6); }
        50% { box-shadow: 0 0 0 10px rgba(76,175,80,0); }
      }
      @keyframes matgoWinnerGlow {
        0%, 100% { text-shadow: 0 0 10px rgba(255,215,0,0.5); }
        50% { text-shadow: 0 0 25px rgba(255,215,0,1); }
      }
      @keyframes matgoScoreUp {
        from { transform: scale(1); color: #fff; }
        50% { transform: scale(1.3); color: #FFD700; }
        to { transform: scale(1); color: #fff; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // 라운드 종료 감지 (lastRoundResult 가 바뀔 때)
  useEffect(() => {
    if (table?.lastRoundResult && table.phase === "waiting") {
      const result = table.lastRoundResult;
      if (result.finishedAt && Date.now() - result.finishedAt < 10000) {
        setShowRoundResult(result);
      }
    }
  }, [table?.lastRoundResult?.finishedAt, table?.phase]);

  // 턴이 내게 돌아오면 손패 새로고침
  useEffect(() => {
    if (table?.currentTurn === userId && table?.phase === "playing") {
      refreshHand();
    }
  }, [table?.currentTurn, table?.phase, userId]);

  // 포인트 반영
  useEffect(() => {
    if (!table?.lastRoundResult) return;
    // 승자가 나면 +ENTRY_FEE, 패자면 -ENTRY_FEE (양쪽에서 가져가서 승자 지급)
    // 서버가 users 문서 업데이트 하지만, 클라이언트 UI 업데이트는 onPointsChange 로
    // 바로 조회할 수 있도록 서버가 이미 처리했으므로 여기서 추가 처리 X
  }, [table?.lastRoundResult?.finishedAt]);

  if (loading || !table) {
    return (
      <div style={S.loadingContainer}>
        <div style={S.loadingText}>🎴 테이블 로딩 중...</div>
      </div>
    );
  }

  const players = table.players || [];
  const opponent = players.find(p => p !== userId);
  const opponentName = (table.names || {})[opponent] || "상대";
  const myNickname = (table.names || {})[userId] || userName || "나";
  const amIPlayer = players.includes(userId);
  const myTurn = table.currentTurn === userId;
  const myHandCount = (table.handCounts || {})[userId] || 0;
  const oppHandCount = opponent ? (table.handCounts || {})[opponent] || 0 : 0;

  // 획득 카드 분류
  const myCaptured = classifyCards((table.captured || {})[userId] || []);
  const oppCaptured = opponent ? classifyCards((table.captured || {})[opponent] || []) : classifyCards([]);

  // 점수 계산 (로컬 미리보기)
  const myScore = calcPreviewScore(myCaptured, oppCaptured);
  const oppScore = calcPreviewScore(oppCaptured, myCaptured);

  // 바닥패 월별 그룹
  const fieldByMonth = groupByMonth(table.field || []);

  // ──────────────────────────────────────────────────────────
  // 액션 핸들러
  // ──────────────────────────────────────────────────────────
  async function handleCardClick(cardId) {
    if (!myTurn || isActing) return;
    if (table.choosing) return;
    setIsActing(true);
    setActionError("");
    try {
      await playMatgoCard(tableId, cardId);
      refreshHand();
    } catch (e) {
      setActionError(e.message || "카드를 낼 수 없습니다");
      setTimeout(() => setActionError(""), 3000);
    } finally {
      setIsActing(false);
    }
  }

  async function handleChooseField(cardId) {
    if (isActing) return;
    setIsActing(true);
    setActionError("");
    try {
      await chooseMatgoField(tableId, cardId);
      refreshHand();
    } catch (e) {
      setActionError(e.message || "선택 실패");
      setTimeout(() => setActionError(""), 3000);
    } finally {
      setIsActing(false);
    }
  }

  async function handleGoStop(decision) {
    if (isActing) return;
    setIsActing(true);
    setActionError("");
    try {
      await decideMatgoGoStop(tableId, decision);
      refreshHand();
    } catch (e) {
      setActionError(e.message || "결정 실패");
      setTimeout(() => setActionError(""), 3000);
    } finally {
      setIsActing(false);
    }
  }

  async function handleStart() {
    setIsActing(true);
    setActionError("");
    try {
      await startMatgo(tableId);
    } catch (e) {
      setActionError(e.message || "시작 실패");
      setTimeout(() => setActionError(""), 3000);
    } finally {
      setIsActing(false);
    }
  }

  async function handleLeave() {
    if (!confirm("정말 나가시겠습니까? 플레이 중이면 자동 패배 처리됩니다.")) return;
    await leaveMatgoTable(tableId);
    onBack();
  }

  // ──────────────────────────────────────────────────────────
  // 선택 모달이 떠있고 내가 선택해야 할 때
  // ──────────────────────────────────────────────────────────
  const isMyChoosing = table.choosing && table.choosing.userId === userId;

  // ──────────────────────────────────────────────────────────
  // 렌더링
  // ──────────────────────────────────────────────────────────
  return (
    <div style={S.container}>
      {/* 상단 바 */}
      <div style={S.topBar}>
        <button onClick={handleLeave} style={S.leaveBtn}>← 나가기</button>
        <div style={S.topCenter}>
          <div style={S.topLabel}>ROUND #{table.currentRound}</div>
          <div style={S.topPhase}>{getPhaseText(table.phase)}</div>
        </div>
        <div style={S.pointsBadge}>💎 {(gamePoints || 0).toLocaleString()}</div>
      </div>

      {/* 액션 에러 */}
      {actionError && (
        <div style={S.errorBanner}>⚠️ {actionError}</div>
      )}

      {/* 상대방 영역 */}
      <PlayerBoard
        name={opponentName}
        isOpponent={true}
        handCount={oppHandCount}
        captured={oppCaptured}
        score={oppScore.score}
        isMyTurn={table.currentTurn === opponent}
        goCount={(table.goCount || {})[opponent] || 0}
      />

      {/* 바닥패 */}
      <FieldBoard
        fieldByMonth={fieldByMonth}
        lastAction={table.lastAction}
      />

      {/* 더미 카드 */}
      <PileArea
        remaining={table.pileRemaining || 0}
      />

      {/* 내 영역 */}
      <PlayerBoard
        name={myNickname}
        isOpponent={false}
        handCount={myHandCount}
        captured={myCaptured}
        score={myScore.score}
        isMyTurn={myTurn}
        goCount={(table.goCount || {})[userId] || 0}
      />

      {/* 내 손패 */}
      {amIPlayer && table.phase === "playing" && (
        <HandArea
          hand={myHand}
          isMyTurn={myTurn}
          onCardClick={handleCardClick}
          disabled={isActing || !!table.choosing}
          field={table.field || []}
        />
      )}

      {/* 대기 상태: 상대 기다리는 중 */}
      {table.phase === "waiting" && amIPlayer && (
        <div style={S.waitingBox}>
          {players.length < 2 ? (
            <>
              <div style={S.waitingTitle}>🕐 상대방을 기다리는 중...</div>
              <div style={S.waitingSub}>
                2명이 모이면 자동으로 시작됩니다<br />
                또는 아래 버튼을 눌러 수동으로 시작
              </div>
            </>
          ) : (
            <>
              <div style={S.waitingTitle}>✅ 준비 완료!</div>
              <div style={S.waitingSub}>
                시작 버튼을 눌러주세요<br />
                입장료 {ENTRY_FEE.toLocaleString()}씩 차감됩니다
              </div>
              <button
                onClick={handleStart}
                disabled={isActing}
                style={S.startBtn}
              >
                🎴 시작하기
              </button>
            </>
          )}
        </div>
      )}

      {/* 바닥 선택 모달 */}
      {isMyChoosing && (
        <ChooseFieldModal
          choosing={table.choosing}
          onChoose={handleChooseField}
          disabled={isActing}
        />
      )}

      {/* 고/스톱 모달 */}
      {table.phase === "go_stop" && table.currentTurn === userId && (
        <GoStopModal
          score={myScore.score}
          goCount={(table.goCount || {})[userId] || 0}
          onDecide={handleGoStop}
          disabled={isActing}
        />
      )}

      {/* 상대 고/스톱 선택 대기 */}
      {table.phase === "go_stop" && table.currentTurn !== userId && (
        <div style={S.waitingOverlay}>
          <div style={S.waitingModal}>
            <div style={S.waitingTitle}>⏳ {opponentName}님이 GO/STOP 선택 중</div>
          </div>
        </div>
      )}

      {/* 라운드 종료 모달 */}
      {showRoundResult && (
        <RoundResultModal
          result={showRoundResult}
          userId={userId}
          opponentName={opponentName}
          onClose={() => setShowRoundResult(null)}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 서브 컴포넌트: 플레이어 영역 (상대/나)
// ──────────────────────────────────────────────────────────
function PlayerBoard({ name, isOpponent, handCount, captured, score, isMyTurn, goCount }) {
  const borderColor = isMyTurn ? "#4CAF50" : "rgba(255,255,255,0.1)";
  return (
    <div
      style={{
        ...S.playerBoard,
        border: `2px solid ${borderColor}`,
        animation: isMyTurn ? "matgoTurnPulse 2s ease-in-out infinite" : "none",
      }}
    >
      {/* 이름 + 손패 */}
      <div style={S.playerBoardTop}>
        <div style={S.playerName}>
          {isOpponent ? "👤" : "🙋"} {name}
          {isMyTurn && <span style={S.turnTag}>· 차례</span>}
          {goCount > 0 && <span style={S.goTag}>{goCount}고!</span>}
        </div>
        <div style={S.handCountBox}>
          {Array.from({ length: handCount }).map((_, i) => (
            <div key={i} style={S.cardBack} />
          ))}
          <span style={S.handCountLabel}>{handCount}장</span>
        </div>
      </div>

      {/* 획득 카드 요약 */}
      <div style={S.capturedBoard}>
        <CapturedGroup label="광" cards={captured.gwang} typeKey="GWANG" />
        <CapturedGroup label="띠" cards={captured.tti} typeKey="TTI" />
        <CapturedGroup label="열끗" cards={captured.yeol} typeKey="YEOL" />
        <CapturedGroup label="피" cards={[...captured.pi, ...captured.ssangPi]} typeKey="PI" ssangCount={captured.ssangPi.length} />
      </div>

      {/* 점수 */}
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

// ──────────────────────────────────────────────────────────
// 서브 컴포넌트: 바닥패
// ──────────────────────────────────────────────────────────
function FieldBoard({ fieldByMonth, lastAction }) {
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
              <div style={{
                ...S.monthLabel,
                background: MONTH_COLOR[m] || "#333",
              }}>{m}月</div>
              <div style={S.monthCards}>
                {fieldByMonth[m].map(id => (
                  <SmallCard key={id} cardId={id} isNew={lastAction?.cardId === id} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 서브 컴포넌트: 더미
// ──────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────
// 서브 컴포넌트: 내 손패
// ──────────────────────────────────────────────────────────
function HandArea({ hand, isMyTurn, onCardClick, disabled, field }) {
  return (
    <div style={S.handArea}>
      <div style={S.handLabel}>
        🖐️ 내 손패 ({hand.length}장)
        {isMyTurn && <span style={S.myTurnTag}> · 내 차례</span>}
      </div>
      <div style={S.handCards}>
        {hand.map(cardId => {
          const info = cardInfo(cardId);
          // 바닥에 같은 월 있나?
          const hasMatch = (field || []).some(fid => cardInfo(fid).month === info.month);
          return (
            <Card
              key={cardId}
              cardId={cardId}
              onClick={() => onCardClick(cardId)}
              disabled={disabled || !isMyTurn}
              highlight={hasMatch && isMyTurn}
            />
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 서브 컴포넌트: 카드 (손패 큰 카드)
// ──────────────────────────────────────────────────────────
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
        animation: "matgoDealCard 0.3s ease",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = "translateY(-6px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = "translateY(0)";
        }
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

// 바닥에 깔린 작은 카드
function SmallCard({ cardId, isNew }) {
  const info = cardInfo(cardId);
  const bgColor = MONTH_COLOR[info.month] || "#333";
  const borderColor = TYPE_BORDER[info.type] || "#666";
  return (
    <div
      style={{
        ...S.smallCard,
        background: `linear-gradient(135deg, ${bgColor}EE, ${bgColor})`,
        border: `1.5px solid ${borderColor}`,
        animation: isNew ? "matgoFlipCard 0.5s ease" : "none",
        boxShadow: isNew ? "0 0 10px rgba(255,215,0,0.8)" : "0 1px 3px rgba(0,0,0,0.3)",
      }}
    >
      <div style={S.smallCardMonth}>{info.month}</div>
      <div style={S.smallCardEmoji}>{info.emoji}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 모달: 바닥 2장 중 선택
// ──────────────────────────────────────────────────────────
function ChooseFieldModal({ choosing, onChoose, disabled }) {
  return (
    <div style={S.modalOverlay}>
      <div style={S.modal}>
        <div style={S.modalTitle}>🎯 바닥에서 가져올 카드를 선택하세요</div>
        <div style={S.modalSub}>같은 월의 카드 2장이 있습니다</div>
        <div style={S.chooseCards}>
          {choosing.options.map(cardId => (
            <Card
              key={cardId}
              cardId={cardId}
              onClick={() => onChoose(cardId)}
              disabled={disabled}
              highlight={true}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 모달: 고/스톱 선택
// ──────────────────────────────────────────────────────────
function GoStopModal({ score, goCount, onDecide, disabled }) {
  const nextGo = goCount + 1;
  const nextGoBonus = nextGo === 1 ? "+1점" : nextGo === 2 ? "+2점" : `×${Math.pow(2, nextGo - 2)}배`;

  return (
    <div style={S.modalOverlay}>
      <div style={{ ...S.modal, maxWidth: 380 }}>
        <div style={{ ...S.modalTitle, color: "#FFD700" }}>
          🏆 {score}점 달성!
        </div>
        <div style={S.modalSub}>
          GO로 계속할지, STOP으로 승리를 챙길지 선택하세요
        </div>

        <div style={S.goStopInfo}>
          <div style={S.goInfo}>
            <div style={{ fontSize: 11, color: "#81C784" }}>GO 선언 시</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
              다음 완성 시 {nextGoBonus}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
              단, 상대가 7점 넘으면 "고박" (내가 2배로 짐)
            </div>
          </div>
          <div style={S.stopInfo}>
            <div style={{ fontSize: 11, color: "#FFCC80" }}>STOP 선언 시</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
              현재 {score}점으로 승리 확정
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
              입장료 {ENTRY_FEE.toLocaleString()} × 2 획득
            </div>
          </div>
        </div>

        <div style={S.goStopButtons}>
          <button
            onClick={() => onDecide("stop")}
            disabled={disabled}
            style={{ ...S.goStopBtn, background: "linear-gradient(135deg, #FFD700, #FFA000)", color: "#000" }}
          >
            🛑 STOP
          </button>
          <button
            onClick={() => onDecide("go")}
            disabled={disabled}
            style={{ ...S.goStopBtn, background: "linear-gradient(135deg, #4CAF50, #2E7D32)" }}
          >
            🚀 GO ({nextGo}고)
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 모달: 라운드 종료
// ──────────────────────────────────────────────────────────
function RoundResultModal({ result, userId, opponentName, onClose }) {
  const won = result.winner === userId;
  const draw = !result.winner;
  const myScore = result.scores?.[userId] || 0;
  const oppUserId = Object.keys(result.scores || {}).find(id => id !== userId);
  const oppScore = oppUserId ? result.scores[oppUserId] : 0;

  return (
    <div style={S.modalOverlay}>
      <div style={{ ...S.modal, maxWidth: 400 }}>
        <div
          style={{
            fontSize: 32, fontWeight: 900, textAlign: "center",
            color: won ? "#FFD700" : draw ? "#9E9E9E" : "#E57373",
            animation: won ? "matgoWinnerGlow 2s ease-in-out infinite" : "none",
            marginBottom: 20,
          }}
        >
          {won ? "🏆 승리!" : draw ? "🤝 무승부" : "😢 패배"}
        </div>

        <div style={S.resultScores}>
          <div style={S.resultScoreRow}>
            <span>나</span>
            <strong style={{ color: won ? "#FFD700" : "#fff" }}>{myScore}점</strong>
          </div>
          <div style={S.resultScoreRow}>
            <span>{opponentName}</span>
            <strong style={{ color: !won && !draw ? "#FFD700" : "#fff" }}>{oppScore}점</strong>
          </div>
        </div>

        <div style={{ ...S.resultReward, color: won ? "#4CAF50" : draw ? "#9E9E9E" : "#E57373" }}>
          {won ? `+${ENTRY_FEE.toLocaleString()} 💎` : draw ? "입장료 환불" : `-${ENTRY_FEE.toLocaleString()}`}
        </div>

        <button onClick={onClose} style={S.resultCloseBtn}>
          확인
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────────────────
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

// 로컬 미리보기 점수 (서버와 다를 수 있으니 참고용)
function calcPreviewScore(myCat, oppCat) {
  let score = 0;
  // 광
  const gwang = myCat.gwang.map(cardInfo);
  const hasRain = gwang.some(c => c.rain);
  if (gwang.length >= 5) score += 15;
  else if (gwang.length === 4) score += 4;
  else if (gwang.length === 3) score += hasRain ? 2 : 3;
  // 열끗
  const yeol = myCat.yeol.map(cardInfo);
  if (yeol.length >= 5) score += yeol.length - 4;
  const godori = yeol.filter(c => c.godori).length;
  if (godori === 3) score += 5;
  // 띠
  const tti = myCat.tti.map(cardInfo);
  if (tti.length >= 5) score += tti.length - 4;
  if (tti.filter(c => c.hongdan).length >= 3) score += 3;
  if (tti.filter(c => c.cheongdan).length >= 3) score += 3;
  if (tti.filter(c => c.chodan).length >= 3) score += 3;
  // 피
  const piCount = myCat.pi.length + myCat.ssangPi.length * 2;
  if (piCount >= 10) score += piCount - 9;
  return { score };
}

function getPhaseText(phase) {
  return {
    waiting: "대기 중",
    playing: "플레이 중",
    go_stop: "GO/STOP 선택",
    ended: "종료",
  }[phase] || phase;
}

// ──────────────────────────────────────────────────────────
// 스타일
// ──────────────────────────────────────────────────────────
const S = {
  container: {
    minHeight: "100%",
    background: "linear-gradient(180deg, #0a1a0e 0%, #0d1612 50%, #0a1a0e 100%)",
    color: "#fff",
    padding: 14,
    boxSizing: "border-box",
  },

  loadingContainer: {
    display: "flex", alignItems: "center", justifyContent: "center",
    height: 400, color: "#fff",
  },
  loadingText: {
    fontSize: 14, letterSpacing: 2, opacity: 0.7,
  },

  // 상단 바
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 12,
    gap: 8,
  },
  leaveBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,100,100,0.3)",
    color: "#FF8A80",
    padding: "6px 12px",
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  topCenter: {
    textAlign: "center", flex: 1,
  },
  topLabel: {
    fontSize: 11, letterSpacing: 2,
    color: "#81C784", fontWeight: 700,
  },
  topPhase: {
    fontSize: 10, color: "rgba(255,255,255,0.5)",
    marginTop: 1,
  },
  pointsBadge: {
    background: "rgba(76,175,80,0.15)",
    border: "1px solid rgba(76,175,80,0.4)",
    color: "#E8F5E9",
    padding: "6px 10px",
    borderRadius: 16,
    fontSize: 11,
    fontWeight: 800,
  },

  errorBanner: {
    background: "rgba(244,67,54,0.15)",
    border: "1px solid rgba(244,67,54,0.4)",
    color: "#FFCDD2",
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 11,
    textAlign: "center",
    marginBottom: 10,
  },

  // 플레이어 보드
  playerBoard: {
    background: "rgba(0,0,0,0.3)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    transition: "all 0.3s ease",
  },
  playerBoardTop: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 8,
  },
  playerName: {
    fontSize: 12, fontWeight: 700,
    color: "#fff",
  },
  turnTag: {
    marginLeft: 6,
    fontSize: 10, color: "#4CAF50", fontWeight: 800,
  },
  goTag: {
    marginLeft: 6,
    fontSize: 10, color: "#FFD700", fontWeight: 900,
    background: "rgba(255,215,0,0.15)",
    padding: "2px 6px", borderRadius: 10,
  },
  handCountBox: {
    display: "flex", alignItems: "center", gap: 2,
  },
  cardBack: {
    width: 12, height: 18,
    background: "linear-gradient(135deg, #1B5E20, #2E7D32)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 2,
    marginLeft: -4,
  },
  handCountLabel: {
    marginLeft: 6, fontSize: 10, color: "rgba(255,255,255,0.6)",
  },

  // 획득 카드 보드
  capturedBoard: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 6,
    marginBottom: 8,
  },
  capturedGroup: {
    background: "rgba(0,0,0,0.4)",
    padding: "6px 8px",
    borderRadius: 6,
    textAlign: "center",
  },
  capturedLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: 1,
  },
  capturedCount: {
    fontSize: 16, fontWeight: 900, color: "#fff",
    marginTop: 2,
  },
  ssangTag: {
    fontSize: 9, color: "#E91E63", fontWeight: 700,
  },

  // 점수 바
  scoreBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "rgba(0,0,0,0.4)",
    padding: "6px 10px", borderRadius: 6,
  },
  scoreLabel: {
    fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1,
  },
  scoreValue: {
    fontSize: 14, fontWeight: 900,
  },

  // 바닥패
  fieldBoard: {
    background: "linear-gradient(180deg, rgba(27,94,32,0.3), rgba(27,94,32,0.1))",
    border: "1px solid rgba(76,175,80,0.3)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    minHeight: 90,
  },
  fieldLabel: {
    fontSize: 11, color: "#81C784", fontWeight: 700,
    letterSpacing: 1, marginBottom: 8,
  },
  fieldCards: {
    display: "flex", flexWrap: "wrap", gap: 8,
  },
  emptyText: {
    fontSize: 11, color: "rgba(255,255,255,0.4)",
    padding: "10px 0",
  },
  monthGroup: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 2,
  },
  monthLabel: {
    fontSize: 9, fontWeight: 700, color: "#fff",
    padding: "1px 5px", borderRadius: 4,
    letterSpacing: 0.5,
  },
  monthCards: {
    display: "flex", gap: 2,
  },

  // 더미
  pileArea: {
    display: "flex", alignItems: "center", gap: 10,
    justifyContent: "center",
    marginBottom: 10,
  },
  pileStack: {
    position: "relative", width: 32, height: 46,
  },
  pileCard: {
    position: "absolute",
    width: 32, height: 46,
    background: "linear-gradient(135deg, #1B5E20, #2E7D32)",
    border: "1.5px solid rgba(255,215,0,0.4)",
    borderRadius: 4,
  },
  pileLabel: {
    fontSize: 11, color: "rgba(255,255,255,0.6)",
  },

  // 손패 영역
  handArea: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(76,175,80,0.2)",
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  handLabel: {
    fontSize: 11, fontWeight: 700,
    color: "#81C784",
    letterSpacing: 1, marginBottom: 8,
  },
  myTurnTag: {
    color: "#FFD700", fontWeight: 900,
  },
  handCards: {
    display: "flex", flexWrap: "wrap", gap: 6,
    justifyContent: "center",
  },

  // 손패 카드
  card: {
    width: 52, height: 76,
    borderRadius: 6,
    padding: 0,
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "space-between",
    color: "#fff",
    transition: "all 0.2s ease",
    userSelect: "none",
  },
  cardMonth: {
    fontSize: 10, fontWeight: 900,
    padding: "2px 4px",
    width: "100%", textAlign: "center",
    background: "rgba(0,0,0,0.4)",
    borderRadius: "5px 5px 0 0",
  },
  cardEmoji: {
    fontSize: 24,
    flex: 1,
    display: "flex", alignItems: "center",
  },
  cardTypeTag: {
    fontSize: 9, fontWeight: 700,
    padding: "1px 4px",
    width: "100%", textAlign: "center",
    background: "rgba(0,0,0,0.5)",
    borderRadius: "0 0 5px 5px",
    letterSpacing: 0.5,
  },

  // 바닥 작은 카드
  smallCard: {
    width: 32, height: 46,
    borderRadius: 4,
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "space-between",
    color: "#fff",
  },
  smallCardMonth: {
    fontSize: 8, fontWeight: 900,
    padding: "1px 2px",
    width: "100%", textAlign: "center",
    background: "rgba(0,0,0,0.4)",
    borderRadius: "3px 3px 0 0",
  },
  smallCardEmoji: {
    fontSize: 16,
    flex: 1,
    display: "flex", alignItems: "center",
  },

  // 대기 상자
  waitingBox: {
    background: "rgba(76,175,80,0.08)",
    border: "1px dashed rgba(76,175,80,0.3)",
    borderRadius: 12,
    padding: 20,
    textAlign: "center",
    marginTop: 10,
  },
  waitingTitle: {
    fontSize: 14, fontWeight: 800, color: "#81C784",
    marginBottom: 8,
  },
  waitingSub: {
    fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.6,
    marginBottom: 14,
  },
  startBtn: {
    background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
    border: "none",
    color: "#fff",
    padding: "12px 28px",
    borderRadius: 8,
    fontSize: 13, fontWeight: 800, letterSpacing: 1.5,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(76,175,80,0.4)",
  },

  // 모달
  modalOverlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.8)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 20,
  },
  waitingOverlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 999,
  },
  waitingModal: {
    background: "linear-gradient(135deg, rgba(27,94,32,0.95), rgba(10,30,15,0.95))",
    border: "1px solid rgba(76,175,80,0.5)",
    padding: 24, borderRadius: 16,
    textAlign: "center",
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
  chooseCards: {
    display: "flex", gap: 12, justifyContent: "center",
  },

  // 고/스톱
  goStopInfo: {
    display: "flex", flexDirection: "column", gap: 10,
    marginBottom: 20,
  },
  goInfo: {
    background: "rgba(76,175,80,0.1)",
    border: "1px solid rgba(76,175,80,0.3)",
    padding: 10, borderRadius: 8,
  },
  stopInfo: {
    background: "rgba(255,215,0,0.1)",
    border: "1px solid rgba(255,215,0,0.3)",
    padding: 10, borderRadius: 8,
  },
  goStopButtons: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  goStopBtn: {
    padding: "14px 20px",
    border: "none",
    borderRadius: 10,
    color: "#fff",
    fontSize: 14, fontWeight: 900, letterSpacing: 1,
    cursor: "pointer",
    transition: "transform 0.1s",
  },

  // 라운드 종료
  resultScores: {
    background: "rgba(0,0,0,0.4)",
    padding: 12, borderRadius: 8,
    marginBottom: 16,
  },
  resultScoreRow: {
    display: "flex", justifyContent: "space-between",
    padding: "6px 0",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    fontSize: 13,
  },
  resultReward: {
    textAlign: "center",
    fontSize: 20, fontWeight: 900,
    marginBottom: 20,
  },
  resultCloseBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #4CAF50, #2E7D32)",
    border: "none",
    color: "#fff",
    padding: "12px",
    borderRadius: 8,
    fontSize: 13, fontWeight: 800, letterSpacing: 1,
    cursor: "pointer",
  },
};
