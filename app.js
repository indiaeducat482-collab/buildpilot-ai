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
    "super-function";

  const PUBLIC_FUNCTION =
    CONFIG.PUBLIC_FUNCTION_NAME ||
    "public-project";

  const root = document.getElementById("app");

  let activeUser = null;
  let activeSession = null;
  let activeProfile = null;

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
      .bp-editor-shell{min-height:100vh;background:#f4f5f7;color:#111827;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;flex-direction:column}
      .bp-editor-topbar{height:64px;background:#fff;border-bottom:1px solid #e4e6eb;display:flex;align-items:center;justify-content:space-between;padding:0 14px 0 10px;gap:12px;position:relative;z-index:30}
      .bp-editor-left-top,.bp-editor-right-top{display:flex;align-items:center;gap:7px}.bp-editor-icon-btn{width:42px;height:42px;border:1px solid transparent;background:#fff;border-radius:10px;font-size:18px;cursor:pointer;color:#111827}.bp-editor-icon-btn:hover{background:#f3f4f6;border-color:#e5e7eb}.bp-editor-tab{height:42px;border:0;background:#fff;border-radius:10px;padding:0 15px;font-size:14px;cursor:pointer}.bp-editor-tab.active{background:#111827;color:#fff;font-weight:700}.bp-editor-plus{border:0;background:#fff;font-size:25px;cursor:pointer;padding:3px 8px}.bp-editor-top-btn{border:1px solid #e2e4e8;background:#fff;border-radius:10px;padding:10px 14px;cursor:pointer;font-weight:650}.bp-editor-publish{border:0;background:#6540b7;color:#fff;border-radius:10px;padding:11px 17px;font-weight:800;cursor:pointer}
      .bp-editor-planbar{height:38px;background:#6540b7;color:#fff;display:flex;align-items:center;justify-content:center;gap:16px;font-size:13px}.bp-editor-planbar button{border:0;background:transparent;color:#fff;text-decoration:underline;font-weight:800;cursor:pointer}
      .bp-editor-body{display:grid;grid-template-columns:395px minmax(0,1fr);height:calc(100vh - 102px);min-height:620px}.bp-editor-panel{background:#f5f6f7;border-right:1px solid #dfe2e7;display:flex;flex-direction:column;min-width:0;position:relative;z-index:10}.bp-editor-panel-head{background:#fff;padding:16px 16px 13px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e4e6eb}.bp-editor-panel-head strong{display:block;font-size:15px}.bp-editor-panel-head small{display:block;color:#8a94a3;margin-top:3px}.bp-editor-close{border:0;background:#f2f3f5;border-radius:8px;width:34px;height:34px;font-size:21px;cursor:pointer}
      .bp-editor-credit-card{margin:12px;background:#fff;border:1px solid #e3e5e9;border-radius:14px;padding:12px;display:flex;align-items:center;gap:10px;box-shadow:0 2px 8px rgba(15,23,42,.04)}.bp-credit-icon{width:35px;height:35px;border-radius:9px;background:#f0eaff;color:#6945b9;display:grid;place-items:center}.bp-editor-credit-card strong{display:block;font-size:12px}.bp-editor-credit-card span{display:block;color:#8993a1;font-size:10px;margin-top:2px}.bp-editor-credit-card button{margin-left:auto;border:1px solid #d9d2eb;background:#f7f3ff;color:#5f3cab;border-radius:8px;padding:7px 9px;font-size:11px;cursor:pointer}
      .bp-editor-continue{margin:0 12px 10px;background:#fff;border:1px solid #e3e5e9;border-radius:14px;overflow:hidden}.bp-continue-head{display:flex;justify-content:space-between;padding:13px 14px;border-bottom:1px solid #e8eaee}.bp-continue-head span{font-size:11px;color:#6d49c7;font-weight:800}.bp-step{display:flex;gap:10px;align-items:center;padding:10px 14px;border-bottom:1px solid #edf0f3;font-size:12px;color:#4b5563}.bp-step:last-child{border-bottom:0}.bp-step b{width:20px;height:20px;border-radius:5px;background:#e9eaed;display:grid;place-items:center;font-size:10px;color:#475569}
      .bp-editor-tabs{display:flex;background:#fff;border-top:1px solid #e4e6eb;border-bottom:1px solid #e4e6eb}.bp-editor-tabs button{flex:1;border:0;background:#fff;padding:11px 4px;font-size:12px;color:#64748b;cursor:pointer}.bp-editor-tabs button.active{color:#111827;font-weight:800;box-shadow:inset 0 -2px #6540b7}.bp-editor-view{display:none;overflow:auto;flex:1;min-height:0}.bp-editor-view.active{display:block}.bp-ai-message{padding:14px}.bp-ai-message strong{display:block;font-size:13px}.bp-ai-message span{display:block;color:#64748b;font-size:12px;margin-top:5px;line-height:1.5}.bp-ai-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px}.bp-ai-chips button{border:1px solid #ddd7eb;background:#faf8ff;color:#5f3cab;border-radius:999px;padding:7px 9px;font-size:10px;cursor:pointer}.bp-editor-files{padding:8px}.bp-editor-files .bp-file{display:block;width:100%;text-align:left;border:0;background:transparent;border-radius:8px;padding:9px 10px;color:#475569;cursor:pointer}.bp-editor-files .bp-file:hover,.bp-editor-files .bp-file-active{background:#e9e7ee;color:#111827}.bp-editor-requests{padding:10px}.bp-editor-ask{margin-top:auto;background:#fff;border-top:1px solid #e2e5e9;padding:10px}.bp-editor-ask-input{width:100%;border:1px solid #d9dde3;border-radius:12px;resize:none;padding:10px 11px;outline:0;min-height:72px;font-size:13px}.bp-editor-ask-input:focus{border-color:#a98ed4;box-shadow:0 0 0 3px rgba(105,69,185,.08)}.bp-editor-ask-bottom{display:flex;justify-content:space-between;align-items:center;margin-top:5px}.bp-editor-small{border:0;background:#fff;font-size:22px;color:#64748b;cursor:pointer}.bp-editor-send{width:38px;height:38px;border:0;border-radius:11px;background:#c1addd;color:#fff;font-size:20px;cursor:pointer}.bp-editor-ask small{display:block;color:#9aa2ad;font-size:9px;margin-top:5px}
      .bp-editor-preview-wrap{position:relative;min-width:0;display:flex;flex-direction:column;background:#e9ebee;overflow:hidden}.bp-editor-preview-toolbar{height:46px;background:#fff;border-bottom:1px solid #e0e3e7;display:flex;align-items:center;justify-content:space-between;padding:0 15px;color:#475569;font-size:12px}.bp-editor-preview-toolbar div{display:flex;gap:5px}.bp-editor-preview-toolbar button{border:0;background:#f5f6f7;border-radius:7px;padding:7px 10px;cursor:pointer}.bp-editor-preview{flex:1;min-height:0;overflow:auto;background:#fff;margin:0}.bp-editor-preview iframe{width:100%;height:100%;min-height:100%;border:0;background:#fff}.bp-editor-floating-tools{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);background:#fff;border:1px solid #e2e5e9;border-radius:15px;box-shadow:0 12px 30px rgba(15,23,42,.16);padding:6px;display:flex;gap:2px;z-index:20}.bp-editor-floating-tools button{border:0;background:#fff;padding:10px 13px;border-right:1px solid #e5e7eb;cursor:pointer;font-size:12px}.bp-editor-floating-tools button:last-child{border-right:0}
      @media(max-width:900px){.bp-editor-body{grid-template-columns:330px 1fr}.bp-editor-planbar{font-size:11px}.bp-editor-top-btn{display:none}}@media(max-width:680px){.bp-editor-body{display:block;height:auto}.bp-editor-panel{min-height:520px}.bp-editor-preview-wrap{height:620px}.bp-editor-right-top .bp-editor-icon-btn:first-child{display:none}.bp-editor-tab span{display:none}}
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

      .bp-airo-modal-overlay{position:fixed;inset:0;z-index:5000;background:rgba(15,23,42,.58);display:flex;align-items:flex-start;justify-content:center;padding:28px 18px;overflow:auto}
      .bp-airo-new-project-modal,.bp-airo-upgrade-modal,.bp-airo-requests-modal{position:relative;width:min(930px,100%);background:#fff;border-radius:24px;padding:30px;box-shadow:0 30px 100px rgba(15,23,42,.28)}
      .bp-airo-new-title{text-align:center;margin-bottom:18px}.bp-airo-new-title h2{font-size:32px;margin:0 0 7px}.bp-airo-new-title p,.bp-airo-upgrade-modal p,.bp-airo-requests-modal>p{color:#64748b;margin:0}
      .bp-airo-modal-close{position:absolute;right:18px;top:18px;width:38px;height:38px;border:0;background:#f3f4f6;border-radius:9px;font-size:24px;cursor:pointer}
      .bp-airo-prompt-box{border:2px solid #c8b9df;border-radius:20px;padding:14px;box-shadow:0 0 0 5px rgba(109,73,199,.05),0 16px 35px rgba(15,23,42,.09)}.bp-airo-prompt-box textarea{width:100%;min-height:125px;border:0;outline:0;resize:vertical;font-size:17px;box-sizing:border-box}.bp-airo-prompt-actions{display:flex;justify-content:flex-end;gap:7px}.bp-airo-icon-btn{border:0;background:#fff;font-size:20px;padding:8px;cursor:pointer}.bp-airo-generate{border:0;border-radius:12px;background:#b9a5d7;color:#fff;font-weight:800;padding:12px 24px;cursor:pointer}
      .bp-airo-ideas-title{text-align:center;color:#8a8f98;font-size:13px;margin:22px 0 12px}.bp-airo-pills{display:flex;gap:7px;flex-wrap:wrap;justify-content:center}.bp-airo-pills button{border:1px solid #6d49c7;background:#fff;border-radius:999px;padding:7px 13px;cursor:pointer}.bp-airo-pills.small button{background:#f7f4fd;border:0;font-size:12px}.bp-airo-ideas-caption{text-align:center;color:#8a8f98;font-size:12px;margin:20px 0 8px}.bp-airo-new-fields,.bp-airo-upgrade-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin-top:20px}.bp-airo-new-fields label,.bp-airo-upgrade-grid label,.bp-airo-upgrade-modal>label{display:block;font-size:12px;font-weight:800;color:#475569;margin-bottom:5px}.bp-airo-limit-note{margin-top:12px;background:#f8fafc;border-radius:10px;padding:10px;color:#64748b;font-size:12px}.bp-airo-upgrade-modal{max-width:650px}.bp-airo-upgrade-grid{grid-template-columns:1fr 1fr}.bp-airo-upgrade-modal>label{margin-top:15px}.bp-airo-upgrade-modal .bp-textarea{width:100%;box-sizing:border-box}.bp-airo-upgrade-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:15px}.bp-airo-request-card{border:1px solid #e5e7eb;border-radius:13px;padding:13px;margin-top:9px}.bp-airo-request-card>div:first-child{display:flex;justify-content:space-between;gap:8px}.bp-airo-request-card span{font-size:11px;color:#94a3b8}.bp-airo-request-card p{font-size:12px;color:#64748b}.bp-airo-error{background:#fef2f2;color:#b91c1c;padding:12px;border-radius:10px;margin-top:12px}
      @media(max-width:700px){.bp-airo-new-project-modal,.bp-airo-upgrade-modal,.bp-airo-requests-modal{padding:22px}.bp-airo-new-fields,.bp-airo-upgrade-grid{grid-template-columns:1fr}}
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
      .select("id,full_name,role,status,plan,project_limit,github_file_limit")
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
      activeProfile = data;
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
      return;
    }

    const { data: freshProfile } = await client
      .from("profiles")
      .select("id,full_name,role,status,plan,project_limit,github_file_limit")
      .eq("id", activeUser.id)
      .maybeSingle();

    activeProfile = freshProfile || {
      id: activeUser.id,
      full_name: activeUser.user_metadata?.full_name || activeUser.email || "User",
      role: "user",
      status: "active",
      plan: "free",
      project_limit: 2,
      github_file_limit: 2
    };
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
      renderAuth("login");
      return;
    }

    await ensureProfile();

    const projectLimit = activeProfile?.project_limit ?? 2;

    root.innerHTML = `
      <style>
        .bp-airo-page{min-height:100vh;background:#f7f7f8;color:#171717;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex}
        .bp-airo-sidebar{width:248px;background:#fff;border-right:1px solid #e5e7eb;position:fixed;left:0;top:0;bottom:0;z-index:20;display:flex;flex-direction:column}
        .bp-airo-logo{height:68px;padding:0 20px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #eee;font-weight:700;font-size:17px}
        .bp-airo-logo-mark{width:31px;height:31px;border-radius:9px;background:#111;color:#fff;display:grid;place-items:center;font-size:15px}
        .bp-airo-nav{padding:18px 12px;display:grid;gap:5px}
        .bp-airo-nav button{border:0;background:transparent;width:100%;text-align:left;padding:11px 13px;border-radius:9px;color:#666;font-size:14px;cursor:pointer}
        .bp-airo-nav button.active,.bp-airo-nav button:hover{background:#f1f1f2;color:#111}
        .bp-airo-sidebar-bottom{margin-top:auto;padding:14px;border-top:1px solid #eee}
        .bp-airo-account{font-size:12px;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:8px 9px}
        .bp-airo-logout{width:100%;border:1px solid #ddd;background:#fff;border-radius:8px;padding:9px;cursor:pointer}
        .bp-airo-main{margin-left:248px;width:calc(100% - 248px);min-height:100vh}
        .bp-airo-top{height:68px;background:#fff;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;padding:0 30px;position:sticky;top:0;z-index:10}
        .bp-airo-breadcrumb{font-size:14px;color:#777}.bp-airo-breadcrumb strong{color:#111}
        .bp-airo-top-actions{display:flex;gap:9px;align-items:center}
        .bp-airo-btn{border:1px solid #ddd;background:#fff;color:#222;border-radius:8px;padding:9px 13px;font-size:13px;cursor:pointer}
        .bp-airo-btn:hover{background:#f5f5f5}.bp-airo-btn.primary{background:#111;color:#fff;border-color:#111}.bp-airo-btn.primary:hover{background:#292929}
        .bp-airo-content{max-width:1240px;margin:0 auto;padding:34px 32px 60px}
        .bp-airo-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:25px}
        .bp-airo-heading h1{font-size:28px;letter-spacing:-.7px;margin:0 0 7px}.bp-airo-heading p{margin:0;color:#777;font-size:14px}
        .bp-airo-create{display:flex;gap:9px;flex-wrap:wrap}
        .bp-airo-create-card{background:#fff;border:1px solid #e2e2e2;border-radius:12px;padding:18px;cursor:pointer;display:flex;align-items:center;gap:13px;min-width:205px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
        .bp-airo-create-card:hover{border-color:#aaa;box-shadow:0 5px 18px rgba(0,0,0,.06);transform:translateY(-1px)}
        .bp-airo-create-icon{width:38px;height:38px;border-radius:9px;background:#f2f2f2;display:grid;place-items:center;font-size:18px}.bp-airo-create-card b{font-size:14px}.bp-airo-create-card span{display:block;color:#888;font-size:11px;margin-top:3px}
        .bp-airo-section-title{display:flex;align-items:center;justify-content:space-between;margin:36px 0 14px}.bp-airo-section-title h2{font-size:17px;margin:0}.bp-airo-count{font-size:12px;color:#888}
        #projectsList{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(285px,1fr));gap:17px}
        #projectsList>.bp-airo-project-card{min-width:0}
        .bp-airo-project-card{background:#fff;border:1px solid #e3e3e3;border-radius:13px;overflow:hidden;transition:.18s;box-shadow:0 1px 2px rgba(0,0,0,.025)}
        .bp-airo-project-card:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(0,0,0,.07);border-color:#d0d0d0}
        .bp-airo-preview{height:150px;background:linear-gradient(135deg,#f4f4f5,#e8e8ea);position:relative;overflow:hidden;padding:13px}
        .bp-airo-browser{height:100%;background:#fff;border-radius:7px;box-shadow:0 3px 15px rgba(0,0,0,.08);overflow:hidden;border:1px solid #eee}
        .bp-airo-browser-bar{height:21px;background:#f7f7f7;border-bottom:1px solid #eee;display:flex;align-items:center;gap:4px;padding-left:8px}.bp-airo-dot{width:5px;height:5px;border-radius:50%;background:#bbb}
        .bp-airo-browser-body{padding:14px}.bp-airo-line{height:7px;background:#e9e9eb;border-radius:5px;margin-bottom:7px;width:65%}.bp-airo-line.short{width:38%}.bp-airo-blocks{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:13px}.bp-airo-block{height:43px;background:#f2f2f3;border-radius:5px}
        .bp-airo-status{position:absolute;top:10px;right:10px;background:#fff;border:1px solid #ddd;border-radius:999px;padding:4px 8px;font-size:10px;color:#555}
        .bp-airo-project-body{padding:15px}.bp-airo-project-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.bp-airo-project-name{font-size:15px;font-weight:650;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bp-airo-menu{border:0;background:transparent;color:#888;font-size:18px;cursor:pointer;line-height:1}
        .bp-airo-description{font-size:12px;color:#777;line-height:1.45;margin:7px 0 13px;min-height:34px}.bp-airo-meta{display:flex;align-items:center;justify-content:space-between;color:#999;font-size:11px}.bp-airo-open{border:0;background:#111;color:#fff;border-radius:7px;padding:7px 11px;font-size:11px;cursor:pointer}.bp-airo-public{color:#17803d}
        .bp-airo-empty{grid-column:1/-1;background:#fff;border:1px dashed #d8d8d8;border-radius:13px;text-align:center;padding:55px 20px;color:#777}.bp-airo-empty-icon{font-size:30px;margin-bottom:8px}.bp-airo-empty h3{color:#222;margin:0 0 5px;font-size:15px}.bp-airo-empty p{margin:0;font-size:12px}
        @media(max-width:800px){.bp-airo-sidebar{width:62px}.bp-airo-logo span,.bp-airo-nav button span,.bp-airo-sidebar-bottom{display:none}.bp-airo-logo{justify-content:center;padding:0}.bp-airo-nav button{text-align:center;font-size:0}.bp-airo-nav button:before{content:"•";font-size:18px}.bp-airo-main{margin-left:62px;width:calc(100% - 62px)}.bp-airo-content{padding:25px 16px}.bp-airo-heading{align-items:flex-start;flex-direction:column}.bp-airo-top{padding:0 16px}}
      </style>

      <div class="bp-airo-page">
        <aside class="bp-airo-sidebar">
          <div class="bp-airo-logo"><div class="bp-airo-logo-mark">✦</div><span>Projects</span></div>
          <nav class="bp-airo-nav">
            <button class="active" onclick="window.BuildPilot.home()">⌂ &nbsp; <span>Projects</span></button>
            <button onclick="window.BuildPilot.startProject('website')">＋ &nbsp; <span>New Website</span></button>
            <button onclick="window.BuildPilot.startProject('complete_system')">▣ &nbsp; <span>New System</span></button>
          </nav>
          <div class="bp-airo-sidebar-bottom">
            <div class="bp-airo-account" title="${escapeAttribute(activeUser.email || '')}">${escapeHtml(activeUser.email || '')}</div>
            <button class="bp-airo-logout" onclick="window.BuildPilot.logout()">Logout</button>
          </div>
        </aside>

        <div class="bp-airo-main">
          <header class="bp-airo-top">
            <div class="bp-airo-breadcrumb"><strong>My Projects</strong></div>
            <div class="bp-airo-top-actions">
              <button class="bp-airo-btn" onclick="window.BuildPilot.loadProjects()">↻ Refresh</button>
              <button class="bp-airo-btn primary" onclick="window.BuildPilot.startProject('website')">＋ Create project</button>
            </div>
          </header>

          <main class="bp-airo-content">
            <div class="bp-airo-heading">
              <div><h1>Your projects</h1><p>Create, edit and manage your AI-built websites and systems.</p></div>
              <div class="bp-airo-count">${projectLimit} project${projectLimit === 1 ? '' : 's'} allowed</div>
            </div>

            <div class="bp-airo-create">
              <div class="bp-airo-create-card" onclick="window.BuildPilot.startProject('website')"><div class="bp-airo-create-icon">🌐</div><div><b>Website</b><span>HTML, CSS & JavaScript</span></div></div>
              <div class="bp-airo-create-card" onclick="window.BuildPilot.startProject('complete_system')"><div class="bp-airo-create-icon">⚡</div><div><b>Complete System</b><span>App, dashboard & database</span></div></div>
            </div>

            <div class="bp-airo-section-title"><h2>All projects</h2><span class="bp-airo-count">Your saved projects</span></div>
            <div id="projectsList">Loading projects...</div>
          </main>
        </div>
      </div>
    `;

    await loadProjects();
  }

  /* =========================================================
     NEW PROJECT
     ========================================================= */

  async function startProject(
    projectType
  ) {
    const projectLimit = Math.max(1, Number(activeProfile?.project_limit ?? 2));

    const { count, error: limitError } = await client
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", activeUser.id);

    if (limitError) {
      showToast("Could not check project limit: " + limitError.message, "error");
      return;
    }

    if ((count || 0) >= projectLimit) {
      openUpgradeRequest(projectLimit);
      return;
    }

    const modalOld = document.getElementById("bpNewProjectModal");
    if (modalOld) modalOld.remove();

    const modal = document.createElement("div");
    modal.id = "bpNewProjectModal";
    modal.className = "bp-airo-modal-overlay";
    modal.innerHTML = `
      <div class="bp-airo-new-project-modal">
        <button class="bp-airo-modal-close" type="button" onclick="document.getElementById('bpNewProjectModal').remove()">×</button>
        <div class="bp-airo-new-title">
          <h2>Create a new project</h2>
          <p>Describe your idea in simple language and create your first version.</p>
        </div>
        <div class="bp-airo-prompt-box">
          <textarea id="newProjectPrompt" placeholder="Make a portfolio showcasing my photography..."></textarea>
          <div class="bp-airo-prompt-actions">
            <button type="button" class="bp-airo-icon-btn" onclick="window.BuildPilot.showToast('File attachment can be added here.')">⌕</button>
            <button type="button" class="bp-airo-icon-btn" onclick="window.BuildPilot.showToast('Voice input can be connected here.')">♩</button>
            <button id="createProjectButton" type="button" class="bp-airo-generate" onclick="window.BuildPilot.createProject('${escapeAttribute(projectType)}')">Generate</button>
          </div>
        </div>
        <div class="bp-airo-ideas-title">✧ Personalized ideas for you</div>
        <div class="bp-airo-pills">
          <button onclick="window.BuildPilot.fillProjectIdea('Online Tutoring Marketplace')">⌁ Online Tutoring Marketplace →</button>
          <button onclick="window.BuildPilot.fillProjectIdea('Searchable Study Materials Hub')">⌁ Searchable Study Materials Hub →</button>
          <button onclick="window.BuildPilot.fillProjectIdea('School Operations Management Portal')">⌁ School Operations Management Portal →</button>
        </div>
        <div class="bp-airo-ideas-caption">Describe your own idea above, or try one of these:</div>
        <div class="bp-airo-pills small">
          <button onclick="window.BuildPilot.fillProjectIdea('Make me a logo')">Make me a logo →</button>
          <button onclick="window.BuildPilot.fillProjectIdea('Rebuild my site')">Rebuild my site →</button>
          <button onclick="window.BuildPilot.fillProjectIdea('Restaurant website')">Restaurant →</button>
          <button onclick="window.BuildPilot.fillProjectIdea('Freelancer portfolio website')">Freelancer Portfolio →</button>
          <button onclick="window.BuildPilot.fillProjectIdea('Local food truck landing page')">Local Food Truck Landing Page →</button>
          <button onclick="window.BuildPilot.fillProjectIdea('Pet grooming service website')">Pet Grooming Service →</button>
          <button onclick="window.BuildPilot.fillProjectIdea('Fitness studio website')">Fitness Studio Website →</button>
          <button onclick="window.BuildPilot.fillProjectIdea('Small business directory')">Small Business Directory →</button>
          <button onclick="window.BuildPilot.fillProjectIdea('Creative canvas portfolio')">Creative Canvas Portfolio →</button>
        </div>
        <div class="bp-airo-new-fields">
          <div><label>Project Name</label><input id="newProjectName" class="bp-input" placeholder="My Business Website"></div>
          <div><label>Frontend</label><select id="frontend" class="bp-select"><option value="html">HTML / CSS / JavaScript</option><option value="react">React</option><option value="nextjs">Next.js</option></select></div>
          <div><label>Backend</label><select id="backend" class="bp-select"><option value="supabase">Supabase</option><option value="firebase">Firebase</option><option value="github">GitHub</option></select></div>
        </div>
        <div class="bp-airo-limit-note">Free account: <strong>${projectLimit}</strong> project${projectLimit === 1 ? '' : 's'}. After reaching the limit, request an upgrade from Admin.</div>
      </div>`;
    document.body.appendChild(modal);
  }

  function fillProjectIdea(text) {
    const el = document.getElementById("newProjectPrompt");
    if (el) { el.value = text; el.focus(); }
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

    await ensureProfile();

    const projectLimit = Math.max(1, Number(activeProfile?.project_limit ?? 2));
    const { count: projectCount, error: projectCountError } = await client
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", activeUser.id);

    if (projectCountError) {
      showToast("Project limit check failed: " + projectCountError.message, "error");
      return;
    }

    if ((projectCount || 0) >= projectLimit) {
      showToast("Project limit reached.", "error");
      openUpgradeRequest(projectLimit);
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
    const list = document.getElementById("projectsList");
    if (!list) return;

    list.innerHTML = `<div class="bp-airo-empty"><div class="bp-airo-empty-icon">⏳</div><p>Loading projects...</p></div>`;

    const { data, error } = await client
      .from("projects")
      .select(`id,name,description,status,frontend,backend,public_id,public_enabled,published_at,created_at`)
      .eq("user_id", activeUser.id)
      .order("created_at", { ascending:false });

    if (error) {
      list.innerHTML = `<div class="bp-airo-empty"><div class="bp-airo-empty-icon">!</div><h3>Could not load projects</h3><p style="color:#dc2626">${escapeHtml(error.message)}</p></div>`;
      return;
    }

    const projectLimit = Math.max(1, Number(activeProfile?.project_limit ?? 2));
    const limitBadge = document.querySelector(".bp-airo-count");
    if (limitBadge) limitBadge.textContent = `${data?.length || 0} / ${projectLimit} projects used`;

    if (!data?.length) {
      list.innerHTML = `
        <div class="bp-airo-empty">
          <div class="bp-airo-empty-icon">✦</div>
          <h3>No projects yet</h3>
          <p>Create your first project using the button above.</p>
        </div>`;
      return;
    }

    list.innerHTML = data.map(project => {
      const status = project.status || "draft";
      const date = project.created_at ? new Date(project.created_at).toLocaleDateString() : "";
      return `
        <article class="bp-airo-project-card">
          <div class="bp-airo-preview">
            <div class="bp-airo-status">${project.public_enabled ? "● Published" : escapeHtml(status)}</div>
            <div class="bp-airo-browser">
              <div class="bp-airo-browser-bar"><i class="bp-airo-dot"></i><i class="bp-airo-dot"></i><i class="bp-airo-dot"></i></div>
              <div class="bp-airo-browser-body">
                <div class="bp-airo-line"></div><div class="bp-airo-line short"></div>
                <div class="bp-airo-blocks"><div class="bp-airo-block"></div><div class="bp-airo-block"></div><div class="bp-airo-block"></div></div>
              </div>
            </div>
          </div>
          <div class="bp-airo-project-body">
            <div class="bp-airo-project-head">
              <h3 class="bp-airo-project-name" title="${escapeAttribute(project.name || "Untitled Project")}">${escapeHtml(project.name || "Untitled Project")}</h3>
              <button class="bp-airo-menu" title="Open project" onclick="window.BuildPilot.openProject('${escapeAttribute(project.id)}')">⋯</button>
            </div>
            <p class="bp-airo-description">${escapeHtml(project.description || "No description added yet.")}</p>
            <div class="bp-airo-meta">
              <span>${escapeHtml(date)} ${project.public_enabled ? '<b class="bp-airo-public"> · Public</b>' : ''}</span>
              <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
                <button class="bp-airo-open" onclick="window.BuildPilot.openProject('${escapeAttribute(project.id)}')">Open →</button>
                <button class="bp-airo-btn" style="padding:7px 10px;font-size:11px" onclick="window.BuildPilot.openCustomerRequests('${escapeAttribute(project.id)}')">Customer Requests</button>
              </div>
            </div>
          </div>
        </article>`;
    }).join("");
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
      <div class="bp-editor-shell">
        <header class="bp-editor-topbar">
          <div class="bp-editor-left-top">
            <button class="bp-editor-icon-btn" onclick="window.BuildPilot.home()" title="Projects">←</button>
            <button class="bp-editor-tab active">▣ <span>Website</span></button>
            <button class="bp-editor-tab" onclick="window.BuildPilot.showToast('Domain settings can be connected here.')">◉ <span>Domain</span></button>
            <button class="bp-editor-plus" onclick="window.BuildPilot.showToast('Add a page or feature')">＋</button>
          </div>
          <div class="bp-editor-right-top">
            <button class="bp-editor-icon-btn" onclick="window.BuildPilot.openCustomerRequests('${escapeAttribute(activeProject?.id || '')}')" title="Customer Requests">♧</button>
            <button class="bp-editor-top-btn" onclick="window.BuildPilot.openUpgradeRequest()">◇ Upgrade</button>
            <button id="publishButton" class="bp-editor-publish" onclick="window.BuildPilot.togglePublish()">${activeProject?.public_enabled ? 'Public Link' : 'Publish'}</button>
            <button class="bp-editor-icon-btn" onclick="window.BuildPilot.showToast('More options')">☰</button>
          </div>
        </header>

        <div class="bp-editor-planbar">
          <span>You are using the free plan. Premium features are available after an upgrade.</span>
          <button onclick="window.BuildPilot.openUpgradeRequest()">View Plans →</button>
        </div>

        <div class="bp-editor-body">
          <aside class="bp-editor-panel">
            <div class="bp-editor-panel-head">
              <div>
                <strong>${escapeHtml(activeProject?.name || 'Project')}</strong>
                <small>Website builder</small>
              </div>
              <button class="bp-editor-close" onclick="window.BuildPilot.home()">×</button>
            </div>

            <div class="bp-editor-credit-card">
              <div class="bp-credit-icon">✦</div>
              <div><strong>Free project</strong><span>Project limit: ${Math.max(1, Number(activeProfile?.project_limit ?? 2))}</span></div>
              <button onclick="window.BuildPilot.openUpgradeRequest()">Upgrade</button>
            </div>

            <div class="bp-editor-continue">
              <div class="bp-continue-head"><strong>Continue building</strong><span>Live</span></div>
              <div class="bp-step"><b>1</b><span>Describe your website changes</span></div>
              <div class="bp-step"><b>2</b><span>Review the live preview</span></div>
              <div class="bp-step"><b>3</b><span>Publish when ready</span></div>
            </div>

            <div class="bp-editor-tabs">
              <button id="workspaceAiTab" class="active" onclick="window.BuildPilot.workspaceTab('ai')">✦ AI</button>
              <button id="workspaceFilesTab" onclick="window.BuildPilot.workspaceTab('files')">Files</button>
              <button id="workspaceRequestsTab" onclick="window.BuildPilot.workspaceTab('requests')">Requests</button>
            </div>

            <section id="workspaceAiView" class="bp-editor-view active">
              <div class="bp-ai-message"><strong>AI Builder</strong><span>Tell me what you want to change in this website.</span></div>
              <div class="bp-ai-chips">
                <button onclick="window.BuildPilot.fillAIInstruction('Make the header more modern')">Modern header</button>
                <button onclick="window.BuildPilot.fillAIInstruction('Add a WhatsApp contact button')">WhatsApp button</button>
                <button onclick="window.BuildPilot.fillAIInstruction('Make the website mobile responsive')">Mobile responsive</button>
              </div>
            </section>

            <section id="workspaceFilesView" class="bp-editor-view">
              <div id="filesList" class="bp-editor-files"></div>
            </section>

            <section id="workspaceRequestsView" class="bp-editor-view">
              <div id="customerRequestsList" class="bp-editor-requests">Loading...</div>
            </section>

            <div class="bp-editor-ask">
              <form id="aiChatForm">
                <textarea id="aiInstruction" class="bp-editor-ask-input" rows="3" placeholder="Ask AI to change something..."></textarea>
                <div class="bp-editor-ask-bottom">
                  <button type="button" class="bp-editor-small" onclick="window.BuildPilot.showToast('File attachment can be added here.')">＋</button>
                  <button id="aiSendButton" class="bp-editor-send" type="submit">↑</button>
                </div>
              </form>
              <small>AI changes are saved into your project files.</small>
            </div>
          </aside>

          <main class="bp-editor-preview-wrap">
            <div class="bp-editor-preview-toolbar">
              <span>Preview</span>
              <div>
                <button onclick="window.BuildPilot.updatePreview()">↻</button>
                <button onclick="window.BuildPilot.openCustomerRequests('${escapeAttribute(activeProject?.id || '')}')">📩</button>
                <button onclick="window.BuildPilot.showToast('Preview opened')">↗</button>
              </div>
            </div>
            <div id="previewContent" class="bp-editor-preview">Loading...</div>
            <div class="bp-editor-floating-tools">
              <button onclick="window.BuildPilot.workspaceTab('ai')">✦ Edit</button>
              <button onclick="window.BuildPilot.updatePreview()">↻</button>
              <button onclick="window.BuildPilot.openCustomerRequests('${escapeAttribute(activeProject?.id || '')}')">📩</button>
              <button onclick="window.BuildPilot.showToast('Preview zoom')">↗</button>
            </div>
          </main>
        </div>
      </div>
    `;

    document.getElementById('aiChatForm')?.addEventListener('submit', submitAIInstruction);
    renderFilesList();
    updatePreview();
  }

  function workspaceTab(tab) {
    const tabs={ai:'workspaceAiTab',files:'workspaceFilesTab',requests:'workspaceRequestsTab'};
    const views={ai:'workspaceAiView',files:'workspaceFilesView',requests:'workspaceRequestsView'};
    Object.keys(tabs).forEach(k=>{
      document.getElementById(tabs[k])?.classList.toggle('active',k===tab);
      document.getElementById(views[k])?.classList.toggle('active',k===tab);
    });
    if(tab==='requests') loadCustomerRequests(activeProject?.id);
  }

  function fillAIInstruction(text) {
    const el=document.getElementById('aiInstruction');
    if(el){el.value=text;el.focus();}
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
     UPGRADE + CUSTOMER REQUESTS
     ========================================================= */

  function openUpgradeRequest(currentLimit) {
    const old = document.getElementById("bpUpgradeModal");
    if (old) old.remove();
    const limit = Math.max(1, Number(currentLimit || activeProfile?.project_limit || 2));
    const modal = document.createElement("div");
    modal.id = "bpUpgradeModal";
    modal.className = "bp-airo-modal-overlay";
    modal.innerHTML = `
      <div class="bp-airo-upgrade-modal">
        <button class="bp-airo-modal-close" onclick="document.getElementById('bpUpgradeModal').remove()">×</button>
        <h2>Project limit reached</h2>
        <p>Your current limit is <strong>${limit} projects</strong>. Send a request to Admin for a higher limit.</p>
        <div class="bp-airo-upgrade-grid">
          <div><label>Full Name</label><input id="upgradeFullName" class="bp-input" value="${escapeAttribute(activeProfile?.full_name || activeUser?.email || '')}"></div>
          <div><label>Mobile Number</label><input id="upgradeMobile" class="bp-input" placeholder="10 digit mobile"></div>
          <div><label>Email</label><input id="upgradeEmail" class="bp-input" value="${escapeAttribute(activeUser?.email || '')}"></div>
          <div><label>Requested Project Limit</label><input id="upgradeLimit" class="bp-input" type="number" min="${limit+1}" value="${limit+3}"></div>
        </div>
        <label>Reason / Description</label>
        <textarea id="upgradeMessage" class="bp-textarea" rows="5" placeholder="Tell Admin why you need more projects..."></textarea>
        <div class="bp-airo-upgrade-actions"><button class="bp-airo-btn" onclick="document.getElementById('bpUpgradeModal').remove()">Cancel</button><button id="upgradeSendButton" class="bp-airo-btn primary" onclick="window.BuildPilot.sendUpgradeRequest()">Send to Admin</button></div>
      </div>`;
    document.body.appendChild(modal);
  }

  async function sendUpgradeRequest() {
    const button = document.getElementById("upgradeSendButton");
    const current = Math.max(1, Number(activeProfile?.project_limit || 2));
    const requested = Number(document.getElementById("upgradeLimit")?.value || 0);
    if (requested <= current) { showToast("Requested limit must be higher than current limit.", "error"); return; }
    setButtonLoading(button, true, "Sending...");
    try {
      const { error } = await client.from("upgrade_requests").insert({
        user_id: activeUser.id,
        request_type: "project_limit",
        message: (document.getElementById("upgradeMessage")?.value || "Please increase my project limit.").trim(),
        status: "pending",
        full_name: (document.getElementById("upgradeFullName")?.value || "").trim(),
        mobile_number: (document.getElementById("upgradeMobile")?.value || "").trim(),
        email: (document.getElementById("upgradeEmail")?.value || "").trim(),
        requested_limit: requested
      });
      if (error) throw error;
      document.getElementById("bpUpgradeModal")?.remove();
      showToast("Upgrade request sent to Admin.", "success");
    } catch (e) { showToast(e.message || "Upgrade request failed.", "error"); }
    finally { setButtonLoading(button, false); }
  }

  async function openCustomerRequests(projectId) {
    if (!projectId) return;
    const old = document.getElementById("bpCustomerRequestsModal");
    if (old) old.remove();
    const modal = document.createElement("div");
    modal.id = "bpCustomerRequestsModal";
    modal.className = "bp-airo-modal-overlay";
    modal.innerHTML = `<div class="bp-airo-requests-modal"><button class="bp-airo-modal-close" onclick="document.getElementById('bpCustomerRequestsModal').remove()">×</button><h2>Customer Requests</h2><p>Requests received from this project's public website.</p><div id="bpCustomerRequestsList">Loading...</div></div>`;
    document.body.appendChild(modal);
    const box = document.getElementById("bpCustomerRequestsList");
    const { data, error } = await client.from("customer_requests").select("id,customer_name,mobile_number,email,message,status,created_at").eq("project_id", projectId).order("created_at", { ascending:false });
    if (error) { box.innerHTML = `<div class="bp-airo-error">${escapeHtml(error.message)}</div>`; return; }
    if (!data?.length) { box.innerHTML = `<div class="bp-airo-empty"><div class="bp-airo-empty-icon">📩</div><h3>No customer requests yet</h3><p>Requests submitted from your public website will appear here.</p></div>`; return; }
    box.innerHTML = data.map(r => `<article class="bp-airo-request-card"><div><strong>${escapeHtml(r.customer_name || 'Customer')}</strong><span>${escapeHtml(new Date(r.created_at).toLocaleString())}</span></div><p>${r.mobile_number ? '📱 '+escapeHtml(r.mobile_number)+' ' : ''}${r.email ? ' · ✉ '+escapeHtml(r.email) : ''}</p><div>${escapeHtml(r.message || '')}</div><small>Status: ${escapeHtml(r.status || 'new')}</small></article>`).join('');
  }

  function addCustomerRequestWidget(html, projectId) {
    const widget = `<style>
#bpCustomerRequestButton{position:fixed;right:22px;bottom:22px;z-index:2147483000;border:0;border-radius:999px;padding:13px 18px;background:#111827;color:#fff;font:700 14px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.2);cursor:pointer}#bpCustomerRequestModal{display:none;position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.5);align-items:center;justify-content:center;padding:18px}#bpCustomerRequestModal .box{width:min(440px,100%);background:#fff;border-radius:18px;padding:22px;box-shadow:0 25px 80px rgba(0,0,0,.25);font-family:system-ui}#bpCustomerRequestModal input,#bpCustomerRequestModal textarea{width:100%;box-sizing:border-box;padding:11px;margin:6px 0 10px;border:1px solid #d1d5db;border-radius:10px}#bpCustomerRequestModal .row{display:flex;justify-content:flex-end;gap:8px}#bpCustomerRequestSubmit{background:#111827;color:#fff;border:0;border-radius:9px;padding:10px 14px}</style>
<button id="bpCustomerRequestButton">Customer Request</button><div id="bpCustomerRequestModal"><div class="box"><h3>Send a request</h3><p>Fill your details and the project owner will receive your request.</p><input id="bpReqName" placeholder="Your name"><input id="bpReqMobile" placeholder="Mobile number"><input id="bpReqEmail" type="email" placeholder="Email"><textarea id="bpReqMessage" rows="4" placeholder="How can we help?"></textarea><div class="row"><button onclick="document.getElementById('bpCustomerRequestModal').style.display='none'">Cancel</button><button id="bpCustomerRequestSubmit">Send Request</button></div></div></div><script>(function(){var pid=${JSON.stringify(String(projectId||''))},url=${JSON.stringify(SUPABASE_URL)},key=${JSON.stringify(SUPABASE_KEY)};var b=document.getElementById('bpCustomerRequestButton'),m=document.getElementById('bpCustomerRequestModal');b.onclick=function(){m.style.display='flex'};document.getElementById('bpCustomerRequestSubmit').onclick=async function(){var n=document.getElementById('bpReqName').value.trim(),mo=document.getElementById('bpReqMobile').value.trim(),e=document.getElementById('bpReqEmail').value.trim(),msg=document.getElementById('bpReqMessage').value.trim();if(!n||!msg){alert('Name and message are required.');return}var btn=this;btn.disabled=true;btn.textContent='Sending...';try{var r=await fetch(url+'/rest/v1/customer_requests',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({project_id:pid,customer_name:n,mobile_number:mo,email:e,message:msg,status:'new'})});if(!r.ok)throw new Error(await r.text());alert('Request sent successfully.');m.style.display='none'}catch(err){alert('Request could not be sent.')}finally{btn.disabled=false;btn.textContent='Send Request'}}})();</script>`;
    return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, widget + '</body>') : html + widget;
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
            Loading...
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

  function renderPublicPreview(
    data
  ) {
    const project =
      data.project || {};

    let html = data.html || "";
    html = addCustomerRequestWidget(html, project.id || data.project_id || "");

    root.innerHTML = `
      <div class="bp-app">

        <header class="bp-topbar">

          <div class="bp-brand">

            <div class="bp-logo">
              ⚡
            </div>

            <span>
              ${escapeHtml(
                project.name ||
                  "BuildPilot Project"
              )}
            </span>

          </div>

          <div style="
            color:#cbd5e1;
            font-size:13px;
          ">
            
          </div>

        </header>

        <main style="
          padding:15px;
          background:#f1f5f9;
          min-height:
            calc(100vh - 70px);
        ">

          <div style="
            background:white;
            border:1px solid #e2e8f0;
            border-radius:16px;
            overflow:hidden;
            max-width:1500px;
            margin:auto;
          ">

            <iframe
              id="publicPreviewFrame"
              class="bp-preview-frame"
              style="
                height:calc(100vh - 110px);
                min-height:700px;
              "
              sandbox="
                allow-scripts
                allow-forms
                allow-modals
                allow-popups
              "
            ></iframe>

          </div>

        </main>

      </div>
    `;

    const iframe =
      document.getElementById(
        "publicPreviewFrame"
      );

    if (iframe) {
      iframe.srcdoc =
        html;
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

    openUpgradeRequest:
      openUpgradeRequest,

    workspaceTab:
      workspaceTab,

    fillAIInstruction:
      fillAIInstruction,

    sendUpgradeRequest:
      sendUpgradeRequest,

    fillProjectIdea:
      fillProjectIdea,

    openCustomerRequests:
      openCustomerRequests,
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
