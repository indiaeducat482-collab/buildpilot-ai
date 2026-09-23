(function () {
  "use strict";

  /* =========================================================
     BUILDPILOT AI
     Complete Frontend
     ========================================================= */

  const CONFIG = window.BUILDPILOT_CONFIG || {};

  const SUPABASE_URL =
    CONFIG.SUPABASE_URL || "";

  const SUPABASE_KEY =
    CONFIG.SUPABASE_PUBLISHABLE_KEY || "";

  const GENERATE_FUNCTION =
  CONFIG.FUNCTION_NAME ||
  "buildpilot-generate";

  const PUBLIC_FUNCTION =
    CONFIG.PUBLIC_FUNCTION_NAME ||
    "public-project";

  const root = document.getElementById("app");

  let activeUser = null;
  let activeSession = null;
  let activeProfile = null;
  let pendingAIImage = null;
  let generatedImages = [];

  let activeProject = null;
  let activeFiles = [];

  let selectedFileId = null;

  /* =========================================================
     BASIC HELPERS
     ========================================================= */

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function showToast(
    message,
    type = "info"
  ) {
    let toast =
      document.getElementById(
        "bpToast"
      );

    if (!toast) {
      toast =
        document.createElement("div");

      toast.id = "bpToast";

      document.body.appendChild(toast);
    }

    toast.className =
      "bp-toast bp-" + type;

    toast.textContent = message;

    clearTimeout(
      toast._timer
    );

    toast._timer =
      setTimeout(() => {
        toast.classList.remove(
          "bp-toast-show"
        );
      }, 3500);

    requestAnimationFrame(() => {
      toast.classList.add(
        "bp-toast-show"
      );
    });
  }

  function setButtonLoading(
    button,
    loading,
    loadingText
  ) {
    if (!button) return;

    if (loading) {
      button.dataset.oldText =
        button.textContent;

      button.disabled = true;

      button.textContent =
        loadingText ||
        "Please wait...";
    } else {
      button.disabled = false;

      button.textContent =
        button.dataset.oldText ||
        button.textContent;
    }
  }

  function currentPublicBase() {
    return (
      window.location.origin +
      window.location.pathname
    );
  }

  function getPublicIdFromUrl() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    return (
      params.get("public") ||
      params.get("publicId") ||
      ""
    ).trim();
  }

  function createPublicLink(
    publicId
  ) {
    return (
      currentPublicBase() +
      "?public=" +
      encodeURIComponent(
        publicId
      )
    );
  }

  async function copyText(text) {
    try {
      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(
          text
        );

        return true;
      }

      const textarea =
        document.createElement(
          "textarea"
        );

      textarea.value = text;

      textarea.style.position =
        "fixed";

      textarea.style.opacity =
        "0";

      document.body.appendChild(
        textarea
      );

      textarea.select();

      document.execCommand(
        "copy"
      );

      textarea.remove();

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  /* =========================================================
     STYLES
     ========================================================= */

  function injectStyles() {
    if (
      document.getElementById(
        "buildpilotStyles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "buildpilotStyles";

    style.textContent = `
      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        min-height: 100%;
      }

      body {
        font-family:
          Inter,
          ui-sans-serif,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;

        background:
          #f8fafc;

        color:
          #0f172a;
      }

      button,
      input,
      textarea,
      select {
        font: inherit;
      }

      button {
        transition:
          transform .15s ease,
          box-shadow .15s ease,
          background .15s ease,
          border-color .15s ease;
      }

      button:not(:disabled):hover {
        transform:
          translateY(-1px);
      }

      button:disabled {
        opacity: .6;
        cursor: not-allowed !important;
      }

      .bp-app {
        min-height: 100vh;
      }

      .bp-topbar {
        height: 70px;
        background:
          rgba(15,23,42,.96);

        color: white;

        display: flex;
        align-items: center;
        justify-content: space-between;

        padding:
          0 24px;

        position: sticky;
        top: 0;
        z-index: 100;
      }

      .bp-brand {
        display: flex;
        align-items: center;
        gap: 11px;
        font-weight: 800;
        letter-spacing: -.3px;
      }

      .bp-logo {
        width: 38px;
        height: 38px;
        border-radius: 11px;

        display: grid;
        place-items: center;

        background:
          linear-gradient(
            135deg,
            #6366f1,
            #06b6d4
          );

        box-shadow:
          0 8px 25px
          rgba(99,102,241,.35);
      }

      .bp-user-area {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .bp-user-email {
        color:
          #cbd5e1;

        font-size:
          13px;
      }

      .bp-main {
        max-width: 1180px;
        margin: auto;
        padding:
          45px 20px 70px;
      }

      .bp-hero {
        text-align: center;
        padding:
          30px 0 35px;
      }

      .bp-hero h1 {
        margin: 0;
        font-size:
          clamp(34px,6vw,58px);

        line-height: 1.05;

        letter-spacing:
          -2.5px;
      }

      .bp-gradient-text {
        background:
          linear-gradient(
            90deg,
            #6366f1,
            #06b6d4
          );

        -webkit-background-clip:
          text;

        background-clip:
          text;

        color:
          transparent;
      }

      .bp-hero p {
        max-width: 680px;
        margin:
          18px auto 0;

        color:
          #64748b;

        font-size:
          17px;

        line-height:
          1.7;
      }

      .bp-builder-grid {
        display: grid;

        grid-template-columns:
          repeat(
            2,
            minmax(0,1fr)
          );

        gap: 20px;
      }

      .bp-card {
        background:
          white;

        border:
          1px solid #e2e8f0;

        border-radius:
          20px;

        padding:
          24px;

        box-shadow:
          0 10px 35px
          rgba(15,23,42,.06);
      }

      .bp-card-hover {
        cursor: pointer;
      }

      .bp-card-hover:hover {
        border-color:
          #818cf8;

        box-shadow:
          0 15px 45px
          rgba(99,102,241,.13);
      }

      .bp-card-icon {
        width: 52px;
        height: 52px;

        border-radius:
          15px;

        display: grid;
        place-items: center;

        font-size:
          25px;

        background:
          #eef2ff;

        margin-bottom:
          15px;
      }

      .bp-card h3 {
        margin:
          0 0 8px;

        font-size:
          19px;
      }

      .bp-card p {
        margin: 0;

        color:
          #64748b;

        line-height:
          1.6;
      }

      .bp-section {
        margin-top:
          45px;
      }

      .bp-section-header {
        display:
          flex;

        align-items:
          center;

        justify-content:
          space-between;

        gap: 15px;

        margin-bottom:
          15px;
      }

      .bp-section-header h2 {
        margin: 0;
      }

      .bp-project {
        background:
          white;

        border:
          1px solid #e2e8f0;

        border-radius:
          17px;

        padding:
          19px;

        margin-bottom:
          12px;

        box-shadow:
          0 5px 20px
          rgba(15,23,42,.04);
      }

      .bp-project-main {
        display:
          flex;

        align-items:
          center;

        justify-content:
          space-between;

        gap:
          20px;
      }

      .bp-project-info {
        min-width:
          0;
      }

      .bp-project-title {
        margin: 0 0 5px;
        font-size: 17px;
      }

      .bp-project-description {
        margin: 0;

        color:
          #64748b;

        font-size:
          14px;

        line-height:
          1.5;
      }

      .bp-actions {
        display:
          flex;

        gap:
          8px;

        flex-wrap:
          wrap;
      }

      .bp-btn {
        border:
          1px solid #e2e8f0;

        background:
          white;

        color:
          #0f172a;

        border-radius:
          10px;

        padding:
          10px 14px;

        cursor:
          pointer;

        font-weight:
          600;
      }

      .bp-btn-primary {
        border-color:
          transparent;

        background:
          #111827;

        color:
          white;

        box-shadow:
          0 6px 18px
          rgba(15,23,42,.15);
      }

      .bp-btn-success {
        border-color:
          transparent;

        background:
          #16a34a;

        color:
          white;
      }

      .bp-btn-danger {
        background:
          #fee2e2;

        border-color:
          #fecaca;

        color:
          #b91c1c;
      }

      .bp-input,
      .bp-textarea,
      .bp-select {
        width:
          100%;

        border:
          1px solid #cbd5e1;

        background:
          white;

        border-radius:
          11px;

        padding:
          12px 13px;

        outline:
          none;
      }

      .bp-input:focus,
      .bp-textarea:focus,
      .bp-select:focus {
        border-color:
          #6366f1;

        box-shadow:
          0 0 0 3px
          rgba(99,102,241,.12);
      }

      .bp-label {
        display:
          block;

        font-size:
          13px;

        font-weight:
          700;

        margin-bottom:
          7px;
      }

      .bp-field {
        margin-bottom:
          18px;
      }

      .bp-two-col {
        display:
          grid;

        grid-template-columns:
          repeat(
            2,
            minmax(0,1fr)
          );

        gap:
          15px;
      }

      .bp-auth-page {
        min-height:
          100vh;

        display:
          flex;

        align-items:
          center;

        justify-content:
          center;

        padding:
          20px;

        background:
          radial-gradient(
            circle at top left,
            #e0e7ff,
            transparent 35%
          ),
          radial-gradient(
            circle at bottom right,
            #cffafe,
            transparent 35%
          ),
          #f8fafc;
      }

      .bp-auth-card {
        width:
          min(440px,100%);

        background:
          white;

        border:
          1px solid #e2e8f0;

        border-radius:
          24px;

        padding:
          30px;

        box-shadow:
          0 25px 80px
          rgba(15,23,42,.12);
      }

      .bp-auth-logo {
        width:
          60px;

        height:
          60px;

        border-radius:
          18px;

        display:
          grid;

        place-items:
          center;

        margin:
          0 auto 15px;

        background:
          linear-gradient(
            135deg,
            #6366f1,
            #06b6d4
          );

        color:
          white;

        font-size:
          27px;
      }

      .bp-auth-title {
        text-align:
          center;

        margin:
          0;
      }

      .bp-auth-subtitle {
        text-align:
          center;

        color:
          #64748b;

        margin:
          8px 0 25px;
      }

      .bp-tabs {
        display:
          grid;

        grid-template-columns:
          repeat(2,1fr);

        gap:
          7px;

        background:
          #f1f5f9;

        padding:
          5px;

        border-radius:
          12px;

        margin-bottom:
          20px;
      }

      .bp-tab {
        border:
          0;

        background:
          transparent;

        padding:
          10px;

        border-radius:
          9px;

        cursor:
          pointer;

        font-weight:
          700;
      }

      .bp-tab-active {
        background:
          white;

        box-shadow:
          0 2px 8px
          rgba(15,23,42,.08);
      }

      .bp-workspace {
        min-height:
          calc(100vh - 70px);

        padding:
          15px;
      }

      .bp-workspace-grid {
        display:
          grid;

        grid-template-columns:
          230px minmax(0,1fr);

        gap:
          15px;

        min-height:
          calc(100vh - 100px);
      }

      .bp-sidebar,
      .bp-panel {
        background:
          white;

        border:
          1px solid #e2e8f0;

        border-radius:
          17px;

        overflow:
          hidden;
      }

      .bp-sidebar-header,
      .bp-panel-header {
        padding:
          14px 16px;

        border-bottom:
          1px solid #e2e8f0;

        font-weight:
          800;

        display:
          flex;

        align-items:
          center;

        justify-content:
          space-between;
      }

      .bp-files {
        padding:
          10px;
      }

      .bp-file {
        display:
          block;

        width:
          100%;

        border:
          0;

        background:
          transparent;

        text-align:
          left;

        padding:
          10px 11px;

        border-radius:
          9px;

        cursor:
          pointer;

        color:
          #334155;
      }

      .bp-file:hover,
      .bp-file-active {
        background:
          #eef2ff;

        color:
          #4338ca;
      }

      .bp-workspace-main {
        display:
          grid;

        grid-template-columns:
          minmax(0,1.35fr)
          minmax(320px,.65fr);

        gap:
          15px;

        min-width:
          0;
      }

      .bp-preview-frame {
        width:
          100%;

        height:
          650px;

        border:
          0;

        display:
          block;

        background:
          white;
      }

      .bp-chat {
        height:
          650px;

        display:
          flex;

        flex-direction:
          column;
      }

      .bp-chat-messages {
        flex:
          1;

        overflow:
          auto;

        padding:
          15px;
      }

      .bp-chat-message {
        padding:
          11px 12px;

        border-radius:
          11px;

        margin-bottom:
          10px;

        line-height:
          1.5;

        white-space:
          pre-wrap;

        font-size:
          14px;
      }

      .bp-chat-user {
        background:
          #e0f2fe;
      }

      .bp-chat-ai {
        background:
          #f1f5f9;
      }

      .bp-chat-error {
        background:
          #fee2e2;

        color:
          #991b1b;
      }

      .bp-chat-input {
        border-top:
          1px solid #e2e8f0;

        padding:
          12px;
      }

      .bp-preview-empty {
        min-height:
          650px;

        display:
          flex;

        align-items:
          center;

        justify-content:
          center;

        text-align:
          center;

        padding:
          30px;

        color:
          #64748b;
      }

      .bp-editor-page {
        min-height:
          100vh;

        padding:
          20px;

        background:
          #f1f5f9;
      }

      .bp-editor {
        width:
          100%;

        min-height:
          680px;

        resize:
          vertical;

        font-family:
          "Courier New",
          monospace;

        font-size:
          14px;

        line-height:
          1.55;

        border:
          1px solid #cbd5e1;

        border-radius:
          13px;

        padding:
          15px;

        outline:
          none;

        background:
          #0f172a;

        color:
          #e2e8f0;
      }

      .bp-modal {
        position:
          fixed;

        inset:
          0;

        background:
          rgba(15,23,42,.65);

        display:
          flex;

        align-items:
          center;

        justify-content:
          center;

        padding:
          20px;

        z-index:
          1000;
      }

      .bp-modal-card {
        width:
          min(650px,100%);

        background:
          white;

        border-radius:
          20px;

        padding:
          25px;

        box-shadow:
          0 30px 100px
          rgba(0,0,0,.3);
      }

      .bp-public-link {
        width:
          100%;

        padding:
          13px;

        border:
          1px solid #cbd5e1;

        border-radius:
          10px;

        background:
          #f8fafc;

        word-break:
          break-all;
      }

      .bp-toast {
        position:
          fixed;

        right:
          20px;

        bottom:
          20px;

        z-index:
          5000;

        max-width:
          420px;

        padding:
          13px 17px;

        border-radius:
          12px;

        background:
          #111827;

        color:
          white;

        opacity:
          0;

        transform:
          translateY(10px);

        pointer-events:
          none;

        transition:
          .2s ease;

        box-shadow:
          0 15px 40px
          rgba(0,0,0,.2);
      }

      .bp-toast-show {
        opacity:
          1;

        transform:
          translateY(0);
      }

      .bp-success {
        background:
          #15803d;
      }

      .bp-error {
        background:
          #b91c1c;
      }

      @media (max-width: 950px) {
        .bp-workspace-grid {
          grid-template-columns:
            1fr;
        }

        .bp-workspace-main {
          grid-template-columns:
            1fr;
        }

        .bp-sidebar {
          max-height:
            250px;
          overflow:
            auto;
        }
      }

      @media (max-width: 700px) {
        .bp-builder-grid,
        .bp-two-col {
          grid-template-columns:
            1fr;
        }

        .bp-project-main {
          align-items:
            flex-start;

          flex-direction:
            column;
        }

        .bp-user-email {
          display:
            none;
        }

        .bp-topbar {
          padding:
            0 14px;
        }

        .bp-main {
          padding:
            25px 14px 50px;
        }
      }

      /* ======================================================
         IDE / AI BUILDER / PUBLIC CLEAN SITE
         ====================================================== */
      .bp-ide-app { background:#0b1020; color:#e5e7eb; min-height:100vh; }
      .bp-ide-topbar { position:sticky; top:0; z-index:200; height:62px; padding:0 14px; background:#0b1020; border-bottom:1px solid #1f2937; }
      .bp-brand-stack { display:flex; flex-direction:column; min-width:0; }
      .bp-brand-stack strong { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:280px; }
      .bp-brand-stack span { font-size:10px; color:#94a3b8; margin-top:2px; text-transform:uppercase; }
      .bp-icon-btn,.bp-mini-btn { border:1px solid #334155; background:#111827; color:#cbd5e1; border-radius:8px; cursor:pointer; }
      .bp-icon-btn { width:34px; height:34px; margin-right:4px; }
      .bp-mini-btn { padding:6px 9px; font-size:12px; }
      .bp-btn-soft { background:#111827; color:#dbeafe; border-color:#334155; }
      .bp-ide-toolbar { display:flex; gap:7px; align-items:center; flex-wrap:wrap; }
      .bp-ide { display:grid; grid-template-columns:235px minmax(0,1fr) 380px; min-height:calc(100vh - 62px); background:#0b1020; }
      .bp-ide-sidebar { border-right:1px solid #1f2937; background:#0f172a; display:flex; flex-direction:column; min-width:0; }
      .bp-ide-side-head { height:48px; padding:0 12px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #1f2937; color:#cbd5e1; }
      .bp-ide-side-head div { display:flex; align-items:center; gap:7px; font-size:11px; letter-spacing:.08em; }
      .bp-ide-side-head span { background:#1e293b; padding:2px 6px; border-radius:999px; font-size:10px; }
      .bp-files { padding:8px; overflow:auto; flex:1; }
      .bp-file-row { display:flex; align-items:center; gap:2px; }
      .bp-file { flex:1; display:flex; align-items:center; gap:8px; border:0; background:transparent; color:#94a3b8; padding:8px 7px; border-radius:7px; cursor:pointer; text-align:left; min-width:0; }
      .bp-file:hover,.bp-file-active { background:#1e293b; color:#f8fafc; }
      .bp-file-icon { width:22px; text-align:center; font-size:11px; font-weight:800; color:#818cf8; }
      .bp-file-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; }
      .bp-file-more { border:0; background:transparent; color:#64748b; cursor:pointer; opacity:.5; }
      .bp-file-row:hover .bp-file-more { opacity:1; }
      .bp-sidebar-bottom { padding:9px; border-top:1px solid #1f2937; }
      .bp-side-action { width:100%; text-align:left; border:0; background:transparent; color:#94a3b8; padding:9px; border-radius:7px; cursor:pointer; }
      .bp-side-action:hover { background:#1e293b; color:#fff; }
      .bp-ide-center { min-width:0; background:#111827; }
      .bp-editor-tabs { height:40px; display:flex; align-items:end; border-bottom:1px solid #1f2937; background:#0f172a; }
      .bp-editor-tab { padding:11px 15px 9px; color:#94a3b8; font-size:12px; border-right:1px solid #1f2937; }
      .bp-editor-tab.active { color:#fff; background:#111827; border-top:2px solid #6366f1; padding-top:9px; }
      .bp-preview-shell { height:calc(100vh - 102px); min-height:600px; display:flex; flex-direction:column; }
      .bp-preview-head { height:45px; padding:0 12px; display:flex; align-items:center; justify-content:space-between; color:#cbd5e1; font-size:12px; border-bottom:1px solid #1f2937; }
      .bp-preview-content { flex:1; background:#fff; overflow:hidden; }
      .bp-preview-content .bp-preview-frame { height:100%; min-height:0; border:0; }
      .bp-ai-panel { background:#0f172a; border-left:1px solid #1f2937; display:flex; flex-direction:column; min-width:0; }
      .bp-ai-head { min-height:62px; padding:12px 13px; border-bottom:1px solid #1f2937; display:flex; justify-content:space-between; gap:10px; }
      .bp-ai-head strong { display:block; color:#fff; font-size:14px; }
      .bp-ai-head span { display:block; margin-top:3px; color:#64748b; font-size:11px; }
      .bp-chat-messages { flex:1; overflow:auto; padding:13px; }
      .bp-chat-message { display:flex; gap:9px; padding:11px; border:1px solid #1e293b; border-radius:11px; margin-bottom:10px; line-height:1.5; font-size:13px; color:#cbd5e1; background:#111827; white-space:pre-wrap; }
      .bp-chat-user { background:#172554; border-color:#1e3a8a; }
      .bp-chat-ai { background:#111827; }
      .bp-chat-error { background:#3f1118; border-color:#7f1d1d; color:#fecaca; }
      .bp-ai-avatar { width:24px; height:24px; border-radius:7px; display:grid; place-items:center; background:#312e81; color:#fff; flex:0 0 auto; }
      .bp-chat-input { padding:12px; border-top:1px solid #1f2937; background:#0f172a; }
      .bp-prompt-box { border:1px solid #334155; border-radius:12px; background:#111827; overflow:hidden; }
      .bp-prompt-box:focus-within { border-color:#6366f1; box-shadow:0 0 0 2px rgba(99,102,241,.15); }
      .bp-prompt-box .bp-textarea { border:0; background:transparent; color:#f8fafc; resize:none; box-shadow:none; }
      .bp-prompt-tools { display:flex; align-items:center; gap:7px; padding:7px; border-top:1px solid #1f2937; }
      .bp-tool-btn { border:1px solid #334155; background:#0f172a; color:#cbd5e1; border-radius:7px; padding:6px 9px; cursor:pointer; font-size:12px; }
      .bp-tool-hint { flex:1; color:#64748b; font-size:10px; }
      .bp-send-btn { width:34px !important; height:32px; padding:0 !important; border-radius:8px; }
      .bp-attach-preview { padding:0 12px; }
      .bp-attachment { display:flex; gap:8px; align-items:center; padding:8px; border:1px solid #334155; background:#111827; border-radius:8px; font-size:11px; color:#cbd5e1; margin:8px 0 0; }
      .bp-attachment img { width:38px; height:38px; object-fit:cover; border-radius:6px; }
      .bp-code-page { min-height:100vh; background:#0b1020; color:#e5e7eb; padding:0; }
      .bp-code-top { height:62px; display:flex; align-items:center; justify-content:space-between; padding:0 16px; border-bottom:1px solid #1f2937; }
      .bp-code-path { font-weight:700; font-size:14px; }
      .bp-code-sub { color:#64748b; font-size:11px; margin-top:3px; }
      .bp-code-layout { display:grid; grid-template-columns:55px minmax(0,1fr); width:min(1500px,100%); margin:auto; height:calc(100vh - 95px); min-height:600px; background:#020617; }
      .bp-code-gutter { padding:16px 10px; text-align:right; color:#475569; background:#020617; border-right:1px solid #1e293b; font:14px/1.55 "Courier New",monospace; white-space:pre; overflow:hidden; user-select:none; }
      .bp-editor { width:100%; height:100%; min-height:0; resize:none; border:0; border-radius:0; padding:16px; outline:0; background:#020617; color:#e2e8f0; font:14px/1.55 "Courier New",monospace; tab-size:2; white-space:pre; overflow:auto; }
      .bp-code-status { height:33px; display:flex; justify-content:flex-end; gap:16px; align-items:center; padding:0 15px; color:#64748b; font-size:10px; border-top:1px solid #1f2937; }
      .bp-public-shell { min-height:100vh; background:#fff; }
      .bp-public-mount { width:100%; min-height:100vh; }
      .bp-public-frame { width:100%; height:100vh; min-height:100vh; border:0; display:block; background:#fff; }
      @media (max-width:1100px) {
        .bp-ide { grid-template-columns:210px minmax(0,1fr); }
        .bp-ai-panel { position:fixed; right:0; top:62px; bottom:0; width:min(380px,92vw); z-index:300; box-shadow:-20px 0 60px rgba(0,0,0,.35); transform:translateX(100%); transition:.2s ease; }
        .bp-ai-panel.bp-ai-open { transform:translateX(0); }
      }
      @media (max-width:700px) {
        .bp-ide { grid-template-columns:1fr; }
        .bp-ide-sidebar { display:none; }
        .bp-ide-toolbar .bp-btn { padding:7px 9px; font-size:11px; }
        .bp-brand-stack strong { max-width:150px; }
        .bp-preview-shell { height:calc(100vh - 102px); }
      }

    `;

    document.head.appendChild(
      style
    );
  }

  /* =========================================================
     CONFIG CHECK
     ========================================================= */

  if (
    !SUPABASE_URL ||
    !SUPABASE_KEY
  ) {
    root.innerHTML = `
      <div class="bp-auth-page">
        <div class="bp-auth-card">
          <div class="bp-auth-logo">
            ⚙
          </div>

          <h2 class="bp-auth-title">
            Configuration Missing
          </h2>

          <p class="bp-auth-subtitle">
            Please check config.js
          </p>
        </div>
      </div>
    `;

    return;
  }

  if (!window.supabase) {
    root.innerHTML = `
      <div class="bp-auth-page">
        <div class="bp-auth-card">
          <div class="bp-auth-logo">
            !
          </div>

          <h2 class="bp-auth-title">
            Supabase Library Missing
          </h2>

          <p class="bp-auth-subtitle">
            Refresh the page and try again.
          </p>
        </div>
      </div>
    `;

    return;
  }

  injectStyles();

  const client =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY,
      {
        auth: {
          persistSession:
            true,

          autoRefreshToken:
            true,

          detectSessionInUrl:
            true,
        },
      }
    );

  /* =========================================================
     AUTH
     ========================================================= */

  async function getSession() {
    const {
      data,
      error,
    } = await client.auth.getSession();

    if (error) {
      console.error(error);
    }

    activeSession =
      data?.session || null;

    activeUser =
      activeSession?.user || null;

    return activeSession;
  }

async function ensureProfile() {
    if (!activeUser) {
      activeProfile = null;
      return null;
    }

    const { data, error } = await client
      .from("profiles")
      .select("id,full_name,role,status,plan,project_limit,github_file_limit")
      .eq("id", activeUser.id)
      .maybeSingle();

    if (error) {
      console.error("Profile check:", error);
      activeProfile = { id: activeUser.id, role: "user", status: "active", plan: "free" };
      return activeProfile;
    }

    if (data) {
      activeProfile = data;
      return data;
    }

    const profile = {
      id: activeUser.id,
      full_name: activeUser.user_metadata?.full_name || activeUser.email || "User",
      role: "user",
      status: "active",
      plan: "free"
    };

    const { data: created, error: insertError } = await client
      .from("profiles")
      .insert(profile)
      .select("id,full_name,role,status,plan,project_limit,github_file_limit")
      .maybeSingle();

    if (insertError) {
      console.error("Profile create:", insertError);
      activeProfile = profile;
    } else {
      activeProfile = created || profile;
    }

    return activeProfile;
  }


  /* =========================================================
     AUTH SCREEN
     ========================================================= */

  function renderAuth(
    mode = "login"
  ) {
    root.innerHTML = `
      <div class="bp-auth-page">

        <div class="bp-auth-card">

          <div class="bp-auth-logo">
            ⚡
          </div>

          <h1 class="bp-auth-title">
            BuildPilot AI
          </h1>

          <p class="bp-auth-subtitle">
            Describe it. Build it. Deploy it.
          </p>

          <div class="bp-tabs">

            <button
              id="loginTab"
              class="bp-tab ${
                mode === "login"
                  ? "bp-tab-active"
                  : ""
              }"
              onclick="window.BuildPilot.showLogin()"
            >
              Login
            </button>

            <button
              id="signupTab"
              class="bp-tab ${
                mode === "signup"
                  ? "bp-tab-active"
                  : ""
              }"
              onclick="window.BuildPilot.showSignup()"
            >
              Create Account
            </button>

          </div>

          <div id="authForm"></div>

        </div>

      </div>
    `;

    if (mode === "signup") {
      renderSignupForm();
    } else {
      renderLoginForm();
    }
  }

  function renderLoginForm() {
    const form =
      document.getElementById(
        "authForm"
      );

    if (!form) return;

    form.innerHTML = `
      <form id="loginForm">

        <div class="bp-field">

          <label class="bp-label">
            Email
          </label>

          <input
            class="bp-input"
            id="loginEmail"
            type="email"
            placeholder="you@example.com"
            required
          />

        </div>

        <div class="bp-field">

          <label class="bp-label">
            Password
          </label>

          <input
            class="bp-input"
            id="loginPassword"
            type="password"
            placeholder="Your password"
            required
          />

        </div>

        <button
          id="loginButton"
          class="bp-btn bp-btn-primary"
          style="width:100%;padding:13px;"
          type="submit"
        >
          Login
        </button>

      </form>
    `;

    document
      .getElementById(
        "loginForm"
      )
      .addEventListener(
        "submit",
        loginUser
      );
  }

  function renderSignupForm() {
    const form =
      document.getElementById(
        "authForm"
      );

    if (!form) return;

    form.innerHTML = `
      <form id="signupForm">

        <div class="bp-field">

          <label class="bp-label">
            Full Name
          </label>

          <input
            class="bp-input"
            id="signupName"
            type="text"
            placeholder="Your name"
            required
          />

        </div>

        <div class="bp-field">

          <label class="bp-label">
            Email
          </label>

          <input
            class="bp-input"
            id="signupEmail"
            type="email"
            placeholder="you@example.com"
            required
          />

        </div>

        <div class="bp-field">

          <label class="bp-label">
            Password
          </label>

          <input
            class="bp-input"
            id="signupPassword"
            type="password"
            minlength="6"
            placeholder="Minimum 6 characters"
            required
          />

        </div>

        <button
          id="signupButton"
          class="bp-btn bp-btn-primary"
          style="width:100%;padding:13px;"
          type="submit"
        >
          Create Account
        </button>

      </form>
    `;

    document
      .getElementById(
        "signupForm"
      )
      .addEventListener(
        "submit",
        signupUser
      );
  }

  async function loginUser(
    event
  ) {
    event.preventDefault();

    const button =
      document.getElementById(
        "loginButton"
      );

    setButtonLoading(
      button,
      true,
      "Logging in..."
    );

    try {
      const email =
        document
          .getElementById(
            "loginEmail"
          )
          .value.trim();

      const password =
        document.getElementById(
          "loginPassword"
        ).value;

      const {
        data,
        error,
      } =
        await client.auth.signInWithPassword(
          {
            email,
            password,
          }
        );

      if (error) {
        throw error;
      }

      activeSession =
        data.session;

      activeUser =
        data.user;

      await ensureProfile();

      showToast(
        "Login successful",
        "success"
      );

      renderHome();

    } catch (error) {
      console.error(error);

      showToast(
        error.message ||
          "Login failed",
        "error"
      );
    } finally {
      setButtonLoading(
        button,
        false
      );
    }
  }

  async function signupUser(
    event
  ) {
    event.preventDefault();

    const button =
      document.getElementById(
        "signupButton"
      );

    setButtonLoading(
      button,
      true,
      "Creating account..."
    );

    try {
      const name =
        document
          .getElementById(
            "signupName"
          )
          .value.trim();

      const email =
        document
          .getElementById(
            "signupEmail"
          )
          .value.trim();

      const password =
        document.getElementById(
          "signupPassword"
        ).value;

      const {
        data,
        error,
      } =
        await client.auth.signUp({
          email,
          password,

          options: {
            data: {
              full_name:
                name,
            },
          },
        });

      if (error) {
        throw error;
      }

      if (data.session) {
        activeSession =
          data.session;

        activeUser =
          data.user;

        await ensureProfile();

        showToast(
          "Account created",
          "success"
        );

        renderHome();
      } else {
        showToast(
          "Account created. Please confirm your email.",
          "success"
        );

        renderAuth("login");
      }

    } catch (error) {
      console.error(error);

      showToast(
        error.message ||
          "Signup failed",
        "error"
      );
    } finally {
      setButtonLoading(
        button,
        false
      );
    }
  }

  async function logoutUser() {
    await client.auth.signOut();

    activeSession =
      null;

    activeUser =
      null;
    activeProfile = null;
    pendingAIImage = null;

    activeProject =
      null;

    activeFiles =
      [];

    renderAuth(
      "login"
    );
  }

  /* =========================================================
     HOME
     ========================================================= */

  async function renderHome() {
    await getSession();

    if (!activeUser) {
      renderAuth(
        "login"
      );

      return;
    }

    await ensureProfile();

    if (activeProfile && activeProfile.status === "blocked") {
      root.innerHTML = `
        <div class="bp-auth-page"><div class="bp-auth-card" style="text-align:center">
          <div class="bp-auth-logo">!</div>
          <h2 class="bp-auth-title">Account blocked</h2>
          <p class="bp-auth-subtitle">Please contact the administrator to reactivate your account.</p>
          <button class="bp-btn" onclick="window.BuildPilot.logout()">Logout</button>
        </div></div>`;
      return;
    }

    root.innerHTML = `
      <div class="bp-app">

        <header class="bp-topbar">

          <div class="bp-brand">

            <div class="bp-logo">
              ⚡
            </div>

            <span>
              BuildPilot AI
            </span>

          </div>

          <div class="bp-user-area">

            <span class="bp-user-email">
              ${escapeHtml(
                activeUser.email ||
                  ""
              )}
            </span>

            ${activeProfile?.role === "admin" ? `
              <button
                class="bp-btn"
                style="background:transparent;color:white;border-color:#475569"
                onclick="window.BuildPilot.admin()"
              >Admin</button>
            ` : ""}
            <button
              class="bp-btn"
              style="
                background:transparent;
                color:white;
                border-color:#475569;
              "
              onclick="window.BuildPilot.logout()"
            >
              Logout
            </button>

          </div>

        </header>

        <main class="bp-main">

          <section class="bp-hero">

            <h1>
              Build anything with
              <span class="bp-gradient-text">
                AI
              </span>
            </h1>

            <p>
              Describe your idea in simple language.
              BuildPilot AI creates the project,
              lets you edit it with AI,
              previews it live and generates a
              shareable public link.
            </p>

          </section>

          <section>

            <div class="bp-builder-grid">

              <div
                class="bp-card bp-card-hover"
                onclick="
                  window.BuildPilot.startProject(
                    'complete_system'
                  )
                "
              >

                <div class="bp-card-icon">
                  🚀
                </div>

                <h3>
                  Complete System
                </h3>

                <p>
                  Build websites, dashboards,
                  authentication, database
                  and business features.
                </p>

              </div>

              <div
                class="bp-card bp-card-hover"
                onclick="
                  window.BuildPilot.startProject(
                    'website'
                  )
                "
              >

                <div class="bp-card-icon">
                  🌐
                </div>

                <h3>
                  Website
                </h3>

                <p>
                  Create responsive HTML, CSS
                  and JavaScript websites
                  quickly with AI.
                </p>

              </div>

            </div>

          </section>

          <section class="bp-section">

            <div class="bp-section-header">

              <div>
                <h2>
                  My Projects
                </h2>

                <p style="
                  margin:5px 0 0;
                  color:#64748b;
                  font-size:14px;
                ">
                  Your saved BuildPilot projects
                </p>
              </div>

              <button
                class="bp-btn"
                onclick="
                  window.BuildPilot.loadProjects()
                "
              >
                ↻ Refresh
              </button>

            </div>

            <div id="projectsList">
              Loading projects...
            </div>

          </section>

        </main>

      </div>
    `;

    await loadProjects();
  }

  /* =========================================================
     NEW PROJECT
     ========================================================= */

  function startProject(
    projectType
  ) {
    root.innerHTML = `
      <div class="bp-app">

        <header class="bp-topbar">

          <div class="bp-brand">

            <div class="bp-logo">
              ⚡
            </div>

            <span>
              BuildPilot AI
            </span>

          </div>

          <button
            class="bp-btn"
            style="
              background:transparent;
              color:white;
              border-color:#475569;
            "
            onclick="
              window.BuildPilot.home()
            "
          >
            ← Projects
          </button>

        </header>

        <main class="bp-main">

          <div style="
            max-width:850px;
            margin:auto;
          ">

            <div class="bp-card">

              <div class="bp-card-icon">
                ${
                  projectType ===
                  "website"
                    ? "🌐"
                    : "🚀"
                }
              </div>

              <h1 style="
                margin:0 0 8px;
              ">
                Build your project
              </h1>

              <p style="
                color:#64748b;
                margin-top:0;
              ">
                Tell BuildPilot AI exactly
                what you want to create.
              </p>

              <div class="bp-field">

                <label class="bp-label">
                  Project Name
                </label>

                <input
                  id="newProjectName"
                  class="bp-input"
                  placeholder="My Business Website"
                />

              </div>

              <div class="bp-field">

                <label class="bp-label">
                  What do you want to build?
                </label>

                <textarea
                  id="newProjectPrompt"
                  class="bp-textarea"
                  rows="8"
                  placeholder="
Example:

Create a modern coaching website for Kartar Classes.

Pages:
Home
Courses
Teachers
About
Contact

Add WhatsApp contact button,
responsive mobile design and
a professional header.
                  "
                ></textarea>

              </div>

              <div class="bp-two-col">

                <div class="bp-field">

                  <label class="bp-label">
                    Frontend
                  </label>

                  <select
                    id="frontend"
                    class="bp-select"
                  >
                    <option value="html">
                      HTML / CSS / JavaScript
                    </option>

                    <option value="react">
                      React
                    </option>

                    <option value="nextjs">
                      Next.js
                    </option>
                  </select>

                </div>

                <div class="bp-field">

                  <label class="bp-label">
                    Backend
                  </label>

                  <select
                    id="backend"
                    class="bp-select"
                  >
                    <option value="supabase">
                      Supabase
                    </option>

                    <option value="firebase">
                      Firebase
                    </option>

                    <option value="github">
                      GitHub
                    </option>
                  </select>

                </div>

              </div>

              <button
                id="createProjectButton"
                class="bp-btn bp-btn-primary"
                style="
                  width:100%;
                  padding:14px;
                  margin-top:5px;
                "
                onclick="
                  window.BuildPilot.createProject(
                    '${escapeAttribute(
                      projectType
                    )}'
                  )
                "
              >
                ✨ Build Project
              </button>

            </div>

          </div>

        </main>

      </div>
    `;
  }

  /* =========================================================
     STARTER FILES
     IMPORTANT:
     generated_by IS NOT SENT.
     ========================================================= */

  function starterHTML(
    name
  ) {
    return `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>${escapeHtml(
    name
  )}</title>
</head>

<body>

  <main class="bp-starter">
    <div class="bp-starter-card">

      <div class="bp-starter-icon">
        ⚡
      </div>

      <h1>
        ${escapeHtml(name)}
      </h1>

      <p>
        Your website is ready.
      </p>

      <button id="helloButton">
        Get Started
      </button>

    </div>
  </main>

</body>
</html>`;
  }

  function starterCSS() {
    return `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family:
    Inter,
    Arial,
    sans-serif;

  background:
    linear-gradient(
      135deg,
      #eef2ff,
      #ecfeff
    );

  color:
    #0f172a;
}

.bp-starter {
  min-height: 100vh;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 30px;
}

.bp-starter-card {
  width: min(650px,100%);

  padding: 55px 30px;

  background: white;

  border-radius: 25px;

  text-align: center;

  box-shadow:
    0 25px 80px
    rgba(15,23,42,.12);
}

.bp-starter-icon {
  font-size: 50px;
  margin-bottom: 15px;
}

.bp-starter-card h1 {
  margin: 0 0 10px;
}

.bp-starter-card p {
  color: #64748b;
  margin-bottom: 25px;
}

.bp-starter-card button {
  border: 0;

  padding: 13px 20px;

  border-radius: 10px;

  background: #111827;

  color: white;

  cursor: pointer;
}`;

  }

  function starterJS() {
    return `document.addEventListener(
  "DOMContentLoaded",
  function () {

    const button =
      document.getElementById(
        "helloButton"
      );

    if (button) {

      button.addEventListener(
        "click",
        function () {

          alert(
            "Your website is working!"
          );

        }
      );

    }

  }
);`;
  }

  async function ensureStarterFiles(
    projectId,
    projectName
  ) {
    if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
  throw new Error("Invalid project ID");
}
    if (!projectId) {
      throw new Error(
        "Project ID missing"
      );
    }

    const {
      data: existing,
      error: selectError,
    } = await client
      .from("project_files")
      .select(
        "id,file_path,file_content,language"
      )
      .eq(
        "project_id",
        projectId
      );

    if (selectError) {
      throw new Error(
        "Could not load project files: " +
          selectError.message
      );
    }

    const files =
      existing || [];

    const existingPaths =
      new Set(
        files.map(
          (file) =>
            String(
              file.file_path
            ).toLowerCase()
        )
      );

    const starterFiles =
      [];

    if (
      !existingPaths.has(
        "index.html"
      )
    ) {
      starterFiles.push({
        project_id:
          projectId,

        file_path:
          "index.html",

        file_content:
          starterHTML(
            projectName
          ),

        language:
          "html",
      });
    }

    if (
      !existingPaths.has(
        "style.css"
      )
    ) {
      starterFiles.push({
        project_id:
          projectId,

        file_path:
          "style.css",

        file_content:
          starterCSS(),

        language:
          "css",
      });
    }

    if (
      !existingPaths.has(
        "script.js"
      )
    ) {
      starterFiles.push({
        project_id:
          projectId,

        file_path:
          "script.js",

        file_content:
          starterJS(),

        language:
          "javascript",
      });
    }

    if (
      !starterFiles.length
    ) {
      return true;
    }

    const {
      error: insertError,
    } = await client
      .from("project_files")
      .insert(
        starterFiles
      );

    if (insertError) {
      throw new Error(
        "Could not create starter files: " +
          insertError.message
      );
    }

    return true;
  }

  /* =========================================================
     CREATE PROJECT
     ========================================================= */

  async function createProject(
    projectType
  ) {
    await getSession();

    if (!activeUser) {
      renderAuth(
        "login"
      );

      return;
    }

    const button =
      document.getElementById(
        "createProjectButton"
      );

    const name =
      document
        .getElementById(
          "newProjectName"
        )
        .value.trim();

    const prompt =
      document
        .getElementById(
          "newProjectPrompt"
        )
        .value.trim();

    const frontend =
      document.getElementById(
        "frontend"
      ).value;

    const backend =
      document.getElementById(
        "backend"
      ).value;

    if (!name) {
      showToast(
        "Project name required",
        "error"
      );

      return;
    }

    if (!prompt) {
      showToast(
        "Project description required",
        "error"
      );

      return;
    }

    /* Free-plan project limit: default 5. */
    if (activeProfile && activeProfile.role !== "admin") {
      const limit = Number(activeProfile.project_limit ?? 5);
      const { count, error: countError } = await client
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", activeUser.id);

      if (!countError && Number.isFinite(limit) && (count || 0) >= limit) {
        showToast(`Project limit reached (${limit}). Please request an upgrade from admin.`, "error");
        return;
      }
    }

    setButtonLoading(
      button,
      true,
      "Creating project..."
    );

    try {
      const {
        data: typeData,
      } = await client
        .from("project_types")
        .select(
          "id,name,code"
        )
        .eq(
          "code",
          projectType
        )
        .maybeSingle();

      const {
        data: project,
        error,
      } = await client
        .from("projects")
        .insert({
          user_id:
            activeUser.id,

          name,

          description:
            prompt,

          frontend,

          backend,

          status:
            "draft",

          project_type_id:
            typeData?.id ||
            null,
        })
        .select(
          `
          id,
          name,
          description,
          frontend,
          backend,
          project_plan,
          public_id,
          public_enabled,
          published_at,
          status
          `
        )
        .single();

      if (error) {
        throw error;
      }

      /*
       * IMPORTANT:
       * Starter files are created BEFORE AI call.
       */
      await ensureStarterFiles(
        project.id,
        project.name
      );

      activeProject =
        project;

      await loadProjectFiles();

      showToast(
        "Project created. AI is building it...",
        "success"
      );

      /*
       * AI generation.
       */
      try {
        await callGenerateFunction(
          project.id,
          prompt,
          name,
          frontend,
          backend
        );
      } catch (aiError) {
        console.error(
          "AI generation error:",
          aiError
        );

        showToast(
          "Starter project created. AI generation failed: " +
            aiError.message,
          "error"
        );
      }

      await loadProjectFiles();

      openWorkspace(
        project.id
      );

    } catch (error) {
      console.error(error);

      showToast(
        error.message ||
          "Project creation failed",
        "error"
      );
    } finally {
      setButtonLoading(
        button,
        false
      );
    }
  }

  /* =========================================================
     AI FUNCTION
     ========================================================= */

async function callGenerateFunction(projectId, instruction, projectName, frontend, backend, extra = {}) {
    await getSession();
    if (!activeSession) throw new Error("Your login session expired. Please login again.");

    const payload = {
      projectId,
      instruction,
      prompt: instruction,
      projectName,
      frontend,
      backend,
      ...extra
    };

    const { data, error } = await client.functions.invoke(GENERATE_FUNCTION, {
      headers: { Authorization: "Bearer " + activeSession.access_token },
      body: payload
    });

    if (error) {
      console.error("Edge Function error:", error);
      throw new Error(error.message || "AI function failed");
    }
    if (data && data.success === false) {
      throw new Error(data.error || "AI generation failed");
    }
    return data || { success:true };
  }


  /* =========================================================
     LOAD PROJECT FILES
     ========================================================= */

  async function loadProjectFiles() {
    if (!activeProject) {
      activeFiles = [];

      return [];
    }

    const {
      data,
      error,
    } =
      await client
        .from("project_files")
        .select(
          `
          id,
          project_id,
          file_path,
          file_content,
          language
          `
        )
        .eq(
          "project_id",
          activeProject.id
        )
        .order(
          "file_path"
        );

    if (error) {
      throw error;
    }

    activeFiles =
      data || [];

    return activeFiles;
  }

  /* =========================================================
     PROJECT LIST
     ========================================================= */

  async function loadProjects() {
    const list =
      document.getElementById(
        "projectsList"
      );

    if (!list) {
      return;
    }

    list.innerHTML = `
      <div class="bp-card">
        Loading projects...
      </div>
    `;

    const {
      data,
      error,
    } =
      await client
        .from("projects")
        .select(
          `
          id,
          name,
          description,
          status,
          frontend,
          backend,
          public_id,
          public_enabled,
          published_at,
          created_at
          `
        )
        .eq(
          "user_id",
          activeUser.id
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        );

    if (error) {
      list.innerHTML = `
        <div class="bp-card">
          <strong>
            Could not load projects
          </strong>

          <p style="
            color:#dc2626;
            margin-bottom:0;
          ">
            ${escapeHtml(
              error.message
            )}
          </p>
        </div>
      `;

      return;
    }

    if (!data?.length) {
      list.innerHTML = `
        <div class="bp-card" style="
          text-align:center;
          padding:45px;
        ">

          <div style="
            font-size:42px;
          ">
            🛠️
          </div>

          <h3>
            No projects yet
          </h3>

          <p style="
            color:#64748b;
          ">
            Create your first project above.
          </p>

        </div>
      `;

      return;
    }

    list.innerHTML =
      data
        .map(
          (project) => `
            <div class="bp-project">

              <div class="bp-project-main">

                <div class="bp-project-info">

                  <h3 class="bp-project-title">
                    ${escapeHtml(
                      project.name
                    )}
                  </h3>

                  <p class="bp-project-description">
                    ${escapeHtml(
                      project.description ||
                        "No description"
                    )}
                  </p>

                  <div style="
                    display:flex;
                    gap:7px;
                    margin-top:10px;
                    flex-wrap:wrap;
                  ">

                    <span style="
                      background:#f1f5f9;
                      padding:5px 9px;
                      border-radius:999px;
                      font-size:12px;
                    ">
                      ${escapeHtml(
                        project.status ||
                          "draft"
                      )}
                    </span>

                    ${
                      project.public_enabled
                        ? `
                          <span style="
                            background:#dcfce7;
                            color:#166534;
                            padding:5px 9px;
                            border-radius:999px;
                            font-size:12px;
                          ">
                            ● Public
                          </span>
                        `
                        : ""
                    }

                  </div>

                </div>

                <div class="bp-actions">

                  <button
                    class="bp-btn bp-btn-primary"
                    onclick="
                      window.BuildPilot.openProject(
                        '${escapeAttribute(
                          project.id
                        )}'
                      )
                    "
                  >
                    Open
                  </button>

                  ${
                    project.public_enabled
                      ? `
                        <button
                          class="bp-btn"
                          onclick="
                            window.BuildPilot.copyPublicLink(
                              '${escapeAttribute(
                                project.public_id
                              )}'
                            )
                          "
                        >
                          🔗 Public Link
                        </button>
                      `
                      : ""
                  }

                </div>

              </div>

            </div>
          `
        )
        .join("");
  }

  /* =========================================================
     OPEN PROJECT
     ========================================================= */

  async function openProject(
    projectId
  ) {
    await getSession();

    if (!activeUser) {
      renderAuth(
        "login"
      );

      return;
    }

    try {
      const {
        data,
        error,
      } =
        await client
          .from("projects")
          .select(
            `
            id,
            name,
            description,
            frontend,
            backend,
            project_plan,
            public_id,
            public_enabled,
            published_at,
            status
            `
          )
          .eq(
            "id",
            projectId
          )
          .eq(
            "user_id",
            activeUser.id
          )
          .single();

      if (error) {
        throw error;
      }

      activeProject =
        data;

      /*
       * Critical fix:
       * If old project has no index.html,
       * create it now.
       */
      await ensureStarterFiles(
        activeProject.id,
        activeProject.name
      );

      await loadProjectFiles();

      openWorkspace(
        activeProject.id
      );

    } catch (error) {
      console.error(error);

      showToast(
        error.message ||
          "Could not open project",
        "error"
      );
    }
  }

  /* =========================================================
     WORKSPACE
     ========================================================= */

