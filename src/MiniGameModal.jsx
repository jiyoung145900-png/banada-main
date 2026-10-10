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

import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import BaccaratGame from "./BaccaratGame";
import RouletteGame from "./RouletteGame";
import BlackjackGame from "./BlackjackGame";

const INITIAL_POINTS = 10000;
const DAILY_BONUS = 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default function MiniGameModal({ isOpen, onClose, currentUser }) {
  const [points, setPoints] = useState(0);
  const [screen, setScreen] = useState("lobby");
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

  const handlePointsChange = async (newPoints) => {
    setPoints(newPoints);
    if (!userId || saving) return;
    setSaving(true);

    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { gamePoints: newPoints });
    } catch (e) {
      console.error("포인트 저장 실패:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setScreen("lobby");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={S.overlay} onClick={handleClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
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
            {screen === "baccarat" && (
              <BaccaratGame points={points} onPointsChange={handlePointsChange} onBack={() => setScreen("lobby")} />
            )}
            {screen === "roulette" && (
              <RouletteGame points={points} onPointsChange={handlePointsChange} onBack={() => setScreen("lobby")} />
            )}
            {screen === "blackjack" && (
              <BlackjackGame points={points} onPointsChange={handlePointsChange} onBack={() => setScreen("lobby")} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ====================== 로비 화면 ======================
function Lobby({ points, onSelect, userName }) {
  return (
    <div style={L.container}>
      {/* 고급 로고 */}
      <div style={L.hero}>
        <div style={L.heroIcon}>✨</div>
        <h1 style={L.heroTitle}>SECRET LOUNGE</h1>
        <div style={L.heroSub}>VIP MEMBERS ONLY • REPLAY MODE</div>
      </div>

      {/* 유저 카드 */}
      <div style={L.userCard}>
        <div style={L.userLabel}>Welcome back,</div>
        <div style={L.userName}>{userName}</div>
        <div style={L.pointsBig}>💎 {points.toLocaleString()}P</div>
      </div>

      {/* 게임 카드 그리드 */}
      <div style={L.gamesGrid}>
        <GameCard
          icon="🎴"
          title="Baccarat"
          subtitle="바카라"
          desc="Player vs Banker"
          color="#E63975"
          onClick={() => onSelect("baccarat")}
        />
        <GameCard
          icon="🎡"
          title="Roulette"
          subtitle="룰렛"
          desc="0 ~ 36"
          color="#D4A574"
          onClick={() => onSelect("roulette")}
        />
        <GameCard
          icon="🃏"
          title="Blackjack"
          subtitle="블랙잭"
          desc="21 Game"
          color="#FF6B9D"
          onClick={() => onSelect("blackjack")}
        />
      </div>

      {/* 안내 */}
      <div style={L.notice}>
        <div style={L.noticeTitle}>🎁 재미용 게임</div>
        <div style={L.noticeText}>
          · 실제 다이아와 무관<br />
          · 일일 로그인 보너스 +{DAILY_BONUS.toLocaleString()}P<br />
          · 파산 시 자동으로 {INITIAL_POINTS.toLocaleString()}P 지급
        </div>
      </div>
    </div>
  );
}

function GameCard({ icon, title, subtitle, desc, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...L.gameCard,
        borderColor: color,
        background: `linear-gradient(135deg, rgba(255,107,157,0.06), rgba(212,165,116,0.04))`,
        transition: "all 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px) scale(1.03)";
        e.currentTarget.style.boxShadow = `0 15px 35px ${color}44`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ ...L.gameIcon, color }}>{icon}</div>
      <div style={{ ...L.gameTitle, color }}>{title}</div>
      <div style={L.gameSubtitle}>{subtitle}</div>
      <div style={L.gameDesc}>{desc}</div>
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
  container: { padding: 28, color: "#fff" },
  hero: { textAlign: "center", marginBottom: 32, paddingTop: 24 },
  heroIcon: { fontSize: 42, marginBottom: 10, filter: "drop-shadow(0 0 20px rgba(255,107,157,0.6))" },
  heroTitle: {
    fontSize: 32,
    fontWeight: 900,
    letterSpacing: 6,
    margin: 0,
    background: "linear-gradient(135deg, #D4A574, #FF6B9D, #D4A574)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    fontFamily: "'Playfair Display', serif",
  },
  heroSub: { fontSize: 12, color: "rgba(212,165,116,0.75)", letterSpacing: 5, marginTop: 6 },
  userCard: {
    background: "linear-gradient(135deg, #3d1028, #1f0817)",
    border: "1px solid rgba(212,165,116,0.5)",
    borderRadius: 20,
    padding: 24,
    textAlign: "center",
    marginBottom: 28,
  },
  userLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)", letterSpacing: 2 },
  userName: { fontSize: 22, fontWeight: 700, color: "#D4A574", margin: "6px 0 14px" },
  pointsBig: {
    fontSize: 36,
    fontWeight: 900,
    background: "linear-gradient(135deg, #D4A574, #FF6B9D)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  gamesGrid: { display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 },
  gameCard: {
    padding: 22,
    border: "2px solid",
    borderRadius: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 18,
    textAlign: "left",
  },
  gameIcon: { fontSize: 42 },
  gameTitle: { fontSize: 19, fontWeight: 800, fontFamily: "'Playfair Display', serif" },
  gameSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: 600 },
  gameDesc: { fontSize: 11, color: "rgba(255,255,255,0.5)", marginLeft: "auto" },
  notice: {
    padding: 18,
    background: "rgba(212,165,116,0.07)",
    borderRadius: 14,
    border: "1px dashed rgba(212,165,116,0.3)",
  },
  noticeTitle: { color: "#D4A574", fontWeight: 700, marginBottom: 8, fontSize: 13 },
  noticeText: { color: "rgba(255,255,255,0.65)", lineHeight: 1.85, fontSize: 12 },
};