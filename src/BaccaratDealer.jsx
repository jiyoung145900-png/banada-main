// ===================================================================
// 💁 BaccaratDealer - 딜러 영역 (아바타 + 메시지)
// ===================================================================
// Props:
//   phase: "betting" | "dealing" | "squeezing" | "result"
//   message: 딜러가 말하는 메시지
// ===================================================================

import React from "react";

function DealerAvatar({ phase }) {
  const isActive = phase === "dealing" || phase === "squeezing";
  return (
    <div style={{
      width: 48, height: 48, borderRadius: "50%",
      background: "linear-gradient(135deg, #D4A574, #B07D46)",
      padding: 2,
      boxShadow: isActive ? "0 0 15px rgba(212,165,116,0.6)" : "none",
      transition: "box-shadow 0.3s",
    }}>
      <svg viewBox="0 0 100 100" style={{width: "100%", height: "100%", borderRadius: "50%", background: "#1F0817"}}>
        {/* 머리 */}
        <circle cx="50" cy="40" r="18" fill="#F5D5B9" />
        {/* 머리카락 */}
        <path d="M 32 40 Q 32 25 50 22 Q 68 25 68 40 Q 68 30 50 28 Q 32 30 32 40 Z" fill="#2F1810" />
        <path d="M 32 40 Q 30 48 32 55 L 36 50 Z" fill="#2F1810" />
        <path d="M 68 40 Q 70 48 68 55 L 64 50 Z" fill="#2F1810" />
        {/* 눈 */}
        <circle cx="43" cy="42" r="1.5" fill="#1F0817" />
        <circle cx="57" cy="42" r="1.5" fill="#1F0817" />
        {/* 입술 */}
        <path d="M 44 50 Q 50 54 56 50" stroke="#E63975" strokeWidth="1.5" fill="none" />
        {/* 몸 */}
        <path d="M 20 100 Q 20 70 50 68 Q 80 70 80 100 Z" fill="#1F0817" />
        <path d="M 30 100 Q 30 75 50 75 Q 70 75 70 100 Z" fill="#2A0520" />
        {/* 보우타이 */}
        <path d="M 42 68 L 50 72 L 58 68 L 58 76 L 50 72 L 42 76 Z" fill="#E63975" />
      </svg>
    </div>
  );
}

export default function BaccaratDealer({ phase, message, dealerName = "SOPHIA" }) {
  return (
    <div style={S.dealerArea}>
      <div style={S.dealerLeft}>
        <DealerAvatar phase={phase} />
        <div>
          <div style={S.dealerName}>{dealerName}</div>
          <div style={S.dealerBadge}>LIVE DEALER</div>
        </div>
      </div>
      <div style={S.dealerMessage}>{message}</div>
    </div>
  );
}

const S = {
  dealerArea: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "linear-gradient(135deg, rgba(230,57,117,0.1), rgba(212,165,116,0.1))",
    border: "1px solid rgba(212,165,116,0.3)",
    borderRadius: 14, padding: "10px 14px", marginBottom: 12,
  },
  dealerLeft: { display: "flex", gap: 10, alignItems: "center" },
  dealerName: { fontSize: 13, fontWeight: 900, color: "#D4A574", letterSpacing: 1 },
  dealerBadge: { fontSize: 9, color: "#E63975", fontWeight: 800, letterSpacing: 2, marginTop: 2 },
  dealerMessage: {
    fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: 1,
    textAlign: "right", maxWidth: "55%",
    background: "rgba(0,0,0,0.3)", padding: "6px 12px", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
  },
};