function openWorkspace(projectId) {
    if (!activeProject || activeProject.id !== projectId) {
      return;
    }

    const isAdmin = Boolean(activeProfile?.role === "admin");

    root.innerHTML = `
      <div class="bp-app bp-ide-app">
        <header class="bp-topbar bp-ide-topbar">
          <div class="bp-brand">
            <button class="bp-icon-btn" title="Back to projects"
              onclick="window.BuildPilot.home()">←</button>
            <div class="bp-logo">⚡</div>
            <div class="bp-brand-stack">
              <strong>${escapeHtml(activeProject.name || "Project")}</strong>
              <span>${escapeHtml(activeProject.frontend || "html")} · ${escapeHtml(activeProject.backend || "supabase")}</span>
            </div>
          </div>

          <div class="bp-ide-toolbar">
            <button class="bp-btn bp-btn-soft" onclick="window.BuildPilot.openFileCreator()">＋ File</button>
            <button class="bp-btn bp-btn-soft" onclick="window.BuildPilot.refreshFiles()">↻</button>
            <button class="bp-btn bp-btn-soft" onclick="window.BuildPilot.updatePreview()">▶ Preview</button>
            <button id="publishButton" class="bp-btn bp-btn-success"
              onclick="window.BuildPilot.togglePublish()">
              ${activeProject.public_enabled ? "🔗 Share" : "🚀 Publish"}
            </button>
            ${isAdmin ? `<button class="bp-btn bp-btn-soft" onclick="window.BuildPilot.admin()">Admin</button>` : ""}
          </div>
        </header>

        <main class="bp-ide">
          <aside class="bp-ide-sidebar">
            <div class="bp-ide-side-head">
              <div>
                <strong>FILES</strong>
                <span>${activeFiles.length}</span>
              </div>
              <button class="bp-mini-btn" title="New file" onclick="window.BuildPilot.openFileCreator()">＋</button>
            </div>
            <div id="filesList" class="bp-files"></div>
            <div class="bp-sidebar-bottom">
              <button class="bp-side-action" onclick="window.BuildPilot.showProjectInfo()">ⓘ Project info</button>
              <button class="bp-side-action" onclick="window.BuildPilot.home()">⌂ All projects</button>
            </div>
          </aside>

          <section class="bp-ide-center">
            <div class="bp-editor-tabs" id="editorTabs">
              <div class="bp-editor-tab active">Preview</div>
            </div>
            <div class="bp-preview-shell">
              <div class="bp-preview-head">
                <span>Live Preview</span>
                <div class="bp-actions">
                  <button class="bp-mini-btn" onclick="window.BuildPilot.updatePreview()">Refresh</button>
                  ${activeProject.public_enabled ? `<button class="bp-mini-btn" onclick="window.BuildPilot.copyPublicLink('${escapeAttribute(activeProject.public_id || "")}')">Copy link</button>` : ""}
                </div>
              </div>
              <div id="previewContent" class="bp-preview-content"></div>
            </div>
          </section>

          <aside class="bp-ai-panel">
            <div class="bp-ai-head">
              <div>
                <strong>AI Builder</strong>
                <span>Describe a change or create a feature</span>
              </div>
              <button class="bp-mini-btn" onclick="window.BuildPilot.clearChat()">Clear</button>
            </div>

            <div id="chatMessages" class="bp-chat-messages">
              <div class="bp-chat-message bp-chat-ai">
                <div class="bp-ai-avatar">✦</div>
                <div>
                  <strong>AI Builder</strong>
                  <div style="margin-top:5px">
                    Tell me what to build or change. I can edit your project files and update the live preview.
                  </div>
                </div>
              </div>
            </div>

            <div class="bp-attach-preview" id="aiAttachmentPreview"></div>

            <div class="bp-chat-input">
              <form id="aiChatForm">
                <div class="bp-prompt-box">
                  <textarea id="aiInstruction" class="bp-textarea"
                    rows="4"
                    placeholder="Try: Hero section ko modern banao&#10;Contact form add karo&#10;WhatsApp button lagao&#10;Uploaded image ko homepage me use karo"></textarea>
                  <div class="bp-prompt-tools">
                    <label class="bp-tool-btn" title="Upload image">
                      🖼️
                      <input id="aiImageInput" type="file" accept="image/*" hidden>
                    </label>
                    <button type="button" class="bp-tool-btn" onclick="window.BuildPilot.generateImage()">✦ Image</button>
                    <span class="bp-tool-hint">AI can modify the project</span>
                    <button id="aiSendButton" class="bp-btn bp-btn-primary bp-send-btn" type="submit">↑</button>
                  </div>
                </div>
              </form>
            </div>
          </aside>
        </main>
      </div>
    `;

    document.getElementById("aiChatForm")?.addEventListener("submit", submitAIInstruction);
    document.getElementById("aiImageInput")?.addEventListener("change", handleAIImageUpload);

    renderFilesList();
    updatePreview();
  }


  /* =========================================================
     FILE LIST
     ========================================================= */

