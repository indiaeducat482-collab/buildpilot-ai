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

  function uuid() {
    if (
      window.crypto &&
      crypto.randomUUID
    ) {
      return crypto.randomUUID();
    }

    return (
      Date.now().toString(36) +
      Math.random()
        .toString(36)
        .slice(2)
    );
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function getFileName(path) {
    return String(path || "")
      .split("/")
      .pop();
  }

  function getFileExtension(path) {
    const name =
      getFileName(path);

    const index =
      name.lastIndexOf(".");

    if (index === -1) {
      return "";
    }

    return name
      .slice(index + 1)
      .toLowerCase();
  }

  function isHtmlFile(path) {
    const ext =
      getFileExtension(path);

    return (
      ext === "html" ||
      ext === "htm"
    );
  }

  function isCssFile(path) {
    return (
      getFileExtension(path) ===
      "css"
    );
  }

  function isJsFile(path) {
    const ext =
      getFileExtension(path);

    return (
      ext === "js" ||
      ext === "mjs" ||
      ext === "jsx"
    );
  }

  function isImageFile(path) {
    return [
      "png",
      "jpg",
      "jpeg",
      "gif",
      "webp",
      "svg",
      "ico"
    ].includes(
      getFileExtension(path)
    );
  }

  function normalizePath(path) {
    return String(path || "")
      .trim()
      .replaceAll("\\", "/")
      .replace(/^\/+/, "")
      .replace(/\/+/g, "/");
  }

  function ensureLeadingSlash(path) {
    const value =
      normalizePath(path);

    return value
      ? "/" + value
      : "/";
  }

  function debounce(
    callback,
    delay = 300
  ) {
    let timer = null;

    return function (...args) {
      clearTimeout(timer);

      timer = setTimeout(() => {
        callback.apply(
          this,
          args
        );
      }, delay);
    };
  }

  function isAdmin() {
    return (
      activeProfile?.role ===
        "admin" ||
      activeProfile?.role ===
        "super_admin"
    );
  }

  function isBlocked() {
    return (
      activeProfile?.status ===
      "blocked"
    );
  }

  function projectLimit() {
    const value =
      Number(
        activeProfile
          ?.project_limit
      );

    return Number.isFinite(value) &&
      value > 0
      ? value
      : 5;
  }

  function githubFileLimit() {
    const value =
      Number(
        activeProfile
          ?.github_file_limit
      );

    return Number.isFinite(value) &&
      value > 0
      ? value
      : 2;
  }

  /* =========================================================
     SUPABASE CLIENT
     ========================================================= */

  function getSupabase() {
    if (
      !window.supabase ||
      !window.supabase.createClient
    ) {
      throw new Error(
        "Supabase client library is not loaded."
      );
    }

    if (
      !SUPABASE_URL ||
      !SUPABASE_KEY
    ) {
      throw new Error(
        "Supabase configuration is missing."
      );
    }

    if (
      !window.__BUILD_PILOT_SUPABASE
    ) {
      window.__BUILD_PILOT_SUPABASE =
        window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_KEY
        );
    }

    return window
      .__BUILD_PILOT_SUPABASE;
  }

  async function getSession() {
    const supabase =
      getSupabase();

    const result =
      await supabase.auth.getSession();

    if (result.error) {
      throw result.error;
    }

    activeSession =
      result.data?.session ||
      null;

    activeUser =
      activeSession?.user ||
      null;

    return activeSession;
  }

  async function getCurrentUser() {
    const supabase =
      getSupabase();

    const result =
      await supabase.auth.getUser();

    if (result.error) {
      activeUser = null;
      return null;
    }

    activeUser =
      result.data?.user ||
      null;

    return activeUser;
  }

  async function signOut() {
    try {
      const supabase =
        getSupabase();

      await supabase.auth.signOut();
    } catch (error) {
      console.error(
        "Sign out error:",
        error
      );
    }

    activeUser = null;
    activeSession = null;
    activeProfile = null;
    activeProject = null;
    activeFiles = [];
    selectedFileId = null;

    renderHome();
  }

  /* =========================================================
     PROFILE
     ========================================================= */

  async function ensureProfile() {
    const supabase =
      getSupabase();

    const user =
      activeUser ||
      await getCurrentUser();

    if (!user) {
      activeProfile = null;
      return null;
    }

    let result =
      await supabase
        .from("profiles")
        .select(
          [
            "id",
            "full_name",
            "role",
            "status",
            "plan",
            "project_limit",
            "github_file_limit"
          ].join(",")
        )
        .eq(
          "id",
          user.id
        )
        .maybeSingle();

    if (
      result.error &&
      result.error.code !==
        "PGRST116"
    ) {
      console.error(
        "Profile read error:",
        result.error
      );
    }

    if (!result.data) {
      const fullName =
        user.user_metadata
          ?.full_name ||
        user.user_metadata
          ?.name ||
        user.email
          ?.split("@")[0] ||
        "User";

      const insertResult =
        await supabase
          .from("profiles")
          .insert({
            id: user.id,
            full_name: fullName,
            role: "user",
            status: "active",
            plan: "free",
            project_limit: 5,
            github_file_limit: 2
          })
          .select(
            [
              "id",
              "full_name",
              "role",
              "status",
              "plan",
              "project_limit",
              "github_file_limit"
            ].join(",")
          )
          .single();

      if (
        insertResult.error
      ) {
        console.error(
          "Profile create error:",
          insertResult.error
        );

        activeProfile = {
          id: user.id,
          full_name: fullName,
          role: "user",
          status: "active",
          plan: "free",
          project_limit: 5,
          github_file_limit: 2
        };
      } else {
        activeProfile =
          insertResult.data;
      }
    } else {
      activeProfile =
        result.data;
    }

    if (isBlocked()) {
      showBlockedScreen();
    }

    return activeProfile;
  }

  /* =========================================================
     AUTH UI
     ========================================================= */

  function authModal(
    mode = "login"
  ) {
    const isLogin =
      mode === "login";

    const existing =
      document.getElementById(
        "bpAuthModal"
      );

    if (existing) {
      existing.remove();
    }

    const modal =
      document.createElement("div");

    modal.id =
      "bpAuthModal";

    modal.className =
      "bp-modal-backdrop";

    modal.innerHTML = `
      <div class="bp-modal bp-auth-modal">
        <button
          class="bp-modal-close"
          id="bpAuthClose"
          type="button"
        >×</button>

        <div class="bp-auth-logo">
          <div class="bp-auth-logo-mark">
            BP
          </div>
          <div>
            <strong>Welcome</strong>
            <span>Continue to your workspace</span>
          </div>
        </div>

        <div class="bp-auth-tabs">
          <button
            type="button"
            class="${
              isLogin
                ? "active"
                : ""
            }"
            data-auth-mode="login"
          >
            Login
          </button>

          <button
            type="button"
            class="${
              !isLogin
                ? "active"
                : ""
            }"
            data-auth-mode="signup"
          >
            Sign up
          </button>
        </div>

        <form
          id="bpAuthForm"
          class="bp-auth-form"
        >
          ${
            !isLogin
              ? `
                <label>
                  Full name
                  <input
                    id="bpAuthName"
                    type="text"
                    autocomplete="name"
                    placeholder="Your name"
                    required
                  />
                </label>
              `
              : ""
          }

          <label>
            Email
            <input
              id="bpAuthEmail"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              id="bpAuthPassword"
              type="password"
              autocomplete="${
                isLogin
                  ? "current-password"
                  : "new-password"
              }"
              placeholder="Password"
              minlength="6"
              required
            />
          </label>

          ${
            !isLogin
              ? `
                <label>
                  Confirm password
                  <input
                    id="bpAuthConfirm"
                    type="password"
                    autocomplete="new-password"
                    placeholder="Confirm password"
                    minlength="6"
                    required
                  />
                </label>
              `
              : ""
          }

          <button
            id="bpAuthSubmit"
            class="bp-primary-btn bp-full-btn"
            type="submit"
          >
            ${
              isLogin
                ? "Login"
                : "Create account"
            }
          </button>

          <div
            id="bpAuthMessage"
            class="bp-auth-message"
          ></div>
        </form>
      </div>
    `;

    document.body.appendChild(
      modal
    );

    const closeButton =
      document.getElementById(
        "bpAuthClose"
      );

    closeButton?.addEventListener(
      "click",
      () => modal.remove()
    );

    modal.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          modal
        ) {
          modal.remove();
        }
      }
    );

    modal
      .querySelectorAll(
        "[data-auth-mode]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            authModal(
              button.dataset
                .authMode
            );
          }
        );
      });

    const form =
      document.getElementById(
        "bpAuthForm"
      );

    form?.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const submit =
          document.getElementById(
            "bpAuthSubmit"
          );

        const message =
          document.getElementById(
            "bpAuthMessage"
          );

        const email =
          document.getElementById(
            "bpAuthEmail"
          )?.value
            ?.trim();

        const password =
          document.getElementById(
            "bpAuthPassword"
          )?.value || "";

        setButtonLoading(
          submit,
          true,
          isLogin
            ? "Logging in..."
            : "Creating account..."
        );

        if (message) {
          message.textContent =
            "";
        }

        try {
          const supabase =
            getSupabase();

          if (isLogin) {
            const result =
              await supabase.auth.signInWithPassword(
                {
                  email,
                  password
                }
              );

            if (
              result.error
            ) {
              throw result.error;
            }

            activeSession =
              result.data
                ?.session ||
              null;

            activeUser =
              result.data
                ?.user ||
              null;

            await ensureProfile();

            modal.remove();

            if (isBlocked()) {
              showBlockedScreen();
              return;
            }

            renderHome();

            showToast(
              "Login successful.",
              "success"
            );
          } else {
            const name =
              document.getElementById(
                "bpAuthName"
              )?.value
                ?.trim() ||
              "User";

            const confirm =
              document.getElementById(
                "bpAuthConfirm"
              )?.value || "";

            if (
              password !==
              confirm
            ) {
              throw new Error(
                "Passwords do not match."
              );
            }

            const result =
              await supabase.auth.signUp(
                {
                  email,
                  password,
                  options: {
                    data: {
                      full_name:
                        name
                    }
                  }
                }
              );

            if (
              result.error
            ) {
              throw result.error;
            }

            activeSession =
              result.data
                ?.session ||
              null;

            activeUser =
              result.data
                ?.user ||
              null;

            if (activeUser) {
              await ensureProfile();
            }

            modal.remove();

            if (
              activeSession
            ) {
              renderHome();

              showToast(
                "Account created successfully.",
                "success"
              );
            } else {
              showToast(
                "Account created. Please verify your email, then login.",
                "success"
              );

              authModal(
                "login"
              );
            }
          }
        } catch (error) {
          console.error(
            "Auth error:",
            error
          );

          if (message) {
            message.textContent =
              error?.message ||
              "Authentication failed.";
          }

          showToast(
            error?.message ||
              "Authentication failed.",
            "error"
          );
        } finally {
          setButtonLoading(
            submit,
            false
          );
        }
      }
    );
  }

  function showBlockedScreen() {
    root.innerHTML = `
      <div class="bp-blocked-page">
        <div class="bp-blocked-card">
          <div class="bp-blocked-icon">
            !
          </div>

          <h1>Account blocked</h1>

          <p>
            Your account is currently
            blocked. Please contact the
            administrator.
          </p>

          <button
            id="bpBlockedLogout"
            class="bp-primary-btn"
          >
            Logout
          </button>
        </div>
      </div>
    `;

    document
      .getElementById(
        "bpBlockedLogout"
      )
      ?.addEventListener(
        "click",
        signOut
      );
  }

  /* =========================================================
     HOME PAGE
     ========================================================= */

  function renderHome() {
    if (!root) return;

    const loggedIn =
      !!activeUser;

    const name =
      activeProfile
        ?.full_name ||
      activeUser
        ?.email
        ?.split("@")[0] ||
      "User";

    root.innerHTML = `
      <div class="bp-home">

        <header class="bp-home-header">
          <div class="bp-brand">
            <div class="bp-brand-mark">
              BP
            </div>

            <div class="bp-brand-text">
              <strong>Workspace</strong>
              <span>Build your next project</span>
            </div>
          </div>

          <div class="bp-header-actions">

            ${
              isAdmin()
                ? `
                  <button
                    id="bpAdminBtn"
                    class="bp-secondary-btn"
                  >
                    Admin
                  </button>
                `
                : ""
            }

            ${
              loggedIn
                ? `
                  <span class="bp-user-name">
                    ${escapeHtml(name)}
                  </span>

                  <button
                    id="bpLogoutBtn"
                    class="bp-secondary-btn"
                  >
                    Logout
                  </button>
                `
                : `
                  <button
                    id="bpLoginBtn"
                    class="bp-secondary-btn"
                  >
                    Login
                  </button>

                  <button
                    id="bpSignupBtn"
                    class="bp-primary-btn"
                  >
                    Sign up
                  </button>
                `
            }

          </div>
        </header>

        <main class="bp-home-main">

          <section class="bp-hero">

            <div class="bp-hero-copy">

              <div class="bp-eyebrow">
                AI-powered workspace
              </div>

              <h1>
                Build websites and
                applications faster.
              </h1>

              <p>
                Create a project, edit files,
                preview your work and use AI
                to modify your code.
              </p>

              <div class="bp-hero-actions">

                ${
                  loggedIn
                    ? `
                      <button
                        id="bpCreateProjectBtn"
                        class="bp-primary-btn bp-large-btn"
                      >
                        Create project
                      </button>
                    `
                    : `
                      <button
                        id="bpHeroLogin"
                        class="bp-primary-btn bp-large-btn"
                      >
                        Get started
                      </button>
                    `
                }

              </div>

            </div>

            <div class="bp-hero-card">

              <div class="bp-window-bar">
                <span></span>
                <span></span>
                <span></span>
              </div>

              <div class="bp-window-content">

                <div class="bp-code-line">
                  <span>01</span>
                  <span>
                    &lt;main&gt;
                  </span>
                </div>

                <div class="bp-code-line">
                  <span>02</span>
                  <span>
                    &nbsp;&nbsp;Your project
                  </span>
                </div>

                <div class="bp-code-line">
                  <span>03</span>
                  <span>
                    &nbsp;&nbsp;starts here
                  </span>
                </div>

                <div class="bp-code-line">
                  <span>04</span>
                  <span>
                    &lt;/main&gt;
                  </span>
                </div>

              </div>

            </div>

          </section>

          ${
            loggedIn
              ? renderProjectSection()
              : renderFeatureSection()
          }

        </main>
      </div>
    `;

    document
      .getElementById(
        "bpLoginBtn"
      )
      ?.addEventListener(
        "click",
        () => authModal("login")
      );

    document
      .getElementById(
        "bpSignupBtn"
      )
      ?.addEventListener(
        "click",
        () => authModal("signup")
      );

    document
      .getElementById(
        "bpHeroLogin"
      )
      ?.addEventListener(
        "click",
        () => authModal("login")
      );

    document
      .getElementById(
        "bpLogoutBtn"
      )
      ?.addEventListener(
        "click",
        signOut
      );

    document
      .getElementById(
        "bpAdminBtn"
      )
      ?.addEventListener(
        "click",
        renderAdminPanel
      );

    document
      .getElementById(
        "bpCreateProjectBtn"
      )
      ?.addEventListener(
        "click",
        openCreateProjectModal
      );

    loadProjects();
  }

  function renderFeatureSection() {
    return `
      <section class="bp-feature-grid">

        <article class="bp-feature-card">
          <div class="bp-feature-icon">
            &
          </div>
          <h3>Code editor</h3>
          <p>
            Edit HTML, CSS and JavaScript
            files directly in your project.
          </p>
        </article>

        <article class="bp-feature-card">
          <div class="bp-feature-icon">
            AI
          </div>
          <h3>AI modification</h3>
          <p>
            Tell the AI what to change and
            apply the result to your files.
          </p>
        </article>

        <article class="bp-feature-card">
          <div class="bp-feature-icon">
            ▶
          </div>
          <h3>Live preview</h3>
          <p>
            See your website directly while
            working on the project.
          </p>
        </article>

        <article class="bp-feature-card">
          <div class="bp-feature-icon">
            IMG
          </div>
          <h3>Image understanding</h3>
          <p>
            Upload an image and give the AI
            visual context for your request.
          </p>
        </article>

      </section>
    `;
  }

  function renderProjectSection() {
    return `
      <section
        id="bpProjectsSection"
        class="bp-project-section"
      >

        <div class="bp-section-heading">
          <div>
            <h2>Your projects</h2>
            <p>
              Create and continue working
              on your projects.
            </p>
          </div>

          <div class="bp-limit-badge">
            ${
              escapeHtml(
                String(
                  activeProfile
                    ?.project_limit ??
                  5
                )
              )
            }
            project limit
          </div>
        </div>

        <div
          id="bpProjectList"
          class="bp-project-list"
        >
          <div class="bp-loading-card">
            Loading projects...
          </div>
        </div>

      </section>
    `;
  }

  /* =========================================================
     PROJECT DATA
     ========================================================= */

  async function loadProjects() {
    if (!activeUser) return;

    const container =
      document.getElementById(
        "bpProjectList"
      );

    if (!container) {
      return;
    }

    try {
      const supabase =
        getSupabase();

      const result =
        await supabase
          .from("projects")
          .select("*")
          .eq(
            "user_id",
            activeUser.id
          )
          .order(
            "created_at",
            {
              ascending: false
            }
          );

      if (result.error) {
        throw result.error;
      }

      const projects =
        result.data || [];

      if (!projects.length) {
        container.innerHTML = `
          <div class="bp-empty-card">
            <div class="bp-empty-icon">
              +
            </div>

            <h3>No projects yet</h3>

            <p>
              Create your first project
              to start building.
            </p>

            <button
              id="bpEmptyCreate"
              class="bp-primary-btn"
            >
              Create project
            </button>
          </div>
        `;

        document
          .getElementById(
            "bpEmptyCreate"
          )
          ?.addEventListener(
            "click",
            openCreateProjectModal
          );

        return;
      }

      container.innerHTML =
        projects
          .map(
            project =>
              projectCard(project)
          )
          .join("");

      container
        .querySelectorAll(
          "[data-open-project]"
        )
        .forEach(button => {
          button.addEventListener(
            "click",
            () => {
              openProject(
                button.dataset
                  .openProject
              );
            }
          );
        });

      container
        .querySelectorAll(
          "[data-delete-project]"
        )
        .forEach(button => {
          button.addEventListener(
            "click",
            () => {
              deleteProject(
                button.dataset
                  .deleteProject
              );
            }
          );
        });
    } catch (error) {
      console.error(
        "Project load error:",
        error
      );

      container.innerHTML = `
        <div class="bp-error-card">
          Failed to load projects.
          <br>
          ${escapeHtml(
            error?.message ||
              ""
          )}
        </div>
      `;
    }
  }

  function projectCard(project) {
    const created =
      project.created_at
        ? new Date(
            project.created_at
          ).toLocaleDateString(
            undefined,
            {
              day: "2-digit",
              month: "short",
              year: "numeric"
            }
          )
        : "";

    return `
      <article
        class="bp-project-card"
      >

        <div class="bp-project-card-top">

          <div class="bp-project-icon">
            {
              }
          </div>

          <div class="bp-project-actions">

            <button
              type="button"
              class="bp-icon-btn"
              title="Open"
              data-open-project="${escapeAttribute(
                project.id
              )}"
            >
              ↗
            </button>

            <button
              type="button"
              class="bp-icon-btn danger"
              title="Delete"
              data-delete-project="${escapeAttribute(
                project.id
              )}"
            >
              ×
            </button>

          </div>

        </div>

        <h3>
          ${escapeHtml(
            project.name ||
              "Untitled project"
          )}
        </h3>

        <p>
          ${escapeHtml(
            project.description ||
              "AI generated project"
          )}
        </p>

        <div class="bp-project-meta">
          <span>
            ${
              escapeHtml(
                project.frontend ||
                  "html"
              )
            }
          </span>

          <span>
            ${escapeHtml(
              created
            )}
          </span>
        </div>

      </article>
    `;
  }

  async function deleteProject(
    projectId
  ) {
    if (!projectId) return;

    const confirmed =
      window.confirm(
        "Delete this project? This cannot be undone."
      );

    if (!confirmed) {
      return;
    }

    try {
      const supabase =
        getSupabase();

      const fileResult =
        await supabase
          .from("project_files")
          .delete()
          .eq(
            "project_id",
            projectId
          );

      if (
        fileResult.error
      ) {
        throw fileResult.error;
      }

      const result =
        await supabase
          .from("projects")
          .delete()
          .eq(
            "id",
            projectId
          )
          .eq(
            "user_id",
            activeUser.id
          );

      if (result.error) {
        throw result.error;
      }

      if (
        activeProject?.id ===
        projectId
      ) {
        activeProject = null;
        activeFiles = [];
        selectedFileId = null;
      }

      showToast(
        "Project deleted.",
        "success"
      );

      await loadProjects();
    } catch (error) {
      console.error(
        "Delete project error:",
        error
      );

      showToast(
        error?.message ||
          "Could not delete project.",
        "error"
      );
    }
  }

  /* =========================================================
     CREATE PROJECT
     ========================================================= */

  function openCreateProjectModal() {
    if (!activeUser) {
      authModal("login");
      return;
    }

    if (isBlocked()) {
      showBlockedScreen();
      return;
    }

    const modal =
      document.createElement("div");

    modal.id =
      "bpCreateProjectModal";

    modal.className =
      "bp-modal-backdrop";

    modal.innerHTML = `
      <div class="bp-modal bp-project-modal">

        <button
          id="bpCreateClose"
          class="bp-modal-close"
          type="button"
        >
          ×
        </button>

        <h2>Create project</h2>

        <p class="bp-modal-subtitle">
          Start with a simple project.
          You can modify it later with AI.
        </p>

        <form
          id="bpCreateProjectForm"
          class="bp-project-form"
        >

          <label>
            Project name

            <input
              id="bpProjectName"
              type="text"
              placeholder="My Website"
              required
              maxlength="100"
            />
          </label>

          <label>
            Description

            <textarea
              id="bpProjectDescription"
              rows="3"
              placeholder="Describe what you want to build..."
            ></textarea>
          </label>

          <div class="bp-form-grid">

            <label>
              Frontend

              <select
                id="bpProjectFrontend"
              >
                <option value="html">
                  HTML
                </option>

                <option value="react">
                  React
                </option>

                <option value="nextjs">
                  Next.js
                </option>
              </select>
            </label>

            <label>
              Backend

              <select
                id="bpProjectBackend"
              >
                <option value="none">
                  None
                </option>

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
            </label>

          </div>

          <button
            id="bpCreateProjectSubmit"
            class="bp-primary-btn bp-full-btn"
            type="submit"
          >
            Create project
          </button>

        </form>
      </div>
    `;

    document.body.appendChild(
      modal
    );

    document
      .getElementById(
        "bpCreateClose"
      )
      ?.addEventListener(
        "click",
        () => modal.remove()
      );

    modal.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          modal
        ) {
          modal.remove();
        }
      }
    );

    document
      .getElementById(
        "bpCreateProjectForm"
      )
      ?.addEventListener(
        "submit",
        createProject
      );
  }

  async function createProject(
    event
  ) {
    event.preventDefault();

    if (!activeUser) {
      authModal("login");
      return;
    }

    if (isBlocked()) {
      showBlockedScreen();
      return;
    }

    const submit =
      document.getElementById(
        "bpCreateProjectSubmit"
      );

    const name =
      document.getElementById(
        "bpProjectName"
      )?.value
        ?.trim();

    const description =
      document.getElementById(
        "bpProjectDescription"
      )?.value
        ?.trim();

    const frontend =
      document.getElementById(
        "bpProjectFrontend"
      )?.value ||
      "html";

    const backend =
      document.getElementById(
        "bpProjectBackend"
      )?.value ||
      "none";

    if (!name) {
      showToast(
        "Enter a project name.",
        "error"
      );
      return;
    }

    setButtonLoading(
      submit,
      true,
      "Creating..."
    );

    try {
      const supabase =
        getSupabase();

      const countResult =
        await supabase
          .from("projects")
          .select(
            "id",
            {
              count: "exact",
              head: true
            }
          )
          .eq(
            "user_id",
            activeUser.id
          );

      if (
        countResult.error
      ) {
        throw countResult.error;
      }

      const currentCount =
        Number(
          countResult.count ||
            0
        );

      if (
        currentCount >=
        projectLimit()
      ) {
        throw new Error(
          `Project limit reached (${projectLimit()}). Please request an upgrade from admin.`
        );
      }

      const result =
        await supabase
          .from("projects")
          .insert({
            user_id:
              activeUser.id,
            name,
            description:
              description ||
              "",
            frontend,
            backend,
            status: "active"
          })
          .select("*")
          .single();

      if (result.error) {
        throw result.error;
      }

      const project =
        result.data;

      const starterFiles =
        getStarterFiles(
          frontend,
          name
        );

      const fileRows =
        starterFiles.map(
          file => ({
            project_id:
              project.id,
            user_id:
              activeUser.id,
            path: file.path,
            content:
              file.content,
            language:
              file.language ||
              getFileExtension(
                file.path
              )
          })
        );

      if (
        fileRows.length
      ) {
        const fileResult =
          await supabase
            .from("project_files")
            .insert(
              fileRows
            );

        if (
          fileResult.error
        ) {
          await supabase
            .from("projects")
            .delete()
            .eq(
              "id",
              project.id
            );

          throw fileResult.error;
        }
      }

      document
        .getElementById(
          "bpCreateProjectModal"
        )
        ?.remove();

      showToast(
        "Project created.",
        "success"
      );

      await openProject(
        project.id
      );
    } catch (error) {
      console.error(
        "Create project error:",
        error
      );

      showToast(
        error?.message ||
          "Could not create project.",
        "error"
      );
    } finally {
      setButtonLoading(
        submit,
        false
      );
    }
  }

  function getStarterFiles(
    frontend,
    projectName
  ) {
    const safeName =
      escapeHtml(
        projectName
      );

    if (
      frontend ===
      "react"
    ) {
      return [
        {
          path:
            "index.html",
          language:
            "html",
          content: `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeName}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>`
        },
        {
          path:
            "src/main.jsx",
          language:
            "jsx",
          content: `import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

function App() {
  return (
    <main className="app">
      <h1>${safeName}</h1>
      <p>Your project is ready.</p>
    </main>
  );
}

createRoot(
  document.getElementById("root")
).render(<App />);`
        },
        {
          path:
            "src/style.css",
          language:
            "css",
          content: `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
}

.app {
  min-height: 100vh;
  display: grid;
  place-items: center;
  text-align: center;
}`
        }
      ];
    }

    return [
      {
        path:
          "index.html",
        language:
          "html",
        content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeName}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <main class="page">
    <section class="hero">
      <div class="badge">
        Welcome
      </div>

      <h1>
        ${safeName}
      </h1>

      <p>
        Your project is ready.
      </p>

      <button
        id="startButton"
        class="primary"
      >
        Get Started
      </button>
    </section>
  </main>

  <script src="script.js"></script>
</body>
</html>`
      },
      {
        path:
          "style.css",
        language:
          "css",
        content: `* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
}

body {
  font-family:
    Inter,
    Arial,
    sans-serif;
  background:
    #f7f8fc;
  color:
    #171923;
}

.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.hero {
  width: min(
    760px,
    100%
  );
  padding: 60px 40px;
  border-radius: 28px;
  background: white;
  text-align: center;
  box-shadow:
    0 20px 60px
    rgba(
      0,
      0,
      0,
      .08
    );
}

.badge {
  display: inline-flex;
  padding: 8px 14px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 13px;
  font-weight: 700;
}

h1 {
  margin:
    22px 0 12px;
  font-size:
    clamp(
      38px,
      7vw,
      72px
    );
}

p {
  color:
    #667085;
  font-size:
    18px;
}

.primary {
  margin-top: 20px;
  border: 0;
  border-radius: 12px;
  padding:
    14px 22px;
  background:
    #111827;
  color:
    white;
  cursor:
    pointer;
  font-weight:
    700;
}`
      },
      {
        path:
          "script.js",
        language:
          "javascript",
        content: `document
  .getElementById("startButton")
  ?.addEventListener(
    "click",
    () => {
      alert("Your project is working!");
    }
  );`
      }
    ];
  }

  /* =========================================================
     OPEN PROJECT
     ========================================================= */

  async function openProject(
    projectId
  ) {
    if (!projectId) {
      return;
    }

    try {
      const supabase =
        getSupabase();

      const projectResult =
        await supabase
          .from("projects")
          .select("*")
          .eq(
            "id",
            projectId
          )
          .eq(
            "user_id",
            activeUser.id
          )
          .single();

      if (
        projectResult.error
      ) {
        throw projectResult.error;
      }

      const fileResult =
        await supabase
          .from("project_files")
          .select("*")
          .eq(
            "project_id",
            projectId
          )
          .order(
            "path",
            {
              ascending: true
            }
          );

      if (
        fileResult.error
      ) {
        throw fileResult.error;
      }

      activeProject =
        projectResult.data;

      activeFiles =
        fileResult.data || [];

      selectedFileId =
        findDefaultFileId();

      renderEditor();

      if (
        selectedFileId
      ) {
        setTimeout(
          () => {
            selectEditorFile(
              selectedFileId
            );
          },
          0
        );
      }
    } catch (error) {
      console.error(
        "Open project error:",
        error
      );

      showToast(
        error?.message ||
          "Could not open project.",
        "error"
      );
    }
  }

  function findDefaultFileId() {
    if (!activeFiles.length) {
      return null;
    }

    const index =
      activeFiles.findIndex(
        file =>
          normalizePath(
            file.path
          ) ===
          "index.html"
      );

    if (index >= 0) {
      return activeFiles[index]
        .id;
    }

    return activeFiles[0].id;
  }

  /* =========================================================
     EDITOR
     ========================================================= */

  function renderEditor() {
    if (!activeProject) {
      renderHome();
      return;
    }

    root.innerHTML = `
      <div
        id="bpEditorApp"
        class="bp-editor-app"
      >

        <header class="bp-editor-topbar">

          <div class="bp-editor-left">

            <button
              id="bpBackHome"
              class="bp-icon-btn"
              title="Back"
            >
              ←
            </button>

            <div class="bp-editor-brand">
              <div
                class="bp-brand-mark"
              >
                BP
              </div>

              <div>
                <strong>
                  ${escapeHtml(
                    activeProject.name ||
                      "Project"
                  )}
                </strong>

                <span>
                  ${escapeHtml(
                    activeProject.frontend ||
                      "html"
                  )}
                </span>
              </div>
            </div>

          </div>

          <div class="bp-editor-center">

            <button
              id="bpNewFileBtn"
              class="bp-editor-tool"
            >
              + New file
            </button>

            <button
              id="bpSaveFileBtn"
              class="bp-editor-tool primary"
            >
              Save
            </button>

            <button
              id="bpPreviewBtn"
              class="bp-editor-tool"
            >
              Preview
            </button>

            <button
              id="bpProjectInfoBtn"
              class="bp-editor-tool"
            >
              Info
            </button>

          </div>

          <div class="bp-editor-right">

            <button
              id="bpPublishBtn"
              class="bp-editor-tool primary"
            >
              Publish
            </button>

          </div>

        </header>

        <div
          class="bp-editor-layout"
        >

          <aside
            class="bp-file-sidebar"
          >

            <div
              class="bp-sidebar-header"
            >
              <span>Files</span>

              <button
                id="bpSidebarNewFile"
                class="bp-mini-btn"
                title="New file"
              >
                +
              </button>
            </div>

            <div
              id="bpFileTree"
              class="bp-file-tree"
            >
              ${renderFileTree()}
            </div>

          </aside>

          <main
            class="bp-code-workspace"
          >

            <div
              id="bpEditorTabs"
              class="bp-editor-tabs"
            >
              ${renderEditorTabs()}
            </div>

            <div
              class="bp-code-editor-shell"
            >

              <div
                id="bpLineNumbers"
                class="bp-line-numbers"
              ></div>

              <textarea
                id="bpCodeEditor"
                class="bp-code-editor"
                spellcheck="false"
                autocapitalize="off"
                autocomplete="off"
                autocorrect="off"
              ></textarea>

            </div>

            <div
              class="bp-editor-statusbar"
            >
              <span
                id="bpEditorStatus"
              >
                Ready
              </span>

              <span
                id="bpEditorLanguage"
              >
                ${escapeHtml(
                  getSelectedFile()
                    ?.language ||
                    getFileExtension(
                      getSelectedFile()
                        ?.path
                    ) ||
                    "text"
                )}
              </span>
            </div>

          </main>

          <aside
            class="bp-ai-sidebar"
          >
            <div
              class="bp-ai-header"
            >

              <div>
                <strong>
                  AI Builder
                </strong>

                <span>
                  Modify your project
                </span>
              </div>

              <button
                id="bpAIReset"
                class="bp-mini-btn"
                title="Clear chat"
              >
                ↻
              </button>

            </div>

            <div
              id="bpAIChat"
              class="bp-ai-chat"
            >
              <div
                class="bp-ai-welcome"
              >
                <div
                  class="bp-ai-welcome-icon"
                >
                  AI
                </div>

                <h3>
                  What should I change?
                </h3>

                <p>
                  Tell the AI exactly what
                  you want changed in the
                  current project.
                </p>

                <div
                  class="bp-ai-suggestions"
                >

                  <button
                    data-ai-suggestion="Make the homepage modern and professional."
                  >
                    Make it modern
                  </button>

                  <button
                    data-ai-suggestion="Create a responsive navigation bar."
                  >
                    Add navbar
                  </button>

                  <button
                    data-ai-suggestion="Improve the mobile responsive design."
                  >
                    Improve mobile
                  </button>

                </div>

              </div>
            </div>

            <div
              class="bp-ai-image-preview"
              id="bpAIImagePreview"
            ></div>

            <div
              class="bp-ai-composer"
            >

              <textarea
                id="bpAIInput"
                rows="4"
                placeholder="Describe what you want the AI to change..."
              ></textarea>

              <div
                class="bp-ai-composer-bottom"
              >

                <label
                  class="bp-attach-btn"
                  title="Upload image"
                >
                  +
                  <input
                    id="bpAIImageInput"
                    type="file"
                    accept="image/*"
                    hidden
                  />
                </label>

                <button
                  id="bpGenerateImageBtn"
                  class="bp-secondary-btn"
                  type="button"
                >
                  Generate image
                </button>

                <button
                  id="bpAISendBtn"
                  class="bp-primary-btn"
                  type="button"
                >
                  Send
                </button>

              </div>

            </div>

          </aside>

        </div>

      </div>
    `;

    bindEditorEvents();
    updateCodeEditor();
  }

  function renderFileTree() {
    if (!activeFiles.length) {
      return `
        <div class="bp-file-empty">
          No files
        </div>
      `;
    }

    return activeFiles
      .map(file => {
        const selected =
          file.id ===
          selectedFileId;

        const icon =
          isHtmlFile(
            file.path
          )
            ? "◇"
            : isCssFile(
                file.path
              )
            ? "#"
            : isJsFile(
                file.path
              )
            ? "JS"
            : isImageFile(
                file.path
              )
            ? "IMG"
            : "•";

        return `
          <div
            class="bp-file-row ${
              selected
                ? "selected"
                : ""
            }"
            data-file-id="${escapeAttribute(
              file.id
            )}"
          >

            <button
              class="bp-file-main"
              type="button"
              data-select-file="${escapeAttribute(
                file.id
              )}"
            >
              <span
                class="bp-file-icon"
              >
                ${icon}
              </span>

              <span
                class="bp-file-name"
              >
                ${escapeHtml(
                  file.path
                )}
              </span>
            </button>

            ${
              normalizePath(
                file.path
              ) !==
              "index.html"
                ? `
                  <button
                    class="bp-file-delete"
                    type="button"
                    title="Delete file"
                    data-delete-file="${escapeAttribute(
                      file.id
                    )}"
                  >
                    ×
                  </button>
                `
                : ""
            }

          </div>
        `;
      })
      .join("");
  }

  function renderEditorTabs() {
    const file =
      getSelectedFile();

    if (!file) {
      return `
        <div class="bp-editor-tab">
          No file selected
        </div>
      `;
    }

    return `
      <div class="bp-editor-tab active">
        <span>
          ${escapeHtml(
            getFileName(
              file.path
            )
          )}
        </span>
      </div>
    `;
  }

  function getSelectedFile() {
    return (
      activeFiles.find(
        file =>
          file.id ===
          selectedFileId
      ) ||
      null
    );
  }

  function selectEditorFile(
    fileId
  ) {
    const file =
      activeFiles.find(
        item =>
          item.id ===
          fileId
      );

    if (!file) {
      return;
    }

    selectedFileId =
      file.id;

    document
      .querySelectorAll(
        "[data-file-id]"
      )
      .forEach(row => {
        row.classList.toggle(
          "selected",
          row.dataset.fileId ===
            String(fileId)
        );
      });

    updateCodeEditor();

    document
      .querySelector(
        "#bpEditorLanguage"
      )
      ?.replaceChildren(
        document.createTextNode(
          file.language ||
            getFileExtension(
              file.path
            ) ||
            "text"
        )
      );
  }

  function updateCodeEditor() {
    const editor =
      document.getElementById(
        "bpCodeEditor"
      );

    const lineNumbers =
      document.getElementById(
        "bpLineNumbers"
      );

    const file =
      getSelectedFile();

    if (!editor) {
      return;
    }

    editor.value =
      file?.content || "";

    updateLineNumbers();

    if (lineNumbers) {
      lineNumbers.scrollTop =
        editor.scrollTop;
    }

    const status =
      document.getElementById(
        "bpEditorStatus"
      );

    if (status) {
      status.textContent =
        file
          ? "Loaded"
          : "Ready";
    }
  }

  function updateLineNumbers() {
    const editor =
      document.getElementById(
        "bpCodeEditor"
      );

    const lineNumbers =
      document.getElementById(
        "bpLineNumbers"
      );

    if (
      !editor ||
      !lineNumbers
    ) {
      return;
    }

    const lineCount =
      Math.max(
        1,
        editor.value.split(
          "\n"
        ).length
      );

    let html = "";

    for (
      let index = 1;
      index <= lineCount;
      index++
    ) {
      html +=
        `<div>${index}</div>`;
    }

    lineNumbers.innerHTML =
      html;
  }

  /* =========================================================
     EDITOR EVENTS
     ========================================================= */

  function bindEditorEvents() {
    document
      .getElementById(
        "bpBackHome"
      )
      ?.addEventListener(
        "click",
        () => {
          activeProject = null;
          activeFiles = [];
          selectedFileId = null;
          renderHome();
        }
      );

    document
      .getElementById(
        "bpNewFileBtn"
      )
      ?.addEventListener(
        "click",
        openNewFileModal
      );

    document
      .getElementById(
        "bpSidebarNewFile"
      )
      ?.addEventListener(
        "click",
        openNewFileModal
      );

    document
      .getElementById(
        "bpSaveFileBtn"
      )
      ?.addEventListener(
        "click",
        saveCurrentFile
      );

    document
      .getElementById(
        "bpPreviewBtn"
      )
      ?.addEventListener(
        "click",
        openPreview
      );

    document
      .getElementById(
        "bpProjectInfoBtn"
      )
      ?.addEventListener(
        "click",
        openProjectInfo
      );

    document
      .getElementById(
        "bpPublishBtn"
      )
      ?.addEventListener(
        "click",
        publishProject
      );

    document
      .getElementById(
        "bpAISendBtn"
      )
      ?.addEventListener(
        "click",
        submitAIInstruction
      );

    document
      .getElementById(
        "bpGenerateImageBtn"
      )
      ?.addEventListener(
        "click",
        generateImage
      );

    document
      .getElementById(
        "bpAIImageInput"
      )
      ?.addEventListener(
        "change",
        handleAIImageUpload
      );

    document
      .getElementById(
        "bpAIReset"
      )
      ?.addEventListener(
        "click",
        resetAIChat
      );

    document
      .querySelectorAll(
        "[data-select-file]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            selectEditorFile(
              button.dataset
                .selectFile
            );
          }
        );
      });

    document
      .querySelectorAll(
        "[data-delete-file]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            deleteFile(
              button.dataset
                .deleteFile
            );
          }
        );
      });

    document
      .querySelectorAll(
        "[data-ai-suggestion]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            const input =
              document.getElementById(
                "bpAIInput"
              );

            if (!input) {
              return;
            }

            input.value =
              button.dataset
                .aiSuggestion ||
              "";

            input.focus();
          }
        );
      });

    const editor =
      document.getElementById(
        "bpCodeEditor"
      );

    editor?.addEventListener(
      "input",
      () => {
        const file =
          getSelectedFile();

        if (!file) {
          return;
        }

        file.content =
          editor.value;

        updateLineNumbers();

        const status =
          document.getElementById(
            "bpEditorStatus"
          );

        if (status) {
          status.textContent =
            "Unsaved changes";
        }
      }
    );

    editor?.addEventListener(
      "scroll",
      () => {
        const lineNumbers =
          document.getElementById(
            "bpLineNumbers"
          );

        if (lineNumbers) {
          lineNumbers.scrollTop =
            editor.scrollTop;
        }
      }
    );

    editor?.addEventListener(
      "keydown",
      event => {
        if (
          (event.ctrlKey ||
            event.metaKey) &&
          event.key.toLowerCase() ===
            "s"
        ) {
          event.preventDefault();
          saveCurrentFile();
          return;
        }

        if (
          event.key ===
          "Tab"
        ) {
          event.preventDefault();

          const start =
            editor.selectionStart;

          const end =
            editor.selectionEnd;

          const value =
            editor.value;

          editor.value =
            value.slice(
              0,
              start
            ) +
            "  " +
            value.slice(end);

          editor.selectionStart =
            start + 2;

          editor.selectionEnd =
            start + 2;

          editor.dispatchEvent(
            new Event(
              "input",
              {
                bubbles: true
              }
            )
          );
        }
      }
    );
  }

  /* =========================================================
     SAVE FILE
     ========================================================= */

  async function saveCurrentFile() {
    const file =
      getSelectedFile();

    if (!file) {
      showToast(
        "Select a file first.",
        "error"
      );
      return;
    }

    const editor =
      document.getElementById(
        "bpCodeEditor"
      );

    if (editor) {
      file.content =
        editor.value;
    }

    const button =
      document.getElementById(
        "bpSaveFileBtn"
      );

    setButtonLoading(
      button,
      true,
      "Saving..."
    );

    try {
      const supabase =
        getSupabase();

      const result =
        await supabase
          .from("project_files")
          .update({
            content:
              file.content,
            updated_at:
              nowIso()
          })
          .eq(
            "id",
            file.id
          )
          .eq(
            "project_id",
            activeProject.id
          )
          .eq(
            "user_id",
            activeUser.id
          );

      if (result.error) {
        throw result.error;
      }

      const status =
        document.getElementById(
          "bpEditorStatus"
        );

      if (status) {
        status.textContent =
          "Saved";
      }

      showToast(
        `${getFileName(
          file.path
        )} saved.`,
        "success"
      );
    } catch (error) {
      console.error(
        "Save file error:",
        error
      );

      showToast(
        error?.message ||
          "Could not save file.",
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
     NEW FILE
     ========================================================= */

  function openNewFileModal() {
    const existing =
      document.getElementById(
        "bpNewFileModal"
      );

    if (existing) {
      existing.remove();
    }

    const modal =
      document.createElement("div");

    modal.id =
      "bpNewFileModal";

    modal.className =
      "bp-modal-backdrop";

    modal.innerHTML = `
      <div class="bp-modal">

        <button
          id="bpNewFileClose"
          class="bp-modal-close"
          type="button"
        >
          ×
        </button>

        <h2>
          New file
        </h2>

        <p class="bp-modal-subtitle">
          Add a file to the current
          project.
        </p>

        <form
          id="bpNewFileForm"
          class="bp-project-form"
        >

          <label>
            File path

            <input
              id="bpNewFilePath"
              type="text"
              placeholder="pages/about.html"
              required
            />
          </label>

          <label>
            Language

            <select
              id="bpNewFileLanguage"
            >
              <option value="html">
                HTML
              </option>

              <option value="css">
                CSS
              </option>

              <option value="javascript">
                JavaScript
              </option>

              <option value="json">
                JSON
              </option>

              <option value="text">
                Text
              </option>
            </select>
          </label>

          <button
            id="bpNewFileSubmit"
            class="bp-primary-btn bp-full-btn"
            type="submit"
          >
            Create file
          </button>

        </form>

      </div>
    `;

    document.body.appendChild(
      modal
    );

    document
      .getElementById(
        "bpNewFileClose"
      )
      ?.addEventListener(
        "click",
        () => modal.remove()
      );

    modal.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          modal
        ) {
          modal.remove();
        }
      }
    );

    document
      .getElementById(
        "bpNewFileForm"
      )
      ?.addEventListener(
        "submit",
        createNewFile
      );
  }

  async function createNewFile(
    event
  ) {
    event.preventDefault();

    const path =
      normalizePath(
        document.getElementById(
          "bpNewFilePath"
        )?.value
      );

    const language =
      document.getElementById(
        "bpNewFileLanguage"
      )?.value ||
      "text";

    const submit =
      document.getElementById(
        "bpNewFileSubmit"
      );

    if (!path) {
      showToast(
        "Enter a file path.",
        "error"
      );
      return;
    }

    if (
      path.includes("..")
    ) {
      showToast(
        "Invalid file path.",
        "error"
      );
      return;
    }

    if (
      activeFiles.some(
        file =>
          normalizePath(
            file.path
          ) === path
      )
    ) {
      showToast(
        "A file with this path already exists.",
        "error"
      );
      return;
    }

    setButtonLoading(
      submit,
      true,
      "Creating..."
    );

    try {
      const supabase =
        getSupabase();

      const content =
        getNewFileTemplate(
          path,
          language
        );

      const result =
        await supabase
          .from("project_files")
          .insert({
            project_id:
              activeProject.id,
            user_id:
              activeUser.id,
            path,
            content,
            language
          })
          .select("*")
          .single();

      if (result.error) {
        throw result.error;
      }

      activeFiles.push(
        result.data
      );

      selectedFileId =
        result.data.id;

      document
        .getElementById(
          "bpNewFileModal"
        )
        ?.remove();

      renderEditor();

      showToast(
        "File created.",
        "success"
      );
    } catch (error) {
      console.error(
        "Create file error:",
        error
      );

      showToast(
        error?.message ||
          "Could not create file.",
        "error"
      );
    } finally {
      setButtonLoading(
        submit,
        false
      );
    }
  }

  function getNewFileTemplate(
    path,
    language
  ) {
    if (
      language ===
      "html"
    ) {
      return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(
    getFileName(path)
  )}</title>
</head>
<body>
</body>
</html>`;
    }

    if (
      language ===
      "css"
    ) {
      return `/* ${path} */

`;
    }

    if (
      language ===
      "javascript"
    ) {
      return `// ${path}

`;
    }

    if (
      language ===
      "json"
    ) {
      return `{
  
}
`;
    }

    return "";
  }

  /* =========================================================
     DELETE FILE
     ========================================================= */

  async function deleteFile(
    fileId
  ) {
    const file =
      activeFiles.find(
        item =>
          item.id ===
          fileId
      );

    if (!file) {
      return;
    }

    if (
      normalizePath(
        file.path
      ) ===
      "index.html"
    ) {
      showToast(
        "index.html cannot be deleted.",
        "error"
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Delete ${file.path}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      const supabase =
        getSupabase();

      const result =
        await supabase
          .from("project_files")
          .delete()
          .eq(
            "id",
            file.id
          )
          .eq(
            "project_id",
            activeProject.id
          )
          .eq(
            "user_id",
            activeUser.id
          );

      if (result.error) {
        throw result.error;
      }

      activeFiles =
        activeFiles.filter(
          item =>
            item.id !==
            file.id
        );

      selectedFileId =
        findDefaultFileId();

      renderEditor();

      showToast(
        "File deleted.",
        "success"
      );
    } catch (error) {
      console.error(
        "Delete file error:",
        error
      );

      showToast(
        error?.message ||
          "Could not delete file.",
        "error"
      );
    }
  }
    /* =========================================================
     PROJECT INFO
     ========================================================= */

  function openProjectInfo() {
    if (!activeProject) {
      return;
    }

    const existing =
      document.getElementById(
        "bpProjectInfoModal"
      );

    if (existing) {
      existing.remove();
    }

    const modal =
      document.createElement("div");

    modal.id =
      "bpProjectInfoModal";

    modal.className =
      "bp-modal-backdrop";

    modal.innerHTML = `
      <div class="bp-modal">

        <button
          id="bpProjectInfoClose"
          class="bp-modal-close"
          type="button"
        >
          ×
        </button>

        <h2>
          Project information
        </h2>

        <div class="bp-info-list">

          <div class="bp-info-row">
            <span>Name</span>
            <strong>
              ${escapeHtml(
                activeProject.name ||
                  "Untitled"
              )}
            </strong>
          </div>

          <div class="bp-info-row">
            <span>Frontend</span>
            <strong>
              ${escapeHtml(
                activeProject.frontend ||
                  "html"
              )}
            </strong>
          </div>

          <div class="bp-info-row">
            <span>Backend</span>
            <strong>
              ${escapeHtml(
                activeProject.backend ||
                  "none"
              )}
            </strong>
          </div>

          <div class="bp-info-row">
            <span>Files</span>
            <strong>
              ${activeFiles.length}
            </strong>
          </div>

          <div class="bp-info-row">
            <span>Project ID</span>
            <strong class="bp-info-id">
              ${escapeHtml(
                activeProject.id
              )}
            </strong>
          </div>

        </div>

        <div class="bp-info-description">
          <span>Description</span>

          <p>
            ${escapeHtml(
              activeProject.description ||
                "No description."
            )}
          </p>
        </div>

      </div>
    `;

    document.body.appendChild(
      modal
    );

    document
      .getElementById(
        "bpProjectInfoClose"
      )
      ?.addEventListener(
        "click",
        () => modal.remove()
      );

    modal.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          modal
        ) {
          modal.remove();
        }
      }
    );
  }

  /* =========================================================
     PREVIEW
     ========================================================= */

  function buildPreviewDocument() {
    const htmlFile =
      activeFiles.find(
        file =>
          normalizePath(
            file.path
          ) ===
          "index.html"
      );

    if (!htmlFile) {
      return `
        <!doctype html>
        <html>
        <body>
          <h1>No index.html found</h1>
        </body>
        </html>
      `;
    }

    let html =
      htmlFile.content ||
      "";

    const cssFiles =
      activeFiles.filter(
        file =>
          isCssFile(
            file.path
          )
      );

    const jsFiles =
      activeFiles.filter(
        file =>
          isJsFile(
            file.path
          )
      );

    const cssContent =
      cssFiles
        .map(
          file =>
            `/* ${file.path} */\n${file.content || ""}`
        )
        .join("\n\n");

    const jsContent =
      jsFiles
        .filter(
          file =>
            normalizePath(
              file.path
            ) !==
            normalizePath(
              "script.js"
            ) ||
            !html.includes(
              "script.js"
            )
        )
        .map(
          file =>
            `/* ${file.path} */\n${file.content || ""}`
        )
        .join("\n\n");

    if (
      cssContent.trim()
    ) {
      if (
        /<\/head>/i.test(
          html
        )
      ) {
        html =
          html.replace(
            /<\/head>/i,
            `<style>\n${cssContent}\n</style>\n</head>`
          );
      } else {
        html =
          `<style>${cssContent}</style>\n${html}`;
      }
    }

    if (
      jsContent.trim()
    ) {
      if (
        /<\/body>/i.test(
          html
        )
      ) {
        html =
          html.replace(
            /<\/body>/i,
            `<script>\n${jsContent}\n<\/script>\n</body>`
          );
      } else {
        html +=
          `<script>\n${jsContent}\n<\/script>`;
      }
    }

    html =
      html.replace(
        /<script[^>]*src=["'][^"']*["'][^>]*>\s*<\/script>/gi,
        match => {
          const srcMatch =
            match.match(
              /src=["']([^"']+)["']/i
            );

          const src =
            srcMatch?.[1] || "";

          const cleanSrc =
            normalizePath(
              src.replace(
                /^\.\//,
                ""
              )
            );

          const sourceFile =
            activeFiles.find(
              file =>
                normalizePath(
                  file.path
                ) ===
                  cleanSrc ||
                getFileName(
                  file.path
                ) ===
                  getFileName(
                    cleanSrc
                  )
            );

          if (!sourceFile) {
            return match;
          }

          return `<script>\n${sourceFile.content || ""}\n<\/script>`;
        }
      );

    html =
      html.replace(
        /<link[^>]*href=["'][^"']+\.css["'][^>]*>/gi,
        match => {
          const hrefMatch =
            match.match(
              /href=["']([^"']+)["']/i
            );

          const href =
            hrefMatch?.[1] || "";

          const cleanHref =
            normalizePath(
              href.replace(
                /^\.\//,
                ""
              )
            );

          const sourceFile =
            activeFiles.find(
              file =>
                normalizePath(
                  file.path
                ) ===
                  cleanHref ||
                getFileName(
                  file.path
                ) ===
                  getFileName(
                    cleanHref
                  )
            );

          if (!sourceFile) {
            return match;
          }

          return `<style>\n${sourceFile.content || ""}\n</style>`;
        }
      );

    /*
      Public preview must not expose internal
      product branding.
    */

    html =
      html.replace(
        /BuildPilot AI/gi,
        activeProject.name ||
          "Website"
      );

    html =
      html.replace(
        /BuildPilot/gi,
        ""
      );

    return html;
  }

  function openPreview() {
    if (!activeProject) {
      return;
    }

    const existing =
      document.getElementById(
        "bpPreviewModal"
      );

    if (existing) {
      existing.remove();
    }

    const previewHtml =
      buildPreviewDocument();

    const modal =
      document.createElement("div");

    modal.id =
      "bpPreviewModal";

    modal.className =
      "bp-preview-backdrop";

    modal.innerHTML = `
      <div class="bp-preview-window">

        <div class="bp-preview-toolbar">

          <div>
            <strong>
              Preview
            </strong>

            <span>
              ${escapeHtml(
                activeProject.name ||
                  "Website"
              )}
            </span>
          </div>

          <div class="bp-preview-actions">

            <button
              id="bpRefreshPreview"
              class="bp-secondary-btn"
              type="button"
            >
              Refresh
            </button>

            <button
              id="bpClosePreview"
              class="bp-secondary-btn"
              type="button"
            >
              Close
            </button>

          </div>

        </div>

        <div
          class="bp-preview-frame-wrap"
        >
          <iframe
            id="bpPreviewFrame"
            class="bp-preview-frame"
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
            title="Project preview"
          ></iframe>
        </div>

      </div>
    `;

    document.body.appendChild(
      modal
    );

    const frame =
      document.getElementById(
        "bpPreviewFrame"
      );

    if (frame) {
      frame.srcdoc =
        previewHtml;
    }

    document
      .getElementById(
        "bpClosePreview"
      )
      ?.addEventListener(
        "click",
        () => modal.remove()
      );

    document
      .getElementById(
        "bpRefreshPreview"
      )
      ?.addEventListener(
        "click",
        () => {
          const target =
            document.getElementById(
              "bpPreviewFrame"
            );

          if (target) {
            target.srcdoc =
              buildPreviewDocument();
          }
        }
      );

    modal.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          modal
        ) {
          modal.remove();
        }
      }
    );
  }

  /* =========================================================
     AI CHAT HELPERS
     ========================================================= */

  function resetAIChat() {
    const chat =
      document.getElementById(
        "bpAIChat"
      );

    if (!chat) {
      return;
    }

    chat.innerHTML = `
      <div class="bp-ai-welcome">

        <div
          class="bp-ai-welcome-icon"
        >
          AI
        </div>

        <h3>
          What should I change?
        </h3>

        <p>
          Tell the AI exactly what you
          want changed in the current
          project.
        </p>

        <div
          class="bp-ai-suggestions"
        >

          <button
            data-ai-suggestion="Make the homepage modern and professional."
          >
            Make it modern
          </button>

          <button
            data-ai-suggestion="Create a responsive navigation bar."
          >
            Add navbar
          </button>

          <button
            data-ai-suggestion="Improve the mobile responsive design."
          >
            Improve mobile
          </button>

        </div>

      </div>
    `;

    chat
      .querySelectorAll(
        "[data-ai-suggestion]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            const input =
              document.getElementById(
                "bpAIInput"
              );

            if (input) {
              input.value =
                button.dataset
                  .aiSuggestion ||
                "";

              input.focus();
            }
          }
        );
      });

    pendingAIImage =
      null;

    renderPendingImage();
  }

  function appendAIMessage(
    role,
    message,
    meta = ""
  ) {
    const chat =
      document.getElementById(
        "bpAIChat"
      );

    if (!chat) {
      return;
    }

    const welcome =
      chat.querySelector(
        ".bp-ai-welcome"
      );

    if (welcome) {
      welcome.remove();
    }

    const item =
      document.createElement(
        "div"
      );

    item.className =
      `bp-chat-message bp-chat-${role}`;

    item.innerHTML = `
      <div
        class="bp-chat-avatar"
      >
        ${
          role === "user"
            ? "U"
            : "AI"
        }
      </div>

      <div
        class="bp-chat-bubble"
      >
        <div
          class="bp-chat-text"
        >
          ${formatAIText(message)}
        </div>

        ${
          meta
            ? `
              <div
                class="bp-chat-meta"
              >
                ${escapeHtml(
                  meta
                )}
              </div>
            `
            : ""
        }
      </div>
    `;

    chat.appendChild(
      item
    );

    chat.scrollTop =
      chat.scrollHeight;
  }

  function formatAIText(
    text
  ) {
    let value =
      escapeHtml(
        text || ""
      );

    value =
      value.replace(
        /```([\s\S]*?)```/g,
        "<pre><code>$1</code></pre>"
      );

    value =
      value.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
      );

    value =
      value.replace(
        /\n/g,
        "<br>"
      );

    return value;
  }

  function appendAILoading() {
    const chat =
      document.getElementById(
        "bpAIChat"
      );

    if (!chat) {
      return null;
    }

    const item =
      document.createElement(
        "div"
      );

    item.className =
      "bp-chat-message bp-chat-ai bp-ai-loading";

    item.innerHTML = `
      <div
        class="bp-chat-avatar"
      >
        AI
      </div>

      <div
        class="bp-chat-bubble"
      >
        <div
          class="bp-loading-dots"
        >
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;

    chat.appendChild(
      item
    );

    chat.scrollTop =
      chat.scrollHeight;

    return item;
  }

  /* =========================================================
     IMAGE UPLOAD
     ========================================================= */

  async function handleAIImageUpload(
    event
  ) {
    const file =
      event.target
        ?.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      showToast(
        "Please select an image.",
        "error"
      );
      return;
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      showToast(
        "Image must be smaller than 10 MB.",
        "error"
      );
      return;
    }

    pendingAIImage = {
      file,
      localUrl:
        URL.createObjectURL(
          file
        ),
      remoteUrl: null,
      name: file.name,
      uploading: true
    };

    renderPendingImage();

    try {
      const remoteUrl =
        await uploadAIImage(
          file
        );

      if (
        pendingAIImage
      ) {
        pendingAIImage.remoteUrl =
          remoteUrl;

        pendingAIImage.uploading =
          false;
      }

      renderPendingImage();

      showToast(
        "Image uploaded.",
        "success"
      );
    } catch (error) {
      console.error(
        "AI image upload error:",
        error
      );

      pendingAIImage =
        null;

      renderPendingImage();

      showToast(
        error?.message ||
          "Could not upload image.",
        "error"
      );
    }
  }

  async function uploadAIImage(
    file
  ) {
    const supabase =
      getSupabase();

    const extension =
      getFileExtension(
        file.name
      ) || "png";

    const path =
      `${activeUser.id}/references/${Date.now()}-${uuid()}.${extension}`;

    const uploadResult =
      await supabase
        .storage
        .from("uploads")
        .upload(
          path,
          file,
          {
            contentType:
              file.type,
            upsert: false
          }
        );

    if (
      uploadResult.error
    ) {
      throw uploadResult.error;
    }

    const publicResult =
      supabase
        .storage
        .from("uploads")
        .getPublicUrl(
          path
        );

    const publicUrl =
      publicResult
        ?.data
        ?.publicUrl;

    if (publicUrl) {
      return publicUrl;
    }

    const signedResult =
      await supabase
        .storage
        .from("uploads")
        .createSignedUrl(
          path,
          3600
        );

    if (
      signedResult.error
    ) {
      throw signedResult.error;
    }

    return signedResult
      .data
      ?.signedUrl;
  }

  function renderPendingImage() {
    const container =
      document.getElementById(
        "bpAIImagePreview"
      );

    if (!container) {
      return;
    }

    if (!pendingAIImage) {
      container.innerHTML =
        "";
      return;
    }

    container.innerHTML = `
      <div
        class="bp-ai-uploaded-image"
      >

        <img
          src="${escapeAttribute(
            pendingAIImage.localUrl ||
              pendingAIImage.remoteUrl ||
              ""
          )}"
          alt="Uploaded reference"
        />

        <div
          class="bp-ai-uploaded-image-info"
        >
          <strong>
            ${escapeHtml(
              pendingAIImage.name ||
                "Image"
            )}
          </strong>

          <span>
            ${
              pendingAIImage.uploading
                ? "Uploading..."
                : "Ready for AI"
            }
          </span>
        </div>

        <button
          id="bpRemoveAIImage"
          type="button"
          class="bp-remove-image"
        >
          ×
        </button>

      </div>
    `;

    document
      .getElementById(
        "bpRemoveAIImage"
      )
      ?.addEventListener(
        "click",
        () => {
          if (
            pendingAIImage
              ?.localUrl
          ) {
            URL.revokeObjectURL(
              pendingAIImage.localUrl
            );
          }

          pendingAIImage =
            null;

          const input =
            document.getElementById(
              "bpAIImageInput"
            );

          if (input) {
            input.value = "";
          }

          renderPendingImage();
        }
      );
  }

  /* =========================================================
     AI FUNCTION CALL
     ========================================================= */

  async function callGenerateFunction(
    instruction,
    extra = {}
  ) {
    const session =
      await getSession();

    if (!session?.access_token) {
      throw new Error(
        "Please login first."
      );
    }

    if (
      !activeProject?.id
    ) {
      throw new Error(
        "Open a project first."
      );
    }

    const files =
      activeFiles.map(
        file => ({
          id: file.id,
          path: file.path,
          content:
            file.content || "",
          language:
            file.language ||
            getFileExtension(
              file.path
            )
        })
      );

    const payload = {
      projectId:
        activeProject.id,

      instruction:
        instruction,

      prompt:
        instruction,

      projectName:
        activeProject.name ||
        "Website",

      frontend:
        activeProject.frontend ||
        "html",

      backend:
        activeProject.backend ||
        "none",

      files,

      ...extra
    };

    const response =
      await fetch(
        `${SUPABASE_URL}/functions/v1/${GENERATE_FUNCTION}`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${session.access_token}`,

            apikey:
              SUPABASE_KEY
          },

          body:
            JSON.stringify(
              payload
            )
        }
      );

    const raw =
      await response.text();

    let data = {};

    try {
      data =
        raw
          ? JSON.parse(raw)
          : {};
    } catch {
      data = {
        raw
      };
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          raw ||
          `Edge Function returned ${response.status}`
      );
    }

    return data;
  }

  /* =========================================================
     AI PROJECT MODIFICATION
     ========================================================= */

  async function submitAIInstruction() {
    const input =
      document.getElementById(
        "bpAIInput"
      );

    const button =
      document.getElementById(
        "bpAISendBtn"
      );

    if (!input) {
      return;
    }

    const instruction =
      input.value.trim();

    if (!instruction) {
      showToast(
        "Tell the AI what you want changed.",
        "error"
      );
      input.focus();
      return;
    }

    if (!activeProject) {
      showToast(
        "Open a project first.",
        "error"
      );
      return;
    }

    if (
      pendingAIImage
        ?.uploading
    ) {
      showToast(
        "Please wait for the image upload to finish.",
        "error"
      );
      return;
    }

    appendAIMessage(
      "user",
      instruction,
      pendingAIImage
        ? "Image attached"
        : ""
    );

    input.value = "";

    const loading =
      appendAILoading();

    setButtonLoading(
      button,
      true,
      "Working..."
    );

    try {
      const imageUrl =
        pendingAIImage
          ?.remoteUrl ||
        null;

      const result =
        await callGenerateFunction(
          instruction,
          {
            action:
              "modify_project",

            imageUrl,

            currentFileId:
              selectedFileId
          }
        );

      if (loading) {
        loading.remove();
      }

      /*
        IMPORTANT:
        The backend should return changedFiles/files.
        We merge them into the current project,
        instead of creating a new starter project.
      */

      const changedFiles =
        normalizeReturnedFiles(
          result
        );

      if (
        changedFiles.length
      ) {
        await applyAIFileChanges(
          changedFiles
        );
      }

      const assistantMessage =
        result?.message ||
        result?.response ||
        result?.text ||
        (
          changedFiles.length
            ? `Updated ${changedFiles.length} file(s) in the current project.`
            : "The AI completed the request."
        );

      appendAIMessage(
        "ai",
        assistantMessage,
        changedFiles.length
          ? `${changedFiles.length} file(s) updated`
          : ""
      );

      pendingAIImage =
        null;

      const imageInput =
        document.getElementById(
          "bpAIImageInput"
        );

      if (imageInput) {
        imageInput.value =
          "";
      }

      renderPendingImage();

      showToast(
        changedFiles.length
          ? "Project updated successfully."
          : "AI request completed.",
        "success"
      );

      /*
        Refresh from database so editor and
        preview always use the current files.
      */

      await refreshCurrentProject();
    } catch (error) {
      if (loading) {
        loading.remove();
      }

      console.error(
        "AI modification error:",
        error
      );

      appendAIMessage(
        "ai",
        `Error: ${
          error?.message ||
          "AI request failed."
        }`
      );

      showToast(
        error?.message ||
          "AI request failed.",
        "error"
      );
    } finally {
      setButtonLoading(
        button,
        false
      );
    }
  }

  function normalizeReturnedFiles(
    result
  ) {
    const candidates = [
      result?.changedFiles,
      result?.files,
      result?.projectFiles,
      result?.changes
    ];

    let files = [];

    for (
      const candidate of candidates
    ) {
      if (
        Array.isArray(
          candidate
        ) &&
        candidate.length
      ) {
        files =
          candidate;
        break;
      }
    }

    return files
      .map(file => {
        if (
          typeof file ===
          "string"
        ) {
          return null;
        }

        const path =
          normalizePath(
            file?.path ||
              file?.filePath ||
              file?.name
          );

        if (!path) {
          return null;
        }

        const content =
          file?.content ??
          file?.code ??
          file?.text ??
          "";

        return {
          id:
            file?.id ||
            null,

          path,

          content:
            String(
              content
            ),

          language:
            file?.language ||
            getFileExtension(
              path
            )
        };
      })
      .filter(Boolean);
  }

  async function applyAIFileChanges(
    changedFiles
  ) {
    const supabase =
      getSupabase();

    for (
      const changed
      of changedFiles
    ) {
      const existing =
        activeFiles.find(
          file =>
            normalizePath(
              file.path
            ) ===
            normalizePath(
              changed.path
            )
        );

      if (existing) {
        const result =
          await supabase
            .from(
              "project_files"
            )
            .update({
              content:
                changed.content,

              language:
                changed.language ||
                existing.language ||
                getFileExtension(
                  changed.path
                ),

              updated_at:
                nowIso()
            })
            .eq(
              "id",
              existing.id
            )
            .eq(
              "project_id",
              activeProject.id
            )
            .eq(
              "user_id",
              activeUser.id
            );

        if (result.error) {
          throw result.error;
        }

        existing.content =
          changed.content;

        existing.language =
          changed.language ||
          existing.language;
      } else {
        const result =
          await supabase
            .from(
              "project_files"
            )
            .insert({
              project_id:
                activeProject.id,

              user_id:
                activeUser.id,

              path:
                changed.path,

              content:
                changed.content,

              language:
                changed.language ||
                getFileExtension(
                  changed.path
                )
            })
            .select("*")
            .single();

        if (result.error) {
          throw result.error;
        }

        activeFiles.push(
          result.data
        );
      }
    }
  }

  async function refreshCurrentProject() {
    if (
      !activeProject?.id ||
      !activeUser?.id
    ) {
      return;
    }

    const supabase =
      getSupabase();

    const result =
      await supabase
        .from(
          "project_files"
        )
        .select("*")
        .eq(
          "project_id",
          activeProject.id
        )
        .eq(
          "user_id",
          activeUser.id
        )
        .order(
          "path",
          {
            ascending: true
          }
        );

    if (result.error) {
      throw result.error;
    }

    activeFiles =
      result.data || [];

    if (
      !activeFiles.some(
        file =>
          file.id ===
          selectedFileId
      )
    ) {
      selectedFileId =
        findDefaultFileId();
    }

    renderEditor();

    if (
      selectedFileId
    ) {
      selectEditorFile(
        selectedFileId
      );
    }
  }

  /* =========================================================
     AI IMAGE GENERATION
     ========================================================= */

  async function generateImage() {
    if (!activeProject) {
      showToast(
        "Open a project first.",
        "error"
      );
      return;
    }

    const input =
      document.getElementById(
        "bpAIInput"
      );

    const button =
      document.getElementById(
        "bpGenerateImageBtn"
      );

    const prompt =
      input?.value.trim();

    if (!prompt) {
      showToast(
        "Describe the image you want to generate.",
        "error"
      );

      input?.focus();

      return;
    }

    setButtonLoading(
      button,
      true,
      "Generating..."
    );

    appendAIMessage(
      "user",
      `Generate image: ${prompt}`
    );

    const loading =
      appendAILoading();

    try {
      const result =
        await callGenerateFunction(
          prompt,
          {
            action:
              "generate_image",

            imagePrompt:
              prompt
          }
        );

      if (loading) {
        loading.remove();
      }

      const imageUrl =
        result?.imageUrl ||
        result?.url ||
        result?.image?.url ||
        result?.data?.url ||
        null;

      if (
        imageUrl
      ) {
        generatedImages.push(
          {
            url: imageUrl,
            prompt
          }
        );

        appendAIMessage(
          "ai",
          `Image generated successfully.\n\n${imageUrl}`
        );

        showGeneratedImage(
          imageUrl
        );
      } else {
        appendAIMessage(
          "ai",
          result?.message ||
            result?.text ||
            "The image generation request completed, but no image URL was returned."
        );
      }
    } catch (error) {
      if (loading) {
        loading.remove();
      }

      console.error(
        "Image generation error:",
        error
      );

      appendAIMessage(
        "ai",
        `Image generation failed: ${
          error?.message ||
          "Unknown error"
        }`
      );

      showToast(
        error?.message ||
          "Image generation failed.",
        "error"
      );
    } finally {
      setButtonLoading(
        button,
        false
      );
    }
  }

  function showGeneratedImage(
    imageUrl
  ) {
    const chat =
      document.getElementById(
        "bpAIChat"
      );

    if (!chat) {
      return;
    }

    const item =
      document.createElement(
        "div"
      );

    item.className =
      "bp-generated-image-card";

    item.innerHTML = `
      <img
        src="${escapeAttribute(
          imageUrl
        )}"
        alt="Generated image"
      />

      <div>
        <button
          type="button"
          class="bp-secondary-btn"
          data-use-generated-image
        >
          Use in project
        </button>
      </div>
    `;

    chat.appendChild(
      item
    );

    chat.scrollTop =
      chat.scrollHeight;

    item
      .querySelector(
        "[data-use-generated-image]"
      )
      ?.addEventListener(
        "click",
        () => {
          useGeneratedImage(
            imageUrl
          );
        }
      );
  }

  async function useGeneratedImage(
    imageUrl
  ) {
    if (!imageUrl) {
      return;
    }

    const instruction =
      `Use this generated image in the current project where it is visually appropriate: ${imageUrl}`;

    const input =
      document.getElementById(
        "bpAIInput"
      );

    if (input) {
      input.value =
        instruction;

      input.focus();
    }

    showToast(
      "Image added to the AI instruction.",
      "success"
    );
  }
  /* =========================================================
   BUILD PILOT AI — APP.JS
   PART 2 / 3
   FILES • EDITOR • PROJECT • PREVIEW • PUBLISH
========================================================= */


