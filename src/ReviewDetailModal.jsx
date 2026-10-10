import React, { useState, useEffect, useRef } from "react";
import { 
  collection, addDoc, query, orderBy, onSnapshot, 
  doc, updateDoc, deleteDoc, increment, serverTimestamp 
} from "firebase/firestore";
import { db, authReady } from "./firebase";
import { maskNickname } from "./nicknameUtils";
import { getFakeNickname, pickRandomNickname } from "./fakeNicknames";

export default function ReviewDetailModal({ 
  review, 
  user, 
  isGuest,
  onClose, 
  onLike, 
  onDelete, 
  onConsult,
  tr, 
  isKo, 
  isJa,
  getRegionName 
, fakeNicknameOverrides = {} }) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const commentInputRef = useRef(null);
  
  const hasLiked = review.likedBy?.includes(user?.id);
  const isVideo = review.mediaType === "video";
  const isOwnReview = review.userId === user?.id;
  const maskedNick = review.userNickname || review.userId || "익명";

  // ★ 댓글 실시간 로드
  useEffect(() => {
    let unsub = () => {};
    
    authReady.then(() => {
      const q = query(
        collection(db, "reviews", review.id, "comments"),
        orderBy("createdAt", "asc")
      );
      
      unsub = onSnapshot(q, 
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setComments(data);
        },
        (err) => console.error("댓글 로드 실패:", err)
      );
    });
    
    return () => unsub();
  }, [review.id]);

  // ★ 시간 표시
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

  // ★ 댓글 등록
  const handleSubmitComment = async () => {
    if (isGuest) {
      alert(tr("회원만 이용 가능합니다.", "会員のみご利用いただけます。", "Members only."));
      return;
    }
    if (!user?.id) return;
    if (!commentText.trim()) return;
    if (commentText.length > 200) {
      alert(tr("댓글은 200자 이내로 작성해주세요.", "コメントは200文字以内で作成してください。", "Comments must be under 200 characters."));
      return;
    }

    try {
      setSubmitting(true);
      await authReady;
      
      // 1. 댓글 추가
      await addDoc(collection(db, "reviews", review.id, "comments"), {
        userId: user.id,
        userNickname: user.nickname || user.name || user.id,
        text: commentText.trim(),
        createdAt: Date.now(),
        createdAtServer: serverTimestamp(),
      });
      
      // 2. 댓글 카운트 증가
      await updateDoc(doc(db, "reviews", review.id), {
        commentCount: increment(1),
      });
      
      setCommentText("");
    } catch (e) {
      console.error("댓글 등록 실패:", e);
      alert(tr("댓글 등록 실패", "コメント登録失敗", "Failed to post comment"));
    } finally {
      setSubmitting(false);
    }
  };

  // ★ 댓글 삭제 (본인만)
  const handleDeleteComment = async (commentId, commentUserId) => {
    if (commentUserId !== user?.id) return;
    if (!confirm(tr("댓글을 삭제하시겠습니까?", "コメントを削除しますか?", "Delete this comment?"))) return;
    
    try {
      await deleteDoc(doc(db, "reviews", review.id, "comments", commentId));
      await updateDoc(doc(db, "reviews", review.id), {
        commentCount: increment(-1),
      });
    } catch (e) {
      alert(tr("삭제 실패", "削除失敗", "Delete failed"));
    }
  };

  // ★ 엔터로 댓글 등록
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComment();
    }
  };

  return (
    <div style={d.overlay} onClick={onClose}>
      <div style={d.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={d.header}>
          <button style={d.closeBtn} onClick={onClose}>❮</button>
          <div style={d.headerTitle}>
            {tr("후기 상세", "レビュー詳細", "Review Detail")}
          </div>
          {isOwnReview ? (
            <button style={d.deleteBtn} onClick={onDelete}>🗑️</button>
          ) : (
            <div style={{width: 30}}></div>
          )}
        </div>

        {/* Body */}
        <div style={d.body}>
          {/* 작성자 정보 */}
          <div style={d.userSection}>
            <div style={d.userLeft}>
              <div style={d.userAvatar}>🎭</div>
              <div>
                <div style={d.userName}>{maskedNick}</div>
                <div style={d.userMeta}>
                  📍 {getRegionName(review.loc || review.region)}
                  <span style={d.metaDot}>·</span>
                  {getTimeAgo(review.createdAt)}
                </div>
              </div>
            </div>
            {review.rating && (
              <div style={d.rating}>
                {"⭐".repeat(review.rating)}
              </div>
            )}
          </div>

          {/* 매니저 태그 */}
          {review.managerName && (
            <div style={d.managerTag}>
              👤 {review.managerName} {tr("매니저 후기", "マネージャーレビュー", "Manager Review")}
            </div>
          )}

          {/* 미디어 */}
          <div style={d.mediaWrap}>
            {isVideo ? (
              <video 
                src={review.mediaUrl} 
                poster={review.thumbnailUrl || undefined}
                style={d.mediaEl}
                controls
                autoPlay
                playsInline
              />
            ) : (
              <img 
                src={review.mediaUrl} 
                style={d.mediaEl}
                alt="review"
              />
            )}
          </div>

          {/* 인터랙션 */}
          <div style={d.interactionRow}>
            <div 
              style={d.interactionBtn} 
              onClick={onLike}
            >
              <span style={{ fontSize: 24 }}>{hasLiked ? "❤️" : "🤍"}</span>
              <span style={d.interactionCount}>{review.likeCount || 0} · 👁️ {(review.viewCount || 0).toLocaleString()}</span>
            </div>
            <div style={d.interactionBtn}>
              <span style={{ fontSize: 22 }}>💬</span>
              <span style={d.interactionCount}>{comments.length}</span>
            </div>
          </div>

          {/* 본문 */}
          <div style={d.contentBox}>
            <p style={d.contentText}>{review.content}</p>
          </div>

          {/* 해시태그 */}
          <div style={d.tagRow}>
            {review.loc && (
              <span style={d.tag}>#{review.loc.split('/')[0]}</span>
            )}
            <span style={d.tag}>#{tr("추천", "おすすめ", "recommend")}</span>
            {review.rating >= 4 && <span style={d.tag}>#{tr("만족", "満足", "satisfied")}</span>}
          </div>

          {/* 상담 버튼 */}
          <button style={d.consultBtn} onClick={onConsult}>
            💬 {tr("상담 문의하기", "ご相談・お問い合わせ", "Make an Inquiry")}
          </button>

          {/* 댓글 섹션 */}
          <div style={d.commentsSection}>
            <div style={d.commentsHeader}>
              💬 {tr("댓글", "コメント", "Comments")} ({comments.length})
            </div>
            
            {comments.length === 0 ? (
              <div style={d.noComments}>
                {tr("첫 댓글을 남겨보세요!", "最初のコメントを残してみましょう!", "Be the first to comment!")}
              </div>
            ) : (
              <div style={d.commentsList}>
                {comments.map(c => {
                  const cMaskedNick = c.displayName || c.userNickname || c.userId || "익명";
                  const isOwnComment = c.userId === user?.id;
                  return (
                    <div key={c.id} style={d.commentItem}>
                      <div style={d.commentAvatar}>🎭</div>
                      <div style={d.commentContent}>
                        <div style={d.commentHeader}>
                          <span style={d.commentName}>{cMaskedNick}</span>
                          <span style={d.commentTime}>{getTimeAgo(c.createdAt)}</span>
                          {isOwnComment && (
                            <button 
                              style={d.commentDeleteBtn}
                              onClick={() => handleDeleteComment(c.id, c.userId)}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div style={d.commentText}>{c.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 댓글 입력창 (하단 고정) */}
        <div style={d.commentInputWrap}>
          <div style={d.commentInputInner}>
            <input
              ref={commentInputRef}
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isGuest 
                  ? tr("로그인 후 댓글 작성 가능", "ログイン後にコメント可能", "Login to comment")
                  : tr("댓글 입력...", "コメント入力...", "Write a comment...")
              }
              disabled={isGuest || submitting}
              style={{
                ...d.commentInput,
                opacity: (isGuest || submitting) ? 0.5 : 1
              }}
              maxLength={200}
            />
            <button 
              style={{
                ...d.commentSendBtn,
                opacity: (commentText.trim() && !submitting) ? 1 : 0.4,
                pointerEvents: (commentText.trim() && !submitting) ? 'auto' : 'none'
              }}
              onClick={handleSubmitComment}
            >
              {submitting ? "..." : "➤"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 스타일
// =========================================================================
const d = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.95)',
    zIndex: 10000,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    backdropFilter: 'blur(10px)',
  },
  modal: {
    width: '100%',
    maxWidth: 500,
    height: '95vh',
    background: '#0a0a0a',
    borderRadius: '24px 24px 0 0',
    border: '1px solid #222',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #1a1a1a',
    background: '#0a0a0a',
  },
  closeBtn: {
    width: 30, height: 30,
    background: 'transparent',
    color: '#fff',
    border: 'none',
    fontSize: 22,
    fontWeight: 700,
    cursor: 'pointer',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 1,
  },
  deleteBtn: {
    width: 30, height: 30,
    background: 'transparent',
    color: '#ff4444',
    border: 'none',
    fontSize: 16,
    cursor: 'pointer',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
  },
  
  // 작성자 섹션
  userSection: {
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #1a1a1a',
  },
  userLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #D4AF37, #B8860B)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
  },
  userName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 800,
    marginBottom: 3,
  },
  userMeta: {
    color: '#888',
    fontSize: 11,
    fontWeight: 500,
  },
  metaDot: {
    margin: '0 5px',
    color: '#444',
  },
  rating: {
    fontSize: 12,
    letterSpacing: -2,
  },

  // 매니저 태그
  managerTag: {
    padding: '10px 20px',
    background: 'rgba(212, 175, 55, 0.08)',
    borderBottom: '1px solid rgba(212, 175, 55, 0.15)',
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.3,
  },

  // 미디어
  mediaWrap: {
    width: '100%',
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    maxHeight: '60vh',
  },
  mediaEl: {
    width: '100%',
    maxHeight: '60vh',
    objectFit: 'contain',
    display: 'block',
  },

  // 인터랙션
  interactionRow: {
    display: 'flex',
    gap: 24,
    padding: '16px 20px 12px',
  },
  interactionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  interactionCount: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: 800,
  },

  // 본문
  contentBox: {
    padding: '0 20px 15px',
  },
  contentText: {
    color: '#eee',
    fontSize: 14,
    lineHeight: 1.7,
    margin: 0,
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  },

  // 해시태그
  tagRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: '0 20px 20px',
  },
  tag: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: 600,
  },

  // 상담 버튼
  consultBtn: {
    display: 'block',
    width: 'calc(100% - 40px)',
    margin: '0 20px 20px',
    padding: '14px',
    background: 'linear-gradient(135deg, #0088cc, #005588)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    letterSpacing: 0.5,
    boxShadow: '0 4px 16px rgba(0, 136, 204, 0.3)',
  },

  // 댓글 섹션
  commentsSection: {
    borderTop: '1px solid #1a1a1a',
    padding: '20px',
  },
  commentsHeader: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 15,
    letterSpacing: 0.5,
  },
  noComments: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    padding: '20px',
    fontStyle: 'italic',
  },
  commentsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 15,
  },
  commentItem: {
    display: 'flex',
    gap: 10,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #333, #222)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    flexShrink: 0,
  },
  commentContent: {
    flex: 1,
    background: '#161616',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid #1f1f1f',
  },
  commentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentName: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: 700,
  },
  commentTime: {
    color: '#666',
    fontSize: 10,
    flex: 1,
  },
  commentDeleteBtn: {
    background: 'transparent',
    color: '#666',
    border: 'none',
    fontSize: 12,
    cursor: 'pointer',
    padding: 0,
  },
  commentText: {
    color: '#ddd',
    fontSize: 13,
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },

  // 댓글 입력창
  commentInputWrap: {
    padding: '12px 20px',
    borderTop: '1px solid #1a1a1a',
    background: '#0a0a0a',
    paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
  },
  commentInputInner: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
  },
  commentInput: {
    flex: 1,
    padding: '12px 16px',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 24,
    color: '#fff',
    fontSize: 14,
    outline: 'none',
  },
  commentSendBtn: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #D4AF37, #B8860B)',
    color: '#000',
    border: 'none',
    fontSize: 18,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.15s',
  },
};