function renderFilesList() {
    const list = document.getElementById("filesList");
    if (!list) return;

    if (!activeFiles.length) {
      list.innerHTML = `<div style="padding:15px;color:#64748b;font-size:13px">No files yet.</div>`;
      return;
    }

    const icons = {
      html:"🌐", htm:"🌐", css:"🎨", js:"JS", jsx:"⚛", ts:"TS", tsx:"⚛",
      json:"{}", md:"M", svg:"◇", png:"▧", jpg:"▧", jpeg:"▧", webp:"▧"
    };

    list.innerHTML = activeFiles.map(file => {
      const ext = String(file.file_path || "").split(".").pop().toLowerCase();
      const active = file.id === selectedFileId ? "bp-file-active" : "";
      return `
        <div class="bp-file-row">
          <button class="bp-file ${active}" onclick="window.BuildPilot.editFile('${escapeAttribute(file.id)}')" title="${escapeAttribute(file.file_path)}">
            <span class="bp-file-icon">${icons[ext] || "•"}</span>
            <span class="bp-file-name">${escapeHtml(file.file_path)}</span>
          </button>
          <button class="bp-file-more" title="Delete file" onclick="window.BuildPilot.deleteFile('${escapeAttribute(file.id)}')">⋮</button>
        </div>`;
    }).join("");
  }


  /* =========================================================
     PREVIEW
     ========================================================= */

  function buildPreviewHTML() {
    const htmlFile =
      activeFiles.find(
        (file) =>
          file.file_path
            .toLowerCase() ===
          "index.html"
      ) ||
      activeFiles.find(
        (file) =>
          file.file_path
            .toLowerCase()
            .endsWith(
              ".html"
            )
      );

    if (!htmlFile) {
      return null;
    }

    let html =
      htmlFile.file_content ||
      "";

    const css =
      activeFiles
        .filter(
          (file) =>
            file.file_path
              .toLowerCase()
              .endsWith(
                ".css"
              )
        )
        .map(
          (file) =>
            file.file_content ||
            ""
        )
        .join(
          "\n\n"
        );

    const js =
      activeFiles
        .filter(
          (file) =>
            file.file_path
              .toLowerCase()
              .endsWith(
                ".js"
              )
        )
        .map(
          (file) =>
            file.file_content ||
            ""
        )
        .join(
          "\n\n"
        );

    if (css.trim()) {
      const style =
        `
<style data-buildpilot-css>
${css}
</style>
`;

      if (
        /<\/head>/i.test(
          html
        )
      ) {
        html =
          html.replace(
            /<\/head>/i,
            style +
              "</head>"
          );
      } else {
        html =
          style +
          html;
      }
    }

    if (js.trim()) {
      const script =
        `
<script data-buildpilot-js>
${js}
</script>
`;

      if (
        /<\/body>/i.test(
          html
        )
      ) {
        html =
          html.replace(
            /<\/body>/i,
            script +
              "</body>"
          );
      } else {
        html +=
          script;
      }
    }

    return html;
  }

  function updatePreview() {
    const container =
      document.getElementById(
        "previewContent"
      );

    if (!container) {
      return;
    }

    const html =
      buildPreviewHTML();

    if (!html) {
      container.innerHTML = `
        <div class="bp-preview-empty">

          <div>

            <div style="
              font-size:45px;
              margin-bottom:12px;
            ">
              📄
            </div>

            <h3>
              index.html not found
            </h3>

            <p>
              BuildPilot will create the
              starter file automatically.
            </p>

            <button
              class="bp-btn bp-btn-primary"
              onclick="
                window.BuildPilot.refreshFiles()
              "
            >
              Create / Refresh Files
            </button>

          </div>

        </div>
      `;

      return;
    }

    const iframe =
      document.createElement(
        "iframe"
      );

    iframe.className =
      "bp-preview-frame";

    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-forms allow-modals allow-popups"
    );

    iframe.srcdoc =
      html;

    container.innerHTML =
      "";

    container.appendChild(
      iframe
    );
  }

  async function refreshFiles() {
    if (!activeProject) {
      return;
    }

    try {
      showToast(
        "Refreshing files..."
      );

      await ensureStarterFiles(
        activeProject.id,
        activeProject.name
      );

      await loadProjectFiles();

      renderFilesList();

      updatePreview();

      showToast(
        "Files refreshed",
        "success"
      );

    } catch (error) {
      console.error(error);

      showToast(
        error.message ||
          "Refresh failed",
        "error"
      );
    }
  }

  /* =========================================================
     AI CHAT
     ========================================================= */