/* =========================================================
   FILE EXPLORER
========================================================= */

function renderFileExplorer() {
    const list = document.getElementById("filesList");

    if (!list) return;

    if (!Array.isArray(activeFiles) || activeFiles.length === 0) {
        list.innerHTML = `
            <div class="empty-files">
                <div class="empty-files-icon">📁</div>
                <div>No files</div>
                <button class="small-btn" onclick="openCreateFileModal()">
                    + New File
                </button>
            </div>
        `;
        return;
    }

    const sortedFiles = [...activeFiles].sort((a, b) => {
        const ap = normalizePath(a.path || "");
        const bp = normalizePath(b.path || "");

        if (ap === "index.html") return -1;
        if (bp === "index.html") return 1;

        return ap.localeCompare(bp);
    });

    list.innerHTML = sortedFiles.map(file => {
        const path = normalizePath(file.path || "untitled");
        const isSelected = String(file.id) === String(selectedFileId);

        return `
            <div
                class="file-item ${isSelected ? "active" : ""}"
                data-file-id="${escapeAttribute(file.id)}"
                onclick="selectEditorFile('${escapeAttribute(file.id)}')"
            >
                <span class="file-icon">${getFileIcon(path)}</span>

                <span class="file-name" title="${escapeAttribute(path)}">
                    ${escapeHtml(path)}
                </span>

                ${
                    path !== "index.html"
                    ? `
                        <button
                            class="file-delete"
                            title="Delete file"
                            onclick="event.stopPropagation(); deleteProjectFile('${escapeAttribute(file.id)}')"
                        >
                            ×
                        </button>
                    `
                    : ""
                }
            </div>
        `;
    }).join("");
}


