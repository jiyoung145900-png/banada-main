// ===================================================================
// 🎴 Matgo Live Table - Cloud Function v1
// ===================================================================
// 2인 맞고 (한 테이블에 2명, 1:1 대전)
//
// 진행 규칙
//   · 로비: 테이블 2개 상시 운영. 자리 2자리씩. 한 자리 비면 혼자 모드(= AI 대기 표시만)
//   · 2명 모이면 자동 시작. 양쪽 모두 "다음 판" 누르면 다음 판 시작
//   · 서버가 셔플/분배/매칭/점수/정산을 모두 처리
//   · 손패는 각자 본인만 볼 수 있음 (matgo_secret 에만 있음)
//
// 식별: 모든 키는 "앱 유저 ID(userId)" 로 통일. 로그인(auth) uid 는 인증용일 뿐.
// 비밀: 양쪽 손패/더미 순서는 matgo_secret/{tableId} 에만 있고 클라이언트는 읽을 수 없음.
//       본인 손패만 myHand 액션으로 받아 봄.
// ===================================================================

const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const TABLES = ["matgo1", "matgo2"];
const ENTRY_FEE = 10000;            // 입장료 (판당 베팅)
const TARGET_SCORE = 7;             // 7점 달성 시 고/스톱
const STALE_MS = 30000;             // 하트비트가 이 시간 끊기면 접속 종료
const TURN_TIMEOUT_MS = 60000;      // 한 턴 60초 넘기면 서버가 랜덤 수 둠
const READY_WAIT_MS = 20000;        // 다음 판 준비 20초 안 하면 자동 레디
const MAX_PLAYERS = 2;              // 2인 전용

// ──────────────────────────────────────────────────────────
// 🎴 카드 48장 정의 (matgoRules.js 와 동일한 ID 체계)
// ──────────────────────────────────────────────────────────
const CARDS = [
	// 1월 - 송학
	{ id: '01-G', month: 1, type: 'GWANG' },
	{ id: '01-T', month: 1, type: 'TTI', hongdan: true },
	{ id: '01-P1', month: 1, type: 'PI' }, { id: '01-P2', month: 1, type: 'PI' },
	// 2월 - 매조
	{ id: '02-Y', month: 2, type: 'YEOL' },
	{ id: '02-T', month: 2, type: 'TTI', hongdan: true },
	{ id: '02-P1', month: 2, type: 'PI' }, { id: '02-P2', month: 2, type: 'PI' },
	// 3월 - 벚꽃
	{ id: '03-G', month: 3, type: 'GWANG' },
	{ id: '03-T', month: 3, type: 'TTI', hongdan: true },
	{ id: '03-P1', month: 3, type: 'PI' }, { id: '03-P2', month: 3, type: 'PI' },
	// 4월 - 흑싸리
	{ id: '04-Y', month: 4, type: 'YEOL' },
	{ id: '04-T', month: 4, type: 'TTI', chodan: true },
	{ id: '04-P1', month: 4, type: 'PI' }, { id: '04-P2', month: 4, type: 'PI' },
	// 5월 - 난초
	{ id: '05-Y', month: 5, type: 'YEOL' },
	{ id: '05-T', month: 5, type: 'TTI', chodan: true },
	{ id: '05-P1', month: 5, type: 'PI' }, { id: '05-P2', month: 5, type: 'PI' },
	// 6월 - 모란
	{ id: '06-Y', month: 6, type: 'YEOL' },
	{ id: '06-T', month: 6, type: 'TTI', cheongdan: true },
	{ id: '06-P1', month: 6, type: 'PI' }, { id: '06-P2', month: 6, type: 'PI' },
	// 7월 - 홍싸리
	{ id: '07-Y', month: 7, type: 'YEOL' },
	{ id: '07-T', month: 7, type: 'TTI', chodan: true },
	{ id: '07-P1', month: 7, type: 'PI' }, { id: '07-P2', month: 7, type: 'PI' },
	// 8월 - 공산
	{ id: '08-G', month: 8, type: 'GWANG' },
	{ id: '08-Y', month: 8, type: 'YEOL', godori: true },
	{ id: '08-P1', month: 8, type: 'PI' }, { id: '08-P2', month: 8, type: 'PI' },
	// 9월 - 국화
	{ id: '09-Y', month: 9, type: 'YEOL' },
	{ id: '09-T', month: 9, type: 'TTI', cheongdan: true },
	{ id: '09-P1', month: 9, type: 'PI' }, { id: '09-P2', month: 9, type: 'PI' },
	// 10월 - 단풍
	{ id: '10-Y', month: 10, type: 'YEOL', godori: true },
	{ id: '10-T', month: 10, type: 'TTI', cheongdan: true },
	{ id: '10-P1', month: 10, type: 'PI' }, { id: '10-P2', month: 10, type: 'PI' },
	// 11월 - 오동
	{ id: '11-G', month: 11, type: 'GWANG' },
	{ id: '11-SSANG_PI', month: 11, type: 'SSANG_PI' },
	{ id: '11-P1', month: 11, type: 'PI' }, { id: '11-P2', month: 11, type: 'PI' },
	// 12월 - 비
	{ id: '12-G', month: 12, type: 'GWANG', rain: true },
	{ id: '12-Y', month: 12, type: 'YEOL', godori: true },
	{ id: '12-T', month: 12, type: 'TTI' },
	{ id: '12-SSANG_PI', month: 12, type: 'SSANG_PI' },
];
const CARD_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));
const cardById = (id) => CARD_BY_ID[id];