async function submitAIInstruction(event) {
    event.preventDefault();

    if (!activeProject?.id) {
      showToast("Open a project first", "error");
      return;
    }

    const input = document.getElementById("aiInstruction");
    const button = document.getElementById("aiSendButton");
    const instruction = input?.value.trim() || "";

    if (!instruction && !pendingAIImage) {
      showToast("Please enter an instruction or upload an image", "error");
      return;
    }

    const imageContext = pendingAIImage
      ? `\nReference image URL: ${pendingAIImage.url}\nUse this image in the project when appropriate.`
      : "";

    appendChat("You", (instruction || "Use this image in the project") + imageContext, "user");
    if (input) input.value = "";
    setButtonLoading(button, true, "AI...");

    try {
      await ensureStarterFiles(activeProject.id, activeProject.name);
      await loadProjectFiles();

      const result = await callGenerateFunction(
        activeProject.id,
        instruction || "Use the uploaded reference image and improve the project.",
        activeProject.name,
        activeProject.frontend,
        activeProject.backend,
        {
          action: "modify_project",
          files: activeFiles.map(f => ({
            id: f.id, path: f.file_path, language: f.language,
            content: f.file_content || ""
          })),
          imageUrl: pendingAIImage?.url || null
        }
      );

      pendingAIImage = null;
      renderAttachmentPreview();
      await loadProjectFiles();
      renderFilesList();
      updatePreview();

      appendChat("AI Builder", result?.message || "Project updated successfully.", "ai");
      showToast("Project updated", "success");
    } catch (error) {
      console.error(error);
      appendChat("AI Builder", error.message || "AI update failed", "error");
      showToast(error.message || "AI update failed", "error");
    } finally {
      setButtonLoading(button, false);
    }
  }


  function appendChat(
    sender,
    message,
    type
  ) {
    const box =
      document.getElementById(
        "chatMessages"
      );

    if (!box) {
      return;
    }

    const item =
      document.createElement(
        "div"
      );

    item.className =
      "bp-chat-message " +
      (
        type === "user"
          ? "bp-chat-user"
          : type === "error"
          ? "bp-chat-error"
          : "bp-chat-ai"
      );

    item.innerHTML = `
      <strong>
        ${escapeHtml(
          sender
        )}
      </strong>

      <div style="
        margin-top:5px;
      ">
        ${escapeHtml(
          message
        )}
      </div>
    `;

    box.appendChild(
      item
    );

    box.scrollTop =
      box.scrollHeight;
  }

  /* =========================================================
     FILE EDITOR
     ========================================================= */

