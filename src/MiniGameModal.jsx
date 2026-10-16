// ===================================================================
// 🎰 MiniGameModal - SECRET LOUNGE (프리미엄 카지노 미니게임 로비)
// ===================================================================
// 로고 5번 클릭 시 열림 (App.jsx 에서 트리거)
// 완전 재미용 (실제 돈 X, gamePoints 별도)
// 
// Props:
//   isOpen: 모달 열림 여부
//   onClose: 닫기 콜백
//   currentUser: 현재 로그인 유저
// ===================================================================

import { useState, useEffect, useRef } from "react";
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
// ★ [변경] 바카라를 라이브 멀티플레이로 교체
import BaccaratLobby from "./BaccaratLobby";
import BaccaratLiveTable from "./BaccaratLiveTable";
import RouletteGame from "./RouletteGame";
import BlackjackGame from "./BlackjackGame";
import HoldemLobby from "./HoldemLobby";
import HoldemTable from "./HoldemTable";

const INITIAL_POINTS = 10000;
const DAILY_BONUS = 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default function MiniGameModal({ isOpen, onClose, currentUser }) {
  const [points, setPoints] = useState(0);
  // screen: lobby, baccarat_lobby, baccarat_table, roulette, blackjack, holdem_lobby, holdem_table
  const [screen, setScreen] = useState("lobby");
  const [currentTableId, setCurrentTableId] = useState(null);
  const [currentBaccaratTable, setCurrentBaccaratTable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bonusMsg, setBonusMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const userId = currentUser?.id;

  // 포인트 로드 + 일일 보너스
  useEffect(() => {
    if (!isOpen || !userId) return;

    (async () => {
      setLoading(true);
      try {
        const userRef = doc(db, "users", userId);
        const snap = await getDoc(userRef);

        let currentPoints = INITIAL_POINTS;
        let lastBonus = Date.now();

        if (snap.exists()) {
          const data = snap.data();
          currentPoints = data.gamePoints ?? INITIAL_POINTS;
          lastBonus = data.gameLastBonus ?? Date.now();
        }

        // 일일 보너스
        if (Date.now() - lastBonus >= ONE_DAY_MS) {
          currentPoints += DAILY_BONUS;
          lastBonus = Date.now();
          await updateDoc(userRef, { gamePoints: currentPoints, gameLastBonus: lastBonus });
          setBonusMsg(`✨ 일일 보너스 +${DAILY_BONUS.toLocaleString()}P`);
          setTimeout(() => setBonusMsg(""), 2800);
        }
        // 처음 플레이
        else if (currentPoints === INITIAL_POINTS) {
          await updateDoc(userRef, { gamePoints: currentPoints, gameLastBonus: lastBonus });
        }

        setPoints(currentPoints);
      } catch (e) {
        console.error("게임 포인트 로드 실패:", e);
        setPoints(INITIAL_POINTS);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, userId]);

  // 포인트 저장: 저장 중에 새 값이 들어오면 버리지 않고 '가장 최근 값' 을 대기시켰다가 앞 저장이 끝나면 이어서 저장
  //   (예전에는 저장 중이면 새 값을 그냥 버려서, 딜 → 결과 지급이 연달아 오면 마지막 값이 서버에 안 올라갔음)
  const savingRef = useRef(false);
  const pendingPointsRef = useRef(null);
  const handlePointsChange = async (newPoints) => {
    setPoints(newPoints);
    if (!userId) return;
    if (savingRef.current) { pendingPointsRef.current = newPoints; return; }
    savingRef.current = true;
    setSaving(true);
    let value = newPoints;
    try {
      for (;;) {
        try {
          const userRef = doc(db, "users", userId);
          await updateDoc(userRef, { gamePoints: value });
        } catch (e) {
          console.error("포인트 저장 실패:", e);
        }
        if (pendingPointsRef.current === null) break;
        value = pendingPointsRef.current;
        pendingPointsRef.current = null;
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleClose = () => {
    setScreen("lobby");
    setCurrentTableId(null);
    setCurrentBaccaratTable(null);
    onClose();
  };

  // 🃏 홀덤 테이블 입장/퇴장
  const handleEnterTable = (tableId) => {
    setCurrentTableId(tableId);
    setScreen("holdem_table");
  };
  const handleLeaveTable = () => {
    setCurrentTableId(null);
    setScreen("holdem_lobby");
  };

  // ★ [신규] 바카라 라이브 테이블 입장/퇴장
  const handleEnterBaccaratTable = (tableId) => {
    setCurrentBaccaratTable(tableId);
    setScreen("baccarat_table");
  };
  const handleLeaveBaccaratTable = () => {
    setCurrentBaccaratTable(null);
    setScreen("baccarat_lobby");
  };

  // ★ 바카라: 베팅 차감/정산 지급을 서버가 처리하므로 포인트를 실시간 동기화 (읽기 전용)
  //   로비 화면에서도 유지 → 나가는 순간 도착하는 정산도 반영됨
  const syncPoints = screen === "lobby" || screen.startsWith("baccarat");
  useEffect(() => {
    if (!isOpen || !userId || !syncPoints) return;
    const unsub = onSnapshot(doc(db, "users", userId), (snap) => {
      const gp = snap.data()?.gamePoints;
      if (typeof gp === "number") setPoints(gp);
    });
    return () => unsub();
  }, [isOpen, userId, syncPoints]);

  if (!isOpen) return null;

  return (
    <div style={S.overlay} onClick={handleClose}>
      <div style={screen === "baccarat_table" ? { ...S.modal, maxWidth: 1080 } : S.modal} onClick={(e) => e.stopPropagation()}>
        {/* 닫기 */}
        <button onClick={handleClose} style={S.closeBtn}>✕</button>

        {/* 보너스 알림 */}
        {bonusMsg && <div style={S.bonusAlert}>{bonusMsg}</div>}

        {loading ? (
          <div style={S.loading}>
            <div style={S.loadingIcon}>🎰</div>
            <div>SECRET LOUNGE 입장 중...</div>
          </div>
        ) : (
          <>
            {screen === "lobby" && (
              <Lobby
                points={points}
                onSelect={setScreen}
                userName={currentUser?.nickname || currentUser?.id || "GUEST"}
              />
            )}
            {screen === "baccarat_lobby" && (
              <BaccaratLobby
                userId={userId}
                userName={currentUser?.nickname || currentUser?.id || "GUEST"}
                gamePoints={points}
                onPointsChange={handlePointsChange}
                onEnterTable={handleEnterBaccaratTable}
                onBack={() => setScreen("lobby")}
              />
            )}
            {screen === "baccarat_table" && currentBaccaratTable && (
              <BaccaratLiveTable
                key={currentBaccaratTable}
                onSwitchTable={(id) => setCurrentBaccaratTable(id)}
                tableId={currentBaccaratTable}
                userId={userId}
                userName={currentUser?.nickname || currentUser?.id || "GUEST"}
                gamePoints={points}
                onLeave={handleLeaveBaccaratTable}
              />
            )}
            {screen === "roulette" && (
              <RouletteGame points={points} onPointsChange={handlePointsChange} onBack={() => setScreen("lobby")} />
            )}
            {screen === "blackjack" && (
              <BlackjackGame points={points} onPointsChange={handlePointsChange} onBack={() => setScreen("lobby")} />
            )}
            {screen === "holdem_lobby" && (
              <HoldemLobby
                userId={userId}
                userName={currentUser?.nickname || currentUser?.id || "GUEST"}
                gamePoints={points}
                onPointsChange={handlePointsChange}
                onEnterTable={handleEnterTable}
                onBack={() => setScreen("lobby")}
              />
            )}
            {screen === "holdem_table" && currentTableId && (
              <HoldemTable
                tableId={currentTableId}
                userId={userId}
                userName={currentUser?.nickname || currentUser?.id || "GUEST"}
                gamePoints={points}
                onPointsChange={handlePointsChange}
                onLeave={handleLeaveTable}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ====================== 로비 화면 ======================
function Lobby({ points, onSelect, userName }) {
  // 애니메이션 CSS 주입
  useEffect(() => {
    if (document.getElementById("mini-game-anims")) return;
    const style = document.createElement("style");
    style.id = "mini-game-anims";
    style.innerHTML = `
      @keyframes modalPop {
        0% { opacity: 0; transform: scale(0.85); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes bonusPop {
        0% { opacity: 0; transform: translate(-50%, -20px) scale(0.8); }
        100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes neonPulse {
        0%, 100% { 
          text-shadow: 0 0 10px rgba(212,165,116,0.8), 0 0 20px rgba(255,107,157,0.5);
          filter: brightness(1);
        }
        50% { 
          text-shadow: 0 0 20px rgba(212,165,116,1), 0 0 40px rgba(255,107,157,0.8);
          filter: brightness(1.2);
        }
      }
      @keyframes cardFloat {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-6px) rotate(1deg); }
      }
      @keyframes shine {
        0% { background-position: -200% 50%; }
        100% { background-position: 200% 50%; }
      }
      @keyframes liveBlink {
        0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(239,68,68,0.8); }
        50% { opacity: 0.6; box-shadow: 0 0 16px rgba(239,68,68,1); }
      }
      @keyframes sparkle {
        0%, 100% { opacity: 0.2; transform: scale(0.8) rotate(0deg); }
        50% { opacity: 1; transform: scale(1.2) rotate(180deg); }
      }
      .game-card-wrap {
        transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
      }
      .game-card-wrap:hover {
        transform: translateY(-6px) scale(1.02);
      }
      .game-card-wrap:hover .card-shine {
        transform: translateX(100%);
      }
      .card-shine {
        position: absolute;
        top: 0; left: -100%; width: 50%; height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
        transition: transform 0.8s;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <div style={L.container}>
      {/* 떠다니는 반짝임 */}
      <div style={L.sparkles}>
        {[...Array(6)].map((_, i) => (
          <span key={i} style={{
            ...L.sparkleItem,
            top: `${10 + Math.random() * 70}%`,
            left: `${Math.random() * 90}%`,
            animationDelay: `${i * 0.4}s`,
            fontSize: `${8 + Math.random() * 8}px`,
          }}>✦</span>
        ))}
      </div>

      {/* 럭셔리 로고 */}
      <div style={L.hero}>
        <div style={L.heroTopLine}>
          <span style={L.heroDeco}>◆</span>
          <span style={L.heroDecoText}>PRIVATE</span>
          <span style={L.heroDeco}>◆</span>
        </div>
        <h1 style={L.heroTitle}>SECRET LOUNGE</h1>
        <div style={L.heroSub}>— VIP MEMBERS ONLY —</div>
      </div>

      {/* 유저 카드 (럭셔리 명함 스타일) */}
      <div style={L.userCard}>
        <div style={L.userCardGlow} />
        <div style={L.userCardTop}>
          <div style={L.userLabel}>MEMBER</div>
          <div style={L.vipTag}>VIP</div>
        </div>
        <div style={L.userName}>{userName}</div>
        <div style={L.userDivider} />
        <div style={L.pointsRow}>
          <span style={L.pointsLabel}>CHIP BALANCE</span>
          <span style={L.pointsBig}>💎 {points.toLocaleString()}</span>
        </div>
      </div>

      {/* 게임 카드 그리드 */}
      <div style={L.gamesGrid}>
        {/* ★ 바카라 - 완전 재디자인 */}
        <PremiumGameCard
          type="baccarat"
          onClick={() => onSelect("baccarat_lobby")}
        />
        <PremiumGameCard
          type="roulette"
          onClick={() => onSelect("roulette")}
        />
        <PremiumGameCard
          type="blackjack"
          onClick={() => onSelect("blackjack")}
        />
        <PremiumGameCard
          type="holdem"
          onClick={() => onSelect("holdem_lobby")}
        />
      </div>

      {/* 안내 */}
      <div style={L.notice}>
        <div style={L.noticeTitle}>🎁 재미용 게임</div>
        <div style={L.noticeText}>
          · 실제 다이아와 무관<br />
          · 일일 로그인 보너스 +{DAILY_BONUS.toLocaleString()}P<br />
          · 파산 시 자동으로 {INITIAL_POINTS.toLocaleString()}P 지급<br />
          · 바카라/홀덤 멀티플레이 가능
        </div>
      </div>
    </div>
  );
}

// ★ [완전 재디자인] 프리미엄 게임 카드
function PremiumGameCard({ type, onClick }) {
  const configs = {
    baccarat: {
      icon: "♠♥",
      iconStyle: { fontSize: 38, letterSpacing: -4, display: "inline-block" },
      title: "BACCARAT",
      subtitle: "Live Multiplayer",
      desc: "💰 10K - 1M · Player vs Banker",
      color: "#E63975",
      colorRgb: "230,57,117",
      bgGradient: "linear-gradient(135deg, rgba(230,57,117,0.15) 0%, rgba(74,24,48,0.4) 100%)",
      badge: "LIVE",
      badgeStyle: { animation: "liveBlink 1.4s infinite", background: "#EF4444" },
    },
    roulette: {
      icon: "🎡",
      iconStyle: { fontSize: 36 },
      title: "ROULETTE",
      subtitle: "European · 157 Bets",
      desc: "스플릿·코너·더즌 · 룰렛",
      color: "#D4A574",
      colorRgb: "212,165,116",
      bgGradient: "linear-gradient(135deg, rgba(212,165,116,0.12) 0%, rgba(74,48,24,0.4) 100%)",
    },
    blackjack: {
      icon: "🂡",
      iconStyle: { fontSize: 38 },
      title: "BLACKJACK",
      subtitle: "21 Challenge",
      desc: "Hit or Stand · 블랙잭",
      color: "#FF6B9D",
      colorRgb: "255,107,157",
      bgGradient: "linear-gradient(135deg, rgba(255,107,157,0.12) 0%, rgba(74,24,48,0.4) 100%)",
    },
    holdem: {
      icon: "🃏",
      iconStyle: { fontSize: 36 },
      title: "HOLD'EM",
      subtitle: "Texas Multiplayer",
      desc: "2~6 Players · 홀덤",
      color: "#10B981",
      colorRgb: "16,185,129",
      bgGradient: "linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(24,74,48,0.4) 100%)",
      badge: "NEW",
      badgeStyle: { background: "#10B981" },
    },
  };
  const cfg = configs[type];

  return (
    <button
      onClick={onClick}
      className="game-card-wrap"
      style={{
        ...L.gameCard,
        border: `1.5px solid rgba(${cfg.colorRgb}, 0.4)`,
        background: cfg.bgGradient,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = cfg.color;
        e.currentTarget.style.boxShadow = `0 20px 50px rgba(${cfg.colorRgb}, 0.35), inset 0 1px 0 rgba(255,255,255,0.1)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = `rgba(${cfg.colorRgb}, 0.4)`;
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Shine 효과 */}
      <div className="card-shine" />
      
      {/* 아이콘 영역 */}
      <div style={{
        ...L.gameIconBox,
        background: `radial-gradient(circle at center, rgba(${cfg.colorRgb}, 0.25) 0%, transparent 70%)`,
      }}>
        <div style={{ ...cfg.iconStyle, color: cfg.color, filter: `drop-shadow(0 0 12px rgba(${cfg.colorRgb}, 0.6))` }}>
          {cfg.icon}
        </div>
      </div>
      
      {/* 텍스트 영역 */}
      <div style={L.gameInfo}>
        <div style={{ ...L.gameTitle, color: cfg.color }}>
          {cfg.title}
        </div>
        <div style={L.gameSubtitle}>{cfg.subtitle}</div>
        <div style={L.gameDesc}>{cfg.desc}</div>
      </div>
      
      {/* 배지 */}
      {cfg.badge && (
        <div style={{ ...L.badge, ...cfg.badgeStyle }}>
          {cfg.badge}
        </div>
      )}
    </button>
  );
}

const S = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.92)",
    backdropFilter: "blur(12px)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px",
  },
  modal: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "92vh",
    overflowY: "auto",
    background: "linear-gradient(180deg, #1f0817 0%, #120410 100%)",
    borderRadius: 24,
    border: "2px solid rgba(212,165,116,0.4)",
    boxShadow: "0 25px 80px rgba(230,57,117,0.35)",
    position: "relative",
    animation: "modalPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(212,165,116,0.3)",
    color: "#fff",
    width: 36,
    height: 36,
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: 18,
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
  },
  bonusAlert: {
    position: "absolute",
    top: 24,
    left: "50%",
    transform: "translateX(-50%)",
    background: "linear-gradient(135deg, #D4A574, #FF6B9D)",
    color: "#fff",
    padding: "12px 28px",
    borderRadius: 50,
    fontWeight: 800,
    fontSize: 14,
    zIndex: 30,
    boxShadow: "0 12px 32px rgba(255,107,157,0.5)",
    animation: "bonusPop 0.6s ease-out",
  },
  loading: { padding: 80, textAlign: "center", color: "#D4A574" },
  loadingIcon: { fontSize: 56, marginBottom: 20, animation: "spin 2.2s linear infinite" },
};

const L = {
  container: { padding: 28, color: "#fff", position: "relative", overflow: "hidden" },
  
  // 떠다니는 반짝임
  sparkles: { 
    position: "absolute", inset: 0, pointerEvents: "none", 
    overflow: "hidden", zIndex: 1,
  },
  sparkleItem: {
    position: "absolute",
    color: "#D4A574",
    opacity: 0.4,
    animation: "sparkle 3s ease-in-out infinite",
    textShadow: "0 0 10px rgba(212,165,116,0.8)",
  },
  
  // Hero 섹션
  hero: { 
    textAlign: "center", marginBottom: 28, paddingTop: 20, 
    position: "relative", zIndex: 2,
  },
  heroTopLine: {
    display: "flex", justifyContent: "center", alignItems: "center",
    gap: 12, marginBottom: 10,
  },
  heroDeco: {
    color: "rgba(212,165,116,0.6)",
    fontSize: 10,
  },
  heroDecoText: {
    fontSize: 10,
    letterSpacing: 6,
    color: "rgba(212,165,116,0.8)",
    fontWeight: 700,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 900,
    letterSpacing: 6,
    margin: 0,
    background: "linear-gradient(90deg, #D4A574 0%, #FFF4E0 25%, #FF6B9D 50%, #FFF4E0 75%, #D4A574 100%)",
    backgroundSize: "200% auto",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    fontFamily: "'Playfair Display', serif",
    animation: "shine 4s linear infinite, neonPulse 3s ease-in-out infinite",
  },
  heroSub: { 
    fontSize: 11, color: "rgba(212,165,116,0.65)", 
    letterSpacing: 4, marginTop: 8,
    fontFamily: "'Cormorant Garamond', serif",
    fontStyle: "italic",
  },
  
  // 유저 카드 (럭셔리 명함)
  userCard: {
    position: "relative",
    background: "linear-gradient(135deg, #2a0d1f 0%, #1f0817 50%, #120410 100%)",
    border: "1px solid rgba(212,165,116,0.4)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
    zIndex: 2,
  },
  userCardGlow: {
    position: "absolute",
    top: -50, right: -50,
    width: 150, height: 150,
    background: "radial-gradient(circle, rgba(212,165,116,0.15) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  userCardTop: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 10,
  },
  userLabel: { 
    fontSize: 10, color: "rgba(255,255,255,0.5)", 
    letterSpacing: 3, fontWeight: 700,
  },
  vipTag: {
    fontSize: 9, fontWeight: 900, letterSpacing: 2,
    color: "#000",
    background: "linear-gradient(135deg, #D4A574, #F0D4B8)",
    padding: "3px 10px", borderRadius: 4,
    boxShadow: "0 2px 8px rgba(212,165,116,0.4)",
  },
  userName: { 
    fontSize: 20, fontWeight: 700, color: "#F0D4B8", 
    margin: "4px 0 12px",
    fontFamily: "'Playfair Display', serif",
    letterSpacing: 0.5,
  },
  userDivider: {
    height: 1,
    background: "linear-gradient(90deg, transparent, rgba(212,165,116,0.4), transparent)",
    margin: "12px 0",
  },
  pointsRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  pointsLabel: {
    fontSize: 9, color: "rgba(255,255,255,0.45)", 
    letterSpacing: 2, fontWeight: 600,
  },
  pointsBig: {
    fontSize: 24,
    fontWeight: 900,
    background: "linear-gradient(135deg, #D4A574, #FF6B9D)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: 1,
  },
  
  // 게임 그리드
  gamesGrid: { 
    display: "flex", flexDirection: "column", gap: 12, 
    marginBottom: 24, position: "relative", zIndex: 2,
  },
  gameCard: {
    position: "relative",
    padding: 0,
    borderRadius: 14,
    cursor: "pointer",
    display: "flex",
    alignItems: "stretch",
    overflow: "hidden",
    textAlign: "left",
    minHeight: 82,
  },
  gameIconBox: {
    width: 80,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRight: "1px solid rgba(255,255,255,0.08)",
  },
  gameInfo: {
    flex: 1,
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 2,
  },
  gameTitle: { 
    fontSize: 17, fontWeight: 900, 
    fontFamily: "'Playfair Display', serif",
    letterSpacing: 1.5,
  },
  gameSubtitle: { 
    fontSize: 11, color: "rgba(255,255,255,0.7)", 
    fontWeight: 600, letterSpacing: 0.5,
  },
  gameDesc: { 
    fontSize: 10, color: "rgba(255,255,255,0.45)", 
    marginTop: 2,
  },
  badge: {
    position: "absolute",
    top: 10, right: 12,
    color: "#fff",
    fontSize: 9,
    fontWeight: 900,
    padding: "3px 8px",
    borderRadius: 4,
    letterSpacing: 1.5,
    boxShadow: "0 3px 8px rgba(0,0,0,0.4)",
  },
  
  // 안내
  notice: {
    padding: 16,
    background: "rgba(212,165,116,0.05)",
    borderRadius: 12,
    border: "1px dashed rgba(212,165,116,0.25)",
    position: "relative",
    zIndex: 2,
  },
  noticeTitle: { 
    color: "#D4A574", fontWeight: 700, 
    marginBottom: 8, fontSize: 12, letterSpacing: 1,
  },
  noticeText: { 
    color: "rgba(255,255,255,0.6)", lineHeight: 1.85, fontSize: 11,
  },
};