function getFileIcon(path) {
    const ext = getFileExtension(path);

    if (ext === "html") return "🌐";
    if (ext === "css") return "🎨";
    if (ext === "js") return "⚡";
    if (ext === "jsx") return "⚛️";
    if (ext === "tsx") return "⚛️";
    if (ext === "json") return "🧩";
    if (ext === "md") return "📝";
    if (ext === "svg") return "🖼️";
    if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp") {
        return "🖼️";
    }

    return "📄";
}


/* =========================================================
   EDITOR
========================================================= */

function selectEditorFile(fileId) {
    const file = activeFiles.find(
        item => String(item.id) === String(fileId)
    );

    if (!file) return;

    selectedFileId = file.id;

    renderFileExplorer();
    renderEditor(file);
}


function renderEditor(file) {
    const editor = document.getElementById("codeEditor");
    const lineNumbers = document.getElementById("lineNumbers");
    const fileTitle = document.getElementById("currentFileName");

    if (!editor) return;

    const content = file.content || "";

    editor.value = content;

    if (fileTitle) {
        fileTitle.textContent = normalizePath(file.path);
    }

    if (lineNumbers) {
        const count = Math.max(1, content.split("\n").length);

        lineNumbers.innerHTML = Array.from(
            { length: count },
            (_, index) => `<div>${index + 1}</div>`
        ).join("");
    }

    editor.dataset.fileId = file.id;

    updateEditorLanguage(file.path);
}


