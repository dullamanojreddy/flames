/**
 * visitor-telemetry.test.js
 * Comprehensive automated tests for:
 *   - Request IDs
 *   - Anonymous visitor identification and cookies
 *   - Proxy-aware IP extraction
 *   - User-Agent device classification
 *   - Admin authentication & session tokens
 *   - Protected analytics endpoints
 *   - Abuse detection (probes)
 *   - Failure isolation & killswitch
 */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.ADMIN_PASSWORD = "test-admin-secret-password";

const { createApp } = require("../src/app");
const { parseUserAgent } = require("../src/utils/device.utils");
const { cleanIp, anonymizeIp } = require("../src/utils/ip.utils");
const { createAdminSessionToken, verifyAdminSessionToken, verifyAdminPassword } = require("../src/services/admin-auth.service");

let server;
let baseUrl;

async function jsonReq(url, method = "GET", body = null, headers = {}) {
    const opts = {
        method,
        headers: {
            "Content-Type": "application/json",
            ...headers
        }
    };
    if (body) {
        opts.body = JSON.stringify(body);
    }
    return fetch(url, opts);
}

before(async () => {
    const app = createApp();
    server = app.listen(0);
    await new Promise(resolve => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) server.close();
});

// ---------------------------------------------------------------------------
// 1. Request ID & Security Headers
// ---------------------------------------------------------------------------

test("every request receives X-Request-Id header", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const reqId = res.headers.get("x-request-id");
    assert.ok(reqId, "X-Request-Id header must be present");
    assert.match(reqId, /^REQ-[a-zA-Z0-9_-]+$/);
});

test("client-supplied X-Request-Id is respected if valid", async () => {
    const customId = "REQ-client-123456";
    const res = await fetch(`${baseUrl}/api/health`, {
        headers: { "X-Request-Id": customId }
    });
    assert.equal(res.headers.get("x-request-id"), customId);
});

// ---------------------------------------------------------------------------
// 2. Visitor ID & Session ID
// ---------------------------------------------------------------------------

test("first-time visitor receives X-Visitor-Id and X-Session-Id headers", async () => {
    const res = await jsonReq(`${baseUrl}/api/analytics/ping`, "POST", { route: "/" });
    assert.equal(res.status, 200);

    const vid = res.headers.get("x-visitor-id");
    const sid = res.headers.get("x-session-id");

    assert.ok(vid, "visitorId header required");
    assert.ok(sid, "sessionId header required");
    assert.match(vid, /^V-[a-f0-9]+$/);
    assert.match(sid, /^S-[a-f0-9]+$/);
});

