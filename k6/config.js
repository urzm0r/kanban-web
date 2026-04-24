// ============================================================
// k6 — Shared Configuration
// ============================================================
// Centralizes base URL, default headers, and reusable helpers
// so every test script stays DRY.
// ============================================================

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export const HEADERS_JSON = {
    'Content-Type': 'application/json',
};

/**
 * Returns an Authorization header merged with JSON content-type.
 * @param {string} token – JWT bearer token
 */
export function authHeaders(token) {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    };
}

// ── Default thresholds applied across all test scripts ──────
export const DEFAULT_THRESHOLDS = {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.95'],
};

// ── Reusable stage profiles ────────────────────────────────
export const STAGES = {
    smoke: [
        { duration: '30s', target: 1 },
    ],
    load: [
        { duration: '30s', target: 10 },
        { duration: '1m',  target: 10 },
        { duration: '30s', target: 0 },
    ],
    stress: [
        { duration: '30s', target: 20 },
        { duration: '1m',  target: 50 },
        { duration: '30s', target: 100 },
        { duration: '1m',  target: 100 },
        { duration: '1m',  target: 0 },
    ],
    spike: [
        { duration: '10s', target: 5 },
        { duration: '5s',  target: 100 },
        { duration: '30s', target: 100 },
        { duration: '10s', target: 0 },
    ],
};

/**
 * Picks a stage profile based on the TEST_PROFILE env var.
 * Usage: `k6 run -e TEST_PROFILE=stress script.js`
 */
export function getStages() {
    const profile = __ENV.TEST_PROFILE || 'smoke';
    return STAGES[profile] || STAGES.smoke;
}
