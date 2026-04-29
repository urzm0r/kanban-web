export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
export const HEADERS_JSON = { 'Content-Type': 'application/json' };

// Import for HTML reporting (standard k6 community helper)
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

export function authHeaders(token) {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

export const DEFAULT_THRESHOLDS = {
    http_req_failed: ['rate<0.05'], 
    http_req_duration: ['p(95)<500'], 
    checks: ['rate>0.95'] 
};

export function getStages() {
    const profile = __ENV.TEST_PROFILE || 'smoke';
    switch (profile) {
        case 'load':
            return [
                { duration: '30s', target: 10 },
                { duration: '1m', target: 10 },
                { duration: '30s', target: 0 },
            ];
        case 'stress':
            return [
                { duration: '30s', target: 10 },
                { duration: '1m', target: 50 },
                { duration: '30s', target: 0 },
            ];
        case 'spike':
            return [
                { duration: '10s', target: 100 },
                { duration: '30s', target: 100 },
                { duration: '10s', target: 0 },
            ];
        case 'smoke':
        default:
            return [{ duration: '30s', target: 1 }];
    }
}

/**
 * Common summary handler to generate HTML and Console reports
 */
export function handleSummary(data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportName = `k6/results/report_${timestamp}.html`;
    
    console.log(`\nGenerating HTML report: ${reportName}`);
    
    return {
        [reportName]: htmlReport(data),
        stdout: textSummary(data, { indent: " ", enableColors: true }),
    };
}
