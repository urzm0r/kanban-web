// ============================================================
// k6 — Card Management Tests
// ============================================================
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_URL, DEFAULT_THRESHOLDS, getStages } from '../config.js';
import {
    registerUser, randomEmail, randomName, randomBoardTitle,
    randomListTitle, randomCardContent,
    createBoard, createList, createCard, updateCard, deleteCard,
    deleteBoard, authHeaders
} from '../helpers.js';

const cardCreateDur = new Trend('card_create_duration', true);
const cardUpdateDur = new Trend('card_update_duration', true);

export const options = {
    stages: getStages(),
    thresholds: { ...DEFAULT_THRESHOLDS, card_create_duration: ['p(95)<500'] },
};

export default function () {
    const user = registerUser(randomEmail(), 'TestPass123!', randomName());
    if (!user.token) return;

    const boardRes = createBoard(user.token, randomBoardTitle());
    const boardId = boardRes.json('id');
    if (!boardId) return;

    const listRes = createList(user.token, randomListTitle(), boardId);
    const listId = listRes.json('id');
    if (!listId) return;
    sleep(0.3);

    let cardId;
    group('Create card', () => {
        const content = randomCardContent();
        const res = createCard(user.token, content, listId, 'High');
        cardCreateDur.add(res.timings.duration);
        check(res, {
            'create → has id':      (r) => !!r.json('id'),
            'create → content ok':  (r) => r.json('content') === content,
            'create → priority ok': (r) => r.json('priority') === 'High',
            'create → isDone false':(r) => r.json('isDone') === false,
        });
        cardId = res.json('id');
    });
    if (!cardId) return;
    sleep(0.3);

    group('Update card — content + description', () => {
        const res = updateCard(user.token, cardId, { content: 'Updated', description: 'Desc' });
        cardUpdateDur.add(res.timings.duration);
        check(res, {
            'content changed': (r) => r.json('content') === 'Updated',
            'desc set':        (r) => r.json('description') === 'Desc',
        });
    });
    sleep(0.3);

    group('Update card — toggle isDone', () => {
        const res = updateCard(user.token, cardId, { isDone: true });
        check(res, { 'isDone true': (r) => r.json('isDone') === true });
        sleep(0.2);
        const res2 = updateCard(user.token, cardId, { isDone: false });
        check(res2, { 'isDone false': (r) => r.json('isDone') === false });
    });
    sleep(0.3);

    group('Update card — priority + inProgress', () => {
        const res = updateCard(user.token, cardId, { priority: 'Low', inProgress: true });
        check(res, {
            'priority Low':    (r) => r.json('priority') === 'Low',
            'inProgress true': (r) => r.json('inProgress') === true,
        });
    });
    sleep(0.3);

    group('Move card to another list', () => {
        const newList = createList(user.token, randomListTitle(), boardId);
        const newListId = newList.json('id');
        if (!newListId) return;
        const res = updateCard(user.token, cardId, { listId: newListId });
        check(res, { 'moved → new listId': (r) => r.json('listId') === newListId });
    });
    sleep(0.3);

    group('Create card — validation', () => {
        const r1 = http.post(`${BASE_URL}/api/cards`, JSON.stringify({ listId }),
            { headers: authHeaders(user.token) });
        check(r1, { 'missing content → 400': (r) => r.status === 400 });

        const r2 = http.post(`${BASE_URL}/api/cards`, JSON.stringify({ content: 'T' }),
            { headers: authHeaders(user.token) });
        check(r2, { 'missing listId → 400': (r) => r.status === 400 });
    });
    sleep(0.3);

    group('Delete card', () => {
        const res = deleteCard(user.token, cardId);
        check(res, { 'delete → success': (r) => r.json('success') === true });
    });

    deleteBoard(user.token, boardId);
    sleep(0.5);
}
