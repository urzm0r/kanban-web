// ============================================================
// k6 — Tags & Users Tests
// ============================================================
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { DEFAULT_THRESHOLDS, getStages } from '../config.js';
import {
    registerUser, randomEmail, randomName, randomTagName,
    getTags, createTag, searchUsers
} from '../helpers.js';

export const options = {
    stages: getStages(),
    thresholds: DEFAULT_THRESHOLDS,
};

export default function () {
    const user = registerUser(randomEmail(), 'TestPass123!', randomName());
    if (!user.token) return;
    sleep(0.3);

    // ── Tags ────────────────────────────────────────────────
    group('Create tag', () => {
        const name = randomTagName();
        const res = createTag(user.token, name, '#ff5733');
        check(res, {
            'tag → has id':   (r) => !!r.json('id'),
            'tag → name ok':  (r) => r.json('name') === name,
            'tag → color ok': (r) => r.json('color') === '#ff5733',
        });
    });
    sleep(0.3);

    group('Create tag — no color', () => {
        const name = randomTagName();
        const res = createTag(user.token, name);
        check(res, {
            'tag no color → 200':    (r) => r.status === 200,
            'tag no color → null':   (r) => r.json('color') === null,
        });
    });
    sleep(0.3);

    group('Create tag — upsert duplicate', () => {
        const name = randomTagName();
        createTag(user.token, name, '#aaa');
        sleep(0.2);
        const res = createTag(user.token, name, '#bbb');
        check(res, {
            'upsert → 200':          (r) => r.status === 200,
            'upsert → color unchanged': (r) => r.json('color') === '#aaa',
        });
    });
    sleep(0.3);

    group('Get tags', () => {
        const res = getTags(user.token);
        check(res, {
            'get tags → is array': (r) => Array.isArray(r.json()),
        });
    });
    sleep(0.3);

    // ── User search ─────────────────────────────────────────
    group('Search users — by name', () => {
        // Register a second user to search for
        const target = registerUser(randomEmail(), 'TestPass123!', `searchable_${randomTagName()}`);
        if (!target.token) return;
        sleep(0.2);

        const res = searchUsers(user.token, 'searchable');
        check(res, {
            'search → is array': (r) => Array.isArray(r.json()),
        });
    });
    sleep(0.3);

    group('Search users — short query returns empty', () => {
        const res = searchUsers(user.token, 'a');
        check(res, {
            'short query → empty': (r) => Array.isArray(r.json()) && r.json().length === 0,
        });
    });
    sleep(0.3);

    group('Search users — excludes self', () => {
        const res = searchUsers(user.token, user.user.name);
        check(res, {
            'self excluded': (r) => !r.json().some((u) => u.id === user.user.id),
        });
    });

    sleep(0.5);
}
