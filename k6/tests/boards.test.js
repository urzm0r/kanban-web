// ============================================================
// k6 — Board Management Tests
// ============================================================
// Covers: GET /api/boards, POST /api/boards, GET /api/boards/:id,
//         DELETE /api/boards/:id, member management endpoints.
// ============================================================
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, DEFAULT_THRESHOLDS, getStages } from '../config.js';
import {
    registerUser, randomEmail, randomName, randomBoardTitle,
    createBoard, getBoards, getBoardDetails, deleteBoard,
    getBoardMembers, addBoardMember, removeBoardMember,
    authHeaders
} from '../helpers.js';

// ── Custom metrics ──────────────────────────────────────────
const boardCreateDuration  = new Trend('board_create_duration', true);
const boardListDuration    = new Trend('board_list_duration', true);
const boardDetailDuration  = new Trend('board_detail_duration', true);
const boardErrors          = new Counter('board_errors');

export const options = {
    stages: getStages(),
    thresholds: {
        ...DEFAULT_THRESHOLDS,
        board_create_duration: ['p(95)<600'],
        board_list_duration:   ['p(95)<400'],
        board_detail_duration: ['p(95)<500'],
    },
};

export default function () {
    // ── Setup: register owner ───────────────────────────────
    const owner = registerUser(randomEmail(), 'TestPass123!', randomName());
    if (!owner.token) return;

    sleep(0.3);

    // ── 1. Create board ─────────────────────────────────────
    let boardId;
    group('Create board', () => {
        const res = createBoard(owner.token, randomBoardTitle());
        boardCreateDuration.add(res.timings.duration);

        const ok = check(res, {
            'create → has id':      (r) => !!r.json('id'),
            'create → has title':   (r) => !!r.json('title'),
            'create → has ownerId': (r) => r.json('ownerId') === owner.user.id,
        });
        if (!ok) boardErrors.add(1);

        boardId = res.json('id');
    });

    if (!boardId) return;
    sleep(0.3);

    // ── 2. List boards ──────────────────────────────────────
    group('List boards', () => {
        const res = getBoards(owner.token);
        boardListDuration.add(res.timings.duration);

        check(res, {
            'list → is array':       (r) => Array.isArray(r.json()),
            'list → contains board': (r) => r.json().some((b) => b.id === boardId),
        });
    });

    sleep(0.3);

    // ── 3. Get board details ────────────────────────────────
    group('Board details', () => {
        const res = getBoardDetails(owner.token, boardId);
        boardDetailDuration.add(res.timings.duration);

        check(res, {
            'details → correct id':   (r) => r.json('id') === boardId,
            'details → has lists':     (r) => Array.isArray(r.json('lists')),
            'details → has members':   (r) => Array.isArray(r.json('members')),
        });
    });

    sleep(0.3);

    // ── 4. Access denied for non-member ─────────────────────
    group('Board details — access denied', () => {
        const stranger = registerUser(randomEmail(), 'TestPass123!', randomName());
        if (!stranger.token) return;

        const res = http.get(
            `${BASE_URL}/api/boards/${boardId}`,
            { headers: authHeaders(stranger.token), tags: { name: 'board_denied' } }
        );

        check(res, {
            'stranger → 403': (r) => r.status === 403,
        });
    });

    sleep(0.3);

    // ── 5. Unauthorized access (no token) ───────────────────
    group('Board — unauthorized', () => {
        const res = http.get(
            `${BASE_URL}/api/boards`,
            { headers: { 'Content-Type': 'application/json' }, tags: { name: 'board_noauth' } }
        );

        check(res, {
            'no token → 401': (r) => r.status === 401,
        });
    });

    sleep(0.3);

    // ── 6. Member management ────────────────────────────────
    group('Board members — add & remove', () => {
        // Register a new user to add as member
        const member = registerUser(randomEmail(), 'TestPass123!', randomName());
        if (!member.token) return;

        // Add member
        const addRes = addBoardMember(owner.token, boardId, member.user.id, 'MEMBER');
        check(addRes, {
            'add member → has role': (r) => r.status === 200,
        });

        sleep(0.2);

        // Get members list
        const membersRes = getBoardMembers(owner.token, boardId);
        check(membersRes, {
            'members → is array':          (r) => Array.isArray(r.json()),
            'members → includes new user': (r) => r.json().some((m) => m.userId === member.user.id),
        });

        sleep(0.2);

        // Member can now access board
        const accessRes = getBoardDetails(member.token, boardId);
        check(accessRes, {
            'member access → 200': (r) => r.status === 200,
        });

        sleep(0.2);

        // Remove member
        const rmRes = removeBoardMember(owner.token, boardId, member.user.id);
        check(rmRes, {
            'remove member → success': (r) => r.json('success') === true,
        });

        sleep(0.2);

        // Non-owner cannot remove members
        const member2 = registerUser(randomEmail(), 'TestPass123!', randomName());
        if (!member2.token) return;
        addBoardMember(owner.token, boardId, member2.user.id, 'MEMBER');

        const rmFail = http.del(
            `${BASE_URL}/api/boards/${boardId}/members/${member2.user.id}`,
            null,
            { headers: authHeaders(member2.token), tags: { name: 'remove_member_denied' } }
        );
        check(rmFail, {
            'non-owner remove → 403': (r) => r.status === 403,
        });
    });

    sleep(0.3);

    // ── 7. Delete board ─────────────────────────────────────
    group('Delete board', () => {
        const res = deleteBoard(owner.token, boardId);
        check(res, {
            'delete → success': (r) => r.json('success') === true,
        });

        // Verify it's gone
        sleep(0.2);
        const verifyRes = http.get(
            `${BASE_URL}/api/boards/${boardId}`,
            { headers: authHeaders(owner.token), tags: { name: 'verify_deleted' } }
        );
        check(verifyRes, {
            'deleted board → 404 or 500': (r) => r.status === 404 || r.status === 500,
        });
    });

    sleep(0.3);

    // ── 8. Non-owner cannot delete board ────────────────────
    group('Delete board — non-owner denied', () => {
        const boardRes = createBoard(owner.token, randomBoardTitle());
        const bId = boardRes.json('id');
        if (!bId) return;

        const other = registerUser(randomEmail(), 'TestPass123!', randomName());
        if (!other.token) return;

        // Add as member then try to delete
        addBoardMember(owner.token, bId, other.user.id, 'MEMBER');
        sleep(0.2);

        const delRes = http.del(
            `${BASE_URL}/api/boards/${bId}`,
            null,
            { headers: authHeaders(other.token), tags: { name: 'delete_denied' } }
        );
        check(delRes, {
            'non-owner delete → 403': (r) => r.status === 403,
        });

        // Cleanup
        deleteBoard(owner.token, bId);
    });

    sleep(0.5);
}
