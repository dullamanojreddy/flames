/**
 * http.test.js
 * HTTP-level tests using the real Express app. These exercise paths that do
 * NOT need a live database (validation, 404, malformed JSON, health, rate
 * limiting), so they run in CI without MongoDB.
 */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";

const { createApp } = require("../src/app");
const { createFlamesRateLimiter } = require("../src/middleware/rate.limiter");

let server;
let baseUrl;

async function jsonPost(url, body) {
    return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
}

function rawPost(url, rawBody) {
    return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawBody
    });
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

test("health endpoint returns running status", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.message, "FLAMES API is running");
    assert.ok("database" in body);
});

test("assert missing/empty names", async () => {
    // Empty name1
    let res = await jsonPost(`${baseUrl}/api/flames/calculate`, { name1: "", name2: "Juliet" });
    assert.equal(res.status, 400);
    let body = await res.json();
    assert.equal(body.success, false);

    // Empty name2
    res = await jsonPost(`${baseUrl}/api/flames/calculate`, { name1: "Romeo", name2: "  " });
    assert.equal(res.status, 400);

    // Both missing
    res = await jsonPost(`${baseUrl}/api/flames/calculate`, {});
    assert.equal(res.status, 400);
    body = await res.json();
    assert.match(body.error.message, /name/i);

    // Non-string fields
    res = await jsonPost(`${baseUrl}/api/flames/calculate`, { name1: 123, name2: "Juliet" });
    assert.equal(res.status, 400);
});

test("reject names longer than 50 characters", async () => {
    const longName = "x".repeat(51);
    const res = await jsonPost(`${baseUrl}/api/flames/calculate`, { name1: longName, name2: "Juliet" });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error.message, /50/);
});

test("reject obvious control characters", async () => {
    const res = await jsonPost(`${baseUrl}/api/flames/calculate`, { name1: "Romeo\u0007", name2: "Juliet" });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error.message, /control/i);
});

test("reject malformed JSON", async () => {
    const res = await rawPost(`${baseUrl}/api/flames/calculate`, '{ "name1": "Romeo", ');
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error.message, /JSON/i);
});

test("unknown route returns 404 JSON", async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
});

test("rate limiting returns 429 when the limit is exceeded", async () => {
    // Build a throwaway app with a tiny limit so we do not exhaust the real one.
    const express = require("express");
    const tiny = express();
    tiny.use(express.json());
    tiny.post("/check", createFlamesRateLimiter({ max: 3, windowMs: 60_000 }), (req, res) =>
        res.json({ ok: true })
    );
    const srv = tiny.listen(0);
    await new Promise(resolve => srv.once("listening", resolve));
    const url = `http://127.0.0.1:${srv.address().port}/check`;

    const codes = [];
    for (let i = 0; i < 5; i++) {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        codes.push(res.status);
    }

    assert.ok(codes.includes(429), `expected a 429 among ${codes.join(",")}`);

    const limited = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const body = await limited.json();
    assert.equal(body.success, false);

    srv.close();
});