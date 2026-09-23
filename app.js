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


      /* =====================================================
         AIRO-STYLE BUILDER WORKSPACE
         ===================================================== */

      .bp-airo-workspace {
        min-height: calc(100vh - 70px);
        background: #f3f4f6;
        padding: 0;
      }

      .bp-airo-topbar {
        height: 48px;
        background: #ffffff;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 14px;
        gap: 12px;
      }

      .bp-airo-tabs {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .bp-airo-tab {
        border: 0;
        background: transparent;
        color: #475569;
        padding: 8px 13px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 700;
        font-size: 13px;
      }

      .bp-airo-tab.active {
        background: #111827;
        color: #ffffff;
      }

      .bp-airo-top-actions {
        display: flex;
        align-items: center;
        gap: 7px;
      }

      .bp-icon-btn {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        color: #334155;
        border-radius: 9px;
        cursor: pointer;
      }

      .bp-airo-banner {
        height: 34px;
        background: #6841ad;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        font-size: 13px;
        font-weight: 600;
      }

      .bp-airo-banner a {
        color: #ffffff;
        text-decoration: underline;
      }

      .bp-airo-body {
        height: calc(100vh - 152px);
        min-height: 600px;
        display: grid;
        grid-template-columns: 350px minmax(0, 1fr);
        gap: 0;
      }

      .bp-airo-left {
        background: #f8fafc;
        border-right: 1px solid #dfe3e8;
        display: flex;
        flex-direction: column;
        min-width: 0;
        overflow: hidden;
      }

      .bp-airo-left-head {
        min-height: 58px;
        padding: 11px 14px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        background: #ffffff;
      }

      .bp-airo-brand {
        font-weight: 900;
        font-size: 20px;
        letter-spacing: -1px;
      }

      .bp-airo-brand span {
        background: #6d49c7;
        color: #ffffff;
        border-radius: 4px;
        padding: 2px 5px;
        font-size: 9px;
        vertical-align: middle;
        letter-spacing: 0;
      }

      .bp-builder-tabs {
        display: flex;
        border-bottom: 1px solid #e5e7eb;
        background: #ffffff;
      }

      .bp-builder-tab {
        flex: 1;
        border: 0;
        background: transparent;
        padding: 11px 8px;
        color: #64748b;
        cursor: pointer;
        font-weight: 700;
        font-size: 13px;
      }

      .bp-builder-tab.active {
        color: #111827;
        box-shadow: inset 0 -2px #111827;
      }

      .bp-builder-content {
        flex: 1;
        min-height: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .bp-builder-view {
        display: none;
        height: 100%;
        min-height: 0;
        flex-direction: column;
      }

      .bp-builder-view.active {
        display: flex;
      }

      .bp-airo-chat-title {
        padding: 16px 16px 7px;
        font-size: 15px;
        font-weight: 800;
      }

      .bp-airo-chat-subtitle {
        padding: 0 16px 12px;
        color: #64748b;
        font-size: 12px;
      }

      .bp-chat-messages {
        background: #f8fafc;
      }

      .bp-airo-input-wrap {
        margin: 10px;
        background: #ffffff;
        border: 1px solid #d8dee8;
        border-radius: 15px;
        padding: 10px;
        box-shadow: 0 3px 15px rgba(15,23,42,.06);
      }

      .bp-airo-input-wrap .bp-textarea {
        border: 0;
        box-shadow: none;
        resize: none;
        min-height: 92px;
      }

      .bp-airo-input-bottom {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-top: 4px;
      }

      .bp-airo-input-tools {
        display: flex;
        gap: 5px;
      }

      .bp-mini-btn {
        width: 31px;
        height: 31px;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        border-radius: 8px;
        cursor: pointer;
      }

      .bp-send-btn {
        width: 34px;
        height: 34px;
        border: 0;
        border-radius: 9px;
        background: #c9b8e9;
        color: #ffffff;
        cursor: pointer;
        font-size: 17px;
      }

      .bp-airo-files {
        flex: 1;
        overflow: auto;
        padding: 10px;
      }

      .bp-airo-preview {
        min-width: 0;
        background: #e9eaec;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .bp-airo-preview-head {
        min-height: 44px;
        background: #ffffff;
        border-bottom: 1px solid #dfe3e8;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 10px;
        gap: 8px;
      }

      .bp-device-tools {
        display: flex;
        gap: 5px;
        align-items: center;
      }

      .bp-preview-canvas {
        flex: 1;
        min-height: 0;
        padding: 10px;
        overflow: auto;
        display: flex;
        justify-content: center;
      }

      .bp-preview-browser {
        width: 100%;
        max-width: 1500px;
        height: 100%;
        min-height: 560px;
        background: #ffffff;
        border: 1px solid #d9dde3;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 10px 35px rgba(15,23,42,.08);
      }

      .bp-preview-browser iframe {
        width: 100%;
        height: 100%;
        min-height: 560px;
        border: 0;
        display: block;
        background: #ffffff;
      }

      .bp-preview-floating {
        position: absolute;
        left: 50%;
        bottom: 18px;
        transform: translateX(-50%);
        display: flex;
        gap: 2px;
        padding: 4px;
        background: rgba(255,255,255,.96);
        border: 1px solid #d9dde3;
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(15,23,42,.14);
        z-index: 10;
      }

      .bp-preview-relative {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
      }

      .bp-file-row-actions {
        display: flex;
        align-items: center;
        gap: 3px;
      }

      .bp-file-row {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 3px;
      }

      .bp-file-row .bp-file {
        flex: 1;
      }

      .bp-file-delete {
        width: 28px;
        height: 28px;
        border: 0;
        background: transparent;
        color: #94a3b8;
        border-radius: 7px;
        cursor: pointer;
      }

      .bp-file-delete:hover {
        background: #fee2e2;
        color: #b91c1c;
      }

      /* Public site must be ONLY the generated website. */
      .bp-public-site-shell {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        background: #ffffff;
        overflow: hidden;
      }

      .bp-public-site-frame {
        width: 100%;
        height: 100%;
        min-height: 100vh;
        border: 0;
        display: block;
        background: #ffffff;
      }


      @media (max-width: 950px) {
        .bp-airo-body {
          grid-template-columns: 300px minmax(0,1fr);
        }
      }

      @media (max-width: 760px) {
        .bp-airo-body {
          grid-template-columns: 1fr;
          grid-template-rows: 48% 52%;
        }

        .bp-airo-left {
          border-right: 0;
          border-bottom: 1px solid #dfe3e8;
        }

        .bp-airo-banner {
          font-size: 11px;
          padding: 0 8px;
          text-align: center;
        }
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
      return;
    }

    const {
      data,
      error,
    } = await client
      .from("profiles")
      .select("id")
      .eq(
        "id",
        activeUser.id
      )
      .maybeSingle();

    if (error) {
      console.error(
        "Profile check:",
        error
      );

      return;
    }

    if (data) {
      return;
    }

    const {
      error: insertError,
    } = await client
      .from("profiles")
      .insert({
        id: activeUser.id,

        full_name:
          activeUser
            .user_metadata
            ?.full_name ||
          activeUser.email ||
          "User",
      });

    if (insertError) {
      console.error(
        "Profile create:",
        insertError
      );
    }
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

  async function callGenerateFunction(
    projectId,
    instruction,
    projectName,
    frontend,
    backend
  ) {
    await getSession();

    if (!activeSession) {
      throw new Error(
        "Your login session expired. Please login again."
      );
    }

    const {
      data,
      error,
    } =
      await client.functions.invoke(
        GENERATE_FUNCTION,
        {
          headers: {
            Authorization:
              "Bearer " +
              activeSession.access_token,
          },

          body: {
            projectId,

            instruction,

            /*
             * Compatibility fields.
             */
            prompt:
              instruction,

            projectName,

            frontend,

            backend,
          },
        }
      );

    if (error) {
      console.error(
        "Edge Function error:",
        error
      );

      throw new Error(
        error.message ||
          "AI function failed"
      );
    }

    if (
      data &&
      data.success === false
    ) {
      throw new Error(
        data.error ||
          "AI generation failed"
      );
    }

    return (
      data || {
        success: true,
      }
    );
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

  function openWorkspace(
    projectId
  ) {
    root.innerHTML = `
      <div class="bp-app">

        <header class="bp-topbar">

          <div class="bp-brand">

            <button
              class="bp-btn"
              style="
                background:transparent;
                color:white;
                border-color:#475569;
                margin-right:5px;
              "
              onclick="window.BuildPilot.home()"
              title="Projects"
            >
              ←
            </button>

            <div class="bp-logo">
              ⚡
            </div>

            <span>
              ${escapeHtml(
                activeProject?.name ||
                  "Project"
              )}
            </span>

          </div>

          <div class="bp-actions">
            <button
              class="bp-btn"
              style="
                background:transparent;
                color:white;
                border-color:#475569;
              "
              onclick="window.BuildPilot.refreshFiles()"
            >
              ↻ Refresh
            </button>

            <button
              id="publishButton"
              class="bp-btn bp-btn-success"
              onclick="window.BuildPilot.togglePublish()"
            >
              ${
                activeProject?.public_enabled
                  ? "🔗 Public Link"
                  : "🚀 Publish"
              }
            </button>
          </div>

        </header>

        <main class="bp-airo-workspace">

          <div class="bp-airo-topbar">

            <div class="bp-airo-tabs">
              <button class="bp-airo-tab active" type="button">
                ▣&nbsp; Website
              </button>

              <button
                class="bp-airo-tab"
                type="button"
                onclick="window.BuildPilot.showToast('Domain settings are ready for the published site.')"
              >
                ◉&nbsp; Domain
              </button>
            </div>

            <div class="bp-airo-top-actions">
              <button
                class="bp-icon-btn"
                type="button"
                title="Share"
                onclick="window.BuildPilot.shareProject()"
              >
                ⤴
              </button>

              <button
                class="bp-btn bp-btn-success"
                type="button"
                onclick="window.BuildPilot.togglePublish()"
              >
                ${
                  activeProject?.public_enabled
                    ? "Published"
                    : "Publish"
                }
              </button>
            </div>

          </div>

          <div class="bp-airo-banner">
            <span>●</span>
            <span>
              You currently have a free site. Pick a plan to use premium features.
            </span>
            <a href="#" onclick="event.preventDefault();window.BuildPilot.showToast('Plans will be available here.')">
              View Plans →
            </a>
          </div>

          <div class="bp-airo-body">

            <aside class="bp-airo-left">

              <div class="bp-airo-left-head">
                <div class="bp-airo-brand">
                  AI Builder
                </div>

                <button
                  class="bp-icon-btn"
                  type="button"
                  title="Project files"
                  onclick="window.BuildPilot.switchBuilderTab('files')"
                >
                  ☷
                </button>
              </div>

              <div class="bp-builder-tabs">
                <button
                  id="builderAiTab"
                  class="bp-builder-tab active"
                  type="button"
                  onclick="window.BuildPilot.switchBuilderTab('ai')"
                >
                  ✨ AI Builder
                </button>

                <button
                  id="builderFilesTab"
                  class="bp-builder-tab"
                  type="button"
                  onclick="window.BuildPilot.switchBuilderTab('files')"
                >
                  Files (${activeFiles.length})
                </button>
              </div>

              <div class="bp-builder-content">

                <section
                  id="builderAiView"
                  class="bp-builder-view active"
                >

                  <div class="bp-airo-chat-title">
                    Continue building
                  </div>

                  <div class="bp-airo-chat-subtitle">
                    Ask AI to change anything in your website.
                  </div>

                  <div
                    id="chatMessages"
                    class="bp-chat-messages"
                    style="flex:1;overflow:auto;padding:10px 14px;"
                  >
                    <div class="bp-chat-message bp-chat-ai">
                      <strong>AI Builder</strong>
                      <div style="margin-top:5px;">
                        Tell me what you want to change in your website.
                      </div>
                    </div>
                  </div>

                  <div class="bp-airo-input-wrap">
                    <form id="aiChatForm">

                      <textarea
                        id="aiInstruction"
                        class="bp-textarea"
                        rows="4"
                        placeholder="Ask AI to edit your website..."
                      ></textarea>

                      <div class="bp-airo-input-bottom">
                        <div class="bp-airo-input-tools">
                          <button
                            class="bp-mini-btn"
                            type="button"
                            title="Add file"
                            onclick="window.BuildPilot.switchBuilderTab('files')"
                          >
                            ＋
                          </button>

                          <button
                            class="bp-mini-btn"
                            type="button"
                            title="Voice"
                            onclick="window.BuildPilot.showToast('Voice input can be connected here.')"
                          >
                            ♫
                          </button>
                        </div>

                        <button
                          id="aiSendButton"
                          class="bp-send-btn"
                          type="submit"
                          title="Send"
                        >
                          ↑
                        </button>
                      </div>

                    </form>
                  </div>

                </section>

                <section
                  id="builderFilesView"
                  class="bp-builder-view"
                >

                  <div style="padding:12px 14px;border-bottom:1px solid #e5e7eb;background:#fff;display:flex;justify-content:space-between;align-items:center;">
                    <strong>Project Files</strong>
                    <button class="bp-mini-btn" type="button" onclick="window.BuildPilot.newFile()">＋</button>
                  </div>

                  <div
                    id="filesList"
                    class="bp-airo-files"
                  ></div>

                </section>

              </div>

            </aside>

            <section class="bp-airo-preview">

              <div class="bp-airo-preview-head">

                <div style="font-size:13px;color:#64748b;font-weight:700;">
                  Live Preview
                </div>

                <div class="bp-device-tools">
                  <button class="bp-icon-btn" type="button" title="Refresh preview" onclick="window.BuildPilot.updatePreview()">
                    ↻
                  </button>

                  <button class="bp-icon-btn" type="button" title="Desktop" onclick="window.BuildPilot.setPreviewWidth('desktop')">
                    ▣
                  </button>

                  <button class="bp-icon-btn" type="button" title="Mobile" onclick="window.BuildPilot.setPreviewWidth('mobile')">
                    ▯
                  </button>

                  <button class="bp-icon-btn" type="button" title="Open preview" onclick="window.BuildPilot.openPreviewNewTab()">
                    ↗
                  </button>
                </div>

              </div>

              <div class="bp-preview-relative">
                <div
                  id="previewContent"
                  class="bp-preview-canvas"
                >
                  Loading...
                </div>

                <div class="bp-preview-floating">
                  <button class="bp-icon-btn" type="button" title="Edit with AI" onclick="window.BuildPilot.switchBuilderTab('ai')">✦</button>
                  <button class="bp-icon-btn" type="button" title="Refresh" onclick="window.BuildPilot.updatePreview()">↻</button>
                  <button class="bp-icon-btn" type="button" title="Open" onclick="window.BuildPilot.openPreviewNewTab()">↗</button>
                  <button class="bp-icon-btn" type="button" title="Fullscreen" onclick="window.BuildPilot.fullscreenPreview()">⛶</button>
                </div>
              </div>

            </section>

          </div>

        </main>

      </div>
    `;

    document
      .getElementById("aiChatForm")
      .addEventListener(
        "submit",
        submitAIInstruction
      );

    renderFilesList();
    updatePreview();
  }

  /* =========================================================
     BUILDER TABS / PREVIEW CONTROLS
     ========================================================= */

  function switchBuilderTab(tab) {
    const aiView = document.getElementById("builderAiView");
    const filesView = document.getElementById("builderFilesView");
    const aiTab = document.getElementById("builderAiTab");
    const filesTab = document.getElementById("builderFilesTab");

    if (!aiView || !filesView) return;

    const ai = tab !== "files";

    aiView.classList.toggle("active", ai);
    filesView.classList.toggle("active", !ai);

    aiTab?.classList.toggle("active", ai);
    filesTab?.classList.toggle("active", !ai);
  }

  function shareProject() {
    if (activeProject?.public_enabled && activeProject?.public_id) {
      copyPublicLink(activeProject.public_id);
      return;
    }

    showToast(
      "Publish the site first to create a shareable public link.",
      "info"
    );
  }

  function setPreviewWidth(mode) {
    const browser = document.querySelector(".bp-preview-browser");
    if (!browser) return;

    browser.style.maxWidth =
      mode === "mobile" ? "430px" : "1500px";
  }

  function openPreviewNewTab() {
    const html = buildPreviewHTML();
    if (!html) {
      showToast("Nothing to preview yet.", "error");
      return;
    }

    const blob = new Blob([html], {
      type: "text/html",
    });

    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");

    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function fullscreenPreview() {
    const browser = document.querySelector(".bp-preview-browser");
    if (!browser) return;

    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      return;
    }

    browser.requestFullscreen?.();
  }

  /* =========================================================
     FILE LIST
     ========================================================= */

  function renderFilesList() {
    const list =
      document.getElementById(
        "filesList"
      );

    if (!list) {
      return;
    }

    if (!activeFiles.length) {
      list.innerHTML = `
        <div style="
          padding:15px;
          color:#64748b;
          font-size:13px;
        ">
          No files found.
        </div>
      `;

      return;
    }

    list.innerHTML =
      activeFiles
        .map(
          (file) => `
            <button
              class="
                bp-file
                ${
                  selectedFileId ===
                  file.id
                    ? "bp-file-active"
                    : ""
                }
              "
              onclick="
                window.BuildPilot.editFile(
                  '${escapeAttribute(
                    file.id
                  )}'
                )
              "
            >
              ${
                file.file_path
                  .endsWith(
                    ".html"
                  )
                  ? "🌐"
                  : file.file_path.endsWith(
                      ".css"
                    )
                  ? "🎨"
                  : file.file_path.endsWith(
                      ".js"
                    )
                  ? "⚡"
                  : "📄"
              }

              &nbsp;

              ${escapeHtml(
                file.file_path
              )}
            </button>
          `
        )
        .join("");
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

  async function submitAIInstruction(
    event
  ) {
    if (
  !activeProject ||
  !activeProject.id ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(activeProject.id)
) {
  alert("Invalid project ID. Please create/select a valid project.");
  return;
}
    event.preventDefault();

    if (!activeProject) {
      showToast(
        "Open a project first",
        "error"
      );

      return;
    }

    const input =
      document.getElementById(
        "aiInstruction"
      );

    const button =
      document.getElementById(
        "aiSendButton"
      );

    const instruction =
      input.value.trim();

    if (!instruction) {
      return;
    }

    appendChat(
      "You",
      instruction,
      "user"
    );

    input.value = "";

    setButtonLoading(
      button,
      true,
      "AI is working..."
    );

    try {
      /*
       * Make sure index.html exists
       * before AI editing.
       */
      await ensureStarterFiles(
        activeProject.id,
        activeProject.name
      );

      await loadProjectFiles();

      const result =
        await callGenerateFunction(
          activeProject.id,
          instruction,
          activeProject.name,
          activeProject.frontend,
          activeProject.backend
        );

      await loadProjectFiles();

      renderFilesList();

      updatePreview();

      appendChat(
        "BuildPilot AI",
        result?.message ||
          "Project updated successfully.",
        "ai"
      );

      showToast(
        "Project updated",
        "success"
      );

    } catch (error) {
      console.error(error);

      appendChat(
        "BuildPilot AI",
        error.message ||
          "AI update failed",
        "error"
      );

      showToast(
        error.message ||
          "AI update failed",
        "error"
      );

    } finally {
      setButtonLoading(
        button,
        false
      );
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

  function editFile(
    fileId
  ) {
    const file =
      activeFiles.find(
        (item) =>
          item.id === fileId
      );

    if (!file) {
      return;
    }

    selectedFileId =
      fileId;

    root.innerHTML = `
      <div class="bp-editor-page">

        <div style="
          max-width:1250px;
          margin:auto;
        ">

          <div style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:15px;
            margin-bottom:15px;
          ">

            <div>

              <div style="
                color:#64748b;
                font-size:13px;
              ">
                Project File
              </div>

              <h2 style="
                margin:4px 0 0;
              ">
                ${escapeHtml(
                  file.file_path
                )}
              </h2>

            </div>

            <button
              class="bp-btn"
              onclick="
                window.BuildPilot.backWorkspace()
              "
            >
              ← Back
            </button>

          </div>

          <div class="bp-card">

            <textarea
              id="fileEditor"
              class="bp-editor"
              spellcheck="false"
            >${escapeHtml(
              file.file_content ||
                ""
            )}</textarea>

            <div style="
              display:flex;
              gap:8px;
              margin-top:12px;
            ">

              <button
                id="saveFileButton"
                class="bp-btn bp-btn-primary"
                onclick="
                  window.BuildPilot.saveFile(
                    '${escapeAttribute(
                      file.id
                    )}'
                  )
                "
              >
                💾 Save File
              </button>

              <button
                class="bp-btn"
                onclick="
                  window.BuildPilot.backWorkspace()
                "
              >
                Cancel
              </button>

            </div>

          </div>

        </div>

      </div>
    `;
  }

  async function saveFile(
    fileId
  ) {
    const editor =
      document.getElementById(
        "fileEditor"
      );

    const button =
      document.getElementById(
        "saveFileButton"
      );

    if (!editor) {
      return;
    }

    setButtonLoading(
      button,
      true,
      "Saving..."
    );

    try {
      /*
       * IMPORTANT:
       * generated_by is NOT sent because
       * your column is UUID.
       */
      const {
        error,
      } =
        await client
          .from("project_files")
          .update({
            file_content:
              editor.value,
          })
          .eq(
            "id",
            fileId
          )
          .eq(
            "project_id",
            activeProject.id
          );

      if (error) {
        throw error;
      }

      await loadProjectFiles();

      showToast(
        "File saved successfully",
        "success"
      );

      openWorkspace(
        activeProject.id
      );

    } catch (error) {
      console.error(error);

      showToast(
        error.message ||
          "Could not save file",
        "error"
      );
    } finally {
      setButtonLoading(
        button,
        false
      );
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
     PUBLIC PROJECT
     ========================================================= */

  async function loadPublicProject(
    publicId
  ) {
    root.innerHTML = `
      <div
        style="
          position:fixed;
          inset:0;
          display:flex;
          align-items:center;
          justify-content:center;
          background:#ffffff;
          font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        "
      >
        <div
          style="
            text-align:center;
            color:#475569;
          "
        >
          <div
            style="
              width:28px;
              height:28px;
              border:3px solid #e2e8f0;
              border-top-color:#64748b;
              border-radius:50%;
              animation:bpPublicSpin .8s linear infinite;
              margin:0 auto 14px;
            "
          ></div>
          <div style="font-size:14px;font-weight:600;">Loading website…</div>
        </div>
        <style>@keyframes bpPublicSpin{to{transform:rotate(360deg)}}</style>
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
       * PUBLIC MODE:
       * Render only the client's generated website.
       * The editor UI is never placed around it.
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
              Project unavailable
            </h2>

            <p class="bp-auth-subtitle">
              यह project publish नहीं किया गया है
              या public link invalid है।
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

  function cleanPublicHTML(html) {
    return String(html || "")
      .replaceAll("Your BuildPilot AI project is ready.", "Your website is ready.")
      .replaceAll("BuildPilot AI project is working!", "Your website is working!")
      .replaceAll("Published with BuildPilot AI", "")
      .replaceAll("Powered by BuildPilot AI", "")
      .replaceAll("Powered by BuildPilot", "")
      .replaceAll("Build with BuildPilot AI", "")
      .replaceAll("BuildPilot AI", "")
      .replaceAll("BuildPilot", "")
      .replaceAll("AI Builder", "")
      .replaceAll("Airo", "");
  }

  function renderPublicPreview(
    data
  ) {
    const html =
      cleanPublicHTML(
        data?.html || ""
      );

    /*
     * PUBLIC MODE:
     * The visitor must see ONLY the generated website.
     * No BuildPilot/Airo header, no AI panel,
     * no login UI, no editor controls and no ads.
     */
    document.title =
      data?.project?.name ||
      "Website";

    root.innerHTML = `
      <div class="bp-public-site-shell">
        <iframe
          id="publicPreviewFrame"
          class="bp-public-site-frame"
          title="Website Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads allow-presentation"
        ></iframe>
      </div>
    `;

    const iframe =
      document.getElementById(
        "publicPreviewFrame"
      );

    if (iframe) {
      iframe.srcdoc =
        html ||
        `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Website</title>
</head>
<body></body>
</html>`;
    }
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

    switchBuilderTab:
      switchBuilderTab,

    shareProject:
      shareProject,

    setPreviewWidth:
      setPreviewWidth,

    openPreviewNewTab:
      openPreviewNewTab,

    fullscreenPreview:
      fullscreenPreview,

    showToast:
      showToast,
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
