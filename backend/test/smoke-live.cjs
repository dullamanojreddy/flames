// Live API smoke test against the running backend (runs after server starts).
(async () => {
    const base = "http://localhost:5000/api";
    const post = async (body) => {
        const res = await fetch(`${base}/flames/calculate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        return { status: res.status, body: await res.json() };
    };

    const cases = [
        ["empty name1", { name1: "", name2: "Juliet" }, 400],
        ["empty name2", { name1: "Romeo", name2: "   " }, 400],
        ["both missing", {}, 400],
        ["long name (>50)", { name1: "x".repeat(51), name2: "Juliet" }, 400],
        ["non-string", { name1: 123, name2: "Juliet" }, 400]
    ];

    let allOk = true;
    for (const [label, body, expected] of cases) {
        const { status, body: parsed } = await post(body);
        const ok = status === expected;
        if (!ok) allOk = false;
        console.log(`${ok ? "PASS" : "FAIL"} ${label}: got ${status}, expected ${expected} -> ${parsed.error?.message || JSON.stringify(parsed)}`);
    }

    // malformed JSON
    const raw = await fetch(`${base}/flames/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ bad json"
    });
    console.log(`${raw.status === 400 ? "PASS" : "FAIL"} malformed JSON: got ${raw.status}`);
    if (raw.status !== 400) allOk = false;

    // unknown route
    const noRoute = await fetch(`${base}/does-not-exist`);
    console.log(`${noRoute.status === 404 ? "PASS" : "FAIL"} unknown route: got ${noRoute.status}`);
    if (noRoute.status !== 404) allOk = false;

    // health
    const health = await fetch(`${base}/health`);
    const hJson = await health.json();
    console.log(`${health.status === 200 && hJson.success ? "PASS" : "FAIL"} health endpoint`);
    if (!(health.status === 200 && hJson.success)) allOk = false;

    console.log(allOk ? "LIVE-SMOKE: ALL OK" : "LIVE-SMOKE: FAILURES PRESENT");
    process.exit(allOk ? 0 : 1);
})();