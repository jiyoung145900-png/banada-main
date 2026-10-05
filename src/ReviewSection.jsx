import React, { useState, useEffect, useCallback, useRef } from "react";
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, increment, arrayUnion, arrayRemove } from "firebase/firestore";
import { db, authReady } from "./firebase";
import { maskNickname } from "./nicknameUtils";
import ReviewWriteModal from "./ReviewWriteModal";
import ReviewDetailModal from "./ReviewDetailModal";
import { r } from "./ReviewStyles";

// ★ 지역 필터 (매니저 섹션과 동일한 광역)
const REGION_FILTERS = ["전체", "서울", "경기 북부", "경기 남부", "인천", "충청", "강원", "전라", "경북·대구", "부산·울산·경남", "제주"];

// ★ 지역명 번역 매핑
const REGION_TRANSLATION = {
  "전체":         { ja: "全体", en: "ALL" },
  "서울":         { ja: "ソウル", en: "SEOUL" },
  "경기 북부":    { ja: "京畿北部", en: "Gyeonggi N." },
  "경기 남부":    { ja: "京畿南部", en: "Gyeonggi S." },
  "인천":         { ja: "仁川", en: "INCHEON" },
  "충청":         { ja: "忠清", en: "CHUNGCHEONG" },
  "강원":         { ja: "江原", en: "GANGWON" },
  "전라":         { ja: "全羅", en: "JEONLA" },
  "경북·대구":    { ja: "慶北·大邱", en: "DAEGU/GB" },
  "부산·울산·경남": { ja: "釜山·蔚山·慶南", en: "BUSAN/GN" },
  "제주":         { ja: "済州", en: "JEJU" },
};

