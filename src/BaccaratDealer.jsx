// ===================================================================
// 💁 BaccaratDealer - 딜러 영역 (아바타 + 메시지 + 애니메이션)
// ===================================================================

import React, { useEffect } from "react";

// 애니메이션 주입
const injectDealerAnimations = () => {
  if (document.getElementById("baccarat-dealer-animations")) return;
  const style = document.createElement("style");
  style.id = "baccarat-dealer-animations";
  style.innerHTML = `
    @keyframes dealerIdle {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      50% { transform: translateY(-2px) rotate(1deg); }
    }
    @keyframes dealerSpeak {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    @keyframes dealerWave {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-5deg); }
      75% { transform: rotate(5deg); }
    }
    @keyframes dealerPulse {
      0%, 100% { box-shadow: 0 0 10px rgba(212,165,116,0.3); }
      50% { box-shadow: 0 0 25px rgba(212,165,116,0.9); }
    }
    @keyframes msgPop {
      0% { transform: scale(0.8); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes noMoreBetsFlash {
      0%, 100% { background: linear-gradient(135deg, rgba(239,68,68,0.3), rgba(239,68,68,0.1)); }
      50% { background: linear-gradient(135deg, rgba(239,68,68,0.6), rgba(239,68,68,0.3)); }
    }
  `;
  document.head.appendChild(style);
};

function DealerAvatar({ phase, speaking }) {
  const isActive = phase === "dealing" || phase === "squeezing";
  const isWaving = phase === "betting";
  
  let animation = "dealerIdle 3s ease-in-out infinite";
  if (speaking) animation = "dealerSpeak 0.5s ease-in-out infinite";
  else if (isWaving) animation = "dealerWave 2s ease-in-out infinite";

  return (
    <div style={{
      width: 56, height: 56, borderRadius: "50%",
      background: "linear-gradient(135deg, #D4A574, #B07D46)",
      padding: 2,
      animation: isActive ? "dealerPulse 1.5s ease-in-out infinite" : "none",
      transition: "box-shadow 0.3s",
    }}>
      <svg viewBox="0 0 100 100" style={{
        width: "100%", height: "100%", borderRadius: "50%", 
        background: "linear-gradient(180deg, #2A0520, #1F0817)",
        animation,
      }}>
        {/* 어깨 */}
        <path d="M 10 100 Q 10 72 50 70 Q 90 72 90 100 Z" fill="#1A0410" />
        <path d="M 20 100 Q 20 78 50 76 Q 80 78 80 100 Z" fill="#2F1030" />
        
        {/* 목 */}
        <rect x="43" y="55" width="14" height="18" fill="#F5D5B9" />
        
        {/* 머리 */}
        <ellipse cx="50" cy="42" rx="20" ry="22" fill="#F5D5B9" />
        
        {/* 머리카락 - 긴 머리 */}
        <path d="M 30 40 Q 30 20 50 18 Q 70 20 70 40 L 70 55 Q 68 48 65 42 Q 60 32 50 30 Q 40 32 35 42 Q 32 48 30 55 Z" fill="#2F1810" />
        <path d="M 30 40 L 28 65 L 32 60 Z" fill="#2F1810" />
        <path d="M 70 40 L 72 65 L 68 60 Z" fill="#2F1810" />
        
        {/* 눈썹 */}
        <path d="M 40 36 Q 43 34 46 36" stroke="#1F0817" strokeWidth="1.2" fill="none" />
        <path d="M 54 36 Q 57 34 60 36" stroke="#1F0817" strokeWidth="1.2" fill="none" />
        
        {/* 눈 */}
        <circle cx="43" cy="42" r="2" fill="#1F0817" />
        <circle cx="57" cy="42" r="2" fill="#1F0817" />
        <circle cx="43.5" cy="41.5" r="0.5" fill="#fff" />
        <circle cx="57.5" cy="41.5" r="0.5" fill="#fff" />
        
        {/* 코 */}
        <path d="M 50 46 L 48 51 L 52 51 Z" fill="#E8C5A5" />
        
        {/* 입 - speaking 상태일 땐 벌어짐 */}
        {speaking ? (
          <ellipse cx="50" cy="55" rx="3" ry="2" fill="#1F0817" />
        ) : (
          <path d="M 44 54 Q 50 58 56 54" stroke="#E63975" strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
        
        {/* 귀 */}
        <ellipse cx="29" cy="44" rx="2.5" ry="4" fill="#F5D5B9" />
        <ellipse cx="71" cy="44" rx="2.5" ry="4" fill="#F5D5B9" />
        
        {/* 보우타이 */}
        <path d="M 42 72 L 50 76 L 58 72 L 58 80 L 50 76 L 42 80 Z" fill="#E63975" />
        <circle cx="50" cy="76" r="1.5" fill="#A82A5A" />
      </svg>
    </div>
  );
}

export default function BaccaratDealer({ 
  phase, 
  message, 
  dealerName = "SOPHIA",
  roundNumber,
  playerCount,
  speaking = false,
  noMoreBets = false,
}) {
  useEffect(() => { injectDealerAnimations(); }, []);
  
  return (
    <div style={{
      ...S.dealerArea,
      animation: noMoreBets ? "noMoreBetsFlash 0.6s ease-in-out infinite" : "none",
    }}>
      <div style={S.dealerLeft}>
        <DealerAvatar phase={phase} speaking={speaking} />
        <div>
          <div style={S.dealerName}>
            {dealerName}
            <span style={S.liveDot}>●</span>
          </div>
          <div style={S.dealerBadge}>LIVE DEALER</div>
          {playerCount !== undefined && (
            <div style={S.playerCount}>👥 {playerCount} playing</div>
          )}
        </div>
      </div>

      <div style={S.dealerRight}>
        <div style={{...S.dealerMessage, animation: "msgPop 0.3s ease-out"}} key={message}>
          {message}
        </div>
        {roundNumber && (
          <div style={S.roundNumber}>#{roundNumber}</div>
        )}
      </div>
    </div>
  );
}

const S = {
  dealerArea: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "linear-gradient(135deg, rgba(230,57,117,0.1), rgba(212,165,116,0.1))",
    border: "1px solid rgba(212,165,116,0.3)",
    borderRadius: 14, padding: "10px 14px", marginBottom: 12,
    transition: "background 0.3s",
  },
  dealerLeft: { display: "flex", gap: 12, alignItems: "center", flex: 1, minWidth: 0 },
  dealerRight: { display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" },
  dealerName: { 
    fontSize: 13, fontWeight: 900, color: "#D4A574", letterSpacing: 1,
    display: "flex", alignItems: "center", gap: 6,
  },
  liveDot: { color: "#10B981", fontSize: 8, animation: "dealerPulse 1.5s ease-in-out infinite" },
  dealerBadge: { fontSize: 9, color: "#E63975", fontWeight: 800, letterSpacing: 2, marginTop: 2 },
  playerCount: { fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 2, fontWeight: 600 },
  dealerMessage: {
    fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: 1,
    textAlign: "right", maxWidth: 180,
    background: "rgba(0,0,0,0.3)", padding: "6px 12px", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
  },
  roundNumber: {
    fontSize: 9, color: "rgba(212,165,116,0.6)", 
    fontFamily: "monospace", letterSpacing: 1,
  },
};