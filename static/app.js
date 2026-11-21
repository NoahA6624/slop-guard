const $ = (s) => document.querySelector(s);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let mode =
  new URLSearchParams(location.search).get("mode") ||
  localStorage.getItem("slop-mode") ||
  "serious";
if (!["serious", "satirical"].includes(mode)) mode = "serious";
let config = {},
  report = null,
  currentItems = [],
  sort = "new",
  plan = "",
  toastTimer;
async function api(path, options = {}) {
  let res;
  try {
    res = await fetch("/api" + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    const error = new Error(
      "Couldn’t reach Slop Guard. Check your connection and try again.",
    );
    error.status = 0;
    throw error;
  }
  if (!res.ok) {
    let data;
    try {
      data = await res.json();
    } catch {
      data = { detail: "The request failed. Try again." };
    }
    const error = new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Check the form fields and try again.",
    );
    error.status = res.status;
    throw error;
  }
  return res.headers.get("content-type")?.includes("application/json")
    ? res.json()
    : res.text();
}
function notify(message) {
  $("#toast").textContent = message;
  $("#toast").style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").style.display = "none"), 4500);
}
let modalOpener = null;
function modal(title, html) {
  const dialog = $("#modal");
  if (!dialog.open) modalOpener = document.activeElement;
  $("#modal-label").textContent = title;
  $("#modal-body").innerHTML = html;
  if (!dialog.open) dialog.showModal();
  const body = $("#modal-body");
  const first =
    body.querySelector("[autofocus]") ||
    body.querySelector(
      "input:not([type=hidden]), textarea, select, button, a[href]",
    );
  (first || $("#close-modal")).focus();
}
$("#modal").addEventListener("close", () => {
  if (modalOpener?.isConnected) modalOpener.focus();
  modalOpener = null;
});
$("#close-modal").onclick = () => $("#modal").close();
$("#modal").addEventListener("click", (e) => {
  if (e.target === $("#modal")) $("#modal").close();
});
function modeControl() {
  return `<div><div class="mode" role="group" aria-label="Report tone" data-current="${mode}"><button data-mode="serious" class="${mode === "serious" ? "selected" : ""}" aria-pressed="${mode === "serious"}">Serious</button><button data-mode="satirical" class="${mode === "satirical" ? "selected" : ""}" aria-pressed="${mode === "satirical"}">Satirical</button></div></div>`;
}
function slideModeThumb(from, to) {
  if (from === to) return;
  document.querySelectorAll("#view .mode").forEach((el) => {
    el.dataset.current = from;
    el.getBoundingClientRect(); // commit the starting position
    el.dataset.current = to;
  });
}
function changeMode(next) {
  const previous = mode;
  mode = next;
  localStorage.setItem("slop-mode", mode);
  const url = new URL(location);
  url.searchParams.set("mode", mode);
  history.replaceState({}, "", url);
  const y = scrollY;
  const open = [...document.querySelectorAll("#view details")].map(
    (d) => d.open,
  );
  const focused = document.activeElement?.closest("#view [data-mode]")
    ? `[data-mode="${next}"]`
    : null;
  if (report && location.pathname.startsWith("/reports/")) renderReport();
  else home();
  document
    .querySelectorAll("#view details")
    .forEach((d, i) => open[i] && (d.open = true));
  scrollTo(0, y);
  if (focused) $("#view " + focused)?.focus();
  slideModeThumb(previous, next);
}
const SELF_REPO = "NoahA6624/slop-guard";
const REPO_PATTERN = /^([A-Za-z0-9_.-]{1,100})\/([A-Za-z0-9_.-]{1,100})$/;
// Accept the forms people paste and send the API one it supports
// (owner/repo). Anything with extra path segments is rejected here with
// the same guidance the server gives.
function normalizeRepo(value) {
  const cleaned = value
    .trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "");
  const match = cleaned.match(REPO_PATTERN);
  if (
    !match ||
    [".", ".."].includes(match[1]) ||
    [".", ".."].includes(match[2])
  )
    return null;
  return `${match[1]}/${match[2]}`;
}
let scanBusy = false;
function home() {
  report = null;
  const previous = {
    repo: $("#repo")?.value ?? "",
    ai: $("#include-ai") ? $("#include-ai").checked : null,
    status: $("#scan-status")?.innerHTML ?? "",
    error: $("#repo-error")?.textContent ?? "",
  };
  $("#view").innerHTML =
    `<div class="page home"><section class="home-entry" aria-labelledby="home-title"><h1 id="home-title">My AI slop grades <span>your AI slop.</span></h1><p class="intro">An honest second look at your public GitHub repo.</p><form class="scan-box" id="scan-form" novalidate><label for="repo">Public GitHub repository</label><div class="input-group"><input id="repo" name="repo" type="text" inputmode="url" placeholder="owner/repo or GitHub link" required spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="repo-help repo-error"><button class="primary" id="grade" type="submit">Grade my repo</button></div><p class="field-error" id="repo-error"></p><div class="input-help"><span id="repo-help">Public repos only. No sign-in. Your code is never run.</span><button type="button" class="text-button" id="self-scan">Grade Slop Guard itself</button></div><div class="ai-option"><label for="include-ai"><input id="include-ai" type="checkbox" aria-describedby="ai-availability">Include a fresh AI review</label><span id="ai-availability"></span><span class="visually-hidden" id="ai-announce" role="status"></span></div><div id="scan-status" role="status"></div></form><div class="tone-row"><span class="tone-label">Tone</span>${modeControl()}</div></section><section class="example-panel" aria-label="Example finding"><div class="example-code"><div class="code-header"><span>tests/test_checkout.py</span><span>Example</span></div><pre>def test_checkout_succeeds():
    assert True</pre><div class="example-verdict">${mode === "satirical" ? "“This test has never doubted you.”" : "This test passes even if the feature is removed."}</div></div></section><p class="disclaimer">We grade observable code quality, not who or what wrote it.</p></div>`;
  $("#repo").value = previous.repo;
  if (previous.error) showRepoError(previous.error);
  $("#scan-status").innerHTML = previous.status;
  aiAnnounced = null;
  $("#include-ai").checked = previous.ai ?? config.quota?.state === "available";
  updateAiControls();
  setScanBusy(scanBusy);
  $("#scan-form").onsubmit = submitScan;
  $("#repo").addEventListener("input", () => {
    if ($("#repo").getAttribute("aria-invalid")) showRepoError("");
  });
  $("#self-scan").onclick = () => {
    $("#repo").value = SELF_REPO;
    $("#scan-form").requestSubmit();
  };
}
function showRepoError(message) {
  const input = $("#repo");
  $("#repo-error").textContent = message;
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}
function setScanBusy(busy) {
  scanBusy = busy;
  const form = $("#scan-form");
  if (!form) return;
  form.setAttribute("aria-busy", String(busy));
  $("#grade").disabled = busy;
  $("#grade").textContent = busy ? "Grading…" : "Grade my repo";
  $("#self-scan").disabled = busy;
}
function scanFailure(error) {
  if (error.status === 409)
    return {
      title: "Another scan is running.",
      body: error.message,
    };
  if (error.status === 0)
    return { title: "No connection.", body: error.message };
  if (error.status >= 500)
    return { title: "The scan didn’t finish.", body: error.message };
  return { title: "We couldn’t grade that repository.", body: error.message };
}
async function submitScan(e) {
  e.preventDefault();
  if (scanBusy) return;
  const raw = $("#repo").value;
  if (!raw.trim()) {
    showRepoError("Enter a repository, for example owner/repo.");
    $("#repo").focus();
    return;
  }
  const repo = normalizeRepo(raw);
  if (!repo) {
    showRepoError(
      "Use owner/repo or https://github.com/owner/repo. Branch and file links aren’t supported.",
    );
    $("#repo").focus();
    return;
  }
  showRepoError("");
  setScanBusy(true);
  $("#scan-status").innerHTML =
    `<div class="progress">Grading ${esc(repo)}: resolving the commit and inspecting selected files. Larger repositories can take up to a minute.</div>`;
  try {
    const result = await api("/scans", {
      method: "POST",
      body: JSON.stringify({
        repo,
        include_ai: Boolean(
          $("#include-ai")?.checked && !$("#include-ai").disabled,
        ),
      }),
    });
    setScanBusy(false);
    if (location.pathname !== "/") return;
    $("#scan-status").innerHTML = "";
    report = result;
    navigate(`/reports/${result.id}?mode=${mode}`, false);
    renderReport();
    scrollTo(0, 0);
    markRoute();
    const heading = $("#view h1");
    heading.tabIndex = -1;
    heading.focus();
    refreshConfig().catch(() => {});
  } catch (error) {
    setScanBusy(false);
    const status = $("#scan-status");
    if (!status) return;
    const failure = scanFailure(error);
    status.innerHTML = `<div class="notice-error" role="alert"><strong>${esc(failure.title)}</strong> ${esc(failure.body)} <span class="muted">Your entry is kept.</span><div class="error-actions"><button type="submit" class="secondary" id="retry-scan">Try again</button></div></div>`;
  }
}
function quotaText() {
  const q = config.quota;
  if (!q) return "Checking review availability…";
  if (q.state === "available")
    return (
      (mode === "satirical"
        ? `${q.remaining} roasts left in the tank`
        : `${q.remaining} AI reviews left today`) +
      (q.limits_kind.startsWith("conservative") ? " · local pilot ceiling" : "")
    );
  if (q.retry_at) {
    const seconds = Math.max(
      0,
      Math.ceil(
        q.retry_at - (Date.now() / 1000 + (q.server_time - config.receivedAt)),
      ),
    );
    const t = [
      Math.floor(seconds / 3600),
      Math.floor(seconds / 60) % 60,
      seconds % 60,
    ]
      .map((x) => String(x).padStart(2, "0"))
      .join(":");
    return q.state === "exhausted"
      ? `AI reviews reset in ${t}`
      : `Next AI review in ${t}`;
  }
  return q.message;
}
function renderReport(focusHash = false) {
  const r = report;
  $("#view").innerHTML =
    `<div class="page"><div class="page-head"><div><h1>${esc(r.repo)}</h1><div class="report-meta">Commit <code>${esc(r.sha.slice(0, 8))}</code> · ${new Date(r.created * 1000).toLocaleDateString()}</div></div>${modeControl()}</div><div class="scores"><section class="score-block"><h2>Deterministic Slop Score</h2><div class="score-number">${r.score ?? "—"}${r.score == null ? "" : " <small>/ 100</small>"}</div>${r.score == null ? '<div class="quota">Insufficient coverage</div>' : ""}</section><section class="score-block"><h2>Probabilistic AI Slop</h2><div class="quota" id="quota-line">${esc(quotaText())}</div><div class="score-number">${r.ai.score ?? "—"}${r.ai.score == null ? "" : " <small>/ 100</small>"}</div><div class="quota">${r.ai.score == null ? "Not reviewed" : "Model judgment"}</div></section></div><p class="score-note">Higher means more slop. ${r.coverage.eligible == null ? `${r.coverage.inspected} ${r.coverage.inspected === 1 ? "file" : "files"} inspected; eligible total unknown` : `${r.coverage.inspected} of ${r.coverage.eligible} eligible files inspected`}${r.coverage.partial ? " (partial coverage)" : ""}${r.languages.length ? " · " + esc(r.languages.join(", ")) : ""}.</p><div class="report-actions"><button class="primary" id="fix-plan" ${r.findings.length ? "" : 'disabled aria-describedby="fix-plan-note"'}>Fix My AI Slop</button><button class="secondary" id="roast">Roast My Repo</button><button class="secondary" id="share-report">Copy report link</button><a class="text-button small" href="/">Grade another repo</a>${r.findings.length ? "" : '<p class="action-note" id="fix-plan-note">Nothing to export: this scan has no supported findings.</p>'}</div><div class="section-title"><h2>${mode === "satirical" ? "The code can take it." : "What needs your attention"}</h2><span class="small muted">${r.findings.length} ${r.findings.length === 1 ? "finding" : "findings"}</span></div>${r.findings.length ? r.findings.map((f, i) => `${i === 3 ? `<details class="more-findings"><summary>Show ${r.findings.length - 3} more ${r.findings.length - 3 === 1 ? "finding" : "findings"}</summary>` : ""}${findingHtml(f)}${i === r.findings.length - 1 && i >= 3 ? "</details>" : ""}`).join("") : '<div class="empty"><h2>No supported findings.</h2><p>That doesn’t prove the code is defect-free. See what was inspected below.</p></div>'}<details class="details"><summary>Coverage, metrics, and skipped checks</summary><div class="metrics-grid"><div><strong>${r.metrics.lines}</strong><span>Lines inspected</span></div><div><strong>${r.metrics.average_file_length}</strong><span>Average lines per file</span></div><div><strong>${Math.round(r.metrics.comment_density * 100)}%</strong><span>Comment line density, headers excluded</span></div></div><p>${formatBytes(r.coverage.bytes)} inspected · rubric ${esc(r.rubric)}${r.cache_hit ? " · cached result" : ""}. File lengths: ${esc(r.metrics.file_lengths.join(", ") || "none")} lines.</p><ul>${[
      r.ai.uncertainty,
      ...r.coverage.reasons,
      ...r.checks,
    ]
      .filter(Boolean)
      .map((x) => `<li>${esc(x)}</li>`)
      .join(
        "",
      )}</ul><p><a href="/methodology">How grading works</a></p></details></div>`;
  $("#fix-plan").onclick = openPlan;
  $("#roast").onclick = () => changeMode("satirical");
  $("#share-report").onclick = () => copy(location.href, "Report link");
  if (focusHash) revealFinding();
}
function formatBytes(n) {
  return n < 1024 ? `${n} B` : `${Math.round(n / 1024)} KB`;
}
function revealFinding() {
  const target = location.hash.startsWith("#finding-")
    ? document.getElementById(location.hash.slice(1))
    : null;
  if (!target) return false;
  target.closest("details")?.setAttribute("open", "");
  requestAnimationFrame(() => {
    target.scrollIntoView();
    target.focus({ preventScroll: true });
  });
  return true;
}
window.addEventListener("hashchange", () => {
  if (report && location.pathname.startsWith("/reports/")) revealFinding();
});
function sourceHtml(f) {
  const lines = String(f.evidence ?? "").split("\n");
  // Number lines only when the excerpt is exactly the cited range.
  const numbered = lines.length === f.end - f.start + 1;
  const rows = lines
    .map(
      (line, i) =>
        `<span class="src-line">${numbered ? `<span class="src-num" aria-hidden="true">${f.start + i}</span>` : ""}<code>${esc(line) || " "}</code></span>`,
    )
    .join("");
  return `<figure class="source"><figcaption><span class="finding-path">${esc(f.path)}</span><span>lines ${f.start}${f.end !== f.start ? "–" + f.end : ""}</span></figcaption><pre class="evidence${numbered ? " numbered" : ""}" tabindex="0" role="region" aria-label="Evidence from ${esc(f.path)}">${rows}</pre></figure>`;
}
function findingHtml(f) {
  const model = f.source !== "deterministic";
  const points =
    !model && f.contribution != null
      ? ` · ${f.contribution} ${f.contribution === 1 ? "point" : "points"}`
      : "";
  return `<article class="finding" id="finding-${esc(f.id)}" tabindex="-1"><div class="finding-meta"><span class="badge${model ? " model" : ""}">${esc(model ? "Model review" : f.rule)}</span><span>${esc(f.confidence)} confidence${points}</span></div><h3>${esc(mode === "satirical" ? f.roast : f.title)}</h3><p>${esc(f.consequence)}</p>${sourceHtml(f)}<dl class="finding-fix"><dt>Fix</dt><dd>${esc(f.fix)}</dd><dt>Verify</dt><dd>${esc(f.check)}</dd></dl><div class="finding-actions"><a href="${esc(f.url)}" target="_blank" rel="noopener">View source at commit</a><button class="text-button" data-discuss="${esc(f.id)}">Discuss this finding</button><details class="more-actions"><summary>More</summary><div class="more-actions-list"><button class="text-button" data-share="${esc(f.id)}">Share finding</button><button class="text-button" data-discuss="${esc(f.id)}">Bad call?</button><a href="/library">Find a useful tool</a><button class="text-button" data-social="${esc(f.id)}">Offer for a social roast</button></div></details></div></article>`;
}
async function openPlan() {
  const r = report;
  // Mirrors the server: a model-review plan when model findings exist.
  const kind = r.findings.some((f) => f.source !== "deterministic")
    ? "Cached model review"
    : "Deterministic checklist";
  try {
    plan = await api(`/reports/${r.id}/plan`);
  } catch (e) {
    modal(
      "Fix My AI Slop",
      `<p class="notice-error" role="alert">${esc(e.message)}</p><div class="dialog-actions"><button class="secondary" id="retry-plan" autofocus>Try again</button></div>`,
    );
    $("#retry-plan").onclick = openPlan;
    return;
  }
  const items = (plan.match(/^## /gm) || []).length;
  modal(
    "Fix My AI Slop",
    `<p class="plan-meta"><strong>${kind}</strong> · ${esc(r.repo)} at <code>${esc(r.sha.slice(0, 8))}</code> · ${items} ${items === 1 ? "item" : "items"} · no new AI call</p><pre class="plan-text" id="plan-text" tabindex="0" role="region" aria-label="SLOP_FIX_PLAN.md preview">${esc(plan)}</pre><div class="dialog-actions"><button class="primary" id="copy-plan" autofocus>Copy Markdown</button><a class="secondary" href="/api/reports/${esc(r.id)}/plan?download=true" download="SLOP_FIX_PLAN.md">Download SLOP_FIX_PLAN.md</a></div><p class="copy-status" id="copy-status" role="status"></p>`,
  );
  $("#copy-plan").onclick = async () => {
    const status = $("#copy-status");
    status.textContent = "";
    try {
      await navigator.clipboard.writeText(plan);
      status.textContent = "Copied. Paste it into your coding agent.";
    } catch {
      selectContents($("#plan-text"));
      status.textContent = isMac()
        ? "Couldn’t copy automatically. The plan is selected; press ⌘C."
        : "Couldn’t copy automatically. The plan is selected; press Ctrl+C.";
    }
  };
}
function isMac() {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}
function selectContents(el) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}
async function copy(text, label = "Link") {
  try {
    await navigator.clipboard.writeText(text);
    notify(`${label} copied.`);
  } catch {
    modal(
      "Copy link",
      `<p>Couldn’t copy automatically. The link is selected; press ${isMac() ? "⌘C" : "Ctrl+C"}.</p><input class="copy-field" id="copy-field" readonly aria-label="${esc(label)}" value="${esc(text)}">`,
    );
    $("#copy-field").select();
  }
}
async function refreshConfig() {
  config = await api("/config");
  config.receivedAt = Date.now() / 1000;
  $("#signin").textContent = config.user ? config.user.name : "Sign in";
  if ($("#quota-line")) $("#quota-line").textContent = quotaText();
  updateAiControls();
}
let aiAnnounced = null;
function updateAiControls() {
  const control = $("#include-ai");
  if (!control) return;
  const fresh = config.quota && Date.now() / 1000 - config.receivedAt < 30;
  const available = fresh && config.quota.state === "available";
  control.disabled = !available;
  if (!available) control.checked = false;
  $("#ai-availability").textContent = fresh
    ? quotaText() + (available ? "" : " · Deterministic scanning is available.")
    : "Checking AI availability · deterministic scanning is available.";
  const state = fresh ? config.quota.state : "stale";
  if (state !== aiAnnounced && $("#ai-announce")) {
    // Skip the first render: the visible text is already readable.
    if (aiAnnounced !== null)
      $("#ai-announce").textContent = available
        ? "Fresh AI review is available again."
        : "Fresh AI review is unavailable. Deterministic scanning still works.";
    aiAnnounced = state;
  }
}
async function signIn() {
  if (config.user) {
    modal(
      "Your account",
      `<h2 class="dialog-title">${esc(config.user.name)}</h2><p class="muted small">Your email address is never stored or shown.</p><button class="secondary" id="logout">Sign out</button>${config.admin ? '<p><a href="/admin">Open moderation</a></p>' : ""}`,
    );
    $("#logout").onclick = async () => {
      await api("/logout", { method: "POST", body: "{}" });
      await refreshConfig();
      $("#modal").close();
      route();
    };
    return;
  }
  modal(
    "Sign in with Google",
    `<h2 class="dialog-title">A little accountability goes a long way.</h2><p class="muted small">Sign in to post, reply, and vote. Scanning and reading stay free and anonymous.</p><div id="google-signin"></div>${config.google_client_id ? "" : '<p class="notice login-config">Google sign-in needs an owner-supplied <code>GOOGLE_CLIENT_ID</code>. Add it to <code>.env</code> with this local origin authorized, then restart the app.</p>'}`,
  );
  if (config.google_client_id) {
    if (!window.google) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      }).catch(() => notify("Google sign-in could not load."));
    }
    if (window.google) {
      google.accounts.id.initialize({
        client_id: config.google_client_id,
        callback: async (response) => {
          try {
            await api("/login", {
              method: "POST",
              body: JSON.stringify({ credential: response.credential }),
            });
            await refreshConfig();
            $("#modal").close();
            route();
          } catch (e) {
            notify(e.message);
          }
        },
      });
      google.accounts.id.renderButton($("#google-signin"), {
        theme: "outline",
        size: "large",
        text: "signin_with",
      });
    }
  }
}
$("#signin").onclick = signIn;
function needAccount() {
  if (config.user) return true;
  signIn();
  return false;
}
function contribute(kind, findingId = null, parent = null, existing = null) {
  if (!needAccount()) return;
  const f = report?.findings.find((f) => f.id === findingId);
  const title = existing?.title || (f ? `Review finding: ${f.title}` : "");
  modal(
    existing
      ? "Edit your contribution"
      : kind === "topic"
        ? "Start a Slop Form discussion"
        : kind === "reply"
          ? "Reply to this topic"
          : "Share something useful",
    `<h2 class="dialog-title">${f ? "Let’s look at the evidence." : kind === "resource" ? "A resource with a purpose." : kind === "project" ? "Give your project some context." : "Make the discussion useful."}</h2>${f ? `<p class="notice">Attached: ${esc(f.path)}:${f.start} at ${esc(report.sha.slice(0, 8))}. Commit-pinned evidence travels with this topic.</p>` : ""}<form class="field-form" id="contribution-form"><label for="entry-title">Title</label><input id="entry-title" required minlength="3" maxlength="140" value="${esc(title)}"><label for="entry-body">${kind === "resource" ? "What failure does it catch, and when should someone use it?" : "Context"}</label><textarea id="entry-body" required minlength="10" maxlength="5000" placeholder="What should someone know? What worked, what broke, or what did the grader miss?">${esc(existing?.body || "")}</textarea>${["project", "resource"].includes(kind) ? `<label for="entry-url">Public HTTPS link</label><input id="entry-url" type="url" required placeholder="https://…" value="${esc(existing?.url || "")}">` : ""}${kind === "project" ? '<label for="entry-report">Optional Slop Guard report link</label><input id="entry-report" type="url" placeholder="http://127.0.0.1:8000/reports/…">' : ""}<p>Sharing a project does not grant permission for social roasts. Featuring requires separate maintainer consent and admin verification.</p><button class="primary" type="submit">${existing ? "Save changes" : kind === "reply" ? "Post reply" : "Publish " + (kind === "topic" ? "topic" : kind)}</button><div id="form-error" role="alert"></div></form>`,
  );
  $("#contribution-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await api(
        "/content" + (existing ? "/" + existing.id : ""),
        {
          method: existing ? "PUT" : "POST",
          body: JSON.stringify({
            kind,
            title: $("#entry-title").value,
            body: $("#entry-body").value,
            url: $("#entry-url")?.value || "",
            parent,
            report: f
              ? report.id
              : kind === "project"
                ? $("#entry-report")?.value.match(
                    /\/reports\/([a-f0-9]{20})/,
                  )?.[1] || null
                : null,
            finding: f?.id,
          }),
        },
      );
      $("#modal").close();
      notify(existing ? "Changes saved." : "Published.");
      if (kind === "topic") navigate("/forum?topic=" + result.id);
      else route();
    } catch (error) {
      $("#form-error").textContent = error.message;
    }
  };
}
function pageHeader(title, intro, button = "") {
  return `<div class="page-head"><div><h1>${title}</h1><p class="muted">${intro}</p></div>${button}</div>`;
}
async function community() {
  const records = await api(`/content?kind=project&sort=${sort}`);
  currentItems = records;
  $("#view").innerHTML =
    `<div class="page">${pageHeader("Community Slop", "Projects built with AI, and what people learned.", '<button class="primary" id="add-project">Share a project</button>')}<div class="toolbar"><div class="tabs" role="group" aria-label="Sort"><button data-sort="new" aria-pressed="${sort === "new"}" class="${sort === "new" ? "active" : ""}">New</button><button data-sort="top" aria-pressed="${sort === "top"}" class="${sort === "top" ? "active" : ""}">Top</button></div><span class="small muted">Community votes are popularity, not engineering scores.</span></div>${records.length ? records.map(itemHtml).join("") : '<div class="empty"><h2>No projects yet.</h2><p>Share yours. Running a scan never posts it here.</p></div>'}</div>`;
  $("#add-project").onclick = () => contribute("project");
}
function itemHtml(item) {
  return `<article class="contribution" id="item-${esc(item.id)}"><div class="contribution-meta"><span>${esc(item.author)}</span><time>${new Date(item.created * 1000).toLocaleDateString()}</time></div><h2>${esc(item.title)}</h2><p>${esc(item.body)}</p>${item.url ? `<p><a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.url)}</a></p>` : ""}${item.evidence ? evidenceHtml(item.evidence) : ""}<div class="finding-actions"><span class="votes"><button data-vote="${item.id}" data-value="${item.my_vote === 1 ? 0 : 1}" class="${item.my_vote === 1 ? "chosen" : ""}" aria-pressed="${item.my_vote === 1}" aria-label="Upvote ${esc(item.title)}">+</button><span>${item.votes}</span><button data-vote="${item.id}" data-value="${item.my_vote === -1 ? 0 : -1}" class="${item.my_vote === -1 ? "chosen" : ""}" aria-pressed="${item.my_vote === -1}" aria-label="Downvote ${esc(item.title)}">−</button></span>${item.kind === "topic" ? `<a href="/forum?topic=${item.id}">Open discussion</a><button class="text-button" data-reply="${item.id}">Reply</button>` : ""}${config.user?.id === item.owner ? `<button class="text-button" data-edit="${item.id}">Edit</button>` : ""}<button class="text-button" data-abuse="${item.id}">Report</button></div></article>`;
}
function evidenceHtml(raw) {
  try {
    const e = JSON.parse(raw);
    if (!e.finding)
      return `<p class="notice">Attached scan: ${esc(e.repo)} at ${esc(e.sha.slice(0, 8))} · deterministic ${e.score ?? "insufficient coverage"} · <a href="/reports/${esc(e.report)}">View report</a></p>`;
    return `<div class="notice"><strong>Attached finding · ${esc(e.repo)} at ${esc(e.sha.slice(0, 8))}</strong><p>${esc(e.finding.title)}</p><pre class="evidence">${esc(e.finding.evidence)}</pre><a href="/reports/${esc(e.report)}?mode=${mode}#finding-${esc(e.finding.id)}">Open exact finding</a> · <a href="${esc(e.finding.url)}" target="_blank" rel="noopener">View source</a></div>`;
  } catch {
    return "";
  }
}
async function library() {
  const [seeds, submitted] = await Promise.all([
    api("/resources"),
    api("/content?kind=resource&sort=" + sort),
  ]);
  currentItems = submitted;
  $("#view").innerHTML =
    `<div class="page">${pageHeader("Anti-Slop Library", "Tools and workflows that catch specific failures.", '<button class="primary" id="add-resource">Suggest a resource</button>')}<div class="toolbar"><input id="resource-search" type="search" placeholder="Search tools, failures, workflows…" aria-label="Search the library"><div class="tabs" role="group" aria-label="Sort"><button data-sort="new" aria-pressed="${sort === "new"}" class="${sort === "new" ? "active" : ""}">New</button><button data-sort="top" aria-pressed="${sort === "top"}" class="${sort === "top" ? "active" : ""}">Top</button></div></div><div id="resource-list">${seeds.map((r) => `<article class="resource" data-search="${esc(JSON.stringify(r).toLowerCase())}"><span class="tiny-label">${esc(r.type)} · ${esc(r.author)} · curated</span><h2>${esc(r.title)}</h2><p>${esc(r.failure)}</p><p><strong>Use it when:</strong> ${esc(r.when)}</p><a href="${esc(r.url)}" target="_blank" rel="noopener">Original resource</a></article>`).join("")}${submitted.map(itemHtml).join("")}</div><p class="small muted" id="no-resources" hidden>No resources match that search.</p></div>`;
  $("#add-resource").onclick = () => contribute("resource");
  $("#resource-search").oninput = (e) => {
    let shown = 0;
    document.querySelectorAll("#resource-list article").forEach((el) => {
      el.hidden = !(el.dataset.search || el.textContent.toLowerCase()).includes(
        e.target.value.toLowerCase(),
      );
      shown += !el.hidden;
    });
    $("#no-resources").hidden = shown > 0;
  };
}
async function forum() {
  const topics = await api("/content?kind=topic&sort=" + sort);
  const selected = new URLSearchParams(location.search).get("topic");
  const replies = selected ? await api("/content?kind=reply") : [];
  currentItems = [...topics, ...replies];
  const topic = topics.find((x) => x.id === selected);
  $("#view").innerHTML =
    `<div class="page">${pageHeader("Slop Form", "Questions and challenges to findings, with evidence.", '<button class="primary" id="add-topic">Start a topic</button>')}${selected ? '<p><a href="/forum" class="small muted">All topics</a></p>' : ""}${
      selected
        ? topic
          ? itemHtml(topic) +
            `<h2 class="more-findings">Replies</h2>` +
            replies
              .filter((x) => x.parent === selected)
              .map(itemHtml)
              .join("") +
            `<button class="secondary" data-reply="${esc(selected)}">Add a reply</button>`
          : '<div class="empty"><h2>Topic not found.</h2><p>It may have been removed by moderation.</p></div>'
        : topics.length
          ? topics.map(itemHtml).join("")
          : '<div class="empty"><h2>No topics yet.</h2><p>Disagree with a finding? Use “Discuss this finding” on a report.</p></div>'
    }</div>`;
  $("#add-topic").onclick = () => contribute("topic");
}
async function portfolio() {
  const entries = await api("/portfolio");
  $("#view").innerHTML =
    `<div class="page">${pageHeader("Our Slop", "Projects from the Slop Guard team, and what got fixed.")}${entries.length ? entries.map((x) => `<article class="resource"><h2>${esc(x.title)}</h2><p>${esc(x.description)}</p><p>${esc(x.notes)}</p><a href="${esc(x.repo)}" target="_blank" rel="noopener">Public repository</a>${x.demo ? ` · <a href="${esc(x.demo)}" target="_blank" rel="noopener">Live demo</a>` : ""}</article>`).join("") : '<div class="empty"><h2>Nothing published yet.</h2><p>Team projects will appear here. Looking for community projects? See <a href="/community">Community Slop</a>.</p></div>'}</div>`;
}
function methodology() {
  $("#view").innerHTML =
    `<div class="page prose">${pageHeader("How grading works", "Two independent scores and a visible scope.")}<p>Slop Guard reviews observable code quality. Neither score estimates whether a person or an AI wrote the code. Higher scores mean more observed problems, on a scale of 0–100.</p><h2>Deterministic rubric · v1.0</h2><table><thead><tr><th>Signal</th><th>Raw points</th><th>What it means</th></tr></thead><tbody><tr><td>Tautological Python test</td><td>18</td><td>A test body contains only assertions of literal True.</td></tr><tr><td>Identical Python branches</td><td>12</td><td>The two AST branches have identical statements.</td></tr><tr><td>Ruff undefined name F821</td><td>10</td><td>A referenced Python name is not defined.</td></tr><tr><td>TypeScript syntax diagnostic</td><td>8</td><td>Trusted compiler parser rejects the syntax.</td></tr><tr><td>Unused import / variable</td><td>2</td><td>Ruff F401 / F841, with isolated configuration.</td></tr><tr><td>File &gt;500 / function &gt;80 lines</td><td>1 each</td><td>Weak signals, combined cap of 5.</td></tr><tr><td>Comment length or density</td><td>0</td><td>Descriptive metrics only; verbosity is not a defect.</td></tr></tbody></table><p>Normalize substantive points by <code>max(1, inspected lines / 1,000)</code>, round and cap at 95. Add weak style points capped at 5. Each emitted rule/location is unique; separate rules can describe separate issues. Fewer than 10 inspected lines yields “insufficient coverage.” Partial scans describe only their inspected subset.</p><p>Worked example: a 500-line snapshot with one useless test (18) and two unused imports (4) scores 22. A long, useful 100-line comment scores 0. A 2,000-line snapshot with the same findings scores 11.</p><h2>Probabilistic AI Slop</h2><p>When an eligible free review provider is configured (Groq GPT-OSS by default, or Gemini Flash for an eligible pilot), it reviews bounded excerpts for contextual defects. We require a file path, line range, exact quotation, consequence, correction, and acceptance check. Invalid evidence is discarded. Confidence is a model judgment: high findings contribute 18, medium 9, low 3, capped at 100. This is not a calibrated probability. A matching quote confirms the evidence, not the interpretation.</p><h2>What a scan can—and cannot—cover</h2><p>Up to 35 files, 40 KB per file, 280 KB total, in stable path order. Python and JS/TS source only. Generated, binary, minified, vendored, lock, symlink, and submodule content is excluded. No cloning, dependency installation, submitted code execution, or repository-supplied executable configuration. Type checking and dependency-aware JS/TS unused-name checks are explicitly skipped. A bounded README is checked for literal Python or Node commands pointing to missing source scripts, when the tree is complete; working-directory intent still needs review.</p><p>The app publishes coverage and skipped checks. A low score is not proof of correctness. Snapshots and model reviews are cached by commit and review configuration. Mode switches and fix-plan exports make no model calls.</p><h2>Sources behind the approach</h2><ul><li><a href="https://google.github.io/eng-practices/review/reviewer/looking-for.html">Google Engineering Practices: review behavior, tests, and complexity</a></li><li><a href="https://docs.astral.sh/ruff/rules/">Astral: Ruff rules and correctness checks</a></li><li><a href="https://www.typescriptlang.org/docs/handbook/compiler-api.html">Microsoft: TypeScript compiler API</a></li><li><a href="https://ai.google.dev/gemini-api/docs/rate-limits">Google: project quotas and Pacific daily reset</a></li><li><a href="https://ai.google.dev/gemini-api/terms">Google: free-tier terms and audience restrictions</a></li></ul></div>`;
}
async function moderation() {
  const records = await api("/admin");
  $("#view").innerHTML =
    `<div class="page">${pageHeader("Moderation", "Reported contributions. Admins only.")} ${records.length ? records.map((r) => `<article class="resource"><h2>${esc(r.title)}</h2><p>${esc(r.body)}</p><p><strong>Report reason:</strong> ${esc(r.reason)}</p><button class="secondary" data-hide="${esc(r.item)}">Hide contribution</button></article>`).join("") : '<p class="muted">No unresolved reports.</p>'}</div>`;
}
const header = $("header");
const menuToggle = $("#menu-toggle");
function setMenu(open, returnFocus = false) {
  header.classList.toggle("menu-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  if (!open && returnFocus) menuToggle.focus();
}
menuToggle.onclick = () =>
  setMenu(menuToggle.getAttribute("aria-expanded") !== "true");
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && header.classList.contains("menu-open"))
    setMenu(false, true);
});
document.addEventListener("click", (e) => {
  if (header.classList.contains("menu-open") && !header.contains(e.target))
    setMenu(false);
});
function pageTitle(path) {
  const names = {
    "/community": "Community Slop",
    "/library": "Anti-Slop Library",
    "/forum": "Slop Form",
    "/portfolio": "Our Slop",
    "/methodology": "How grading works",
    "/admin": "Moderation",
  };
  if (path.startsWith("/reports/"))
    return report ? `${report.repo} report` : "Repo report";
  return names[path] || null;
}
function navigate(path, render = true) {
  history.pushState({}, "", path);
  if (render) {
    scrollTo(0, 0);
    route({ focus: true });
  }
}
function markRoute() {
  const path = location.pathname;
  document.querySelectorAll(".site-nav a").forEach((a) => {
    const current =
      a.getAttribute("href") === path ||
      (path.startsWith("/reports/") && a.dataset.page === "scan");
    if (current) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  const name = pageTitle(path);
  document.title = name
    ? `${name} · Slop Guard`
    : "Slop Guard — Make the code better.";
}
async function route({ focus = false } = {}) {
  const path = location.pathname;
  setMenu(false);
  markRoute();
  try {
    if (path.startsWith("/reports/")) {
      report = await api("/reports/" + path.split("/")[2]);
      renderReport(true);
    } else if (path === "/community") await community();
    else if (path === "/library") await library();
    else if (path === "/forum") await forum();
    else if (path === "/portfolio") await portfolio();
    else if (path === "/methodology") methodology();
    else if (path === "/admin") await moderation();
    else home();
  } catch (e) {
    $("#view").innerHTML =
      `<div class="page"><div class="empty"><h1>That didn’t load.</h1><p>${esc(e.message)}</p><a class="secondary" href="/">Back to the grader</a></div></div>`;
  }
  markRoute();
  if (focus) {
    const heading = $("#view h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: !!location.hash });
    } else $("#main").focus();
  }
}
document.addEventListener("click", async (e) => {
  const el = e.target.closest("button,a");
  if (!el) return;
  if (el.dataset.mode) {
    changeMode(el.dataset.mode);
    return;
  }
  if (el.dataset.share) {
    const url = new URL(location);
    url.hash = "finding-" + el.dataset.share;
    copy(url.href, "Finding link");
  }
  if (el.dataset.discuss) contribute("topic", el.dataset.discuss);
  if (el.dataset.reply) contribute("reply", null, el.dataset.reply);
  if (el.dataset.edit) {
    const item = currentItems.find((x) => x.id === el.dataset.edit);
    if (item) contribute(item.kind, null, item.parent, item);
  }
  if (el.dataset.sort) {
    sort = el.dataset.sort;
    route();
  }
  if (el.dataset.vote && needAccount()) {
    try {
      await api(`/content/${el.dataset.vote}/vote`, {
        method: "POST",
        body: JSON.stringify({ value: Number(el.dataset.value) }),
      });
      route();
    } catch (error) {
      notify(error.message);
    }
  }
  if (el.dataset.abuse && needAccount()) {
    modal(
      "Report a contribution",
      '<h2 class="dialog-title">What needs a closer look?</h2><form id="abuse-form" class="field-form"><label for="reason">Reason for reporting</label><textarea id="reason" required minlength="5" maxlength="1000"></textarea><button class="primary">Send report</button></form>',
    );
    $("#abuse-form").onsubmit = async (event) => {
      event.preventDefault();
      try {
        await api(`/content/${el.dataset.abuse}/report`, {
          method: "POST",
          body: JSON.stringify({ reason: $("#reason").value }),
        });
        $("#modal").close();
        notify("Report sent for admin review.");
      } catch (error) {
        notify(error.message);
      }
    };
  }
  if (el.dataset.hide) {
    try {
      await api(`/admin/${el.dataset.hide}/hide`, {
        method: "POST",
        body: "{}",
      });
      moderation();
    } catch (error) {
      notify(error.message);
    }
  }
  if (el.tagName === "A") {
    const href = el.getAttribute("href");
    if (
      href?.startsWith("/") &&
      !href.startsWith("/api/") &&
      !e.ctrlKey &&
      !e.metaKey
    ) {
      e.preventDefault();
      $("#modal").close();
      navigate(href);
    }
  }
});
window.addEventListener("popstate", () => {
  mode =
    new URLSearchParams(location.search).get("mode") ||
    localStorage.getItem("slop-mode") ||
    "serious";
  route({ focus: true });
});
function offerSocial(id) {
  if (!needAccount()) return;
  modal(
    "Separate maintainer opt-in",
    `<h2 class="dialog-title">Your code. Your call.</h2><p class="small muted">An admin must verify the maintainer, check the finding, and approve a draft. Publishing stays manual.</p><form class="field-form" id="social-form"><label for="social-proof">Public maintainer proof inside this repo</label><input id="social-proof" type="url" required placeholder="https://github.com/owner/repo/issues/…"><label for="social-credit">Credit: handle or Anonymous</label><input id="social-credit" value="Anonymous" maxlength="100" required><p class="checkbox-row"><input type="checkbox" id="is-maintainer" required><label for="is-maintainer">I maintain this repository and can establish that identity.</label></p><p class="checkbox-row"><input type="checkbox" id="social-consent" required><label for="social-consent">I explicitly opt in to featuring this finding in a social roast with the credit above.</label></p><button class="primary">Request manual verification</button><p id="social-error" role="alert"></p></form>`,
  );
  $("#social-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("/social", {
        method: "POST",
        body: JSON.stringify({
          report: report.id,
          finding: id,
          proof_url: $("#social-proof").value,
          credit: $("#social-credit").value,
          maintainer: $("#is-maintainer").checked,
          consent: $("#social-consent").checked,
        }),
      });
      $("#modal").close();
      notify(
        "Opt-in recorded. Pending manual verification; nothing published.",
      );
    } catch (error) {
      $("#social-error").textContent = error.message;
    }
  };
}
async function manageSocial() {
  try {
    const items = await api("/social");
    modal(
      "Your social permissions",
      `<h2 class="dialog-title">You stay in control.</h2>${items.length ? items.map((i) => `<div class="resource"><p>Report ${esc(i.report)} · ${esc(i.credit)} · ${i.revoked ? "Revoked" : i.verified_by ? "Verified" : "Pending verification"}</p>${!i.revoked ? `<button class="secondary" data-revoke="${esc(i.id)}">Revoke consent</button>` : ""}</div>`).join("") : '<p class="muted">No social roast permissions granted.</p>'}`,
    );
  } catch (error) {
    notify(error.message);
  }
}
async function socialAdmin() {
  try {
    const items = await api("/admin/social");
    modal(
      "Maintainer verification queue",
      `<h2 class="dialog-title">Verify consent before drafting.</h2><p class="small muted">Manually confirm the consenting account controls the repo. A submitted link alone does not prove ownership.</p>${items.map((i) => `<article class="resource"><p>Credit: ${esc(i.credit)} · report ${esc(i.report)}</p><a href="${esc(i.proof_url)}" target="_blank" rel="noopener">Inspect maintainer proof</a><div class="dialog-actions">${i.verified_by ? `<button class="secondary" data-draft="${esc(i.id)}">Preview reel draft</button>` : `<button class="secondary" data-verify="${esc(i.id)}">Record manual verification</button>`}</div></article>`).join("") || "<p>No pending requests.</p>"}`,
    );
  } catch (error) {
    notify(error.message);
  }
}
document.addEventListener("click", async (e) => {
  const el = e.target.closest("button");
  if (!el) return;
  if (el.dataset.social) offerSocial(el.dataset.social);
  if (el.id === "signin" && config.user)
    $("#modal-body").insertAdjacentHTML(
      "beforeend",
      '<p><button class="text-button" id="manage-social">Manage social permissions</button></p>',
    );
  if (el.id === "manage-social") manageSocial();
  if (el.dataset.revoke) {
    try {
      await api("/social/" + el.dataset.revoke, {
        method: "DELETE",
        body: "{}",
      });
      manageSocial();
    } catch (error) {
      notify(error.message);
    }
  }
  if (el.id === "social-admin") socialAdmin();
  if (el.dataset.verify) {
    const id = el.dataset.verify;
    modal(
      "Record manual verification",
      '<h2 class="dialog-title">How did you establish ownership?</h2><form class="field-form" id="verify-form"><label for="verify-notes">Evidence that this account is the consenting maintainer</label><textarea id="verify-notes" required minlength="20" maxlength="2000"></textarea><button class="primary">Confirm verification</button></form>',
    );
    $("#verify-form").onsubmit = async (event) => {
      event.preventDefault();
      try {
        await api("/admin/social/" + id + "/verify", {
          method: "POST",
          body: JSON.stringify({ notes: $("#verify-notes").value }),
        });
        socialAdmin();
      } catch (error) {
        notify(error.message);
      }
    };
  }
  if (el.dataset.draft) {
    try {
      const draft = await api("/admin/social/" + el.dataset.draft + "/draft");
      modal(
        "Reel draft · manual publishing",
        `<pre class="plan-text">${esc(draft)}</pre>`,
      );
    } catch (error) {
      notify(error.message);
    }
  }
});
const socialAdminObserver = new MutationObserver(() => {
  if (location.pathname === "/admin" && config.admin && !$("#social-admin"))
    $("#view .page")?.insertAdjacentHTML(
      "beforeend",
      '<button class="secondary" id="social-admin">Review social roast permissions</button>',
    );
});
socialAdminObserver.observe($("#view"), { childList: true, subtree: true });
setInterval(() => {
  if ($("#quota-line")) $("#quota-line").textContent = quotaText();
  updateAiControls();
}, 1000);
setInterval(() => {
  if (!document.hidden)
    refreshConfig().catch(() => {
      config.quota = {
        state: "unknown",
        message: "Cannot confirm AI availability",
      };
      config.receivedAt = Date.now() / 1000;
      updateAiControls();
    });
}, 10000);
window.addEventListener("focus", () =>
  refreshConfig().catch(() => {
    config.receivedAt = 0;
    updateAiControls();
  }),
);
(async () => {
  try {
    await refreshConfig();
  } catch {
    notify("Cannot reach the local server.");
  }
  await route();
})();