function updateEditorLanguage(path) {
    const language = document.getElementById("editorLanguage");

    if (!language) return;

    const ext = getFileExtension(path);

    const labels = {
        html: "HTML",
        css: "CSS",
        js: "JavaScript",
        jsx: "React JSX",
        ts: "TypeScript",
        tsx: "React TSX",
        json: "JSON",
        md: "Markdown",
        svg: "SVG"
    };

    language.textContent = labels[ext] || "Text";
}


function updateLineNumbers() {
    const editor = document.getElementById("codeEditor");
    const lineNumbers = document.getElementById("lineNumbers");

    if (!editor || !lineNumbers) return;

    const count = Math.max(
        1,
        editor.value.split("\n").length
    );

    lineNumbers.innerHTML = Array.from(
        { length: count },
        (_, index) => `<div>${index + 1}</div>`
    ).join("");

    lineNumbers.scrollTop = editor.scrollTop;
}


function syncEditorScroll() {
    const editor = document.getElementById("codeEditor");
    const lineNumbers = document.getElementById("lineNumbers");

    if (!editor || !lineNumbers) return;

    lineNumbers.scrollTop = editor.scrollTop;
}


function saveEditorToMemory() {
    const editor = document.getElementById("codeEditor");

    if (!editor || !selectedFileId) {
        return false;
    }

    const file = activeFiles.find(
        item => String(item.id) === String(selectedFileId)
    );

    if (!file) return false;

    file.content = editor.value;

    return true;
}


async function saveCurrentFile() {
    if (!saveEditorToMemory()) {
        showToast("No file selected", "error");
        return;
    }

    const file = activeFiles.find(
        item => String(item.id) === String(selectedFileId)
    );

    if (!file) return;

    try {
        const supabase = getSupabase();

        const { error } = await supabase
            .from("project_files")
            .update({
                content: file.content,
                updated_at: nowIso()
            })
            .eq("id", file.id)
            .eq("project_id", activeProject.id);

        if (error) throw error;

        file.updated_at = nowIso();

        showToast("File saved ✓", "success");

        updatePreview();

    } catch (error) {
        console.error("saveCurrentFile:", error);

        showToast(
            error.message || "Unable to save file",
            "error"
        );
    }
}


/* =========================================================
   KEYBOARD SHORTCUTS
========================================================= */

function setupEditorShortcuts() {
    const editor = document.getElementById("codeEditor");

    if (!editor || editor.dataset.shortcutsReady === "true") {
        return;
    }

    editor.dataset.shortcutsReady = "true";

    editor.addEventListener("input", () => {
        saveEditorToMemory();
        updateLineNumbers();
    });

    editor.addEventListener("scroll", syncEditorScroll);

    editor.addEventListener("keydown", event => {

        /* SAVE */

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            saveCurrentFile();
            return;
        }


        /* TAB */

        if (event.key === "Tab") {
            event.preventDefault();

            const start = editor.selectionStart;
            const end = editor.selectionEnd;

            const value = editor.value;

            editor.value =
                value.substring(0, start) +
                "    " +
                value.substring(end);

            editor.selectionStart = editor.selectionEnd = start + 4;

            saveEditorToMemory();
            updateLineNumbers();
        }


        /* AUTO-CLOSE BRACKETS */

        const pairs = {
            "(": ")",
            "[": "]",
            "{": "}",
            '"': '"',
            "'": "'",
            "`": "`"
        };

        if (pairs[event.key]) {
            const start = editor.selectionStart;
            const end = editor.selectionEnd;

            if (start !== end) return;

            const closing = pairs[event.key];

            event.preventDefault();

            editor.setRangeText(
                event.key + closing,
                start,
                end,
                "end"
            );

            editor.selectionStart = editor.selectionEnd = start + 1;

            saveEditorToMemory();
            updateLineNumbers();
        }
    });
}


/* =========================================================
   CREATE FILE
========================================================= */

function openCreateFileModal() {
    const modal = document.getElementById("createFileModal");

    if (!modal) {
        createFileModal();
        return;
    }

    modal.classList.add("open");

    const input = document.getElementById("newFilePath");

    if (input) {
        input.value = "";
        setTimeout(() => input.focus(), 50);
    }
}


function closeCreateFileModal() {
    const modal = document.getElementById("createFileModal");

    if (modal) {
        modal.classList.remove("open");
    }
}


function createFileModal() {
    if (document.getElementById("createFileModal")) {
        openCreateFileModal();
        return;
    }

    const modal = document.createElement("div");

    modal.id = "createFileModal";
    modal.className = "modal";

    modal.innerHTML = `
        <div class="modal-backdrop" onclick="closeCreateFileModal()"></div>

        <div class="modal-card">

            <div class="modal-header">
                <div>
                    <h3>New File</h3>
                    <p>Create a file inside this project.</p>
                </div>

                <button
                    class="modal-close"
                    onclick="closeCreateFileModal()"
                >
                    ×
                </button>
            </div>

            <div class="modal-body">

                <label class="input-label">
                    File path
                </label>

                <input
                    id="newFilePath"
                    class="text-input"
                    placeholder="example.js"
                    autocomplete="off"
                />

                <div class="file-examples">
                    Examples:
                    <code>about.html</code>
                    <code>style.css</code>
                    <code>script.js</code>
                    <code>components/header.html</code>
                </div>

                <label class="input-label">
                    Initial content
                </label>

                <textarea
                    id="newFileContent"
                    class="text-area"
                    rows="8"
                    placeholder="Write initial code..."
                ></textarea>

            </div>

            <div class="modal-footer">

                <button
                    class="secondary-btn"
                    onclick="closeCreateFileModal()"
                >
                    Cancel
                </button>

                <button
                    class="primary-btn"
                    onclick="createProjectFile()"
                >
                    Create File
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(modal);

    modal.classList.add("open");

    const input = document.getElementById("newFilePath");

    if (input) {
        setTimeout(() => input.focus(), 50);
    }
}


async function createProjectFile() {
    const pathInput = document.getElementById("newFilePath");
    const contentInput = document.getElementById("newFileContent");

    if (!pathInput) return;

    const path = normalizePath(pathInput.value);
    const content = contentInput ? contentInput.value : "";

    if (!path) {
        showToast("Enter a file path", "error");
        return;
    }

    if (!/^[a-zA-Z0-9_\-./]+$/.test(path)) {
        showToast("Invalid file path", "error");
        return;
    }

    if (
        path.startsWith("/") ||
        path.includes("..") ||
        path.endsWith("/")
    ) {
        showToast("Invalid file path", "error");
        return;
    }

    const exists = activeFiles.some(
        file => normalizePath(file.path).toLowerCase() === path.toLowerCase()
    );

    if (exists) {
        showToast("File already exists", "error");
        return;
    }

    if (!activeProject) {
        showToast("Open a project first", "error");
        return;
    }

    try {
        const supabase = getSupabase();

        const {
            data,
            error
        } = await supabase
            .from("project_files")
            .insert({
                project_id: activeProject.id,
                path,
                content,
                created_at: nowIso(),
                updated_at: nowIso()
            })
            .select()
            .single();

        if (error) throw error;

        activeFiles.push(data);

        closeCreateFileModal();

        renderFileExplorer();

        selectEditorFile(data.id);

        updatePreview();

        showToast("File created ✓", "success");

    } catch (error) {
        console.error("createProjectFile:", error);

        showToast(
            error.message || "Unable to create file",
            "error"
        );
    }
}


/* =========================================================
   DELETE FILE
========================================================= */

async function deleteProjectFile(fileId) {
    const file = activeFiles.find(
        item => String(item.id) === String(fileId)
    );

    if (!file) return;

    if (normalizePath(file.path) === "index.html") {
        showToast("index.html cannot be deleted", "error");
        return;
    }

    const confirmed = window.confirm(
        `Delete "${file.path}"?`
    );

    if (!confirmed) return;

    try {
        const supabase = getSupabase();

        const { error } = await supabase
            .from("project_files")
            .delete()
            .eq("id", file.id)
            .eq("project_id", activeProject.id);

        if (error) throw error;

        activeFiles = activeFiles.filter(
            item => String(item.id) !== String(fileId)
        );

        if (String(selectedFileId) === String(fileId)) {
            const nextFile = activeFiles.find(
                item => normalizePath(item.path) === "index.html"
            ) || activeFiles[0];

            selectedFileId = nextFile ? nextFile.id : null;

            if (nextFile) {
                renderEditor(nextFile);
            }
        }

        renderFileExplorer();
        updatePreview();

        showToast("File deleted", "success");

    } catch (error) {
        console.error("deleteProjectFile:", error);

        showToast(
            error.message || "Unable to delete file",
            "error"
        );
    }
}


/* =========================================================
   PROJECT SAVE
========================================================= */

async function saveAllProjectFiles() {
    if (!activeProject) {
        showToast("No project opened", "error");
        return false;
    }

    saveEditorToMemory();

    try {
        const supabase = getSupabase();

        for (const file of activeFiles) {
            const { error } = await supabase
                .from("project_files")
                .update({
                    content: file.content || "",
                    updated_at: nowIso()
                })
                .eq("id", file.id)
                .eq("project_id", activeProject.id);

            if (error) {
                throw error;
            }
        }

        showToast("All files saved ✓", "success");

        return true;

    } catch (error) {
        console.error("saveAllProjectFiles:", error);

        showToast(
            error.message || "Unable to save files",
            "error"
        );

        return false;
    }
}


/* =========================================================
   LOAD PROJECT FILES
========================================================= */

async function loadProjectFiles(projectId) {
    if (!projectId) return [];

    try {
        const supabase = getSupabase();

        const {
            data,
            error
        } = await supabase
            .from("project_files")
            .select("*")
            .eq("project_id", projectId)
            .order("path", { ascending: true });

        if (error) throw error;

        return data || [];

    } catch (error) {
        console.error("loadProjectFiles:", error);

        showToast(
            error.message || "Unable to load project files",
            "error"
        );

        return [];
    }
}


/* =========================================================
   OPEN PROJECT
========================================================= */

async function openProject(projectId) {
    if (!projectId) return;

    try {
        showToast("Opening project...", "info");

        const supabase = getSupabase();

        const {
            data: project,
            error: projectError
        } = await supabase
            .from("projects")
            .select("*")
            .eq("id", projectId)
            .single();

        if (projectError) throw projectError;

        const files = await loadProjectFiles(projectId);

        activeProject = project;
        activeFiles = files;

        if (!activeProject) {
            throw new Error("Project not found");
        }

        if (!activeFiles.length) {
            showToast("Project has no files", "warning");
        }

        const indexFile = activeFiles.find(
            file => normalizePath(file.path) === "index.html"
        );

        const firstFile = indexFile || activeFiles[0];

        selectedFileId = firstFile ? firstFile.id : null;

        renderProjectWorkspace();

        if (firstFile) {
            renderEditor(firstFile);
        }

        updatePreview();

        showToast("Project opened ✓", "success");

    } catch (error) {
        console.error("openProject:", error);

        showToast(
            error.message || "Unable to open project",
            "error"
        );
    }
}


/* =========================================================
   WORKSPACE
========================================================= */

function renderProjectWorkspace() {
    const workspace = document.getElementById("projectWorkspace");

    if (!workspace) return;

    workspace.classList.remove("hidden");

    const emptyState = document.getElementById("projectEmptyState");

    if (emptyState) {
        emptyState.classList.add("hidden");
    }

    const projectName = document.getElementById("workspaceProjectName");

    if (projectName) {
        projectName.textContent =
            activeProject?.name || "Untitled Project";
    }

    renderFileExplorer();

    setupEditorShortcuts();

    const editor = document.getElementById("codeEditor");

    if (editor) {
        updateLineNumbers();
    }
}


/* =========================================================
   PREVIEW
========================================================= */

function buildPreviewDocument() {
    const htmlFile = activeFiles.find(
        file => normalizePath(file.path) === "index.html"
    );

    if (!htmlFile) {
        return `
            <!doctype html>
            <html>
                <body style="
                    font-family:Arial;
                    padding:40px;
                    background:#f5f5f5;
                ">
                    <h2>No index.html</h2>
                    <p>Create an index.html file to preview this project.</p>
                </body>
            </html>
        `;
    }

    let html = htmlFile.content || "";

    const cssFiles = activeFiles.filter(isCssFile);
    const jsFiles = activeFiles.filter(isJsFile);

    const css = cssFiles
        .map(file => file.content || "")
        .join("\n");

    const js = jsFiles
        .map(file => file.content || "")
        .join("\n");

    if (css.trim()) {
        if (/<\/head>/i.test(html)) {
            html = html.replace(
                /<\/head>/i,
                `<style>${css}</style></head>`
            );
        } else {
            html =
                `<style>${css}</style>\n` +
                html;
        }
    }

    if (js.trim()) {
        if (/<\/body>/i.test(html)) {
            html = html.replace(
                /<\/body>/i,
                `<script>${js}<\/script></body>`
            );
        } else {
            html += `<script>${js}<\/script>`;
        }
    }

    return html;
}


function updatePreview() {
    const frame = document.getElementById("previewFrame");

    if (!frame) return;

    const html = buildPreviewDocument();

    try {
        frame.srcdoc = html;
    } catch (error) {
        console.error("preview:", error);
    }
}


function refreshPreview() {
    saveEditorToMemory();

    updatePreview();

    showToast("Preview refreshed", "success");
}


function openFullPreview() {
    const html = buildPreviewDocument();

    const previewWindow = window.open(
        "",
        "_blank",
        "noopener,noreferrer"
    );

    if (!previewWindow) {
        showToast(
            "Please allow popups for preview",
            "error"
        );
        return;
    }

    previewWindow.document.open();
    previewWindow.document.write(html);
    previewWindow.document.close();
}


/* =========================================================
   CLEAN PUBLIC PREVIEW
========================================================= */

function buildPublicPreviewHTML() {
    const html = buildPreviewDocument();

    const title =
        activeProject?.name ||
        "Website";

    const cleanHead = `
        <title>${escapeHtml(title)}</title>
        <meta name="viewport"
              content="width=device-width, initial-scale=1">
        <meta name="referrer" content="no-referrer">
    `;

    if (/<head[^>]*>/i.test(html)) {
        html = html.replace(
            /<head([^>]*)>/i,
            `<head$1>${cleanHead}`
        );
    } else {
        html = `
            <!doctype html>
            <html>
                <head>${cleanHead}</head>
                <body>
                    ${html}
                </body>
            </html>
        `;
    }

    return html;
}


/* =========================================================
   SHARE / PUBLISH
========================================================= */

async function publishProject() {
    if (!activeProject) {
        showToast("Open a project first", "error");
        return;
    }

    const saved = await saveAllProjectFiles();

    if (!saved) return;

    try {
        const supabase = getSupabase();

        const slug =
            activeProject.slug ||
            createSlug(activeProject.name || "website");

        const {
            data,
            error
        } = await supabase
            .from("projects")
            .update({
                slug,
                updated_at: nowIso()
            })
            .eq("id", activeProject.id)
            .select()
            .single();

        if (error) throw error;

        activeProject = data;

        const publicUrl =
            `${window.location.origin}` +
            `${window.location.pathname}` +
            `?public=${encodeURIComponent(activeProject.id)}`;

        showPublishResult(publicUrl);

    } catch (error) {
        console.error("publishProject:", error);

        showToast(
            error.message || "Unable to publish project",
            "error"
        );
    }
}


function createSlug(value) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) ||
        `site-${Date.now()}`;
}


function showPublishResult(url) {
    const existing = document.getElementById("publishModal");

    if (existing) {
        existing.remove();
    }

    const modal = document.createElement("div");

    modal.id = "publishModal";
    modal.className = "modal open";

    modal.innerHTML = `
        <div class="modal-backdrop"
             onclick="closePublishModal()"></div>

        <div class="modal-card">

            <div class="modal-header">

                <div>
                    <h3>Website Ready</h3>
                    <p>Your project preview link is ready.</p>
                </div>

                <button
                    class="modal-close"
                    onclick="closePublishModal()"
                >
                    ×
                </button>

            </div>

            <div class="modal-body">

                <label class="input-label">
                    Public Preview
                </label>

                <div class="publish-url-box">
                    <input
                        id="publishUrl"
                        class="text-input"
                        value="${escapeAttribute(url)}"
                        readonly
                    />

                    <button
                        class="secondary-btn"
                        onclick="copyPublishedUrl()"
                    >
                        Copy
                    </button>
                </div>

                <div class="publish-note">
                    The public preview does not display the
                    BuildPilot editor interface.
                </div>

            </div>

            <div class="modal-footer">

                <button
                    class="secondary-btn"
                    onclick="closePublishModal()"
                >
                    Close
                </button>

                <button
                    class="primary-btn"
                    onclick="window.open('${escapeAttribute(url)}','_blank')"
                >
                    Open Website
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(modal);
}


