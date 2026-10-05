import React, { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db, authReady } from "./firebase";
import { maskNickname } from "./nicknameUtils";

// ★ 지역명 번역 (후기 미리보기용)
const REGION_TRANSLATION = {
  "서울": { ja: "ソウル", en: "Seoul" },
  "경기 북부": { ja: "京畿北部", en: "Gyeonggi N." },
  "경기 남부": { ja: "京畿南部", en: "Gyeonggi S." },
  "인천": { ja: "仁川", en: "Incheon" },
  "충청": { ja: "忠清", en: "Chungcheong" },
  "강원": { ja: "江原", en: "Gangwon" },
  "전라": { ja: "全羅", en: "Jeolla" },
  "경북·대구": { ja: "慶北·大邱", en: "Daegu/GB" },
  "부산·울산·경남": { ja: "釜山·蔚山·慶南", en: "Busan/GN" },
  "제주": { ja: "済州", en: "Jeju" },
};

// ★ 스크롤 시 부드럽게 나타나는 래퍼 (IntersectionObserver 없으면 즉시 표시)
function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setShow(true);
        io.disconnect();
      }
    }, { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(18px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ★ 골드 구분선
function GoldDivider() {
  return (
    <div style={h.divider}>
      <span style={h.dividerLine} />
      <span style={h.dividerIcon}>✦</span>
      <span style={{ ...h.dividerLine, transform: "scaleX(-1)" }} />
    </div>
  );
}

export default function HomeSection({
  slideImages = [],
  innerLogo,
  topAdImage,
  topAdImage2,
  handleTelegram,
  setActiveTab,
  matchingCount = 0,
  t,
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [reviews, setReviews] = useState([]);

  // ★ 언어 헬퍼
  const isKo = t.home === "홈페이지";
  const isJa = t.home === "ホーム";
  const tr = (ko, ja, en) => (isKo ? ko : isJa ? ja : en);

  useEffect(() => {
    if (!slideImages || slideImages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((p) => (p + 1) % slideImages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [slideImages]);

  // ★ 실제 후기 미리보기: 최신 후기 중 평점 4 이상, 내용 있는 것 2개
  useEffect(() => {
    let cancelled = false;
    authReady.then(async () => {
      try {
        const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"), limit(12));
        const snap = await getDocs(q);
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((rv) => (rv.rating || 0) >= 4 && (rv.content || "").trim().length >= 10)
          .slice(0, 2);
        if (!cancelled) setReviews(list);
      } catch (e) {
        console.warn("홈 후기 미리보기 로드 실패:", e);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const getRegionName = (name) => {
    if (!name) return "";
    const first = name.split("/")[0];
    if (isKo) return first;
    const r = REGION_TRANSLATION[name] || REGION_TRANSLATION[first];
    return r ? (isJa ? r.ja : r.en) : first;
  };

  // ★ 서비스 카드 3개 (초안)
  const serviceCards = [
    {
      icon: "♡",
      title: tr("맞춤 매칭", "マッチング", "Tailored Match"),
      sub: tr("나에게 맞는 인연", "理想のご縁を", "Find your fit"),
      onClick: () => setActiveTab && setActiveTab("about"),
    },
    {
      icon: "♕",
      title: tr("프리미엄 회원", "プレミアム会員", "Premium Member"),
      sub: tr("특별한 회원 혜택", "特別な会員特典", "Exclusive perks"),
      onClick: () => setActiveTab && setActiveTab("about"),
    },
    {
      icon: "✦",
      title: tr("1:1 매니저 케어", "1:1ケア", "1:1 Care"),
      sub: tr("전담 맞춤 상담", "専任のご相談", "Dedicated support"),
      onClick: () => handleTelegram && handleTelegram(),
    },
  ];

  return (
    <div style={h.container}>
      {/* ===== BACKGROUND ===== */}
      <div className="bg-glow" />
      <div className="bg-pattern" />

      {/* ===== HEADER ===== */}
      <header style={h.header}>
        <div style={h.logoArea}>
          {innerLogo ? (
            <img src={innerLogo} style={h.logoImg} alt="logo" />
          ) : (
            <h1 style={h.defaultLogo}>
              BANADA<br />
              <span>LOUNGE</span>
            </h1>
          )}
        </div>

        <div style={h.statusBadge}>
          <div className="dot-pulse-wrap">
            <span className="dot-pulse" />
          </div>
          <span style={{ opacity: 0.8 }}>LIVE CONNECTED :</span>
          <b style={h.countText}>{matchingCount} MEMBERS</b>
        </div>
      </header>

      {/* ===== INTRO TEXT ===== */}
      <div style={h.introTextArea}>
        <div style={h.introSub}>WELCOME TO THE PRIVATE</div>
        <div style={h.introMain}>
          {t.welcome.replace("📢 ", "")}
          <span style={h.introSparkle}>✦</span>
        </div>
      </div>

      {/* ===== 슬라이드 ===== */}
      {slideImages && slideImages.length > 0 && (
        <div style={{ ...h.sliderContainer, marginTop: 10, marginBottom: 22 }}>
          <div style={h.sliderWrap}>
            {slideImages.map((img, idx) => {
              const imgUrl = img.url || img;
              const active = idx === currentSlide;
              return (
                <div
                  key={idx}
                  style={{
                    ...h.slide,
                    opacity: active ? 1 : 0,
                    visibility: active ? "visible" : "hidden",
                  }}
                >
                  <div style={h.imageBorderWrapper}>
                    <img src={imgUrl} style={h.actualImg} alt="slide" draggable="false" />
                    <div style={h.slideOverlay} />
                    <div style={h.adTag}>PREMIUM PICK</div>
                  </div>
                </div>
              );
            })}
            <div style={h.indicatorWrap}>
              {slideImages.map((_, i) => (
                <div
                  key={i}
                  style={{
                    ...h.dot,
                    width: i === currentSlide ? 20 : 6,
                    backgroundColor: i === currentSlide ? "#FFD700" : "rgba(255,255,255,0.3)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== 배너 1 ===== */}
      {topAdImage && (
        <Reveal>
          <div style={h.topAdWrap}>
            <img src={topAdImage} style={h.topAdImg} alt="ad" draggable="false" />
          </div>
        </Reveal>
      )}

      {/* ===== ★ 서비스 카드 3개 ===== */}
      <Reveal>
        <div style={h.serviceSection}>
          <div style={h.sectionLabel}>PREMIUM SERVICE</div>
          <div style={h.serviceGrid}>
            {serviceCards.map((c, i) => (
              <div key={i} className="service-card" style={h.serviceCard} onClick={c.onClick}>
                <div style={h.serviceIcon}>{c.icon}</div>
                <div style={h.serviceTitle}>{c.title}</div>
                <div style={h.serviceSub}>{c.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ===== 배너 2 ===== */}
      {topAdImage2 && (
        <Reveal>
          <div style={h.topAdWrap}>
            <img src={topAdImage2} style={h.topAdImg} alt="ad2" draggable="false" />
          </div>
        </Reveal>
      )}

      {/* ===== ★ 실제 후기 미리보기 (후기가 있을 때만 표시) ===== */}
      {reviews.length > 0 && (
        <Reveal>
          <GoldDivider />
          <div style={h.reviewSection}>
            <div style={h.sectionLabel}>REAL REVIEWS</div>
            <div style={h.reviewTitle}>
              {tr("회원님들의 실제 후기", "会員様のリアルな口コミ", "Real Member Reviews")}
            </div>
            {reviews.map((rv) => {
              const text = (rv.content || "").trim();
              return (
                <div key={rv.id} style={h.reviewCard}>
                  <div style={h.reviewStars}>{"★".repeat(Math.min(5, rv.rating || 5))}</div>
                  <div style={h.reviewText}>
                    “{text.length > 70 ? text.slice(0, 70) + "..." : text}”
                  </div>
                  <div style={h.reviewMeta}>
                    {maskNickname(rv.userNickname || rv.userId || "익명")}
                    {(rv.loc || rv.region) ? ` · ${getRegionName(rv.loc || rv.region)}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      )}

      {/* ===== ★ 상담 CTA (버건디/골드) ===== */}
      <Reveal>
        <GoldDivider />
        <div style={h.footerBtnArea}>
          <div style={h.ctaLead}>
            {tr("당신의 새로운 인연을 찾아보세요", "新しいご縁を見つけましょう", "Find your new connection")}
          </div>
          <button onClick={handleTelegram} className="shimmer-btn" style={h.teleBtn}>
            💬 {tr("매니저와 1:1 상담하기", "マネージャーと1:1相談", "Chat 1:1 with a Manager")}
          </button>
          <p style={h.footerNotice}>24/7 PRIVATE CONCIERGE SERVICE</p>
        </div>
      </Reveal>

      <style>{`
        .bg-pattern { position: absolute; inset: 0; background-image: radial-gradient(rgba(255,215,0,0.05) 1px, transparent 1px); background-size: 30px 30px; z-index: -1; }
        .bg-glow { position: absolute; top: -100px; left: 50%; transform: translateX(-50%); width: 150%; height: 600px; background: radial-gradient(circle, rgba(255,215,0,0.07) 0%, transparent 70%); z-index: -1; }

        .dot-pulse-wrap { width: 12px; height: 12px; display: flex; align-items: center; justify-content: center; margin-right: 5px; }
        .dot-pulse { width: 6px; height: 6px; background: #00ff00; border-radius: 50%; box-shadow: 0 0 10px #00ff00; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.5; } 100% { transform: scale(1); opacity: 1; } }

        .shimmer-btn { position: relative; overflow: hidden; outline: none; }
        .shimmer-btn::after { content: ''; position: absolute; top: -50%; left: -100%; width: 200%; height: 200%; background: linear-gradient(45deg, transparent, rgba(255,215,0,0.22), transparent); transform: rotate(45deg); animation: shimmer 3s infinite; }
        @keyframes shimmer { 0% { left: -100%; } 100% { left: 100%; } }

        .service-card { transition: transform 0.2s ease, border-color 0.2s ease; cursor: pointer; }
        .service-card:active { transform: scale(0.97); border-color: rgba(255,215,0,0.7); }

        @media (prefers-reduced-motion: reduce) {
          .shimmer-btn::after, .dot-pulse { animation: none; }
        }
      `}</style>
    </div>
  );
}

const h = {
  container: { position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, #0a0a0a 0%, #150810 40%, #0a0a0a 100%)', paddingBottom: 20, minHeight: '100vh', color: '#fff' },
  header: { padding: '4px 0 10px', textAlign: 'center' },
  logoArea: { marginBottom: 10 },
  logoImg: { maxWidth: '350px', filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.3))' },
  defaultLogo: { fontSize: 36, color: '#fff', fontWeight: 900, letterSpacing: -1, lineHeight: 0.8 },
  statusBadge: { fontSize: 10, color: '#eee', background: 'rgba(255,255,255,0.07)', padding: '8px 16px', borderRadius: '30px', display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid rgba(255,255,255,0.1)' },
  countText: { color: '#FFD700', letterSpacing: 1 },
  introTextArea: { textAlign: 'center', marginTop: 30, marginBottom: 15 },
  introSub: { fontSize: 10, color: '#FFD700', letterSpacing: 2, fontWeight: 600, opacity: 0.8, marginBottom: 5 },
  introMain: { fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: -0.5 },
  introSparkle: { color: '#FFD700', marginLeft: 5, fontSize: 14 },

  sliderContainer: { padding: '0 20px' },
  sliderWrap: { width: '100%', height: '260px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  slide: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 1s ease-in-out' },
  imageBorderWrapper: { position: 'relative', display: 'inline-flex', borderRadius: '15px', border: '1.5px solid rgba(255,215,0,0.5)', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.9)', zIndex: 2, maxWidth: '100%', maxHeight: '240px' },
  actualImg: { display: 'block', maxWidth: '100%', maxHeight: '240px', width: 'auto', height: 'auto', objectFit: 'contain' },
  slideOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.7) 100%)', zIndex: 3 },
  adTag: { position: 'absolute', top: 12, left: 12, background: 'linear-gradient(135deg, #FFD700, #B8860B)', color: '#000', fontSize: 9, fontWeight: 900, padding: '4px 8px', borderRadius: 4, zIndex: 4 },
  indicatorWrap: { position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5, zIndex: 5 },
  dot: { height: 6, borderRadius: 3, transition: 'all 0.3s' },

  topAdWrap: { padding: '0 12px', marginBottom: 22, display: 'flex', justifyContent: 'center' },
  topAdImg: { width: '100%', height: 'auto', display: 'block', borderRadius: '14px', border: '1px solid rgba(255,215,0,0.35)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' },

  // 서비스 카드
  serviceSection: { padding: '4px 12px 26px' },
  sectionLabel: { textAlign: 'center', fontSize: 10, color: '#FFD700', letterSpacing: 3, fontWeight: 700, opacity: 0.85, marginBottom: 14 },
  serviceGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 },
  serviceCard: { background: 'linear-gradient(160deg, rgba(120,20,60,0.35), rgba(15,8,12,0.9))', border: '1px solid rgba(212,175,55,0.4)', borderRadius: 14, padding: '18px 6px 16px', textAlign: 'center' },
  serviceIcon: { fontSize: 26, color: '#FFD700', marginBottom: 8, textShadow: '0 0 12px rgba(255,215,0,0.45)' },
  serviceTitle: { fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 4, letterSpacing: -0.3 },
  serviceSub: { fontSize: 10, color: '#b9a98a', lineHeight: 1.4 },

  // 구분선
  divider: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '6px 24px 22px' },
  dividerLine: { flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.7))' },
  dividerIcon: { color: '#FFD700', fontSize: 12 },

  // 후기
  reviewSection: { padding: '0 16px 26px' },
  reviewTitle: { textAlign: 'center', fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 16 },
  reviewCard: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 14, padding: '16px 16px 14px', marginBottom: 10 },
  reviewStars: { color: '#FFD700', fontSize: 13, letterSpacing: 2, marginBottom: 8 },
  reviewText: { color: '#e8e0d0', fontSize: 13, lineHeight: 1.65, marginBottom: 10 },
  reviewMeta: { color: '#8a7f6a', fontSize: 11 },

  // CTA
  footerBtnArea: { padding: '0 24px 12px', textAlign: 'center' },
  ctaLead: { fontSize: 13, color: '#d9c48a', marginBottom: 14, letterSpacing: 0.3 },
  teleBtn: { width: '100%', padding: '16px', borderRadius: '12px', background: 'linear-gradient(135deg, #6b1235, #2e0a1a)', border: '1px solid rgba(212,175,55,0.75)', color: '#f6e7c1', fontSize: '15px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 6px 24px rgba(107,18,53,0.5)' },
  footerNotice: { fontSize: 10, color: '#555', marginTop: 8, letterSpacing: 2 },
};