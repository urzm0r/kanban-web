// ============================================================
// k6 — Helper utilities
// ============================================================
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, HEADERS_JSON, authHeaders } from './config.js';
export { authHeaders };

// ── Random data generators ─────────────────────────────────

/**
 * Generates a unique suffix using VU id + iteration + timestamp
 * to avoid collisions across parallel VUs.
 */
export function uniqueId() {
    return `${__VU}_${__ITER}_${Date.now()}`;
}

export function randomEmail() {
    return `k6user_${uniqueId()}@test.local`;
}

export function randomName() {
    return `k6user_${uniqueId()}`;
}

export function randomBoardTitle() {
    return `Board_${uniqueId()}`;
}

export function randomListTitle() {
    return `List_${uniqueId()}`;
}

export function randomCardContent() {
    return `Card_${uniqueId()}`;
}

export function randomTagName() {
    return `tag_${uniqueId()}`;
}

// ── Auth helpers ────────────────────────────────────────────

/**
 * Registers a new user and returns { token, user }.
 * Fails the check and returns null fields if registration fails.
 */
export function registerUser(email, password, name) {
    const res = http.post(
        `${BASE_URL}/api/auth/register`,
        JSON.stringify({ email, password, name }),
        { headers: HEADERS_JSON, tags: { name: 'register' } }
    );

    const ok = check(res, {
        'register → 200': (r) => r.status === 200,
    });

    if (!ok) {
        console.error(`Registration failed: ${res.status} ${res.body}`);
        return { token: null, user: null };
    }

    const body = res.json();
    return { token: body.token, user: body.user };
}

/**
 * Logs in an existing user and returns { token, user }.
 */
export function loginUser(email, password) {
    const res = http.post(
        `${BASE_URL}/api/auth/login`,
        JSON.stringify({ email, password }),
        { headers: HEADERS_JSON, tags: { name: 'login' } }
    );

    const ok = check(res, {
        'login → 200': (r) => r.status === 200,
    });

    if (!ok) {
        console.error(`Login failed: ${res.status} ${res.body}`);
        return { token: null, user: null };
    }

    const body = res.json();
    return { token: body.token, user: body.user };
}

// ── CRUD wrappers ───────────────────────────────────────────

export function createBoard(token, title) {
    const res = http.post(
        `${BASE_URL}/api/boards`,
        JSON.stringify({ title }),
        { headers: authHeaders(token), tags: { name: 'create_board' } }
    );
    check(res, { 'create board → 200': (r) => r.status === 200 });
    return res;
}

export function getBoards(token) {
    const res = http.get(
        `${BASE_URL}/api/boards`,
        { headers: authHeaders(token), tags: { name: 'get_boards' } }
    );
    check(res, { 'get boards → 200': (r) => r.status === 200 });
    return res;
}

export function getBoardDetails(token, boardId) {
    const res = http.get(
        `${BASE_URL}/api/boards/${boardId}`,
        { headers: authHeaders(token), tags: { name: 'get_board_details' } }
    );
    check(res, { 'get board details → 200': (r) => r.status === 200 });
    return res;
}

export function deleteBoard(token, boardId) {
    const res = http.del(
        `${BASE_URL}/api/boards/${boardId}`,
        null,
        { headers: authHeaders(token), tags: { name: 'delete_board' } }
    );
    check(res, { 'delete board → 200': (r) => r.status === 200 });
    return res;
}

export function createList(token, title, boardId, type) {
    const payload = { title, boardId };
    if (type) payload.type = type;
    const res = http.post(
        `${BASE_URL}/api/lists`,
        JSON.stringify(payload),
        { headers: authHeaders(token), tags: { name: 'create_list' } }
    );
    check(res, { 'create list → 200': (r) => r.status === 200 });
    return res;
}

export function updateList(token, listId, title) {
    const res = http.put(
        `${BASE_URL}/api/lists/${listId}`,
        JSON.stringify({ title }),
        { headers: authHeaders(token), tags: { name: 'update_list' } }
    );
    check(res, { 'update list → 200': (r) => r.status === 200 });
    return res;
}

export function deleteList(token, listId) {
    const res = http.del(
        `${BASE_URL}/api/lists/${listId}`,
        null,
        { headers: authHeaders(token), tags: { name: 'delete_list' } }
    );
    check(res, { 'delete list → 200': (r) => r.status === 200 });
    return res;
}

export function createCard(token, content, listId, priority) {
    const res = http.post(
        `${BASE_URL}/api/cards`,
        JSON.stringify({ content, listId, priority: priority || 'Medium' }),
        { headers: authHeaders(token), tags: { name: 'create_card' } }
    );
    check(res, { 'create card → 200': (r) => r.status === 200 });
    return res;
}

export function updateCard(token, cardId, data) {
    const res = http.put(
        `${BASE_URL}/api/cards/${cardId}`,
        JSON.stringify(data),
        { headers: authHeaders(token), tags: { name: 'update_card' } }
    );
    check(res, { 'update card → 200': (r) => r.status === 200 });
    return res;
}

export function deleteCard(token, cardId) {
    const res = http.del(
        `${BASE_URL}/api/cards/${cardId}`,
        null,
        { headers: authHeaders(token), tags: { name: 'delete_card' } }
    );
    check(res, { 'delete card → 200': (r) => r.status === 200 });
    return res;
}

export function getTags(token) {
    const res = http.get(
        `${BASE_URL}/api/tags`,
        { headers: authHeaders(token), tags: { name: 'get_tags' } }
    );
    check(res, { 'get tags → 200': (r) => r.status === 200 });
    return res;
}

export function createTag(token, name, color) {
    const payload = { name };
    if (color) payload.color = color;
    const res = http.post(
        `${BASE_URL}/api/tags`,
        JSON.stringify(payload),
        { headers: authHeaders(token), tags: { name: 'create_tag' } }
    );
    check(res, { 'create tag → 200': (r) => r.status === 200 });
    return res;
}

export function searchUsers(token, query) {
    const res = http.get(
        `${BASE_URL}/api/users/search?q=${encodeURIComponent(query)}`,
        { headers: authHeaders(token), tags: { name: 'search_users' } }
    );
    check(res, { 'search users → 200': (r) => r.status === 200 });
    return res;
}

export function getBoardMembers(token, boardId) {
    const res = http.get(
        `${BASE_URL}/api/boards/${boardId}/members`,
        { headers: authHeaders(token), tags: { name: 'get_members' } }
    );
    check(res, { 'get members → 200': (r) => r.status === 200 });
    return res;
}

export function addBoardMember(token, boardId, userId, role) {
    const res = http.post(
        `${BASE_URL}/api/boards/${boardId}/members`,
        JSON.stringify({ userId, role: role || 'MEMBER' }),
        { headers: authHeaders(token), tags: { name: 'add_member' } }
    );
    check(res, { 'add member → 200': (r) => r.status === 200 });
    return res;
}

export function removeBoardMember(token, boardId, userId) {
    const res = http.del(
        `${BASE_URL}/api/boards/${boardId}/members/${userId}`,
        null,
        { headers: authHeaders(token), tags: { name: 'remove_member' } }
    );
    check(res, { 'remove member → 200': (r) => r.status === 200 });
    return res;
}