function closePublishModal() {
    const modal = document.getElementById("publishModal");

    if (modal) {
        modal.remove();
    }
}


async function copyPublishedUrl() {
    const input = document.getElementById("publishUrl");

    if (!input) return;

    try {
        await navigator.clipboard.writeText(input.value);

        showToast("Link copied ✓", "success");

    } catch {
        input.select();
        document.execCommand("copy");

        showToast("Link copied ✓", "success");
    }
}


/* =========================================================
   PROJECT INFORMATION
========================================================= */

function openProjectDetails() {
    if (!activeProject) {
        showToast("Open a project first", "error");
        return;
    }

    const existing = document.getElementById("projectDetailsModal");

    if (existing) {
        existing.remove();
    }

    const modal = document.createElement("div");

    modal.id = "projectDetailsModal";
    modal.className = "modal open";

    modal.innerHTML = `
        <div
            class="modal-backdrop"
            onclick="closeProjectDetails()"
        ></div>

        <div class="modal-card">

            <div class="modal-header">

                <div>
                    <h3>Project Details</h3>
                    <p>Current project information</p>
                </div>

                <button
                    class="modal-close"
                    onclick="closeProjectDetails()"
                >
                    ×
                </button>

            </div>

            <div class="modal-body">

                <div class="detail-row">
                    <span>Name</span>
                    <strong>
                        ${escapeHtml(activeProject.name || "Untitled")}
                    </strong>
                </div>

                <div class="detail-row">
                    <span>Project ID</span>
                    <code>
                        ${escapeHtml(String(activeProject.id || ""))}
                    </code>
                </div>

                <div class="detail-row">
                    <span>Files</span>
                    <strong>
                        ${activeFiles.length}
                    </strong>
                </div>

                <div class="detail-row">
                    <span>Frontend</span>
                    <strong>
                        ${escapeHtml(activeProject.frontend || "HTML")}
                    </strong>
                </div>

                <div class="detail-row">
                    <span>Backend</span>
                    <strong>
                        ${escapeHtml(activeProject.backend || "Supabase")}
                    </strong>
                </div>

            </div>

            <div class="modal-footer">

                <button
                    class="primary-btn"
                    onclick="closeProjectDetails()"
                >
                    Done
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(modal);
}


function closeProjectDetails() {
    const modal = document.getElementById("projectDetailsModal");

    if (modal) {
        modal.remove();
    }
}


/* =========================================================
   PROJECT RENAME
========================================================= */

async function renameCurrentProject() {
    if (!activeProject) {
        showToast("Open a project first", "error");
        return;
    }

    const currentName =
        activeProject.name || "Untitled Project";

    const newName = window.prompt(
        "Enter project name:",
        currentName
    );

    if (newName === null) return;

    const name = newName.trim();

    if (!name) {
        showToast("Project name is required", "error");
        return;
    }

    try {
        const supabase = getSupabase();

        const {
            data,
            error
        } = await supabase
            .from("projects")
            .update({
                name,
                updated_at: nowIso()
            })
            .eq("id", activeProject.id)
            .select()
            .single();

        if (error) throw error;

        activeProject = data;

        const nameElement =
            document.getElementById("workspaceProjectName");

        if (nameElement) {
            nameElement.textContent = name;
        }

        showToast("Project renamed ✓", "success");

    } catch (error) {
        console.error("renameCurrentProject:", error);

        showToast(
            error.message || "Unable to rename project",
            "error"
        );
    }
}


/* =========================================================
   PROJECT DELETE
========================================================= */

async function deleteCurrentProject() {
    if (!activeProject) {
        showToast("Open a project first", "error");
        return;
    }

    const name =
        activeProject.name || "Untitled Project";

    const confirmed = window.confirm(
        `Delete project "${name}"?\n\nThis will remove the project and its files.`
    );

    if (!confirmed) return;

    try {
        const supabase = getSupabase();

        const { error: filesError } = await supabase
            .from("project_files")
            .delete()
            .eq("project_id", activeProject.id);

        if (filesError) {
            throw filesError;
        }

        const { error: projectError } = await supabase
            .from("projects")
            .delete()
            .eq("id", activeProject.id);

        if (projectError) {
            throw projectError;
        }

        activeProject = null;
        activeFiles = [];
        selectedFileId = null;

        const workspace =
            document.getElementById("projectWorkspace");

        if (workspace) {
            workspace.classList.add("hidden");
        }

        const emptyState =
            document.getElementById("projectEmptyState");

        if (emptyState) {
            emptyState.classList.remove("hidden");
        }

        showToast("Project deleted", "success");

        if (typeof loadProjects === "function") {
            await loadProjects();
        }

    } catch (error) {
        console.error("deleteCurrentProject:", error);

        showToast(
            error.message || "Unable to delete project",
            "error"
        );
    }
}


/* =========================================================
   PROJECT SEARCH
========================================================= */

function filterProjectList(searchValue) {
    const value =
        String(searchValue || "")
            .trim()
            .toLowerCase();

    const cards =
        document.querySelectorAll("[data-project-card]");

    cards.forEach(card => {
        const text =
            card.textContent.toLowerCase();

        card.style.display =
            !value || text.includes(value)
                ? ""
                : "none";
    });
}


/* =========================================================
   FILE SEARCH
========================================================= */

function filterFiles(searchValue) {
    const value =
        String(searchValue || "")
            .trim()
            .toLowerCase();

    document
        .querySelectorAll(".file-item")
        .forEach(item => {

            const text =
                item.textContent.toLowerCase();

            item.style.display =
                !value || text.includes(value)
                    ? ""
                    : "none";
        });
}


/* =========================================================
   DRAG / DROP FILE AREA
========================================================= */

function setupFileDropZone() {
    const editor =
        document.getElementById("codeEditor");

    if (!editor || editor.dataset.dropReady === "true") {
        return;
    }

    editor.dataset.dropReady = "true";

    editor.addEventListener("dragover", event => {
        event.preventDefault();

        editor.classList.add("drag-over");
    });

    editor.addEventListener("dragleave", () => {
        editor.classList.remove("drag-over");
    });

    editor.addEventListener("drop", event => {
        event.preventDefault();

        editor.classList.remove("drag-over");

        const files = event.dataTransfer?.files;

        if (!files || !files.length) return;

        const file = files[0];

        const reader = new FileReader();

        reader.onload = () => {

            editor.value =
                String(reader.result || "");

            saveEditorToMemory();
            updateLineNumbers();

            showToast(
                `${file.name} loaded into editor`,
                "success"
            );
        };

        reader.readAsText(file);
    });
}


/* =========================================================
   AUTO SAVE
========================================================= */

let autoSaveTimer = null;

function setupAutoSave() {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
    }

    autoSaveTimer = setInterval(async () => {

        if (!activeProject || !selectedFileId) {
            return;
        }

        try {
            const changed = saveEditorToMemory();

            if (!changed) return;

            const file = activeFiles.find(
                item => String(item.id) === String(selectedFileId)
            );

            if (!file) return;

            const supabase = getSupabase();

            await supabase
                .from("project_files")
                .update({
                    content: file.content || "",
                    updated_at: nowIso()
                })
                .eq("id", file.id)
                .eq("project_id", activeProject.id);

        } catch (error) {
            console.warn("autosave:", error);
        }

    }, 15000);
}


/* =========================================================
   PUBLIC PROJECT MODE
========================================================= */

async function openPublicProject(projectId) {
    if (!projectId) return;

    try {
        const supabase = getSupabase();

        const {
            data: project,
            error
        } = await supabase
            .from("projects")
            .select("*")
            .eq("id", projectId)
            .single();

        if (error) throw error;

        const {
            data: files,
            error: filesError
        } = await supabase
            .from("project_files")
            .select("*")
            .eq("project_id", project.id)
            .order("path", { ascending: true });

        if (filesError) throw filesError;

        const publicHTML =
            buildStandalonePreview(project, files || []);

        document.body.innerHTML = `
            <div
                style="
                    width:100vw;
                    height:100vh;
                    margin:0;
                    padding:0;
                    overflow:hidden;
                    background:#fff;
                "
            >
                <iframe
                    id="publicWebsiteFrame"
                    title="${escapeAttribute(project.name || "Website")}"
                    style="
                        width:100%;
                        height:100%;
                        border:0;
                        display:block;
                    "
                ></iframe>
            </div>
        `;

        const frame =
            document.getElementById("publicWebsiteFrame");

        if (frame) {
            frame.srcdoc = publicHTML;
        }

    } catch (error) {
        console.error("openPublicProject:", error);

        document.body.innerHTML = `
            <div style="
                min-height:100vh;
                display:flex;
                align-items:center;
                justify-content:center;
                font-family:Arial,sans-serif;
                padding:30px;
            ">
                <div>
                    <h2>Website unavailable</h2>
                    <p>
                        ${escapeHtml(
                            error.message || "Unable to load website"
                        )}
                    </p>
                </div>
            </div>
        `;
    }
}


function buildStandalonePreview(project, files) {
    const htmlFile = files.find(
        file => normalizePath(file.path) === "index.html"
    );

    if (!htmlFile) {
        return `
            <!doctype html>
            <html>
                <head>
                    <title>
                        ${escapeHtml(project?.name || "Website")}
                    </title>
                </head>
                <body>
                    <h2>Website unavailable</h2>
                    <p>index.html was not found.</p>
                </body>
            </html>
        `;
    }

    let html = htmlFile.content || "";

    const css = files
        .filter(isCssFile)
        .map(file => file.content || "")
        .join("\n");

    const js = files
        .filter(isJsFile)
        .map(file => file.content || "")
        .join("\n");

    if (css.trim()) {
        if (/<\/head>/i.test(html)) {
            html = html.replace(
                /<\/head>/i,
                `<style>${css}</style></head>`
            );
        } else {
            html =
                `<style>${css}</style>\n` +
                html;
        }
    }

    if (js.trim()) {
        if (/<\/body>/i.test(html)) {
            html = html.replace(
                /<\/body>/i,
                `<script>${js}<\/script></body>`
            );
        } else {
            html += `<script>${js}<\/script>`;
        }
    }

    return html;
}


/* =========================================================
   PROJECT IMPORT / EXPORT
========================================================= */

function exportProjectJSON() {
    if (!activeProject) {
        showToast("Open a project first", "error");
        return;
    }

    saveEditorToMemory();

    const data = {
        project: activeProject,
        files: activeFiles
    };

    const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download =
        `${createSlug(activeProject.name)}.json`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    showToast("Project exported ✓", "success");
}


/* =========================================================
   COPY CODE
========================================================= */

async function copyCurrentFileCode() {
    const editor =
        document.getElementById("codeEditor");

    if (!editor) return;

    try {
        await navigator.clipboard.writeText(
            editor.value
        );

        showToast("Code copied ✓", "success");

    } catch (error) {
        editor.select();

        document.execCommand("copy");

        showToast("Code copied ✓", "success");
    }
}


/* =========================================================
   FORMAT BASIC HTML
========================================================= */

function formatCurrentCode() {
    const editor =
        document.getElementById("codeEditor");

    if (!editor || !selectedFileId) return;

    const file =
        activeFiles.find(
            item => String(item.id) === String(selectedFileId)
        );

    if (!file) return;

    const ext =
        getFileExtension(file.path);

    let code = editor.value;

    if (ext === "json") {
        try {
            code = JSON.stringify(
                JSON.parse(code),
                null,
                2
            );
        } catch {
            showToast(
                "Invalid JSON",
                "error"
            );
            return;
        }
    }

    if (ext === "html") {
        code = basicHTMLFormat(code);
    }

    editor.value = code;

    saveEditorToMemory();
    updateLineNumbers();

    showToast("Code formatted", "success");
}


function basicHTMLFormat(code) {
    return String(code || "")
        .replace(/>\s+</g, "><")
        .replace(/></g, ">\n<")
        .replace(/^\s+|\s+$/g, "");
}


/* =========================================================
   EDITOR FULLSCREEN
========================================================= */

function toggleEditorFullscreen() {
    const workspace =
        document.getElementById("projectWorkspace");

    if (!workspace) return;

    workspace.classList.toggle("editor-fullscreen");

    const button =
        document.getElementById("fullscreenEditorBtn");

    if (button) {
        button.textContent =
            workspace.classList.contains("editor-fullscreen")
                ? "⤢ Exit"
                : "⛶ Fullscreen";
    }
}


/* =========================================================
   AI PANEL
========================================================= */

function toggleAIPanel() {
    const panel =
        document.getElementById("aiBuilderPanel");

    if (!panel) return;

    panel.classList.toggle("collapsed");

    const button =
        document.getElementById("toggleAIPanelBtn");

    if (button) {
        button.textContent =
            panel.classList.contains("collapsed")
                ? "AI"
                : "Hide AI";
    }
}


/* =========================================================
   AI QUICK ACTIONS
========================================================= */

function useAIQuickAction(instruction) {
    const input =
        document.getElementById("aiInstruction");

    if (!input) return;

    input.value = instruction;

    input.focus();

    input.dispatchEvent(
        new Event("input", { bubbles: true })
    );
}


/* =========================================================
   AI CHAT ENTER KEY
========================================================= */

function setupAIInput() {
    const input =
        document.getElementById("aiInstruction");

    if (!input || input.dataset.ready === "true") {
        return;
    }

    input.dataset.ready = "true";

    input.addEventListener("keydown", event => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {
            event.preventDefault();

            submitAIInstruction();
        }
    });
}


/* =========================================================
   AI MESSAGE UI
========================================================= */

function addAIMessage(role, message) {
    const container =
        document.getElementById("aiMessages");

    if (!container) return;

    const row =
        document.createElement("div");

    row.className =
        `ai-message ${role === "user" ? "user" : "assistant"}`;

    row.innerHTML = `
        <div class="ai-message-avatar">
            ${
                role === "user"
                    ? "U"
                    : "AI"
            }
        </div>

        <div class="ai-message-content">
            ${formatAIMessage(message)}
        </div>
    `;

    container.appendChild(row);

    container.scrollTop =
        container.scrollHeight;
}


function formatAIMessage(message) {
    let text = String(message || "");

    text = escapeHtml(text);

    text = text.replace(
        /```([\s\S]*?)```/g,
        "<pre><code>$1</code></pre>"
    );

    text = text.replace(
        /\n/g,
        "<br>"
    );

    return text;
}


function clearAIChat() {
    const container =
        document.getElementById("aiMessages");

    if (!container) return;

    container.innerHTML = `
        <div class="ai-welcome">

            <div class="ai-welcome-icon">
                ✨
            </div>

            <h3>
                What do you want to build?
            </h3>

            <p>
                Ask AI to modify your website,
                create files, fix bugs or improve
                the design.
            </p>

        </div>
    `;
}


/* =========================================================
   AI WORKING INDICATOR
========================================================= */

function showAITyping() {
    const container =
        document.getElementById("aiMessages");

    if (!container) return;

    removeAITyping();

    const row =
        document.createElement("div");

    row.id = "aiTyping";

    row.className =
        "ai-message assistant";

    row.innerHTML = `
        <div class="ai-message-avatar">
            AI
        </div>

        <div class="ai-message-content ai-typing">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;

    container.appendChild(row);

    container.scrollTop =
        container.scrollHeight;
}


function removeAITyping() {
    const typing =
        document.getElementById("aiTyping");

    if (typing) {
        typing.remove();
    }
}


/* =========================================================
   PROJECT CONTEXT FOR AI
========================================================= */

function getProjectAIContext() {
    saveEditorToMemory();

    return activeFiles.map(file => ({
        id: file.id,
        path: normalizePath(file.path),
        content: file.content || ""
    }));
}


/* =========================================================
   APPLY AI FILE CHANGES
========================================================= */