export default function ReviewSection({ 
  t, 
  user, 
  isGuest, 
  regions = [], 
  members = [], 
  telegramLink = "",
  reviewAccessCode = "", // ★ [신규] 후기 작성 가능 추천코드
  backHandlerRef 
}) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState("전체");
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [sortMode, setSortMode] = useState("latest"); // latest | popular
  
  // ★ [신규] PIN 입력 관련 state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinVerified, setPinVerified] = useState(false); // 세션 내 통과 유지
  const [pinError, setPinError] = useState("");
  const [pinFailCount, setPinFailCount] = useState(0);
  const [pinLockedUntil, setPinLockedUntil] = useState(0); // 잠금 해제 시각 (ms)

  const isKo = t?.home === "홈페이지";
  const isJa = t?.home === "ホーム";
  const tr = (ko, ja, en) => isKo ? ko : isJa ? ja : en;

  const getRegionName = (name) => {
    if (!name) return "";
    if (isKo) return name;
    const region = REGION_TRANSLATION[name];
    if (region) return isJa ? region.ja : region.en;
    return name;
  };

  // ★★★ [신규] 로컬 뒤로가기 핸들러 등록
  useEffect(() => {
    if (!backHandlerRef) return;
    
    backHandlerRef.current = () => {
      if (showWriteModal) {
        setShowWriteModal(false);
        return true;
      }
      if (selectedReview) {
        setSelectedReview(null);
        return true;
      }
      return false;
    };
    
    return () => {
      if (backHandlerRef.current) {
        backHandlerRef.current = null;
      }
    };
  }, [showWriteModal, selectedReview, backHandlerRef]);

  // ★ Firestore에서 후기 실시간 로드
  useEffect(() => {
    let unsub = () => {};
    
    authReady.then(() => {
      const q = query(
        collection(db, "reviews"),
        orderBy("createdAt", "desc")
      );
      
      unsub = onSnapshot(q, 
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setReviews(data);
          setLoading(false);
        },
        (err) => {
          console.error("후기 로드 실패:", err);
          setLoading(false);
        }
      );
    });
    
    return () => unsub();
  }, []);

  // ★ 필터링된 후기
  const filteredReviews = reviews.filter(review => {
    if (selectedRegion === "전체" || !selectedRegion) return true;
    // 세부지역이 광역지역에 속하는지 체크 (매니저 데이터 활용)
    if (review.region === selectedRegion) return true;
    // 세부지역(loc)이면 광역지역 매칭
    const member = members.find(m => m.loc === review.loc);
    if (member?.region === selectedRegion) return true;
    return false;
  });

  // ★ 정렬
  const sortedReviews = [...filteredReviews].sort((a, b) => {
    if (sortMode === "popular") {
      return (b.likeCount || 0) - (a.likeCount || 0);
    }
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  // ★ 좋아요 토글
  const handleLike = useCallback(async (reviewId) => {
    if (isGuest) {
      alert(tr("회원만 이용 가능합니다.", "会員のみご利用いただけます。", "Members only."));
      return;
    }
    if (!user?.id) return;
    
    const review = reviews.find(r => r.id === reviewId);
    if (!review) return;
    
    const hasLiked = review.likedBy?.includes(user.id);
    const reviewRef = doc(db, "reviews", reviewId);
    
    try {
      await updateDoc(reviewRef, {
        likeCount: increment(hasLiked ? -1 : 1),
        likedBy: hasLiked ? arrayRemove(user.id) : arrayUnion(user.id),
      });
    } catch (e) {
      console.error("좋아요 실패:", e);
    }
  }, [reviews, user, isGuest]);

  // ★ 후기 삭제 (본인만)
  const handleDelete = useCallback(async (reviewId) => {
    if (!user?.id) return;
    const review = reviews.find(r => r.id === reviewId);
    if (!review || review.userId !== user.id) return;
    
    if (!confirm(tr("정말 삭제하시겠습니까?", "本当に削除しますか?", "Delete this review?"))) return;
    
    try {
      await deleteDoc(doc(db, "reviews", reviewId));
      setSelectedReview(null);
    } catch (e) {
      alert(tr("삭제 실패", "削除失敗", "Delete failed"));
    }
  }, [reviews, user]);

  // ★ Sales Smartly 채팅 위젯 열기 (사이트 내 채팅창)
  const handleConsult = useCallback((extraInfo = "") => {
    try {
      // Sales Smartly 공식 API로 채팅창 열기
      if (window.SSQ && typeof window.SSQ.openChat === 'function') {
        window.SSQ.openChat();
        return;
      }
      // 폴백: 채팅 버튼 자동 클릭
      const chatBtn = document.querySelector('[class*="salesmartly"]')
        || document.querySelector('#SSQ-container')
        || document.querySelector('iframe[src*="salesmartly"]');
      if (chatBtn) {
        chatBtn.click();
        return;
      }
      // 최종 폴백: 텔레그램
      if (telegramLink) {
        window.open(telegramLink, "_blank");
      } else {
        alert(tr("채팅을 준비 중입니다.", "チャットを準備中です。", "Chat loading..."));
      }
    } catch (e) {
      console.warn("Sales Smartly open failed:", e);
      if (telegramLink) window.open(telegramLink, "_blank");
    }
  }, [telegramLink, isKo, isJa]);

  return (
    <div style={r.container}>
      {/* ===== 상단 헤더 - 상담 배너 ===== */}
      <div style={r.consultBanner} onClick={() => handleConsult()}>
        <div style={r.consultBannerInner}>
          <div style={r.consultBannerLeft}>
            <div style={r.consultIcon}>💬</div>
            <div>
              <div style={r.consultTitle}>
                {tr("실시간 상담 연결", "リアルタイム相談", "LIVE CONSULTATION")}
              </div>
              <div style={r.consultSub}>
                {tr("전문 실장이 매칭 도와드립니다", "専門実長がマッチングをお手伝い", "Expert managers help you match")}
              </div>
            </div>
          </div>
          <div style={r.consultArrow}>❯</div>
        </div>
      </div>

      {/* ===== 페이지 제목 ===== */}
      <div style={r.titleWrap}>
        <div style={r.titleSub}>REAL MEMBER REVIEWS</div>
        <h2 style={r.titleMain}>
          {tr("실제 후기", "実際のレビュー", "GENUINE REVIEWS")}
          <span style={r.titleAccent}>✦</span>
        </h2>
      </div>

      {/* ===== 필터 + 정렬 바 ===== */}
      <div style={r.controlBar}>
        {/* ★ [제거됨] 상단 지역 필터 UI (전체/서울/경기 등) → 삭제! 
            후기 카드 개별 지역 해시태그는 유지됨 */}

        {/* 정렬 옵션 */}
        <div style={r.sortRow}>
          <div 
            onClick={() => setSortMode("latest")}
            style={{
              ...r.sortBtn,
              color: sortMode === "latest" ? '#D4AF37' : '#666',
              fontWeight: sortMode === "latest" ? 800 : 500
            }}
          >
            🕐 {tr("최신순", "最新順", "LATEST")}
          </div>
          <div style={r.sortDivider}>|</div>
          <div 
            onClick={() => setSortMode("popular")}
            style={{
              ...r.sortBtn,
              color: sortMode === "popular" ? '#D4AF37' : '#666',
              fontWeight: sortMode === "popular" ? 800 : 500
            }}
          >
            🔥 {tr("인기순", "人気順", "POPULAR")}
          </div>
        </div>
      </div>

      {/* ===== 후기 그리드 ===== */}
      {loading ? (
        <div style={r.loadingWrap}>
          <div className="review-spinner" />
          <div style={r.loadingText}>{tr("후기 불러오는 중...", "レビューを読み込み中...", "Loading reviews...")}</div>
        </div>
      ) : sortedReviews.length === 0 ? (
        <div style={r.emptyWrap}>
          <div style={r.emptyIcon}>📝</div>
          <div style={r.emptyText}>
            {tr("아직 후기가 없습니다.", "まだレビューがありません。", "No reviews yet.")}
          </div>
          <div style={r.emptySub}>
            {tr("첫 후기를 작성해보세요!", "最初のレビューを書いてみましょう!", "Be the first to write a review!")}
          </div>
        </div>
      ) : (
        <div style={r.grid}>
          {sortedReviews.map(review => (
            <ReviewCard 
              key={review.id}
              review={review}
              currentUserId={user?.id}
              isGuest={isGuest}
              onClick={() => setSelectedReview(review)}
              onLike={() => handleLike(review.id)}
              onConsult={() => handleConsult(review.managerName)}
              tr={tr}
              isKo={isKo}
              isJa={isJa}
              getRegionName={getRegionName}
            />
          ))}
        </div>
      )}

      {/* ★ [제거됨] 플로팅 상담 버튼 → Sales Smartly 문의하기 위젯과 중복이라 제거 */}

      {/* ===== 플로팅 작성 버튼 (좌측 하단 고정) ===== */}
      <button 
        style={r.floatingWrite}
        onClick={() => {
          if (isGuest) {
            alert(tr("회원만 작성 가능합니다.", "会員のみ作成可能です。", "Members only."));
            return;
          }
          // ★ [신규] PIN 체크 - Admin에서 설정한 PIN 필요
          // 이미 세션 내 통과했으면 바로 작성 모달
          if (pinVerified) {
            setShowWriteModal(true);
            return;
          }
          // PIN 미설정이면 바로 통과 (설정 안 했으면 아무나 작성)
          if (!reviewAccessCode) {
            setShowWriteModal(true);
            return;
          }
          // PIN 입력 모달 띄우기
          setPinInput("");
          setPinError("");
          setShowPinModal(true);
        }}
        aria-label="후기 작성"
      >
        <span style={{ fontSize: 22 }}>✍️</span>
        <span style={r.floatingWriteText}>
          {tr("후기 작성", "レビュー作成", "WRITE")}
        </span>
      </button>

      {/* ===== PIN 입력 모달 ===== */}
      {showPinModal && (
        <div style={pinS.overlay} onClick={() => setShowPinModal(false)}>
          <div style={pinS.modal} onClick={(e) => e.stopPropagation()}>
            <div style={pinS.icon}>🔒</div>
            <div style={pinS.title}>
              {tr("후기 작성 PIN", "レビュー作成PIN", "REVIEW PIN")}
            </div>
            <div style={pinS.desc}>
              {tr(
                "VIP 전용 서비스입니다.\n관리자에게 받은 PIN을 입력하세요.",
                "VIP専用サービスです。\n管理者から受け取ったPINを入力してください。",
                "VIP members only.\nEnter the PIN from administrator."
              )}
            </div>

            {/* 잠금 상태 체크 */}
            {Date.now() < pinLockedUntil ? (
              <div style={pinS.lockMsg}>
                ⏱ {tr(
                  `${Math.ceil((pinLockedUntil - Date.now()) / 1000)}초 후 다시 시도하세요`,
                  `${Math.ceil((pinLockedUntil - Date.now()) / 1000)}秒後に再試行してください`,
                  `Try again in ${Math.ceil((pinLockedUntil - Date.now()) / 1000)}s`
                )}
              </div>
            ) : (
              <>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => { setPinInput(e.target.value); setPinError(""); }}
                  placeholder="● ● ● ● ● ●"
                  style={pinS.input}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // 제출 로직
                      if (pinInput === reviewAccessCode) {
                        setPinVerified(true);
                        setShowPinModal(false);
                        setShowWriteModal(true);
                        setPinFailCount(0);
                      } else {
                        const nextFail = pinFailCount + 1;
                        setPinFailCount(nextFail);
                        if (nextFail >= 3) {
                          setPinLockedUntil(Date.now() + 5 * 60 * 1000);
                          setPinError(tr(
                            "3회 실패! 5분간 입력이 잠깁니다.",
                            "3回失敗!5分間ロックされます。",
                            "3 failures! Locked for 5 minutes."
                          ));
                          setPinFailCount(0);
                        } else {
                          setPinError(tr(
                            `PIN이 틀렸습니다. (${nextFail}/3)`,
                            `PINが間違っています。(${nextFail}/3)`,
                            `Wrong PIN. (${nextFail}/3)`
                          ));
                        }
                        setPinInput("");
                      }
                    }
                  }}
                />
                {pinError && <div style={pinS.errorMsg}>{pinError}</div>}
                
                <div style={pinS.btnRow}>
                  <button 
                    style={pinS.cancelBtn} 
                    onClick={() => setShowPinModal(false)}
                  >
                    {tr("취소", "キャンセル", "Cancel")}
                  </button>
                  <button 
                    style={pinS.submitBtn}
                    onClick={() => {
                      if (pinInput === reviewAccessCode) {
                        setPinVerified(true);
                        setShowPinModal(false);
                        setShowWriteModal(true);
                        setPinFailCount(0);
                      } else {
                        const nextFail = pinFailCount + 1;
                        setPinFailCount(nextFail);
                        if (nextFail >= 3) {
                          setPinLockedUntil(Date.now() + 5 * 60 * 1000);
                          setPinError(tr(
                            "3회 실패! 5분간 입력이 잠깁니다.",
                            "3回失敗!5分間ロックされます。",
                            "3 failures! Locked for 5 minutes."
                          ));
                          setPinFailCount(0);
                        } else {
                          setPinError(tr(
                            `PIN이 틀렸습니다. (${nextFail}/3)`,
                            `PINが間違っています。(${nextFail}/3)`,
                            `Wrong PIN. (${nextFail}/3)`
                          ));
                        }
                        setPinInput("");
                      }
                    }}
                  >
                    {tr("확인", "確認", "OK")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== 후기 작성 모달 ===== */}
      {showWriteModal && (
        <ReviewWriteModal
          user={user}
          members={members}
          regionFilters={REGION_FILTERS}
          onClose={() => setShowWriteModal(false)}
          tr={tr}
          isKo={isKo}
          isJa={isJa}
          getRegionName={getRegionName}
        />
      )}

      {/* ===== 후기 상세 모달 ===== */}
      {selectedReview && (
        <ReviewDetailModal
          review={selectedReview}
          user={user}
          isGuest={isGuest}
          onClose={() => setSelectedReview(null)}
          onLike={() => handleLike(selectedReview.id)}
          onDelete={() => handleDelete(selectedReview.id)}
          onConsult={() => handleConsult(selectedReview.managerName)}
          tr={tr}
          isKo={isKo}
          isJa={isJa}
          getRegionName={getRegionName}
        />
      )}

      <style>{`
        @keyframes pulseBtn {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(212, 175, 55, 0.4); }
          50% { transform: scale(1.08); box-shadow: 0 6px 28px rgba(212, 175, 55, 0.7); }
        }
        .pulse-btn {
          animation: pulseBtn 2s ease-in-out infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .review-spinner { 
          width: 40px; height: 40px; 
          border: 3px solid #222; border-top: 3px solid #D4AF37; 
          border-radius: 50%; 
          animation: spin 0.8s linear infinite; 
          margin: 0 auto 15px; 
        }
        .filter-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

// ============================================
// ★ 후기 카드 컴포넌트
// ============================================
function ReviewCard({ review, currentUserId, isGuest, onClick, onLike, onConsult, tr, isKo, isJa, getRegionName }) {
  const hasLiked = review.likedBy?.includes(currentUserId);
  const isVideo = review.mediaType === "video";
  
  const maskedNick = maskNickname(review.userNickname || review.userId || "익명");
  
  // 시간 표시 (몇 분 전, 몇 시간 전, 며칠 전)
  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "";
    const diff = Date.now() - timestamp;
    const min = Math.floor(diff / 60000);
    const hour = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);
    
    if (day > 0) return isKo ? `${day}일 전` : isJa ? `${day}日前` : `${day}d ago`;
    if (hour > 0) return isKo ? `${hour}시간 전` : isJa ? `${hour}時間前` : `${hour}h ago`;
    if (min > 0) return isKo ? `${min}분 전` : isJa ? `${min}分前` : `${min}m ago`;
    return isKo ? "방금" : isJa ? "たった今" : "just now";
  };

  return (
    <div style={r.card} onClick={onClick}>
      {/* 카드 헤더 */}
      <div style={r.cardHeader}>
        <div style={r.userInfo}>
          <div style={r.userAvatar}>🎭</div>
          <div>
            <div style={r.userName}>{maskedNick}</div>
            <div style={r.userMeta}>
              📍 {getRegionName(review.loc || review.region)}
              <span style={r.metaDot}>·</span>
              {getTimeAgo(review.createdAt)}
            </div>
          </div>
        </div>
        {review.rating && (
          <div style={r.rating}>
            {"⭐".repeat(review.rating)}
          </div>
        )}
      </div>

      {/* 매니저 정보 (선택적) */}
      {review.managerName && (
        <div style={r.managerTag}>
          👤 {review.managerName} {tr("매니저 후기", "マネージャーレビュー", "Manager Review")}
        </div>
      )}

      {/* 미디어 (사진 or 영상) */}
      <div style={r.mediaWrap}>
        {isVideo ? (
          <div style={r.videoWrap}>
            <video 
              src={review.thumbnailUrl ? review.mediaUrl : `${review.mediaUrl}#t=0.5`}
              poster={review.thumbnailUrl || undefined}
              style={r.mediaEl}
              muted
              playsInline
              preload={review.thumbnailUrl ? "none" : "metadata"}
            />
            <div style={r.videoPlayIcon}>▶</div>
          </div>
        ) : (
          <img 
            src={review.mediaUrl} 
            style={r.mediaEl} 
            alt="review"
            loading="lazy"
          />
        )}
      </div>

      {/* 인터랙션 (좋아요, 댓글) */}
      <div style={r.interactionRow}>
        <div 
          style={r.interactionBtn} 
          onClick={(e) => { e.stopPropagation(); onLike(); }}
        >
          <span style={{ fontSize: 22 }}>{hasLiked ? "❤️" : "🤍"}</span>
          <span style={r.interactionCount}>{review.likeCount || 0}</span>
        </div>
        <div style={r.interactionBtn}>
          <span style={{ fontSize: 20 }}>💬</span>
          <span style={r.interactionCount}>{review.commentCount || 0}</span>
        </div>
      </div>

      {/* 본문 */}
      <div style={r.content}>
        <p style={r.contentText}>
          {review.content?.length > 80 
            ? review.content.slice(0, 80) + "..." 
            : review.content}
        </p>
      </div>

      {/* 해시태그 자동 생성 */}
      <div style={r.tagRow}>
        {review.loc && (
          <span style={r.tag}>#{review.loc.split('/')[0]}</span>
        )}
        <span style={r.tag}>#{tr("추천", "おすすめ", "recommend")}</span>
        {review.rating >= 4 && <span style={r.tag}>#{tr("만족", "満足", "satisfied")}</span>}
      </div>

      {/* 상담 버튼 */}
      <button 
        style={r.consultBtn}
        onClick={(e) => { e.stopPropagation(); onConsult(); }}
      >
        💬 {review.managerName 
          ? `${review.managerName} ${tr("매니저 상담", "マネージャー相談", "Consult")}`
          : tr("이 지역 매니저 상담", "この地域のマネージャー相談", "Consult this area")}
      </button>
    </div>
  );
}

// ★ [신규] PIN 입력 모달 스타일
const pinS = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.92)',
    zIndex: 10000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backdropFilter: 'blur(10px)',
  },
  modal: {
    background: 'linear-gradient(145deg, #1a1a1a, #0f0f0f)',
    borderRadius: 24,
    padding: '32px 24px',
    width: '100%',
    maxWidth: 360,
    border: '1px solid #333',
    boxShadow: '0 10px 40px rgba(212,175,55,0.15)',
    textAlign: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    color: '#D4AF37',
    fontSize: 22,
    fontWeight: 900,
    marginBottom: 10,
    letterSpacing: '1px',
  },
  desc: {
    color: '#888',
    fontSize: 13,
    lineHeight: 1.6,
    marginBottom: 24,
    whiteSpace: 'pre-line',
  },
  input: {
    width: '100%',
    padding: '16px 20px',
    background: '#000',
    border: '1px solid #333',
    borderRadius: 12,
    color: '#D4AF37',
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: '8px',
    textAlign: 'center',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: 12,
  },
  errorMsg: {
    color: '#ff5252',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
    minHeight: 20,
  },
  lockMsg: {
    color: '#ff9800',
    fontSize: 15,
    fontWeight: 700,
    padding: '20px 0',
    background: 'rgba(255,152,0,0.1)',
    borderRadius: 12,
    marginBottom: 16,
  },
  btnRow: {
    display: 'flex',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    padding: '14px',
    background: '#222',
    color: '#888',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  submitBtn: {
    flex: 2,
    padding: '14px',
    background: '#D4AF37',
    color: '#000',
    border: 'none',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
  },
};