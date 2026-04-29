// ============================================================
// k6 — List Management Tests
// ============================================================
// Covers: POST /api/lists, PUT /api/lists/:id, DELETE /api/lists/:id
// ============================================================
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_URL, DEFAULT_THRESHOLDS, getStages, handleSummary } from '../config.js';
export { handleSummary };
import {
    registerUser, randomEmail, randomName, randomBoardTitle, randomListTitle,
    createBoard, getBoardDetails, createList, updateList, deleteList,
    deleteBoard, authHeaders
} from '../helpers.js';

const listCreateDuration = new Trend('list_create_duration', true);
const listUpdateDuration = new Trend('list_update_duration', true);

export const options = {
    stages: getStages(),
    thresholds: {
        ...DEFAULT_THRESHOLDS,
        list_create_duration: ['p(95)<500'],
        list_update_duration: ['p(95)<400'],
    },
};

export default function () {
    // ── Setup ───────────────────────────────────────────────
    const user = registerUser(randomEmail(), 'TestPass123!', randomName());
    if (!user.token) return;

    const boardRes = createBoard(user.token, randomBoardTitle());
    const boardId = boardRes.json('id');
    if (!boardId) return;

    sleep(0.3);

    // ── 1. Create list ──────────────────────────────────────
    let listId;
    group('Create list', () => {
        const title = randomListTitle();
        const res = createList(user.token, title, boardId);
        listCreateDuration.add(res.timings.duration);

        const ok = check(res, {
            'create → has id': (r) => !!r.json('id'),
            'create → has title': (r) => r.json('title') === title,
            'create → has cards': (r) => Array.isArray(r.json('cards')),
        });

        listId = res.json('id');
    });

    if (!listId) return;
    sleep(0.3);

    // ── 2. Verify list appears in board details ─────────────
    group('List in board details', () => {
        const res = getBoardDetails(user.token, boardId);
        const lists = res.json('lists');

        check(res, {
            'board has new list': () => lists.some((l) => l.id === listId),
        });
    });

    sleep(0.3);

    // ── 3. Update list ──────────────────────────────────────
    group('Update list', () => {
        const newTitle = `Updated_${randomListTitle()}`;
        const res = updateList(user.token, listId, newTitle);
        listUpdateDuration.add(res.timings.duration);

        check(res, {
            'update → title changed': (r) => r.json('title') === newTitle,
        });
    });

    sleep(0.3);

    // ── 4. Validation errors ────────────────────────────────
    group('Create list — validation errors', () => {
        // Missing title
        const res1 = http.post(
            `${BASE_URL}/api/lists`,
            JSON.stringify({ boardId }),
            { headers: authHeaders(user.token), tags: { name: 'list_invalid' } }
        );
        check(res1, {
            'missing title → 400': (r) => r.status === 400,
        });

        // Missing boardId
        const res2 = http.post(
            `${BASE_URL}/api/lists`,
            JSON.stringify({ title: 'Test' }),
            { headers: authHeaders(user.token), tags: { name: 'list_invalid' } }
        );
        check(res2, {
            'missing boardId → 400': (r) => r.status === 400,
        });

        // Non-existent board
        const res3 = http.post(
            `${BASE_URL}/api/lists`,
            JSON.stringify({ title: 'Test', boardId: '00000000-0000-0000-0000-000000000000' }),
            { headers: authHeaders(user.token), tags: { name: 'list_invalid' } }
        );
        check(res3, {
            'fake board → 404': (r) => r.status === 404,
        });
    });

    sleep(0.3);

    // ── 5. Delete list ──────────────────────────────────────
    group('Delete list', () => {
        const res = deleteList(user.token, listId);
        check(res, {
            'delete → success': (r) => r.json('success') === true,
        });
    });

    sleep(0.3);

    // ── Cleanup ─────────────────────────────────────────────
    deleteBoard(user.token, boardId);
    sleep(0.5);
}