async function applyAIFiles(files) {
    if (!Array.isArray(files)) {
        return;
    }

    const supabase = getSupabase();

    for (const incoming of files) {

        if (!incoming || !incoming.path) {
            continue;
        }

        const path =
            normalizePath(incoming.path);

        if (!path) continue;

        const existing =
            activeFiles.find(
                file =>
                    normalizePath(file.path).toLowerCase() ===
                    path.toLowerCase()
            );

        const content =
            typeof incoming.content === "string"
                ? incoming.content
                : "";

        if (existing) {

            existing.content = content;

            await supabase
                .from("project_files")
                .update({
                    content,
                    updated_at: nowIso()
                })
                .eq("id", existing.id)
                .eq("project_id", activeProject.id);

        } else {

            const {
                data,
                error
            } = await supabase
                .from("project_files")
                .insert({
                    project_id: activeProject.id,
                    path,
                    content,
                    created_at: nowIso(),
                    updated_at: nowIso()
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            activeFiles.push(data);
        }
    }

    renderFileExplorer();

    updatePreview();

    const current =
        activeFiles.find(
            file =>
                String(file.id) ===
                String(selectedFileId)
        );

    if (current) {
        renderEditor(current);
    } else {
        const index =
            activeFiles.find(
                file =>
                    normalizePath(file.path) ===
                    "index.html"
            ) || activeFiles[0];

        if (index) {
            selectedFileId = index.id;
            renderEditor(index);
        }
    }
}


/* =========================================================
   HANDLE AI RESPONSE
========================================================= */

async function handleAIProjectResponse(result) {
    if (!result) {
        throw new Error("Empty AI response");
    }

    let files =
        result.files ||
        result.generatedFiles ||
        result.changedFiles ||
        result.projectFiles;

    if (typeof files === "string") {
        try {
            files = JSON.parse(files);
        } catch {
            files = [];
        }
    }

    if (!Array.isArray(files)) {
        files = [];
    }

    if (files.length > 0) {
        await applyAIFiles(files);
    }

    if (result.message) {
        addAIMessage(
            "assistant",
            result.message
        );
    } else if (files.length) {
        addAIMessage(
            "assistant",
            `Done. I updated ${files.length} file(s).`
        );
    }

    refreshPreview();

    return files;
}


/* =========================================================
   AI MODIFY PROJECT
========================================================= */

async function submitAIInstruction() {
    const input =
        document.getElementById("aiInstruction");

    if (!input) return;

    const instruction =
        input.value.trim();

    if (!instruction) {
        showToast(
            "Tell AI what you want to change",
            "error"
        );
        return;
    }

    if (!activeProject) {
        showToast(
            "Open a project first",
            "error"
        );
        return;
    }

    saveEditorToMemory();

    addAIMessage(
        "user",
        instruction
    );

    input.value = "";

    showAITyping();

    const sendButton =
        document.getElementById("sendAIButton");

    if (sendButton) {
        setButtonLoading(
            sendButton,
            true,
            "Working..."
        );
    }

    try {

        const files =
            getProjectAIContext();

        const result =
            await callGenerateFunction(
                instruction,
                {
                    action: "modify_project",
                    projectId: activeProject.id,
                    files,
                    imageUrl:
                        pendingAIImage?.url || null
                }
            );

        removeAITyping();

        await handleAIProjectResponse(result);

        if (pendingAIImage) {
            pendingAIImage = null;

            const preview =
                document.getElementById("aiImagePreview");

            if (preview) {
                preview.innerHTML = "";
            }
        }

    } catch (error) {

        removeAITyping();

        console.error(
            "submitAIInstruction:",
            error
        );

        addAIMessage(
            "assistant",
            `Error: ${
                error.message ||
                "Unable to update the project."
            }`
        );

        showToast(
            error.message ||
            "AI update failed",
            "error"
        );

    } finally {

        if (sendButton) {
            setButtonLoading(
                sendButton,
                false,
                "Send"
            );
        }
    }
}


/* =========================================================
   AI FUNCTION CALL
========================================================= */

async function callGenerateFunction(
    instruction,
    extra = {}
) {

    const session =
        await getSession();

    if (!session?.access_token) {
        throw new Error(
            "Please login again."
        );
    }

    const payload = {
        projectId:
            extra.projectId ||
            activeProject?.id ||
            null,

        instruction:
            instruction || "",

        prompt:
            instruction || "",

        projectName:
            activeProject?.name ||
            "Website",

        frontend:
            activeProject?.frontend ||
            "html",

        backend:
            activeProject?.backend ||
            "supabase",

        files:
            extra.files ||
            getProjectAIContext(),

        imageUrl:
            extra.imageUrl ||
            null,

        action:
            extra.action ||
            "modify_project"
    };

    const response =
        await fetch(
            GENERATE_FUNCTION,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${session.access_token}`,

                    "apikey":
                        SUPABASE_KEY
                },

                body:
                    JSON.stringify(payload)
            }
        );

    const raw =
        await response.text();

    let data = null;

    try {
        data = raw
            ? JSON.parse(raw)
            : {};
    } catch {
        data = {
            raw
        };
    }

    if (!response.ok) {

        const message =
            data?.error ||
            data?.message ||
            data?.raw ||
            `Edge Function error (${response.status})`;

        throw new Error(message);
    }

    if (data?.error) {
        throw new Error(data.error);
    }

    return data;
}


/* =========================================================
   AI IMAGE UPLOAD
========================================================= */

async function handleAIImageSelected(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        showToast(
            "Please select an image",
            "error"
        );
        return;
    }

    const maxSize =
        10 * 1024 * 1024;

    if (file.size > maxSize) {
        showToast(
            "Image must be smaller than 10MB",
            "error"
        );
        return;
    }

    try {
        showToast(
            "Uploading image...",
            "info"
        );

        const supabase =
            getSupabase();

        const session =
            await getSession();

        if (!session?.user?.id) {
            throw new Error(
                "Please login first."
            );
        }

        const ext =
            (
                file.name.split(".").pop() ||
                "png"
            ).toLowerCase();

        const filePath =
            `${session.user.id}/references/` +
            `${Date.now()}-${uuid()}.${ext}`;

        const {
            error: uploadError
        } = await supabase.storage
            .from("uploads")
            .upload(
                filePath,
                file,
                {
                    contentType: file.type,
                    upsert: false
                }
            );

        if (uploadError) {
            throw uploadError;
        }

        let publicUrl = null;

        const {
            data: publicData
        } = supabase.storage
            .from("uploads")
            .getPublicUrl(filePath);

        publicUrl =
            publicData?.publicUrl || null;

        if (!publicUrl) {
            const {
                data: signedData,
                error: signedError
            } = await supabase.storage
                .from("uploads")
                .createSignedUrl(
                    filePath,
                    3600
                );

            if (signedError) {
                throw signedError;
            }

            publicUrl =
                signedData?.signedUrl || null;
        }

        if (!publicUrl) {
            throw new Error(
                "Unable to create image URL"
            );
        }

        pendingAIImage = {
            path: filePath,
            url: publicUrl,
            name: file.name,
            type: file.type
        };

        renderPendingAIImage();

        showToast(
            "Image uploaded ✓",
            "success"
        );

    } catch (error) {
        console.error(
            "handleAIImageSelected:",
            error
        );

        showToast(
            error.message ||
            "Image upload failed",
            "error"
        );
    }
}


/* =========================================================
   IMAGE PREVIEW
========================================================= */

function renderPendingAIImage() {
    const container =
        document.getElementById("aiImagePreview");

    if (!container) return;

    if (!pendingAIImage?.url) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = `
        <div class="ai-image-chip">

            <img
                src="${escapeAttribute(pendingAIImage.url)}"
                alt="Uploaded reference"
            />

            <div class="ai-image-name">
                ${escapeHtml(
                    pendingAIImage.name || "Reference image"
                )}
            </div>

            <button
                type="button"
                onclick="removePendingAIImage()"
            >
                ×
            </button>

        </div>
    `;
}


function removePendingAIImage() {
    pendingAIImage = null;

    const container =
        document.getElementById("aiImagePreview");

    if (container) {
        container.innerHTML = "";
    }

    const input =
        document.getElementById("aiImageInput");

    if (input) {
        input.value = "";
    }
}


/* =========================================================
   IMAGE GENERATION
========================================================= */

async function generateImageFromPrompt() {
    const input =
        document.getElementById("imagePrompt");

    if (!input) return;

    const prompt =
        input.value.trim();

    if (!prompt) {
        showToast(
            "Enter an image prompt",
            "error"
        );
        return;
    }

    showAITyping();

    try {

        const result =
            await callGenerateFunction(
                prompt,
                {
                    action: "generate_image",
                    imagePrompt: prompt
                }
            );

        removeAITyping();

        const imageUrl =
            result.imageUrl ||
            result.url ||
            result.image?.url ||
            null;

        if (!imageUrl) {
            throw new Error(
                "Image URL was not returned"
            );
        }

        generatedImages.unshift({
            url: imageUrl,
            prompt,
            createdAt: Date.now()
        });

        renderGeneratedImages();

        addAIMessage(
            "assistant",
            "Image generated successfully."
        );

    } catch (error) {

        removeAITyping();

        console.error(
            "generateImageFromPrompt:",
            error
        );

        showToast(
            error.message ||
            "Image generation failed",
            "error"
        );
    }
}


/* =========================================================
   GENERATED IMAGE LIST
========================================================= */

function renderGeneratedImages() {
    const container =
        document.getElementById("generatedImages");

    if (!container) return;

    if (!generatedImages.length) {
        container.innerHTML = `
            <div class="generated-empty">
                Generated images will appear here.
            </div>
        `;
        return;
    }

    container.innerHTML =
        generatedImages.map(
            (image, index) => `
                <div class="generated-image-card">

                    <img
                        src="${escapeAttribute(image.url)}"
                        alt="Generated image ${index + 1}"
                    />

                    <div class="generated-image-actions">

                        <button
                            onclick="useGeneratedImage('${escapeAttribute(image.url)}')"
                        >
                            Use
                        </button>

                        <button
                            onclick="window.open('${escapeAttribute(image.url)}','_blank')"
                        >
                            Open
                        </button>

                    </div>

                </div>
            `
        ).join("");
}


function useGeneratedImage(imageUrl) {
    if (!imageUrl) return;

    pendingAIImage = {
        url: imageUrl,
        name: "Generated image",
        type: "image"
    };

    renderPendingAIImage();

    showToast(
        "Image attached to AI",
        "success"
    );
}


/* =========================================================
   AI IMAGE FILE INPUT
========================================================= */

function setupAIImageInput() {
    const input =
        document.getElementById("aiImageInput");

    if (!input || input.dataset.ready === "true") {
        return;
    }

    input.dataset.ready = "true";

    input.addEventListener(
        "change",
        event => {

            const file =
                event.target.files?.[0];

            if (file) {
                handleAIImageSelected(file);
            }
        }
    );
}


/* =========================================================
   PROJECT ACTION MENU
========================================================= */

function toggleProjectMenu() {
    const menu =
        document.getElementById("projectMenu");

    if (!menu) return;

    menu.classList.toggle("open");
}


function closeProjectMenu() {
    const menu =
        document.getElementById("projectMenu");

    if (menu) {
        menu.classList.remove("open");
    }
}


/* =========================================================
   OUTSIDE CLICK
========================================================= */

function setupOutsideClick() {
    document.addEventListener(
        "click",
        event => {

            const menu =
                document.getElementById("projectMenu");

            const button =
                document.getElementById("projectMenuButton");

            if (
                menu &&
                menu.classList.contains("open") &&
                !menu.contains(event.target) &&
                !button?.contains(event.target)
            ) {
                menu.classList.remove("open");
            }
        }
    );
}


/* =========================================================
   RESPONSIVE MOBILE
========================================================= */

function toggleFileSidebar() {
    const sidebar =
        document.getElementById("fileSidebar");

    if (!sidebar) return;

    sidebar.classList.toggle("mobile-open");
}


function togglePreviewPanel() {
    const panel =
        document.getElementById("previewPanel");

    if (!panel) return;

    panel.classList.toggle("mobile-open");
}


/* =========================================================
   WINDOW RESIZE
========================================================= */

function setupResizeHandling() {
    let timer = null;

    window.addEventListener(
        "resize",
        () => {

            clearTimeout(timer);

            timer = setTimeout(() => {
                updateLineNumbers();
            }, 100);
        }
    );
}


/* =========================================================
   PROJECT URL ROUTING
========================================================= */

function checkPublicRoute() {
    const params =
        new URLSearchParams(
            window.location.search
        );

    const publicId =
        params.get("public");

    if (!publicId) {
        return false;
    }

    openPublicProject(publicId);

    return true;
}


/* =========================================================
   GLOBAL EVENTS
========================================================= */

function setupGlobalEvents() {

    setupEditorShortcuts();

    setupAIInput();

    setupAIImageInput();

    setupFileDropZone();

    setupOutsideClick();

    setupResizeHandling();

    setupAutoSave();

    document.addEventListener(
        "keydown",
        event => {

            if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "p"
            ) {
                event.preventDefault();

                refreshPreview();
            }

        }
    );
}


/* =========================================================
   SAFE BUTTON ACTION
========================================================= */

function safeAction(fn) {
    try {
        if (typeof fn === "function") {
            return fn();
        }
    } catch (error) {
        console.error(error);

        showToast(
            error.message ||
            "Something went wrong",
            "error"
        );
    }
}


/* =========================================================
   BUILD PILOT GLOBAL API
========================================================= */

window.BuildPilot = {

    openProject,

    saveCurrentFile,

    saveAllProjectFiles,

    refreshPreview,

    openFullPreview,

    publishProject,

    createProjectFile,

    deleteProjectFile,

    deleteCurrentProject,

    renameCurrentProject,

    copyCurrentFileCode,

    formatCurrentCode,

    submitAIInstruction,

    generateImageFromPrompt,

    handleAIImageSelected,

    removePendingAIImage,

    openProjectDetails,

    exportProjectJSON
};


/* =========================================================
   PART 2 END
========================================================= */
 /* =========================================================
   BUILD PILOT AI — APP.JS
   PART 3 / 3
   STARTUP • AUTH • UI • CSS • FINAL INIT
========================================================= */


/* =========================================================
   AUTH STATE
========================================================= */

async function getCurrentSessionUser() {
    try {
        const session = await getSession();

        if (!session?.user) {
            return null;
        }

        activeUser = session.user;

        return session.user;

    } catch (error) {
        console.error(
            "getCurrentSessionUser:",
            error
        );

        return null;
    }
}


/* =========================================================
   AUTH UI
========================================================= */

function updateAuthUI() {
    const loginButton =
        document.getElementById("loginButton");

    const signupButton =
        document.getElementById("signupButton");

    const logoutButton =
        document.getElementById("logoutButton");

    const userMenu =
        document.getElementById("userMenu");

    const userEmail =
        document.getElementById("userEmail");

    const userName =
        document.getElementById("userName");

    const avatar =
        document.getElementById("userAvatar");

    const loggedIn =
        !!activeUser;

    if (loginButton) {
        loginButton.style.display =
            loggedIn ? "none" : "";
    }

    if (signupButton) {
        signupButton.style.display =
            loggedIn ? "none" : "";
    }

    if (logoutButton) {
        logoutButton.style.display =
            loggedIn ? "" : "none";
    }

    if (userMenu) {
        userMenu.style.display =
            loggedIn ? "" : "none";
    }

    if (userEmail) {
        userEmail.textContent =
            activeUser?.email || "";
    }

    if (userName) {
        userName.textContent =
            activeProfile?.full_name ||
            activeUser?.user_metadata?.full_name ||
            activeUser?.email ||
            "User";
    }

    if (avatar) {
        const name =
            activeProfile?.full_name ||
            activeUser?.email ||
            "U";

        avatar.textContent =
            String(name)
                .trim()
                .charAt(0)
                .toUpperCase();
    }
}


/* =========================================================
   LOGIN MODAL
========================================================= */

function openLoginModal() {
    closeAuthModals();

    let modal =
        document.getElementById("loginModal");

    if (!modal) {
        modal = createLoginModal();
    }

    modal.classList.add("open");

    setTimeout(() => {
        document
            .getElementById("loginEmail")
            ?.focus();
    }, 50);
}


function createLoginModal() {
    const modal =
        document.createElement("div");

    modal.id = "loginModal";
    modal.className = "modal";

    modal.innerHTML = `
        <div
            class="modal-backdrop"
            onclick="closeLoginModal()"
        ></div>

        <div class="modal-card auth-card">

            <div class="auth-logo">
                <div class="auth-logo-mark">✦</div>
            </div>

            <div class="modal-header auth-header">

                <div>
                    <h3>Welcome back</h3>

                    <p>
                        Login to continue building.
                    </p>
                </div>

                <button
                    class="modal-close"
                    onclick="closeLoginModal()"
                >
                    ×
                </button>

            </div>

            <div class="modal-body">

                <label class="input-label">
                    Email
                </label>

                <input
                    id="loginEmail"
                    class="text-input"
                    type="email"
                    placeholder="you@example.com"
                    autocomplete="email"
                />

                <label class="input-label">
                    Password
                </label>

                <input
                    id="loginPassword"
                    class="text-input"
                    type="password"
                    placeholder="Your password"
                    autocomplete="current-password"
                />

                <div
                    id="loginError"
                    class="auth-error"
                ></div>

            </div>

            <div class="modal-footer auth-footer">

                <button
                    id="loginSubmitButton"
                    class="primary-btn full-btn"
                    onclick="loginUser()"
                >
                    Login
                </button>

                <button
                    class="link-btn"
                    onclick="openSignupModal()"
                >
                    Create a new account
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(modal);

    return modal;
}


function closeLoginModal() {
    const modal =
        document.getElementById("loginModal");

    if (modal) {
        modal.classList.remove("open");
    }
}


/* =========================================================
   SIGNUP MODAL
========================================================= */

function openSignupModal() {
    closeAuthModals();

    let modal =
        document.getElementById("signupModal");

    if (!modal) {
        modal = createSignupModal();
    }

    modal.classList.add("open");

    setTimeout(() => {
        document
            .getElementById("signupName")
            ?.focus();
    }, 50);
}


function createSignupModal() {
    const modal =
        document.createElement("div");

    modal.id = "signupModal";
    modal.className = "modal";

    modal.innerHTML = `
        <div
            class="modal-backdrop"
            onclick="closeSignupModal()"
        ></div>

        <div class="modal-card auth-card">

            <div class="auth-logo">
                <div class="auth-logo-mark">✦</div>
            </div>

            <div class="modal-header auth-header">

                <div>
                    <h3>Create account</h3>

                    <p>
                        Start building your next website.
                    </p>
                </div>

                <button
                    class="modal-close"
                    onclick="closeSignupModal()"
                >
                    ×
                </button>

            </div>

            <div class="modal-body">

                <label class="input-label">
                    Full name
                </label>

                <input
                    id="signupName"
                    class="text-input"
                    type="text"
                    placeholder="Your name"
                    autocomplete="name"
                />

                <label class="input-label">
                    Email
                </label>

                <input
                    id="signupEmail"
                    class="text-input"
                    type="email"
                    placeholder="you@example.com"
                    autocomplete="email"
                />

                <label class="input-label">
                    Password
                </label>

                <input
                    id="signupPassword"
                    class="text-input"
                    type="password"
                    placeholder="Minimum 6 characters"
                    autocomplete="new-password"
                />

                <div
                    id="signupError"
                    class="auth-error"
                ></div>

            </div>

            <div class="modal-footer auth-footer">

                <button
                    id="signupSubmitButton"
                    class="primary-btn full-btn"
                    onclick="signupUser()"
                >
                    Create Account
                </button>

                <button
                    class="link-btn"
                    onclick="openLoginModal()"
                >
                    Already have an account?
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(modal);

    return modal;
}


function closeSignupModal() {
    const modal =
        document.getElementById("signupModal");

    if (modal) {
        modal.classList.remove("open");
    }
}


function closeAuthModals() {
    closeLoginModal();
    closeSignupModal();
}


/* =========================================================
   LOGIN
========================================================= */

async function loginUser() {
    const email =
        document
            .getElementById("loginEmail")
            ?.value
            .trim();

    const password =
        document
            .getElementById("loginPassword")
            ?.value;

    const errorBox =
        document.getElementById("loginError");

    const button =
        document.getElementById(
            "loginSubmitButton"
        );

    if (errorBox) {
        errorBox.textContent = "";
    }

    if (!email || !password) {
        if (errorBox) {
            errorBox.textContent =
                "Enter email and password.";
        }

        return;
    }

    try {

        if (button) {
            setButtonLoading(
                button,
                true,
                "Logging in..."
            );
        }

        const supabase =
            getSupabase();

        const {
            data,
            error
        } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error;
        }

        activeUser =
            data?.user || null;

        await ensureProfile();

        updateAuthUI();

        closeLoginModal();

        showToast(
            "Login successful ✓",
            "success"
        );

        await loadDashboard();

    } catch (error) {

        console.error(
            "loginUser:",
            error
        );

        if (errorBox) {
            errorBox.textContent =
                error.message ||
                "Login failed.";
        }

    } finally {

        if (button) {
            setButtonLoading(
                button,
                false,
                "Login"
            );
        }
    }
}


/* =========================================================
   SIGNUP
========================================================= */

async function signupUser() {
    const name =
        document
            .getElementById("signupName")
            ?.value
            .trim();

    const email =
        document
            .getElementById("signupEmail")
            ?.value
            .trim();

    const password =
        document
            .getElementById("signupPassword")
            ?.value;

    const errorBox =
        document.getElementById("signupError");

    const button =
        document.getElementById(
            "signupSubmitButton"
        );

    if (errorBox) {
        errorBox.textContent = "";
    }

    if (!name || !email || !password) {
        if (errorBox) {
            errorBox.textContent =
                "Please fill all fields.";
        }

        return;
    }

    if (password.length < 6) {
        if (errorBox) {
            errorBox.textContent =
                "Password must be at least 6 characters.";
        }

        return;
    }

    try {

        if (button) {
            setButtonLoading(
                button,
                true,
                "Creating..."
            );
        }

        const supabase =
            getSupabase();

        const {
            data,
            error
        } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name
                }
            }
        });

        if (error) {
            throw error;
        }

        activeUser =
            data?.user || null;

        if (activeUser) {
            try {
                await ensureProfile();
            } catch (profileError) {
                console.warn(
                    "Profile creation:",
                    profileError
                );
            }
        }

        closeSignupModal();

        if (data?.session) {

            updateAuthUI();

            showToast(
                "Account created ✓",
                "success"
            );

            await loadDashboard();

        } else {

            showToast(
                "Account created. Check your email to verify.",
                "success"
            );
        }

    } catch (error) {

        console.error(
            "signupUser:",
            error
        );

        if (errorBox) {
            errorBox.textContent =
                error.message ||
                "Signup failed.";
        }

    } finally {

        if (button) {
            setButtonLoading(
                button,
                false,
                "Create Account"
            );
        }
    }
}


/* =========================================================
   LOGOUT
========================================================= */

async function logoutUser() {
    try {

        const supabase =
            getSupabase();

        await supabase.auth.signOut();

        activeUser = null;
        activeProfile = null;
        activeProject = null;
        activeFiles = [];
        selectedFileId = null;

        updateAuthUI();

        showToast(
            "Logged out",
            "success"
        );

        showLandingPage();

    } catch (error) {

        console.error(
            "logoutUser:",
            error
        );

        showToast(
            error.message ||
            "Logout failed",
            "error"
        );
    }
}


/* =========================================================
   DASHBOARD
========================================================= */

async function loadDashboard() {
    if (!activeUser) {
        showLandingPage();
        return;
    }

    try {

        if (typeof loadProjects === "function") {
            await loadProjects();
        }

        showAppShell();

    } catch (error) {

        console.error(
            "loadDashboard:",
            error
        );

        showAppShell();
    }
}


function showLandingPage() {
    document
        .querySelectorAll(".auth-required")
        .forEach(element => {
            element.classList.add("hidden");
        });

    const landing =
        document.getElementById("landingPage");

    if (landing) {
        landing.classList.remove("hidden");
    }

    const app =
        document.getElementById("appShell");

    if (app) {
        app.classList.add("hidden");
    }
}


function showAppShell() {
    const landing =
        document.getElementById("landingPage");

    if (landing) {
        landing.classList.add("hidden");
    }

    const app =
        document.getElementById("appShell");

    if (app) {
        app.classList.remove("hidden");
    }
}


/* =========================================================
   PROJECT LIST
========================================================= */

async function loadProjects() {
    if (!activeUser) return [];

    try {

        const supabase =
            getSupabase();

        const {
            data,
            error
        } = await supabase
            .from("projects")
            .select("*")
            .eq("user_id", activeUser.id)
            .order(
                "updated_at",
                { ascending: false }
            );

        if (error) throw error;

        const projects =
            data || [];

        renderProjectList(projects);

        return projects;

    } catch (error) {

        console.error(
            "loadProjects:",
            error
        );

        showToast(
            error.message ||
            "Unable to load projects",
            "error"
        );

        return [];
    }
}


function renderProjectList(projects) {
    const container =
        document.getElementById("projectsList");

    if (!container) return;

    if (!projects.length) {

        container.innerHTML = `
            <div class="empty-projects">

                <div class="empty-project-icon">
                    ✦
                </div>

                <h3>No projects yet</h3>

                <p>
                    Create your first website with AI.
                </p>

                <button
                    class="primary-btn"
                    onclick="openCreateProjectModal()"
                >
                    + Create Project
                </button>

            </div>
        `;

        return;
    }

    container.innerHTML =
        projects.map(project => {

            const updated =
                project.updated_at
                    ? new Date(
                        project.updated_at
                    ).toLocaleDateString()
                    : "";

            return `
                <div
                    class="project-card"
                    data-project-card
                    data-project-id="${escapeAttribute(project.id)}"
                    onclick="openProject('${escapeAttribute(project.id)}')"
                >

                    <div class="project-card-icon">
                        🌐
                    </div>

                    <div class="project-card-content">

                        <h3>
                            ${escapeHtml(
                                project.name ||
                                "Untitled Project"
                            )}
                        </h3>

                        <p>
                            ${escapeHtml(
                                project.frontend ||
                                "HTML"
                            )}
                        </p>

                        <small>
                            ${escapeHtml(updated)}
                        </small>

                    </div>

                    <div
                        class="project-card-arrow"
                    >
                        →
                    </div>

                </div>
            `;
        }).join("");
}


/* =========================================================
   CREATE PROJECT MODAL
========================================================= */

function openCreateProjectModal() {
    let modal =
        document.getElementById(
            "createProjectModal"
        );

    if (!modal) {
        modal = createProjectModal();
    }

    modal.classList.add("open");

    setTimeout(() => {
        document
            .getElementById("projectNameInput")
            ?.focus();
    }, 50);
}


function createProjectModal() {
    const modal =
        document.createElement("div");

    modal.id =
        "createProjectModal";

    modal.className =
        "modal";

    modal.innerHTML = `
        <div
            class="modal-backdrop"
            onclick="closeCreateProjectModal()"
        ></div>

        <div class="modal-card">

            <div class="modal-header">

                <div>
                    <h3>Create Project</h3>

                    <p>
                        Start with a blank website.
                    </p>
                </div>

                <button
                    class="modal-close"
                    onclick="closeCreateProjectModal()"
                >
                    ×
                </button>

            </div>

            <div class="modal-body">

                <label class="input-label">
                    Project name
                </label>

                <input
                    id="projectNameInput"
                    class="text-input"
                    placeholder="My Website"
                />

                <label class="input-label">
                    Frontend
                </label>

                <select
                    id="projectFrontendInput"
                    class="text-input"
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

                <label class="input-label">
                    Backend
                </label>

                <select
                    id="projectBackendInput"
                    class="text-input"
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

                <div
                    id="createProjectError"
                    class="auth-error"
                ></div>

            </div>

            <div class="modal-footer">

                <button
                    class="secondary-btn"
                    onclick="closeCreateProjectModal()"
                >
                    Cancel
                </button>

                <button
                    id="createProjectButton"
                    class="primary-btn"
                    onclick="createNewProject()"
                >
                    Create Project
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(modal);

    return modal;
}


function closeCreateProjectModal() {
    const modal =
        document.getElementById(
            "createProjectModal"
        );

    if (modal) {
        modal.classList.remove("open");
    }
}


/* =========================================================
   CREATE NEW PROJECT
========================================================= */

async function createNewProject() {
    if (!activeUser) {
        openLoginModal();
        return;
    }

    const name =
        document
            .getElementById("projectNameInput")
            ?.value
            .trim();

    const frontend =
        document
            .getElementById("projectFrontendInput")
            ?.value ||
        "html";

    const backend =
        document
            .getElementById("projectBackendInput")
            ?.value ||
        "supabase";

    const errorBox =
        document.getElementById(
            "createProjectError"
        );

    const button =
        document.getElementById(
            "createProjectButton"
        );

    if (errorBox) {
        errorBox.textContent = "";
    }

    if (!name) {
        if (errorBox) {
            errorBox.textContent =
                "Project name is required.";
        }

        return;
    }

    try {

        const limit =
            Number(
                activeProfile?.project_limit ?? 5
            );

        const existingProjects =
            await loadProjects();

        if (
            Number.isFinite(limit) &&
            existingProjects.length >= limit
        ) {
            throw new Error(
                `Project limit reached (${limit}). Please request an upgrade.`
            );
        }

        if (button) {
            setButtonLoading(
                button,
                true,
                "Creating..."
            );
        }

        const supabase =
            getSupabase();

        const {
            data: project,
            error: projectError
        } = await supabase
            .from("projects")
            .insert({
                user_id: activeUser.id,
                name,
                slug: createSlug(name),
                frontend,
                backend,
                created_at: nowIso(),
                updated_at: nowIso()
            })
            .select()
            .single();

        if (projectError) {
            throw projectError;
        }

        const starterFiles =
            createStarterFiles(
                name,
                frontend
            );

        const rows =
            starterFiles.map(file => ({
                project_id: project.id,
                path: file.path,
                content: file.content,
                created_at: nowIso(),
                updated_at: nowIso()
            }));

        const {
            data: insertedFiles,
            error: filesError
        } = await supabase
            .from("project_files")
            .insert(rows)
            .select();

        if (filesError) {
            throw filesError;
        }

        activeProject = project;

        activeFiles =
            insertedFiles || [];

        selectedFileId =
            activeFiles.find(
                file =>
                    normalizePath(file.path) ===
                    "index.html"
            )?.id ||
            activeFiles[0]?.id ||
            null;

        closeCreateProjectModal();

        showAppShell();

        renderProjectWorkspace();

        const selected =
            activeFiles.find(
                file =>
                    String(file.id) ===
                    String(selectedFileId)
            );

        if (selected) {
            renderEditor(selected);
        }

        updatePreview();

        await loadProjects();

        showToast(
            "Project created ✓",
            "success"
        );

    } catch (error) {

        console.error(
            "createNewProject:",
            error
        );

        if (errorBox) {
            errorBox.textContent =
                error.message ||
                "Unable to create project.";
        }

    } finally {

        if (button) {
            setButtonLoading(
                button,
                false,
                "Create Project"
            );
        }
    }
}


/* =========================================================
   STARTER FILES
========================================================= */

function createStarterFiles(
    projectName,
    frontend = "html"
) {

    const safeName =
        escapeHtml(projectName);

    if (frontend === "react") {
        return [
            {
                path: "index.html",
                content: `<!doctype html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${safeName}</title>
</head>
<body>
    <div id="root"></div>
    <script src="script.js"></script>
</body>
</html>`
            },

            {
                path: "style.css",
                content: `* {
    box-sizing: border-box;
}

body {
    margin: 0;
    font-family: Arial, sans-serif;
    background: #ffffff;
    color: #111111;
}

#root {
    min-height: 100vh;
}`
            },

            {
                path: "script.js",
                content: `const root =
    document.getElementById("root");

root.innerHTML = \`
    <main style="
        min-height:100vh;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:40px;
    ">
        <div>
            <h1>${safeName}</h1>
            <p>Start building your website.</p>
        </div>
    </main>
\`;`
            }
        ];
    }

    return [
        {
            path: "index.html",
            content: `<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>${safeName}</title>

    <link
        rel="stylesheet"
        href="style.css"
    >
</head>

<body>

    <main class="hero">

        <div class="hero-card">

            <span class="badge">
                Welcome
            </span>

            <h1>
                ${safeName}
            </h1>

            <p>
                Your website starts here.
            </p>

            <button
                onclick="showMessage()"
            >
                Get Started
            </button>

        </div>

    </main>

    <script src="script.js"></script>

</body>
</html>`
        },

        {
            path: "style.css",
            content: `* {
    box-sizing: border-box;
}

html,
body {
    margin: 0;
    padding: 0;
    width: 100%;
    min-height: 100%;
}

body {
    font-family:
        Inter,
        Arial,
        sans-serif;

    background:
        linear-gradient(
            135deg,
            #f8fafc,
            #eef2ff
        );

    color: #111827;
}

.hero {
    min-height: 100vh;

    display: flex;

    align-items: center;

    justify-content: center;

    padding: 40px;
}

.hero-card {
    width: min(
        700px,
        100%
    );

    padding: 60px;

    border-radius: 28px;

    background: white;

    box-shadow:
        0 20px 60px
        rgba(0,0,0,.10);

    text-align: center;
}

.badge {
    display: inline-block;

    padding: 8px 14px;

    border-radius: 999px;

    background: #eef2ff;

    color: #4f46e5;

    font-size: 13px;

    font-weight: 700;
}

h1 {
    font-size: clamp(
        40px,
        7vw,
        72px
    );

    margin:
        22px 0 14px;
}

p {
    font-size: 18px;

    color: #64748b;
}

button {
    border: 0;

    border-radius: 12px;

    padding: 14px 22px;

    background: #111827;

    color: white;

    cursor: pointer;

    font-size: 15px;

    margin-top: 20px;
}

button:hover {
    opacity: .9;
}`
        },

        {
            path: "script.js",
            content: `function showMessage() {
    alert("Welcome to ${safeName}!");
}`
        }
    ];
}


/* =========================================================
   ENSURE PROFILE
========================================================= */

async function ensureProfile() {
    if (!activeUser?.id) {
        return null;
    }

    try {

        const supabase =
            getSupabase();

        let {
            data: profile,
            error
        } = await supabase
            .from("profiles")
            .select(`
                id,
                full_name,
                role,
                status,
                plan,
                project_limit,
                github_file_limit
            `)
            .eq(
                "id",
                activeUser.id
            )
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!profile) {

            const {
                data: created,
                error: createError
            } = await supabase
                .from("profiles")
                .insert({
                    id: activeUser.id,

                    full_name:
                        activeUser
                            ?.user_metadata
                            ?.full_name ||
                        activeUser.email ||
                        "User",

                    role: "user",

                    status: "active",

                    plan: "free",

                    project_limit: 5,

                    github_file_limit: 2,

                    created_at: nowIso(),

                    updated_at: nowIso()
                })
                .select(`
                    id,
                    full_name,
                    role,
                    status,
                    plan,
                    project_limit,
                    github_file_limit
                `)
                .single();

            if (createError) {
                throw createError;
            }

            profile = created;
        }

        activeProfile = profile;

        if (
            String(profile.status || "active")
                .toLowerCase() ===
            "blocked"
        ) {
            showBlockedScreen();
        }

        return profile;

    } catch (error) {

        console.error(
            "ensureProfile:",
            error
        );

        /*
         * Do not stop the whole UI when the
         * profile table is temporarily unavailable.
         */

        activeProfile = {
            id: activeUser.id,
            full_name:
                activeUser.email || "User",
            role: "user",
            status: "active",
            plan: "free",
            project_limit: 5,
            github_file_limit: 2
        };

        return activeProfile;
    }
}


/* =========================================================
   BLOCKED SCREEN
========================================================= */

function showBlockedScreen() {
    const existing =
        document.getElementById(
            "blockedScreen"
        );

    if (existing) return;

    const screen =
        document.createElement("div");

    screen.id =
        "blockedScreen";

    screen.className =
        "blocked-screen";

    screen.innerHTML = `
        <div class="blocked-card">

            <div class="blocked-icon">
                🔒
            </div>

            <h2>
                Account blocked
            </h2>

            <p>
                Your account is currently blocked.
                Please contact the administrator.
            </p>

            <button
                class="primary-btn"
                onclick="logoutUser()"
            >
                Logout
            </button>

        </div>
    `;

    document.body.appendChild(screen);
}


/* =========================================================
   ADMIN ACCESS
========================================================= */

function isAdmin() {
    return (
        String(
            activeProfile?.role || ""
        ).toLowerCase() === "admin"
    );
}


function requireAdmin() {
    if (!isAdmin()) {
        showToast(
            "Admin access required",
            "error"
        );

        return false;
    }

    return true;
}


/* =========================================================
   ADMIN PANEL
========================================================= */

async function openAdminPanel() {
    if (!requireAdmin()) return;

    let panel =
        document.getElementById(
            "adminPanel"
        );

    if (!panel) {
        panel = createAdminPanel();
    }

    panel.classList.add("open");

    await loadAdminData();
}


function closeAdminPanel() {
    const panel =
        document.getElementById(
            "adminPanel"
        );

    if (panel) {
        panel.classList.remove("open");
    }
}


function createAdminPanel() {
    const panel =
        document.createElement("div");

    panel.id =
        "adminPanel";

    panel.className =
        "side-panel";

    panel.innerHTML = `
        <div class="side-panel-header">

            <div>
                <strong>
                    Admin Panel
                </strong>

                <small>
                    Manage users and limits
                </small>
            </div>

            <button
                class="modal-close"
                onclick="closeAdminPanel()"
            >
                ×
            </button>

        </div>

        <div class="admin-stats">

            <div class="admin-stat">
                <strong id="adminUsersCount">
                    0
                </strong>
                <span>Users</span>
            </div>

            <div class="admin-stat">
                <strong id="adminBlockedCount">
                    0
                </strong>
                <span>Blocked</span>
            </div>

            <div class="admin-stat">
                <strong id="adminProjectsCount">
                    0
                </strong>
                <span>Projects</span>
            </div>

        </div>

        <div class="admin-toolbar">

            <input
                id="adminUserSearch"
                class="text-input"
                placeholder="Search users..."
                oninput="filterAdminUsers(this.value)"
            />

        </div>

        <div
            id="adminUsersList"
            class="admin-users-list"
        >
            Loading...
        </div>

    `;

    document.body.appendChild(panel);

    return panel;
}


/* =========================================================
   ADMIN DATA
========================================================= */

async function loadAdminData() {
    if (!requireAdmin()) return;

    try {

        const supabase =
            getSupabase();

        const {
            data: users,
            error: usersError
        } = await supabase
            .from("profiles")
            .select(`
                id,
                full_name,
                role,
                status,
                plan,
                project_limit,
                github_file_limit,
                created_at
            `)
            .order(
                "created_at",
                { ascending: false }
            );

        if (usersError) {
            throw usersError;
        }

        const {
            count: projectCount,
            error: projectError
        } = await supabase
            .from("projects")
            .select(
                "id",
                {
                    count: "exact",
                    head: true
                }
            );

        if (projectError) {
            console.warn(
                "Admin projects:",
                projectError
            );
        }

        const allUsers =
            users || [];

        const blocked =
            allUsers.filter(
                user =>
                    String(
                        user.status || ""
                    ).toLowerCase() ===
                    "blocked"
            ).length;

        document
            .getElementById(
                "adminUsersCount"
            )
            ?.replaceChildren(
                document.createTextNode(
                    String(allUsers.length)
                )
            );

        document
            .getElementById(
                "adminBlockedCount"
            )
            ?.replaceChildren(
                document.createTextNode(
                    String(blocked)
                )
            );

        document
            .getElementById(
                "adminProjectsCount"
            )
            ?.replaceChildren(
                document.createTextNode(
                    String(projectCount || 0)
                )
            );

        renderAdminUsers(
            allUsers
        );

    } catch (error) {

        console.error(
            "loadAdminData:",
            error
        );

        showToast(
            error.message ||
            "Unable to load admin data",
            "error"
        );
    }
}


function renderAdminUsers(users) {
    const container =
        document.getElementById(
            "adminUsersList"
        );

    if (!container) return;

    if (!users.length) {
        container.innerHTML = `
            <div class="admin-empty">
                No users found.
            </div>
        `;

        return;
    }

    container.innerHTML =
        users.map(user => {

            const blocked =
                String(
                    user.status || ""
                ).toLowerCase() ===
                "blocked";

            const isSelf =
                String(user.id) ===
                String(activeUser?.id);

            return `
                <div
                    class="admin-user-row"
                    data-admin-user
                    data-search="${escapeAttribute(
                        (
                            user.full_name ||
                            ""
                        ).toLowerCase()
                    )}"
                >

                    <div class="admin-user-info">

                        <div class="admin-user-avatar">
                            ${escapeHtml(
                                (
                                    user.full_name ||
                                    "U"
                                )
                                    .charAt(0)
                                    .toUpperCase()
                            )}
                        </div>

                        <div>

                            <strong>
                                ${escapeHtml(
                                    user.full_name ||
                                    "Unnamed"
                                )}
                            </strong>

                            <small>
                                ${escapeHtml(
                                    user.role ||
                                    "user"
                                )}
                                ·
                                ${escapeHtml(
                                    user.plan ||
                                    "free"
                                )}
                            </small>

                        </div>

                    </div>

                    <div class="admin-user-controls">

                        <input
                            type="number"
                            min="1"
                            class="limit-input"
                            value="${escapeAttribute(
                                user.project_limit ?? 5
                            )}"
                            onchange="updateUserLimit(
                                '${escapeAttribute(user.id)}',
                                'project_limit',
                                this.value
                            )"
                            title="Project limit"
                        />

                        <input
                            type="number"
                            min="1"
                            class="limit-input"
                            value="${escapeAttribute(
                                user.github_file_limit ?? 2
                            )}"
                            onchange="updateUserLimit(
                                '${escapeAttribute(user.id)}',
                                'github_file_limit',
                                this.value
                            )"
                            title="GitHub file limit"
                        />

                        ${
                            !isSelf
                                ? `
                                    <button
                                        class="${
                                            blocked
                                                ? "secondary-btn"
                                                : "danger-btn"
                                        }"
                                        onclick="${
                                            blocked
                                                ? "reactivateUser"
                                                : "blockUser"
                                        }('${escapeAttribute(user.id)}')"
                                    >
                                        ${
                                            blocked
                                                ? "Reactivate"
                                                : "Block"
                                        }
                                    </button>
                                `
                                : `
                                    <span class="self-label">
                                        You
                                    </span>
                                `
                        }

                    </div>

                </div>
            `;
        }).join("");
}


