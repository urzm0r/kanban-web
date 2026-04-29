// ============================================================
// k6 — Authentication Tests (Register + Login)
// ============================================================
// Covers: POST /api/auth/register, POST /api/auth/login
// Validates: successful auth, validation errors, duplicate users,
//            wrong credentials, response structure.
// ============================================================
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, HEADERS_JSON, DEFAULT_THRESHOLDS, getStages, handleSummary } from '../config.js';
export { handleSummary };
import { randomEmail, randomName, uniqueId } from '../helpers.js';

// ── Custom metrics ──────────────────────────────────────────
const registerDuration = new Trend('register_duration', true);
const loginDuration = new Trend('login_duration', true);
const authErrors = new Counter('auth_errors');

// ── Options ─────────────────────────────────────────────────
export const options = {
    stages: getStages(),
    thresholds: {
        ...DEFAULT_THRESHOLDS,
        register_duration: ['p(95)<800'],
        login_duration: ['p(95)<400'],
    },
};

// ── Main scenario ───────────────────────────────────────────
export default function () {
    const email = randomEmail();
    const name = randomName();
    const password = 'TestPass123!';

    // ── 1. Register ─────────────────────────────────────────
    group('Register — happy path', () => {
        const res = http.post(
            `${BASE_URL}/api/auth/register`,
            JSON.stringify({ email, password, name }),
            { headers: HEADERS_JSON, tags: { name: 'register' } }
        );
        registerDuration.add(res.timings.duration);

        const ok = check(res, {
            'register → status 200': (r) => r.status === 200,
            'register → has token': (r) => !!r.json('token'),
            'register → user.id exists': (r) => !!r.json('user.id'),
            'register → user.email matches': (r) => r.json('user.email') === email,
            'register → user.name matches': (r) => r.json('user.name') === name,
        });
        if (!ok) authErrors.add(1);
    });

    sleep(0.3);

    // ── 2. Login ────────────────────────────────────────────
    group('Login — happy path', () => {
        const res = http.post(
            `${BASE_URL}/api/auth/login`,
            JSON.stringify({ email, password }),
            { headers: HEADERS_JSON, tags: { name: 'login' } }
        );
        loginDuration.add(res.timings.duration);

        const ok = check(res, {
            'login → status 200': (r) => r.status === 200,
            'login → has token': (r) => !!r.json('token'),
            'login → user.email matches': (r) => r.json('user.email') === email,
        });
        if (!ok) authErrors.add(1);
    });

    sleep(0.3);

    // ── 3. Duplicate registration ───────────────────────────
    group('Register — duplicate user', () => {
        const res = http.post(
            `${BASE_URL}/api/auth/register`,
            JSON.stringify({ email, password, name }),
            { headers: HEADERS_JSON, tags: { name: 'register_dup' } }
        );

        check(res, {
            'duplicate → status 400': (r) => r.status === 400,
            'duplicate → error msg': (r) => r.json('error') === 'Email or name already exists',
        });
    });

    sleep(0.3);

    // ── 4. Login with wrong password ────────────────────────
    group('Login — wrong password', () => {
        const res = http.post(
            `${BASE_URL}/api/auth/login`,
            JSON.stringify({ email, password: 'WrongPassword!' }),
            { headers: HEADERS_JSON, tags: { name: 'login_bad' } }
        );

        check(res, {
            'wrong password → status 401': (r) => r.status === 401,
            'wrong password → error msg': (r) => r.json('error') === 'Invalid credentials',
        });
    });

    sleep(0.3);

    // ── 5. Login with non-existent user ─────────────────────
    group('Login — non-existent user', () => {
        const res = http.post(
            `${BASE_URL}/api/auth/login`,
            JSON.stringify({ email: 'ghost@nowhere.test', password: 'x' }),
            { headers: HEADERS_JSON, tags: { name: 'login_ghost' } }
        );

        check(res, {
            'non-existent → status 401': (r) => r.status === 401,
        });
    });

    sleep(0.3);

    // ── 6. Validation errors ────────────────────────────────
    group('Register — validation errors', () => {
        // Missing name
        const res1 = http.post(
            `${BASE_URL}/api/auth/register`,
            JSON.stringify({ email: 'a@b.c', password: '123456' }),
            { headers: HEADERS_JSON, tags: { name: 'register_invalid' } }
        );
        check(res1, {
            'missing name → 400': (r) => r.status === 400,
        });

        // Short password
        const res2 = http.post(
            `${BASE_URL}/api/auth/register`,
            JSON.stringify({ email: 'a@b.c', password: '12', name: 'x' }),
            { headers: HEADERS_JSON, tags: { name: 'register_invalid' } }
        );
        check(res2, {
            'short password → 400': (r) => r.status === 400,
        });

        // Invalid email
        const res3 = http.post(
            `${BASE_URL}/api/auth/register`,
            JSON.stringify({ email: 'not-an-email', password: '123456', name: 'x' }),
            { headers: HEADERS_JSON, tags: { name: 'register_invalid' } }
        );
        check(res3, {
            'invalid email → 400': (r) => r.status === 400,
        });
    });

    sleep(0.5);
}