// =========================================================================
// 🎭 nicknameUtils.js - 후기 섹션 닉네임 익명 처리
// -------------------------------------------------------------------------
// ★ C 방식: 앞뒤 한 글자만 노출, 중간은 별표(*)
// -------------------------------------------------------------------------
// 예시:
//   홍길동     → 홍*동
//   김철수영   → 김**영
//   김        → 김*  (1글자면 뒤에 별표)
//   AB        → A*B  (2글자면 A*B - 앞1 별1 뒤1)
//   ABCDE     → A***E
//   VIP회원   → V**원
// =========================================================================

/**
 * 닉네임을 익명 처리 (C 방식)
 * @param {string} nickname - 원본 닉네임
 * @returns {string} - 별표 처리된 닉네임
 */
export function maskNickname(nickname) {
  if (!nickname || typeof nickname !== "string") return "익명";
  
  const trimmed = nickname.trim();
  if (!trimmed) return "익명";
  
  const len = trimmed.length;
  
  // 1글자: 뒤에 별표 추가 (예: "김" → "김*")
  if (len === 1) {
    return trimmed + "*";
  }
  
  // 2글자: 앞1 별1 뒤1 (예: "AB" → "A*B")
  if (len === 2) {
    return trimmed[0] + "*" + trimmed[1];
  }
  
  // 3글자 이상: 앞1 + (len-2)개 별표 + 뒤1
  const first = trimmed[0];
  const last = trimmed[len - 1];
  const stars = "*".repeat(len - 2);
  
  return first + stars + last;
}

/**
 * 사용자 ID(userId)를 마스킹 (닉네임이 없을 때 대체용)
 * @param {string} userId
 * @returns {string}
 */
export function maskUserId(userId) {
  if (!userId) return "익명";
  return maskNickname(userId);
}

/**
 * 후기 표시용 - 닉네임 우선, 없으면 ID 마스킹
 * @param {object} user - { nickname, id, name }
 * @returns {string}
 */
export function getDisplayName(user) {
  if (!user) return "익명";
  const name = user.nickname || user.name || user.id || "";
  return maskNickname(name);
}