function filterAdminUsers(value) {
    const search =
        String(value || "")
            .trim()
            .toLowerCase();

    document
        .querySelectorAll(
            "[data-admin-user]"
        )
        .forEach(row => {

            const text =
                row.textContent.toLowerCase();

            row.style.display =
                !search ||
                text.includes(search)
                    ? ""
                    : "none";
        });
}


/* =========================================================
   ADMIN BLOCK / REACTIVATE
========================================================= */

async function blockUser(userId) {
    if (!requireAdmin()) return;

    if (
        String(userId) ===
        String(activeUser?.id)
    ) {
        return;
    }

    try {

        const supabase =
            getSupabase();

        const {
            error
        } = await supabase
            .from("profiles")
            .update({
                status: "blocked",
                updated_at: nowIso()
            })
            .eq("id", userId);

        if (error) throw error;

        showToast(
            "User blocked",
            "success"
        );

        await loadAdminData();

    } catch (error) {

        console.error(
            "blockUser:",
            error
        );

        showToast(
            error.message ||
            "Unable to block user",
            "error"
        );
    }
}


async function reactivateUser(userId) {
    if (!requireAdmin()) return;

    try {

        const supabase =
            getSupabase();

        const {
            error
        } = await supabase
            .from("profiles")
            .update({
                status: "active",
                updated_at: nowIso()
            })
            .eq("id", userId);

        if (error) throw error;

        showToast(
            "User reactivated",
            "success"
        );

        await loadAdminData();

    } catch (error) {

        console.error(
            "reactivateUser:",
            error
        );

        showToast(
            error.message ||
            "Unable to reactivate user",
            "error"
        );
    }
}


/* =========================================================
   ADMIN LIMIT UPDATE
========================================================= */

async function updateUserLimit(
    userId,
    column,
    value
) {
    if (!requireAdmin()) return;

    const allowed = [
        "project_limit",
        "github_file_limit"
    ];

    if (!allowed.includes(column)) {
        return;
    }

    const number =
        Number(value);

    if (
        !Number.isFinite(number) ||
        number < 1
    ) {
        showToast(
            "Invalid limit",
            "error"
        );

        return;
    }

    try {

        const supabase =
            getSupabase();

        const payload = {
            [column]: Math.floor(number),
            updated_at: nowIso()
        };

        const {
            error
        } = await supabase
            .from("profiles")
            .update(payload)
            .eq("id", userId);

        if (error) throw error;

        showToast(
            "Limit updated ✓",
            "success"
        );

    } catch (error) {

        console.error(
            "updateUserLimit:",
            error
        );

        showToast(
            error.message ||
            "Unable to update limit",
            "error"
        );
    }
}


/* =========================================================
   UPGRADE REQUEST
========================================================= */

async function requestUpgrade() {
    if (!activeUser) {
        openLoginModal();
        return;
    }

    const requested =
        window.prompt(
            "Enter the project limit you want:",
            String(
                Number(
                    activeProfile?.project_limit ?? 5
                ) + 10
            )
        );

    if (requested === null) return;

    const limit =
        Number(requested);

    if (
        !Number.isFinite(limit) ||
        limit < 1
    ) {
        showToast(
            "Invalid limit",
            "error"
        );

        return;
    }

    try {

        const supabase =
            getSupabase();

        /*
         * Uses upgrade_requests if the table exists.
         * The request is kept separate from the
         * actual profile limit.
         */

        const {
            error
        } = await supabase
            .from("upgrade_requests")
            .insert({
                user_id: activeUser.id,
                requested_project_limit:
                    Math.floor(limit),
                requested_github_file_limit:
                    Number(
                        activeProfile
                            ?.github_file_limit ?? 2
                    ),
                status: "pending",
                created_at: nowIso()
            });

        if (error) throw error;

        showToast(
            "Upgrade request sent to admin ✓",
            "success"
        );

    } catch (error) {

        console.error(
            "requestUpgrade:",
            error
        );

        showToast(
            error.message ||
            "Unable to send upgrade request",
            "error"
        );
    }
}


/* =========================================================
   TOAST SYSTEM
========================================================= */

function showToast(
    message,
    type = "info"
) {
    let container =
        document.getElementById(
            "toastContainer"
        );

    if (!container) {

        container =
            document.createElement("div");

        container.id =
            "toastContainer";

        container.className =
            "toast-container";

        document.body.appendChild(
            container
        );
    }

    const toast =
        document.createElement("div");

    toast.className =
        `toast toast-${type}`;

    toast.innerHTML = `
        <span class="toast-icon">
            ${
                type === "success"
                    ? "✓"
                    : type === "error"
                        ? "!"
                        : type === "warning"
                            ? "⚠"
                            : "i"
            }
        </span>

        <span class="toast-text">
            ${escapeHtml(message)}
        </span>

        <button
            onclick="this.parentElement.remove()"
        >
            ×
        </button>
    `;

    container.appendChild(
        toast
    );

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    setTimeout(() => {

        toast.classList.remove(
            "show"
        );

        setTimeout(() => {
            toast.remove();
        }, 250);

    }, 3500);
}


/* =========================================================
   BUTTON LOADING
========================================================= */

function setButtonLoading(
    button,
    loading,
    loadingText = "Loading..."
) {
    if (!button) return;

    if (loading) {

        if (!button.dataset.originalText) {
            button.dataset.originalText =
                button.textContent;
        }

        button.disabled = true;

        button.innerHTML = `
            <span class="button-spinner"></span>
            ${escapeHtml(loadingText)}
        `;

    } else {

        button.disabled = false;

        button.textContent =
            button.dataset.originalText ||
            "Submit";

        delete button.dataset.originalText;
    }
}


/* =========================================================
   GENERAL HELPERS
========================================================= */

function normalizePath(path) {
    return String(path || "")
        .replace(/\\/g, "/")
        .replace(/^\.\/+/, "")
        .replace(/^\/+/, "")
        .replace(/\/+/g, "/")
        .trim();
}


function getFileName(path) {
    const normalized =
        normalizePath(path);

    return (
        normalized.split("/").pop() ||
        normalized
    );
}


function getFileExtension(path) {
    const name =
        getFileName(path);

    const index =
        name.lastIndexOf(".");

    if (index < 0) {
        return "";
    }

    return name
        .slice(index + 1)
        .toLowerCase();
}


function isCssFile(file) {
    return (
        getFileExtension(file?.path) ===
        "css"
    );
}