function editFile(fileId) {
    const file = activeFiles.find(item => item.id === fileId);
    if (!file) return;

    selectedFileId = fileId;

    root.innerHTML = `
      <div class="bp-editor-page bp-code-page">
        <div class="bp-code-top">
          <div class="bp-brand">
            <button class="bp-icon-btn" onclick="window.BuildPilot.backWorkspace()">←</button>
            <div>
              <div class="bp-code-path">${escapeHtml(file.file_path)}</div>
              <div class="bp-code-sub">${escapeHtml(file.language || "text")}</div>
            </div>
          </div>
          <div class="bp-actions">
            <button class="bp-btn bp-btn-soft" onclick="window.BuildPilot.backWorkspace()">Cancel</button>
            <button id="saveFileButton" class="bp-btn bp-btn-primary"
              onclick="window.BuildPilot.saveFile('${escapeAttribute(file.id)}')">💾 Save</button>
          </div>
        </div>

        <div class="bp-code-layout">
          <div class="bp-code-gutter" id="codeGutter"></div>
          <textarea id="fileEditor" class="bp-editor" spellcheck="false"
            autocapitalize="off" autocomplete="off" autocorrect="off">${escapeHtml(file.file_content || "")}</textarea>
        </div>
        <div class="bp-code-status">
          <span>UTF-8</span><span>${escapeHtml(file.language || "Plain Text")}</span>
          <span id="editorLineCount"></span>
        </div>
      </div>
    `;

    const editor = document.getElementById("fileEditor");
    const gutter = document.getElementById("codeGutter");
    const count = document.getElementById("editorLineCount");

    const sync = () => {
      const lines = editor.value.split("\n").length;
      gutter.textContent = Array.from({length:lines}, (_,i)=>String(i+1)).join("\n");
      count.textContent = `${editor.value.length} chars · ${lines} lines`;
      gutter.scrollTop = editor.scrollTop;
    };
    editor.addEventListener("input", sync);
    editor.addEventListener("scroll", () => { gutter.scrollTop = editor.scrollTop; });
    editor.addEventListener("keydown", e => {
      if (e.key === "Tab") {
        e.preventDefault();
        const a = editor.selectionStart, b = editor.selectionEnd;
        editor.value = editor.value.slice(0,a) + "  " + editor.value.slice(b);
        editor.selectionStart = editor.selectionEnd = a + 2;
        sync();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveFile(file.id);
      }
    });
    sync();
    editor.focus();
  }

