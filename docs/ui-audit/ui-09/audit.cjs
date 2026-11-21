// UI-09 audit against the local fixture (127.0.0.1:8041). Loopback only.
// Run: start scripts/preview_fixture.py --quota-demo, then
//   PW=<path to node_modules/playwright> OUT=<dir> node audit.cjs
// Needs Google Chrome (channel "chrome"). Requests off loopback are aborted.
// Writes to the fixture DB (one topic and vote); use a fresh fixture each run.
const { chromium } = require(process.env.PW || "playwright");
const fs = require("fs");
const path = require("path");
const BASE = "http://127.0.0.1:8041";
const OUT = process.env.OUT || "ui-09-out";
const results = [];
const log = (area, name, ok, detail = "") => {
  results.push({ area, name, ok, detail });
  console.log(
    `${ok ? "PASS" : "FAIL"} [${area}] ${name}${detail ? " — " + detail : ""}`,
  );
};
const external = [];
async function ctxFor(browser, opts = {}) {
  const ctx = await browser.newContext({ ...opts });
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(u.hostname))
      return route.continue();
    external.push(u.href);
    return route.abort();
  });
  return ctx;
}
const ROUTES = [
  "/",
  "/reports/local-fixture",
  "/community",
  "/library",
  "/forum",
  "/portfolio",
  "/methodology",
  "/admin",
];
async function layoutCheck(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth - doc.clientWidth;
    const small = [];
    document
      .querySelectorAll(
        "a[href],button,input,select,textarea,summary,[tabindex='0']",
      )
      .forEach((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (
          !r.width ||
          s.visibility === "hidden" ||
          el.closest("[hidden],dialog:not([open])")
        )
          return;
        if (el.matches("input[type=checkbox]")) return; // label is the target
        const inline =
          el.matches("a") &&
          s.display === "inline" &&
          el.closest("p,li,td,dd,figcaption,.contribution-meta");
        if (inline) return; // inline text links: WCAG 2.5.8 inline exception
        if (el.matches("pre,[role=region]")) return;
        if (r.height < 44 && !el.matches(".skip"))
          small.push(
            `${el.tagName.toLowerCase()}:${(el.textContent || el.getAttribute("aria-label") || el.id).trim().slice(0, 30)}(${Math.round(r.width)}×${Math.round(r.height)})`,
          );
      });
    const unnamed = [
      ...document.querySelectorAll("button,a[href],input,textarea,select"),
    ]
      .filter((el) => {
        if (el.closest("dialog:not([open])") || el.type === "hidden")
          return false;
        const name =
          el.getAttribute("aria-label") ||
          el.textContent.trim() ||
          (el.id && document.querySelector(`label[for="${el.id}"]`)) ||
          el.getAttribute("aria-labelledby") ||
          el.closest("label");
        return !name;
      })
      .map((el) => el.outerHTML.slice(0, 80));
    const h1 = document.querySelectorAll("#view h1").length;
    // Body text size (paragraph) and smallest visible text
    let minFont = 99,
      minEl = "";
    document.querySelectorAll("#view *").forEach((el) => {
      if (
        !el.childNodes.length ||
        ![...el.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent.trim(),
        )
      )
        return;
      const r = el.getBoundingClientRect();
      if (!r.width || el.closest(".visually-hidden,[aria-hidden=true]")) return;
      const f = parseFloat(getComputedStyle(el).fontSize);
      if (f < minFont) {
        minFont = f;
        minEl = el.className || el.tagName;
      }
    });
    return { overflow, small, unnamed, h1, minFont, minEl };
  });
}
async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  fs.mkdirSync(OUT, { recursive: true });
  // 1. Route × viewport layout matrix
  const sizes = [
    [320, 640],
    [390, 844],
    [768, 1024],
    [1440, 900],
  ];
  for (const [w, h] of sizes) {
    const ctx = await ctxFor(browser, { viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    for (const r of ROUTES) {
      await page.goto(BASE + r);
      await page.waitForSelector("#view h1");
      await page.waitForTimeout(150);
      const c = await layoutCheck(page);
      const ok =
        c.overflow <= 0 &&
        c.small.length === 0 &&
        c.unnamed.length === 0 &&
        c.h1 === 1 &&
        c.minFont >= 14;
      log("layout", `${r} @${w}`, ok, ok ? "" : JSON.stringify(c));
      if (
        [390, 768, 1440].includes(w) &&
        ["/", "/reports/local-fixture", "/community"].includes(r)
      )
        await page.screenshot({
          path: path.join(
            OUT,
            `${r === "/" ? "home" : r.split("/")[1]}-${w}.png`,
          ),
          fullPage: false,
        });
    }
    // dialog screenshot
    if ([390, 768, 1440].includes(w)) {
      await page.goto(BASE + "/reports/local-fixture");
      await page.click("#fix-plan");
      await page.waitForSelector("#plan-text");
      const d = await page.evaluate(() => {
        const m = document.querySelector("#modal");
        return {
          sw: m.scrollWidth,
          cw: m.clientWidth,
          doc:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        };
      });
      log(
        "layout",
        `plan dialog @${w}`,
        d.sw <= d.cw && d.doc <= 0,
        JSON.stringify(d),
      );
      await page.screenshot({ path: path.join(OUT, `dialog-${w}.png`) });
    }
    await ctx.close();
  }
  // 2. Zoom: 200% of 1440×900 = 720×450 CSS px; 400% of 1280 = 320×256
  for (const [w, h, label] of [
    [720, 450, "200% zoom (1440×900)"],
    [320, 256, "400% zoom (1280×1024)"],
  ]) {
    const ctx = await ctxFor(browser, { viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    for (const r of ROUTES) {
      await page.goto(BASE + r);
      await page.waitForSelector("#view h1");
      const c = await layoutCheck(page);
      log("zoom", `${r} ${label}`, c.overflow <= 0, `overflow ${c.overflow}`);
    }
    await ctx.close();
  }
  // 3. Code-only local overflow + states via stubbed report responses
  {
    const ctx = await ctxFor(browser, {
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    const base = await (
      await page.request.get(BASE + "/api/reports/local-fixture")
    ).json();
    const variants = {
      longline: () => {
        const r = structuredClone(base);
        r.findings[0].path =
          "src/" +
          "very_long_directory_name/".repeat(6) +
          "module_with_a_long_name.py";
        r.findings[0].evidence =
          "x = " + "'a_very_long_string_without_breaks'".repeat(12);
        r.findings[0].end = r.findings[0].start;
        return r;
      },
      empty: () => ({ ...structuredClone(base), findings: [] }),
      partial: () => {
        const r = structuredClone(base);
        r.coverage.partial = true;
        r.coverage.eligible = 40;
        r.coverage.reasons.push("Size budget reached.");
        return r;
      },
      insufficient: () => {
        const r = structuredClone(base);
        r.score = null;
        r.findings = [];
        r.coverage.inspected = 0;
        return r;
      },
      unknowntotal: () => {
        const r = structuredClone(base);
        r.coverage.eligible = null;
        return r;
      },
      reviewed: () => {
        const r = structuredClone(base);
        r.ai = {
          score: 42,
          status: "complete",
          uncertainty: "Model judgment, bounded excerpt.",
        };
        return r;
      },
    };
    for (const [name, make] of Object.entries(variants)) {
      await page.route(`**/api/reports/state-${name}`, (route) =>
        route.fulfill({ json: { ...make(), id: `state-${name}` } }),
      );
      await page.goto(`${BASE}/reports/state-${name}`);
      await page.waitForSelector("#view h1");
      const info = await page.evaluate(() => {
        const pre = document.querySelector("pre.evidence");
        return {
          doc:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
          preScroll: pre ? pre.scrollWidth > pre.clientWidth : null,
          text: document.querySelector("#view").innerText.slice(0, 2000),
          fixDisabled: document.querySelector("#fix-plan").disabled,
        };
      });
      if (name === "longline")
        log(
          "states",
          "long evidence line scrolls inside code only",
          info.doc <= 0 && info.preScroll,
          JSON.stringify({ doc: info.doc, pre: info.preScroll }),
        );
      if (name === "empty")
        log(
          "states",
          "empty findings honest + export disabled",
          /No supported findings/.test(info.text) &&
            info.fixDisabled &&
            /Nothing to export/.test(info.text),
        );
      if (name === "partial")
        log(
          "states",
          "partial coverage labelled",
          /1 of 40 eligible files inspected \(partial coverage\)/.test(
            info.text,
          ),
        );
      if (name === "insufficient")
        log(
          "states",
          "insufficient coverage shows — and label",
          /Insufficient coverage/.test(info.text) && /—/.test(info.text),
        );
      if (name === "unknowntotal")
        log(
          "states",
          "unknown eligible total",
          /eligible total unknown/.test(info.text),
        );
      if (name === "reviewed")
        log(
          "states",
          "model-reviewed score + label, independent of deterministic",
          /42/.test(info.text) && /Model judgment/.test(info.text),
        );
      if (name === "longline")
        await page.screenshot({
          path: path.join(OUT, "state-longline-390.png"),
        });
      log(
        "layout",
        `state ${name} no overflow @390`,
        info.doc <= 0,
        `doc ${info.doc}`,
      );
    }
    // not reviewed (fixture default)
    await page.goto(BASE + "/reports/local-fixture");
    await page.waitForSelector("#view h1");
    log(
      "states",
      "not reviewed label",
      /Not reviewed/.test(await page.innerText("#view")),
    );
    // missing report
    await page.goto(BASE + "/reports/does-not-exist");
    await page.waitForSelector("#view h1");
    const missing = await page.innerText("#view");
    log(
      "states",
      "missing report error page",
      /That didn’t load/.test(missing),
      missing.slice(0, 120),
    );
    await page.screenshot({ path: path.join(OUT, "state-missing-390.png") });
    // network failure for report
    await page.route("**/api/reports/net-down", (route) => route.abort());
    await page.goto(BASE + "/reports/net-down");
    await page.waitForSelector("#view h1");
    log(
      "states",
      "network failure readable",
      /Couldn’t reach Slop Guard/.test(await page.innerText("#view")),
    );
    // loading state: delayed report
    await page.route("**/api/reports/slow", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      route.fulfill({ json: { ...base, id: "slow" } });
    });
    const nav = page.goto(BASE + "/reports/slow");
    await page.waitForTimeout(700);
    const loading = await page.evaluate(() => ({
      text: document.querySelector("#view").innerText,
      busy: document.querySelector("#main").getAttribute("aria-busy"),
    }));
    log(
      "states",
      "report loading state visible",
      loading.text.trim().length > 0,
      JSON.stringify(loading).slice(0, 160),
    );
    await nav;
    await page.waitForSelector("#view h1");
    // community empty/error lists
    await page.route("**/api/content?kind=project*", (route) =>
      route.fulfill({ status: 503, json: { detail: "Service unavailable." } }),
    );
    await page.goto(BASE + "/community");
    await page.waitForSelector("#view h1");
    log(
      "states",
      "community unavailable state",
      /That didn’t load/.test(await page.innerText("#view")),
    );
    await ctx.close();
  }
  // 4. Quota states on home + report
  {
    const ctx = await ctxFor(browser, {
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    for (const state of [
      "available",
      "cooldown",
      "exhausted",
      "unknown",
      "disabled",
    ]) {
      await page.request.post(`${BASE}/api/fixture/quota/${state}`);
      await page.goto(BASE + "/");
      await page.waitForFunction(
        () =>
          document.querySelector("#ai-availability")?.textContent.length > 0,
      );
      await page.waitForTimeout(200);
      const s = await page.evaluate(() => ({
        disabled: document.querySelector("#include-ai").disabled,
        checked: document.querySelector("#include-ai").checked,
        text: document.querySelector("#ai-availability").textContent,
        grade: document.querySelector("#grade").disabled,
      }));
      const ok =
        state === "available"
          ? !s.disabled
          : s.disabled &&
            !s.checked &&
            /Deterministic scanning is available/.test(s.text) &&
            !s.grade;
      log("quota", `home ${state}`, ok, JSON.stringify(s));
      await page.goto(BASE + "/reports/local-fixture");
      await page.waitForSelector("#quota-line");
      const q = await page.evaluate(() => {
        const box = document
          .querySelector("#quota-line")
          .closest(".score-block");
        return {
          inBox: box.querySelector("h2").textContent,
          text: document.querySelector("#quota-line").textContent,
        };
      });
      log(
        "quota",
        `report ${state}: quota under Probabilistic AI Slop`,
        q.inBox === "Probabilistic AI Slop" && q.text.length > 0,
        q.text,
      );
    }
    await page.request.post(`${BASE}/api/fixture/quota/available`);
    await ctx.close();
  }
  // 5. Keyboard
  {
    const ctx = await ctxFor(browser, {
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    await page.goto(BASE + "/");
    await page.waitForSelector("#view h1");
    await page.keyboard.press("Tab");
    log(
      "keyboard",
      "first Tab reaches skip link",
      await page.evaluate(() => document.activeElement.className === "skip"),
    );
    await page.keyboard.press("Enter");
    log(
      "keyboard",
      "skip link moves focus to main",
      await page.evaluate(() => document.activeElement.id === "main"),
    );
    await page.focus("#menu-toggle");
    await page.keyboard.press("Enter");
    log(
      "keyboard",
      "menu opens with Enter",
      (await page.getAttribute("#menu-toggle", "aria-expanded")) === "true",
    );
    await page.keyboard.press("Tab");
    const firstNav = await page.evaluate(
      () => document.activeElement.closest(".site-nav") != null,
    );
    log("keyboard", "Tab from Menu enters nav", firstNav);
    await page.keyboard.press("Escape");
    log(
      "keyboard",
      "Escape closes menu, focus on Menu",
      await page.evaluate(
        () =>
          document.activeElement.id === "menu-toggle" &&
          document
            .querySelector("#menu-toggle")
            .getAttribute("aria-expanded") === "false",
      ),
    );
    // navigate via keyboard to Community
    await page.keyboard.press("Enter");
    await page.focus('.site-nav a[href="/community"]');
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () =>
        location.pathname === "/community" &&
        document.activeElement.tagName === "H1",
    );
    log(
      "keyboard",
      "route change focuses h1, sets aria-current and title",
      await page.evaluate(
        () =>
          document
            .querySelector('.site-nav a[href="/community"]')
            .getAttribute("aria-current") === "page" &&
          document.title.startsWith("Community Slop"),
      ),
    );
    // report: finding disclosure + tone via keyboard
    await page.goto(BASE + "/reports/local-fixture");
    await page.waitForSelector("#view h1");
    const more = page.locator("details.more-actions summary").first();
    await more.focus();
    await page.keyboard.press("Enter");
    log(
      "keyboard",
      "finding More disclosure opens with Enter",
      await page.evaluate(
        () => document.querySelector("details.more-actions").open,
      ),
    );
    await page.focus('#view [data-mode="satirical"]');
    await page.keyboard.press("Enter");
    const tone = await page.evaluate(() => ({
      focus: document.activeElement.dataset.mode,
      open: document.querySelector("details.more-actions").open,
      pressed: document
        .querySelector('[data-mode="satirical"]')
        .getAttribute("aria-pressed"),
    }));
    log(
      "keyboard",
      "tone switch keeps focus, disclosure and aria-pressed",
      tone.focus === "satirical" && tone.open && tone.pressed === "true",
      JSON.stringify(tone),
    );
    await page.focus('#view [data-mode="serious"]');
    await page.keyboard.press("Enter");
    // dialog
    await page.focus("#fix-plan");
    await page.keyboard.press("Enter");
    await page.waitForSelector("#plan-text");
    const dlg = await page.evaluate(() => ({
      focus: document.activeElement.id,
      name:
        document.querySelector("#modal").getAttribute("aria-labelledby") &&
        document.querySelector("#modal-label").textContent,
    }));
    log(
      "keyboard",
      "plan dialog named, focus on Copy",
      dlg.focus === "copy-plan" && dlg.name === "Fix My AI Slop",
      JSON.stringify(dlg),
    );
    // Tab cycling stays within dialog for a few presses
    let escaped = false;
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(
        () =>
          !!document.activeElement.closest("dialog") ||
          document.activeElement === document.body,
      );
      if (!inside) escaped = true;
    }
    log("keyboard", "Tab stays in modal dialog", !escaped);
    await page.keyboard.press("Escape");
    log(
      "keyboard",
      "Escape closes dialog, focus returns to Fix My AI Slop",
      await page.evaluate(
        () =>
          !document.querySelector("#modal").open &&
          document.activeElement.id === "fix-plan",
      ),
    );
    // form errors (contribution) via keyboard
    await page.focus("[data-discuss]");
    await page.keyboard.press("Enter");
    await page.waitForSelector("#contribution-form");
    await page.fill("#entry-title", "");
    await page.fill("#entry-body", "");
    await page.focus("#contribution-form button[type=submit]");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    const err = await page.evaluate(() => ({
      focus: document.activeElement.id,
      invalid: document
        .querySelector("#entry-title")
        .getAttribute("aria-invalid"),
      described: document
        .querySelector("#entry-title")
        .getAttribute("aria-describedby"),
    }));
    log(
      "keyboard",
      "form errors linked and first invalid field focused",
      err.focus === "entry-title" &&
        err.invalid === "true" &&
        /entry-title-error/.test(err.described),
      JSON.stringify(err),
    );
    await page.keyboard.press("Escape");
    // Votes via keyboard on community (needs an item) — done in journey section.
    // Focus visible: outline width on a focused button
    await page.focus("#fix-plan");
    const outline = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement);
      return s.outlineStyle + " " + s.outlineWidth;
    });
    log(
      "keyboard",
      "visible focus indicator",
      !/none|0px/.test(outline),
      outline,
    );
    await ctx.close();
  }
  // 6. Accessibility tree (programmatic, not a screen reader)
  {
    const ctx = await ctxFor(browser, {
      viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();
    for (const r of ROUTES) {
      await page.goto(BASE + r);
      await page.waitForSelector("#view h1");
      const snap = await page.locator("body").ariaSnapshot();
      fs.writeFileSync(
        path.join(
          OUT,
          `aria${r === "/" ? "-home" : r.replace(/\//g, "-")}.yml`,
        ),
        snap,
      );
      const landmarks = ["banner", "navigation", "main", "contentinfo"].every(
        (l) => snap.includes(`- ${l}`),
      );
      const order = await page.evaluate(() => {
        const hs = [
          ...document.querySelectorAll("#view h1,#view h2,#view h3,#view h4"),
        ].map((h) => +h.tagName[1]);
        let prev = 1,
          ok = true;
        for (const l of hs) {
          if (l > prev + 1) ok = false;
          prev = l;
        }
        return ok;
      });
      log(
        "a11y-tree",
        `${r} landmarks + heading order`,
        landmarks && order,
        landmarks ? "" : "missing landmark",
      );
    }
    await ctx.close();
  }
  // 7. Reduced motion + forced colors
  {
    const ctx = await ctxFor(browser, {
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.goto(BASE + "/reports/local-fixture");
    await page.waitForSelector("#view h1");
    await page.click('#view [data-mode="satirical"]');
    const anims = await page.evaluate(() => document.getAnimations().length);
    log(
      "motion",
      "reduced motion: tone switch runs no animation",
      anims === 0,
      `animations ${anims}`,
    );
    await page.click('#view [data-mode="serious"]');
    await page.emulateMedia({ forcedColors: "active" });
    await page.click("#fix-plan");
    await page.waitForSelector("#plan-text");
    await page.screenshot({
      path: path.join(OUT, "forced-colors-dialog-390.png"),
    });
    await page.keyboard.press("Escape");
    // UI-08 states under forced colors: contribution form errors
    await page.click("[data-discuss]");
    await page.fill("#entry-title", "");
    await page.fill("#entry-body", "");
    await page.click("#contribution-form button[type=submit]");
    await page.waitForTimeout(100);
    const fc = await page.evaluate(() => {
      const e = document.querySelector(".field-error");
      const i = document.querySelector("#entry-title");
      return {
        errText: e?.textContent,
        inputBorder: getComputedStyle(i).borderStyle,
      };
    });
    log(
      "forced-colors",
      "form error text present and input bordered",
      !!fc.errText && fc.inputBorder !== "none",
      JSON.stringify(fc),
    );
    await page.screenshot({
      path: path.join(OUT, "forced-colors-form-errors-390.png"),
    });
    await ctx.close();
  }
  // 8. Journey: scan → evidence → tone → deep link → copy/download → evidence-attached topic
  {
    const ctx = await ctxFor(browser, {
      viewport: { width: 1440, height: 900 },
    });
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: BASE,
    });
    const page = await ctx.newPage();
    const calls = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith("/api/"))
        calls.push(r.method() + " " + u.pathname + u.search);
    });
    const fixture = await (
      await page.request.get(BASE + "/api/reports/local-fixture")
    ).json();
    let scanCalls = 0;
    await page.route("**/api/scans", (route) => {
      scanCalls++;
      route.fulfill({ json: fixture });
    });
    await page.goto(BASE + "/");
    await page.fill("#repo", "https://github.com/local-fixture/example");
    await page.click("#grade");
    await page.waitForURL(/\/reports\/local-fixture/);
    await page.waitForSelector(".finding");
    log(
      "journey",
      "scan submits once and opens report (stubbed /api/scans)",
      scanCalls === 1 &&
        (await page.evaluate(() => document.activeElement.tagName)) === "H1",
    );
    const fid = await page.getAttribute(".finding", "id");
    const evidence = await page.isVisible(`#${fid} pre.evidence`);
    log(
      "journey",
      "evidence visible with source link at commit",
      evidence &&
        /\/blob\/f{40}\//.test(
          await page.getAttribute(`#${fid} .finding-actions a`, "href"),
        ),
    );
    calls.length = 0;
    await page.click('#view [data-mode="satirical"]');
    await page.click('#view [data-mode="serious"]');
    log(
      "journey",
      "tone switch makes zero network requests",
      calls.length === 0,
      calls.join(", "),
    );
    await page.click(`#${fid} details.more-actions summary`);
    await page.click(`#${fid} [data-share]`);
    const link = await page.evaluate(() => navigator.clipboard.readText());
    log("journey", "finding link copied", link.endsWith("#" + fid), link);
    const page2 = await ctx.newPage();
    await page2.goto(link);
    await page2.waitForSelector(".finding");
    await page2.waitForTimeout(200);
    log(
      "journey",
      "deep link focuses exact finding",
      await page2.evaluate((id) => document.activeElement.id === id, fid),
    );
    await page2.close();
    calls.length = 0;
    await page.click("#fix-plan");
    await page.waitForSelector("#plan-text");
    await page.click("#copy-plan");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const [dl] = await Promise.all([
      page.waitForEvent("download"),
      page.click("#modal a[download]"),
    ]);
    const file = await dl.path();
    const downloaded = fs.readFileSync(file, "utf8");
    log(
      "journey",
      "copy and download match cached plan",
      copied.length > 0 && copied === downloaded,
      `${copied.length} chars, ${dl.suggestedFilename()}`,
    );
    log(
      "journey",
      "export used no scan/model call",
      calls.every((c) => /\/plan/.test(c)) && scanCalls === 1,
      calls.join(", "),
    );
    await page.keyboard.press("Escape");
    await page.click(`#${fid} [data-discuss]`);
    await page.waitForSelector("#contribution-form");
    await page.fill(
      "#entry-body",
      "Is this really a slop pattern? Checking the evidence.",
    );
    await page.click("#contribution-form button[type=submit]");
    await page.waitForURL(/\/forum\?topic=/);
    await page.waitForSelector(".attached");
    const attached = await page.innerText(".attached");
    log(
      "journey",
      "topic carries commit-pinned evidence",
      /Attached finding/.test(attached) && /ffffffff/.test(attached),
    );
    await page.click(".attached >> text=Open exact finding");
    await page.waitForURL(/#finding-/);
    await page.waitForTimeout(200);
    log(
      "journey",
      "topic links back to exact finding",
      await page.evaluate(() =>
        document.activeElement.classList.contains("finding"),
      ),
    );
    // votes: keyboard + aria-pressed on the new topic
    await page.goto(BASE + "/forum");
    await page.waitForSelector("[data-vote]");
    await page.focus('[data-dir="up"]');
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-dir="up"]')
          .getAttribute("aria-pressed") === "true",
    );
    log(
      "journey",
      "vote toggles aria-pressed and keeps focus",
      await page.evaluate(() => document.activeElement.dataset.dir === "up"),
    );
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-dir="up"]')
          .getAttribute("aria-pressed") === "false",
    );
    log("journey", "vote is reversible", true);
    await page.screenshot({ path: path.join(OUT, "forum-topic-1440.png") });
    // scan errors: network + quota exhausted scanning
    await page.unroute("**/api/scans");
    await page.route("**/api/scans", (route) => route.abort());
    await page.goto(BASE + "/");
    await page.fill("#repo", "owner/repo");
    await page.click("#grade");
    await page.waitForSelector("#retry-scan");
    log(
      "journey",
      "scan network error keeps input and offers retry",
      (await page.inputValue("#repo")) === "owner/repo" &&
        /No connection/.test(await page.innerText("#scan-status")),
    );
    await page.fill("#repo", "https://github.com/a/b/tree/main");
    await page.click("#grade");
    log(
      "journey",
      "invalid repo link rejected inline",
      /Branch and file links/.test(await page.innerText("#repo-error")),
    );
    await ctx.close();
  }
  await browser.close();
  log(
    "network",
    "no request left loopback",
    external.length === 0,
    external.slice(0, 5).join(", "),
  );
  fs.writeFileSync(
    path.join(OUT, "results.json"),
    JSON.stringify(results, null, 1),
  );
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