function isJsFile(file) {
    const ext =
        getFileExtension(file?.path);

    return [
        "js",
        "jsx",
        "ts",
        "tsx"
    ].includes(ext);
}


function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function escapeAttribute(value) {
    return escapeHtml(value)
        .replace(/`/g, "&#096;");
}


function uuid() {
    if (
        typeof crypto !== "undefined" &&
        crypto.randomUUID
    ) {
        return crypto.randomUUID();
    }

    return (
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
    ).replace(
        /[xy]/g,
        character => {

            const random =
                Math.random() * 16 | 0;

            const number =
                character === "x"
                    ? random
                    : (
                        random & 0x3 |
                        0x8
                    );

            return number
                .toString(16);
        }
    );
}


function nowIso() {
    return new Date().toISOString();
}


function findDefaultFileId(files) {
    const index =
        files.find(
            file =>
                normalizePath(file.path) ===
                "index.html"
        );

    return (
        index?.id ||
        files[0]?.id ||
        null
    );
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeBuildPilot() {

    /*
     * First check public route.
     * Public website must NOT show the editor.
     */

    if (checkPublicRoute()) {
        return;
    }

    injectBuildPilotStyles();

    setupGlobalEvents();

    updateAuthUI();

    try {

        const user =
            await getCurrentSessionUser();

        if (!user) {

            activeUser = null;

            updateAuthUI();

            showLandingPage();

            return;
        }

        activeUser = user;

        await ensureProfile();

        updateAuthUI();

        /*
         * Blocked accounts should not continue.
         */

        if (
            String(
                activeProfile?.status ||
                "active"
            ).toLowerCase() ===
            "blocked"
        ) {
            showBlockedScreen();
            return;
        }

        showAppShell();

        await loadDashboard();

    } catch (error) {

        console.error(
            "initializeBuildPilot:",
            error
        );

        showLandingPage();
    }
}


/* =========================================================
   AUTH STATE LISTENER
========================================================= */

function setupAuthStateListener() {

    try {

        const supabase =
            getSupabase();

        supabase.auth.onAuthStateChange(
            async (
                event,
                session
            ) => {

                if (session?.user) {

                    activeUser =
                        session.user;

                    await ensureProfile();

                    updateAuthUI();

                } else {

                    activeUser = null;
                    activeProfile = null;

                    updateAuthUI();

                    showLandingPage();
                }
            }
        );

    } catch (error) {

        console.error(
            "Auth listener:",
            error
        );
    }
}


/* =========================================================
   CSS INJECTION
========================================================= */

function injectBuildPilotStyles() {

    if (
        document.getElementById(
            "buildPilotInjectedStyles"
        )
    ) {
        return;
    }

    const style =
        document.createElement("style");

    style.id =
        "buildPilotInjectedStyles";

    style.textContent = `

/* =====================================================
   GLOBAL
===================================================== */

* {
    box-sizing: border-box;
}

html,
body {
    margin: 0;
    padding: 0;
    width: 100%;
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
        #0b0d10;

    color:
        #f4f4f5;
}

button,
input,
textarea,
select {
    font: inherit;
}

button {
    cursor: pointer;
}

.hidden {
    display: none !important;
}


/* =====================================================
   BUTTONS
===================================================== */

.primary-btn,
.secondary-btn,
.danger-btn,
.small-btn,
.link-btn {
    border: 0;
    border-radius: 10px;
    transition:
        .18s ease;
}

.primary-btn {
    background:
        #ffffff;

    color:
        #111111;

    padding:
        11px 16px;

    font-weight:
        700;
}

.primary-btn:hover {
    transform:
        translateY(-1px);

    opacity:
        .92;
}

.secondary-btn {
    background:
        #1b1e24;

    color:
        #ffffff;

    border:
        1px solid #30343c;

    padding:
        10px 15px;
}

.secondary-btn:hover {
    background:
        #242830;
}

.danger-btn {
    background:
        #3a1518;

    color:
        #ffb4b4;

    border:
        1px solid #6d252b;

    padding:
        9px 13px;
}

.small-btn {
    background:
        #20242b;

    color:
        white;

    padding:
        7px 10px;
}

.link-btn {
    background:
        transparent;

    color:
        #9ca3af;

    padding:
        8px;
}

.link-btn:hover {
    color:
        white;
}

.full-btn {
    width:
        100%;
}


/* =====================================================
   MODALS
===================================================== */

.modal {
    position:
        fixed;

    inset:
        0;

    z-index:
        10000;

    display:
        none;

    align-items:
        center;

    justify-content:
        center;

    padding:
        20px;
}

.modal.open {
    display:
        flex;
}

.modal-backdrop {
    position:
        absolute;

    inset:
        0;

    background:
        rgba(0,0,0,.72);

    backdrop-filter:
        blur(8px);
}

.modal-card {
    position:
        relative;

    z-index:
        1;

    width:
        min(560px, 100%);

    max-height:
        90vh;

    overflow:
        auto;

    background:
        #111419;

    border:
        1px solid #292e37;

    border-radius:
        18px;

    box-shadow:
        0 30px 100px
        rgba(0,0,0,.5);
}

.modal-header {
    display:
        flex;

    justify-content:
        space-between;

    gap:
        20px;

    padding:
        22px;

    border-bottom:
        1px solid #252932;
}

.modal-header h3 {
    margin:
        0 0 5px;

    font-size:
        19px;
}

.modal-header p {
    margin:
        0;

    color:
        #8b929e;

    font-size:
        13px;
}

.modal-close {
    width:
        34px;

    height:
        34px;

    border:
        0;

    border-radius:
        9px;

    background:
        #1c2026;

    color:
        #aab0b8;

    font-size:
        20px;
}

.modal-body {
    padding:
        22px;
}

.modal-footer {
    display:
        flex;

    justify-content:
        flex-end;

    gap:
        10px;

    padding:
        18px 22px;

    border-top:
        1px solid #252932;
}

.input-label {
    display:
        block;

    margin:
        0 0 7px;

    color:
        #aeb4bd;

    font-size:
        13px;

    font-weight:
        600;
}

.text-input,
.text-area,
select.text-input {
    width:
        100%;

    border:
        1px solid #30353e;

    border-radius:
        10px;

    background:
        #0c0f13;

    color:
        #ffffff;

    padding:
        11px 13px;

    outline:
        none;

    margin:
        0 0 17px;
}

.text-input:focus,
.text-area:focus,
select.text-input:focus {
    border-color:
        #6d7480;

    box-shadow:
        0 0 0 3px
        rgba(255,255,255,.04);
}

.text-area {
    resize:
        vertical;
}

.file-examples {
    color:
        #737b87;

    font-size:
        12px;

    margin:
        -8px 0 18px;
}

.file-examples code {
    color:
        #b7bec8;

    margin-right:
        5px;
}


/* =====================================================
   AUTH
===================================================== */

.auth-card {
    width:
        min(430px, 100%);
}

.auth-logo {
    display:
        flex;

    justify-content:
        center;

    padding:
        28px 0 0;
}

.auth-logo-mark {
    width:
        48px;

    height:
        48px;

    display:
        flex;

    align-items:
        center;

    justify-content:
        center;

    border-radius:
        14px;

    background:
        #ffffff;

    color:
        #111111;

    font-size:
        25px;
}

.auth-header {
    border:
        0;

    padding-bottom:
        8px;
}

.auth-footer {
    flex-direction:
        column;
}

.auth-error {
    color:
        #ff8d8d;

    font-size:
        13px;

    min-height:
        20px;
}


/* =====================================================
   TOAST
===================================================== */

.toast-container {
    position:
        fixed;

    right:
        20px;

    bottom:
        20px;

    z-index:
        20000;

    display:
        flex;

    flex-direction:
        column;

    gap:
        10px;

    width:
        min(380px, calc(100vw - 40px));
}

.toast {
    display:
        flex;

    align-items:
        center;

    gap:
        10px;

    padding:
        12px 14px;

    border:
        1px solid #30353e;

    border-radius:
        12px;

    background:
        #15191f;

    box-shadow:
        0 15px 40px
        rgba(0,0,0,.3);

    opacity:
        0;

    transform:
        translateY(8px);

    transition:
        .2s ease;
}

.toast.show {
    opacity:
        1;

    transform:
        translateY(0);
}

.toast-icon {
    width:
        23px;

    height:
        23px;

    display:
        flex;

    align-items:
        center;

    justify-content:
        center;

    border-radius:
        50%;

    background:
        #242a32;
}

.toast-text {
    flex:
        1;

    font-size:
        13px;
}

.toast button {
    background:
        transparent;

    border:
        0;

    color:
        #8c939e;

    font-size:
        18px;
}


/* =====================================================
   AI PANEL
===================================================== */

.ai-message {
    display:
        flex;

    gap:
        9px;

    margin:
        12px 0;
}

.ai-message-avatar {
    width:
        27px;

    height:
        27px;

    min-width:
        27px;

    border-radius:
        8px;

    display:
        flex;

    align-items:
        center;

    justify-content:
        center;

    background:
        #242830;

    color:
        #ffffff;

    font-size:
        10px;

    font-weight:
        800;
}

.ai-message.user {
    flex-direction:
        row-reverse;
}

.ai-message-content {
    max-width:
        85%;

    padding:
        10px 12px;

    border-radius:
        11px;

    background:
        #171a20;

    color:
        #d8dce2;

    font-size:
        13px;

    line-height:
        1.55;
}

.ai-message.user
.ai-message-content {
    background:
        #262b33;
}

.ai-message-content pre {
    overflow:
        auto;

    padding:
        10px;

    background:
        #0a0c0f;

    border-radius:
        8px;
}

.ai-typing {
    display:
        flex;

    align-items:
        center;

    gap:
        4px;
}

.ai-typing span {
    width:
        5px;

    height:
        5px;

    border-radius:
        50%;

    background:
        #9ca3af;

    animation:
        aiTyping 1s infinite;
}

.ai-typing span:nth-child(2) {
    animation-delay:
        .15s;
}

.ai-typing span:nth-child(3) {
    animation-delay:
        .3s;
}

@keyframes aiTyping {
    0%, 100% {
        opacity: .3;
        transform: translateY(0);
    }

    50% {
        opacity: 1;
        transform: translateY(-3px);
    }
}


/* =====================================================
   FILE EXPLORER
===================================================== */

.file-item {
    display:
        flex;

    align-items:
        center;

    gap:
        7px;

    padding:
        7px 9px;

    margin:
        2px 6px;

    border-radius:
        7px;

    color:
        #9ca3af;

    cursor:
        pointer;

    font-size:
        12px;
}

.file-item:hover {
    background:
        #191d23;

    color:
        white;
}

.file-item.active {
    background:
        #252a32;

    color:
        white;
}

.file-name {
    flex:
        1;

    overflow:
        hidden;

    text-overflow:
        ellipsis;

    white-space:
        nowrap;
}

.file-delete {
    border:
        0;

    background:
        transparent;

    color:
        #717984;

    opacity:
        0;
}

.file-item:hover
.file-delete {
    opacity:
        1;
}

.file-delete:hover {
    color:
        #ff8888;
}

.empty-files {
    padding:
        30px 15px;

    text-align:
        center;

    color:
        #707782;
}

.empty-files-icon {
    font-size:
        30px;

    margin-bottom:
        8px;
}


/* =====================================================
   GENERATED IMAGES
===================================================== */

.generated-image-card {
    overflow:
        hidden;

    border:
        1px solid #2a2e35;

    border-radius:
        10px;

    margin:
        10px 0;

    background:
        #12151a;
}

.generated-image-card img {
    width:
        100%;

    display:
        block;

    aspect-ratio:
        16 / 10;

    object-fit:
        cover;
}

.generated-image-actions {
    display:
        flex;

    gap:
        7px;

    padding:
        8px;
}

.generated-image-actions button {
    flex:
        1;

    border:
        0;

    border-radius:
        7px;

    padding:
        7px;

    background:
        #252a32;

    color:
        white;

    cursor:
        pointer;

    font-size:
        11px;
}

.ai-image-chip {
    display:
        flex;

    align-items:
        center;

    gap:
        8px;

    padding:
        7px;

    border:
        1px solid #30353d;

    border-radius:
        9px;

    background:
        #14171c;

    margin:
        7px 0;
}

.ai-image-chip img {
    width:
        36px;

    height:
        36px;

    border-radius:
        6px;

    object-fit:
        cover;
}

.ai-image-name {
    flex:
        1;

    overflow:
        hidden;

    text-overflow:
        ellipsis;

    white-space:
        nowrap;

    font-size:
        11px;

    color:
        #aeb4bd;
}

.ai-image-chip button {
    border:
        0;

    background:
        transparent;

    color:
        #9aa1ab;

    font-size:
        17px;
}


/* =====================================================
   ADMIN
===================================================== */

.side-panel {
    position:
        fixed;

    top:
        0;

    right:
        0;

    z-index:
        11000;

    width:
        min(760px, 100vw);

    height:
        100vh;

    overflow:
        auto;

    background:
        #101318;

    border-left:
        1px solid #292e36;

    box-shadow:
        -30px 0 80px
        rgba(0,0,0,.4);

    transform:
        translateX(100%);

    transition:
        .25s ease;
}

.side-panel.open {
    transform:
        translateX(0);
}

.side-panel-header {
    position:
        sticky;

    top:
        0;

    z-index:
        2;

    display:
        flex;

    align-items:
        center;

    justify-content:
        space-between;

    padding:
        18px;

    background:
        #101318;

    border-bottom:
        1px solid #292e36;
}

.side-panel-header strong {
    display:
        block;

    margin-bottom:
        3px;
}

.side-panel-header small {
    color:
        #7d8490;

    font-size:
        11px;
}

.admin-stats {
    display:
        grid;

    grid-template-columns:
        repeat(3, 1fr);

    gap:
        10px;

    padding:
        15px;
}

.admin-stat {
    padding:
        16px;

    border:
        1px solid #292e36;

    border-radius:
        12px;

    background:
        #15191f;
}

.admin-stat strong {
    display:
        block;

    font-size:
        22px;
}

.admin-stat span {
    color:
        #858c97;

    font-size:
        11px;
}

.admin-toolbar {
    padding:
        0 15px 10px;
}

.admin-users-list {
    padding:
        5px 15px 20px;
}

.admin-user-row {
    display:
        flex;

    align-items:
        center;

    justify-content:
        space-between;

    gap:
        15px;

    padding:
        12px;

    margin:
        6px 0;

    border:
        1px solid #292e36;

    border-radius:
        12px;

    background:
        #14181e;
}

.admin-user-info {
    display:
        flex;

    align-items:
        center;

    gap:
        10px;

    min-width:
        180px;
}

.admin-user-avatar {
    width:
        34px;

    height:
        34px;

    border-radius:
        9px;

    display:
        flex;

    align-items:
        center;

    justify-content:
        center;

    background:
        #252a31;

    font-size:
        12px;

    font-weight:
        700;
}

.admin-user-info strong,
.admin-user-info small {
    display:
        block;
}

.admin-user-info small {
    color:
        #777f8a;

    margin-top:
        3px;

    font-size:
        10px;
}

.admin-user-controls {
    display:
        flex;

    align-items:
        center;

    gap:
        6px;

    flex-wrap:
        wrap;

    justify-content:
        flex-end;
}

.limit-input {
    width:
        65px;

    border:
        1px solid #30353c;

    background:
        #0c0f13;

    color:
        white;

    border-radius:
        7px;

    padding:
        7px;

    font-size:
        11px;
}

.self-label {
    color:
        #707782;

    font-size:
        11px;
}


/* =====================================================
   BLOCKED
===================================================== */

.blocked-screen {
    position:
        fixed;

    inset:
        0;

    z-index:
        30000;

    display:
        flex;

    align-items:
        center;

    justify-content:
        center;

    background:
        #090b0e;

    padding:
        20px;
}

.blocked-card {
    width:
        min(420px, 100%);

    text-align:
        center;

    padding:
        40px;

    border:
        1px solid #292e36;

    border-radius:
        18px;

    background:
        #111419;
}

.blocked-icon {
    font-size:
        40px;

    margin-bottom:
        15px;
}

.blocked-card h2 {
    margin:
        0 0 10px;
}

.blocked-card p {
    color:
        #858c97;

    line-height:
        1.6;

    margin-bottom:
        25px;
}


/* =====================================================
   PUBLISH
===================================================== */

.publish-url-box {
    display:
        flex;

    gap:
        8px;
}

.publish-url-box .text-input {
    margin:
        0;

    flex:
        1;
}

.publish-note {
    margin-top:
        12px;

    color:
        #747c88;

    font-size:
        12px;

    line-height:
        1.5;
}

.detail-row {
    display:
        flex;

    justify-content:
        space-between;

    gap:
        20px;

    padding:
        12px 0;

    border-bottom:
        1px solid #242830;
}

.detail-row span {
    color:
        #7f8792;
}

.detail-row code {
    color:
        #c4cad2;

    max-width:
        65%;

    overflow:
        hidden;

    text-overflow:
        ellipsis;
}


/* =====================================================
   SPINNER
===================================================== */

.button-spinner {
    display:
        inline-block;

    width:
        12px;

    height:
        12px;

    border:
        2px solid
        rgba(0,0,0,.25);

    border-top-color:
        currentColor;

    border-radius:
        50%;

    animation:
        spin .7s linear infinite;

    vertical-align:
        -2px;

    margin-right:
        5px;
}

@keyframes spin {
    to {
        transform:
            rotate(360deg);
    }
}


/* =====================================================
   MOBILE
===================================================== */

@media (max-width: 800px) {

    .admin-user-row {
        align-items:
            flex-start;

        flex-direction:
            column;
    }

    .admin-user-info {
        width:
            100%;
    }

    .admin-user-controls {
        width:
            100%;

        justify-content:
            flex-start;
    }

    .admin-stats {
        grid-template-columns:
            1fr;
    }

    .publish-url-box {
        flex-direction:
            column;
    }

    .modal {
        padding:
            10px;
    }

    .modal-card {
        max-height:
            94vh;
    }
}

`;

    document.head.appendChild(style);
}


/* =========================================================
   GLOBAL BUTTON EVENTS
========================================================= */

function setupNavigationButtons() {

    document.addEventListener(
        "click",
        event => {

            const target =
                event.target.closest(
                    "[data-action]"
                );

            if (!target) return;

            const action =
                target.dataset.action;

            switch (action) {

                case "login":
                    openLoginModal();
                    break;

                case "signup":
                    openSignupModal();
                    break;

                case "logout":
                    logoutUser();
                    break;

                case "create-project":
                    openCreateProjectModal();
                    break;

                case "admin":
                    openAdminPanel();
                    break;

                case "save":
                    saveCurrentFile();
                    break;

                case "save-all":
                    saveAllProjectFiles();
                    break;

                case "preview":
                    refreshPreview();
                    break;

                case "full-preview":
                    openFullPreview();
                    break;

                case "publish":
                    publishProject();
                    break;

                case "new-file":
                    openCreateFileModal();
                    break;

                case "project-info":
                    openProjectDetails();
                    break;

                case "rename-project":
                    renameCurrentProject();
                    break;

                case "delete-project":
                    deleteCurrentProject();
                    break;

                case "copy-code":
                    copyCurrentFileCode();
                    break;

                case "format-code":
                    formatCurrentCode();
                    break;

                case "fullscreen":
                    toggleEditorFullscreen();
                    break;

                case "ai-toggle":
                    toggleAIPanel();
                    break;

                case "upgrade":
                    requestUpgrade();
                    break;
            }
        }
    );
}


/* =========================================================
   BEFORE UNLOAD
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {
        saveEditorToMemory();
    }
);


/* =========================================================
   DOM READY
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        async () => {

            setupNavigationButtons();

            setupAuthStateListener();

            await initializeBuildPilot();

        },
        {
            once: true
        }
    );

} else {

    setupNavigationButtons();

    setupAuthStateListener();

    initializeBuildPilot();
}


/* =========================================================
   FINAL GLOBAL EXPORTS
========================================================= */

window.openLoginModal =
    openLoginModal;

window.closeLoginModal =
    closeLoginModal;

window.openSignupModal =
    openSignupModal;

window.closeSignupModal =
    closeSignupModal;

window.loginUser =
    loginUser;

window.signupUser =
    signupUser;

window.logoutUser =
    logoutUser;

window.openCreateProjectModal =
    openCreateProjectModal;

window.closeCreateProjectModal =
    closeCreateProjectModal;

window.createNewProject =
    createNewProject;

window.openProject =
    openProject;

window.openProjectDetails =
    openProjectDetails;

window.closeProjectDetails =
    closeProjectDetails;

window.renameCurrentProject =
    renameCurrentProject;

window.deleteCurrentProject =
    deleteCurrentProject;

window.openCreateFileModal =
    openCreateFileModal;

window.closeCreateFileModal =
    closeCreateFileModal;

window.createProjectFile =
    createProjectFile;

window.deleteProjectFile =
    deleteProjectFile;

window.selectEditorFile =
    selectEditorFile;

window.saveCurrentFile =
    saveCurrentFile;

window.saveAllProjectFiles =
    saveAllProjectFiles;

window.refreshPreview =
    refreshPreview;

window.openFullPreview =
    openFullPreview;

window.publishProject =
    publishProject;

window.copyPublishedUrl =
    copyPublishedUrl;

window.submitAIInstruction =
    submitAIInstruction;

window.generateImageFromPrompt =
    generateImageFromPrompt;

window.handleAIImageSelected =
    handleAIImageSelected;

window.removePendingAIImage =
    removePendingAIImage;

window.useGeneratedImage =
    useGeneratedImage;

window.openAdminPanel =
    openAdminPanel;

window.closeAdminPanel =
    closeAdminPanel;

window.blockUser =
    blockUser;

window.reactivateUser =
    reactivateUser;

window.updateUserLimit =
    updateUserLimit;

window.requestUpgrade =
    requestUpgrade;

window.toggleAIPanel =
    toggleAIPanel;

window.toggleFileSidebar =
    toggleFileSidebar;

window.togglePreviewPanel =
    togglePreviewPanel;

window.toggleEditorFullscreen =
    toggleEditorFullscreen;

window.copyCurrentFileCode =
    copyCurrentFileCode;

window.formatCurrentCode =
    formatCurrentCode;

window.filterFiles =
    filterFiles;

window.filterProjectList =
    filterProjectList;

window.filterAdminUsers =
    filterAdminUsers;

window.exportProjectJSON =
    exportProjectJSON;


/* =========================================================
   APP.JS COMPLETE
========================================================= */