// ──────────────────────────────────────────────────────────
// 🎲 보안 셔플 (crypto.randomInt 사용)
// ──────────────────────────────────────────────────────────
function secureShuffle(arr) {
	const a = arr.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = crypto.randomInt(0, i + 1);
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

// 새 판 분배: 선 10장, 후 10장, 바닥 8장, 더미 20장
function dealNewRound() {
	const deck = secureShuffle(CARDS.map(c => c.id));
	// 바닥에 같은 월 3장 이상이 몰리면 재분배 (흔듦/뻑 미리 정리)
	for (let attempt = 0; attempt < 20; attempt++) {
		const field = deck.slice(20, 28);
		const monthCount = {};
		for (const id of field) {
			const m = cardById(id).month;
			monthCount[m] = (monthCount[m] || 0) + 1;
		}
		const maxSame = Math.max(...Object.values(monthCount));
		if (maxSame < 3) {
			return {
				hand1: deck.slice(0, 10),
				hand2: deck.slice(10, 20),
				field: deck.slice(20, 28),
				pile: deck.slice(28, 48),
			};
		}
		// 다시 섞음
		for (let i = deck.length - 1; i > 0; i--) {
			const j = crypto.randomInt(0, i + 1);
			[deck[i], deck[j]] = [deck[j], deck[i]];
		}
	}
	// fallback
	return {
		hand1: deck.slice(0, 10),
		hand2: deck.slice(10, 20),
		field: deck.slice(20, 28),
		pile: deck.slice(28, 48),
	};
}

// ──────────────────────────────────────────────────────────
// 📊 점수 계산 (매 턴마다 확인용 + 종료 시 최종)
// ──────────────────────────────────────────────────────────
function classifyCaptured(cardIds) {
	const cards = cardIds.map(id => cardById(id));
	return {
		gwang: cards.filter(c => c.type === 'GWANG'),
		yeol: cards.filter(c => c.type === 'YEOL'),
		tti: cards.filter(c => c.type === 'TTI'),
		pi: cards.filter(c => c.type === 'PI'),
		ssangPi: cards.filter(c => c.type === 'SSANG_PI'),
	};
}

// 역 점수 계산 (고 보너스 제외, 배수 미적용 = 기본 역 점수만)
function calcBaseScore(myCards) {
	const my = classifyCaptured(myCards);
	let score = 0;
	const breakdown = [];

	// 광
	const gwangCount = my.gwang.length;
	const hasBigwang = my.gwang.some(c => c.rain);
	if (gwangCount >= 5) { score += 15; breakdown.push({ name: '오광', points: 15 }); }
	else if (gwangCount === 4) { score += 4; breakdown.push({ name: '사광', points: 4 }); }
	else if (gwangCount === 3) {
		if (hasBigwang) { score += 2; breakdown.push({ name: '비삼광', points: 2 }); }
		else { score += 3; breakdown.push({ name: '삼광', points: 3 }); }
	}

	// 열끗
	const yeolCount = my.yeol.length;
	if (yeolCount >= 5) {
		const p = yeolCount - 4;
		score += p; breakdown.push({ name: `열끗${yeolCount}장`, points: p });
	}
	// 고도리
	const godoriCount = my.yeol.filter(c => c.godori).length;
	if (godoriCount === 3) { score += 5; breakdown.push({ name: '고도리', points: 5 }); }

	// 띠
	const ttiCount = my.tti.length;
	if (ttiCount >= 5) {
		const p = ttiCount - 4;
		score += p; breakdown.push({ name: `띠${ttiCount}장`, points: p });
	}
	if (my.tti.filter(c => c.hongdan).length >= 3) { score += 3; breakdown.push({ name: '홍단', points: 3 }); }
	if (my.tti.filter(c => c.cheongdan).length >= 3) { score += 3; breakdown.push({ name: '청단', points: 3 }); }
	if (my.tti.filter(c => c.chodan).length >= 3) { score += 3; breakdown.push({ name: '초단', points: 3 }); }

	// 피
	const piCount = my.pi.length + my.ssangPi.length * 2;
	if (piCount >= 10) {
		const p = piCount - 9;
		score += p; breakdown.push({ name: `피${piCount}장`, points: p });
	}

	return {
		score,
		breakdown,
		detail: {
			gwang: gwangCount,
			yeol: yeolCount,
			tti: ttiCount,
			pi: piCount,
			godori: godoriCount === 3,
		},
	};
}

// 최종 점수 (배수/고 보너스 포함)
function calcFinalScore(myCards, oppCards, goCount, shakingCount = 0) {
	const base = calcBaseScore(myCards);
	const opp = classifyCaptured(oppCards);
	const my = classifyCaptured(myCards);

	let multiplier = 1;
	const multipliers = [];

	// 피박
	const myPi = my.pi.length + my.ssangPi.length * 2;
	const oppPi = opp.pi.length + opp.ssangPi.length * 2;
	if (myPi >= 10 && oppPi < 7) {
		multiplier *= 2;
		multipliers.push('피박');
	}
	// 광박
	if (my.gwang.length >= 3 && opp.gwang.length === 0) {
		multiplier *= 2;
		multipliers.push('광박');
	}
	// 멍박
	const godori = my.yeol.filter(c => c.godori).length === 3;
	if (godori && opp.yeol.length === 0) {
		multiplier *= 2;
		multipliers.push('멍박');
	}
	// 흔듦
	if (shakingCount > 0) {
		multiplier *= Math.pow(2, shakingCount);
		multipliers.push(`흔듦×${shakingCount}`);
	}
	// 3고 이상 배수
	if (goCount >= 3) {
		const goMul = Math.pow(2, goCount - 2);
		multiplier *= goMul;
		multipliers.push(`${goCount}고×${goMul}`);
	}

	let finalScore = base.score * multiplier;

	// 고 보너스 (+1점 or +2점)
	if (goCount === 1) { finalScore += 1; base.breakdown.push({ name: '1고', points: '+1' }); }
	else if (goCount === 2) { finalScore += 2; base.breakdown.push({ name: '2고', points: '+2' }); }

	return {
		score: finalScore,
		baseScore: base.score,
		multiplier,
		multipliers,
		breakdown: base.breakdown,
		detail: base.detail,
	};
}

// ──────────────────────────────────────────────────────────
// 🏓 매칭 로직
// ──────────────────────────────────────────────────────────
function findMatches(fieldCards, month) {
	return fieldCards.filter(id => cardById(id).month === month);
}

// ──────────────────────────────────────────────────────────
// 📋 상태 구조
// ──────────────────────────────────────────────────────────
// matgo_tables/{tableId}  (공개 상태)
//   - currentRound: 숫자
//   - phase: "waiting" | "playing" | "go_stop" | "ended"
//   - players: [userId]  (최대 2명)
//   - names: { [userId]: nickname }
//   - playerSeen: { [userId]: timestamp }  (하트비트)
//   - field: [cardId]  (바닥패)
//   - captured: { [userId]: [cardId] }  (딴 카드)
//   - handCounts: { [userId]: 숫자 }  (손패 장수)
//   - pileRemaining: 숫자
//   - currentTurn: userId
//   - goCount: { [userId]: 숫자 }
//   - shaking: { [userId]: [month] }  (흔든 월)
//   - choosing: { userId, playedCard, options: [cardId], from: 'HAND'|'DRAW' } | null
//   - lastAction: { userId, cardId, captured, from, at }
//   - sessionScore: { [userId]: 숫자 }  (여러 판 누적 점수)
//   - turnStartedAt: timestamp
//   - lastUpdated: timestamp
//
// matgo_secret/{tableId}  (서버만 접근)
//   - round: 숫자
//   - hands: { [userId]: [cardId] }  (각자 손패)
//   - pile: [cardId]  (더미 순서)
//
// matgo_history/{tableId}/history/{round}: 결과 기록
// ──────────────────────────────────────────────────────────

function emptyTable() {
	return {
		currentRound: 1,
		phase: "waiting",
		players: [],
		names: {},
		playerSeen: {},
		field: [],
		captured: {},
		handCounts: {},
		pileRemaining: 0,
		currentTurn: null,
		goCount: {},
		shaking: {},
		bbuks: [],  // 뻑 목록: [{ month, cards: [cardId], by: userId }]
		choosing: null,
		lastAction: null,
		sessionScore: {},
		turnStartedAt: 0,
		lastUpdated: null,
	};
}

function readTable(snap) {
	if (!snap.exists) return emptyTable();
	return { ...emptyTable(), ...snap.data() };
}

// 참가자 존재 처리 (하트비트, 자동 퇴장)
function presence(table, now, who, mode = "ensure") {
	let players = Array.isArray(table.players) ? table.players.slice() : [];
	const playerSeen = { ...(table.playerSeen || {}) };
	const names = { ...(table.names || {}) };

	// STALE 체크 - 오래된 플레이어 제거
	for (const u of players.slice()) {
		if (now - (playerSeen[u] || 0) > STALE_MS) {
			players = players.filter(p => p !== u);
			delete playerSeen[u];
			delete names[u];
		}
	}

	if (mode === "ensure" && who) {
		if (!players.includes(who)) {
			if (players.length >= MAX_PLAYERS) {
				// 자리 가득 - 입장 불가
				return { players, playerSeen, names, joined: false, full: true };
			}
			players.push(who);
		}
		playerSeen[who] = now;
	}

	return { players, playerSeen, names, joined: true, full: false };
}

const safeId = (s) => String(s).replace(/[\/\s]/g, "_").slice(0, 200);
function secretRef(db, tableId) { return db.collection("matgo_secret").doc(tableId); }

// ──────────────────────────────────────────────────────────
// 🎬 액션: 입장
// ──────────────────────────────────────────────────────────
async function doJoin(db, tableRef, who, nickname) {
	return db.runTransaction(async (tx) => {
		const now = Date.now();
		const table = readTable(await tx.get(tableRef));
		const p = presence(table, now, who, "ensure");
		if (!p.joined) throw new HttpsError("failed-precondition", "테이블이 가득 찼습니다 (2명 전용)");

		const names = { ...p.names };
		if (nickname) names[who] = nickname;

		tx.set(tableRef, {
			...table,
			players: p.players,
			playerSeen: p.playerSeen,
			names,
			lastUpdated: FieldValue.serverTimestamp(),
		});
		return { joined: true, round: table.currentRound, phase: table.phase };
	});
}

// 하트비트
async function doHeartbeat(db, tableRef, who) {
	return db.runTransaction(async (tx) => {
		const now = Date.now();
		const table = readTable(await tx.get(tableRef));
		if (!table.players.includes(who)) return { noop: true };
		const playerSeen = { ...(table.playerSeen || {}), [who]: now };
		tx.update(tableRef, { playerSeen, lastUpdated: FieldValue.serverTimestamp() });
		return { ok: true };
	}).catch(() => ({ noop: true }));
}

// 퇴장
async function doLeave(db, tableRef, tableId, who) {
	return db.runTransaction(async (tx) => {
		const table = readTable(await tx.get(tableRef));
		const players = (table.players || []).filter(p => p !== who);
		const names = { ...(table.names || {}) }; delete names[who];
		const playerSeen = { ...(table.playerSeen || {}) }; delete playerSeen[who];

		// 플레이 중이면 상대 자동 승리
		if (table.phase === "playing" || table.phase === "go_stop") {
			const other = (table.players || []).find(p => p !== who);
			if (other) {
				// 상대 승리로 처리 (여기선 간단히 종료)
				tx.set(tableRef, {
					...table,
					players,
					names,
					playerSeen,
					phase: "waiting",
					currentTurn: null,
					lastUpdated: FieldValue.serverTimestamp(),
				});
				// 더미/손패 비밀 정리
				tx.delete(secretRef(db, tableId));
				return { left: true, forfeited: true };
			}
		}

		tx.set(tableRef, {
			...table,
			players,
			names,
			playerSeen,
			lastUpdated: FieldValue.serverTimestamp(),
		});
		if (players.length === 0) tx.delete(secretRef(db, tableId));
		return { left: true };
	}).catch(() => ({ noop: true }));
}

// ──────────────────────────────────────────────────────────
// 🎬 액션: 게임 시작 (2명 모이면 자동 호출됨)
// ──────────────────────────────────────────────────────────
async function doStart(db, tableRef, tableId, who) {
	return db.runTransaction(async (tx) => {
		const now = Date.now();
		const table = readTable(await tx.get(tableRef));
		if (table.phase !== "waiting") return { already: true, phase: table.phase };
		if (!table.players.includes(who)) throw new HttpsError("failed-precondition", "입장하지 않았습니다");
		if (table.players.length < 2) return { waiting: true, players: table.players.length };

		// 입장료 차감
		const userRefs = table.players.map(uid => db.collection("users").doc(uid));
		const userSnaps = await Promise.all(userRefs.map(r => tx.get(r)));
		for (let i = 0; i < userSnaps.length; i++) {
			if (!userSnaps[i].exists) throw new HttpsError("not-found", `유저 정보 없음: ${table.players[i]}`);
			const balance = userSnaps[i].data().gamePoints || 0;
			if (balance < ENTRY_FEE) {
				throw new HttpsError("failed-precondition", `${table.players[i]} 포인트 부족 (${balance.toLocaleString()} / ${ENTRY_FEE.toLocaleString()})`);
			}
		}
		// 양쪽 다 차감
		for (const r of userRefs) {
			tx.update(r, { gamePoints: FieldValue.increment(-ENTRY_FEE) });
		}

		// 셔플 & 분배
		const { hand1, hand2, field, pile } = dealNewRound();
		const [p1, p2] = table.players;

		// 비밀 저장 (손패 + 더미)
		tx.set(secretRef(db, tableId), {
			round: table.currentRound,
			hands: { [p1]: hand1, [p2]: hand2 },
			pile,
			createdAt: FieldValue.serverTimestamp(),
		});

		// 공개 상태 갱신
		tx.set(tableRef, {
			...table,
			phase: "playing",
			field,
			captured: { [p1]: [], [p2]: [] },
			handCounts: { [p1]: 10, [p2]: 10 },
			pileRemaining: pile.length,
			currentTurn: p1,  // 랜덤 or p1 (여기선 p1)
			goCount: { [p1]: 0, [p2]: 0 },
			shaking: { [p1]: [], [p2]: [] },
			bbuks: [],
			choosing: null,
			lastAction: null,
			sessionScore: table.sessionScore || { [p1]: 0, [p2]: 0 },
			turnStartedAt: now,
			roundStartedAt: now,
			lastUpdated: FieldValue.serverTimestamp(),
		});

		return { started: true, round: table.currentRound };
	});
}

// ──────────────────────────────────────────────────────────
// 🎬 액션: 손패 카드 내기
// ──────────────────────────────────────────────────────────
async function doPlayCard(db, tableRef, tableId, who, cardId) {
	return db.runTransaction(async (tx) => {
		const now = Date.now();
		const table = readTable(await tx.get(tableRef));
		if (table.phase !== "playing") throw new HttpsError("failed-precondition", "지금은 카드를 낼 수 없습니다");
		if (table.currentTurn !== who) throw new HttpsError("failed-precondition", "당신 차례가 아닙니다");
		if (table.choosing) throw new HttpsError("failed-precondition", "선택을 먼저 하세요");

		const secSnap = await tx.get(secretRef(db, tableId));
		if (!secSnap.exists) throw new HttpsError("failed-precondition", "게임 비밀 데이터 없음");
		const secret = secSnap.data();
		const hands = { ...(secret.hands || {}) };
		const myHand = hands[who] || [];

		if (!myHand.includes(cardId)) throw new HttpsError("invalid-argument", "손패에 없는 카드입니다");

		const card = cardById(cardId);
		if (!card) throw new HttpsError("invalid-argument", "존재하지 않는 카드입니다");

		// 손에서 제거
		hands[who] = myHand.filter(id => id !== cardId);
		const newField = table.field.slice();
		const matches = findMatches(newField, card.month);

		let newCaptured = { ...(table.captured || {}) };
		newCaptured[who] = (newCaptured[who] || []).slice();
		let lastAction = { userId: who, cardId, from: 'HAND', at: now, playedMonth: card.month };
		let choosing = null;
		let newBbuks = (table.bbuks || []).slice();

		// 🎯 뻑 깨기 체크: 이 카드가 기존 뻑과 같은 월인가?
		const bbukIdx = newBbuks.findIndex(b => b.month === card.month);
		let bbukSteal = null;  // 뻑 카드 + 상대 피 뺏기
		if (bbukIdx >= 0) {
			const bbuk = newBbuks[bbukIdx];
			bbukSteal = bbuk.cards;  // 뻑 쌓인 카드들
			newBbuks.splice(bbukIdx, 1);  // 뻑 제거
		}

		if (matches.length === 0) {
			// 매칭 X → 바닥에 추가
			newField.push(cardId);
			lastAction.captured = null;
			// 뻑이 있었어도 매칭 안 됐으면 뻑은 그대로 두고 패스
			if (bbukSteal) {
				// 다시 뻑으로 복구
				newBbuks.push({ month: card.month, cards: bbukSteal, by: who });
				bbukSteal = null;
			}
		} else if (matches.length === 1) {
			// 매칭 1 → 자동 획득
			newCaptured[who].push(cardId, matches[0]);
			const idx = newField.indexOf(matches[0]);
			if (idx >= 0) newField.splice(idx, 1);
			lastAction.captured = [cardId, matches[0]];
			// 뻑 깨기 성공 → 뻑 쌓인 카드도 가져오기
			if (bbukSteal) {
				newCaptured[who].push(...bbukSteal);
				lastAction.bbukBroken = bbukSteal;
			}
		} else if (matches.length === 2) {
			// 매칭 2 → 선택 필요
			choosing = { userId: who, playedCard: cardId, options: matches, from: 'HAND' };
			// 손에서 뺀 카드는 임시 보관 (선택 끝나면 처리)
			tx.set(secretRef(db, tableId), { ...secret, hands, tempPlayed: { userId: who, cardId, from: 'HAND', bbukSteal } });
			tx.update(tableRef, {
				handCounts: { ...(table.handCounts || {}), [who]: hands[who].length },
				choosing,
				bbuks: newBbuks,
				lastUpdated: FieldValue.serverTimestamp(),
			});
			return { choosing: true, options: matches };
		} else if (matches.length === 3) {
			// 매칭 3 → 쓸 (전부 획득)
			newCaptured[who].push(cardId, ...matches);
			for (const m of matches) {
				const idx = newField.indexOf(m);
				if (idx >= 0) newField.splice(idx, 1);
			}
			lastAction.captured = [cardId, ...matches];
			lastAction.sweep = true;
			if (bbukSteal) {
				newCaptured[who].push(...bbukSteal);
				lastAction.bbukBroken = bbukSteal;
			}
		}

		// 더미 뒤집기
		const pileResult = await flipFromPile(db, tx, tableId, {
			...table,
			field: newField,
			captured: newCaptured,
			bbuks: newBbuks,
			lastAction,
		}, hands, secret.pile || [], who, now);

		return pileResult;
	});
}

// 더미에서 뽑아 바닥에 처리 (뻑/따닥 자동 감지)
async function flipFromPile(db, tx, tableId, state, hands, pile, who, now) {
	if (!pile || pile.length === 0) {
		// 더미 소진 → 턴 종료 또는 게임 종료
		return finishTurn(db, tx, tableId, state, hands, [], who, now);
	}

	const drawnId = pile[pile.length - 1];
	const remainingPile = pile.slice(0, -1);
	const drawnCard = cardById(drawnId);
	const matches = findMatches(state.field, drawnCard.month);

	let newField = state.field.slice();
	let newCaptured = { ...(state.captured || {}) };
	newCaptured[who] = (newCaptured[who] || []).slice();
	let newBbuks = (state.bbuks || []).slice();
	let drawAction = { cardId: drawnId, captured: null };

	// 손패로 낸 카드 월 (뻑/따닥 체크용)
	const playedMonth = state.lastAction?.playedMonth;
	const handCaptured = state.lastAction?.captured;  // 손패로 획득한 카드들

	// 🎯 뻑 깨기 체크: 더미 카드가 기존 뻑과 같은 월인가?
	const bbukIdx = newBbuks.findIndex(b => b.month === drawnCard.month);
	let bbukSteal = null;
	if (bbukIdx >= 0) {
		bbukSteal = newBbuks[bbukIdx].cards;
		newBbuks.splice(bbukIdx, 1);
	}

	// 🎯 뻑 체크: 더미 카드가 손패로 낸 월과 같은가? (매칭 개수와 무관)
	// 손패 매칭 1장 후 더미 뒤집었더니 또 같은 월 → 뻑!
	const isBbuk = playedMonth === drawnCard.month && handCaptured && handCaptured.length === 2;

	if (isBbuk) {
		// 뻑 처리: 손패 획득 2장을 되돌리고 뻑 상태로 묶음
		const capturedList = newCaptured[who].slice();
		for (const id of handCaptured) {
			const i = capturedList.lastIndexOf(id);
			if (i >= 0) capturedList.splice(i, 1);
		}
		newCaptured[who] = capturedList;

		// 뻑 카드: 손패 1 + 바닥매칭 1 + 더미 1 = 3장
		const bbukCards = [...handCaptured, drawnId];
		newBbuks.push({ month: drawnCard.month, cards: bbukCards, by: who });
		drawAction.bbuk = true;
		drawAction.bbukMonth = drawnCard.month;
		// 바닥에 추가 매칭이 있어도 뻑 상태에서는 바닥에 그 월 안 둠

		// bbukSteal 복구 (뻑 중첩)
		if (bbukSteal) {
			newBbuks.push({ month: drawnCard.month, cards: bbukSteal, by: who });
			bbukSteal = null;
		}
	} else if (matches.length === 0) {
		// 매칭 X → 바닥에 추가
		newField.push(drawnId);
		if (bbukSteal) {
			// 복구
			newBbuks.push({ month: drawnCard.month, cards: bbukSteal, by: who });
			bbukSteal = null;
		}
	} else if (matches.length === 1) {
		// 일반 쪽
		newCaptured[who].push(drawnId, matches[0]);
		const idx = newField.indexOf(matches[0]);
		if (idx >= 0) newField.splice(idx, 1);
		drawAction.captured = [drawnId, matches[0]];
		drawAction.pok = true;  // 쪽

		// 🎯 따닥 체크: 손패도 같은 월 매칭했으면 → 따닥
		if (playedMonth === drawnCard.month && handCaptured) {
			drawAction.ttadak = true;  // 상대 피 1장 더 뺏음
		}
		// 뻑 깨기
		if (bbukSteal) {
			newCaptured[who].push(...bbukSteal);
			drawAction.bbukBroken = bbukSteal;
		}
	} else if (matches.length === 2) {
		// 더미에서 뽑은 카드가 바닥 2장과 매칭 → 선택
		const choosing = { userId: who, playedCard: drawnId, options: matches, from: 'DRAW' };
		tx.set(secretRef(db, tableId), {
			round: (await tx.get(secretRef(db, tableId))).data().round,
			hands,
			pile: remainingPile,
			tempDraw: { userId: who, cardId: drawnId, from: 'DRAW', bbukSteal },
		});
		tx.update(db.collection("matgo_tables").doc(tableId), {
			field: newField,
			captured: newCaptured,
			handCounts: { ...state.handCounts, [who]: (hands[who] || []).length },
			pileRemaining: remainingPile.length,
			choosing,
			bbuks: newBbuks,
			lastAction: { ...state.lastAction, draw: drawAction },
			lastUpdated: FieldValue.serverTimestamp(),
		});
		return { choosing: true, options: matches };
	} else if (matches.length === 3) {
		newCaptured[who].push(drawnId, ...matches);
		for (const m of matches) {
			const idx = newField.indexOf(m);
			if (idx >= 0) newField.splice(idx, 1);
		}
		drawAction.captured = [drawnId, ...matches];
		drawAction.sweep = true;
		if (bbukSteal) {
			newCaptured[who].push(...bbukSteal);
			drawAction.bbukBroken = bbukSteal;
		}
	}

	return finishTurn(db, tx, tableId, {
		...state,
		field: newField,
		captured: newCaptured,
		bbuks: newBbuks,
		lastAction: { ...state.lastAction, draw: drawAction },
	}, hands, remainingPile, who, now);
}

// 턴 종료 처리 (점수 체크 → 7점 넘으면 go_stop, 아니면 턴 넘김)
async function finishTurn(db, tx, tableId, state, hands, pile, who, now) {
	// 쪽/쓸/따닥 보너스 - 상대 피 1장(쪽/쓸) 또는 2장(따닥) 뺏기
	const lastAction = state.lastAction || {};
	const draw = lastAction.draw || {};
	const didPok = draw.pok || lastAction.pok;
	const didSweep = draw.sweep || lastAction.sweep;
	const didTtadak = draw.ttadak;  // 따닥: 피 2장
	const didBbuk = draw.bbuk;  // 뻑: 다시 자기 턴
	
	let newCaptured = { ...state.captured };
	// 피 뺏기 횟수: 따닥은 2장, 쪽/쓸은 1장
	const piStealCount = didTtadak ? 2 : (didPok || didSweep ? 1 : 0);
	if (piStealCount > 0) {
		const opp = state.players.find(p => p !== who);
		if (opp && newCaptured[opp]) {
			const oppCaptured = newCaptured[opp].slice();
			for (let i = 0; i < piStealCount; i++) {
				// 피 우선, 없으면 쌍피
				let takenIdx = oppCaptured.findIndex(id => cardById(id).type === 'PI');
				if (takenIdx < 0) takenIdx = oppCaptured.findIndex(id => cardById(id).type === 'SSANG_PI');
				if (takenIdx >= 0) {
					newCaptured[who].push(oppCaptured[takenIdx]);
					oppCaptured.splice(takenIdx, 1);
				} else break;  // 더 이상 뺏을 피 없음
			}
			newCaptured[opp] = oppCaptured;
		}
	}

	// 점수 계산
	const myScore = calcBaseScore(newCaptured[who] || []);
	
	const newHandCounts = { ...state.handCounts, [who]: (hands[who] || []).length };
	const otherPlayer = state.players.find(p => p !== who);

	// 비밀 상태 업데이트
	const secSnap = await tx.get(secretRef(db, tableId));
	tx.set(secretRef(db, tableId), {
		round: secSnap.data().round,
		hands,
		pile,
	});

	// 7점 달성 → 고/스톱 선택 phase
	if (myScore.score >= TARGET_SCORE) {
		tx.update(db.collection("matgo_tables").doc(tableId), {
			field: state.field,
			captured: newCaptured,
			handCounts: newHandCounts,
			pileRemaining: pile.length,
			phase: "go_stop",
			choosing: null,
			lastAction: state.lastAction,
			currentTurn: who,  // 고/스톱 선택은 본인이
			turnStartedAt: now,
			lastUpdated: FieldValue.serverTimestamp(),
		});
		return { goStop: true, score: myScore.score };
	}

	// 손패/더미 소진 → 무승부(또는 피점수 승)
	if ((hands[who] || []).length === 0 && pile.length === 0) {
		return endRound(db, tx, tableId, state, newCaptured, newHandCounts, pile, null, now, "exhausted");
	}

	// 뻑이 났으면 다시 자기 턴 (한번 더 카드 내기)
	const nextTurn = didBbuk ? who : otherPlayer;

	// 턴 넘김
	tx.update(db.collection("matgo_tables").doc(tableId), {
		field: state.field,
		captured: newCaptured,
		handCounts: newHandCounts,
		pileRemaining: pile.length,
		bbuks: state.bbuks || [],
		choosing: null,
		currentTurn: nextTurn,
		lastAction: state.lastAction,
		turnStartedAt: now,
		lastUpdated: FieldValue.serverTimestamp(),
	});
	return { ok: true, nextTurn, bbuk: didBbuk };
}

// 라운드 종료 → 포인트 정산 + 기록
async function endRound(db, tx, tableId, state, captured, handCounts, pile, winner, now, reason) {
	const [p1, p2] = state.players;
	const p1Score = calcFinalScore(captured[p1] || [], captured[p2] || [], state.goCount?.[p1] || 0, (state.shaking?.[p1] || []).length);
	const p2Score = calcFinalScore(captured[p2] || [], captured[p1] || [], state.goCount?.[p2] || 0, (state.shaking?.[p2] || []).length);

	let actualWinner = winner;
	if (!actualWinner) {
		if (p1Score.score > p2Score.score) actualWinner = p1;
		else if (p2Score.score > p1Score.score) actualWinner = p2;
	}

	const winAmount = ENTRY_FEE * 2;  // 양쪽에서 받은 입장료

	if (actualWinner) {
		tx.update(db.collection("users").doc(actualWinner), {
			gamePoints: FieldValue.increment(winAmount),
		});
	} else {
		// 무승부 → 반환
		tx.update(db.collection("users").doc(p1), { gamePoints: FieldValue.increment(ENTRY_FEE) });
		tx.update(db.collection("users").doc(p2), { gamePoints: FieldValue.increment(ENTRY_FEE) });
	}

	// 히스토리 기록
	const historyRef = db.collection("matgo_history").doc(tableId).collection("history").doc(String(state.currentRound));
	tx.set(historyRef, {
		round: state.currentRound,
		winner: actualWinner,
		reason,
		scores: { [p1]: p1Score.score, [p2]: p2Score.score },
		breakdowns: { [p1]: p1Score.breakdown, [p2]: p2Score.breakdown },
		multipliers: { [p1]: p1Score.multipliers, [p2]: p2Score.multipliers },
		players: [p1, p2],
		finishedAt: FieldValue.serverTimestamp(),
		at: now,
	});

	// 세션 점수 누적
	const newSession = { ...(state.sessionScore || {}) };
	if (actualWinner) newSession[actualWinner] = (newSession[actualWinner] || 0) + 1;

	tx.update(db.collection("matgo_tables").doc(tableId), {
		field: state.field,
		captured,
		handCounts,
		pileRemaining: pile.length,
		phase: "waiting",
		currentTurn: null,
		choosing: null,
		lastAction: state.lastAction,
		sessionScore: newSession,
		currentRound: state.currentRound + 1,
		lastRoundResult: {
			winner: actualWinner,
			scores: { [p1]: p1Score.score, [p2]: p2Score.score },
			reason,
			finishedAt: now,
		},
		lastUpdated: FieldValue.serverTimestamp(),
	});

	// 비밀 비우기 (다음 판 준비)
	tx.delete(secretRef(db, tableId));

	return { finished: true, winner: actualWinner, scores: { [p1]: p1Score.score, [p2]: p2Score.score } };
}

// ──────────────────────────────────────────────────────────
// 🎬 액션: 바닥 2장 중 선택
// ──────────────────────────────────────────────────────────
async function doChooseField(db, tableRef, tableId, who, chosenId) {
	return db.runTransaction(async (tx) => {
		const now = Date.now();
		const table = readTable(await tx.get(tableRef));
		if (!table.choosing || table.choosing.userId !== who) {
			throw new HttpsError("failed-precondition", "선택할 수 있는 상태가 아닙니다");
		}
		if (!table.choosing.options.includes(chosenId)) {
			throw new HttpsError("invalid-argument", "선택지에 없는 카드입니다");
		}

		const secSnap = await tx.get(secretRef(db, tableId));
		const secret = secSnap.data();
		const { playedCard, from } = table.choosing;

		let newField = table.field.filter(id => id !== chosenId);
		let newCaptured = { ...(table.captured || {}) };
		newCaptured[who] = (newCaptured[who] || []).slice();
		newCaptured[who].push(playedCard, chosenId);

		const lastAction = { userId: who, cardId: playedCard, from, captured: [playedCard, chosenId], at: now };

		const stateAfter = {
			...table,
			field: newField,
			captured: newCaptured,
			choosing: null,
			lastAction,
		};

		// HAND면 더미 뒤집기, DRAW면 턴 종료
		if (from === 'HAND') {
			return flipFromPile(db, tx, tableId, stateAfter, secret.hands, secret.pile || [], who, now);
		} else {
			return finishTurn(db, tx, tableId, stateAfter, secret.hands, secret.pile || [], who, now);
		}
	});
}

// ──────────────────────────────────────────────────────────
// 💣 액션: 폭탄 (손패 같은 월 3장 한꺼번에 던지기)
// ──────────────────────────────────────────────────────────
async function doBomb(db, tableRef, tableId, who, month) {
	return db.runTransaction(async (tx) => {
		const now = Date.now();
		const table = readTable(await tx.get(tableRef));
		if (table.phase !== "playing") throw new HttpsError("failed-precondition", "플레이 중이 아닙니다");
		if (table.currentTurn !== who) throw new HttpsError("failed-precondition", "당신 차례가 아닙니다");
		if (table.choosing) throw new HttpsError("failed-precondition", "선택을 먼저 하세요");

		const secSnap = await tx.get(secretRef(db, tableId));
		if (!secSnap.exists) throw new HttpsError("failed-precondition", "게임 비밀 데이터 없음");
		const secret = secSnap.data();
		const hands = { ...(secret.hands || {}) };
		const myHand = hands[who] || [];

		// 같은 월 카드 3장 체크
		const sameMonthCards = myHand.filter(id => cardById(id).month === month);
		if (sameMonthCards.length < 3) {
			throw new HttpsError("failed-precondition", `${month}월 카드가 3장이 아닙니다 (${sameMonthCards.length}장)`);
		}
		const bombCards = sameMonthCards.slice(0, 3);

		// 손에서 3장 제거
		hands[who] = myHand.filter(id => !bombCards.includes(id));

		// 바닥에 그 월 있으면 다 가져옴
		const fieldSameMonth = findMatches(table.field, month);
		let newField = table.field.filter(id => cardById(id).month !== month);

		let newCaptured = { ...(table.captured || {}) };
		newCaptured[who] = (newCaptured[who] || []).slice();
		newCaptured[who].push(...bombCards, ...fieldSameMonth);

		// 상대 피 1장 뺏기 (폭탄 보너스)
		const opp = table.players.find(p => p !== who);
		if (opp && newCaptured[opp]) {
			const oppCaptured = newCaptured[opp].slice();
			let takenIdx = oppCaptured.findIndex(id => cardById(id).type === 'PI');
			if (takenIdx < 0) takenIdx = oppCaptured.findIndex(id => cardById(id).type === 'SSANG_PI');
			if (takenIdx >= 0) {
				newCaptured[who].push(oppCaptured[takenIdx]);
				oppCaptured.splice(takenIdx, 1);
				newCaptured[opp] = oppCaptured;
			}
		}

		const lastAction = {
			userId: who,
			bomb: true,
			bombMonth: month,
			captured: [...bombCards, ...fieldSameMonth],
			at: now,
		};

		const stateAfter = {
			...table,
			field: newField,
			captured: newCaptured,
			handCounts: { ...(table.handCounts || {}), [who]: hands[who].length },
			lastAction,
		};

		// 폭탄 후 더미 뒤집기
		return flipFromPile(db, tx, tableId, stateAfter, hands, secret.pile || [], who, now);
	});
}

// ──────────────────────────────────────────────────────────
// 🎲 액션: 흔듦 선언 (손패 같은 월 3장이라고 알리기)
// ──────────────────────────────────────────────────────────
async function doShake(db, tableRef, tableId, who, month) {
	return db.runTransaction(async (tx) => {
		const now = Date.now();
		const table = readTable(await tx.get(tableRef));
		if (table.phase !== "playing") throw new HttpsError("failed-precondition", "플레이 중이 아닙니다");
		if (table.currentTurn !== who) throw new HttpsError("failed-precondition", "당신 차례가 아닙니다");
		if (table.choosing) throw new HttpsError("failed-precondition", "선택을 먼저 하세요");

		const secSnap = await tx.get(secretRef(db, tableId));
		if (!secSnap.exists) throw new HttpsError("failed-precondition", "게임 비밀 데이터 없음");
		const secret = secSnap.data();
		const myHand = (secret.hands || {})[who] || [];

		// 같은 월 3장 체크
		const sameMonthCards = myHand.filter(id => cardById(id).month === month);
		if (sameMonthCards.length < 3) {
			throw new HttpsError("failed-precondition", `${month}월 카드가 3장이 아닙니다`);
		}

		// 이미 흔든 월인지
		const myShaking = (table.shaking || {})[who] || [];
		if (myShaking.includes(month)) {
			throw new HttpsError("failed-precondition", "이미 흔든 월입니다");
		}

		const newShaking = { ...(table.shaking || {}), [who]: [...myShaking, month] };

		tx.update(tableRef, {
			shaking: newShaking,
			lastAction: { ...table.lastAction, shake: { userId: who, month }, at: now },
			lastUpdated: FieldValue.serverTimestamp(),
		});
		return { shaken: true, month };
	});
}

// ──────────────────────────────────────────────────────────
// 🎬 액션: 고/스톱
// ──────────────────────────────────────────────────────────
async function doGoStop(db, tableRef, tableId, who, decision) {
	return db.runTransaction(async (tx) => {
		const now = Date.now();
		const table = readTable(await tx.get(tableRef));
		if (table.phase !== "go_stop") throw new HttpsError("failed-precondition", "지금은 고/스톱 상태가 아닙니다");
		if (table.currentTurn !== who) throw new HttpsError("failed-precondition", "선택 권한이 없습니다");

		const secSnap = await tx.get(secretRef(db, tableId));
		const secret = secSnap.data();

		if (decision === "stop") {
			// 종료
			return endRound(db, tx, tableId, table, table.captured, table.handCounts, secret.pile || [], who, now, "stop");
		} else if (decision === "go") {
			// 고 선언 → 다시 playing
			const newGo = { ...(table.goCount || {}), [who]: ((table.goCount || {})[who] || 0) + 1 };
			const otherPlayer = table.players.find(p => p !== who);
			tx.update(tableRef, {
				phase: "playing",
				goCount: newGo,
				currentTurn: otherPlayer,  // 다음 턴은 상대부터
				turnStartedAt: now,
				lastUpdated: FieldValue.serverTimestamp(),
			});
			return { go: true, goCount: newGo[who] };
		} else {
			throw new HttpsError("invalid-argument", "decision은 'go' 또는 'stop'");
		}
	});
}

// ──────────────────────────────────────────────────────────
// 🎬 액션: 내 손패 보기 (본인만)
// ──────────────────────────────────────────────────────────
async function doMyHand(db, tableRef, tableId, who) {
	const table = readTable(await tableRef.get());
	if (!table.players.includes(who)) throw new HttpsError("failed-precondition", "참가자가 아닙니다");
	if (table.phase === "waiting") return { hand: [], round: table.currentRound };

	const secSnap = await secretRef(db, tableId).get();
	if (!secSnap.exists) return { hand: [], round: table.currentRound };
	const secret = secSnap.data();
	return {
		hand: (secret.hands || {})[who] || [],
		round: secret.round,
		pileRemaining: (secret.pile || []).length,
	};
}

// ──────────────────────────────────────────────────────────
// 🎯 타임아웃 체크 (scheduledSettlement 에서 호출)
// ──────────────────────────────────────────────────────────
async function checkMatgoTimeouts(db) {
	const now = Date.now();
	let processed = 0;

	for (const tableId of TABLES) {
		const tableRef = db.collection("matgo_tables").doc(tableId);
		const snap = await tableRef.get();
		if (!snap.exists) continue;
		const table = readTable(snap);

		// playing 상태인데 턴이 너무 오래 멈춰있으면 → 랜덤 수 두기 (자동 패스)
		if (table.phase === "playing" && table.currentTurn && table.turnStartedAt) {
			if (now - table.turnStartedAt > TURN_TIMEOUT_MS) {
				// 자동 랜덤 카드 내기
				try {
					const sec = await secretRef(db, tableId).get();
					if (sec.exists) {
						const hand = (sec.data().hands || {})[table.currentTurn] || [];
						if (hand.length > 0) {
							const randomCard = hand[crypto.randomInt(0, hand.length)];
							await doPlayCard(db, tableRef, tableId, table.currentTurn, randomCard);
							processed++;
						}
					}
				} catch (e) {
					// skip
				}
			}
		}

		// 2명 모여있는데 waiting 이면 자동 start
		if (table.phase === "waiting" && table.players.length >= 2) {
			try {
				await doStart(db, tableRef, tableId, table.players[0]);
				processed++;
			} catch (e) {
				// skip
			}
		}
	}

	return { processed };
}

// ──────────────────────────────────────────────────────────
// 🎯 onCall 엔트리
// ──────────────────────────────────────────────────────────
exports.playMatgoRound = onCall({ region: "asia-northeast3" }, async (request) => {
	if (!(request.auth && request.auth.uid)) throw new HttpsError("unauthenticated", "로그인 필요");

	const data = request.data || {};
	const { tableId, action } = data;
	if (!TABLES.includes(tableId)) throw new HttpsError("invalid-argument", "잘못된 테이블");

	const who = typeof data.userId === "string" ? data.userId.trim() : "";
	if (!who || who.length > 100) throw new HttpsError("invalid-argument", "userId 필요");

	const db = getFirestore();
	const tableRef = db.collection("matgo_tables").doc(tableId);

	let out;
	switch (action) {
		case "join":
			out = await doJoin(db, tableRef, who, data.nickname);
			break;
		case "heartbeat":
			out = await doHeartbeat(db, tableRef, who);
			break;
		case "leave":
			out = await doLeave(db, tableRef, tableId, who);
			break;
		case "start":
			out = await doStart(db, tableRef, tableId, who);
			break;
		case "playCard":
			if (typeof data.cardId !== "string") throw new HttpsError("invalid-argument", "cardId 필요");
			out = await doPlayCard(db, tableRef, tableId, who, data.cardId);
			break;
		case "chooseField":
			if (typeof data.cardId !== "string") throw new HttpsError("invalid-argument", "cardId 필요");
			out = await doChooseField(db, tableRef, tableId, who, data.cardId);
			break;
		case "goStop":
			if (!["go", "stop"].includes(data.decision)) throw new HttpsError("invalid-argument", "decision 필요 (go/stop)");
			out = await doGoStop(db, tableRef, tableId, who, data.decision);
			break;
		case "bomb":
			if (typeof data.month !== "number" || data.month < 1 || data.month > 12) {
				throw new HttpsError("invalid-argument", "month 필요 (1~12)");
			}
			out = await doBomb(db, tableRef, tableId, who, data.month);
			break;
		case "shake":
			if (typeof data.month !== "number" || data.month < 1 || data.month > 12) {
				throw new HttpsError("invalid-argument", "month 필요 (1~12)");
			}
			out = await doShake(db, tableRef, tableId, who, data.month);
			break;
		case "myHand":
			out = await doMyHand(db, tableRef, tableId, who);
			break;
		default:
			throw new HttpsError("invalid-argument", `알 수 없는 action: ${action}`);
	}

	return { ...(out || {}), serverNow: Date.now() };
});

// ──────────────────────────────────────────────────────────
// Exports
// ──────────────────────────────────────────────────────────
exports.checkMatgoTimeouts = checkMatgoTimeouts;
exports.TABLES = TABLES;
exports.ENTRY_FEE = ENTRY_FEE;
exports.TARGET_SCORE = TARGET_SCORE;
