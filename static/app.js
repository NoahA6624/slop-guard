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
  const res = await fetch("/api" + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let data;
    try {
      data = await res.json();
    } catch {
      data = { detail: "The request failed. Try again." };
    }
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Check the form fields and try again.",
    );
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
  const first = $("#modal-body").querySelector(
    "[autofocus], input:not([type=hidden]), textarea, select, button, a[href]",
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
  return `<div><div class="mode" role="group" aria-label="Report tone"><button data-mode="serious" class="${mode === "serious" ? "selected" : ""}" aria-pressed="${mode === "serious"}">Serious</button><button data-mode="satirical" class="${mode === "satirical" ? "selected" : ""}" aria-pressed="${mode === "satirical"}">Satirical</button></div><div class="mode-note">Same evidence. Different delivery.</div></div>`;
}
function changeMode(next) {
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
}
function home() {
  report = null;
  $("#view").innerHTML =
    `<div class="page"><section class="hero"><span class="eyebrow">A little less slop. A lot better code.</span><h1>My AI slop grades<span>your AI slop.</span></h1><p class="intro">An honest second look at your GitHub repo.<br>Find what’s fragile, see the evidence, and leave with a fix.</p>${modeControl()}</section><form class="scan-box" id="scan-form"><label for="repo">Your public GitHub repository</label><div class="input-group"><div class="repo-input"><span aria-hidden="true">⌘</span><input id="repo" name="repo" placeholder="github.com/you/your-project" required spellcheck="false" autocomplete="off" aria-describedby="repo-help"></div><button class="primary" id="grade">Grade my repo</button></div><div class="input-help" id="repo-help"><span>Public repos only. No sign-in. No code is ever run.</span><button type="button" class="text-button" id="self-scan">Grade Slop Guard itself</button></div><div id="scan-status" role="status" aria-live="polite"></div></form><section class="how" aria-label="How it works"><div><div class="step"><span class="step-num">1</span><h3>Drop in your repo</h3></div><p>We inspect a bounded snapshot.<br>Your code stays your code.</p></div><div><div class="step"><span class="step-num">2</span><h3>Get an honest read</h3></div><p>Two independent scores.<br>Every finding comes with receipts.</p></div><div><div class="step"><span class="step-num">3</span><h3>Make it better</h3></div><p>Take a focused Markdown fix plan<br>back to your coding agent.</p></div></section><section class="example-panel"><div class="example-intro"><span class="tiny-label">The kind of thing we catch · example</span><h2>Looks like a test.<br>Doesn’t test a thing.</h2><p>A green check is only useful when it can turn red.</p><a href="/methodology" class="small muted">See how grading works</a></div><div class="example-code"><div class="code-header"><span>tests/test_checkout.py</span><span>Illustrative fixture</span></div><pre>1  def test_checkout_succeeds():
2      assert True</pre><div class="example-verdict">${mode === "satirical" ? "“This test has never doubted you.”" : "This test passes even if the feature is removed."}</div></div></section><p class="disclaimer">We grade observable code quality. We don’t guess who—or what—wrote it.</p></div>`;
  $("#scan-form").onsubmit = submitScan;
  $("#repo-help").insertAdjacentHTML(
    "afterend",
    `<div class="ai-option"><label for="include-ai"><input id="include-ai" type="checkbox" ${config.quota?.state === "available" ? "checked" : ""} aria-describedby="ai-availability">Include a fresh AI review</label><span id="ai-availability" role="status" aria-live="polite"></span></div>`,
  );
  updateAiControls();
  $("#self-scan").onclick = () => {
    $("#repo").value = "NoahA6624/slop-guard";
    $("#scan-form").requestSubmit();
  };
}
async function submitScan(e) {
  e.preventDefault();
  const button = $("#grade");
  button.disabled = true;
  $("#scan-status").innerHTML =
    '<div class="progress">Resolving the commit and inspecting selected files…</div>';
  try {
    const result = await api("/scans", {
      method: "POST",
      body: JSON.stringify({
        repo: $("#repo").value.trim(),
        include_ai: Boolean(
          $("#include-ai")?.checked && !$("#include-ai").disabled,
        ),
      }),
    });
    navigate(`/reports/${result.id}?mode=${mode}`, false);
    report = result;
    renderReport();
    await refreshConfig();
  } catch (error) {
    $("#scan-status").innerHTML =
      `<p class="scan-error">${esc(error.message)}</p>`;
  } finally {
    if ($("#grade")) $("#grade").disabled = false;
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
  const det = r.findings.filter((f) => f.source === "deterministic").length;
  $("#view").innerHTML =
    `<div class="page"><div class="page-head"><div><span class="eyebrow">The repo report</span><h1>${esc(r.repo)}</h1><div class="report-meta">Commit <code>${esc(r.sha.slice(0, 8))}</code> · ${new Date(r.created * 1000).toLocaleDateString()} · Rubric ${esc(r.rubric)}${r.cache_hit ? " · Cached result" : ""}</div></div>${modeControl()}</div><div class="scores"><section class="score-block"><h2>Deterministic Slop Score</h2><div class="score-number">${r.score ?? "—"} <small>${r.score === null ? "insufficient coverage" : "/ 100"}</small></div><p class="score-description">Observable signals. Published rules. Higher means more slop.</p></section><section class="score-block"><h2>Probabilistic AI Slop</h2><div class="quota" id="quota-line">${esc(quotaText())}</div><div class="score-number">${r.ai.score ?? "—"} <small>${r.ai.score === null ? "not reviewed" : "/ 100"}</small></div><p class="score-description">${esc(r.ai.uncertainty)}</p></section></div><div class="coverage"><strong>${r.coverage.inspected} / ${r.coverage.eligible ?? "unknown"} eligible files inspected</strong><span>${esc(r.languages.join(" · ") || "No supported languages")}</span><span>${r.coverage.partial ? "Partial coverage" : "Bounded scan"} · ${Math.round(r.coverage.bytes / 1024)} KB</span></div><div class="report-actions"><button class="primary" id="fix-plan" ${r.findings.length ? "" : 'disabled title="No actionable findings to export"'}>Fix My AI Slop</button><button class="secondary" id="roast">Roast My Repo</button><button class="secondary" id="share-report">Copy report link</button><a class="text-button small" href="/">Grade another repo</a></div><div class="section-title"><h2>${mode === "satirical" ? "The code can take it." : "What needs your attention"}</h2><span class="small muted">${r.findings.length} findings · ${det} deterministic · evidence at ${esc(r.sha.slice(0, 8))}</span></div>${r.findings.length ? r.findings.map((f, i) => `${i === 3 ? '<details class="more-findings"><summary>Show remaining findings</summary>' : ""}${findingHtml(f)}${i === r.findings.length - 1 && i >= 3 ? "</details>" : ""}`).join("") : '<div class="empty"><h2>No supported findings in this snapshot.</h2><p>This does not prove the repo is defect-free. Check the inspected scope and skipped checks below.</p></div>'}<details class="details"><summary>Coverage, metrics, and skipped checks</summary><div class="metrics-grid"><div><strong>${r.metrics.lines}</strong><span>Lines inspected</span></div><div><strong>${r.metrics.average_file_length}</strong><span>Average lines per file</span></div><div><strong>${Math.round(r.metrics.comment_density * 100)}%</strong><span>Comment line density, headers excluded</span></div></div><p>File length distribution: ${esc(r.metrics.file_lengths.join(", ") || "No files")} lines.</p><ul>${[...r.coverage.reasons, ...r.checks].map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p>Comments carry zero points. Style signals are capped at 5 points. <a href="/methodology">Read the rubric.</a></p></details></div>`;
  $("#fix-plan").onclick = openPlan;
  $("#roast").onclick = () => changeMode("satirical");
  $("#share-report").onclick = () => copy(location.href);
  if (focusHash && location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) {
      target.closest("details")?.setAttribute("open", "");
      requestAnimationFrame(() => target.scrollIntoView());
    }
  }
}
function findingHtml(f) {
  return `<article class="finding" id="finding-${esc(f.id)}"><div class="finding-top"><span class="badge ${f.source !== "deterministic" ? "model" : ""}">${esc(f.source !== "deterministic" ? "MODEL REVIEW" : f.rule)}</span><span class="finding-path">${esc(f.path)}:${f.start}${f.end !== f.start ? "–" + f.end : ""}</span><span class="small muted">${esc(f.confidence)} confidence${f.source === "deterministic" ? ` · ${f.contribution} raw normalized points` : ""}</span></div><h3>${esc(mode === "satirical" ? f.roast : f.title)}</h3><p>${esc(f.consequence)}</p><pre class="evidence"><code>${esc(f.evidence)}</code></pre><p><strong>Fix:</strong> ${esc(f.fix)}</p><p><strong>Verify:</strong> ${esc(f.check)}</p><div class="finding-actions"><a href="${esc(f.url)}" target="_blank" rel="noopener">View source at commit</a><button class="text-button" data-share="${esc(f.id)}">Share finding</button><button class="text-button" data-discuss="${esc(f.id)}">Discuss this finding</button><button class="text-button" data-discuss="${esc(f.id)}">Bad call?</button><a href="/library">Find a useful tool</a><button class="text-button" data-social="${esc(f.id)}">Offer for a social roast</button></div></article>`;
}
async function openPlan() {
  try {
    plan = await api(`/reports/${report.id}/plan`);
    modal(
      "Fix My AI Slop",
      `<h2 class="dialog-title">A plan you can actually act on.</h2><p class="small muted">${report.findings.some((f) => f.source !== "deterministic") ? "Cached model review" : "Deterministic checklist"} · No new AI call</p><pre class="plan-text">${esc(plan)}</pre><div class="dialog-actions"><button class="primary" id="copy-plan">Copy Markdown</button><a class="secondary" href="/api/reports/${report.id}/plan?download=true" download="SLOP_FIX_PLAN.md">Download SLOP_FIX_PLAN.md</a></div>`,
    );
    $("#copy-plan").onclick = () => copy(plan);
  } catch (e) {
    notify(e.message);
  }
}
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    notify("Copied to clipboard.");
  } catch {
    modal(
      "Copy text",
      `<p>Select and copy the text below.</p><textarea class="plan-text" readonly>${esc(text)}</textarea>`,
    );
  }
}
async function refreshConfig() {
  config = await api("/config");
  config.receivedAt = Date.now() / 1000;
  $("#signin").textContent = config.user ? config.user.name : "Sign in";
  if ($("#quota-line")) $("#quota-line").textContent = quotaText();
  updateAiControls();
}
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
function pageHeader(eyebrow, title, intro, button = "") {
  return `<div class="page-head"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p class="muted">${intro}</p></div>${button}</div>`;
}
async function community() {
  const records = await api(`/content?kind=project&sort=${sort}`);
  currentItems = records;
  $("#view").innerHTML =
    `<div class="page">${pageHeader("Built with AI. Improved by people.", "Community Slop", "Projects, lessons learned, and the parts that still need work.", '<button class="primary" id="add-project">Share a project</button>')}<div class="toolbar"><div class="tabs" role="group" aria-label="Sort"><button data-sort="new" aria-pressed="${sort === "new"}" class="${sort === "new" ? "active" : ""}">New</button><button data-sort="top" aria-pressed="${sort === "top"}" class="${sort === "top" ? "active" : ""}">Top</button></div><span class="small muted">Community votes are popularity, not engineering scores.</span></div>${records.length ? records.map(itemHtml).join("") : '<div class="empty"><h2>The first honest project story goes here.</h2><p>Share your public repo, what you built, and what you’re still figuring out. Running a scan never posts your repo here.</p></div>'}</div>`;
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
    `<div class="page">${pageHeader("Keep the useful parts. Fix the rest.", "Anti-Slop Library", "Tools and workflows that catch specific failures. No magic prompts.", '<button class="primary" id="add-resource">Suggest a resource</button>')}<div class="toolbar"><input id="resource-search" type="search" placeholder="Search tools, failures, workflows…" aria-label="Search the library"><div class="tabs" role="group" aria-label="Sort"><button data-sort="new" aria-pressed="${sort === "new"}" class="${sort === "new" ? "active" : ""}">New</button><button data-sort="top" aria-pressed="${sort === "top"}" class="${sort === "top" ? "active" : ""}">Top</button></div></div><div id="resource-list">${seeds.map((r) => `<article class="resource" data-search="${esc(JSON.stringify(r).toLowerCase())}"><span class="tiny-label">${esc(r.type)} · ${esc(r.author)} · curated</span><h2>${esc(r.title)}</h2><p>${esc(r.failure)}</p><p><strong>Use it when:</strong> ${esc(r.when)}</p><a href="${esc(r.url)}" target="_blank" rel="noopener">Original resource</a></article>`).join("")}${submitted.map(itemHtml).join("")}</div><p class="small muted" id="no-resources" hidden>No resources match that search.</p></div>`;
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
    `<div class="page">${pageHeader("Good code comes from good arguments.", "Slop Form", "Ask a question. Challenge a finding. Bring the evidence.", '<button class="primary" id="add-topic">Start a topic</button>')}${selected ? '<p><a href="/forum" class="small muted">All topics</a></p>' : ""}${
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
          : '<div class="empty"><h2>Room for a useful conversation.</h2><p>Disagree with a finding? Use “Discuss this finding” in a report to start a topic with its exact evidence attached.</p></div>'
    }</div>`;
  $("#add-topic").onclick = () => contribute("topic");
}
async function portfolio() {
  const entries = await api("/portfolio");
  $("#view").innerHTML =
    `<div class="page">${pageHeader("The maintainer’s workbench", "My Slop", "AI-assisted projects, with an honest account of what got fixed.")}<p class="notice">Owner-curated portfolio. Community submissions live in Community Slop.</p>${entries.length ? entries.map((x) => `<article class="resource"><h2>${esc(x.title)}</h2><p>${esc(x.description)}</p><p>${esc(x.notes)}</p><a href="${esc(x.repo)}" target="_blank" rel="noopener">Public repository</a>${x.demo ? ` · <a href="${esc(x.demo)}" target="_blank" rel="noopener">Live demo</a>` : ""}</article>`).join("") : '<div class="empty"><h2>Still building. Nothing to dress up.</h2><p>The maintainer hasn’t published portfolio entries yet. Add real projects through <code>content/portfolio.json</code>, including the repo and a note on what was fixed.</p></div>'}</div>`;
}
function methodology() {
  $("#view").innerHTML =
    `<div class="page prose">${pageHeader("Evidence before opinion", "How grading works", "Two independent signals. A visible scope. A useful next step.")}<p>Slop Guard reviews observable code quality. Neither score estimates whether a person or an AI wrote the code. Higher scores mean more observed problems, on a scale of 0–100.</p><h2>Deterministic rubric · v1.0</h2><table><thead><tr><th>Signal</th><th>Raw points</th><th>What it means</th></tr></thead><tbody><tr><td>Tautological Python test</td><td>18</td><td>A test body contains only assertions of literal True.</td></tr><tr><td>Identical Python branches</td><td>12</td><td>The two AST branches have identical statements.</td></tr><tr><td>Ruff undefined name F821</td><td>10</td><td>A referenced Python name is not defined.</td></tr><tr><td>TypeScript syntax diagnostic</td><td>8</td><td>Trusted compiler parser rejects the syntax.</td></tr><tr><td>Unused import / variable</td><td>2</td><td>Ruff F401 / F841, with isolated configuration.</td></tr><tr><td>File &gt;500 / function &gt;80 lines</td><td>1 each</td><td>Weak signals, combined cap of 5.</td></tr><tr><td>Comment length or density</td><td>0</td><td>Descriptive metrics only; verbosity is not a defect.</td></tr></tbody></table><p>Normalize substantive points by <code>max(1, inspected lines / 1,000)</code>, round and cap at 95. Add weak style points capped at 5. Each emitted rule/location is unique; separate rules can describe separate issues. Fewer than 10 inspected lines yields “insufficient coverage.” Partial scans describe only their inspected subset.</p><p>Worked example: a 500-line snapshot with one useless test (18) and two unused imports (4) scores 22. A long, useful 100-line comment scores 0. A 2,000-line snapshot with the same findings scores 11.</p><h2>Probabilistic AI Slop</h2><p>When an eligible free review provider is configured (Groq GPT-OSS by default, or Gemini Flash for an eligible pilot), it reviews bounded excerpts for contextual defects. We require a file path, line range, exact quotation, consequence, correction, and acceptance check. Invalid evidence is discarded. Confidence is a model judgment: high findings contribute 18, medium 9, low 3, capped at 100. This is not a calibrated probability. A matching quote confirms the evidence, not the interpretation.</p><h2>What a scan can—and cannot—cover</h2><p>Up to 35 files, 40 KB per file, 280 KB total, in stable path order. Python and JS/TS source only. Generated, binary, minified, vendored, lock, symlink, and submodule content is excluded. No cloning, dependency installation, submitted code execution, or repository-supplied executable configuration. Type checking and dependency-aware JS/TS unused-name checks are explicitly skipped. A bounded README is checked for literal Python or Node commands pointing to missing source scripts, when the tree is complete; working-directory intent still needs review.</p><p>The app publishes coverage and skipped checks. A low score is not proof of correctness. Snapshots and model reviews are cached by commit and review configuration. Mode switches and fix-plan exports make no model calls.</p><h2>Sources behind the approach</h2><ul><li><a href="https://google.github.io/eng-practices/review/reviewer/looking-for.html">Google Engineering Practices: review behavior, tests, and complexity</a></li><li><a href="https://docs.astral.sh/ruff/rules/">Astral: Ruff rules and correctness checks</a></li><li><a href="https://www.typescriptlang.org/docs/handbook/compiler-api.html">Microsoft: TypeScript compiler API</a></li><li><a href="https://ai.google.dev/gemini-api/docs/rate-limits">Google: project quotas and Pacific daily reset</a></li><li><a href="https://ai.google.dev/gemini-api/terms">Google: free-tier terms and audience restrictions</a></li></ul></div>`;
}
async function moderation() {
  const records = await api("/admin");
  $("#view").innerHTML =
    `<div class="page">${pageHeader("Admin only", "Moderation", "Review reported contributions.")} ${records.length ? records.map((r) => `<article class="resource"><h2>${esc(r.title)}</h2><p>${esc(r.body)}</p><p><strong>Report reason:</strong> ${esc(r.reason)}</p><button class="secondary" data-hide="${esc(r.item)}">Hide contribution</button></article>`).join("") : '<p class="muted">No unresolved reports.</p>'}</div>`;
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
    "/portfolio": "My Slop",
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
    copy(url.href);
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
