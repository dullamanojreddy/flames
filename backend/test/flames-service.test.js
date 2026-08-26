/**
 * flames-service.test.js
 * Unit + logic tests for the FLAMES service layer. These do NOT require a
 * live MongoDB — persistence/attempt logic is exercised with the in-memory
 * FakeFlamesModel so the suite runs anywhere in CI.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");

const service = require("../src/services/flames.service");
const { FakeFlamesModel } = require("./helpers/fake-flames");

const RESULT_WORDS = ["Friends", "Lovers", "Affection", "Marriage", "Enemies", "Siblings"];

// ---------------------------------------------------------------------------
// Pure calculation helpers
// ---------------------------------------------------------------------------

test("normal FLAMES calculation returns a valid letter", () => {
    const letter = service.calculateFlames("Romeo", "Juliet");
    assert.ok(["F", "L", "A", "M", "E", "S"].includes(letter), `got ${letter}`);
    assert.ok(RESULT_WORDS.includes(service.RESULT_MAP[letter]));
});

test("FLAMES result is stable across order (order-insensitive)", () => {
    assert.equal(
        service.calculateFlames("Romeo", "Juliet"),
        service.calculateFlames("Juliet", "Romeo")
    );
});

test("FLAMES is case-insensitive", () => {
    assert.equal(
        service.calculateFlames("roMEO", "juLIet"),
        service.calculateFlames("Romeo", "Juliet")
    );
});

test("same names still produce a valid result", () => {
    const letter = service.calculateFlames("Romeo", "Romeo");
    assert.ok(["F", "L", "A", "M", "E", "S"].includes(letter));
});

test("empty names behave like the frontend (no crash, valid letter)", () => {
    const letter = service.calculateFlames("", "");
    assert.ok(["F", "L", "A", "M", "E", "S"].includes(letter));
});

test("non-alphabetic characters are stripped", () => {
    assert.equal(
        service.calculateFlames("Romeo-123!", "Juliet 7"),
        service.calculateFlames("Romeo", "Juliet")
    );
});

// ---------------------------------------------------------------------------
// Compatibility percentage
// ---------------------------------------------------------------------------

test("percentage is always within [35, 99]", () => {
    const pairs = [
        ["Romeo", "Juliet"],
        ["a", "b"],
        ["z", "a"],
        ["verylongnameone", "verylongnametwo"],
        ["", ""]
    ];
    for (const [n1, n2] of pairs) {
        const letter = service.calculateFlames(n1, n2);
        const pct = service.calculateCompatibility(n1, n2, letter);
        assert.ok(pct >= 35 && pct <= 99, `${n1}+${n2} -> ${pct}`);
        assert.equal(Number.isInteger(pct), true);
    }
});

test("compatibility matches the frontend combined-hash algorithm", () => {
    // The percentage derives from name1+name2 concatenated in order, exactly
    // like the frontend. We assert the formula behaviour rather than order
    // invariance (the hash is intentionally order-sensitive by design).
    const n1 = "Romeo";
    const n2 = "Juliet";
    const letter = service.calculateFlames(n1, n2);
    const combined = (n1.toLowerCase() + n2.toLowerCase());
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        hash = ((hash << 5) - hash) + combined.charCodeAt(i);
        hash |= 0;
    }
    const base = Math.abs(hash) % 41 + 55;
    const bonus = { F: 4, L: 9, A: 7, M: 10, E: -15, S: 2 };
    const expected = Math.min(99, Math.max(35, base + bonus[letter]));

    assert.equal(service.calculateCompatibility(n1, n2, letter), expected);
});

test("result enum vocabulary is complete", () => {
    assert.deepEqual(
        Object.keys(service.RESULT_MAP).sort(),
        ["A", "E", "F", "L", "M", "S"]
    );
    assert.deepEqual(
        Object.values(service.RESULT_MAP).sort(),
        [...RESULT_WORDS].sort()
    );
});
// ---------------------------------------------------------------------------
// normalizedPair identity
// ---------------------------------------------------------------------------

test("normalizedPair is case-insensitive", () => {
    assert.equal(
        service.createNormalizedPair("Romeo", "Juliet"),
        service.createNormalizedPair("ROMEO", "juliet")
    );
});

test("normalizedPair is order-insensitive", () => {
    assert.equal(
        service.createNormalizedPair("Romeo", "Juliet"),
        service.createNormalizedPair("Juliet", "Romeo")
    );
});

// ---------------------------------------------------------------------------
// Persistence + attempt logic (in-memory model)
// ---------------------------------------------------------------------------

test("first attempt creates exactly one document with attempts = 1", async () => {
    const model = new FakeFlamesModel();
    const data = await service.persistFlamesResult(
        { name1: "Romeo", name2: "Juliet" },
        { flamesModel: model }
    );

    assert.equal(model.count(), 1);
    assert.equal(data.attempts, 1);
    assert.equal(data.name1, "Romeo");
    assert.equal(data.name2, "Juliet");
    assert.ok(RESULT_WORDS.includes(data.result));
});

test("second and third attempts increment attempts, no duplicate document", async () => {
    const model = new FakeFlamesModel();

    await service.persistFlamesResult({ name1: "Romeo", name2: "Juliet" }, { flamesModel: model });
    const second = await service.persistFlamesResult({ name1: "Romeo", name2: "Juliet" }, { flamesModel: model });
    const third = await service.persistFlamesResult({ name1: "Romeo", name2: "Juliet" }, { flamesModel: model });

    assert.equal(model.count(), 1, "only ONE document should exist for the pair");
    assert.equal(second.attempts, 2);
    assert.equal(third.attempts, 3);
});

test("case changes still map to the same record (attempts increment)", async () => {
    const model = new FakeFlamesModel();

    await service.persistFlamesResult({ name1: "Romeo", name2: "Juliet" }, { flamesModel: model });
    const again = await service.persistFlamesResult({ name1: "ROMEO", name2: "JULIET" }, { flamesModel: model });

    assert.equal(model.count(), 1);
    assert.equal(again.attempts, 2);
    assert.equal(again.name1, "ROMEO", "latest display version is preserved");
});

test("reversed pair is the same database relationship record", async () => {
    const model = new FakeFlamesModel();

    await service.persistFlamesResult({ name1: "Romeo", name2: "Juliet" }, { flamesModel: model });
    const reversed = await service.persistFlamesResult({ name1: "Juliet", name2: "Romeo" }, { flamesModel: model });

    assert.equal(model.count(), 1, "A+B and B+A must be the same record");
    assert.equal(reversed.attempts, 2);
});

test("result and percentage fields respect the enum/range shape", async () => {
    const model = new FakeFlamesModel();
    const data = await service.persistFlamesResult({ name1: "Romeo", name2: "Juliet" }, { flamesModel: model });

    assert.ok(RESULT_WORDS.includes(data.result));
    assert.ok(data.percentage >= 35 && data.percentage <= 99);
    assert.ok(data.date, "date is present");
    assert.ok(data.day, "day is present");
    assert.equal(typeof data.year, "number");
});

test("duplicate-key race is absorbed into an atomic attempt increment", async () => {
    const model = new FakeFlamesModel();

    // Force the next create to collide (two clients try to create the same
    // new pair at once). The winner already saved attempts=1.
    model.forceCreateOnce = true;

    const data = await service.persistFlamesResult({ name1: "Romeo", name2: "Juliet" }, { flamesModel: model });

    assert.equal(model.count(), 1, "race must still leave only one document");
    assert.equal(data.attempts, 2, "loser is converted into an atomic +1");
});

test("serialized response never exposes internal key or _id", async () => {
    const model = new FakeFlamesModel();
    const data = await service.persistFlamesResult({ name1: "Romeo", name2: "Juliet" }, { flamesModel: model });

    assert.ok(!("normalizedPair" in data), "must not leak normalizedPair");
    assert.ok(!("_id" in data), "must not leak _id");
});

test("date utils produce DD-MM-YYYY, weekday name and numeric year", () => {
    const { getCurrentDateDetails } = require("../src/utils/date.utils");
    const fixed = new Date(Date.UTC(2026, 7, 25, 12, 0, 0)); // 25 Aug 2026
    const details = getCurrentDateDetails(fixed, "UTC");
    assert.match(details.date, /^\d{2}-\d{2}-\d{4}$/);
    assert.equal(details.date, "25-08-2026");
    assert.equal(details.year, 2026);
    assert.equal(details.day, "Tuesday");
    assert.ok(details.timestamp instanceof Date);
});