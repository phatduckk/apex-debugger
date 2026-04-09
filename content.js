(function () {
  'use strict';

  let STATUS_URL  = '';
  let CONFIG_URL  = '';
  const POLL_MS   = 5000;

  let enabled    = false;
  let pollTimer  = null;
  let lastCtx    = null;
  let lastSeason = null;
  let editorObserver = null;
  let helpOpen = false;
  let lastUrl    = location.href;

  const HELP_MIN_H   = 160;
  const HELP_MAX_H   = () => Math.round(window.innerHeight * 0.80);
  const HELP_DEF_H   = 340;

  // ── Colors ─────────────────────────────────────────────────────────────────

  const BG = {
    green:   '#c8f7c5',
    red:     '#f7c5c5',
    grey:    '#e0e0e0',
    neutral: '',
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  function isOutputOn(s) {
    return s === 'AON' || s === 'TBL' || s === 'ON';
  }

  // Converts "HH:MM" to total minutes since midnight
  function hmToMin(hm) {
    const [h, m] = hm.split(':').map(Number);
    return h * 60 + m;
  }

  // Returns true if currentMin is within [startMin, endMin] range,
  // handling midnight-spanning ranges (e.g. 21:00 to 03:00)
  function timeInRange(startMin, endMin, nowMin) {
    if (startMin <= endMin) {
      return nowMin >= startMin && nowMin <= endMin;
    } else {
      // spans midnight
      return nowMin >= startMin || nowMin <= endMin;
    }
  }

  // ── Condition evaluator ────────────────────────────────────────────────────

  function evaluateLine(text, ctx) {
    const { inputs, outputs, intensities, nowMin, dowIndex, activeFeed, season, monthIndex } = ctx;
    const t = text.trim();

    // Blank lines → neutral
    if (!t) return 'neutral';

    // Fallback → neutral
    if (/^Fallback\s+(ON|OFF)$/i.test(t)) return 'neutral';

    // Set ON|OFF → always executes; green for ON, red for OFF
    if (/^Set\s+ON$/i.test(t))  return 'green';
    if (/^Set\s+OFF$/i.test(t)) return 'red';

    // Set [PROFILE] → neutral
    if (/^Set\s+\S+$/i.test(t)) return 'neutral';

    // Defer → neutral (positional, not a true conditional)
    if (/^Defer\s+/i.test(t)) return 'neutral';

    // Non-conditional timer statements → grey (need outlet history)
    if (/^(Min\s+Time|When)\s+/i.test(t)) return 'grey';

    // OSC → grey (computable but complex, deferred)
    if (/^OSC\s+/i.test(t)) return 'grey';

    // Must be an If...Then line from here on
    // Then clause can be ON, OFF, or a profile name (\S+)
    const ifm = t.match(/^If\s+(.+?)\s+Then\s+(\S+)$/i);
    if (!ifm) return 'grey';

    const cond    = ifm[1].trim();
    const thenVal = ifm[2].toUpperCase();

    // Lines with a profile name in the Then clause → neutral (can't evaluate profile state)
    if (thenVal !== 'ON' && thenVal !== 'OFF') return 'neutral';

    let m;

    // ── If Time HH:MM to HH:MM ──────────────────────────────────────────────
    m = cond.match(/^Time\s+(\d{1,2}:\d{2})\s+to\s+(\d{1,2}:\d{2})$/i);
    if (m) {
      const startMin = hmToMin(m[1]);
      const endMin   = hmToMin(m[2]);
      return timeInRange(startMin, endMin, nowMin) ? 'green' : 'red';
    }

    // ── If DOW SMTWTFS ──────────────────────────────────────────────────────
    m = cond.match(/^DOW\s+([SMTWTFS\-]{7})$/i);
    if (m) {
      const pattern = m[1].toUpperCase();
      return pattern[dowIndex] !== '-' ? 'green' : 'red';
    }

    // ── If FeedA/B/C/D MMM ─────────────────────────────────────────────────
    m = cond.match(/^(FeedA|FeedB|FeedC|FeedD)\s+\d+$/i);
    if (m) {
      const feedMap = { feeda: 1, feedb: 2, feedc: 3, feedd: 4 };
      const expected = feedMap[m[1].toLowerCase()];
      return activeFeed === expected ? 'green' : 'red';
    }

    // ── If Output|Outlet <name> = ON|OFF ───────────────────────────────────
    m = cond.match(/^(?:Output|Outlet)\s+(\S+)\s+=\s+(ON|OFF)$/i);
    if (m) {
      const out = outputs[m[1].toLowerCase()];
      if (out === undefined) return 'grey';
      const targetOn = m[2].toUpperCase() === 'ON';
      return isOutputOn(out) === targetOn ? 'green' : 'red';
    }

    // ── If Output|Outlet <name> Percent > < val ────────────────────────────
    m = cond.match(/^(?:Output|Outlet)\s+(\S+)\s+Percent\s+([<>])\s+([0-9.]+)$/i);
    if (m) {
      const pct = intensities[m[1].toLowerCase()];
      if (pct === undefined) return 'grey';
      const threshold = parseFloat(m[3]);
      return m[2] === '>' ? (pct > threshold ? 'green' : 'red')
                          : (pct < threshold ? 'green' : 'red');
    }

    // ── If <input> OPEN|CLOSED ─────────────────────────────────────────────
    // Confirmed: value 0 = OPEN, value 200 = CLOSED
    m = cond.match(/^(\S+)\s+(OPEN|CLOSED)$/i);
    if (m) {
      const val = inputs[m[1].toLowerCase()];
      if (val === undefined) return 'grey';
      const isOpen = m[2].toUpperCase() === 'OPEN';
      return (isOpen ? val === 0 : val === 200) ? 'green' : 'red';
    }

    // ── If <probe> > < val (with optional RT+ suffix) ──────────────────────
    m = cond.match(/^(\S+)\s+([<>])\s+(.+)$/i);
    if (m) {
      if (/^RT\+/i.test(m[3])) {
        // RT+ seasonal temperature comparison
        if (!season) return 'grey';
        const diff      = parseFloat(m[3].slice(3)) || 0;
        const threshold = season.temp[monthIndex] + diff;
        const val       = inputs[m[1].toLowerCase()];
        if (val === undefined) return 'grey';
        return m[2] === '>' ? (val > threshold ? 'green' : 'red')
                            : (val < threshold ? 'green' : 'red');
      }

      const val = inputs[m[1].toLowerCase()];
      if (val === undefined) return 'grey';
      const threshold = parseFloat(m[3]);
      if (isNaN(threshold)) return 'grey';
      return m[2] === '>' ? (val > threshold ? 'green' : 'red')
                          : (val < threshold ? 'green' : 'red');
    }

    // ── If Error <name> ────────────────────────────────────────────────────
    m = cond.match(/^Error\s+(\S+)$/i);
    if (m) {
      const out = outputs[m[1].toLowerCase()];
      if (out === undefined) return 'grey';
      return out === 'ERR' ? 'green' : 'red';
    }

    // ── If Sun [+/-MMM]/[+/-MMM] ───────────────────────────────────────────
    m = cond.match(/^Sun\s+([+-]?\d+)\/([+-]?\d+)$/i);
    if (m) {
      if (!season) return 'grey';
      const sunriseMin = hmToMin(season.sunrise[monthIndex]) + parseInt(m[1], 10);
      const sunsetMin  = hmToMin(season.sunset[monthIndex])  + parseInt(m[2], 10);
      return timeInRange(sunriseMin, sunsetMin, nowMin) ? 'green' : 'red';
    }

    // ── If Moon [+/-MMM]/[+/-MMM] ──────────────────────────────────────────
    m = cond.match(/^Moon\s+([+-]?\d+)\/([+-]?\d+)$/i);
    if (m) {
      if (!season) return 'grey';
      const moonriseMin = hmToMin(season.moonrise[monthIndex]) + parseInt(m[1], 10);
      const moonsetMin  = hmToMin(season.moonset[monthIndex])  + parseInt(m[2], 10);
      return timeInRange(moonriseMin, moonsetMin, nowMin) ? 'green' : 'red';
    }

    // ── If Power → grey ────────────────────────────────────────────────────
    return 'grey';
  }

  // ── Status fetch ───────────────────────────────────────────────────────────

  async function fetchStatus() {
    try {
      const r = await fetch(STATUS_URL, { cache: 'no-store' });
      return (await r.json()).istat;
    } catch (_) {
      return null;
    }
  }

  async function fetchSeason() {
    try {
      const r = await fetch(`${CONFIG_URL}?_=${Date.now()}`, { cache: 'no-store' });
      return (await r.json()).season || null;
    } catch (_) {
      return null;
    }
  }

  function buildContext(istat) {
    const inputs      = {};
    const outputs     = {};
    const intensities = {};

    for (const inp of istat.inputs) {
      inputs[inp.name.toLowerCase()] = inp.value;
    }
    for (const out of istat.outputs) {
      const key = out.name.toLowerCase();
      outputs[key]     = out.status[0];
      if (out.intensity !== undefined) intensities[key] = out.intensity;
    }

    // Current time from Apex clock (Unix timestamp)
    const now        = new Date(istat.date * 1000);
    const nowMin     = now.getHours() * 60 + now.getMinutes();
    // DOW index: 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat (matches SMTWTFS)
    const dowIndex   = now.getDay();
    // Month index for season arrays: 0=Jan, 11=Dec
    const monthIndex = now.getMonth();

    // Feed: active=0 means none; name 1=A,2=B,3=C,4=D (verify against real data)
    const activeFeed = istat.feed && istat.feed.active ? istat.feed.name : 0;

    return { inputs, outputs, intensities, nowMin, dowIndex, activeFeed, monthIndex };
  }

  // ── Apply / clear colors ───────────────────────────────────────────────────

  function applyColors(ctx) {
    const lines     = document.querySelectorAll('.cm-content .cm-line');
    // Index 0 is the invisible spacer; real lines start at 1
    const gutterEls = document.querySelectorAll('.cm-lineNumbers .cm-gutterElement');

    // Pass 1: evaluate every line
    const results = Array.from(lines).map(line => evaluateLine(line.textContent, ctx));

    // Pass 2: find the last statement that unconditionally or conditionally sets ON|OFF
    // Green lines: true If/Then ON|OFF or Set ON
    // Red lines: Set OFF (unconditional, always fires — not a false condition)
    let winnerIdx        = -1;
    let winnerFinalState = null;
    lines.forEach((line, i) => {
      const t = line.textContent.trim();
      if (results[i] === 'green') {
        const m = t.match(/\bThen\s+(ON|OFF)\s*$/i) || t.match(/^Set\s+ON$/i);
        if (m) { winnerIdx = i; winnerFinalState = m[1] ? m[1].toUpperCase() : 'ON'; }
      } else if (results[i] === 'red' && /^Set\s+OFF$/i.test(t)) {
        winnerIdx = i; winnerFinalState = 'OFF';
      }
    });

    // Pass 3: apply
    // Line background — use nth-child CSS rule so it survives element recreation by CodeMirror
    let winnerStyle = document.getElementById('apex-winner-style');
    if (!winnerStyle) {
      winnerStyle = document.createElement('style');
      winnerStyle.id = 'apex-winner-style';
      document.head.appendChild(winnerStyle);
    }
    if (winnerIdx < 0) {
      winnerStyle.textContent = '';
    } else {
      const color = winnerFinalState === 'ON' ? BG.green : BG.red;
      winnerStyle.textContent =
        `.cm-content > .cm-line:nth-child(${winnerIdx + 1}) { background-color: ${color} !important; }`;
    }

    // Gutter: per-line color + tooltip data
    lines.forEach((line, i) => {
      const gEl = gutterEls[i + 1];
      if (!gEl) return;
      gEl.style.backgroundColor = BG[results[i]] ?? '';
      const tip = buildTipText(line.textContent, results[i], i === winnerIdx, winnerFinalState);
      if (tip) {
        gEl.dataset.apexTip   = tip;
        gEl.dataset.apexColor = results[i];
      } else {
        delete gEl.dataset.apexTip;
        delete gEl.dataset.apexColor;
      }
    });
  }

  function clearColors() {
    const winnerStyle = document.getElementById('apex-winner-style');
    if (winnerStyle) winnerStyle.textContent = '';
    document.querySelectorAll('.cm-lineNumbers .cm-gutterElement')
      .forEach(el => (el.style.backgroundColor = ''));
  }

  // ── Refresh cycle ──────────────────────────────────────────────────────────

  async function refresh() {
    if (!enabled) return;
    const istat = await fetchStatus();
    if (!istat) return;
    lastCtx = { ...buildContext(istat), season: lastSeason };
    applyColors(lastCtx);
  }

  let editorRafId  = null;
  let applyPending = false;

  function startEditorObserver() {
    const content = document.querySelector('.cm-content');
    if (!content || editorObserver) return;

    editorObserver = new MutationObserver((mutations) => {
      if (!enabled || !lastCtx) return;

      // Detect if CodeMirror added new .cm-line elements (line recreation on focus/scroll)
      const hasNewLines = mutations.some(m =>
        m.type === 'childList' &&
        [...m.addedNodes].some(n => n.nodeType === 1 && n.classList?.contains('cm-line'))
      );

      if (hasNewLines) {
        // New line elements in DOM — apply immediately so classes are set before paint
        if (editorRafId) { cancelAnimationFrame(editorRafId); editorRafId = null; }
        applyPending = false;
        applyColors(lastCtx);
        // Settle pass after all mutations in this batch complete
        editorRafId = requestAnimationFrame(() => {
          editorRafId = null;
          if (enabled && lastCtx) applyColors(lastCtx);
        });
      } else if (!applyPending) {
        // Text-only change (typing) — debounce with rAF to avoid excessive calls
        applyPending = true;
        editorRafId = requestAnimationFrame(() => {
          editorRafId  = null;
          applyPending = false;
          if (enabled && lastCtx) applyColors(lastCtx);
        });
      }
    });
    editorObserver.observe(content, { childList: true, subtree: true, characterData: true });
  }

  function stopEditorObserver() {
    if (editorObserver) {
      editorObserver.disconnect();
      editorObserver = null;
    }
    applyPending = false;
  }

  // ── Gutter tooltip ────────────────────────────────────────────────────────

  function buildTipText(lineText, result, isWinner, winnerFinalState) {
    const t = lineText.trim();
    if (!t) return null;

    if (result === 'neutral') {
      return 'Neutral — no effect on outlet state';
    }

    if (result === 'grey') {
      return 'Cannot evaluate\nRequires outlet history or data not in status.json\n(Sun, Moon, OSC, Defer, Min Time, When, Power…)';
    }

    // Set ON / Set OFF
    if (/^Set\s+ON$/i.test(t)) {
      return 'Always executes → sets outlet ON' +
        (isWinner ? '\n\n★ This line is responsible for setting the outlet ON' : '');
    }
    if (/^Set\s+OFF$/i.test(t)) {
      return 'Always executes → sets outlet OFF' +
        (isWinner ? '\n\n★ This line is responsible for setting the outlet OFF' : '');
    }

    // If ... Then ...
    const ifm = t.match(/^If\s+(.+?)\s+Then\s+(\S+)$/i);
    if (ifm) {
      const cond    = ifm[1];
      const thenVal = ifm[2].toUpperCase();
      const isTrue  = result === 'green';
      let tip = `Condition: ${cond}\nState: ${isTrue ? 'TRUE' : 'FALSE'}`;
      if (isWinner) tip += `\n\n★ This line is responsible for setting the outlet ${thenVal}`;
      return tip;
    }

    return null;
  }

  function initGutterTooltip() {
    const tip = document.createElement('div');
    tip.id = 'apex-gutter-tip';
    document.body.appendChild(tip);

    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest?.('.cm-lineNumbers .cm-gutterElement[data-apex-tip]');
      if (!el) { tip.style.display = 'none'; return; }

      const rect = el.getBoundingClientRect();
      tip.textContent = el.dataset.apexTip;
      tip.style.borderColor = { green: '#4caf50', red: '#e05555', grey: '#999', neutral: '#666' }[el.dataset.apexColor] ?? '#888';
      tip.style.top  = rect.top + 'px';
      tip.style.left = (rect.right + 10) + 'px';
      tip.style.display = 'block';

      // Flip up if it overflows the bottom
      const tipRect = tip.getBoundingClientRect();
      if (tipRect.bottom > window.innerHeight - 8) {
        tip.style.top = (rect.bottom - tipRect.height) + 'px';
      }
    });

    document.addEventListener('mouseleave', (e) => {
      if (e.target.closest?.('.cm-lineNumbers')) tip.style.display = 'none';
    }, true);
  }

  // ── Help panel ─────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('apex-debug-styles')) return;
    const s = document.createElement('style');
    s.id = 'apex-debug-styles';
    s.textContent = `
      #apex-help-panel {
        position: fixed; bottom: 0; left: 0; right: 0;
        height: ${HELP_DEF_H}px;
        background: #fff; color: #333;
        font-family: system-ui, sans-serif; font-size: 13px;
        z-index: 999999;
        display: flex; flex-direction: column;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.18);
        transform: translateY(100%);
        transition: transform 0.2s ease;
        border-top: 2px solid #d0d0d0;
      }
      #apex-help-panel.open { transform: translateY(0); }
      #apex-help-handle {
        height: 8px; background: #e8e8e8; cursor: ns-resize;
        flex-shrink: 0; display: flex; align-items: center; justify-content: center;
      }
      #apex-help-handle:hover { background: #ddd; }
      #apex-help-handle::after {
        content: ''; width: 36px; height: 3px;
        background: #bbb; border-radius: 2px;
      }
      #apex-help-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 6px 14px; background: #222; flex-shrink: 0;
      }
      #apex-help-header span { display: flex; align-items: center; gap: 7px; font-weight: 400; font-size: 14px; color: #9a9a9a; letter-spacing: normal; text-transform: none; }
      #apex-help-close {
        background: none; border: none; color: #888;
        font-size: 18px; cursor: pointer; padding: 0 2px; line-height: 1;
      }
      #apex-help-close:hover { color: #fff; }
      #apex-help-body { overflow-y: auto; flex: 1; padding: 10px 16px 16px; background: #f5f5f5; }
      #apex-help-body h3 {
        color: #e07820; margin: 14px 0 5px; font-size: 11px;
        text-transform: uppercase; letter-spacing: 0.07em; font-weight: 700;
        border-bottom: 1px solid #ddd; padding-bottom: 3px;
      }
      #apex-help-body h3:first-child { margin-top: 0; }
      #apex-help-body table { border-collapse: collapse; width: 100%; margin-bottom: 4px; }
      #apex-help-body td { padding: 3px 10px 3px 0; vertical-align: top; line-height: 1.45; color: #333; }
      #apex-help-body td:first-child { white-space: nowrap; font-family: monospace; font-size: 12px; color: #2a6496; padding-right: 16px; }
      #apex-help-body tr:nth-child(even) td { background: rgba(0,0,0,0.03); }
      #apex-help-body td code { font-family: monospace; color: #c0392b; }
      #apex-gutter-tip {
        position: fixed; z-index: 999998; pointer-events: none; display: none;
        background: #222; color: #eee;
        font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.6;
        padding: 6px 10px; border-radius: 4px; border-left: 3px solid #888;
        max-width: 320px; box-shadow: 0 2px 10px rgba(0,0,0,0.35);
        white-space: pre-wrap;
      }
      .adh-swatch {
        display: inline-block; width: 11px; height: 11px;
        border-radius: 2px; vertical-align: middle; margin-right: 5px;
        border: 1px solid rgba(0,0,0,0.15);
      }
      #apex-debug-toggle, #apex-debug-help {
        background-color: rgba(71,73,73,0.65) !important;
        border-color: rgba(71,73,73,0.65) !important;
        color: #fff !important;
      }
      #apex-debug-toggle.active, #apex-debug-help.active {
        background-color: rgb(71,73,73) !important;
        border-color: rgb(71,73,73) !important;
        color: #fff !important;
      }
    `;
    document.head.appendChild(s);
  }

  const HELP_CONTENT = `
    <h3>Color legend</h3>
    <table>
      <tr><td><span class="adh-swatch" style="background:#c8f7c5"></span>Green gutter</td><td>Condition is currently <strong>true</strong></td></tr>
      <tr><td><span class="adh-swatch" style="background:#f7c5c5"></span>Red gutter</td><td>Condition is currently <strong>false</strong></td></tr>
      <tr><td><span class="adh-swatch" style="background:#e0e0e0"></span>Grey gutter</td><td>Cannot evaluate (Sun, Moon, OSC, timers…)</td></tr>
      <tr><td>No color</td><td>Neutral — Fallback, Set [profile], blank lines</td></tr>
      <tr><td><span class="adh-swatch" style="background:#c8f7c5"></span>Green line bg</td><td>Winning statement → outlet will be <strong>ON</strong></td></tr>
      <tr><td><span class="adh-swatch" style="background:#f7c5c5"></span>Red line bg</td><td>Winning statement → outlet will be <strong>OFF</strong></td></tr>
    </table>

    <h3>How it works</h3>
    <table>
      <tr><td></td><td>Statements evaluate top-to-bottom. The <strong>last true statement wins</strong> and determines the physical output state.</td></tr>
      <tr><td></td><td>Status refreshes every 5 s from the Apex. Colors update instantly as you type.</td></tr>
    </table>

    <h3>Evaluable — If / Then</h3>
    <table>
      <tr><td>If Time HH:MM to HH:MM Then ON|OFF</td><td>True if current time is in range. Midnight-spanning ok (e.g. <code>21:00 to 03:00</code>). Inclusive both ends.</td></tr>
      <tr><td>If DOW SMTWTFS Then ON|OFF</td><td>7 chars S M T W T F S. Hyphen = skip day. e.g. <code>-MTWTF-</code> = weekdays only.</td></tr>
      <tr><td>If [Probe] &gt; [val] Then ON|OFF</td><td>Temp, pH, ORP, Salt, or any named probe — greater-than comparison.</td></tr>
      <tr><td>If [Probe] &lt; [val] Then ON|OFF</td><td>Same probe, less-than comparison.</td></tr>
      <tr><td>If [Input] OPEN Then ON|OFF</td><td>Digital switch — OPEN = value 0.</td></tr>
      <tr><td>If [Input] CLOSED Then ON|OFF</td><td>Digital switch — CLOSED = value 200.</td></tr>
      <tr><td>If Output [name] = ON|OFF Then ON|OFF</td><td>Tests another outlet's current on/off state.</td></tr>
      <tr><td>If Outlet [name] = ON|OFF Then ON|OFF</td><td>Identical to Output (older firmware keyword).</td></tr>
      <tr><td>If Output [name] Percent &gt; [val] Then ON|OFF</td><td>Tests variable output intensity 0–100.</td></tr>
      <tr><td>If Output [name] Percent &lt; [val] Then ON|OFF</td><td>Same, less-than.</td></tr>
      <tr><td>If FeedA|B|C|D MMM Then ON|OFF</td><td>True if that feed cycle is active. MMM = delay minutes after cycle ends.</td></tr>
      <tr><td>If Error [name] Then ON|OFF</td><td>True if the named outlet is in ERR state (overload / short circuit).</td></tr>
      <tr><td>If Sun [+/-MMM]/[+/-MMM] Then ON|OFF</td><td>True if current time is between (sunrise + offset1) and (sunset + offset2). Data from /rest/config.</td></tr>
      <tr><td>If Moon [+/-MMM]/[+/-MMM] Then ON|OFF</td><td>True if current time is between (moonrise + offset1) and (moonset + offset2). Data from /rest/config.</td></tr>
      <tr><td>If [Probe] &lt; RT+[val] Then ON|OFF</td><td>Compares probe to seasonal regional temp ± differential. e.g. <code>RT+0.4</code>, <code>RT+-0.4</code>, <code>RT+</code>. Data from /rest/config.</td></tr>
    </table>

    <h3>Always executes</h3>
    <table>
      <tr><td>Set ON|OFF</td><td>Unconditionally sets the outlet register. Always green — participates in winner selection.</td></tr>
      <tr><td>Set [Profile]</td><td>Sets a named profile. Treated as neutral — profile state can't be evaluated.</td></tr>
      <tr><td>Fallback ON|OFF</td><td>What the physical outlet does if communication with the base unit is lost. Neutral.</td></tr>
    </table>

    <h3>Cannot evaluate — always grey</h3>
    <table>
      <tr><td>OSC MMM:SS/MMM:SS/MMM:SS</td><td>Oscillate. Three segments: delay / on-time / off-time. Requires cycle-phase history.</td></tr>
      <tr><td>Defer MMM:SS Then ON|OFF</td><td>Delays a state change until the register holds that state for the full duration. Requires outlet history.</td></tr>
      <tr><td>Min Time MMM:SS Then ON|OFF</td><td>Forces outlet to hold its current state for minimum duration before switching. Requires outlet history.</td></tr>
      <tr><td>When ON|OFF &gt; MMM:SS Then ON|OFF</td><td>Forces outlet to manual OFF if it has been in the specified state longer than the duration. Requires runtime tracking.</td></tr>
      <tr><td>If Power Apex|EB ON|OFF MMM</td><td>Tests power state of base unit or Energy Bar. Partial data only — grey for now.</td></tr>
    </table>
  `;

  function injectHelpPanel() {
    if (document.getElementById('apex-help-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'apex-help-panel';
    panel.innerHTML =
      '<div id="apex-help-handle"></div>' +
      '<div id="apex-help-header"><span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="16" height="16" fill="#9a9a9a"><path d="M29.83,20l.34-2L25,17.15V13c0-.08,0-.15,0-.23l5.06-1.36-.51-1.93-4.83,1.29A9,9,0,0,0,20,5V2H18V4.23a8.81,8.81,0,0,0-4,0V2H12V5a9,9,0,0,0-4.71,5.82L2.46,9.48,2,11.41,7,12.77c0,.08,0,.15,0,.23v4.15L1.84,18l.32,2L7,19.18a8.9,8.9,0,0,0,.82,3.57L3.29,27.29l1.42,1.42,4.19-4.2a9,9,0,0,0,14.2,0l4.19,4.2,1.42-1.42-4.54-4.54A8.9,8.9,0,0,0,25,19.18ZM15,25.92A7,7,0,0,1,9,19V13h6ZM9.29,11a7,7,0,0,1,13.42,0ZM23,19a7,7,0,0,1-6,6.92V13h6Z"/></svg>apex debug</span><button id="apex-help-close" title="Close">\u00d7</button></div>' +
      '<div id="apex-help-body">' + HELP_CONTENT + '</div>';
    document.body.appendChild(panel);
    document.getElementById('apex-help-close').addEventListener('click', closeHelpPanel);
    document.getElementById('apex-help-handle').addEventListener('mousedown', startPanelResize);
  }

  function openHelpPanel() {
    injectHelpPanel();
    requestAnimationFrame(() => document.getElementById('apex-help-panel').classList.add('open'));
    document.getElementById('apex-debug-help')?.classList.add('active');
    helpOpen = true;
  }

  function closeHelpPanel() {
    const panel = document.getElementById('apex-help-panel');
    if (panel) panel.classList.remove('open');
    document.getElementById('apex-debug-help')?.classList.remove('active');
    helpOpen = false;
  }

  function toggleHelpPanel() {
    helpOpen ? closeHelpPanel() : openHelpPanel();
  }

  function startPanelResize(e) {
    e.preventDefault();
    const panel = document.getElementById('apex-help-panel');
    panel.style.transition = 'none';
    function onMove(ev) {
      const h = Math.min(Math.max(window.innerHeight - ev.clientY, HELP_MIN_H), HELP_MAX_H());
      panel.style.height = h + 'px';
    }
    function onUp() {
      panel.style.transition = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Toggle ─────────────────────────────────────────────────────────────────

  function setEnabled(val) {
    enabled = val;
    const btn = document.getElementById('apex-debug-toggle');

    if (enabled) {
      btn && btn.classList.add('active');
      fetchSeason().then(s => { lastSeason = s; refresh(); });
      pollTimer = setInterval(refresh, POLL_MS);
      startEditorObserver();
    } else {
      btn && btn.classList.remove('active');
      clearInterval(pollTimer);
      pollTimer = null;
      stopEditorObserver();
      lastCtx = null;
      clearColors();
    }
  }

  // ── Editor visibility ──────────────────────────────────────────────────────

  function isEditorVisible() {
    return document.querySelector('.cm-editor') !== null;
  }

  function updateButtonVisibility() {
    const btn  = document.getElementById('apex-debug-toggle');
    const help = document.getElementById('apex-debug-help');
    if (!btn) return;
    const visible = isEditorVisible();
    const display = visible ? 'inline-flex' : 'none';
    btn.style.display  = display;
    if (help) help.style.display = display;
    if (!visible && enabled) setEnabled(false);
    if (!visible && helpOpen) closeHelpPanel();
  }

  // ── Button injection ───────────────────────────────────────────────────────

  function injectButton() {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      onNavigate();
    }
    if (!document.getElementById('apex-debug-toggle')) {
      const copyBtn = document.querySelector('button[title="Copy"]');
      if (copyBtn) {
        const btn = document.createElement('button');
        btn.id        = 'apex-debug-toggle';
        btn.type      = 'button';
        btn.title     = 'Debug';
        btn.className = 'btn btn-secondary';
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="16" height="16" fill="currentColor"><path d="M29.83,20l.34-2L25,17.15V13c0-.08,0-.15,0-.23l5.06-1.36-.51-1.93-4.83,1.29A9,9,0,0,0,20,5V2H18V4.23a8.81,8.81,0,0,0-4,0V2H12V5a9,9,0,0,0-4.71,5.82L2.46,9.48,2,11.41,7,12.77c0,.08,0,.15,0,.23v4.15L1.84,18l.32,2L7,19.18a8.9,8.9,0,0,0,.82,3.57L3.29,27.29l1.42,1.42,4.19-4.2a9,9,0,0,0,14.2,0l4.19,4.2,1.42-1.42-4.54-4.54A8.9,8.9,0,0,0,25,19.18ZM15,25.92A7,7,0,0,1,9,19V13h6ZM9.29,11a7,7,0,0,1,13.42,0ZM23,19a7,7,0,0,1-6,6.92V13h6Z"/></svg>';
        btn.style.cssText = 'align-items:center; justify-content:center;';
        btn.addEventListener('click', () => setEnabled(!enabled));
        copyBtn.insertAdjacentElement('afterend', btn);

        const help = document.createElement('button');
        help.id        = 'apex-debug-help';
        help.type      = 'button';
        help.title     = 'Debug Help';
        help.className = 'btn btn-secondary';
        help.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M10.7751 15.75c0.01665 -1.2 0.15415 -2.075 0.4125 -2.625 0.25835 -0.55 0.74585 -1.15 1.4625 -1.8 0.7 -0.63335 1.2375 -1.22085 1.6125 -1.7625s0.5625 -1.12085 0.5625 -1.7375c0 -0.75 -0.25 -1.375 -0.75 -1.875s-1.2 -0.75 -2.1 -0.75c-0.86665 0 -1.53335 0.24585 -2 0.7375 -0.46665 0.49165 -0.80835 1.00415 -1.025 1.5375l-2.1 -0.925c0.36665 -0.98335 0.9875 -1.820835 1.8625 -2.5125C9.5876 3.345835 10.6751 3 11.9751 3c1.66665 0 2.95 0.4625 3.85 1.3875 0.9 0.925 1.35 2.0375 1.35 3.3375 0 0.8 -0.17085 1.525 -0.5125 2.175 -0.34165 0.65 -0.8875 1.33335 -1.6375 2.05 -0.81665 0.78335 -1.30835 1.38335 -1.475 1.8 -0.16665 0.41665 -0.25835 1.08335 -0.275 2h-2.5Zm1.2 6.25c-0.48335 0 -0.89585 -0.17085 -1.2375 -0.5125 -0.34165 -0.34165 -0.5125 -0.75415 -0.5125 -1.2375 0 -0.48335 0.17085 -0.89585 0.5125 -1.2375 0.34165 -0.34165 0.75415 -0.5125 1.2375 -0.5125 0.48335 0 0.89585 0.17085 1.2375 0.5125 0.34165 0.34165 0.5125 0.75415 0.5125 1.2375 0 0.48335 -0.17085 0.89585 -0.5125 1.2375 -0.34165 0.34165 -0.75415 0.5125 -1.2375 0.5125Z" stroke-width="0.5"></path></svg>';
        help.style.cssText = 'align-items:center; justify-content:center;';
        help.addEventListener('click', toggleHelpPanel);
        btn.insertAdjacentElement('beforebegin', help);
      }
    }
    updateButtonVisibility();
  }

  // ── Navigation reset ───────────────────────────────────────────────────────

  function onNavigate() {
    if (enabled)  setEnabled(false);
    if (helpOpen) closeHelpPanel();
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  chrome.storage.sync.get({ hostname: 'apex.local' }, ({ hostname }) => {
    if (window.location.hostname !== hostname) return;

    STATUS_URL = `http://${hostname}/cgi-bin/status.json`;
    CONFIG_URL = `http://${hostname}/rest/config`;

    injectStyles();
    initGutterTooltip();

    const observer = new MutationObserver(injectButton);
    observer.observe(document.body, { childList: true, subtree: true });

    injectButton();
  });
})();
