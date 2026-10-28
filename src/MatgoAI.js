// ===================================================================
// 🤖 MatgoAI - 어려운 난이도의 맞고 AI
// ===================================================================
// 핵심 전략:
//   1. 광 확보 우선 (3장 모으면 광박 ×2)
//   2. 피 10장 이상 (피박 ×2)
//   3. 상대 위협 분석 (상대가 역에 가까우면 방어)
//   4. 뻑/따닥/쪽 발생 가치 계산
//   5. 종단(홍/청/초) 완성 체크
//   6. 고/스톱 결정은 손패/더미 남은 수와 리드 점수 비교
//
// 각 손패 카드마다 "가치"를 계산해서 최대값 선택
// ===================================================================

import { CARDS, classifyCaptured } from "./matgoRules";

const cardById = (id) => CARDS.find(c => c.id === id);

// ──────────────────────────────────────────────────────────
// 역 완성 거리 계산
// ──────────────────────────────────────────────────────────
function distanceToYeok(captured) {
  const cat = classifyCaptured(captured);
  const distances = [];

  // 광: 3장이 중요 (삼광)
  const gwangCount = cat.gwang.length;
  if (gwangCount < 3) distances.push({ name: '삼광', need: 3 - gwangCount, value: 3 });
  else if (gwangCount < 4) distances.push({ name: '사광', need: 1, value: 1 });
  else if (gwangCount < 5) distances.push({ name: '오광', need: 1, value: 11 });

  // 피 (쌍피 2배)
  const piCount = cat.pi.length + cat.ssangPi.length * 2;
  if (piCount < 10) distances.push({ name: '피10장', need: 10 - piCount, value: 1 });
  else distances.push({ name: `피${piCount + 1}`, need: 1, value: 1 });

  // 열끗
  const yeolCount = cat.yeol.length;
  if (yeolCount < 5) distances.push({ name: '열끗5장', need: 5 - yeolCount, value: 1 });
  else distances.push({ name: `열끗${yeolCount + 1}`, need: 1, value: 1 });

  // 고도리 (8/10/12월 열끗 3장)
  const godoriCount = cat.yeol.filter(c => c.godori).length;
  if (godoriCount < 3) distances.push({ name: '고도리', need: 3 - godoriCount, value: 5, isGodori: true });

  // 띠
  const ttiCount = cat.tti.length;
  if (ttiCount < 5) distances.push({ name: '띠5장', need: 5 - ttiCount, value: 1 });
  else distances.push({ name: `띠${ttiCount + 1}`, need: 1, value: 1 });

  // 홍/청/초단
  const hongdanCount = cat.tti.filter(c => c.hongdan).length;
  if (hongdanCount < 3) distances.push({ name: '홍단', need: 3 - hongdanCount, value: 3, isHongdan: true });
  const cheongdanCount = cat.tti.filter(c => c.cheongdan).length;
  if (cheongdanCount < 3) distances.push({ name: '청단', need: 3 - cheongdanCount, value: 3, isCheongdan: true });
  const chodanCount = cat.tti.filter(c => c.chodan).length;
  if (chodanCount < 3) distances.push({ name: '초단', need: 3 - chodanCount, value: 3, isChodan: true });

  return distances;
}