test("returning visitor reuses existing visitor ID", async () => {
    const existingVid = "V-72f91c8a4b3d11223344";
    const res = await jsonReq(`${baseUrl}/api/analytics/ping`, "POST", { route: "/flames" }, {
        "X-Visitor-Id": existingVid
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-visitor-id"), existingVid);
});

// ---------------------------------------------------------------------------
// 3. User-Agent & Device Classification
// ---------------------------------------------------------------------------

test("device parser correctly identifies mobile, desktop, and browsers", () => {
    const chromeDesktop = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const parsedDesktop = parseUserAgent(chromeDesktop);
    assert.equal(parsedDesktop.device, "Desktop");
    assert.equal(parsedDesktop.browser, "Google Chrome");
    assert.equal(parsedDesktop.os, "Windows 10/11");

    const iphoneSafari = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const parsedIphone = parseUserAgent(iphoneSafari);
    assert.equal(parsedIphone.device, "Mobile");
    assert.equal(parsedIphone.browser, "Apple Safari");
    assert.equal(parsedIphone.os, "iOS");

    const botUa = "Googlebot/2.1 (+http://www.google.com/bot.html)";
    const parsedBot = parseUserAgent(botUa);
    assert.equal(parsedBot.device, "Bot");
});

// ---------------------------------------------------------------------------
// 4. IP Extraction & Privacy Anonymization
// ---------------------------------------------------------------------------

test("IP utilities correctly clean and anonymize IP addresses", () => {
    assert.equal(cleanIp("::ffff:192.168.1.100"), "192.168.1.100");
    assert.equal(cleanIp("::1"), "127.0.0.1");
    assert.equal(anonymizeIp("192.168.1.123"), "192.168.1.0");
    assert.equal(anonymizeIp("2001:db8:85a3:0:0:8a2e:370:7334"), "2001:db8:85a3::");
});

// ---------------------------------------------------------------------------
// 5. Admin Authentication & Session Security
// ---------------------------------------------------------------------------

test("admin password verification works securely", () => {
    assert.equal(verifyAdminPassword("test-admin-secret-password"), true);
    assert.equal(verifyAdminPassword("wrong-password"), false);
    assert.equal(verifyAdminPassword(""), false);
});

test("admin tokens can be created and verified", () => {
    const { token, expiresAt } = createAdminSessionToken();
    assert.ok(token);
    assert.ok(expiresAt > Date.now());

    const result = verifyAdminSessionToken(token);
    assert.equal(result.valid, true);
    assert.equal(result.payload.role, "admin");

    const fakeResult = verifyAdminSessionToken("fake.token");
    assert.equal(fakeResult.valid, false);
});

test("POST /api/admin/auth/login rejects invalid password with 401", async () => {
    const res = await jsonReq(`${baseUrl}/api/admin/auth/login`, "POST", { password: "incorrect-password" });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error.message, /invalid/i);
});

test("POST /api/admin/auth/login succeeds with valid password and returns token", async () => {
    const res = await jsonReq(`${baseUrl}/api/admin/auth/login`, "POST", { password: "test-admin-secret-password" });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.token, "token must be returned");

    // Verify token with verify endpoint
    const verifyRes = await jsonReq(`${baseUrl}/api/admin/auth/verify`, "GET", null, {
        "Authorization": `Bearer ${body.token}`
    });
    assert.equal(verifyRes.status, 200);
    const verifyBody = await verifyRes.json();
    assert.equal(verifyBody.authenticated, true);
});

test("Protected analytics endpoints require admin authentication", async () => {
    // Unauthenticated -> 401
    const unauthRes = await jsonReq(`${baseUrl}/api/admin/analytics/overview`, "GET");
    assert.equal(unauthRes.status, 401);

    // Authenticated with valid token -> 200
    const { token } = createAdminSessionToken();
    const authRes = await jsonReq(`${baseUrl}/api/admin/analytics/overview`, "GET", null, {
        "Authorization": `Bearer ${token}`
    });
    assert.equal(authRes.status, 200);
    const body = await authRes.json();
    assert.equal(body.success, true);
    assert.ok("activeVisitors" in body.data);
    assert.ok("securityAlerts" in body.data);
});

// ---------------------------------------------------------------------------
// 6. Abuse Detection (Probes & Scanners)
// ---------------------------------------------------------------------------

test("malicious scanner paths (.env, wp-admin) trigger abuse detection 404", async () => {
    const res1 = await fetch(`${baseUrl}/.env`);
    assert.equal(res1.status, 404);
    const body1 = await res1.json();
    assert.equal(body1.success, false);

    const res2 = await fetch(`${baseUrl}/wp-login.php`);
    assert.equal(res2.status, 404);
});

// ---------------------------------------------------------------------------
// 7. Secret Admin Trigger in Calculation
// ---------------------------------------------------------------------------

test("POST /api/flames/calculate with secret admin names returns isAdmin=true and token", async () => {
    const res = await jsonReq(`${baseUrl}/api/flames/calculate`, "POST", {
        name1: "admin",
        name2: "admin1234567890"
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.isAdmin, true);
    assert.ok(body.token, "admin session token should be issued on secret login");
});