async function saveFile(fileId) {
    const editor = document.getElementById("fileEditor");
    const button = document.getElementById("saveFileButton");
    if (!editor || !activeProject || !fileId) return;

    setButtonLoading(button, true, "Saving...");
    try {
      const { error } = await client.from("project_files")
        .update({ file_content: editor.value })
        .eq("id", fileId)
        .eq("project_id", activeProject.id);

      if (error) throw error;

      await loadProjectFiles();
      selectedFileId = fileId;
      showToast("File saved", "success");
      openWorkspace(activeProject.id);
    } catch (error) {
      console.error(error);
      showToast(error.message || "Could not save file", "error");
    } finally {
      setButtonLoading(button, false);
    }
  }


  function backWorkspace() {
    if (
      activeProject
    ) {
      openWorkspace(
        activeProject.id
      );
    } else {
      renderHome();
    }
  }

  /* =========================================================
     PUBLISH PROJECT
     ========================================================= */

  async function togglePublish() {
    if (!activeProject) {
      return;
    }

    try {
      const newState =
        !Boolean(
          activeProject.public_enabled
        );

      /*
       * Generate public UUID on client.
       * This is NOT generated_by.
       */
      let publicId =
        activeProject.public_id;

      if (!publicId) {
        publicId =
          crypto.randomUUID();
      }

      const {
        data,
        error,
      } =
        await client
          .from("projects")
          .update({
            public_id:
              publicId,

            public_enabled:
              newState,

            published_at:
              newState
                ? new Date().toISOString()
                : null,
          })
          .eq(
            "id",
            activeProject.id
          )
          .eq(
            "user_id",
            activeUser.id
          )
          .select(
            `
            id,
            name,
            description,
            frontend,
            backend,
            project_plan,
            public_id,
            public_enabled,
            published_at,
            status
            `
          )
          .single();

      if (error) {
        throw error;
      }

      activeProject =
        data;

      if (newState) {
        const link =
          createPublicLink(
            data.public_id
          );

        await copyText(
          link
        );

        showPublicModal(
          link
        );

      } else {
        showToast(
          "Public link disabled",
          "success"
        );

        openWorkspace(
          activeProject.id
        );
      }

    } catch (error) {
      console.error(error);

      showToast(
        error.message ||
          "Publish failed",
        "error"
      );
    }
  }

  async function copyPublicLink(
    publicId
  ) {
    if (!publicId) {
      showToast(
        "Public ID missing",
        "error"
      );

      return;
    }

    const link =
      createPublicLink(
        publicId
      );

    await copyText(
      link
    );

    showPublicModal(
      link
    );
  }

  function showPublicModal(
    link
  ) {
    const old =
      document.getElementById(
        "bpPublicModal"
      );

    if (old) {
      old.remove();
    }

    const modal =
      document.createElement(
        "div"
      );

    modal.id =
      "bpPublicModal";

    modal.className =
      "bp-modal";

    modal.innerHTML = `
      <div class="bp-modal-card">

        <div style="
          font-size:45px;
          margin-bottom:10px;
        ">
          🎉
        </div>

        <h2 style="
          margin:0 0 8px;
        ">
          Project Published
        </h2>

        <p style="
          color:#64748b;
          line-height:1.6;
        ">
          यह link किसी को भी share कर सकते हैं।
          Viewer को BuildPilot login की जरूरत नहीं होगी।
        </p>

        <input
          id="publicLinkInput"
          class="bp-public-link"
          readonly
          value="${escapeAttribute(
            link
          )}"
        />

        <div class="bp-actions"
          style="
            margin-top:15px;
          "
        >

          <button
            class="bp-btn bp-btn-primary"
            onclick="
              window.BuildPilot.copyCurrentPublicLink()
            "
          >
            📋 Copy Link
          </button>

          <button
            class="bp-btn"
            onclick="
              window.open(
                '${escapeAttribute(
                  link
                )}',
                '_blank'
              )
            "
          >
            ↗ Open
          </button>

          <button
            class="bp-btn"
            onclick="
              document
                .getElementById(
                  'bpPublicModal'
                )
                .remove()
            "
          >
            Close
          </button>

        </div>

      </div>
    `;

    document.body.appendChild(
      modal
    );

    window.__buildpilotPublicLink =
      link;
  }

  async function copyCurrentPublicLink() {
    const link =
      window.__buildpilotPublicLink;

    if (!link) {
      return;
    }

    await copyText(
      link
    );

    showToast(
      "Public link copied",
      "success"
    );
  }


  /* =========================================================
     FILES / IMAGES / PROJECT TOOLS
     ========================================================= */

  function clearChat() {
    const box = document.getElementById("chatMessages");
    if (box) box.innerHTML = "";
  }

  function renderAttachmentPreview() {
    const box = document.getElementById("aiAttachmentPreview");
    if (!box) return;
    if (!pendingAIImage) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = `
      <div class="bp-attachment">
        ${pendingAIImage.preview ? `<img src="${escapeAttribute(pendingAIImage.preview)}" alt="">` : ""}
        <span style="flex:1">${escapeHtml(pendingAIImage.name || "Reference image")}</span>
        <button class="bp-mini-btn" onclick="window.BuildPilot.removeAIImage()">Remove</button>
      </div>`;
  }

  function removeAIImage() {
    pendingAIImage = null;
    renderAttachmentPreview();
  }

  async function handleAIImageUpload(event) {
    const file = event.target?.files?.[0];
    if (!file || !activeUser) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please select an image", "error");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast("Image must be under 8 MB", "error");
      return;
    }

    try {
      showToast("Uploading image...");
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${activeUser.id}/references/${Date.now()}-${crypto.randomUUID()}.${ext}`;

      const { error } = await client.storage.from("uploads").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type
      });
      if (error) throw error;

      let imageUrl = "";
      const publicResult = client.storage.from("uploads").getPublicUrl(path);
      imageUrl = publicResult?.data?.publicUrl || "";

      /* If the bucket is private, try a short-lived signed URL. */
      if (!imageUrl) {
        const signed = await client.storage.from("uploads").createSignedUrl(path, 3600);
        imageUrl = signed?.data?.signedUrl || "";
      }

      const preview = URL.createObjectURL(file);

      pendingAIImage = {
        name: file.name,
        path,
        url: imageUrl,
        preview
      };
      renderAttachmentPreview();
      showToast("Image uploaded", "success");
    } catch (error) {
      console.error(error);
      showToast(
        "Image upload failed. Check the Supabase Storage 'uploads' bucket and policy.",
        "error"
      );
    } finally {
      if (event.target) event.target.value = "";
    }
  }

  async function generateImage() {
    if (!activeProject?.id) {
      showToast("Open a project first", "error");
      return;
    }

    const prompt = document.getElementById("aiInstruction")?.value.trim() || "Create a professional website hero image matching this project.";
    appendChat("You", `Generate image: ${prompt}`, "user");

    try {
      setButtonLoading(document.getElementById("aiSendButton"), true, "...");
      const result = await callGenerateFunction(
        activeProject.id,
        prompt,
        activeProject.name,
        activeProject.frontend,
        activeProject.backend,
        {
          action: "generate_image",
          imagePrompt: prompt
        }
      );

      const imageUrl =
        result?.imageUrl ||
        result?.url ||
        result?.image?.url ||
        result?.data?.imageUrl ||
        result?.data?.url;

      if (!imageUrl) {
        throw new Error(
          result?.message ||
          "Image generation endpoint did not return imageUrl."
        );
      }

      generatedImages.push(imageUrl);
      pendingAIImage = {
        name: "AI generated image",
        url: imageUrl,
        preview: imageUrl
      };
      renderAttachmentPreview();
      appendChat("AI Builder", "Image generated. Send your next instruction to place it in the website.", "ai");
      showToast("Image generated", "success");
    } catch (error) {
      console.error(error);
      appendChat("AI Builder", error.message || "Image generation failed", "error");
      showToast(error.message || "Image generation failed", "error");
    } finally {
      setButtonLoading(document.getElementById("aiSendButton"), false);
    }
  }

  async function openFileCreator() {
    const old = document.getElementById("bpFileModal");
    if (old) old.remove();

    const modal = document.createElement("div");
    modal.id = "bpFileModal";
    modal.className = "bp-modal";
    modal.innerHTML = `
      <div class="bp-modal-card" style="max-width:520px">
        <h2 style="margin-top:0">Create file</h2>
        <p style="color:#64748b">Add a new file to this project.</p>
        <div class="bp-field">
          <label class="bp-label">File path</label>
          <input id="newFilePath" class="bp-input" placeholder="components/header.html">
        </div>
        <div class="bp-field">
          <label class="bp-label">Language</label>
          <select id="newFileLanguage" class="bp-select">
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="javascript">JavaScript</option>
            <option value="json">JSON</option>
            <option value="text">Text</option>
          </select>
        </div>
        <div class="bp-actions">
          <button class="bp-btn" onclick="document.getElementById('bpFileModal').remove()">Cancel</button>
          <button class="bp-btn bp-btn-primary" onclick="window.BuildPilot.createFile()">Create</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  async function createFile() {
    const path = document.getElementById("newFilePath")?.value.trim();
    const language = document.getElementById("newFileLanguage")?.value || "text";
    if (!activeProject?.id || !path) {
      showToast("File path required", "error");
      return;
    }
    if (!/^[A-Za-z0-9_./-]+$/.test(path) || path.startsWith("/") || path.includes("..")) {
      showToast("Use a safe relative file path", "error");
      return;
    }

    try {
      const exists = activeFiles.some(f => f.file_path.toLowerCase() === path.toLowerCase());
      if (exists) throw new Error("A file with this name already exists.");

      const starter = language === "html"
        ? `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${escapeHtml(activeProject.name)}</title>\n</head>\n<body>\n</body>\n</html>`
        : language === "css" ? `/* ${path} */\n` : language === "javascript" ? `// ${path}\n` : "";

      const { error } = await client.from("project_files").insert({
        project_id: activeProject.id,
        file_path: path,
        file_content: starter,
        language
      });
      if (error) throw error;

      document.getElementById("bpFileModal")?.remove();
      await loadProjectFiles();
      renderFilesList();
      showToast("File created", "success");
    } catch (error) {
      showToast(error.message || "Could not create file", "error");
    }
  }

  async function deleteFile(fileId) {
    const file = activeFiles.find(f => f.id === fileId);
    if (!file) return;
    if (file.file_path.toLowerCase() === "index.html") {
      showToast("index.html cannot be deleted", "error");
      return;
    }
    if (!confirm(`Delete ${file.file_path}?`)) return;

    try {
      const { error } = await client.from("project_files")
        .delete().eq("id", fileId).eq("project_id", activeProject.id);
      if (error) throw error;
      await loadProjectFiles();
      selectedFileId = null;
      renderFilesList();
      updatePreview();
      showToast("File deleted", "success");
    } catch (error) {
      showToast(error.message || "Could not delete file", "error");
    }
  }

  function showProjectInfo() {
    if (!activeProject) return;
    const old = document.getElementById("bpInfoModal");
    if (old) old.remove();

    const modal = document.createElement("div");
    modal.id = "bpInfoModal";
    modal.className = "bp-modal";
    modal.innerHTML = `
      <div class="bp-modal-card">
        <h2 style="margin-top:0">${escapeHtml(activeProject.name)}</h2>
        <p style="color:#64748b;line-height:1.6">${escapeHtml(activeProject.description || "No description")}</p>
        <div class="bp-two-col">
          <div><strong>Frontend</strong><div>${escapeHtml(activeProject.frontend || "-")}</div></div>
          <div><strong>Backend</strong><div>${escapeHtml(activeProject.backend || "-")}</div></div>
        </div>
        <div class="bp-actions" style="margin-top:20px">
          <button class="bp-btn" onclick="document.getElementById('bpInfoModal').remove()">Close</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  /* =========================================================
     ADMIN PANEL
     ========================================================= */

  async function requireAdmin() {
    await getSession();
    await ensureProfile();
    if (!activeUser || activeProfile?.role !== "admin") {
      showToast("Admin access required", "error");
      return false;
    }
    return true;
  }

  async function admin() {
    if (!(await requireAdmin())) return;

    root.innerHTML = `
      <div class="bp-app">
        <header class="bp-topbar">
          <div class="bp-brand"><div class="bp-logo">⚡</div><span>Admin</span></div>
          <div class="bp-actions">
            <button class="bp-btn" onclick="window.BuildPilot.home()">← App</button>
            <button class="bp-btn" onclick="window.BuildPilot.loadAdmin()">↻ Refresh</button>
          </div>
        </header>
        <main class="bp-main">
          <section class="bp-hero" style="padding-top:10px">
            <h1 style="font-size:38px">Admin Panel</h1>
            <p>Users, limits, projects and account status.</p>
          </section>
          <div id="adminContent"><div class="bp-card">Loading...</div></div>
        </main>
      </div>`;
    await loadAdmin();
  }

  async function loadAdmin() {
    if (!(await requireAdmin())) return;
    const box = document.getElementById("adminContent");
    if (!box) return;

    try {
      const [profilesRes, projectsRes] = await Promise.all([
        client.from("profiles").select("id,full_name,role,status,plan,project_limit,github_file_limit").order("full_name"),
        client.from("projects").select("id,user_id,name,status,created_at,public_enabled").order("created_at",{ascending:false}).limit(100)
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (projectsRes.error) throw projectsRes.error;

      const users = profilesRes.data || [];
      const projects = projectsRes.data || [];

      box.innerHTML = `
        <div class="bp-builder-grid">
          <div class="bp-card"><div class="bp-card-icon">👥</div><h3>${users.length}</h3><p>Total users</p></div>
          <div class="bp-card"><div class="bp-card-icon">🧩</div><h3>${projects.length}</h3><p>Recent projects</p></div>
          <div class="bp-card"><div class="bp-card-icon">🚫</div><h3>${users.filter(u=>u.status==="blocked").length}</h3><p>Blocked users</p></div>
          <div class="bp-card"><div class="bp-card-icon">⭐</div><h3>${users.filter(u=>u.plan && u.plan!=="free").length}</h3><p>Paid/custom plans</p></div>
        </div>

        <section class="bp-section">
          <div class="bp-card">
            <h2 style="margin-top:0">Users</h2>
            <div style="overflow:auto">
              <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead><tr>
                  <th style="text-align:left;padding:10px;border-bottom:1px solid #e2e8f0">Name</th>
                  <th style="text-align:left;padding:10px;border-bottom:1px solid #e2e8f0">Role</th>
                  <th style="text-align:left;padding:10px;border-bottom:1px solid #e2e8f0">Status</th>
                  <th style="text-align:left;padding:10px;border-bottom:1px solid #e2e8f0">Plan</th>
                  <th style="text-align:left;padding:10px;border-bottom:1px solid #e2e8f0">Limits</th>
                  <th style="padding:10px;border-bottom:1px solid #e2e8f0">Action</th>
                </tr></thead>
                <tbody>
                  ${users.map(u=>`
                    <tr>
                      <td style="padding:10px;border-bottom:1px solid #f1f5f9">${escapeHtml(u.full_name || u.id)}</td>
                      <td style="padding:10px;border-bottom:1px solid #f1f5f9">${escapeHtml(u.role || "user")}</td>
                      <td style="padding:10px;border-bottom:1px solid #f1f5f9">${escapeHtml(u.status || "active")}</td>
                      <td style="padding:10px;border-bottom:1px solid #f1f5f9">${escapeHtml(u.plan || "free")}</td>
                      <td style="padding:10px;border-bottom:1px solid #f1f5f9">${escapeHtml(String(u.project_limit ?? 5))} projects / ${escapeHtml(String(u.github_file_limit ?? 2))} files</td>
                      <td style="padding:10px;border-bottom:1px solid #f1f5f9">
                        <button class="bp-btn ${u.status==="blocked"?"bp-btn-success":"bp-btn-danger"}"
                          onclick="window.BuildPilot.toggleUser('${escapeAttribute(u.id)}','${u.status==="blocked"?"active":"blocked"}')">
                          ${u.status==="blocked"?"Reactivate":"Block"}
                        </button>
                      </td>
                    </tr>`).join("")}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      `;
    } catch (error) {
      console.error(error);
      box.innerHTML = `<div class="bp-card"><h3>Admin data unavailable</h3><p style="color:#b91c1c">${escapeHtml(error.message || "Could not load admin data")}</p><p style="color:#64748b;font-size:13px">Your Supabase RLS policies must allow admin users to read/update the required rows.</p></div>`;
    }
  }

  async function toggleUser(userId, status) {
    if (!(await requireAdmin())) return;
    try {
      const { error } = await client.from("profiles").update({ status }).eq("id", userId);
      if (error) throw error;
      showToast(status === "blocked" ? "User blocked" : "User reactivated", "success");
      await loadAdmin();
    } catch (error) {
      showToast(error.message || "Could not update user", "error");
    }
  }

  /* =========================================================
     PUBLIC PROJECT
     ========================================================= */

  async function loadPublicProject(
    publicId
  ) {
    root.innerHTML = `
      <div class="bp-auth-page">

        <div class="bp-auth-card"
          style="
            text-align:center;
          "
        >

          <div class="bp-auth-logo">
            ⚡
          </div>

          <h2 class="bp-auth-title">
            Loading website
          </h2>

          <p class="bp-auth-subtitle">
            Loading public project...
          </p>

        </div>

      </div>
    `;

    try {
      /*
       * Public function is intentionally called
       * directly because visitor has no login session.
       */
      const response =
        await fetch(
          SUPABASE_URL +
            "/functions/v1/" +
            encodeURIComponent(
              PUBLIC_FUNCTION
            ) +
            "?id=" +
            encodeURIComponent(
              publicId
            ),
          {
            method:
              "GET",

            headers: {
              apikey:
                SUPABASE_KEY,

              "Content-Type":
                "application/json",
            },
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Public project unavailable"
        );
      }

      /*
       * IMPORTANT:
       * Do NOT replace the complete document here.
       * Keep BuildPilot wrapper and put the project
       * into an iframe.
       */
      renderPublicPreview(
        data
      );

    } catch (error) {
      console.error(error);

      root.innerHTML = `
        <div class="bp-auth-page">

          <div class="bp-auth-card"
            style="
              text-align:center;
            "
          >

            <div
              class="bp-auth-logo"
              style="
                background:#fee2e2;
                color:#b91c1c;
              "
            >
              !
            </div>

            <h2 class="bp-auth-title">
              Website unavailable
            </h2>

            <p class="bp-auth-subtitle">
              This website is not published or the link is invalid.
            </p>

            <div style="
              padding:12px;
              background:#fef2f2;
              border-radius:10px;
              color:#991b1b;
              font-size:13px;
            ">
              ${escapeHtml(
                error.message
              )}
            </div>

          </div>

        </div>
      `;
    }
  }

function renderPublicPreview(data) {
    const project = data?.project || {};
    const html = String(data?.html || "");

    root.innerHTML = `
      <div class="bp-public-shell">
        <div id="publicProjectMount" class="bp-public-mount"></div>
      </div>
    `;

    const mount = document.getElementById("publicProjectMount");
    if (!mount) return;

    const iframe = document.createElement("iframe");
    iframe.id = "publicPreviewFrame";
    iframe.className = "bp-public-frame";
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-forms allow-modals allow-popups allow-downloads"
    );
    iframe.title = project.name || "Published website";
    iframe.srcdoc = html || `
      <!doctype html><html><body style="font-family:system-ui;padding:40px">
      <h1>Website unavailable</h1><p>No published HTML was returned.</p>
      </body></html>`;
    mount.appendChild(iframe);
  }


  /* =========================================================
     AUTH STATE
     ========================================================= */

  client.auth.onAuthStateChange(
    (_event, session) => {
      activeSession =
        session || null;

      activeUser =
        session?.user || null;
    }
  );

  /* =========================================================
     GLOBAL API
     ========================================================= */

  window.BuildPilot = {
    showLogin:
      () =>
        renderAuth(
          "login"
        ),

    showSignup:
      () =>
        renderAuth(
          "signup"
        ),

    login:
      loginUser,

    signup:
      signupUser,

    logout:
      logoutUser,

    home:
      renderHome,

    startProject:
      startProject,

    createProject:
      createProject,

    loadProjects:
      loadProjects,

    openProject:
      openProject,

    refreshFiles:
      refreshFiles,

    updatePreview:
      updatePreview,

    editFile:
      editFile,

    saveFile:
      saveFile,

    backWorkspace:
      backWorkspace,

    togglePublish:
      togglePublish,

    copyPublicLink:
      copyPublicLink,

    copyCurrentPublicLink:
      copyCurrentPublicLink,

    clearChat,
    openFileCreator,
    createFile,
    deleteFile,
    handleAIImageUpload,
    removeAIImage,
    generateImage,
    showProjectInfo,
    admin,
    loadAdmin,
    toggleUser,
  };

  /* =========================================================
     BOOT
     ========================================================= */

  async function boot() {
    const publicId =
      getPublicIdFromUrl();

    /*
     * Public page does NOT require login.
     */
    if (publicId) {
      await loadPublicProject(
        publicId
      );

      return;
    }

    await getSession();

    if (activeUser) {
      await ensureProfile();

      await renderHome();
    } else {
      renderAuth(
        "login"
      );
    }
  }

  boot();

})();