// ──────────────────────────────────────────────────────────
// 각 카드의 "획득 가치" 계산
// ──────────────────────────────────────────────────────────
function cardValue(cardId, myCaptured, oppCaptured) {
  const card = cardById(cardId);
  if (!card) return 0;

  let value = 0;
  const myCat = classifyCaptured(myCaptured);
  const oppCat = classifyCaptured(oppCaptured);

  switch (card.type) {
    case 'GWANG': {
      // 광은 가장 중요
      const myGwang = myCat.gwang.length;
      if (myGwang === 0) value = 15;       // 첫 광
      else if (myGwang === 1) value = 20;  // 2광 (3광 가능성)
      else if (myGwang === 2) value = 35;  // 삼광 완성!
      else if (myGwang === 3) value = 25;  // 사광
      else if (myGwang === 4) value = 50;  // 오광
      // 비광 포함 삼광은 2점이므로 가치 낮음
      if (card.rain && myGwang === 2) value = 20;
      break;
    }

    case 'YEOL': {
      const myYeol = myCat.yeol.length;
      value = 8;  // 기본 열끗 가치
      // 고도리 가능성
      if (card.godori) {
        const myGodori = myCat.yeol.filter(c => c.godori).length;
        if (myGodori === 0) value += 10;
        else if (myGodori === 1) value += 20;
        else if (myGodori === 2) value += 40;  // 고도리 완성!
      }
      // 5장 넘으면 추가점
      if (myYeol >= 4) value += 5;
      break;
    }

    case 'TTI': {
      value = 5;  // 기본 띠 가치
      // 홍/청/초 체크
      if (card.hongdan) {
        const my = myCat.tti.filter(c => c.hongdan).length;
        if (my === 2) value += 15;  // 홍단 완성!
        else value += my * 3;
      }
      if (card.cheongdan) {
        const my = myCat.tti.filter(c => c.cheongdan).length;
        if (my === 2) value += 15;
        else value += my * 3;
      }
      if (card.chodan) {
        const my = myCat.tti.filter(c => c.chodan).length;
        if (my === 2) value += 15;
        else value += my * 3;
      }
      // 띠 5장 넘으면
      if (myCat.tti.length >= 4) value += 4;
      break;
    }

    case 'PI': {
      const myPi = myCat.pi.length + myCat.ssangPi.length * 2;
      value = 3;
      if (myPi >= 8) value += 5;  // 10장 임박
      if (myPi >= 9) value += 10;
      break;
    }

    case 'SSANG_PI': {
      // 쌍피는 피 2장 가치
      const myPi = myCat.pi.length + myCat.ssangPi.length * 2;
      value = 7;
      if (myPi >= 7) value += 8;
      if (myPi >= 8) value += 15;
      break;
    }
  }

  // 상대방 방어 - 상대가 이 카드로 역 완성 가능하면 가치 증가
  switch (card.type) {
    case 'GWANG':
      if (oppCat.gwang.length === 2) value += 20;  // 상대 삼광 막기
      if (oppCat.gwang.length === 3) value += 15;
      if (oppCat.gwang.length === 4) value += 40;  // 상대 오광 막기
      break;
    case 'YEOL':
      if (card.godori) {
        const oppGodori = oppCat.yeol.filter(c => c.godori).length;
        if (oppGodori === 2) value += 25;  // 상대 고도리 방어
      }
      break;
    case 'TTI':
      if (card.hongdan && oppCat.tti.filter(c => c.hongdan).length === 2) value += 15;
      if (card.cheongdan && oppCat.tti.filter(c => c.cheongdan).length === 2) value += 15;
      if (card.chodan && oppCat.tti.filter(c => c.chodan).length === 2) value += 15;
      break;
    case 'PI':
    case 'SSANG_PI':
      const oppPi = oppCat.pi.length + oppCat.ssangPi.length * 2;
      if (oppPi >= 8) value += 5;  // 상대 피10 방어
      break;
  }

  return value;
}

// ──────────────────────────────────────────────────────────
// AI 수 선택: 손패에서 최적의 카드 선택
// ──────────────────────────────────────────────────────────
export function chooseAIMove(state) {
  const { hand, field, captured, opponent } = state;
  const myCaptured = captured;
  const oppCaptured = opponent?.captured || [];

  if (!hand || hand.length === 0) return null;

  const moves = hand.map(cardId => {
    const card = cardById(cardId);
    if (!card) return { cardId, score: -999 };

    // 바닥에서 매칭되는 카드들
    const matches = field.filter(id => cardById(id).month === card.month);

    let score = 0;
    const scoreDetail = [];

    if (matches.length === 0) {
      // 매칭 X → 바닥에 깔림 (상대가 가져갈 수 있음)
      // 손패의 다른 카드 중 이 월이 또 있는지 체크 (내가 나중에 가져옴)
      const sameMonth = hand.filter(id => cardById(id).month === card.month && id !== cardId);
      
      if (sameMonth.length > 0) {
        // 손패에 같은 월 또 있음 → 깔고 나중에 가져오기 OK
        score -= 2;
        scoreDetail.push({ name: '깔기(나중회수)', pts: -2 });
      } else {
        // 손패에 없음 → 상대에게 넘겨줄 위험
        const relativeValue = cardValue(cardId, myCaptured, oppCaptured);
        score -= relativeValue * 0.6;
        scoreDetail.push({ name: '상대위험', pts: -relativeValue * 0.6 });
      }
    } else {
      // 매칭 있음 → 획득 가능
      // 가져올 카드 중 가장 가치 낮은 것 (바닥 2장이면 선택 가능하니까)
      const matchValues = matches.map(mid => cardValue(mid, myCaptured, oppCaptured));
      const bestMatch = Math.max(...matchValues);
      score += bestMatch;
      scoreDetail.push({ name: '바닥매칭', pts: bestMatch });

      // 내 손패 카드 자체 가치
      const myCardValue = cardValue(cardId, myCaptured, oppCaptured);
      score += myCardValue;
      scoreDetail.push({ name: '내카드가치', pts: myCardValue });

      // 매칭 3장이면 쓸 (전부 획득 + 상대 피 1장)
      if (matches.length === 3) {
        score += 15;
        scoreDetail.push({ name: '쓸보너스', pts: 15 });
      }
    }

    // 상대 손패 처리 추정 - 상대 최근 낸 카드와 같은 월이면 뻑/따닥 가능성
    // (여기선 단순화)

    return { cardId, score, matches, scoreDetail };
  });

  // 가장 가치 높은 수 선택
  moves.sort((a, b) => b.score - a.score);
  return moves[0];
}

