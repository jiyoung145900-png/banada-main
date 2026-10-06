import React, { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, limit, getDocs, getDoc, doc } from "firebase/firestore";
import { db, authReady } from "./firebase";
import { maskNickname } from "./nicknameUtils";
import { getFakeNickname } from "./fakeNicknames";

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
  const [fakeNicknameOverrides, setFakeNicknameOverrides] = useState({});
  const [openCard, setOpenCard] = useState(null); // 서비스 카드 펼침 (null | 0 | 1 | 2)

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

  // ★ 가짜 닉네임 오버라이드 로드
  useEffect(() => {
    let cancelled = false;
    authReady.then(async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "global"));
        if (snap.exists() && !cancelled) {
          setFakeNicknameOverrides(snap.data().fakeNicknameOverrides || {});
        }
      } catch (e) {
        console.warn("overrides 로드 실패:", e);
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

  // ★ 서비스 카드 3개 + 펼침 내용
  const serviceCards = [
    {
      icon: "♡",
      title: tr("맞춤 매칭", "マッチング", "Tailored Match"),
      sub: tr("나에게 맞는 인연", "理想のご縁を", "Find your fit"),
      head: tr("단 한 사람만을 위한 1:1 커스텀 매칭", "あなただけの1対1カスタムマッチング", "1:1 custom matching, made for you alone"),
      items: [
        [tr("취향 및 스타일 분석", "好みとスタイルの分析", "Preference & style analysis"),
         tr("외모, 이상형, 연령대 등 디테일한 선호 조건을 파악합니다.", "外見、理想のタイプ、年齢層など、細かなご希望を丁寧に伺います。", "We learn your detailed preferences: looks, ideal type, age range and more.")],
        [tr("검증된 매니저 추천", "厳選したマネージャーのご紹介", "Verified manager recommendation"),
         tr("조건에 가장 부합하는 최적의 매니저를 엄선해 소개합니다.", "条件に最も合うマネージャーを厳選してご紹介します。", "We hand-pick and introduce the manager who best fits your criteria.")],
        [tr("안전한 만남 진행", "安心の出会いをサポート", "Safe introductions"),
         tr("개인정보 노출 없이 실시간 컨시어지를 통해 안전하게 연결해 드립니다.", "個人情報を公開せず、リアルタイムのコンシェルジュを通じて安全にお繋ぎします。", "We connect you through live concierge support, without exposing your personal information.")],
      ],
    },
    {
      icon: "♕",
      title: tr("프리미엄 회원", "プレミアム会員", "Premium Member"),
      sub: tr("특별한 회원 혜택", "特別な会員特典", "Exclusive perks"),
      head: tr("프리미엄 멤버십만을 위한 VIP 혜택", "プレミアム会員だけのVIP特典", "VIP benefits exclusively for premium members"),
      items: [
        [tr("우선 매칭권", "優先マッチング", "Priority matching"),
         tr("대기 시간 없이 원하는 스타일의 매니저를 우선 배정합니다.", "待ち時間なく、ご希望のスタイルのマネージャーを優先的にご案内します。", "Skip the wait with priority assignment of the manager style you prefer.")],
        [tr("비공개 프로필 케어", "非公開プロフィールケア", "Private profile care"),
         tr("원하는 매니저에게만 선택적으로 공개되는 프라이빗 시스템입니다.", "ご希望のマネージャーにのみ選択的に公開されるプライベートシステムです。", "A private system where your profile is shown only to the managers you choose.")],
        [tr("VIP 전용 혜택", "VIP専用特典", "VIP-only perks"),
         tr("담당 실장의 1:1 집중 관리와 특별 케어를 제공합니다.", "担当マネージャーによる1対1の集中管理と特別ケアをご提供します。", "One-on-one focused management and special care from your dedicated manager.")],
      ],
    },
    {
      icon: "✦",
      title: tr("1:1 실장 케어", "1:1専任ケア", "1:1 Manager Care"),
      sub: tr("전담 맞춤 상담", "専任のご相談", "Dedicated support"),
      head: tr("첫 상담부터 만남까지, 나만의 담당 실장 밀착 케어", "初回相談から出会いまで、専任担当がしっかりサポート", "From first consultation to meeting, your own dedicated manager"),
      items: [
        [tr("실시간 1:1 케어", "リアルタイム1対1ケア", "Live 1:1 care"),
         tr("매칭 과정 중 발생하는 모든 문의를 담당 실장이 직접 해결합니다.", "マッチング中のあらゆるご質問に、担当マネージャーが直接対応します。", "Your dedicated manager personally handles every question during the process.")],
        [tr("피드백 & 케어", "フィードバック＆ケア", "Feedback & care"),
         tr("만남 후 피드백을 반영하고 매칭 매너 가이드를 제공합니다.", "出会い後のフィードバックを反映し、マナーガイドをご提供します。", "We reflect your post-meeting feedback and provide a matching etiquette guide.")],
        [tr("철저한 비밀 보장", "徹底した秘密保持", "Strict confidentiality"),
         tr("모든 상담 및 진행 이력은 철저하게 보안이 유지됩니다.", "すべての相談・進行履歴は厳重に管理されます。", "All consultations and records are kept strictly confidential.")],
      ],
      cta: true,
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
            {serviceCards.map((c, i) => {
              const active = openCard === i;
              return (
                <div
                  key={i}
                  className="service-card"
                  style={{
                    ...h.serviceCard,
                    ...(active ? h.serviceCardActive : {}),
                  }}
                  onClick={() => setOpenCard(active ? null : i)}
                >
                  <div style={h.serviceIcon}>{c.icon}</div>
                  <div style={h.serviceTitle}>{c.title}</div>
                  <div style={h.serviceSub}>{c.sub}</div>
                  <div style={{ ...h.serviceChevron, transform: active ? "rotate(180deg)" : "none" }}>▾</div>
                </div>
              );
            })}
          </div>

          {openCard !== null && (
            <div className="service-panel" style={h.servicePanel}>
              <div style={h.panelHead}>{serviceCards[openCard].head}</div>
              {serviceCards[openCard].items.map(([label, desc], idx) => (
                <div key={idx} style={h.panelItem}>
                  <span style={h.panelNum}>{idx + 1}</span>
                  <div>
                    <div style={h.panelLabel}>{label}</div>
                    <div style={h.panelDesc}>{desc}</div>
                  </div>
                </div>
              ))}
              {serviceCards[openCard].cta && (
                <button onClick={handleTelegram} style={h.panelBtn}>
                  💬 {tr("담당 실장과 상담하기", "担当マネージャーに相談する", "Talk to a manager")}
                </button>
              )}
            </div>
          )}
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
                    {getFakeNickname(rv.userId, fakeNicknameOverrides)}
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
          <p style={h.footerNotice}>PRIVATE CONCIERGE · 12:00 – 24:00</p>
          <p style={h.footerHours}>
            {tr("연중무휴 · 매일 낮 12시 ~ 밤 12시", "年中無休 · 毎日12:00〜24:00", "Open every day · 12:00 PM – 12:00 AM")}
          </p>
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
        @keyframes panelIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .service-panel { animation: panelIn 0.3s ease; }
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
  serviceChevron: { fontSize: 11, color: '#FFD700', opacity: 0.7, marginTop: 6, transition: 'transform 0.25s ease' },
  serviceCardActive: { borderColor: 'rgba(255,215,0,0.85)', boxShadow: '0 0 18px rgba(255,215,0,0.18)' },
  servicePanel: { marginTop: 12, padding: '18px 16px', borderRadius: 14, background: 'linear-gradient(160deg, rgba(120,20,60,0.28), rgba(15,8,12,0.95))', border: '1px solid rgba(212,175,55,0.45)' },
  panelHead: { fontSize: 14, fontWeight: 800, color: '#FFD700', textAlign: 'center', lineHeight: 1.5, marginBottom: 16 },
  panelItem: { display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 },
  panelNum: { flexShrink: 0, width: 22, height: 22, borderRadius: '50%', border: '1px solid rgba(212,175,55,0.6)', color: '#FFD700', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  panelLabel: { fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 3 },
  panelDesc: { fontSize: 12, color: '#bdb199', lineHeight: 1.6 },
  panelBtn: { width: '100%', marginTop: 4, padding: '12px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(212,175,55,0.6)', color: '#f6e7c1', fontSize: 13, fontWeight: 800, cursor: 'pointer' },

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
  footerNotice: { fontSize: 10, color: '#555', marginTop: 8, letterSpacing: 2, marginBottom: 2 },
  footerHours: { fontSize: 11, color: '#7a6f5a', margin: 0 },
};