// ============================================================
// k6 — Full End-to-End Scenario
// ============================================================
// Simulates a realistic user journey:
//   Register → Login → Create board → Create lists → Create cards
//   → Update cards → Tag cards → Invite member → Cleanup
// ============================================================
import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';
import { DEFAULT_THRESHOLDS, getStages, handleSummary } from '../config.js';
export { handleSummary };
import {
    registerUser, loginUser, randomEmail, randomName,
    randomBoardTitle, randomListTitle, randomCardContent, randomTagName,
    createBoard, getBoards, getBoardDetails, deleteBoard,
    createList, createCard, updateCard, deleteCard,
    createTag, getTags, addBoardMember, getBoardMembers,
} from '../helpers.js';

const e2eDuration = new Trend('e2e_scenario_duration', true);

export const options = {
    stages: getStages(),
    thresholds: {
        ...DEFAULT_THRESHOLDS,
        e2e_scenario_duration: ['p(95)<8000'],
    },
};

export default function () {
    const start = Date.now();

    const email = randomEmail();
    const name = randomName();
    const pass = 'TestPass123!';

    // ── 1. Register ─────────────────────────────────────────
    const regResult = registerUser(email, pass, name);
    if (!regResult.token) return;
    sleep(0.2);

    // ── 2. Login ────────────────────────────────────────────
    group('E2E: Login', () => {
        const loginResult = loginUser(email, pass);
        check(loginResult, {
            'login ok': () => !!loginResult.token,
        });
    });
    sleep(0.2);

    const token = regResult.token;

    // ── 3. Create board ─────────────────────────────────────
    let boardId;
    group('E2E: Create board', () => {
        const res = createBoard(token, randomBoardTitle());
        boardId = res.json('id');
        check(res, { 'board created': () => !!boardId });
    });
    if (!boardId) return;
    sleep(0.2);

    // ── 4. Verify dashboard ─────────────────────────────────
    group('E2E: Dashboard', () => {
        const res = getBoards(token);
        check(res, {
            'dashboard has board': (r) => r.json().some((b) => b.id === boardId),
        });
    });
    sleep(0.2);

    // ── 5. Create three lists (To Do, In Progress, Done) ────
    const listIds = [];
    group('E2E: Create lists', () => {
        ['To Do', 'In Progress', 'Done'].forEach((title) => {
            const res = createList(token, title, boardId);
            const id = res.json('id');
            if (id) listIds.push(id);
        });
        check(null, { '3 lists created': () => listIds.length === 3 });
    });
    if (listIds.length < 3) return;
    sleep(0.2);

    // ── 6. Create cards in "To Do" ──────────────────────────
    const cardIds = [];
    group('E2E: Create cards', () => {
        for (let i = 0; i < 3; i++) {
            const res = createCard(token, randomCardContent(), listIds[0], 'Medium');
            const id = res.json('id');
            if (id) cardIds.push(id);
        }
        check(null, { '3 cards created': () => cardIds.length === 3 });
    });
    if (cardIds.length < 3) return;
    sleep(0.2);

    // ── 7. Move first card to "In Progress" ─────────────────
    group('E2E: Move card', () => {
        const res = updateCard(token, cardIds[0], { listId: listIds[1], inProgress: true });
        check(res, {
            'card moved': (r) => r.json('listId') === listIds[1],
            'card inProgress': (r) => r.json('inProgress') === true,
        });
    });
    sleep(0.2);

    // ── 8. Mark second card as done ─────────────────────────
    group('E2E: Complete card', () => {
        const res = updateCard(token, cardIds[1], { listId: listIds[2], isDone: true });
        check(res, {
            'card done': (r) => r.json('isDone') === true,
            'card in done list': (r) => r.json('listId') === listIds[2],
        });
    });
    sleep(0.2);

    // ── 9. Create & assign tag ──────────────────────────────
    group('E2E: Tags', () => {
        const tagRes = createTag(token, randomTagName(), '#e74c3c');
        const tagId = tagRes.json('id');
        if (!tagId) return;

        const res = updateCard(token, cardIds[2], { tags: [tagId] });
        check(res, {
            'tag assigned': (r) => r.json('tags').length > 0,
        });
    });
    sleep(0.2);

    // ── 10. Invite a second user ────────────────────────────
    group('E2E: Invite member', () => {
        const member = registerUser(randomEmail(), 'TestPass123!', randomName());
        if (!member.token) return;

        addBoardMember(token, boardId, member.user.id, 'MEMBER');
        sleep(0.2);

        const membersRes = getBoardMembers(token, boardId);
        check(membersRes, {
            'member list has 2': (r) => r.json().length === 2,
        });

        // Member can see the board
        const detailRes = getBoardDetails(member.token, boardId);
        check(detailRes, {
            'member sees board': (r) => r.json('id') === boardId,
        });
    });
    sleep(0.2);

    // ── 11. Verify final board state ────────────────────────
    group('E2E: Final board state', () => {
        const res = getBoardDetails(token, boardId);
        const lists = res.json('lists') || [];
        const totalCards = lists.reduce((sum, l) => sum + (l.cards ? l.cards.length : 0), 0);
        check(null, {
            'board has lists': () => lists.length >= 3,
            'board has cards': () => totalCards >= 3,
        });
    });

    // ── Cleanup ─────────────────────────────────────────────
    deleteBoard(token, boardId);

    e2eDuration.add(Date.now() - start);
    sleep(0.5);
}