// ──────────────────────────────────────────────────────────
// 바닥 2장 선택: 더 가치 높은 쪽
// ──────────────────────────────────────────────────────────
export function chooseAIFieldCard(options, myCaptured, oppCaptured) {
  if (!options || options.length === 0) return null;
  const values = options.map(id => ({
    id,
    value: cardValue(id, myCaptured, oppCaptured),
  }));
  values.sort((a, b) => b.value - a.value);
  return values[0].id;
}

// ──────────────────────────────────────────────────────────
// GO/STOP 결정: 리드와 손패 남은 장수 기반
// ──────────────────────────────────────────────────────────
export function chooseAIGoStop(state) {
  const { captured, opponent, hand, pile, goCount, score } = state;
  const myCat = classifyCaptured(captured);
  const oppCat = classifyCaptured(opponent?.captured || []);

  // 상대와 격차
  const myPi = myCat.pi.length + myCat.ssangPi.length * 2;
  const oppPi = oppCat.pi.length + oppCat.ssangPi.length * 2;
  const oppGwang = oppCat.gwang.length;

  // 상대가 위험한 상황: 상대 광 2장 + 피 7장 넘음 → 바로 STOP
  if (oppGwang >= 2 || oppPi >= 8) return 'stop';

  // 남은 카드가 적으면 STOP
  const remaining = (hand?.length || 0) + (pile || 0);
  if (remaining <= 2) return 'stop';

  // 이미 2고 이상이면 리스크 큼 → STOP
  if (goCount >= 2) return 'stop';

  // 점수 10점 이상이고 1고 상태면 STOP (안전하게)
  if (score >= 10 && goCount >= 1) return 'stop';

  // 상대가 1점이라도 있으면 보수적
  const oppScore = calcQuickScore(opponent?.captured || []);
  if (oppScore >= 3) return 'stop';

  // 그 외: GO (추가 점수 노리기)
  return 'go';
}

// 간단한 점수 추정 (고 보너스 제외)
function calcQuickScore(captured) {
  const cat = classifyCaptured(captured);
  let score = 0;

  const gwangCount = cat.gwang.length;
  if (gwangCount >= 5) score += 15;
  else if (gwangCount === 4) score += 4;
  else if (gwangCount === 3) {
    score += cat.gwang.some(c => c.rain) ? 2 : 3;
  }

  const yeolCount = cat.yeol.length;
  if (yeolCount >= 5) score += yeolCount - 4;
  if (cat.yeol.filter(c => c.godori).length === 3) score += 5;

  const ttiCount = cat.tti.length;
  if (ttiCount >= 5) score += ttiCount - 4;
  if (cat.tti.filter(c => c.hongdan).length >= 3) score += 3;
  if (cat.tti.filter(c => c.cheongdan).length >= 3) score += 3;
  if (cat.tti.filter(c => c.chodan).length >= 3) score += 3;

  const piCount = cat.pi.length + cat.ssangPi.length * 2;
  if (piCount >= 10) score += piCount - 9;

  return score;
}

// ──────────────────────────────────────────────────────────
// 흔듦/폭탄 판단
// ──────────────────────────────────────────────────────────
// 손패에 같은 월 3장이 있을 때
export function chooseAIBombOrShake(hand, month, myCaptured, oppCaptured) {
  // 바닥에 그 월이 있으면 폭탄이 유리 (전부 획득 + 상대 피 뺏음)
  // 바닥에 없으면 흔듦이 유리 (완성 시 ×2)
  
  // 간단한 전략: 50% 확률
  // 더 정교하게 하려면 바닥 체크 필요하지만 여기선 간단히
  return { action: 'none' };  // AI는 폭탄/흔듦 안 쓰고 일반 플레이만
}

export default {
  chooseAIMove,
  chooseAIFieldCard,
  chooseAIGoStop,
  chooseAIBombOrShake,
};
