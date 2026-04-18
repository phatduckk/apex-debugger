(function () {
  'use strict';

  let STATUS_URL  = '';
  let CONFIG_URL  = '';
  const POLL_MS   = 5000;

  let enabled        = false;
  let pollTimer      = null;
  let lastCtx        = null;
  let lastSeason        = null;
  let lastFeedIntervals = [0, 0, 0, 0]; // seconds, indexed 0=FeedA … 3=FeedD
  let feedEndedAt       = {};           // { 1: Date.now(), … } keyed by feed number
  let prevFeed          = { name: 0, active: 0 };
  let beefMode       = false;
  let editorSnapshot = null;
  let editorObserver = null;
  let helpOpen    = false;
  let probeOpen   = false;
  let exploreOpen = false;
  let activeFolder    = 'default';
  let layoutSnapshot  = null; // original sections[] from /rest/layout, saved before first folder switch
  let layoutObserver  = null;
  let layoutSaveTimer = null;
  let folderDropdownInjected    = false;
  let lastFolderApplied         = false;
  let dividerTemplateObserver   = null;
  let dividerPointerUpHandler   = null;
  let dividerUnlockObserver     = null;
  let liveDividers              = {};

  function syncDividerX() {
    const unlocked = document.getElementById('dash')?.classList.contains('unlocked') ?? false;
    document.querySelectorAll('[data-apex-widget="divider"] .sortable-remove').forEach(el => {
      el.style.visibility = unlocked ? 'visible' : 'hidden';
    });
  }
  let lastUrl    = location.href;

  let debugMode      = false;
  let debugDid       = null;
  let debugIstat     = null;
  let debugConfig    = null;
  let debugLogLines  = false;

  const HELP_MIN_H   = 160;
  const HELP_MAX_H   = () => Math.round(window.innerHeight * 0.80);
  const HELP_DEF_H   = 340;

  const FOLDER_GLYPHS = [
    'F660',
    'E001','E002','E003','E004','E005','E006','E007',
    'F001','F002','F005','F007','F00C','F00D','F00E','F010','F011','F012','F013',
    'F015','F017','F019','F01E','F021','F022','F023','F026','F027','F028','F02B',
    'F02D','F02E','F02F','F030','F031','F03A','F03E','F040','F041','F042','F043',
    'F044','F047','F048','F049','F04A','F04B','F04C','F04D','F04E','F050','F051',
    'F052','F053','F054','F055','F056','F057','F058','F059','F05A','F05B','F05E',
    'F060','F061','F062','F063','F064','F065','F066','F067','F068','F06A','F06E',
    'F070','F071','F075','F077','F078','F07B','F07C','F07D','F07E','F080','F084',
    'F085','F08B','F08D','F08E','F090','F093','F09C','F0A0','F0A1','F0A4','F0A5',
    'F0A6','F0A7','F0A8','F0A9','F0AA','F0AB','F0AD','F0AE','F0B0','F0C0','F0C1',
    'F0C2','F0C3','F0C4','F0C5','F0C7','F0C8','F0C9','F0CA','F0CB','F0D0','F0D7',
    'F0D8','F0D9','F0DA','F0DC','F0DD','F0DE','F0E0','F0E2','F0E3','F0E4','F0E7',
    'F0E8','F0EA','F0EB','F0EC','F0ED','F0EE','F0F0','F0F1','F0F3','F0F9','F0FA',
    'F0FE','F100','F101','F102','F103','F104','F105','F106','F107','F108','F10A',
    'F10B','F110','F111','F118','F119','F11A','F121','F124','F127','F128','F129',
    'F12A','F130','F131','F133','F137','F138','F139','F13A','F13B','F144','F145',
    'F146','F14A','F14B','F14C','F14D','F150','F151','F152','F15B','F15C','F164',
    'F165','F16B','F16D','F16E','F179','F17A','F17B','F185','F186','F187','F188',
    'F191','F192','F199','F1C0','F1C1','F1C5','F1C6','F1C7','F1C8','F1C9','F1CD',
    'F1D8','F1DA','F1DE','F1E2','F1EB','F1EC','F1F6','F1F8','F1FB','F1FE','F200',
    'F201','F204','F205','F21B','F21E','F234','F249','F24D','F254','F267','F268',
    'F269','F26B','F271','F272','F273','F274','F28B','F28D','F2B9','F2BB','F2C1',
    'F2C2','F2C7','F2C8','F2C9','F2CA','F2CB','F2D3','F2E7','F2F5','F2F6','F2FD',
    'F2FE','F304','F30F','F316','F317','F318','F319','F31A','F31C','F31D','F321',
    'F322','F323','F324','F325','F328','F329','F32A','F32B','F32C','F32D','F32E',
    'F330','F331','F333','F334','F339','F33A','F33B','F33C','F33D','F33E','F340',
    'F341','F342','F343','F344','F345','F34E','F3C1','F3C5','F3E0','F3F0','F3F1',
    'F3F2','F46C','F46D','F477','F479','F481','F500','F54C','F552','F56C','F56D',
    'F56E','F56F','F572','F573','F574','F575','F576','F578','F5B7','F5C7','F5E8',
    'F5EB','F5F8','F601','F602','F603','F60B','F611','F643','F64D','F659','F65A',
    'F65B','F65C','F65D','F65E','F65F','F672','F673','F681','F682','F121',
    'F690','F6A4','F6A8','F6A9','F6AC','F6C3','F6C4','F6DD','F72E',
  ];

  // ── Themes ─────────────────────────────────────────────────────────────────

  const BEEF_BG_URL = chrome.runtime.getURL('img/beef.svg');

  const TILES =`.dash-probe-chart,.dash-dos-display,.dash-ddr-display,.dash-wav-display,.dash-ebg-display,.dash-cor-display,.dash-tri-display`;
  const LABELS = `.dash-selector-name,.dash-switch-name,.dash-dos-name,.dash-ddr-name,.dash-wav-name,.dash-feed-name,.dash-probe-info-name,.dash-ebg-name,.dash-cor-name,.dash-tri-name,.dash-link-name,.dash-clock-label`;

  const THEMES = {
    default: { bsTheme: null, css: '' },

    dark: {
      bsTheme: 'dark',
      css: `
        body { background-color: #1a1d21 !important; color: #dee2e6 !important; }
        [data-bs-theme=dark] { --bs-body-bg: #1a1d21; --bs-body-color: #dee2e6; }
        .navbar.bg-dark { background-color: #0d0f11 !important; }
        .btn-secondary,.dash-video-dialog .btn {
          --bs-btn-bg: #2b3035; --bs-btn-border-color: #3d4147;
          --bs-btn-hover-bg: #3d4147; --bs-btn-hover-border-color: #52585f;
          --bs-btn-color: #dee2e6; --bs-btn-hover-color: #fff;
        }
        /* Tile displays */
        ${TILES} { background-color: #2a2200 !important; }
        .dash-probe-info-data { color: #e07820; }
        /* Scroll strip */
        #dash-section-0 { background-color: #141414 !important; }
        /* Column dividers */
        #dash-widget-column-2,#dash-widget-column-3 { border-left-color: #333 !important; }
        /* Toggle tracks */
        .dash-selector-track { background: #2b3035 !important; }
        .dash-switch-track { background: #1a1d21 !important; }
        .dash-selector-bar,.dash-switch-bar { background: #2b3035 !important; }
        /* Selector slide states */
        .dash-selector-slide.off {
          --bs-btn-bg: #2b3035; --bs-btn-border-color: #3d4147; --bs-btn-color: #adb5bd;
        }
        .dash-selector-slide.auto {
          --bs-btn-bg: #70c6c7; --bs-btn-border-color: #5ebfc0; --bs-btn-color: #000;
        }
        .dash-selector-slide.on {
          --bs-btn-bg: #e07820; --bs-btn-border-color: #c96a18; --bs-btn-color: #fff;
        }
        /* Switch slide states */
        .dash-switch-slide.open {
          --bs-btn-bg: #2b3035; --bs-btn-border-color: #3d4147; --bs-btn-color: #adb5bd;
        }
        .dash-switch-slide.closed {
          --bs-btn-bg: #e07820; --bs-btn-border-color: #c96a18; --bs-btn-color: #fff;
        }
        /* Status text */
        .dash-selector-status.auto { color: #70c6c7 !important; }
        .dash-selector-status.on { color: #e07820 !important; }
        .dash-selector-status.off { color: #6c757d !important; }
        /* Name labels */
        ${LABELS} { color: rgba(222,226,230,.85) !important; }
        /* Bootstrap components */
        .card { background-color: #2b3035 !important; border-color: #3d4147 !important; color: #dee2e6; }
        .card-header { background-color: #212529 !important; border-color: #3d4147 !important; }
        .bg-body-tertiary { background-color: #212529 !important; }
        .dropdown-menu { background-color: #2b3035; border-color: #3d4147; }
        .dropdown-item { color: #dee2e6; }
        .dropdown-item:hover,.dropdown-item:focus { background-color: #3d4147; color: #fff; }
        .dropdown-header { color: #e07820; }
        .dropdown-divider { border-color: #3d4147; }
        .form-control,.form-select { background-color: #1a1d21; border-color: #3d4147; color: #dee2e6; }
        .form-control:focus,.form-select:focus { background-color: #2b3035; border-color: #e07820; color: #dee2e6; box-shadow: 0 0 0 0.25rem rgba(224,120,32,0.25); }
        .form-control-plaintext { color: #dee2e6; }
        .input-group-text { background-color: #212529; border-color: #3d4147; color: #dee2e6; }
        .lead { color: #dee2e6; }
        .text-muted { color: #6c757d !important; }
        .noUi-connect { background: #e07820 !important; }
        .noUi-target { background: #2b3035 !important; border-color: #3d4147 !important; }
        .ts-control,.ts-wrapper .ts-control { background: #1a1d21 !important; border-color: #3d4147 !important; color: #dee2e6 !important; }
        .ts-dropdown { background: #2b3035 !important; border-color: #3d4147 !important; color: #dee2e6 !important; }
        .btn-primary { --bs-btn-bg: #e07820; --bs-btn-border-color: #e07820; --bs-btn-hover-bg: #c96a18; --bs-btn-hover-border-color: #c96a18; --bs-btn-color: #fff; }
        .btn-info { --bs-btn-bg: #0dcaf0; --bs-btn-border-color: #0dcaf0; --bs-btn-color: #000; }
        .table { --bs-table-color: #dee2e6; --bs-table-bg: transparent; --bs-table-border-color: #3d4147; }
        .table-hover > tbody > tr:hover > * { --bs-table-accent-bg: rgba(255,255,255,0.05); }
        .border,.border-top,.border-bottom,.border-start,.border-end { border-color: #3d4147 !important; }
        hr { border-color: #3d4147; }
        /* Feed timer buttons */
        .btn-dash-feed-start { background-color: #2b3035 !important; border-color: #3d4147 !important; color: #adb5bd !important; }
        .btn-dash-feed-start.dash-feed-active { background-color: #70c6c7 !important; border-color: #5ebfc0 !important; color: #000 !important; }
        .btn-dash-feed-cancel { background-color: #e07820 !important; border-color: #c96a18 !important; color: #fff !important; }
        #dash-covers-icon:not(.af-rotate-180) { color: #e07820 !important; }
        .dash-widget-container .sortable { border-color: #e07820 !important; }
      `,
    },

    ocean: {
      bsTheme: 'dark',
      css: `
        body { background-color: #050d1a !important; color: #c8e6f5 !important; }
        [data-bs-theme=dark] { --bs-body-bg: #050d1a; --bs-body-color: #c8e6f5; }
        .navbar.bg-dark { background-color: #020810 !important; border-bottom: 1px solid #0a2540 !important; }
        .btn-secondary,.dash-video-dialog .btn {
          --bs-btn-bg: #0a1f3a; --bs-btn-border-color: #1a4a6e;
          --bs-btn-hover-bg: #1a4a6e; --bs-btn-hover-border-color: #2a6a9e;
          --bs-btn-color: #c8e6f5; --bs-btn-hover-color: #fff;
        }
        /* Tile displays */
        ${TILES} { background-color: #0d2a45 !important; }
        .dash-probe-info-data { color: #00b4d8 !important; }
        /* Scroll strip */
        #dash-section-0 { background-color: #03060f !important; }
        /* Column dividers */
        #dash-widget-column-2,#dash-widget-column-3 { border-left-color: #0a2540 !important; }
        /* Toggle tracks */
        .dash-selector-track { background: #0a1f3a !important; }
        .dash-switch-track { background: #050d1a !important; }
        .dash-selector-bar,.dash-switch-bar { background: #0a1f3a !important; }
        /* Selector slide states */
        .dash-selector-slide.off {
          --bs-btn-bg: #1a3a5c; --bs-btn-border-color: #1a3a5c; --bs-btn-color: #6fa8c4;
        }
        .dash-selector-slide.auto {
          --bs-btn-bg: #00bcd4; --bs-btn-border-color: #00a5bb; --bs-btn-color: #000;
        }
        .dash-selector-slide.on {
          --bs-btn-bg: #0096c7; --bs-btn-border-color: #007daa; --bs-btn-color: #fff;
        }
        /* Switch slide states */
        .dash-switch-slide.open {
          --bs-btn-bg: #1a3a5c; --bs-btn-border-color: #1a3a5c; --bs-btn-color: #6fa8c4;
        }
        .dash-switch-slide.closed {
          --bs-btn-bg: #0096c7; --bs-btn-border-color: #007daa; --bs-btn-color: #fff;
        }
        /* Status text */
        .dash-selector-status.auto { color: #00bcd4 !important; }
        .dash-selector-status.on { color: #67d4f0 !important; }
        .dash-selector-status.off { color: #3a6a8a !important; }
        /* Name labels */
        ${LABELS} { color: rgba(200,230,245,.85) !important; }
        /* Bootstrap components */
        .card { background-color: #0a1f3a !important; border-color: #1a4a6e !important; color: #c8e6f5; }
        .card-header { background-color: #0c2850 !important; border-color: #1a4a6e !important; }
        .bg-body-tertiary { background-color: #071628 !important; }
        .dropdown-menu { background-color: #0a1f3a; border-color: #1a4a6e; }
        .dropdown-item { color: #c8e6f5; }
        .dropdown-item:hover,.dropdown-item:focus { background-color: #1a4a6e; color: #fff; }
        .dropdown-header { color: #67d4f0; }
        .dropdown-divider { border-color: #1a4a6e; }
        .form-control,.form-select { background-color: #050d1a; border-color: #1a4a6e; color: #c8e6f5; }
        .form-control:focus,.form-select:focus { background-color: #0a1f3a; border-color: #00b4d8; color: #c8e6f5; box-shadow: 0 0 0 0.25rem rgba(0,180,216,0.25); }
        .form-control-plaintext { color: #c8e6f5; }
        .input-group-text { background-color: #0c2850; border-color: #1a4a6e; color: #c8e6f5; }
        .lead { color: #c8e6f5; }
        .text-muted { color: #4a7a9b !important; }
        .noUi-connect { background: #00b4d8 !important; }
        .noUi-target { background: #0c2850 !important; border-color: #1a4a6e !important; }
        .ts-control,.ts-wrapper .ts-control { background: #050d1a !important; border-color: #1a4a6e !important; color: #c8e6f5 !important; }
        .ts-dropdown { background: #0a1f3a !important; border-color: #1a4a6e !important; color: #c8e6f5 !important; }
        .btn-primary { --bs-btn-bg: #0096c7; --bs-btn-border-color: #0096c7; --bs-btn-hover-bg: #0077b6; --bs-btn-hover-border-color: #0077b6; --bs-btn-color: #fff; }
        .btn-info { --bs-btn-bg: #00bcd4; --bs-btn-border-color: #00bcd4; --bs-btn-color: #000; }
        .table { --bs-table-color: #c8e6f5; --bs-table-bg: transparent; --bs-table-border-color: #1a4a6e; }
        .table-hover > tbody > tr:hover > * { --bs-table-accent-bg: rgba(0,180,216,0.06); }
        .border,.border-top,.border-bottom,.border-start,.border-end { border-color: #1a4a6e !important; }
        hr { border-color: #1a4a6e; }
        /* Feed timer buttons */
        .btn-dash-feed-start { background-color: #1a3a5c !important; border-color: #1a3a5c !important; color: #6fa8c4 !important; }
        .btn-dash-feed-start.dash-feed-active { background-color: #00bcd4 !important; border-color: #00a5bb !important; color: #000 !important; }
        .btn-dash-feed-cancel { background-color: #0096c7 !important; border-color: #007daa !important; color: #fff !important; }
        #dash-covers-icon:not(.af-rotate-180) { color: #0096c7 !important; }
        .dash-widget-container .sortable { border-color: #0096c7 !important; }
      `,
    },

    coral: {
      bsTheme: 'dark',
      css: `
        body { background-color: #120800 !important; color: #fde8d8 !important; }
        [data-bs-theme=dark] { --bs-body-bg: #120800; --bs-body-color: #fde8d8; }
        .navbar.bg-dark { background-color: #070300 !important; border-bottom: 1px solid #3d1500 !important; }
        .btn-secondary,.dash-video-dialog .btn {
          --bs-btn-bg: #2a1200; --bs-btn-border-color: #6b2d00;
          --bs-btn-hover-bg: #3d1a00; --bs-btn-hover-border-color: #8a3d00;
          --bs-btn-color: #fde8d8; --bs-btn-hover-color: #fff;
        }
        /* Tile displays */
        ${TILES} { background-color: #3d1500 !important; }
        .dash-probe-info-data { color: #ff6b35 !important; }
        /* Scroll strip */
        #dash-section-0 { background-color: #0a0400 !important; }
        /* Column dividers */
        #dash-widget-column-2,#dash-widget-column-3 { border-left-color: #3d1500 !important; }
        /* Toggle tracks */
        .dash-selector-track { background: #2a1200 !important; }
        .dash-switch-track { background: #120800 !important; }
        .dash-selector-bar,.dash-switch-bar { background: #2a1200 !important; }
        /* Selector slide states */
        .dash-selector-slide.off {
          --bs-btn-bg: #2a1200; --bs-btn-border-color: #6b2d00; --bs-btn-color: #b07050;
        }
        .dash-selector-slide.auto {
          --bs-btn-bg: #ff6b35; --bs-btn-border-color: #e55520; --bs-btn-color: #fff;
        }
        .dash-selector-slide.on {
          --bs-btn-bg: #cc2200; --bs-btn-border-color: #aa1c00; --bs-btn-color: #fff;
        }
        /* Switch slide states */
        .dash-switch-slide.open {
          --bs-btn-bg: #2a1200; --bs-btn-border-color: #6b2d00; --bs-btn-color: #b07050;
        }
        .dash-switch-slide.closed {
          --bs-btn-bg: #cc2200; --bs-btn-border-color: #aa1c00; --bs-btn-color: #fff;
        }
        /* Status text */
        .dash-selector-status.auto { color: #ff6b35 !important; }
        .dash-selector-status.on { color: #ff9a6c !important; }
        .dash-selector-status.off { color: #7a3d20 !important; }
        /* Name labels */
        ${LABELS} { color: rgba(253,232,216,.85) !important; }
        /* Bootstrap components */
        .card { background-color: #1e0d00 !important; border-color: #6b2d00 !important; color: #fde8d8; }
        .card-header { background-color: #2a1200 !important; border-color: #6b2d00 !important; }
        .bg-body-tertiary { background-color: #180a00 !important; }
        .dropdown-menu { background-color: #1e0d00; border-color: #6b2d00; }
        .dropdown-item { color: #fde8d8; }
        .dropdown-item:hover,.dropdown-item:focus { background-color: #2a1200; color: #fff; }
        .dropdown-header { color: #ff9a6c; }
        .dropdown-divider { border-color: #6b2d00; }
        .form-control,.form-select { background-color: #120800; border-color: #6b2d00; color: #fde8d8; }
        .form-control:focus,.form-select:focus { background-color: #1e0d00; border-color: #ff6b35; color: #fde8d8; box-shadow: 0 0 0 0.25rem rgba(255,107,53,0.25); }
        .form-control-plaintext { color: #fde8d8; }
        .input-group-text { background-color: #2a1200; border-color: #6b2d00; color: #fde8d8; }
        .lead { color: #fde8d8; }
        .text-muted { color: #9a5a30 !important; }
        .noUi-connect { background: #ff6b35 !important; }
        .noUi-target { background: #2a1200 !important; border-color: #6b2d00 !important; }
        .ts-control,.ts-wrapper .ts-control { background: #120800 !important; border-color: #6b2d00 !important; color: #fde8d8 !important; }
        .ts-dropdown { background: #1e0d00 !important; border-color: #6b2d00 !important; color: #fde8d8 !important; }
        .btn-primary { --bs-btn-bg: #ff6b35; --bs-btn-border-color: #ff6b35; --bs-btn-hover-bg: #e55520; --bs-btn-hover-border-color: #e55520; --bs-btn-color: #fff; }
        .btn-info { --bs-btn-bg: #cc4e00; --bs-btn-border-color: #cc4e00; --bs-btn-color: #fff; }
        .table { --bs-table-color: #fde8d8; --bs-table-bg: transparent; --bs-table-border-color: #6b2d00; }
        .table-hover > tbody > tr:hover > * { --bs-table-accent-bg: rgba(255,107,53,0.06); }
        .border,.border-top,.border-bottom,.border-start,.border-end { border-color: #6b2d00 !important; }
        hr { border-color: #6b2d00; }
        /* Feed timer buttons */
        .btn-dash-feed-start { background-color: #2a1200 !important; border-color: #6b2d00 !important; color: #b07050 !important; }
        .btn-dash-feed-start.dash-feed-active { background-color: #ff6b35 !important; border-color: #e55520 !important; color: #fff !important; }
        .btn-dash-feed-cancel { background-color: #cc2200 !important; border-color: #aa1c00 !important; color: #fff !important; }
        #dash-covers-icon:not(.af-rotate-180) { color: #ff6b35 !important; }
        .dash-widget-container .sortable { border-color: #ff6b35 !important; }
      `,
    },

    lasermelon: {
      bsTheme: 'dark',
      css: `
        body { background-color: #0e0118 !important; color: #f0d8ff !important; }
        [data-bs-theme=dark] { --bs-body-bg: #0e0118; --bs-body-color: #f0d8ff; }
        .navbar.bg-dark { background-color: #060010 !important; border-bottom: 1px solid #3d0a5a !important; }
        .btn-secondary,.dash-video-dialog .btn {
          --bs-btn-bg: #1e0830; --bs-btn-border-color: #4a1060;
          --bs-btn-hover-bg: #2e1248; --bs-btn-hover-border-color: #6a1888;
          --bs-btn-color: #d8b8f8; --bs-btn-hover-color: #fff;
        }
        /* Tile displays — deep purple like the coral shadows */
        ${TILES} { background-color: #2a0840 !important; }
        .dash-probe-info-data { color: #ff2aaa !important; }
        /* Scroll strip */
        #dash-section-0 { background-color: #08000f !important; }
        /* Column dividers */
        #dash-widget-column-2,#dash-widget-column-3 { border-left-color: #3d0a5a !important; }
        /* Toggle tracks */
        .dash-selector-track { background: #1e0830 !important; }
        .dash-switch-track { background: #0e0118 !important; }
        .dash-selector-bar,.dash-switch-bar { background: #1e0830 !important; }
        /* Selector slide states — OFF: muted purple, AUTO: electric blue, ON: hot magenta */
        .dash-selector-slide.off {
          --bs-btn-bg: #2e1248; --bs-btn-border-color: #4a1060; --bs-btn-color: #9a70c0;
        }
        .dash-selector-slide.auto {
          --bs-btn-bg: #6b8fe8; --bs-btn-border-color: #5577d0; --bs-btn-color: #fff;
        }
        .dash-selector-slide.on {
          --bs-btn-bg: #e8209a; --bs-btn-border-color: #c01880; --bs-btn-color: #fff;
        }
        /* Switch slide states */
        .dash-switch-slide.open {
          --bs-btn-bg: #2e1248; --bs-btn-border-color: #4a1060; --bs-btn-color: #9a70c0;
        }
        .dash-switch-slide.closed {
          --bs-btn-bg: #e8209a; --bs-btn-border-color: #c01880; --bs-btn-color: #fff;
        }
        /* Status text */
        .dash-selector-status.auto { color: #7b9ff5 !important; }
        .dash-selector-status.on { color: #ff2aaa !important; }
        .dash-selector-status.off { color: #6a3a8a !important; }
        /* Name labels */
        ${LABELS} { color: rgba(240,216,255,.85) !important; }
        /* Bootstrap components */
        .card { background-color: #180528 !important; border-color: #4a1060 !important; color: #f0d8ff; }
        .card-header { background-color: #1e0830 !important; border-color: #4a1060 !important; }
        .bg-body-tertiary { background-color: #130320 !important; }
        .dropdown-menu { background-color: #180528; border-color: #4a1060; }
        .dropdown-item { color: #f0d8ff; }
        .dropdown-item:hover,.dropdown-item:focus { background-color: #2e1248; color: #fff; }
        .dropdown-header { color: #c4e832; }
        .dropdown-divider { border-color: #4a1060; }
        .form-control,.form-select { background-color: #0e0118; border-color: #4a1060; color: #f0d8ff; }
        .form-control:focus,.form-select:focus { background-color: #180528; border-color: #e8209a; color: #f0d8ff; box-shadow: 0 0 0 0.25rem rgba(232,32,154,0.25); }
        .form-control-plaintext { color: #f0d8ff; }
        .input-group-text { background-color: #1e0830; border-color: #4a1060; color: #f0d8ff; }
        .lead { color: #f0d8ff; }
        .text-muted { color: #7a4a9a !important; }
        .noUi-connect { background: #e8209a !important; }
        .noUi-target { background: #1e0830 !important; border-color: #4a1060 !important; }
        .ts-control,.ts-wrapper .ts-control { background: #0e0118 !important; border-color: #4a1060 !important; color: #f0d8ff !important; }
        .ts-dropdown { background: #180528 !important; border-color: #4a1060 !important; color: #f0d8ff !important; }
        .btn-primary { --bs-btn-bg: #e8209a; --bs-btn-border-color: #e8209a; --bs-btn-hover-bg: #c01880; --bs-btn-hover-border-color: #c01880; --bs-btn-color: #fff; }
        .btn-info { --bs-btn-bg: #6b8fe8; --bs-btn-border-color: #6b8fe8; --bs-btn-color: #fff; }
        .table { --bs-table-color: #f0d8ff; --bs-table-bg: transparent; --bs-table-border-color: #4a1060; }
        .table-hover > tbody > tr:hover > * { --bs-table-accent-bg: rgba(232,32,154,0.06); }
        .border,.border-top,.border-bottom,.border-start,.border-end { border-color: #4a1060 !important; }
        hr { border-color: #4a1060; }
        /* Feed timer buttons */
        .btn-dash-feed-start { background-color: #2e1248 !important; border-color: #4a1060 !important; color: #9a70c0 !important; }
        .btn-dash-feed-start.dash-feed-active { background-color: #6b8fe8 !important; border-color: #5577d0 !important; color: #fff !important; }
        .btn-dash-feed-cancel { background-color: #e8209a !important; border-color: #c01880 !important; color: #fff !important; }
        #dash-covers-icon:not(.af-rotate-180) { color: #e8209a !important; }
        .dash-widget-container .sortable { border-color: #e8209a !important; }
      `,
    },

    beef: {
      bsTheme: 'dark',
      css: `
        body { background-color: #0d0a0a !important; color: #ede8e0 !important; }
        [data-bs-theme=dark] { --bs-body-bg: #0d0a0a; --bs-body-color: #ede8e0; }
        .navbar.bg-dark { background-color: rgb(33,37,41) !important; border-bottom: 1px solid #2d3a5a !important; }
        .btn-secondary,.dash-video-dialog .btn {
          --bs-btn-bg: #1a2035; --bs-btn-border-color: #2d3a5a;
          --bs-btn-hover-bg: #2d3a5a; --bs-btn-hover-border-color: #3d4f7a;
          --bs-btn-color: #ede8e0; --bs-btn-hover-color: #fff;
        }
        /* Tile displays */
        ${TILES} { background-color: #1a0a08 !important; }
        .dash-probe-info-data { color: #c0392b !important; }
        /* Scroll strip */
        #dash-section-0 { background-color: #080505 !important; }
        /* Column dividers */
        #dash-widget-column-2,#dash-widget-column-3 { border-left-color: #2d3a5a !important; }
        /* Beef.svg tiled container background */
        body {
          background-image: linear-gradient(rgba(13,10,10,0.8), rgba(13,10,10,0.8)), url('${BEEF_BG_URL}') !important;
          background-repeat: repeat !important;
          background-size: auto, 96px 96px !important;
        }
        /* Toggle tracks */
        .dash-selector-track { background: #1a2035 !important; }
        .dash-switch-track { background: #0d0a0a !important; }
        .dash-selector-bar,.dash-switch-bar { background: #1a2035 !important; }
        /* Selector slide states — OFF: dark navy, AUTO: teal, ON: beef red */
        .dash-selector-slide.off {
          --bs-btn-bg: #1a2035; --bs-btn-border-color: #2d3a5a; --bs-btn-color: #8a9ab8;
        }
        .dash-selector-slide.auto {
          --bs-btn-bg: #2cbfbf; --bs-btn-border-color: #22aaaa; --bs-btn-color: #000;
        }
        .dash-selector-slide.on {
          --bs-btn-bg: #c0392b; --bs-btn-border-color: #a02820; --bs-btn-color: #fff;
        }
        /* Switch slide states */
        .dash-switch-slide.open {
          --bs-btn-bg: #1a2035; --bs-btn-border-color: #2d3a5a; --bs-btn-color: #8a9ab8;
        }
        .dash-switch-slide.closed {
          --bs-btn-bg: #c0392b; --bs-btn-border-color: #a02820; --bs-btn-color: #fff;
        }
        /* Status text */
        .dash-selector-status.auto { color: #2cbfbf !important; }
        .dash-selector-status.on { color: #e05040 !important; }
        .dash-selector-status.off { color: #4a5a7a !important; }
        /* Name labels */
        ${LABELS} { color: rgba(237,232,224,.85) !important; }
        /* Bootstrap components */
        .card { background-color: #13100f !important; border-color: #2d3a5a !important; color: #ede8e0; }
        .card-header { background-color: #1a2035 !important; border-color: #2d3a5a !important; }
        .bg-body-tertiary { background-color: #100d0c !important; }
        .dropdown-menu { background-color: #13100f; border-color: #2d3a5a; }
        .dropdown-item { color: #ede8e0; }
        .dropdown-item:hover,.dropdown-item:focus { background-color: #1a2035; color: #fff; }
        .dropdown-header { color: #2cbfbf; }
        .dropdown-divider { border-color: #2d3a5a; }
        .form-control,.form-select { background-color: #0d0a0a; border-color: #2d3a5a; color: #ede8e0; }
        .form-control:focus,.form-select:focus { background-color: #13100f; border-color: #c0392b; color: #ede8e0; box-shadow: 0 0 0 0.25rem rgba(192,57,43,0.25); }
        .form-control-plaintext { color: #ede8e0; }
        .input-group-text { background-color: #1a2035; border-color: #2d3a5a; color: #ede8e0; }
        .lead { color: #ede8e0; }
        .text-muted { color: #7a6a60 !important; }
        .noUi-connect { background: #c0392b !important; }
        .noUi-target { background: #1a2035 !important; border-color: #2d3a5a !important; }
        .ts-control,.ts-wrapper .ts-control { background: #0d0a0a !important; border-color: #2d3a5a !important; color: #ede8e0 !important; }
        .ts-dropdown { background: #13100f !important; border-color: #2d3a5a !important; color: #ede8e0 !important; }
        .btn-primary { --bs-btn-bg: #c0392b; --bs-btn-border-color: #c0392b; --bs-btn-hover-bg: #a02820; --bs-btn-hover-border-color: #a02820; --bs-btn-color: #fff; }
        .btn-info { --bs-btn-bg: #2cbfbf; --bs-btn-border-color: #2cbfbf; --bs-btn-color: #000; }
        .table { --bs-table-color: #ede8e0; --bs-table-bg: transparent; --bs-table-border-color: #2d3a5a; }
        .table-hover > tbody > tr:hover > * { --bs-table-accent-bg: rgba(192,57,43,0.07); }
        .border,.border-top,.border-bottom,.border-start,.border-end { border-color: #2d3a5a !important; }
        hr { border-color: #2d3a5a; }
        /* Feed timer buttons */
        .btn-dash-feed-start { background-color: #1a2035 !important; border-color: #2d3a5a !important; color: #8a9ab8 !important; }
        .btn-dash-feed-start.dash-feed-active { background-color: #2cbfbf !important; border-color: #22aaaa !important; color: #000 !important; }
        .btn-dash-feed-cancel { background-color: #c0392b !important; border-color: #a02820 !important; color: #fff !important; }
        #dash-covers-icon:not(.af-rotate-180) { color: #c0392b !important; }
        .dash-widget-container .sortable { border-color: #c0392b !important; }
      `,
    },
  };

  function injectTheme(themeKey) {
    const theme = THEMES[themeKey] || THEMES.default;

    // Set data-bs-theme if the theme requires it; for default, leave whatever the site set
    if (theme.bsTheme) {
      document.documentElement.setAttribute('data-bs-theme', theme.bsTheme);
    }

    // Inject or update theme stylesheet
    let el = document.getElementById('apex-theme-styles');
    if (!el) {
      el = document.createElement('style');
      el.id = 'apex-theme-styles';
      document.head.appendChild(el);
    }
    el.textContent = theme.css;
  }

  // ── Colors ─────────────────────────────────────────────────────────────────

  const BG = {
    green:   '#c8f7c5',
    red:     '#f7c5c5',
    grey:    '#e0e0e0',
    neutral: '',
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  function isOutputOn(s) {
    return s === 'TBL' || s.endsWith('ON') || s.endsWith('TO');
  }

  function formatOutputStatus(s) {
    const isOn  = s === 'TBL' || s.endsWith('ON') || s.endsWith('TO');
    const isOff = s.endsWith('OF') || s.endsWith('FF');
    if (isOn)  return `ON (${s})`;
    if (isOff) return `OFF (${s})`;
    return s;
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
    if (text.includes('If Error Apex ')) return 'comment';
    const { inputs, outputs, intensities, nowMin, dowIndex, activeFeed, season, monthIndex, feedEndedAt } = ctx;
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
    // MMM = delay in minutes the condition stays true AFTER the feed ends.
    // 000 = only true while feed is running; >0 = also true for MMM min after.
    m = cond.match(/^(FeedA|FeedB|FeedC|FeedD)\s+(\d+)$/i);
    if (m) {
      const feedMap = { feeda: 1, feedb: 2, feedc: 3, feedd: 4 };
      const expected = feedMap[m[1].toLowerCase()];
      const delayMs  = parseInt(m[2], 10) * 60 * 1000;
      if (activeFeed === expected) return 'green';
      if (delayMs > 0) {
        const endedAt = feedEndedAt?.[expected];
        if (endedAt !== undefined) return Date.now() - endedAt < delayMs ? 'green' : 'red';
        return 'grey'; // feed not seen ending since load — window unknown
      }
      return 'red';
    }

    // ── If Output|Outlet <name> = ON|OFF ───────────────────────────────────
    m = cond.match(/^(?:Output|Outlet)\s+(\S+)\s+=\s+(ON|OFF)$/i);
    if (m) {
      const out = outputs[m[1].toLowerCase()];
      if (out === undefined) return 'grey';
      const targetOn = m[2].toUpperCase() === 'ON';
      return isOutputOn(out) === targetOn ? 'green' : 'red';
    }

    // ── If Output|Outlet <name> Watts|Amps > < val ────────────────────────
    m = cond.match(/^(?:Output|Outlet)\s+(\S+)\s+(Watts|Amps)\s+([<>])\s+([0-9.]+)$/i);
    if (m) {
      const val = getPowerValue(m[1], m[2], ctx);
      if (val === undefined) return 'grey';
      const threshold = parseFloat(m[4]);
      return m[3] === '>' ? (val > threshold ? 'green' : 'red')
                          : (val < threshold ? 'green' : 'red');
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
    // 0 = OPEN; any non-zero = CLOSED (60, 200, 4, 12, etc. depending on module)
    m = cond.match(/^(\S+)\s+(OPEN|CLOSED)$/i);
    if (m) {
      const val = inputs[m[1].toLowerCase()];
      if (val === undefined) return 'grey';
      const isOpen = m[2].toUpperCase() === 'OPEN';
      return (isOpen ? val === 0 : val !== 0) ? 'green' : 'red';
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

  function getPowerValue(name, unit, ctx) {
    const key     = name.toLowerCase();
    const isWatts = unit.toLowerCase() === 'watts';
    const suffix  = isWatts ? 'w' : 'a';

    // Standard path: inputs named <name>W / <name>A
    // Covers eb832 (port-based, exposed as named inputs) and most standard outputs
    const direct = ctx.inputs[key + suffix];
    if (direct !== undefined) return direct;

    // Array fallback for COR pumps only — watts at status[6], no amps available
    const status = ctx.outputStatuses?.[key];
    const type   = (ctx.outputTypes?.[key] || '').toLowerCase();
    if (!status || !type) return undefined;

    if (type.startsWith('cor')) return isWatts ? parseFloat(status[6]) : undefined;
    return undefined; // wav, dos, pm, trident — no power data in status array
  }

  function getLineValues(text, ctx) {
    const { inputs, outputs, intensities, inputUnits, nowMin, dowIndex, activeFeed, season, monthIndex } = ctx;
    const t   = text.trim();
    const ifm = t.match(/^If\s+(.+?)\s+Then\s+(\S+)$/i);
    if (!ifm) return null;
    const cond = ifm[1].trim();
    const fmt  = v => typeof v === 'string' ? `"${v}"` : v;
    let m;

    m = cond.match(/^Time\s+(\d{1,2}:\d{2})\s+to\s+(\d{1,2}:\d{2})$/i);
    if (m) {
      const h = Math.floor(nowMin / 60), min = nowMin % 60;
      return { current: `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`, test: `${m[1]} to ${m[2]}` };
    }

    m = cond.match(/^DOW\s+([SMTWTFS\-]{7})$/i);
    if (m) {
      return { current: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dowIndex], test: m[1].toUpperCase() };
    }

    m = cond.match(/^(FeedA|FeedB|FeedC|FeedD)\s+\d+$/i);
    if (m) {
      const feedNames = { 1: 'FeedA', 2: 'FeedB', 3: 'FeedC', 4: 'FeedD' };
      return { current: activeFeed ? feedNames[activeFeed] : 'None', test: m[1] };
    }

    m = cond.match(/^(?:Output|Outlet)\s+(\S+)\s+=\s+(ON|OFF)$/i);
    if (m) {
      const val = outputs[m[1].toLowerCase()];
      if (val === undefined) return null;
      return { current: fmt(val), test: fmt(m[2].toUpperCase()) };
    }

    m = cond.match(/^(?:Output|Outlet)\s+(\S+)\s+(Watts|Amps)\s+([<>])\s+([0-9.]+)$/i);
    if (m) {
      const val = getPowerValue(m[1], m[2], ctx);
      if (val === undefined) return null;
      return { current: `${val} ${m[2].toLowerCase()}`, test: `${m[3]} ${parseFloat(m[4])}` };
    }

    m = cond.match(/^(?:Output|Outlet)\s+(\S+)\s+Percent\s+([<>])\s+([0-9.]+)$/i);
    if (m) {
      const pct = intensities[m[1].toLowerCase()];
      if (pct === undefined) return null;
      return { current: pct, test: `${m[2]} ${parseFloat(m[3])}` };
    }

    m = cond.match(/^(\S+)\s+(OPEN|CLOSED)$/i);
    if (m) {
      const val = inputs[m[1].toLowerCase()];
      if (val === undefined) return null;
      return { current: val, test: fmt(m[2].toUpperCase()) };
    }

    m = cond.match(/^(\S+)\s+([<>])\s+(.+)$/i);
    if (m) {
      const val  = inputs[m[1].toLowerCase()];
      if (val === undefined) return null;
      const unit = inputUnits[m[1].toLowerCase()];
      const cur  = unit !== undefined ? `${val} ${unit}` : val;
      if (/^RT\+/i.test(m[3])) {
        if (!season) return { current: cur, test: 'RT+ (no season data)' };
        const diff      = parseFloat(m[3].slice(3)) || 0;
        const threshold = season.temp[monthIndex] + diff;
        return { current: cur, test: `${m[2]} ${threshold} (RT+${diff >= 0 ? '+' : ''}${diff})` };
      }
      const threshold = parseFloat(m[3]);
      if (isNaN(threshold)) return null;
      return { current: cur, test: `${m[2]} ${threshold}` };
    }

    return null;
  }

  // ── Status fetch ───────────────────────────────────────────────────────────

  async function fetchStatus() {
    if (debugMode && debugIstat) return debugIstat;
    try {
      const r = await fetch(STATUS_URL, { cache: 'no-store' });
      return (await r.json()).istat;
    } catch (_) {
      return null;
    }
  }

  async function fetchConfig() {
    if (debugMode && debugConfig) return {
      season:        debugConfig.season || null,
      feedIntervals: debugConfig.misc?.feedInterval || [0, 0, 0, 0],
    };
    try {
      const r    = await fetch(`${CONFIG_URL}?_=${Date.now()}`, { cache: 'no-store' });
      const json = await r.json();
      return {
        season:        json.season || null,
        feedIntervals: json.misc?.feedInterval || [0, 0, 0, 0],
      };
    } catch (_) {
      return { season: null, feedIntervals: [0, 0, 0, 0] };
    }
  }

  function buildContext(istat) {
    const inputs      = {};
    const outputs     = {};
    const intensities = {};
    const inputTypes  = {};
    const outputTypes = {};
    const inputDids   = {};
    const outputDids  = {};
    const inputUnits  = {};

    for (const inp of istat.inputs) {
      const key = inp.name.toLowerCase();
      inputs[key] = inp.value;
      if (inp.type !== undefined) inputTypes[key] = inp.type;
      if (inp.did  !== undefined) inputDids[key]  = inp.did;
      if (inp.unit !== undefined) inputUnits[key] = inp.unit;
    }
    const outputStatuses = {};
    for (const out of istat.outputs) {
      const key = out.name.toLowerCase();
      outputs[key]        = out.status[0];
      outputStatuses[key] = out.status;
      if (out.intensity !== undefined) intensities[key] = out.intensity;
      if (out.type      !== undefined) outputTypes[key] = out.type;
      if (out.did       !== undefined) outputDids[key]  = out.did;
    }

    // Current time from Apex clock (Unix timestamp)
    const now        = new Date(istat.date * 1000);
    const nowMin     = now.getHours() * 60 + now.getMinutes();
    // DOW index: 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat (matches SMTWTFS)
    const dowIndex   = now.getDay();
    // Month index for season arrays: 0=Jan, 11=Dec
    const monthIndex = now.getMonth();

    // Feed: active = seconds remaining (0 = none); name 1=FeedA, 2=FeedB, 3=FeedC, 4=FeedD
    const activeFeed = istat.feed && istat.feed.active ? istat.feed.name : 0;

    return { inputs, outputs, outputStatuses, intensities, inputTypes, outputTypes, inputDids, outputDids, inputUnits, nowMin, dowIndex, activeFeed, monthIndex };
  }

  // ── Apply / clear colors ───────────────────────────────────────────────────

  function applyColors(ctx) {
    const lines     = [...document.querySelectorAll('.cm-content .cm-line')];
    // Index 0 is the invisible spacer; real lines start at 1
    const gutterEls = document.querySelectorAll('.cm-lineNumbers .cm-gutterElement');

    // Snapshot editor content on first call after page load; detect unsaved edits thereafter
    const currentCode = lines.map(l => l.textContent).join('\n');
    if (editorSnapshot === null) editorSnapshot = currentCode;
    const editorDirty = currentCode !== editorSnapshot;

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

    // If any grey If/Then ON|OFF line exists after the winner (or anywhere when no winner
    // was found), we can't know the true last-true — invalidate the winner.
    const uncertainWinner = lines.some((line, i) => {
      if (results[i] !== 'grey') return false;
      if (i <= winnerIdx) return false;
      return /\bThen\s+(ON|OFF)\s*$/i.test(line.textContent.trim());
    });
    if (uncertainWinner) { winnerIdx = -1; winnerFinalState = null; }

    // Pass 3: apply
    // Line background — use nth-child CSS rule so it survives element recreation by CodeMirror
    let winnerStyle = document.getElementById('apex-winner-style');
    if (!winnerStyle) {
      winnerStyle = document.createElement('style');
      winnerStyle.id = 'apex-winner-style';
      document.head.appendChild(winnerStyle);
    }
    // Eval info banner
    let evalBanner = document.getElementById('apex-eval-banner');
    let bannerText  = null;
    let bannerStyle = null;
    if (uncertainWinner) {
      const greyLineNums = lines
        .map((line, i) => (results[i] === 'grey' && i > winnerIdx && /\bThen\s+(ON|OFF)\s*$/i.test(line.textContent.trim())) ? i + 1 : null)
        .filter(n => n !== null);
      const last = greyLineNums.pop();
      const lineList = greyLineNums.length ? greyLineNums.join(', ') + ' & ' + last : String(last);
      bannerText  = `<i class="af af-fw" style="font-style:normal;color:#856404">&#xF011;</i> Outlet state unknown. Cannot evaluate lines: ${lineList}.`;
      bannerStyle = 'padding:4px 8px;background:#fff3cd;color:#856404;font-size:0.8rem;border-bottom:1px solid #ffc107;font-weight:600;';
    } else if (winnerIdx >= 0) {
      const state  = winnerFinalState === 'ON' ? 'ON' : 'OFF';
      const color  = winnerFinalState === 'ON' ? '#198754' : '#dc3545';
      const verb   = editorDirty ? 'would be' : 'is';
      const suffix = editorDirty ? ' (unsaved)' : '';
      bannerText  = `<i class="af af-fw" style="font-style:normal;color:${color}">&#xF011;</i> Outlet ${verb} ${state} because of line ${winnerIdx + 1}${suffix}.`;
      bannerStyle = `padding:4px 8px;background:#f8f9fa;color:${color};font-size:0.8rem;border-bottom:1px solid #dee2e6;font-weight:600;`;
    }
    if (bannerText) {
      if (!evalBanner) {
        evalBanner = document.createElement('div');
        evalBanner.id = 'apex-eval-banner';
        document.querySelector('.cm-editor')?.before(evalBanner);
      }
      evalBanner.style.cssText = bannerStyle;
      evalBanner.innerHTML     = bannerText;
    } else {
      evalBanner?.remove();
    }

    if (winnerIdx < 0) {
      winnerStyle.textContent = '';
    } else {
      const sel = `.cm-content > .cm-line:nth-child(${winnerIdx + 1})`;
      if (beefMode) {
        if (winnerFinalState === 'ON') {
          winnerStyle.textContent = `${sel} { background: radial-gradient(circle, rgba(0,160,0,0.35) 1.5px, transparent 1.5px), linear-gradient(rgba(0,160,0,0.04), rgba(0,160,0,0.04)) !important; background-size: 8px 8px, 100% 100% !important; }`;
        } else {
          winnerStyle.textContent = `${sel} { background: repeating-linear-gradient(90deg, transparent 0px, transparent 4px, rgba(200,0,0,0.18) 4px, rgba(200,0,0,0.18) 6px), linear-gradient(rgba(200,0,0,0.04), rgba(200,0,0,0.04)) !important; }`;
        }
      } else {
        const color = winnerFinalState === 'ON' ? BG.green : BG.red;
        winnerStyle.textContent = `${sel} { background-color: ${color} !important; }`;
      }
    }

    // Gutter: per-line color + tooltip data
    const tips = [];
    lines.forEach((line, i) => {
      const gEl = gutterEls[i + 1];
      if (!gEl) return;
      gEl.style.backgroundColor = beefMode ? '' : (BG[results[i]] ?? '');
      if (beefMode) {
        if (results[i] === 'green')      gEl.dataset.apexBeef = 'T';
        else if (results[i] === 'red')   gEl.dataset.apexBeef = 'F';
        else                             delete gEl.dataset.apexBeef;
      } else {
        delete gEl.dataset.apexBeef;
      }
      const tip = buildTipText(line.textContent, results[i], i === winnerIdx, winnerFinalState, ctx);
      tips[i] = tip;
      if (tip) {
        gEl.dataset.apexTip   = tip;
        gEl.dataset.apexColor = results[i];
      } else {
        delete gEl.dataset.apexTip;
        delete gEl.dataset.apexColor;
      }
    });

    // Console log: line-by-line evaluation summary (off by default)
    if (!debugLogLines) return;
    const probeName = (document.getElementById('output-name') || document.getElementById('input-name-value'))?.value?.trim() || '?';
    const numW = String(lines.length).length;
    console.group(`EVALUATING ${probeName.toUpperCase()}`);
    lines.forEach((line, i) => {
      const code = line.textContent.trim();
      if (!code) return;
      const gutterColor = results[i] ?? 'neutral';
      const reason      = tips[i] ? tips[i].split('\n')[0] : gutterColor;
      const lineColor   = i === winnerIdx ? (winnerFinalState === 'ON' ? 'green' : 'red') : null;
      const lineReason  = lineColor ? `sets outlet ${winnerFinalState}` : 'not colored';
      const vals        = getLineValues(line.textContent, ctx);
      let entry =
        `\tLine ${String(i + 1).padStart(numW)}: ${code}\n` +
        `\t\tGutter: ${gutterColor} | ${reason}\n` +
        `\t\tLine:   ${lineColor ?? 'none'} | ${lineReason}`;
      if (vals) {
        entry +=
          `\n\t\tCurrent value: ${vals.current}` +
          `\n\t\tTest value:    ${vals.test}`;
      }
      console.log(entry);
    });
    console.groupEnd();
  }

  function clearColors() {
    const winnerStyle = document.getElementById('apex-winner-style');
    if (winnerStyle) winnerStyle.textContent = '';
    document.getElementById('apex-eval-banner')?.remove();
    document.querySelectorAll('.cm-lineNumbers .cm-gutterElement')
      .forEach(el => {
        el.style.backgroundColor = '';
        delete el.dataset.apexBeef;
      });
  }

  // ── Refresh cycle ──────────────────────────────────────────────────────────

  async function refresh() {
    if (!enabled) return;
    const istat = await fetchStatus();
    if (!istat) return;

    // Track feed → inactive transitions for delay-window evaluation
    const feed = istat.feed || { name: 0, active: 0 };
    if (prevFeed.active > 0 && feed.active === 0 && prevFeed.name > 0) {
      feedEndedAt[prevFeed.name] = Date.now();
    }
    prevFeed = { name: feed.name, active: feed.active };

    lastCtx = { ...buildContext(istat), season: lastSeason, feedEndedAt };
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

  function buildTipText(lineText, result, isWinner, winnerFinalState, ctx) {
    const t = lineText.trim();
    if (!t) return null;
    if (result === 'comment') return null;

    if (result === 'neutral') {
      return 'Neutral — no effect on outlet state';
    }

    if (result === 'grey') {
      return 'Cannot evaluate\nRequires outlet history or data not in status.json\n(Sun, Moon, OSC, Defer, Min Time, When, Power, Feed delay…)';
    }

    // Set ON / Set OFF
    if (/^Set\s+ON$/i.test(t)) {
      return 'Always executes → sets outlet ON' +
        (isWinner ? '\n\n\uF011 This line is responsible for setting the outlet ON' : '');
    }
    if (/^Set\s+OFF$/i.test(t)) {
      return 'Always executes → sets outlet OFF' +
        (isWinner ? '\n\n\uF011 This line is responsible for setting the outlet OFF' : '');
    }

    // If ... Then ...
    const ifm = t.match(/^If\s+(.+?)\s+Then\s+(\S+)$/i);
    if (ifm) {
      const cond    = ifm[1];
      const thenVal = ifm[2].toUpperCase();
      const isTrue  = result === 'green';

      let probeValue = null;
      let probeType  = null;
      let probeDid   = null;
      if (ctx) {
        const { inputs, outputs, intensities, inputTypes, outputTypes, inputDids, outputDids, inputUnits, nowMin } = ctx;
        let pm;

        // Time HH:MM to HH:MM → show current time
        if (/^Time\s+\d{1,2}:\d{2}\s+to\s+\d{1,2}:\d{2}$/i.test(cond)) {
          const h = Math.floor(nowMin / 60);
          const m = nowMin % 60;
          probeValue = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }

        // Output|Outlet <name> Watts|Amps
        pm = cond.match(/^(?:Output|Outlet)\s+(\S+)\s+(Watts|Amps)\s+[<>]/i);
        if (pm) {
          const val = getPowerValue(pm[1], pm[2], ctx);
          if (val !== undefined) probeValue = `${val} ${pm[2].toLowerCase()}`;
          probeType = outputTypes[pm[1].toLowerCase()] ?? null;
          probeDid  = outputDids[pm[1].toLowerCase()]  ?? null;
        }

        // <probe> OPEN|CLOSED
        pm = cond.match(/^(\S+)\s+(OPEN|CLOSED)$/i);
        if (pm) {
          const key = pm[1].toLowerCase();
          const val = inputs[key];
          if (val !== undefined) probeValue = val === 0 ? 'OPEN' : `CLOSED (${val})`;
          probeType = inputTypes[key] ?? null;
          probeDid  = inputDids[key]  ?? null;
        }

        // <probe> > < threshold (including RT+)
        if (probeValue === null) {
          pm = cond.match(/^(\S+)\s+[<>]\s+/i);
          if (pm && !/^(?:Output|Outlet)$/i.test(pm[1])) {
            const key  = pm[1].toLowerCase();
            const val  = inputs[key];
            const unit = inputUnits[key];
            if (val !== undefined) probeValue = unit !== undefined ? `${val} ${unit}` : val;
            probeType = inputTypes[key] ?? null;
            probeDid  = inputDids[key]  ?? null;
          }
        }

        // Output|Outlet <name> = ON|OFF
        if (probeValue === null) {
          pm = cond.match(/^(?:Output|Outlet)\s+(\S+)\s+=\s+(ON|OFF)$/i);
          if (pm) {
            const key = pm[1].toLowerCase();
            const val = outputs[key];
            if (val !== undefined) probeValue = formatOutputStatus(val);
            probeType = outputTypes[key] ?? null;
            probeDid  = outputDids[key]  ?? null;
          }
        }

        // Output|Outlet <name> Percent > < val
        if (probeValue === null) {
          pm = cond.match(/^(?:Output|Outlet)\s+(\S+)\s+Percent\s+[<>]/i);
          if (pm) {
            const key = pm[1].toLowerCase();
            const val = intensities[key];
            if (val !== undefined) probeValue = `${val}%`;
            probeType = outputTypes[key] ?? null;
            probeDid  = outputDids[key]  ?? null;
          }
        }
      }

      let tip = `Condition: ${cond}`;
      if (probeType !== null) tip += `\nType: ${probeType}`;
      if (probeDid  !== null) tip += `\nDID: ${probeDid}`;
      if (probeValue !== null) tip += `\nValue: ${probeValue}`;
      tip += `\nState: ${isTrue ? 'TRUE' : 'FALSE'}`;
      if (isWinner) tip += `\n\n\uF011 This line is responsible for setting the outlet ${thenVal}`;
      return tip;
    }

    return null;
  }

  // ── Debug panel ────────────────────────────────────────────────────────────

  function debugCheckReady() {
    const drop = document.getElementById('apex-dbg-drop');
    if (drop) {
      const has = [debugIstat ? 'status.json ✓' : null, debugConfig ? 'config ✓' : null].filter(Boolean);
      const missing = [debugIstat ? null : 'status.json', debugConfig ? null : 'config'].filter(Boolean);
      drop.textContent = has.join('  ') + (missing.length ? '  — still need: ' + missing.join(', ') : '');
    }
    if (!debugIstat || !debugConfig) return;
    const sel = document.getElementById('apex-dbg-did');
    const go  = document.getElementById('apex-dbg-go');
    if (!sel || !go) return;

    // Populate dropdown from oconf
    const all = [...(debugConfig.oconf || []), ...(debugConfig.iconf || [])]
      .filter(o => o.name && o.prog)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    sel.innerHTML = all
      .map(o => `<option value="${esc(String(o.did))}">${esc(o.name)} — ${esc(String(o.did))}</option>`)
      .join('');
    sel.style.display = 'inline-block';
    go.style.display  = 'inline-block';
  }

  function identifyAndStoreDebugFile(json, filename) {
    if (json.istat) {
      debugIstat = json.istat;
    } else if (json.oconf || json.iconf) {
      debugConfig = json;
    } else {
      alert(`Can't identify "${filename}" — expected istat, oconf, or iconf at the top level.`);
      return;
    }
    debugCheckReady();
  }

  function readDebugFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try { identifyAndStoreDebugFile(JSON.parse(e.target.result), file.name); }
      catch (_) { alert('Invalid JSON: ' + file.name); }
    };
    reader.readAsText(file);
  }

  function loadDebugProgram() {
    const sel   = document.getElementById('apex-dbg-did');
    if (!sel || !debugConfig || !debugIstat) return;
    const did   = sel.value;
    const entry = [...(debugConfig.oconf || []), ...(debugConfig.iconf || [])].find(o => String(o.did) === String(did));
    if (!entry) { alert('No program found for DID: ' + did); return; }

    const editor = document.querySelector('.cm-content');
    if (!editor) { alert('No code editor found on this page.'); return; }

    debugDid = did;

    // Load program into CodeMirror editor via paste event (CM6 handles this reliably)
    editor.focus();
    const editorSel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    editorSel.removeAllRanges();
    editorSel.addRange(range);

    const dt = new DataTransfer();
    dt.setData('text/plain', (entry.prog || '').trimEnd());
    editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));

    // Reset snapshot so it doesn't show as dirty, then evaluate
    editorSnapshot = null;
    fetchConfig().then(({ season, feedIntervals }) => { lastSeason = season; lastFeedIntervals = feedIntervals; refresh(); });
  }

  function injectDebugPanel() {
    if (document.getElementById('apex-debug-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'apex-debug-panel';
    panel.style.cssText = 'margin:12px 0;padding:10px 14px;border:2px dashed #f90;border-radius:6px;background:#fffdf0;font-size:0.82rem;';

    panel.innerHTML =
      `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px">` +
        `<span style="font-weight:700;color:#c60">⚠ Debug Mode</span>` +
        `<select id="apex-dbg-did" style="display:none;max-width:220px"></select>` +
        `<button id="apex-dbg-go" style="display:none;padding:2px 10px;cursor:pointer">Go</button>` +
        `<button id="apex-dbg-close" style="margin-left:auto;padding:2px 10px;cursor:pointer">✕ Close</button>` +
      `</div>` +
      `<div id="apex-dbg-drop" style="border:2px dashed #f90;border-radius:4px;padding:14px;text-align:center;color:#a66;font-size:0.8rem;cursor:default">` +
        `Drop status.json &amp; config here` +
      `</div>`;

    const anchor = document.querySelector('div#content');
    if (anchor) anchor.after(panel);
    else document.body.appendChild(panel);

    const drop = document.getElementById('apex-dbg-drop');
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.background = '#fff3cd'; });
    drop.addEventListener('dragleave', ()  => { drop.style.background = ''; });
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.style.background = '';
      [...e.dataTransfer.files].forEach(readDebugFile);
    });

    document.getElementById('apex-dbg-go').addEventListener('click', loadDebugProgram);
    document.getElementById('apex-dbg-close').addEventListener('click', closeDebugPanel);
  }

  function closeDebugPanel() {
    debugMode = false; debugDid = null; debugIstat = null; debugConfig = null;
    document.getElementById('apex-debug-panel')?.remove();
  }

  function initGutterTooltip() {
    const tip = document.createElement('div');
    tip.id = 'apex-gutter-tip';
    document.body.appendChild(tip);

    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest?.('.cm-lineNumbers .cm-gutterElement[data-apex-tip]');
      if (!el) { tip.style.display = 'none'; return; }

      const rect = el.getBoundingClientRect();
      tip.innerHTML = el.dataset.apexTip
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\uF011/g, '<span style="font-family:ApexFusion">&#xF011;</span>');
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
    const glyphRules = FOLDER_GLYPHS.map(g => `.apex-gp-${g.toLowerCase()}:before{content:"\\${g.toLowerCase()}"}`).join('\n');
    s.textContent = glyphRules + `
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
      #apex-probe-body { display: flex; flex: 1; overflow: hidden; background: #f5f5f5; }
      #apex-probe-left { overflow-y: auto; padding: 10px 16px 16px; width: 40%; flex-shrink: 0; }
      #apex-probe-divider { width: 5px; cursor: col-resize; background: #ddd; flex-shrink: 0; transition: background 0.15s; }
      #apex-probe-divider:hover, #apex-probe-divider.dragging { background: #aaa; }
      #apex-probe-right { flex: 1; overflow-y: auto; padding: 10px 16px 16px; background: #fff; font-family: "Source Code Pro", monospace; font-size: 14px; font-weight: 400; line-height: 19.6px; }
      #apex-probe-right p { color: #bbb; margin: 0; font-family: system-ui, sans-serif; }
      .apex-probe-row { cursor: pointer; }
      .apex-probe-row:hover td { background: rgba(0,119,204,0.06) !important; }
      .apex-probe-row.active td { background: rgba(0,119,204,0.13) !important; }
      #apex-probe-left th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; color: #999; font-weight: 700; padding: 0 10px 6px 4px; border-bottom: 1px solid #ddd; }
      .apex-prog-line { display: block; padding: 1px 4px; border-radius: 2px; white-space: pre; }
      .apex-prog-line.match { background: rgba(224,120,32,0.15); }
      .af-debug:before { content: "\\f188"; }
      .af-explore:before { content: "\\f06e"; }
      .af-folder-default:before { content: "\\f249"; }
      .af-folder-new:before { content: "\\f65e"; }
      .af-folder-edit:before { content: "\\f044"; }
      .apex-glyph-btn {
        width: 42px; height: 42px; padding: 0; border: 1px solid transparent;
        background: none; border-radius: 4px; cursor: pointer; display: flex;
        align-items: center; justify-content: center; font-size: 18px; color: #444;
      }
      .apex-glyph-btn:hover { background: #e8e8e8; border-color: #ccc; }
      .apex-glyph-btn.selected { background: #e07820; border-color: #c96a18; color: #fff; }
      #apex-glyph-grid { max-height: 276px; overflow-y: auto; display: grid;
        grid-template-columns: repeat(auto-fill, minmax(42px, 1fr)); gap: 4px;
        padding: 8px; background: #f8f8f8; border: 1px solid #dee2e6; border-radius: 4px; }
      #apex-manage-folders-footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; background: #fff; border-radius: 0 0 calc(0.5rem - 1px) calc(0.5rem - 1px); }
      #apex-folders-export-link { color: #e07820; text-decoration: none; font-size: 13px; cursor: pointer; background: none; border: none; padding: 0; }
      #apex-folders-export-link:hover { text-decoration: underline; color: #c96a18; }
      #apex-folders-import-btn-styled { background: #e07820; border: none; color: #fff; border-radius: 4px; padding: 5px 12px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
      #apex-folders-import-btn-styled:hover { background: #c96a18; }
      #apex-manage-folder-list { display: flex; flex-direction: column; gap: 4px; }
      .apex-manage-row {
        display: flex; align-items: center; gap: 10px;
        padding: 8px 10px; background: #f8f8f8; border: 1px solid #e0e0e0;
        border-radius: 5px; cursor: grab; user-select: none;
      }
      .apex-manage-row.dragging { opacity: 0.4; }
      .apex-manage-row.drag-over { border-color: #e07820; background: #fff4ea; }
      .apex-manage-handle { color: #bbb; font-size: 14px; flex-shrink: 0; }
      .apex-manage-icon { font-size: 16px; flex-shrink: 0; }
      .apex-manage-delete {
        background: none; border: none; cursor: pointer; padding: 2px 4px;
        font-size: 18px; color: #ff2222 !important; line-height: 1; flex-shrink: 0;
      }
      .apex-manage-delete:hover { color: #cc0000 !important; }
      .apex-manage-icon { cursor: pointer; transition: color 0.15s; }
      .apex-manage-icon:hover { color: #e07820; }
      .apex-manage-name { flex: 1; font-size: 14px; color: #333; cursor: text; }
      .apex-manage-name-input {
        flex: 1; border: 1px solid #e07820; border-radius: 3px;
        padding: 2px 6px; font-size: 14px; outline: none; background: #fff; min-width: 0;
      }
      #apex-glyph-popover {
        position: fixed; z-index: 99999;
        background: #fff; border: 1px solid #dee2e6; border-radius: 6px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.22);
        display: grid; grid-template-columns: repeat(auto-fill, minmax(42px, 1fr));
        gap: 4px; padding: 8px; width: 294px; max-height: 220px; overflow-y: auto;
      }
      #apex-help-body h3, #apex-probe-body h3 {
        color: #e07820; margin: 14px 0 5px; font-size: 11px;
        text-transform: uppercase; letter-spacing: 0.07em; font-weight: 700;
        border-bottom: 1px solid #ddd; padding-bottom: 3px;
      }
      #apex-help-body h3:first-child, #apex-probe-body h3:first-child { margin-top: 0; }
      #apex-help-body table, #apex-probe-body table, #apex-explore-right table { border-collapse: collapse; width: 100%; margin-bottom: 4px; }
      #apex-help-body td, #apex-probe-body td, #apex-explore-right td { padding: 4px 10px 4px 4px; vertical-align: top; line-height: 1.45; color: #333; }
      #apex-help-body td:first-child, #apex-probe-body td:first-child { white-space: nowrap; font-family: monospace; font-size: 12px; color: #2a6496; padding-right: 16px; }
      #apex-help-body tr:nth-child(even) td, #apex-probe-body tr:nth-child(even) td, #apex-explore-right tr:nth-child(even) td { background: rgba(0,0,0,0.03); }
      #apex-help-body td code, #apex-probe-body td code, #apex-explore-right td code { font-family: monospace; color: #c0392b; }
      #apex-explore-right th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; color: #999; font-weight: 700; padding: 0 10px 6px 4px; border-bottom: 1px solid #ddd; }
      #apex-gutter-tip {
        position: fixed; z-index: 999998; pointer-events: none; display: none;
        background: #222; color: #eee;
        font-family: system-ui, sans-serif; font-size: 12px; line-height: 1.6;
        padding: 6px 10px; border-radius: 4px; border-left: 3px solid #888;
        max-width: 320px; box-shadow: 0 2px 10px rgba(0,0,0,0.35);
        white-space: pre-wrap;
      }
      .cm-lineNumbers .cm-gutterElement[data-apex-beef] {
        position: relative;
        padding-right: 18px;
      }
      .cm-lineNumbers .cm-gutterElement[data-apex-beef]::after {
        position: absolute;
        right: 2px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 12px;
        font-family: ApexFusion;
        font-weight: 900;
        line-height: 1;
        pointer-events: none;
      }
      .cm-lineNumbers .cm-gutterElement[data-apex-beef="T"]::after {
        content: '\\f058';
        color: #4caf50;
      }
      .cm-lineNumbers .cm-gutterElement[data-apex-beef="F"]::after {
        content: '\\f057';
        color: #e05555;
      }
      .adh-swatch {
        display: inline-block; width: 11px; height: 11px;
        border-radius: 2px; vertical-align: middle; margin-right: 5px;
        border: 1px solid rgba(0,0,0,0.15);
      }
      #apex-probe-panel {
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
      #apex-probe-panel.open { transform: translateY(0); }
      #apex-probe-handle {
        height: 8px; background: #e8e8e8; cursor: ns-resize;
        flex-shrink: 0; display: flex; align-items: center; justify-content: center;
      }
      #apex-probe-handle:hover { background: #ddd; }
      #apex-probe-handle::after {
        content: ''; width: 36px; height: 3px;
        background: #bbb; border-radius: 2px;
      }
      #apex-probe-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 6px 14px; background: #222; flex-shrink: 0;
      }
      #apex-probe-header span { display: flex; align-items: center; gap: 7px; font-weight: 400; font-size: 14px; color: #9a9a9a; letter-spacing: normal; text-transform: none; }
      #apex-probe-close {
        background: none; border: none; color: #888;
        font-size: 18px; cursor: pointer; padding: 0 2px; line-height: 1;
      }
      #apex-probe-close:hover { color: #fff; }
      #apex-probe-body { overflow-y: auto; flex: 1; padding: 10px 16px 16px; background: #f5f5f5; }
#apex-explore-panel {
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
      #apex-explore-panel.open { transform: translateY(0); }
      #apex-explore-handle {
        height: 8px; background: #e8e8e8; cursor: ns-resize;
        flex-shrink: 0; display: flex; align-items: center; justify-content: center;
      }
      #apex-explore-handle:hover { background: #ddd; }
      #apex-explore-handle::after {
        content: ''; width: 36px; height: 3px;
        background: #bbb; border-radius: 2px;
      }
      #apex-explore-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 6px 14px; background: #222; flex-shrink: 0;
      }
      #apex-explore-header span { display: flex; align-items: center; gap: 7px; font-weight: 400; font-size: 14px; color: #9a9a9a; letter-spacing: normal; text-transform: none; }
      #apex-explore-close {
        background: none; border: none; color: #888;
        font-size: 18px; cursor: pointer; padding: 0 2px; line-height: 1;
      }
      #apex-explore-close:hover { color: #fff; }
      #apex-explore-body { display: flex; flex: 1; overflow: hidden; background: #f5f5f5; }
      #apex-explore-left { display: flex; flex-direction: column; width: 280px; flex-shrink: 0; border-right: 1px solid #ddd; background: #fff; }
      #apex-explore-search { padding: 8px; border-bottom: 1px solid #eee; flex-shrink: 0; display: flex; gap: 6px; }
      #apex-explore-search-wrap { display: flex; align-items: center; border: 1px solid #ccc; border-radius: 4px; background: #fff; flex: 1; min-width: 0; }
      #apex-explore-type-filter { border: 1px solid #ccc; border-radius: 4px; font-size: 12px; padding: 4px 6px; color: #555; background: #fff; cursor: pointer; flex: 1; min-width: 0; }
      #apex-explore-search-wrap:focus-within { border-color: #e07820; }
      #apex-explore-search input { flex: 1; min-width: 0; padding: 5px 8px; border: none; border-radius: 4px; font-size: 12px; outline: none; background: transparent; }
      #apex-explore-search-clear { border: none; background: none; cursor: pointer; padding: 0 6px; font-size: 14px; color: #aaa; line-height: 1; flex-shrink: 0; }
      .apex-explore-keyword.active { background: #e07820; color: #fff; }
      #apex-explore-list { overflow-y: auto; flex: 1; }
      .apex-explore-probe { padding: 6px 12px; cursor: pointer; font-size: 12px; border-bottom: 1px solid #f0f0f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .apex-explore-probe:hover { background: #f5f5f5; }
      .apex-explore-probe.active { background: #e07820; color: #fff; }
      #apex-explore-divider { width: 5px; cursor: col-resize; background: #ddd; flex-shrink: 0; transition: background 0.15s; }
      #apex-explore-divider:hover, #apex-explore-divider.dragging { background: #bbb; }
      #apex-explore-divider2 { width: 0; overflow: hidden; background: #ddd; flex-shrink: 0; transition: width 0.2s ease, background 0.15s; cursor: col-resize; }
      #apex-explore-divider2:hover, #apex-explore-divider2.dragging { background: #bbb; }
      #apex-explore-panel.preview-open #apex-explore-divider2 { width: 5px; }
      #apex-explore-right { flex: 1; overflow-y: auto; padding: 10px 16px 16px; background: #f5f5f5; }
      #apex-explore-preview { width: 0; flex-shrink: 0; overflow: hidden; background: #fff; font-size: 14px; white-space: pre; font-family: "Source Code Pro", monospace; border-left: 1px solid #e0e0e0; transition: width 0.2s ease, padding 0.2s ease; padding: 0; }
      #apex-explore-panel.preview-open #apex-explore-preview { width: 544px; padding: 10px 16px 16px; overflow-y: auto; }
      #apex-explore-preview p { white-space: normal; font-family: inherit; color: #888; margin: 0; }
      #apex-explore-right h3 { color: #e07820; margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 700; padding-left: 4px; }
      .apex-explore-right-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 8px; }
      .apex-explore-toggle { display: inline-flex; border: 1px solid #ccc; border-radius: 4px; overflow: hidden; }
      .apex-explore-toggle button { background: #fff; border: none; padding: 2px 8px; font-size: 11px; cursor: pointer; color: #555; line-height: 1.6; }
      .apex-explore-toggle button.active { background: #e07820; color: #fff; }
      .apex-explore-toggle button:hover:not(.active) { background: #f0f0f0; }
      #apex-debug-toggle, #apex-debug-help {
        background-color: rgb(71,73,73) !important;
        border-color: rgb(71,73,73) !important;
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

  function helpContent() {
    const legend = beefMode ? `
    <h3>Legend — Beef Mode</h3>
    <table>
      <tr><td><i class="af af-fw" style="color:#4caf50;font-size:13px">&#xf058;</i> Gutter icon</td><td>Condition is currently <strong>true</strong></td></tr>
      <tr><td><i class="af af-fw" style="color:#e05555;font-size:13px">&#xf057;</i> Gutter icon</td><td>Condition is currently <strong>false</strong></td></tr>
      <tr><td>No icon</td><td>Cannot evaluate (Sun, Moon, OSC, timers…) or neutral</td></tr>
      <tr><td><span class="adh-swatch" style="background: radial-gradient(circle, rgba(0,160,0,0.5) 1.5px, transparent 1.5px); background-size: 6px 6px; background-color:#f0fff0"></span>Dot pattern line</td><td>Winning statement → outlet will be <strong>ON</strong></td></tr>
      <tr><td><span class="adh-swatch" style="background: repeating-linear-gradient(90deg, transparent 0px, transparent 3px, rgba(200,0,0,0.4) 3px, rgba(200,0,0,0.4) 5px); background-color:#fff0f0"></span>Stripe pattern line</td><td>Winning statement → outlet will be <strong>OFF</strong></td></tr>
    </table>` : `
    <h3>Color legend</h3>
    <table>
      <tr><td><span class="adh-swatch" style="background:#c8f7c5"></span>Green gutter</td><td>Condition is currently <strong>true</strong></td></tr>
      <tr><td><span class="adh-swatch" style="background:#f7c5c5"></span>Red gutter</td><td>Condition is currently <strong>false</strong></td></tr>
      <tr><td><span class="adh-swatch" style="background:#e0e0e0"></span>Grey gutter</td><td>Cannot evaluate (Sun, Moon, OSC, timers…)</td></tr>
      <tr><td>No color</td><td>Neutral — Fallback, Set [profile], blank lines</td></tr>
      <tr><td><span class="adh-swatch" style="background:#c8f7c5"></span>Green line bg</td><td>Winning statement → outlet will be <strong>ON</strong></td></tr>
      <tr><td><span class="adh-swatch" style="background:#f7c5c5"></span>Red line bg</td><td>Winning statement → outlet will be <strong>OFF</strong></td></tr>
    </table>`;

  return legend + `

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
      <tr><td>If [Input] CLOSED Then ON|OFF</td><td>Digital switch — CLOSED = any non-zero value (60, 200, 4, 12, etc. depending on module).</td></tr>
      <tr><td>If Output [name] = ON|OFF Then ON|OFF</td><td>Tests another outlet's current on/off state.</td></tr>
      <tr><td>If Outlet [name] = ON|OFF Then ON|OFF</td><td>Identical to Output (older firmware keyword).</td></tr>
      <tr><td>If Output [name] Percent &gt; [val] Then ON|OFF</td><td>Tests variable output intensity 0–100.</td></tr>
      <tr><td>If Output [name] Percent &lt; [val] Then ON|OFF</td><td>Same, less-than.</td></tr>
      <tr><td>If FeedA|B|C|D MMM Then ON|OFF</td><td>True while that feed cycle is running. MMM = minutes to stay true after it ends. If MMM &gt; 0 and feed is not active, shown grey — post-feed window can't be determined from status alone.</td></tr>
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

    <h3>Output status codes</h3>
    <table>
      <tr><td>AON</td><td>Auto mode, currently <strong>ON</strong></td></tr>
      <tr><td>ATO</td><td>Auto mode, output ON — older/alt encoding. <strong>ON</strong></td></tr>
      <tr><td>FON</td><td>Forced ON (manual override). <strong>ON</strong></td></tr>
      <tr><td>ON</td><td>Explicit ON. <strong>ON</strong></td></tr>
      <tr><td>TBL</td><td>Running on a table/profile. <strong>ON</strong></td></tr>
      <tr><td>AOF</td><td>Auto mode, currently <strong>OFF</strong></td></tr>
      <tr><td>FOF</td><td>Forced OFF (manual override). <strong>OFF</strong></td></tr>
      <tr><td>OFF</td><td>Explicit OFF (fallback / no program). <strong>OFF</strong></td></tr>
    </table>

    <h3>Digital input values</h3>
    <table>
      <tr><td>0</td><td>OPEN / OFF — switch not triggered (all modules)</td></tr>
      <tr><td>60</td><td>CLOSED / ON — FMM optical sensors, float switches (most common)</td></tr>
      <tr><td>200</td><td>CLOSED / ON — different module/port encoding (also common)</td></tr>
      <tr><td>4, 12, 20, 28</td><td>CLOSED — base unit / breakout box float switches</td></tr>
      <tr><td>100</td><td>CLOSED — some FMM / leak inputs</td></tr>
      <tr><td>196, 204</td><td>CLOSED — 200-series variants</td></tr>
    </table>
    <p style="margin:4px 0 0; font-size:11px; color:#777;">Rule: <code>0</code> = OPEN, any non-zero = CLOSED. Two switches can both be CLOSED but report different numbers — don't key off the exact value.</p>

    <h3>Input / output types</h3>
    <table>
      <tr><td>in</td><td>Input — sensors / read-only data (optical switch, temp probe)</td></tr>
      <tr><td>out</td><td>Output — controllable outlets (solenoid, pump, light)</td></tr>
      <tr><td>var</td><td>Variable — internal/calculated values (virtual outlets, logic results)</td></tr>
      <tr><td>probe</td><td>Probe — specialized sensor (pH, ORP, salinity)</td></tr>
      <tr><td>virt</td><td>Virtual — software-only outlet (alarms, logic-only)</td></tr>
      <tr><td>tile</td><td>UI Tile — dashboard grouping element</td></tr>
      <tr><td>module</td><td>Module — physical Apex module (FMM, EB832, DOS)</td></tr>
      <tr><td>alarm</td><td>Alarm — alarm status object (email/SMS)</td></tr>
      <tr><td>feed</td><td>Feed Mode — feed cycle state (FeedA, FeedB…)</td></tr>
      <tr><td>clock</td><td>Clock — Apex internal system time</td></tr>
      <tr><td>status</td><td>Status — system-level status (heartbeat, health)</td></tr>
      <tr><td>config</td><td>Config — configuration object / settings metadata</td></tr>
    </table>
  `; }

  function injectHelpPanel() {
    if (document.getElementById('apex-help-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'apex-help-panel';
    panel.innerHTML =
      '<div id="apex-help-handle"></div>' +
      '<div id="apex-help-header"><span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="16" height="16" fill="#9a9a9a"><path d="M29.83,20l.34-2L25,17.15V13c0-.08,0-.15,0-.23l5.06-1.36-.51-1.93-4.83,1.29A9,9,0,0,0,20,5V2H18V4.23a8.81,8.81,0,0,0-4,0V2H12V5a9,9,0,0,0-4.71,5.82L2.46,9.48,2,11.41,7,12.77c0,.08,0,.15,0,.23v4.15L1.84,18l.32,2L7,19.18a8.9,8.9,0,0,0,.82,3.57L3.29,27.29l1.42,1.42,4.19-4.2a9,9,0,0,0,14.2,0l4.19,4.2,1.42-1.42-4.54-4.54A8.9,8.9,0,0,0,25,19.18ZM15,25.92A7,7,0,0,1,9,19V13h6ZM9.29,11a7,7,0,0,1,13.42,0ZM23,19a7,7,0,0,1-6,6.92V13h6Z"/></svg>apex debug</span><button id="apex-help-close" title="Close">\u00d7</button></div>' +
      '<div id="apex-help-body">' + helpContent() + '</div>';
    document.body.appendChild(panel);
    document.getElementById('apex-help-close').addEventListener('click', closeHelpPanel);
    document.getElementById('apex-help-handle').addEventListener('mousedown', makePanelResizer(panel));
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

  // ── Probe panel ─────────────────────────────────────────────────────────────

  function injectProbePanel() {
    if (document.getElementById('apex-probe-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'apex-probe-panel';
    panel.innerHTML =
      '<div id="apex-probe-handle"></div>' +
      '<div id="apex-probe-header"><span id="apex-probe-title"></span><button id="apex-probe-close" title="Close">\u00d7</button></div>' +
      '<div id="apex-probe-body"></div>';
    document.body.appendChild(panel);
    document.getElementById('apex-probe-close').addEventListener('click', closeProbePanel);
    document.getElementById('apex-probe-handle').addEventListener('mousedown', makePanelResizer(panel));
  }

  async function fetchProbeUsages(name) {
    try {
      const r = await fetch(`${CONFIG_URL}?_=${Date.now()}`, { cache: 'no-store' });
      const json = await r.json();
      const oconf = json.oconf || [];
      const iconf = (json.iconf || []).filter(item => item.name);
      const seen = new Set(oconf.map(i => i.name));
      const allNames = [...oconf, ...iconf.filter(i => !seen.has(i.name))].map(i => i.name);
      const rows = [];
      const needleRe = new RegExp('(?<![\\w-])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])', 'i');
      for (const item of oconf) {
        const lines = (item.prog || '').split('\n');
        lines.forEach((line, i) => {
          if (/^tdata\b/i.test(line.trim())) return;
          if (needleRe.test(line)) {
            rows.push({ name: item.name, did: item.did, lineNum: i + 1, line: line.trim(), prog: item.prog || '' });
          }
        });
      }
      return { rows, allNames };
    } catch (_) {
      return { rows: [], allNames: [] };
    }
  }

  function esc(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const PROBE_ICONS = {
    'Temp':                       'F2C9',
    'pH':                         'F0C3',
    'ORP':                        'F0C3',
    'Cond':                       'F0C3',
    'Amps':                       'F0E7',
    'pwr':                        'F0E7',
    'watts':                      'F0E7',
    'volts':                      'F0E7',
    'po4':                        'F1FB',
    'no3':                        'F1FB',
    'digital':                    'F1EC',
    'in':                         'F5B7',
    'alk':                        'F1FB',
    'ca':                         'F1FB',
    'mg':                         'F1FB',
    'outlet':                     'E001',
    'virtual':                    'F0C2',
    'alert':                      'F34E',
    'dos':                        'F0A0',
    'dqd':                        'F0A0',
    'variable':                   '',
    '24v':                        'F0E7',
    'selector':                   'F0A0',
    'wav':                        'E004',
    'cor|20':                     'E004',
    'cor|15':                     'E004',
    'MXMPump|Ecotech|Vortech':    'F0A0',
    'keyword':                    'F111',
  };
  const PROBE_ICON_UNKNOWN = 'F129';

  function probeIcon(type) {
    if (type === undefined) return '';
    const code = Object.prototype.hasOwnProperty.call(PROBE_ICONS, type) ? PROBE_ICONS[type] : PROBE_ICON_UNKNOWN;
    return code ? `<i class="af af-fw" style="font-style:normal;margin-right:4px;color:#aaa">&#x${code};</i>` : '';
  }

  function panelTitle(name) {
    const icon = '<i class="af af-fw" style="font-style:normal;margin-right:6px">&#xF121;</i>';
    return name ? `${icon}Explore references to: ${esc(name)}` : `${icon}Explore references`;
  }

  function highlightLine(raw, probeName, knownNames = []) {
    const escapedProbe = probeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const otherNames = knownNames
      .filter(n => n && n.toLowerCase() !== probeName.toLowerCase())
      .sort((a, b) => b.length - a.length)
      .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const parts = [
      `(?<probe>${escapedProbe})`,
      otherNames.length ? `(?<name>${otherNames.join('|')})` : null,
      `(?<ctrl>\\b(?:If|Then|Set|Fallback|Defer|Min|OSC|When|to)\\b)`,
      `(?<state>\\b(?:ON|OFF|OPEN|CLOSED)\\b)`,
      `(?<type>\\b(?:Time|FeedA|FeedB|FeedC|FeedD|Output|Switch|Power|Apex|Error|Input|Outlet|Sun|Moon|DOW|EB|Percent|Amps|Watts)\\b)`,
      `(?<rt>RT\\+[-\\d.]*)`,
      `(?<op>[><]=?|=)`,
      `(?<time>\\d{1,2}:\\d{2}(?::\\d{2})?)`,
      `(?<num>\\d+\\.?\\d*)`,
    ].filter(Boolean);
    const re = new RegExp(parts.join('|'), 'gi');
    const styles = {
      probe: 'color:rgb(0,136,85);font-weight:700',
      name:  'color:rgb(0,136,85);font-weight:600',
      ctrl:  'color:#8959a8',
      state: 'color:rgb(34,17,153)',
      type:  'color:rgb(66,113,174)',
      rt:    'color:#f5871f',
      op:    'color:rgb(84,84,84)',
      time:  'color:#f5871f',
      num:   'color:#f5871f',
    };
    let out = '', last = 0, m;
    while ((m = re.exec(raw)) !== null) {
      out += esc(raw.slice(last, m.index));
      last = re.lastIndex;
      const type = Object.keys(m.groups).find(k => m.groups[k] !== undefined);
      out += `<span style="${styles[type]}">${esc(m[0])}</span>`;
    }
    return out + esc(raw.slice(last));
  }

  function renderCodePreview(container, prog, matchLineNum, name, allNames = []) {
    container.innerHTML = prog.split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => !/^tdata\b/i.test(line.trim()))
      .map(({ line, n }) => {
        const cls = 'apex-prog-line' + (n === matchLineNum ? ' match' : '');
        return `<span class="${cls}"><span style="color:#bbb;display:inline-block;width:2em;text-align:right;margin-right:10px;user-select:none">${n}</span>${highlightLine(line, name, allNames)}</span>`;
      }).join('');
    requestAnimationFrame(() => container.querySelector('.match')?.scrollIntoView({ block: 'center' }));
  }

  function renderRefsTable(container, rows, name, allNames, onRowClick) {
    if (!rows.length) {
      container.innerHTML = '<p style="color:#888;margin:0">No references found.</p>';
      return;
    }
    container.innerHTML =
      '<table>' +
      '<thead><tr><th>Output</th><th style="text-align:center">#</th><th>Code</th></tr></thead>' +
      '<tbody>' +
      rows.map((r, i) =>
        `<tr class="apex-probe-row" data-i="${i}" style="cursor:pointer">` +
        `<td><a href="/apex/config/outputs/${esc(String(r.did))}" target="_blank">${esc(r.name)}</a></td>` +
        `<td style="color:#bbb;text-align:center;padding-right:12px">${r.lineNum}</td>` +
        `<td><code>${highlightLine(r.line, name, allNames)}</code></td>` +
        `</tr>`
      ).join('') +
      '</tbody></table>';
    container.querySelectorAll('.apex-probe-row').forEach(tr => {
      tr.addEventListener('click', e => {
        if (e.target.tagName === 'A') return;
        container.querySelectorAll('.apex-probe-row').forEach(r => r.classList.remove('active'));
        tr.classList.add('active');
        onRowClick(rows[+tr.dataset.i]);
      });
    });
  }

  function openProbePanel(name) {
    closeExplorePanel();
    injectProbePanel();
    document.getElementById('apex-probe-title').innerHTML = panelTitle(name);
    const body = document.getElementById('apex-probe-body');
    body.innerHTML = '<div id="apex-probe-left"><p style="color:#888;margin:0">Loading\u2026</p></div><div id="apex-probe-divider"></div><div id="apex-probe-right"><p>Click a row to preview</p></div>';
    document.getElementById('apex-probe-divider').addEventListener('mousedown', e => {
      e.preventDefault();
      const divider = e.currentTarget;
      const left = document.getElementById('apex-probe-left');
      const panel = document.getElementById('apex-probe-body');
      divider.classList.add('dragging');
      function onMove(ev) {
        const panelRect = panel.getBoundingClientRect();
        const newW = Math.min(Math.max(ev.clientX - panelRect.left, 150), panelRect.width - 150);
        left.style.width = newW + 'px';
      }
      function onUp() {
        divider.classList.remove('dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    requestAnimationFrame(() => document.getElementById('apex-probe-panel').classList.add('open'));
    probeOpen = true;
    fetchProbeUsages(name).then(({ rows, allNames }) => {
      const left = document.getElementById('apex-probe-left');
      if (!left) return;
      renderRefsTable(left, rows, name, allNames, r => {
        const right = document.getElementById('apex-probe-right');
        if (right) renderCodePreview(right, r.prog, r.lineNum, name, allNames);
      });
    });
  }

  function closeProbePanel() {
    const panel = document.getElementById('apex-probe-panel');
    if (panel) panel.classList.remove('open');
    probeOpen = false;
  }

  // ── Explore panel ───────────────────────────────────────────────────────────

  function injectExplorePanel() {
    if (document.getElementById('apex-explore-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'apex-explore-panel';
    panel.innerHTML =
      '<div id="apex-explore-handle"></div>' +
      `<div id="apex-explore-header"><span>${panelTitle()}</span><button id="apex-explore-close" title="Close">\u00d7</button></div>` +
      '<div id="apex-explore-body">' +
        '<div id="apex-explore-left">' +
          '<div id="apex-explore-search"><div id="apex-explore-search-wrap"><input type="text" id="apex-explore-search-input" placeholder="Search"><button id="apex-explore-search-clear">\u00d7</button></div><select id="apex-explore-type-filter"><option value="">All</option></select></div>' +
          '<div id="apex-explore-list"><p style="color:#888;padding:10px;margin:0">Loading\u2026</p></div>' +
        '</div>' +
        '<div id="apex-explore-divider"></div>' +
        '<div id="apex-explore-right"><p style="color:#888;margin:0">Select a probe to see references.</p></div>' +
        '<div id="apex-explore-divider2"></div>' +
        '<div id="apex-explore-preview"><p>Click a reference to preview its program.</p></div>' +
      '</div>';
    document.body.appendChild(panel);
    document.getElementById('apex-explore-close').addEventListener('click', closeExplorePanel);
    document.getElementById('apex-explore-handle').addEventListener('mousedown', makePanelResizer(panel));
  }

  async function openExplorePanel() {
    closeProbePanel();
    injectExplorePanel();
    requestAnimationFrame(() => document.getElementById('apex-explore-panel').classList.add('open'));
    document.getElementById('apex-explore-btn')?.classList.add('active');
    exploreOpen = true;

    // Wire left/right divider resizer
    const divider = document.getElementById('apex-explore-divider');
    if (divider && !divider._wired) {
      divider._wired = true;
      divider.addEventListener('mousedown', e => {
        e.preventDefault();
        divider.classList.add('dragging');
        const left = document.getElementById('apex-explore-left');
        const body = document.getElementById('apex-explore-body');
        function onMove(ev) {
          const rect = body.getBoundingClientRect();
          left.style.width = Math.min(Math.max(ev.clientX - rect.left, 150), rect.width - 150) + 'px';
        }
        function onUp() {
          divider.classList.remove('dragging');
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    }

    // Wire middle/preview divider resizer
    const divider2 = document.getElementById('apex-explore-divider2');
    if (divider2 && !divider2._wired) {
      divider2._wired = true;
      divider2.addEventListener('mousedown', e => {
        e.preventDefault();
        divider2.classList.add('dragging');
        const preview = document.getElementById('apex-explore-preview');
        const body = document.getElementById('apex-explore-body');
        function onMove(ev) {
          const rect = body.getBoundingClientRect();
          preview.style.width = Math.min(Math.max(rect.right - ev.clientX, 150), rect.width - 150) + 'px';
        }
        function onUp() {
          divider2.classList.remove('dragging');
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    }

    let allOconf = [];
    let allProbes = [];
    try {
      const r = await fetch(`${CONFIG_URL}?_=${Date.now()}`, { cache: 'no-store' });
      const json = await r.json();
      allOconf = (json.oconf || []).filter(item => item.name);
      const iconf = (json.iconf || []).filter(item => item.name);
      const seen = new Set(allOconf.map(i => i.name));
      allProbes = [...allOconf, ...iconf.filter(i => !seen.has(i.name))];
    } catch (_) {}

    const list = document.getElementById('apex-explore-list');
    if (!list) return;

    let exploreMode = 'referenced';
    let selectedProbe = null;
    let selectedType = '';

    function renderRefs(name) {
      const right = document.getElementById('apex-explore-right');
      if (!right) return;
      const needleRe = new RegExp('(?<![\\w-])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])', 'i');
      const loc = { sensitivity: 'base' };
      const allNames = allProbes.map(p => p.name);

      right.innerHTML =
        `<div class="apex-explore-right-header">` +
          `<h3 id="apex-explore-refs-title"></h3>` +
          `<div class="apex-explore-toggle">` +
            `<button data-mode="referenced" class="${exploreMode === 'referenced' ? 'active' : ''}">Referenced in</button>` +
            `<button data-mode="not-referenced" class="${exploreMode === 'not-referenced' ? 'active' : ''}">Not referenced in</button>` +
          `</div>` +
        `</div>` +
        `<div id="apex-explore-refs-body"></div>`;

      right.querySelectorAll('.apex-explore-toggle button').forEach(btn => {
        btn.addEventListener('click', () => {
          exploreMode = btn.dataset.mode;
          document.getElementById('apex-explore-panel')?.classList.remove('preview-open');
          renderRefs(name);
        });
      });

      const titleEl = document.getElementById('apex-explore-refs-title');
      const body = document.getElementById('apex-explore-refs-body');

      if (exploreMode === 'referenced') {
        const refs = allOconf
          .filter(item => item.name !== name)
          .flatMap(item => {
            const allLines = (item.prog || '').split('\n');
            return allLines
              .map((line, i) => ({ lineNum: i + 1, line }))
              .filter(({ line }) => !/^tdata\b/i.test(line.trim()) && needleRe.test(line))
              .map(({ lineNum, line }) => ({ name: item.name, did: item.did, lineNum, line: line.trim(), prog: item.prog || '' }));
          })
          .sort((a, b) => a.name.localeCompare(b.name, undefined, loc));
        if (titleEl) titleEl.textContent = refs.length ? `Referenced in (${refs.length})` : 'Referenced in';
        if (refs.length) {
          renderRefsTable(body, refs, name, allNames, r => {
            const preview = document.getElementById('apex-explore-preview');
            if (!preview) return;
            renderCodePreview(preview, r.prog, r.lineNum, name, allNames);
            document.getElementById('apex-explore-panel')?.classList.add('preview-open');
          });
        } else {
          body.innerHTML = `<p style="color:#888;margin:8px 0 0">No other probes reference <strong>${esc(name)}</strong>.</p>`;
        }
      } else {
        const notRefs = allOconf
          .filter(item =>
            item.name !== name &&
            !(item.prog || '').split('\n').some(line =>
              !/^tdata\b/i.test(line.trim()) && needleRe.test(line)
            )
          )
          .sort((a, b) => a.name.localeCompare(b.name, undefined, loc));
        if (titleEl) titleEl.textContent = notRefs.length ? `Not referenced in (${notRefs.length})` : 'Not referenced in';
        body.innerHTML = notRefs.length
          ? notRefs.map(item =>
              `<div style="padding:4px 12px;font-weight:700"><a href="/apex/config/outputs/${esc(String(item.did))}" target="_blank" style="color:inherit;text-decoration:none">${esc(item.name)}</a></div>`
            ).join('')
          : `<p style="color:#888;margin:8px 0 0">All other probes reference <strong>${esc(name)}</strong>.</p>`;
      }
    }

    function selectProbe(name) {
      selectedProbe = name;
      const header = document.querySelector('#apex-explore-header span');
      if (header) header.innerHTML = panelTitle(name);
      list.querySelectorAll('.apex-explore-probe').forEach(el =>
        el.classList.toggle('active', el.dataset.name === name)
      );

      document.getElementById('apex-explore-panel')?.classList.remove('preview-open');
      const preview = document.getElementById('apex-explore-preview');
      if (preview) preview.innerHTML = '';
      renderRefs(name);
    }

    function renderList(filter) {
      const q = filter.toLowerCase();
      const filtered = allProbes
        .filter(item => !q || item.name.toLowerCase().includes(q))
        .filter(item => !selectedType || item.type === selectedType)
        .slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      const keywords = !selectedType ? ['Fallback', 'Set'].filter(kw => !q || kw.toLowerCase().includes(q)) : [];
      if (!filtered.length && !keywords.length) {
        list.innerHTML = '<p style="color:#888;padding:10px;margin:0">No probes found.</p>';
        return;
      }
      const referencedNames = new Set();
      for (const item of allOconf) {
        const prog = item.prog || '';
        for (const probe of filtered) {
          if (probe.name === item.name) continue;
          const re = new RegExp('(?<![\\w-])' + probe.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])', 'i');
          if (re.test(prog)) referencedNames.add(probe.name);
        }
      }
      const sectionLabel = text =>
        `<div style="padding:4px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#aaa;border-top:1px solid #e0e0e0;margin-top:2px;position:sticky;top:0;background:#fff;z-index:1">${text}</div>`;
      const probeHTML = items => items.map(item =>
        `<div class="apex-explore-probe" data-name="${esc(item.name)}">${probeIcon(item.type)}${esc(item.name)}</div>`
      ).join('');
      const used   = filtered.filter(p => referencedNames.has(p.name));
      const unused = filtered.filter(p => !referencedNames.has(p.name));
      list.innerHTML =
        (keywords.length ? sectionLabel('Apex keywords') + probeHTML(keywords.map(k => ({ name: k, type: 'keyword' }))) : '') +
        (used.length ? sectionLabel('Inputs, outputs & probes') + probeHTML(used) : '') +
        (unused.length ? sectionLabel('Unreferenced') + probeHTML(unused) : '');
      list.querySelectorAll('.apex-explore-probe').forEach(el => {
        el.addEventListener('click', () => selectProbe(el.dataset.name));
      });
    }

    const typeFilter = document.getElementById('apex-explore-type-filter');
    if (typeFilter) {
      const types = [...new Set(allProbes.map(p => p.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      types.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t.split('|')[0];
        typeFilter.appendChild(opt);
      });
      typeFilter.addEventListener('change', () => {
        selectedType = typeFilter.value;
        renderList(input?.value || '');
      });
    }

    renderList('');

    const input = document.getElementById('apex-explore-search-input');
    if (input) {
      input.addEventListener('input', () => renderList(input.value));
      const clearExplore = document.getElementById('apex-explore-search-clear');
      if (clearExplore) {
        clearExplore.addEventListener('click', () => {
          input.value = '';
          renderList('');
          input.focus();
        });
      }
      input.focus();
    }
  }

  function closeExplorePanel() {
    const panel = document.getElementById('apex-explore-panel');
    if (panel) panel.classList.remove('open');
    document.getElementById('apex-explore-btn')?.classList.remove('active');
    exploreOpen = false;
  }

  function makePanelResizer(panel) {
    return function(e) {
      e.preventDefault();
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
    };
  }

  // ── Toggle ─────────────────────────────────────────────────────────────────

  function setEnabled(val) {
    enabled = val;
    const btn = document.getElementById('apex-debug-toggle');

    if (enabled) {
      btn && btn.classList.add('active');
      fetchConfig().then(({ season, feedIntervals }) => { lastSeason = season; lastFeedIntervals = feedIntervals; refresh(); });
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
    if (/\/apex\/config\/(inputs|outputs)\//.test(location.pathname)) return;
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
      const isOutputPage = /\/apex\/config\/outputs\//.test(location.pathname);
      const isInputPage  = /\/apex\/config\/inputs\//.test(location.pathname);
      const outputNavGroup = isOutputPage ? document.querySelector('.nav-group.flex-row-reverse') : null;
      const copyBtn = !isOutputPage && !isInputPage ? document.querySelector('button[title="Copy"]') : null;
      const navGroup = !isOutputPage && !isInputPage && !copyBtn ? document.querySelector('.nav-items .nav-group') : null;
      const anchor = outputNavGroup || (isInputPage && document.querySelector('.nav-items')) || copyBtn || navGroup;
      if (anchor && ((isOutputPage || isInputPage) ? document.querySelector('button[title="Dashboard"]') : document.querySelector('.lead'))) {
        const btn = document.createElement('button');
        btn.id        = 'apex-debug-toggle';
        btn.type      = 'button';
        btn.title     = 'Debug';
        btn.className = 'btn btn-secondary';
        btn.innerHTML = '<i class="af af-fw" style="font-style:normal">&#xF121;</i>';
        btn.style.cssText = 'align-items:center; justify-content:center;';
        btn.addEventListener('click', async () => {
          const did = location.pathname.split('/').pop();
          const istat = await fetchStatus();
          if (!istat) return;
          const all = [...(istat.inputs || []), ...(istat.outputs || [])];
          const entry = all.find(x => String(x.did) === String(did));
          const name = entry?.name;
          if (name) openProbePanel(name);
        });
        if (outputNavGroup) {
          const help = document.createElement('button');
          help.id        = 'apex-debug-help';
          help.type      = 'button';
          help.title     = 'Debug Help';
          help.className = 'btn btn-secondary';
          help.innerHTML = '<i class="af af-fw" style="font-style:normal">&#xF0EB;</i>';
          help.style.cssText = 'align-items:center; justify-content:center;';
          help.addEventListener('click', toggleHelpPanel);
          const divider = document.createElement('div');
          divider.style.cssText = 'width:1px;background:rgba(71,73,73,0.5);margin:4px 2px;align-self:stretch;';
          outputNavGroup.append(divider);
          outputNavGroup.append(help);
          outputNavGroup.append(btn);
        } else if (isInputPage) {
          const updateBtn = document.querySelector('.nav-items button[title="Update Apex"]');
          if (updateBtn) {
            const newGroup = document.createElement('div');
            newGroup.className = 'nav-group';
            updateBtn.replaceWith(newGroup);
            const divider = document.createElement('div');
            divider.style.cssText = 'width:1px;background:rgba(71,73,73,0.5);margin:4px 2px;align-self:stretch;';
            newGroup.appendChild(btn);
            newGroup.appendChild(divider);
            newGroup.appendChild(updateBtn);
          } else {
            document.querySelector('.nav-items').appendChild(btn);
          }
        } else if (copyBtn) {
          copyBtn.insertAdjacentElement('afterend', btn);
          const help = document.createElement('button');
          help.id        = 'apex-debug-help';
          help.type      = 'button';
          help.title     = 'Debug Help';
          help.className = 'btn btn-secondary';
          help.innerHTML = '<i class="af af-fw" style="font-style:normal">&#xF0EB;</i>';
          help.style.cssText = 'align-items:center; justify-content:center;';
          help.addEventListener('click', toggleHelpPanel);
          btn.insertAdjacentElement('beforebegin', help);
        } else {
          const updateBtn = document.querySelector('.nav-items button[title="Update Apex"]');
          if (updateBtn) {
            const rightGroup = document.createElement('div');
            rightGroup.className = 'nav-group';
            updateBtn.parentNode.insertBefore(rightGroup, updateBtn);
            rightGroup.appendChild(btn);
            rightGroup.appendChild(updateBtn);
          } else {
            navGroup.appendChild(btn);
          }
        }
        setEnabled(true);
      }
    }
    updateButtonVisibility();
  }

  // ── Dashboard icons ────────────────────────────────────────────────────────

  const DASH_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="14" height="14" fill="currentColor"><path d="M29.83,20l.34-2L25,17.15V13c0-.08,0-.15,0-.23l5.06-1.36-.51-1.93-4.83,1.29A9,9,0,0,0,20,5V2H18V4.23a8.81,8.81,0,0,0-4,0V2H12V5a9,9,0,0,0-4.71,5.82L2.46,9.48,2,11.41,7,12.77c0,.08,0,.15,0,.23v4.15L1.84,18l.32,2L7,19.18a8.9,8.9,0,0,0,.82,3.57L3.29,27.29l1.42,1.42,4.19-4.2a9,9,0,0,0,14.2,0l4.19,4.2,1.42-1.42-4.54-4.54A8.9,8.9,0,0,0,25,19.18ZM15,25.92A7,7,0,0,1,9,19V13h6ZM9.29,11a7,7,0,0,1,13.42,0ZM23,19a7,7,0,0,1-6,6.92V13h6Z"/></svg>';

  function injectDashIcons() {
    if (!location.pathname.startsWith('/apex/dash')) return;
    function makeIcon() {
      const icon = document.createElement('i');
      icon.className = 'af af-fw apex-dash-icon';
      icon.textContent = '\uF121';
      icon.style.cssText = 'color:#999;margin-right:4px;cursor:default;vertical-align:text-bottom;line-height:21px;';
      return icon;
    }
    document.querySelectorAll('.dash-selector-config').forEach(el => {
      if (el.previousElementSibling?.classList.contains('apex-dash-icon')) return;
      const icon = makeIcon();
      icon.style.cursor = 'pointer';
      icon.addEventListener('click', e => {
        e.stopPropagation();
        const name = el.closest('.dash-selector')?.querySelector('.dash-selector-name')?.innerHTML ?? '';
        openProbePanel(name);
      });
      el.insertAdjacentElement('beforebegin', icon);
    });
    document.querySelectorAll('.dash-switch-config').forEach(el => {
      if (el.firstElementChild?.classList.contains('apex-dash-icon')) return;
      const icon = makeIcon();
      icon.style.cursor = 'pointer';
      icon.style.lineHeight = '17px';
      icon.addEventListener('click', e => {
        e.stopPropagation();
        const name = el.closest('.dash-switch')?.querySelector('.dash-switch-name')?.innerHTML ?? '';
        openProbePanel(name);
      });
      el.insertAdjacentElement('afterbegin', icon);
    });
    document.querySelectorAll('.dash-probe-info-config').forEach(el => {
      if (el.querySelector('.apex-dash-icon')) return;
      const icon = makeIcon();
      icon.style.cssText = 'color:#999;position:absolute;right:24px;top:50%;transform:translateY(-50%);margin:0;cursor:pointer;';
      icon.addEventListener('click', e => {
        e.stopPropagation();
        const name = el.closest('.dash-probe')?.querySelector('.dash-probe-info-name')?.innerHTML ?? '';
        openProbePanel(name);
      });
      el.appendChild(icon);
    });

    const unusedSection = document.getElementById('dash-section-0');
    const unusedContainer = document.getElementById('dash-widget-unused');
    if (unusedContainer && !document.getElementById('apex-unused-header')) {
      const card = document.createElement('div');
      card.className = 'card mt-2';
      card.style.cssText = 'border-bottom-left-radius:0;border-bottom-right-radius:0;';
      const filterRow = document.createElement('div');
      filterRow.id = 'apex-unused-header';
      filterRow.className = 'card-header row g-1';
      filterRow.innerHTML =
        '<div class="col-md-6">' +
          '<div class="input-group">' +
            '<input class="form-control" id="apex-unused-search" type="text" placeholder="Filter...">' +
            '<button class="btn btn-secondary" id="apex-unused-search-clear" type="button" title="Clear">' +
              '<i class="af af-times"></i>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="col-md-6">' +
          '<select class="form-select" id="apex-unused-type" disabled>' +
            '<option value="">Loading...</option>' +
          '</select>' +
        '</div>';
      card.appendChild(filterRow);
      unusedContainer.insertBefore(card, unusedSection);

      const searchInput = card.querySelector('#apex-unused-search');
      const clearBtn = card.querySelector('#apex-unused-search-clear');
      const typeSelect = card.querySelector('#apex-unused-type');

      unusedSection?.querySelectorAll(':scope > :not(.dash-widget)').forEach(el => { el.style.display = 'none'; });

      const WIDGET_GROUPS = {
        'Probes':                  ['Temp', 'pH', 'ORP', 'Cond'],
        'Pumps':                   ['wav', 'cor|20', 'cor|15', 'cor', 'MXMPump|Ecotech|Vortech', 'variable'],
        'Sensors, switches & LLS':  ['digital', 'in'],
        'Virtual Outlets':         ['virtual'],
        'Alarms':                  ['alert'],
        'Outlets':                 ['outlet'],
        'Dos & Dos QD':            ['dos', 'dqd', 'ddr'],
        'Power':                   ['Amps', 'pwr', 'volts', 'variable', 'ebg'],
        'Solenoids & Other 24v':   ['24v'],
        'Trident':                 ['selector', 'tri'],
        'Custom':                  ['cw_divider', 'divider'],
      };
      const typeToGroups = new Map();
      for (const [group, types] of Object.entries(WIDGET_GROUPS))
        types.forEach(t => typeToGroups.set(t, [...(typeToGroups.get(t) || []), group]));

      const filterWidgets = () => {
        const q = searchInput.value.toLowerCase();
        const g = typeSelect.value;
        unusedSection?.querySelectorAll('.dash-widget').forEach(widget => {
          const nameEl = widget.querySelector('[class*="-name"]');
          const nameMatch = !q || (nameEl?.textContent || '').toLowerCase().includes(q);
          let groupMatch = true;
          if (g) {
            const wt = widget.dataset.apexType;
            const wgs = wt?.startsWith('cw_') ? ['Custom'] : typeToGroups.get(wt);
            groupMatch = g === 'Uncategorized' ? (!wt || !wgs) : (wgs || []).includes(g);
          }
          widget.style.display = (nameMatch && groupMatch) ? '' : 'none';
        });
      };

      searchInput.addEventListener('input', filterWidgets);
      typeSelect.addEventListener('change', () => { filterWidgets(); unusedSection.scrollLeft = 0; });
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        filterWidgets();
        searchInput.focus();
      });

      // Async: fetch config, stamp data-apex-type on each widget, populate dropdown
      (async () => {
        try {
          const r = await fetch(`${CONFIG_URL}?_=${Date.now()}`, { cache: 'no-store' });
          const json = await r.json();
          const nameTypeMap = new Map();
          for (const item of [...(json.oconf || []), ...(json.iconf || [])]) {
            if (item.name && item.type) nameTypeMap.set(item.name, item.type);
          }
          const types = new Set();
          unusedSection?.querySelectorAll('.dash-widget').forEach(widget => {
            const name = widget.querySelector('[class*="-name"]')?.textContent?.trim();
            const type = name ? nameTypeMap.get(name) : undefined;
            const idPrefix = widget.id.includes(':') ? widget.id.split(':')[0] : null;
            if (idPrefix) { widget.dataset.apexType = idPrefix; types.add(idPrefix); }
            else if (type) { widget.dataset.apexType = type; types.add(type); }
            else if (widget.dataset.apexType) types.add(widget.dataset.apexType);
            else types.add('__uncategorized__');
            if (widget.id.includes(':')) console.log('[apex-dbg widget]', {
              id: widget.id,
              classes: [...widget.classList].join(' '),
              name,
              configType: type,
              stampedType: widget.dataset.apexType,
              firstChildClasses: widget.firstElementChild ? [...widget.firstElementChild.classList].join(' ') : null,
            });
          });
          const presentGroups = new Set([...types].flatMap(t => t === '__uncategorized__' ? ['Uncategorized'] : t?.startsWith('cw_') ? ['Custom'] : (typeToGroups.get(t) || ['Uncategorized'])));
          typeSelect.innerHTML = '<option value="">All</option>';
          [...Object.keys(WIDGET_GROUPS).sort((a, b) => a.localeCompare(b)), 'Uncategorized']
            .filter(g => presentGroups.has(g))
            .forEach(g => {
              const opt = document.createElement('option');
              opt.value = g;
              opt.textContent = g;
              typeSelect.appendChild(opt);
            });
          typeSelect.disabled = false;
          if (activeFolder !== 'default') ensureDividerInTypeSelect();
        } catch (_) {}
      })();
    }

    // Remove any stale explore item from help dropdown (legacy location)
    document.querySelector('.apex-explore-item')?.remove();

    const dashLock = document.getElementById('dash-lock');
    if (!folderDropdownInjected) {
      const stale = document.getElementById('apex-folder-dropdown');
      if (stale) stale.remove();
    }
    if (dashLock && !document.getElementById('apex-folder-dropdown')) {
      folderDropdownInjected = true;
      const group = document.createElement('div');
      group.id = 'apex-folder-dropdown';
      group.className = 'btn-group';
      group.innerHTML =
        '<button class="btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Dashboards">' +
          '<i class="af af-fw af-folder"></i> Default Dashboard' +
        '</button>' +
        '<div class="dropdown-menu dropdown-menu-end" id="apex-folders-menu">' +
          '<button type="button" class="dropdown-item apex-folder-item" data-id="default"><i class="af af-fw af-folder-default"></i> Default Dashboard</button>' +
          '<hr class="dropdown-divider" id="apex-folders-divider">' +
          '<button type="button" class="dropdown-item" id="apex-new-folder-btn"><i class="af af-fw af-folder-new"></i> New Dashboard</button>' +
          '<button type="button" class="dropdown-item" id="apex-manage-folders-btn"><i class="af af-fw af-folder-edit"></i> Manage Dashboards</button>' +
        '</div>';
      dashLock.insertAdjacentElement('afterend', group);
      group.querySelector('#apex-new-folder-btn').addEventListener('click', openNewFolderModal);
      group.querySelector('#apex-manage-folders-btn').addEventListener('click', openManageFoldersModal);
      group.querySelector('[data-id="default"]').addEventListener('click', () => switchToFolder('default'));
      // Populate any already-saved folders
      chrome.storage.sync.get({ apexFolders: [] }, ({ apexFolders }) => apexFolders.forEach(addFolderToMenu));
    }

    const folderGroup = document.getElementById('apex-folder-dropdown');
    if (folderGroup && !document.getElementById('apex-explore-btn')) {
      const exploreBtn = document.createElement('button');
      exploreBtn.id        = 'apex-explore-btn';
      exploreBtn.type      = 'button';
      exploreBtn.title     = 'Explore';
      exploreBtn.className = 'btn btn-secondary';
      exploreBtn.innerHTML = '<i class="af af-fw" style="font-style:normal">&#xF121;</i>';
      exploreBtn.addEventListener('click', () => exploreOpen ? closeExplorePanel() : openExplorePanel());
      folderGroup.insertAdjacentElement('beforebegin', exploreBtn);
      const exploreDivider = document.createElement('div');
      exploreDivider.style.cssText = 'width:1px;background:rgba(71,73,73,0.5);margin:4px 2px;align-self:stretch;';
      exploreBtn.insertAdjacentElement('beforebegin', exploreDivider);
    }

    // Re-apply last active dashboard once widgets are in the DOM
    if (!lastFolderApplied && document.querySelector('#dash-section-1 > .dash-widget')) {
      lastFolderApplied = true;
      chrome.storage.local.get({ lastActiveDashboard: 'default' }, ({ lastActiveDashboard }) => {
        if (lastActiveDashboard !== 'default') switchToFolder(lastActiveDashboard);
      });
    }
  }

  // ── Folders helpers ────────────────────────────────────────────────────────

  function addFolderToMenu(folder) {
    const menu = document.getElementById('apex-folders-menu');
    const divider = document.getElementById('apex-folders-divider');
    if (!menu || !divider) return;
    if (menu.querySelector(`[data-id="${folder.id}"]`)) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dropdown-item apex-folder-item';
    btn.dataset.id = folder.id;
    const icon = document.createElement('i');
    icon.className = `af af-fw apex-gp-${folder.glyph.toLowerCase()}`;
    btn.appendChild(icon);
    btn.appendChild(document.createTextNode(' ' + folder.name));
    btn.addEventListener('click', () => switchToFolder(folder.id));
    divider.insertAdjacentElement('beforebegin', btn);
  }

  function rebuildDropdownOrder(folders) {
    const menu = document.getElementById('apex-folders-menu');
    const divider = document.getElementById('apex-folders-divider');
    if (!menu || !divider) return;
    menu.querySelectorAll('.apex-folder-item:not([data-id="default"])').forEach(el => el.remove());
    folders.forEach(folder => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dropdown-item apex-folder-item';
      btn.dataset.id = folder.id;
      const icon = document.createElement('i');
      icon.className = `af af-fw apex-gp-${folder.glyph.toLowerCase()}`;
      btn.appendChild(icon);
      btn.appendChild(document.createTextNode(' ' + folder.name));
      divider.insertAdjacentElement('beforebegin', btn);
    });
  }

  // ── Custom divider widget ──────────────────────────────────────────────────

  function createDividerElement(id, text) {
    const el = document.createElement('div');
    el.className = 'dash-widget';
    el.style.marginBottom = '4px';
    el.id = id;
    el.dataset.apexWidget = 'divider';
    el.dataset.apexType   = 'divider';
    el.innerHTML =
      '<span class="dash-widget-name" style="display:none">Divider</span>' +
      '<div class="card" style="margin:0 12px 0 4px"><h6 class="card-header text-center" style="cursor:default;border-bottom:none">' +
        (text || 'Divider') +
      '</h6></div>' +
      (id !== 'apex_div_template' ? '<div class="sortable-remove"></div>' : '');
    if (id !== 'apex_div_template') {
      const xBtn = el.querySelector('.sortable-remove');
      xBtn.style.visibility = document.getElementById('dash')?.classList.contains('unlocked') ? 'visible' : 'hidden';
      xBtn.addEventListener('click', () => {
        delete liveDividers[el.id];
        chrome.storage.sync.set({ apexDividers: liveDividers });
        el.remove();
      });

      el.querySelector('h6').addEventListener('dblclick', () => {
        const h6 = el.querySelector('h6');
        const prev = h6.textContent;
        h6.contentEditable = 'true';
        h6.focus();
        document.execCommand('selectAll');
        const commit = () => {
          h6.contentEditable = 'false';
          const val = h6.textContent.trim() || 'Divider';
          h6.textContent = val;
          liveDividers[el.id] = { text: val };
          chrome.storage.sync.set({ apexDividers: liveDividers });
        };
        h6.addEventListener('blur', commit, { once: true });
        h6.addEventListener('keydown', e => {
          if (e.key === 'Enter')  { e.preventDefault(); h6.blur(); }
          if (e.key === 'Escape') { h6.textContent = prev; h6.blur(); }
        });
      });
    }
    return el;
  }

  function ensureDividerInTypeSelect() {}

  function injectDividerTemplate(s0) {
    if (!s0 || s0.querySelector('#apex_div_template')) return;
    s0.appendChild(createDividerElement('apex_div_template', 'Divider'));
    ensureDividerInTypeSelect();
    watchDividerTemplate(s0);
  }

  function promoteDividerTemplate(s0) {
    const placed = document.querySelector('[data-apex-widget="divider"][id="apex_div_template"]');
    console.log('[apex-ext] promoteDividerTemplate — placed:', placed, 'parent:', placed?.parentElement?.id);
    if (!placed || placed.parentElement === s0) return; // still in s0, nothing to do
    const newId = 'apex_div_' + Date.now();
    const text  = placed.querySelector('h6')?.textContent?.trim() || 'Divider';
    placed.id = newId;
    // Add the X button
    const xBtn = document.createElement('div');
    xBtn.className = 'sortable-remove';
    xBtn.style.visibility = document.getElementById('dash')?.classList.contains('unlocked') ? 'visible' : 'hidden';
    xBtn.addEventListener('click', () => {
      delete liveDividers[placed.id];
      chrome.storage.sync.set({ apexDividers: liveDividers });
      placed.remove();
    });
    placed.appendChild(xBtn);
    placed.querySelector('h6').addEventListener('dblclick', () => {
      const h6   = placed.querySelector('h6');
      const prev = h6.textContent;
      h6.contentEditable = 'true';
      h6.style.cursor = 'text';
      h6.focus();
      document.execCommand('selectAll');
      const commit = () => {
        h6.contentEditable = 'false';
        h6.style.cursor = 'default';
        const val = h6.textContent.trim() || 'Divider';
        h6.textContent = val;
        liveDividers[placed.id] = { text: val };
        chrome.storage.sync.set({ apexDividers: liveDividers });
      };
      h6.addEventListener('blur', commit, { once: true });
      h6.addEventListener('keydown', e => {
        if (e.key === 'Enter')  { e.preventDefault(); h6.blur(); }
        if (e.key === 'Escape') { h6.textContent = prev; h6.style.cursor = 'default'; h6.blur(); }
      });
    });
    liveDividers[newId] = { text };
    chrome.storage.sync.set({ apexDividers: liveDividers });
    injectDividerTemplate(s0);
    syncDividerX();
    // Save layout immediately — don't rely solely on the 400ms observer debounce
    clearTimeout(layoutSaveTimer);
    layoutSaveTimer = setTimeout(saveFolderLayoutNow, 0);
  }

  function watchDividerTemplate(s0) {
    if (dividerTemplateObserver) dividerTemplateObserver.disconnect();
    dividerTemplateObserver = new MutationObserver(() => {
      // Placed instance landed back in s0 via X button — remove it
      s0.querySelectorAll('[data-apex-widget="divider"]:not(#apex_div_template)').forEach(el => {
        delete liveDividers[el.id];
        chrome.storage.sync.set({ apexDividers: liveDividers });
        el.remove();
      });
    });
    // Watch the entire dash container so we catch the template arriving in any column
    const dashContainer = document.getElementById('dash');
    if (dashContainer) {
      dividerTemplateObserver.observe(dashContainer, { childList: true, subtree: true });
      // Keep X visibility in sync with unlocked class
      if (dividerUnlockObserver) dividerUnlockObserver.disconnect();
      dividerUnlockObserver = new MutationObserver(syncDividerX);
      dividerUnlockObserver.observe(dashContainer, { attributes: true, attributeFilter: ['class'] });
    }
    // Promote after drag ends — use bubbling so sortable has already committed placement
    if (dividerPointerUpHandler) document.removeEventListener('pointerup', dividerPointerUpHandler, false);
    dividerPointerUpHandler = () => setTimeout(() => promoteDividerTemplate(s0), 50);
    document.addEventListener('pointerup', dividerPointerUpHandler, false);
  }

  function cleanupDividers() {
    if (dividerTemplateObserver) { dividerTemplateObserver.disconnect(); dividerTemplateObserver = null; }
    if (dividerUnlockObserver)   { dividerUnlockObserver.disconnect();   dividerUnlockObserver   = null; }
    if (dividerPointerUpHandler) { document.removeEventListener('pointerup', dividerPointerUpHandler, false); dividerPointerUpHandler = null; }
    document.querySelectorAll('[data-apex-widget="divider"]').forEach(el => el.remove());
  }

  function getFolderSections() {
    return {
      s0: document.getElementById('dash-section-0'),
      s1: document.getElementById('dash-section-1'),
      s2: document.getElementById('dash-section-2'),
      s3: document.getElementById('dash-section-3'),
    };
  }

  function updateFolderToggleLabel(folder) {
    const toggle = document.querySelector('#apex-folder-dropdown .dropdown-toggle');
    if (!toggle) return;
    if (!folder) {
      toggle.innerHTML = '<i class="af af-fw af-folder"></i> Default Dashboard';
    } else {
      toggle.innerHTML = `<i class="af af-fw apex-gp-${folder.glyph.toLowerCase()}"></i> ${folder.name}`;
    }
  }

  function collectWidgets() {
    const { s0, s1, s2, s3 } = getFolderSections();
    const all = {};
    [s0, s1, s2, s3].forEach(sec => {
      if (sec) sec.querySelectorAll('.dash-widget').forEach(w => { if (w.id) all[w.id] = w; });
    });
    return all;
  }

  function detachAllWidgets(all) {
    // Move every widget into a fragment — detaches from DOM without destroying nodes
    const frag = document.createDocumentFragment();
    Object.values(all).forEach(w => frag.appendChild(w));
    return frag;
  }

  function saveFolderLayoutNow() {
    if (activeFolder === 'default') return;
    const folderId = activeFolder; // capture before async — folder may change by the time get() returns
    const { s1, s2, s3 } = getFolderSections();
    const toCSV = sec => [...(sec ? sec.querySelectorAll('.dash-widget') : [])].map(w => w.id).filter(id => id && id !== 'apex_div_template').join(',');
    const sections = [toCSV(s1), toCSV(s2), toCSV(s3), ''];
    chrome.storage.sync.get({ apexSections: {} }, ({ apexSections }) => {
      apexSections[folderId] = sections;
      chrome.storage.sync.set({ apexSections });
    });
  }

  function startWatchingLayout() {
    if (layoutObserver) layoutObserver.disconnect();
    layoutObserver = new MutationObserver(() => {
      clearTimeout(layoutSaveTimer);
      layoutSaveTimer = setTimeout(saveFolderLayoutNow, 400);
    });
    ['dash-section-1', 'dash-section-2', 'dash-section-3'].forEach(id => {
      const sec = document.getElementById(id);
      if (sec) layoutObserver.observe(sec, { childList: true });
    });
  }

  function stopWatchingLayout() {
    clearTimeout(layoutSaveTimer);
    if (layoutObserver) { layoutObserver.disconnect(); layoutObserver = null; }
  }

  function applyFolderLayout(folder, sections, dividers = {}) {
    const { s0, s1, s2, s3 } = getFolderSections();
    if (!s1 || !s2 || !s3) return;

    // Snapshot actual DOM node references — restored directly, no GID lookup that can miss
    if (!layoutSnapshot) {
      const toNodes = sec => [...(sec ? sec.querySelectorAll(':scope > .dash-widget') : [])];
      layoutSnapshot = { s1: toNodes(s1), s2: toNodes(s2), s3: toNodes(s3), s0: toNodes(s0) };
    }

    // Create divider DOM nodes for any instances in this folder's saved sections
    const savedIds = sections.flatMap(csv => (csv || '').split(',').filter(Boolean));
    savedIds.filter(id => id.startsWith('apex_div_') && !document.getElementById(id))
      .forEach(id => s0?.appendChild(createDividerElement(id, dividers[id]?.text || 'Divider')));

    const all = collectWidgets();
    const frag = detachAllWidgets(all);

    const col1 = (sections[0] || '').split(',').filter(Boolean);
    const col2 = (sections[1] || '').split(',').filter(Boolean);
    const col3 = (sections[2] || '').split(',').filter(Boolean);

    col1.forEach(gid => { if (all[gid]) s1.appendChild(all[gid]); });
    col2.forEach(gid => { if (all[gid]) s2.appendChild(all[gid]); });
    col3.forEach(gid => { if (all[gid]) s3.appendChild(all[gid]); });

    if (s0) while (frag.firstChild) s0.appendChild(frag.firstChild);

    const unusedContainer = document.getElementById('dash-widget-unused');

    document.documentElement.setAttribute('data-apex-folder-mode', 'true');
    activeFolder = folder.id;
    chrome.storage.local.set({ lastActiveDashboard: folder.id });
    updateFolderToggleLabel(folder);
    startWatchingLayout();
    injectDividerTemplate(s0);
    syncDividerX();

    // If all columns are empty, open the unused drawer as a hint
    if (!col1.length && !col2.length && !col3.length) {
      requestAnimationFrame(() => {
        const icon = document.getElementById('dash-covers-icon');
        if (icon && icon.classList.contains('af-rotate-180')) {
          document.getElementById('dash-lock')?.click();
        }
      });
    }
  }

  function switchToDefault({ domRestore = true } = {}) {
    stopWatchingLayout();

    const snap = layoutSnapshot;
    layoutSnapshot = null;
    activeFolder = 'default';
    if (domRestore) {
      updateFolderToggleLabel(null);
      chrome.storage.local.set({ lastActiveDashboard: 'default' });
    }

    if (!snap) {
      document.documentElement.removeAttribute('data-apex-folder-mode');
      return;
    }

    cleanupDividers();

    if (domRestore) {
      const { s0, s1, s2, s3 } = getFolderSections();

      // Move nodes directly back — no GID lookup, preserves original order exactly
      snap.s1.forEach(n => s1?.appendChild(n));
      snap.s2.forEach(n => s2?.appendChild(n));
      snap.s3.forEach(n => s3?.appendChild(n));
      snap.s0.forEach(n => s0?.appendChild(n));
    }

    document.documentElement.removeAttribute('data-apex-folder-mode');
  }

  // ── Storage sanitizers ─────────────────────────────────────────────────────
  // Called on every read from storage and on import. Strip/fix garbage silently
  // rather than crashing or rendering a broken dashboard.

  function sanitizeFolders(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(f => f && typeof f.id === 'string' && f.id && typeof f.name === 'string')
      .map(f => ({ id: f.id, name: f.name, glyph: typeof f.glyph === 'string' ? f.glyph : 'F660' }));
  }

  // Known custom widget prefixes. Anything starting with apex_ that isn't in
  // this list is stripped — handles future versions that drop a widget type.
  const KNOWN_APEX_PREFIXES = ['apex_div_'];

  function sanitizeSections(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out = {};
    for (const [folderId, val] of Object.entries(raw)) {
      if (typeof folderId !== 'string' || !folderId) continue;
      const arr = Array.isArray(val) ? val : ['', '', '', ''];
      out[folderId] = Array.from({ length: 4 }, (_, i) => {
        const csv = typeof arr[i] === 'string' ? arr[i] : '';
        return csv.split(',')
          .map(g => g.trim())
          .filter(g => {
            if (!g || g === 'apex_div_template') return false;
            if (g.startsWith('apex_')) return KNOWN_APEX_PREFIXES.some(p => g.startsWith(p));
            return /^[\w:.]+$/.test(g); // native GID — reject garbage
          })
          .join(',');
      });
    }
    return out;
  }

  function nextAvailableName(baseName, existingNamesSet) {
    let n = 2;
    while (existingNamesSet.has(`${baseName}(${n})`.toLowerCase())) n++;
    return `${baseName}(${n})`;
  }

  function analyzeImportFolder(folder, importedSections, parsedCustomElements, currentFolders) {
    const currentById   = new Map(currentFolders.map(f => [f.id, f]));
    const currentByName = new Map(currentFolders.map(f => [f.name.toLowerCase(), f]));
    const existingById   = currentById.get(folder.id);
    const existingByName = currentByName.get(folder.name.toLowerCase());
    const sections = importedSections[folder.id] || ['', '', '', ''];

    // Unknown GIDs on this system (only checkable when on dashboard)
    const liveWidgets = collectWidgets();
    let unknownGids = 0;
    if (Object.keys(liveWidgets).length) {
      sections.forEach(csv => {
        if (!csv) return;
        csv.split(',').forEach(g => {
          g = g.trim();
          if (!g || g.startsWith('apex_')) return;
          if (!liveWidgets[g]) unknownGids++;
        });
      });
    }

    // Unsupported custom widget types referenced by this folder
    const knownCwTypes = new Set(['cw_divider']);
    const folderGids = new Set(sections.flatMap(csv => csv ? csv.split(',').map(g => g.trim()).filter(Boolean) : []));
    let skippedCw = 0;
    for (const [id, val] of Object.entries(parsedCustomElements || {})) {
      if (folderGids.has(id) && val?.type && !knownCwTypes.has(val.type)) skippedCw++;
    }

    const warnings = [];
    if (unknownGids > 0) warnings.push(`${unknownGids} unknown widget${unknownGids !== 1 ? 's' : ''} will be skipped`);
    if (skippedCw > 0)   warnings.push(`${skippedCw} custom widget type${skippedCw !== 1 ? 's' : ''} are no longer supported and will be skipped`);

    // Red: name collision with a different folder ID — requires explicit decision
    if (existingByName && existingByName.id !== folder.id) {
      const allNames = new Set(currentFolders.map(f => f.name.toLowerCase()));
      const suggestedName = nextAvailableName(folder.name, allNames);
      return {
        folder, status: 'red',
        message: `A dashboard named "${esc(folder.name)}" already exists`,
        warnings,
        options: [
          { value: 'overwrite', label: 'Import & overwrite existing' },
          { value: 'rename',    label: `Import as "${esc(suggestedName)}"` },
          { value: 'skip',      label: 'Do not import' },
        ],
        selected: null,
        suggestedName,
      };
    }

    // Green note for known same-ID cases
    let greenNote = '';
    if (existingById && existingById.name.toLowerCase() !== folder.name.toLowerCase()) {
      greenNote = `Will rename existing dashboard from "${esc(existingById.name)}" to "${esc(folder.name)}"`;
    }

    const status = warnings.length ? 'yellow' : 'green';
    const allMessages = [...warnings, ...(greenNote ? [greenNote] : [])];

    return {
      folder, status,
      message: allMessages.join(' · '),
      warnings,
      options: [
        { value: 'import', label: warnings.length ? 'Import & skip invalid' : 'Import' },
        { value: 'skip',   label: 'Do not import' },
      ],
      selected: 'import',
      suggestedName: null,
    };
  }

  function showImportReview(modal, analyses, importedSections, importedDividers, currentFolders, currentSections) {
    const ICON = { green: 'f058', yellow: 'f06a', red: 'f057' };
    const COLOR = { green: '#28a745', yellow: '#d97706', red: '#dc3545' };

    const body = modal.querySelector('.modal-body');
    const footer = modal.querySelector('#apex-manage-folders-footer');
    const hr     = modal.querySelector('#apex-manage-folders-hr');
    const savedHTML = body.innerHTML;
    const restore = () => {
      body.innerHTML = savedHTML;
      if (footer) footer.style.display = '';
      if (hr)     hr.style.display = '';
    };

    if (footer) footer.style.display = 'none';
    if (hr)     hr.style.display = 'none';

    const ORDER = { red: 0, yellow: 1, green: 2 };
    const sorted = [...analyses].sort((a, b) => ORDER[a.status] - ORDER[b.status]);

    body.innerHTML =
      `<p style="margin:0 0 8px;font-size:13px;color:#555">Review the dashboards found in your backup:</p>` +
      `<div style="display:flex;flex-direction:column;gap:4px">` +
      sorted.map((a, i) =>
        `<div style="background:#f8f8f8;border:1px solid #e0e0e0;border-radius:5px;padding:8px 10px">` +
          `<div style="display:flex;align-items:center;gap:8px">` +
            `<i class="af apex-gp-${ICON[a.status]}" style="color:${COLOR[a.status]};font-size:16px;flex-shrink:0"></i>` +
            `<span style="font-weight:600;font-size:13px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.folder.name)}</span>` +
            `<select class="apex-import-action form-select form-select-sm" data-idx="${i}" style="width:auto;flex-shrink:0">` +
              (a.selected === null ? `<option value="" selected disabled>Choose an action…</option>` : '') +
              a.options.map(o => `<option value="${o.value}"${a.selected === o.value ? ' selected' : ''}>${o.label}</option>`).join('') +
            `</select>` +
          `</div>` +
          (a.message ? `<div style="margin:4px 0 0 24px;font-size:12px;color:#666">${a.message}</div>` : '') +
        `</div>`
      ).join('') +
      `</div>` +
      `<hr style="margin:10px -16px 0">` +
      `<div style="display:flex;gap:8px;justify-content:flex-end;margin:0 -16px -16px;padding:10px 16px">` +
        `<button class="btn btn-sm btn-secondary" id="apex-import-review-cancel">Cancel</button>` +
        `<button class="btn btn-sm" id="apex-import-review-confirm" style="background:#e07820;border-color:#e07820;color:#fff"><i class="af apex-gp-f56d" style="margin-right:5px"></i>Confirm Import</button>` +
      `</div>`;

    const confirmBtn = body.querySelector('#apex-import-review-confirm');

    const updateConfirm = () => {
      confirmBtn.disabled = sorted.some(a => a.selected === null);
    };
    updateConfirm();

    body.querySelectorAll('.apex-import-action').forEach(sel => {
      sel.addEventListener('change', () => {
        sorted[+sel.dataset.idx].selected = sel.value || null;
        updateConfirm();
      });
    });

    body.querySelector('#apex-import-review-cancel').addEventListener('click', () => {
      restore();
    });

    confirmBtn.addEventListener('click', () => {
      restore();

      // Build final folder + section lists by merging decisions on top of current state
      const finalFolders  = [...currentFolders];
      const finalSections = { ...currentSections };

      sorted.forEach(({ folder, selected, suggestedName }) => {
        if (selected === 'skip') return;
        const sections = importedSections[folder.id] || ['', '', '', ''];

        if (selected === 'overwrite') {
          const idx = finalFolders.findIndex(f => f.name.toLowerCase() === folder.name.toLowerCase());
          if (idx !== -1) { delete finalSections[finalFolders[idx].id]; finalFolders[idx] = folder; }
          else finalFolders.push(folder);
          finalSections[folder.id] = sections;
        } else if (selected === 'rename') {
          const named = { ...folder, name: suggestedName };
          const idx = finalFolders.findIndex(f => f.id === folder.id);
          if (idx !== -1) finalFolders[idx] = named; else finalFolders.push(named);
          finalSections[folder.id] = sections;
        } else {
          // 'import' — upsert by ID
          const idx = finalFolders.findIndex(f => f.id === folder.id);
          if (idx !== -1) finalFolders[idx] = folder; else finalFolders.push(folder);
          finalSections[folder.id] = sections;
        }
      });

      // Merge dividers for imported folders only
      const importedGids = new Set(
        sorted
          .filter(a => a.selected !== 'skip')
          .flatMap(a => (importedSections[a.folder.id] || []).flatMap(csv => csv ? csv.split(',').map(g => g.trim()).filter(Boolean) : []))
      );
      const finalDividers = { ...liveDividers };
      for (const [id, val] of Object.entries(importedDividers)) {
        if (importedGids.has(id)) finalDividers[id] = val;
      }

      chrome.storage.sync.set({ apexFolders: finalFolders, apexSections: finalSections, apexDividers: finalDividers }, () => {
        liveDividers = finalDividers;
        rebuildDropdownOrder(finalFolders);
        renderManageList(finalFolders);
      });
    });
  }

  function sanitizeDividers(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out = {};
    for (const [id, val] of Object.entries(raw)) {
      if (typeof id !== 'string' || !id.startsWith('apex_div_')) continue;
      out[id] = { text: typeof val?.text === 'string' && val.text ? val.text : 'Divider' };
    }
    return out;
  }

  function switchToFolder(folderId) {
    if (folderId === 'default') { switchToDefault(); return; }
    chrome.storage.sync.get({ apexFolders: [], apexSections: {}, apexDividers: {} }, (raw) => {
      const apexFolders  = sanitizeFolders(raw.apexFolders);
      const apexSections = sanitizeSections(raw.apexSections);
      const apexDividers = sanitizeDividers(raw.apexDividers);
      liveDividers = { ...apexDividers };
      const folder = apexFolders.find(f => f.id === folderId);
      if (folder) applyFolderLayout(folder, apexSections[folderId] || ['', '', '', ''], apexDividers);
    });
  }

  function updateFolderInStorage(id, patch, callback) {
    chrome.storage.sync.get({ apexFolders: [] }, ({ apexFolders }) => {
      const updated = apexFolders.map(f => f.id === id ? { ...f, ...patch } : f);
      chrome.storage.sync.set({ apexFolders: updated }, () => callback && callback(updated));
    });
  }

  function showGlyphPopover(anchorEl, currentGlyph, onSelect) {
    const existing = document.getElementById('apex-glyph-popover');
    if (existing) { existing.remove(); return; }

    const pop = document.createElement('div');
    pop.id = 'apex-glyph-popover';
    FOLDER_GLYPHS.forEach(g => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'apex-glyph-btn' + (g === currentGlyph ? ' selected' : '');
      btn.title = g;
      const icon = document.createElement('i');
      icon.className = `af af-fw apex-gp-${g.toLowerCase()}`;
      btn.appendChild(icon);
      btn.addEventListener('click', e => { e.stopPropagation(); onSelect(g); pop.remove(); });
      pop.appendChild(btn);
    });
    document.body.appendChild(pop);

    const rect = anchorEl.getBoundingClientRect();
    pop.style.top  = (rect.bottom + 4) + 'px';
    pop.style.left = rect.left + 'px';
    const pr = pop.getBoundingClientRect();
    if (pr.right > window.innerWidth - 8) pop.style.left = (window.innerWidth - 8 - pr.width) + 'px';
    if (pr.bottom > window.innerHeight - 8) pop.style.top = (rect.top - pr.height - 4) + 'px';

    const dismiss = e => {
      if (!pop.contains(e.target) && e.target !== anchorEl) {
        pop.remove();
        document.removeEventListener('click', dismiss, true);
      }
    };
    setTimeout(() => document.addEventListener('click', dismiss, true), 0);
  }

  function renderManageList(folders) {
    const list = document.getElementById('apex-manage-folder-list');
    if (!list) return;
    list.innerHTML = '';
    if (!folders.length) {
      list.innerHTML = '<p style="color:#999;text-align:center;padding:20px 0;margin:0;">No custom folders yet.</p>';
      return;
    }
    let dragSrc = null;
    folders.forEach(folder => {
      const row = document.createElement('div');
      row.className = 'apex-manage-row';
      row.draggable = true;
      row.dataset.id = folder.id;

      const handle = document.createElement('i');
      handle.className = 'af af-fw apex-gp-f0dc apex-manage-handle';

      const icon = document.createElement('i');
      icon.className = `af af-fw apex-gp-${folder.glyph.toLowerCase()} apex-manage-icon`;
      icon.addEventListener('click', e => {
        e.stopPropagation();
        showGlyphPopover(icon, folder.glyph, newGlyph => {
          folder.glyph = newGlyph;
          icon.className = `af af-fw apex-gp-${newGlyph.toLowerCase()} apex-manage-icon`;
          updateFolderInStorage(folder.id, { glyph: newGlyph }, () => {
            const menuIcon = document.querySelector(`#apex-folders-menu [data-id="${folder.id}"] i`);
            if (menuIcon) menuIcon.className = `af af-fw apex-gp-${newGlyph.toLowerCase()}`;
          });
        });
      });

      const name = document.createElement('span');
      name.className = 'apex-manage-name';
      name.textContent = folder.name;
      name.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'apex-manage-name-input';
        input.value = folder.name;
        name.replaceWith(input);
        input.focus();
        input.select();
        const save = () => {
          const newName = input.value.trim() || folder.name;
          folder.name = newName;
          name.textContent = newName;
          input.replaceWith(name);
          updateFolderInStorage(folder.id, { name: newName }, () => {
            const menuBtn = document.querySelector(`#apex-folders-menu [data-id="${folder.id}"]`);
            if (menuBtn) {
              const t = [...menuBtn.childNodes].find(n => n.nodeType === 3);
              if (t) t.textContent = ' ' + newName;
            }
          });
        };
        input.addEventListener('blur', save);
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
          if (e.key === 'Escape') { input.value = folder.name; input.blur(); }
        });
      });

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'apex-manage-delete';
      del.title = 'Delete';
      const delIcon = document.createElement('i');
      delIcon.className = 'af af-fw apex-gp-f057';
      del.appendChild(delIcon);
      del.addEventListener('click', () => {
        chrome.storage.sync.get({ apexFolders: [], apexSections: {} }, ({ apexFolders, apexSections }) => {
          const updated = apexFolders.filter(f => f.id !== folder.id);
          delete apexSections[folder.id];
          chrome.storage.sync.set({ apexFolders: updated, apexSections }, () => {
            const menuBtn = document.querySelector(`#apex-folders-menu [data-id="${folder.id}"]`);
            if (menuBtn) menuBtn.remove();
            renderManageList(updated);
            if (activeFolder === folder.id) switchToDefault();
          });
        });
      });

      row.append(handle, icon, name, del);

      row.addEventListener('dragstart', e => {
        dragSrc = row;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => row.classList.add('dragging'), 0);
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        list.querySelectorAll('.apex-manage-row').forEach(r => r.classList.remove('drag-over'));
      });
      row.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (row !== dragSrc) {
          list.querySelectorAll('.apex-manage-row').forEach(r => r.classList.remove('drag-over'));
          row.classList.add('drag-over');
        }
      });
      row.addEventListener('drop', e => {
        e.preventDefault();
        if (!dragSrc || dragSrc === row) return;
        const rows = [...list.querySelectorAll('.apex-manage-row')];
        const srcIdx = rows.indexOf(dragSrc);
        const dstIdx = rows.indexOf(row);
        if (srcIdx < dstIdx) row.insertAdjacentElement('afterend', dragSrc);
        else row.insertAdjacentElement('beforebegin', dragSrc);
        list.querySelectorAll('.apex-manage-row').forEach(r => r.classList.remove('drag-over'));
        const newOrder = [...list.querySelectorAll('.apex-manage-row')].map(r => r.dataset.id);
        chrome.storage.sync.get({ apexFolders: [] }, ({ apexFolders }) => {
          const reordered = newOrder.map(id => apexFolders.find(f => f.id === id)).filter(Boolean);
          chrome.storage.sync.set({ apexFolders: reordered }, () => rebuildDropdownOrder(reordered));
        });
      });

      list.appendChild(row);
    });
  }

  function openManageFoldersModal() {
    const closeManage = () => {
      const el = document.getElementById('apex-manage-folders-modal');
      if (el) { el.classList.remove('show'); el.style.display = 'none'; }
      document.getElementById('apex-modal-backdrop')?.remove();
      document.body.classList.remove('modal-open');
    };

    if (!document.getElementById('apex-manage-folders-modal')) {
      const el = document.createElement('div');
      el.id = 'apex-manage-folders-modal';
      el.className = 'modal fade';
      el.tabIndex = -1;
      el.setAttribute('role', 'dialog');
      el.innerHTML =
        '<div class="modal-dialog modal-dialog-centered" style="max-width:640px">' +
          '<div class="modal-content">' +
            '<div class="modal-header">' +
              '<h5 class="modal-title">Manage Dashboards</h5>' +
              '<button type="button" class="btn-close" id="apex-manage-close-btn"></button>' +
            '</div>' +
            '<div class="modal-body">' +
              '<div id="apex-manage-folder-list"></div>' +
            '</div>' +
            '<hr id="apex-manage-folders-hr" style="margin:0">' +
            '<div id="apex-manage-folders-footer">' +
              '<button type="button" id="apex-folders-export-link">Backup dashboard customizations</button>' +
              '<button type="button" id="apex-folders-import-btn-styled"><i class="af af-fw apex-gp-f150"></i> Import</button>' +
              '<input type="file" id="apex-folders-import-input" accept=".json" style="display:none">' +
            '</div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(el);
      el.addEventListener('click', e => { if (e.target === el) closeManage(); });
      el.querySelector('#apex-manage-close-btn').addEventListener('click', closeManage);

      el.querySelector('#apex-folders-export-link').addEventListener('click', () => {
        chrome.storage.sync.get({ apexFolders: [], apexSections: {}, apexDividers: {} }, ({ apexFolders, apexSections, apexDividers }) => {
          // Collect all GIDs referenced in sections so we only export dividers that are actually placed
          const referencedGids = new Set(
            Object.values(apexSections).flatMap(cols => cols.flatMap(csv => csv ? csv.split(',') : []))
          );
          const customElements = {};
          for (const [id, val] of Object.entries(apexDividers || {})) {
            if (typeof id === 'string' && id.startsWith('apex_div_') && referencedGids.has(id))
              customElements[id] = { type: 'cw_divider', text: val?.text || 'Divider' };
          }
          const now = new Date();
          const pad = n => String(n).padStart(2, '0');
          const name = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.json`;
          const blob = new Blob([JSON.stringify({ apexFolders, apexSections, customElements }, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = name;
          a.click();
          URL.revokeObjectURL(a.href);
        });
      });

      const importInput = el.querySelector('#apex-folders-import-input');
      el.querySelector('#apex-folders-import-btn-styled').addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', () => {
        const file = importInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
          try {
            const parsed = JSON.parse(e.target.result);
            const importedFolders  = sanitizeFolders(parsed.apexFolders);
            const importedSections = sanitizeSections(parsed.apexSections);
            if (!importedFolders.length) throw new Error('empty or unrecognized import');

            // Parse custom elements — dividers get restored, unknown types are quietly dropped
            const importedDividers = {};
            for (const [id, val] of Object.entries(parsed.customElements || {})) {
              if (val?.type === 'cw_divider')
                importedDividers[id] = { text: typeof val.text === 'string' && val.text ? val.text : 'Divider' };
            }

            chrome.storage.sync.get({ apexFolders: [], apexSections: {}, apexDividers: {} }, (current) => {
              const currentFolders  = sanitizeFolders(current.apexFolders);
              const currentSections = sanitizeSections(current.apexSections);

              const analyses = importedFolders.map(f =>
                analyzeImportFolder(f, importedSections, parsed.customElements, currentFolders)
              );

              const hasIssues = analyses.some(a => a.status !== 'green' || a.selected === null);
              if (!hasIssues) {
                // All clean — silent import, merge on top of current state
                const finalFolders  = [...currentFolders];
                const finalSections = { ...currentSections };
                importedFolders.forEach(folder => {
                  const idx = finalFolders.findIndex(f => f.id === folder.id);
                  if (idx !== -1) finalFolders[idx] = folder; else finalFolders.push(folder);
                  finalSections[folder.id] = importedSections[folder.id] || ['', '', '', ''];
                });
                const finalDividers = { ...liveDividers, ...importedDividers };
                chrome.storage.sync.set({ apexFolders: finalFolders, apexSections: finalSections, apexDividers: finalDividers }, () => {
                  liveDividers = finalDividers;
                  rebuildDropdownOrder(finalFolders);
                  renderManageList(finalFolders);
                });
                return;
              }

              const modal = document.getElementById('apex-manage-folders-modal');
              showImportReview(modal, analyses, importedSections, importedDividers, currentFolders, currentSections);
            });
          } catch (err) {
            console.error('[apex-debugger] import error:', err);
            alert('Invalid backup file.');
          }
        };
        reader.readAsText(file);
        importInput.value = '';
      });
    }

    chrome.storage.sync.get({ apexFolders: [] }, ({ apexFolders }) => {
      renderManageList(apexFolders);
      const exportLink = document.getElementById('apex-folders-export-link');
      if (exportLink) exportLink.style.display = apexFolders.length ? '' : 'none';
      const el = document.getElementById('apex-manage-folders-modal');
      el.style.display = 'block';
      el.classList.add('show');
      const bd = document.createElement('div');
      bd.id = 'apex-modal-backdrop';
      bd.className = 'modal-backdrop fade show';
      bd.addEventListener('click', closeManage);
      document.body.appendChild(bd);
      document.body.classList.add('modal-open');
    });
  }

  // ── New Folder modal ───────────────────────────────────────────────────────

  function openNewFolderModal() {
    const closeModal = () => {
      const el = document.getElementById('apex-new-folder-modal');
      if (el) { el.classList.remove('show'); el.style.display = 'none'; }
      document.getElementById('apex-modal-backdrop')?.remove();
      document.body.classList.remove('modal-open');
    };

    if (!document.getElementById('apex-new-folder-modal')) {
      const el = document.createElement('div');
      el.id = 'apex-new-folder-modal';
      el.className = 'modal fade';
      el.tabIndex = -1;
      el.setAttribute('role', 'dialog');
      el.innerHTML =
        '<div class="modal-dialog modal-dialog-centered">' +
          '<div class="modal-content">' +
            '<div class="modal-header">' +
              '<h5 class="modal-title">New Dashboard</h5>' +
              '<button type="button" class="btn-close" id="apex-folder-close-btn"></button>' +
            '</div>' +
            '<div class="modal-body">' +
              '<div class="mb-3">' +
                '<label class="form-label" for="apex-folder-name-input">Name</label>' +
                '<input type="text" class="form-control" id="apex-folder-name-input" placeholder="Dashboard name">' +
              '</div>' +
              '<div class="mb-1">' +
                '<label class="form-label">Icon</label>' +
                '<div id="apex-glyph-grid"></div>' +
              '</div>' +
            '</div>' +
            '<div class="modal-footer">' +
              '<button type="button" class="btn btn-secondary" id="apex-folder-cancel-btn">Cancel</button>' +
              '<button type="button" class="btn btn-primary" id="apex-folder-create-btn">Create</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(el);
      el.addEventListener('click', e => { if (e.target === el) closeModal(); });

      el.querySelector('#apex-folder-close-btn').addEventListener('click', closeModal);
      el.querySelector('#apex-folder-cancel-btn').addEventListener('click', closeModal);

      // Populate glyph grid
      const grid = el.querySelector('#apex-glyph-grid');
      let selectedGlyph = 'F660';
      FOLDER_GLYPHS.forEach(g => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'apex-glyph-btn';
        btn.title = g;
        btn.dataset.glyph = g;
        const icon = document.createElement('i');
        icon.className = `af af-fw apex-gp-${g.toLowerCase()}`;
        btn.appendChild(icon);
        btn.addEventListener('click', () => {
          grid.querySelectorAll('.apex-glyph-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          selectedGlyph = g;
        });
        grid.appendChild(btn);
      });

      el.querySelector('#apex-folder-create-btn').addEventListener('click', () => {
        const name = el.querySelector('#apex-folder-name-input').value.trim();
        if (!name) { el.querySelector('#apex-folder-name-input').focus(); return; }
        const folder = { id: 'folder_' + Date.now(), name, glyph: selectedGlyph || 'F660' };
        chrome.storage.sync.get({ apexFolders: [], apexSections: {} }, ({ apexFolders, apexSections }) => {
          apexFolders.push(folder);
          apexSections[folder.id] = ['', '', '', ''];
          chrome.storage.sync.set({ apexFolders, apexSections }, () => {
            addFolderToMenu(folder);
            closeModal();
            applyFolderLayout(folder, apexSections[folder.id], {});
          });
        });
      });
    }

    const modalEl = document.getElementById('apex-new-folder-modal');
    modalEl.querySelector('#apex-folder-name-input').value = '';
    modalEl.querySelectorAll('.apex-glyph-btn').forEach(b => b.classList.remove('selected'));
    modalEl.querySelector('.apex-glyph-btn[data-glyph="F660"]').classList.add('selected');
    modalEl.style.display = 'block';
    modalEl.classList.add('show');
    const bd = document.createElement('div');
    bd.id = 'apex-modal-backdrop';
    bd.className = 'modal-backdrop fade show';
    bd.addEventListener('click', closeModal);
    document.body.appendChild(bd);
    document.body.classList.add('modal-open');
    modalEl.querySelector('#apex-folder-name-input').focus();
  }

  // ── Navigation reset ───────────────────────────────────────────────────────

  function onNavigate() {
    if (enabled)      setEnabled(false);
    if (helpOpen)     closeHelpPanel();
    if (exploreOpen)  closeExplorePanel();
    if (probeOpen)    closeProbePanel();
    const onDash = location.pathname === '/apex/dash';
    if (layoutSnapshot) switchToDefault({ domRestore: onDash });
    if (!onDash) lastFolderApplied = false;
    editorSnapshot = null;
  }

  // ── Debug entry point ──────────────────────────────────────────────────────

  // CSP blocks inline script injection so showCodeDebug() can't be placed on
  // the page window directly. Trigger it via a custom event instead:
  //   document.dispatchEvent(new CustomEvent('apex:showCodeDebug'))

  document.addEventListener('apex:logLineEvaluation', () => {
    debugLogLines = !debugLogLines;
    console.log(`%c[Apex Debugger] Line evaluation logging ${debugLogLines ? 'ON' : 'OFF'}`, 'color:#f90;font-weight:bold');
  });

  document.addEventListener('apex:showCodeDebug', () => {
    if (!/\/apex\/config\//.test(location.pathname)) {
      console.warn('[Apex Debugger] showCodeDebug: only works on /apex/config/ pages');
      return;
    }
    debugMode = true;
    injectDebugPanel();
    console.log('%c[Apex Debugger] Debug mode ON — load files to continue', 'color:#f90;font-weight:bold');
  });

  // ── Init ───────────────────────────────────────────────────────────────────

  chrome.storage.sync.get({ hostname: 'apex.local', beefMode: false, theme: 'default' }, ({ hostname, beefMode: beef, theme }) => {
    beefMode = beef;
    if (window.location.hostname !== hostname) return;

    STATUS_URL = `http://${hostname}/cgi-bin/status.json`;
    CONFIG_URL = `http://${hostname}/rest/config`;

    injectTheme(theme);
    injectStyles();
    initGutterTooltip();

    const observer = new MutationObserver(() => {
      try { injectButton(); injectDashIcons(); }
      catch (_) { observer.disconnect(); }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    injectButton();
    injectDashIcons();
  });
})();
