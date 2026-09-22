(function () {
  "use strict";

  /*
   * ============================================================
   * BUILDPILOT AI
   * Frontend Application
   * ============================================================
   */

  const CONFIG = window.BUILDPILOT_CONFIG || {};

  const SUPABASE_URL = CONFIG.SUPABASE_URL;
  const SUPABASE_KEY =
    CONFIG.SUPABASE_PUBLISHABLE_KEY;

  const GENERATE_FUNCTION =
    CONFIG.FUNCTION_NAME || "super-function";

  const PUBLIC_FUNCTION =
    CONFIG.PUBLIC_FUNCTION_NAME ||
    "public-project";

  const PUBLIC_BASE_URL =
    window.location.origin +
    window.location.pathname;

  if (!window.supabase) {
    document.body.innerHTML = `
      <div style="
        padding:40px;
        font-family:Arial,sans-serif;
        text-align:center;
      ">
        <h2>BuildPilot AI</h2>
        <p>Supabase library load नहीं हुई।</p>
        <button onclick="location.reload()">Refresh</button>
      </div>
    `;

    return;
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    document.body.innerHTML = `
      <div style="
        padding:40px;
        font-family:Arial,sans-serif;
        text-align:center;
      ">
        <h2>BuildPilot AI</h2>
        <p>Supabase configuration missing है।</p>
        <p>config.js check करें।</p>
      </div>
    `;

    return;
  }

  const sb = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  let activeUser = null;
  let activeSession = null;
  let activeProject = null;
  let activeFiles = [];
  let currentView = "home";
  let previewTimer = null;

  const $ = (selector) =>
    document.querySelector(selector);

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function appRoot() {
    let root = document.getElementById("app");

    if (!root) {
      root = document.createElement("div");
      root.id = "app";
      document.body.appendChild(root);
    }

    return root;
  }

  function showMessage(message, type = "info") {
    let box = document.getElementById(
      "buildpilot-toast"
    );

    if (!box) {
      box = document.createElement("div");

      box.id = "buildpilot-toast";

      box.style.position = "fixed";
      box.style.right = "20px";
      box.style.bottom = "20px";
      box.style.zIndex = "99999";
      box.style.maxWidth = "420px";
      box.style.padding = "14px 18px";
      box.style.borderRadius = "12px";
      box.style.background = "#111827";
      box.style.color = "#fff";
      box.style.fontFamily = "Arial,sans-serif";
      box.style.boxShadow =
        "0 10px 30px rgba(0,0,0,.25)";

      document.body.appendChild(box);
    }

    const prefix =
      type === "success"
        ? "✓ "
        : type === "error"
        ? "✕ "
        : "";

    box.textContent = prefix + message;

    clearTimeout(box._timer);

    box._timer = setTimeout(() => {
      box.remove();
    }, 4000);
  }

  function setLoading(button, loading, text) {
    if (!button) return;

    if (loading) {
      button.dataset.oldText =
        button.textContent;

      button.disabled = true;

      button.textContent =
        text || "Please wait...";
    } else {
      button.disabled = false;

      button.textContent =
        button.dataset.oldText ||
        button.textContent;
    }
  }

  /*
   * ============================================================
   * PUBLIC PROJECT MODE
   * ============================================================
   */

  function getPublicIdFromUrl() {
    const params = new URLSearchParams(
      window.location.search
    );

    return (
      params.get("public") ||
      params.get("publicId") ||
      ""
    ).trim();
  }

  async function loadPublicProject(publicId) {
    const root = appRoot();

    root.innerHTML = `
      <div style="
        min-height:100vh;
        display:flex;
        align-items:center;
        justify-content:center;
        font-family:Arial,sans-serif;
        background:#f8fafc;
      ">
        <div style="
          text-align:center;
          padding:30px;
        ">
          <h2>BuildPilot Preview</h2>
          <p>Public project load हो रहा है...</p>
        </div>
      </div>
    `;

    try {
      const url =
        SUPABASE_URL +
        "/functions/v1/" +
        encodeURIComponent(
          PUBLIC_FUNCTION
        ) +
        "?id=" +
        encodeURIComponent(publicId);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          apikey: SUPABASE_KEY,
          "Content-Type":
            "application/json",
        },
      });

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Public project load failed"
        );
      }

      const html = data.html || "";

      /*
       * Render published project.
       * We intentionally don't copy the entire response object
       * into the DOM.
       */
      document.open();

      document.write(html);

      document.close();
    } catch (error) {
      console.error(error);

      root.innerHTML = `
        <div style="
          min-height:100vh;
          display:flex;
          align-items:center;
          justify-content:center;
          font-family:Arial,sans-serif;
          background:#f8fafc;
        ">
          <div style="
            width:min(600px,90%);
            padding:30px;
            border-radius:16px;
            background:white;
            box-shadow:0 10px 40px rgba(0,0,0,.1);
          ">
            <h2>Project unavailable</h2>
            <p>
              यह public project अभी available नहीं है
              या publish नहीं किया गया है।
            </p>

            <p style="
              color:#64748b;
              word-break:break-word;
            ">
              ${escapeHtml(
                error.message
              )}
            </p>
          </div>
        </div>
      `;
    }
  }

  /*
   * ============================================================
   * AUTH
   * ============================================================
   */

  async function getSession() {
    const result =
      await sb.auth.getSession();

    activeSession =
      result.data?.session || null;

    activeUser =
      activeSession?.user || null;

    return activeSession;
  }

  async function requireSession() {
    await getSession();

    if (!activeSession) {
      renderLogin();

      return false;
    }

    return true;
  }

  function renderLogin() {
    currentView = "login";

    appRoot().innerHTML = `
      <div style="
        min-height:100vh;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#f1f5f9;
        padding:20px;
        font-family:Arial,sans-serif;
      ">

        <div style="
          width:min(430px,100%);
          background:white;
          border-radius:20px;
          padding:30px;
          box-shadow:0 15px 50px rgba(0,0,0,.12);
        ">

          <div style="text-align:center;">
            <h1 style="margin-bottom:5px;">
              BuildPilot AI
            </h1>

            <p style="color:#64748b;">
              Describe it. Build it. Deploy it.
            </p>
          </div>

          <div style="
            display:flex;
            gap:8px;
            margin:25px 0;
          ">
            <button
              id="loginTab"
              onclick="window.BuildPilot.showLoginForm()"
              style="
                flex:1;
                padding:11px;
                border:0;
                border-radius:10px;
                cursor:pointer;
              "
            >
              Login
            </button>

            <button
              id="signupTab"
              onclick="window.BuildPilot.showSignupForm()"
              style="
                flex:1;
                padding:11px;
                border:0;
                border-radius:10px;
                cursor:pointer;
              "
            >
              Sign Up
            </button>
          </div>

          <div id="authForm"></div>

        </div>
      </div>
    `;

    showLoginForm();
  }

  function showLoginForm() {
    const form = document.getElementById(
      "authForm"
    );

    if (!form) return;

    form.innerHTML = `
      <form id="loginForm">

        <label>Email</label>

        <input
          id="loginEmail"
          type="email"
          required
          placeholder="you@example.com"
          style="
            width:100%;
            box-sizing:border-box;
            padding:13px;
            margin:7px 0 16px;
            border:1px solid #cbd5e1;
            border-radius:10px;
          "
        />

        <label>Password</label>

        <input
          id="loginPassword"
          type="password"
          required
          placeholder="Password"
          style="
            width:100%;
            box-sizing:border-box;
            padding:13px;
            margin:7px 0 16px;
            border:1px solid #cbd5e1;
            border-radius:10px;
          "
        />

        <button
          type="submit"
          id="loginButton"
          style="
            width:100%;
            padding:13px;
            border:0;
            border-radius:10px;
            background:#111827;
            color:white;
            cursor:pointer;
          "
        >
          Login
        </button>

      </form>
    `;

    document
      .getElementById("loginForm")
      .addEventListener(
        "submit",
        loginUser
      );
  }

  function showSignupForm() {
    const form = document.getElementById(
      "authForm"
    );

    if (!form) return;

    form.innerHTML = `
      <form id="signupForm">

        <label>Full Name</label>

        <input
          id="signupName"
          type="text"
          required
          placeholder="Your name"
          style="
            width:100%;
            box-sizing:border-box;
            padding:13px;
            margin:7px 0 16px;
            border:1px solid #cbd5e1;
            border-radius:10px;
          "
        />

        <label>Email</label>

        <input
          id="signupEmail"
          type="email"
          required
          placeholder="you@example.com"
          style="
            width:100%;
            box-sizing:border-box;
            padding:13px;
            margin:7px 0 16px;
            border:1px solid #cbd5e1;
            border-radius:10px;
          "
        />

        <label>Password</label>

        <input
          id="signupPassword"
          type="password"
          required
          minlength="6"
          placeholder="Minimum 6 characters"
          style="
            width:100%;
            box-sizing:border-box;
            padding:13px;
            margin:7px 0 16px;
            border:1px solid #cbd5e1;
            border-radius:10px;
          "
        />

        <button
          type="submit"
          id="signupButton"
          style="
            width:100%;
            padding:13px;
            border:0;
            border-radius:10px;
            background:#111827;
            color:white;
            cursor:pointer;
          "
        >
          Create Account
        </button>

      </form>
    `;

    document
      .getElementById("signupForm")
      .addEventListener(
        "submit",
        signupUser
      );
  }

  async function loginUser(event) {
    event.preventDefault();

    const button =
      document.getElementById(
        "loginButton"
      );

    setLoading(
      button,
      true,
      "Logging in..."
    );

    try {
      const email =
        document.getElementById(
          "loginEmail"
        ).value.trim();

      const password =
        document.getElementById(
          "loginPassword"
        ).value;

      const {
        data,
        error,
      } = await sb.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      activeSession = data.session;
      activeUser = data.user;

      showMessage(
        "Login successful",
        "success"
      );

      renderHome();
    } catch (error) {
      showMessage(
        error.message ||
          "Login failed",
        "error"
      );
    } finally {
      setLoading(button, false);
    }
  }

  async function signupUser(event) {
    event.preventDefault();

    const button =
      document.getElementById(
        "signupButton"
      );

    setLoading(
      button,
      true,
      "Creating account..."
    );

    try {
      const name =
        document.getElementById(
          "signupName"
        ).value.trim();

      const email =
        document.getElementById(
          "signupEmail"
        ).value.trim();

      const password =
        document.getElementById(
          "signupPassword"
        ).value;

      const {
        data,
        error,
      } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        activeSession = data.session;
        activeUser = data.user;

        await ensureProfile();

        showMessage(
          "Account created",
          "success"
        );

        renderHome();
      } else {
        showMessage(
          "Account created. Email confirmation required.",
          "success"
        );

        showLoginForm();
      }
    } catch (error) {
      showMessage(
        error.message ||
          "Signup failed",
        "error"
      );
    } finally {
      setLoading(button, false);
    }
  }

  async function logoutUser() {
    await sb.auth.signOut();

    activeSession = null;
    activeUser = null;
    activeProject = null;
    activeFiles = [];

    renderLogin();
  }

  async function ensureProfile() {
    if (!activeUser) return;

    const { data: profile } =
      await sb
        .from("profiles")
        .select("id")
        .eq("id", activeUser.id)
        .maybeSingle();

    if (profile) return;

    await sb
      .from("profiles")
      .insert({
        id: activeUser.id,
        full_name:
          activeUser.user_metadata
            ?.full_name ||
          activeUser.email ||
          "User",
      });
  }

  /*
   * ============================================================
   * HOME
   * ============================================================
   */

  async function renderHome() {
    if (!(await requireSession())) {
      return;
    }

    currentView = "home";

    const root = appRoot();

    root.innerHTML = `
      <div style="
        min-height:100vh;
        background:#f8fafc;
        font-family:Arial,sans-serif;
      ">

        <header style="
          height:64px;
          background:#111827;
          color:white;
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding:0 24px;
          box-sizing:border-box;
        ">

          <strong>
            BuildPilot AI
          </strong>

          <div style="
            display:flex;
            align-items:center;
            gap:12px;
          ">

            <span style="
              font-size:13px;
              opacity:.8;
            ">
              ${escapeHtml(
                activeUser?.email ||
                  ""
              )}
            </span>

            <button
              onclick="window.BuildPilot.logout()"
              style="
                border:1px solid #475569;
                background:transparent;
                color:white;
                padding:8px 12px;
                border-radius:8px;
                cursor:pointer;
              "
            >
              Logout
            </button>

          </div>

        </header>

        <main style="
          max-width:1100px;
          margin:0 auto;
          padding:35px 20px;
        ">

          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:20px;
            flex-wrap:wrap;
          ">

            <div>
              <h1 style="margin:0 0 8px;">
                What do you want to build?
              </h1>

              <p style="
                margin:0;
                color:#64748b;
              ">
                Describe your project and BuildPilot AI will build it.
              </p>
            </div>

          </div>

          <div style="
            display:grid;
            grid-template-columns:
              repeat(auto-fit,minmax(220px,1fr));
            gap:18px;
            margin-top:30px;
          ">

            <button
              onclick="window.BuildPilot.startProject('complete_system')"
              style="
                text-align:left;
                border:1px solid #e2e8f0;
                background:white;
                padding:25px;
                border-radius:16px;
                cursor:pointer;
                box-shadow:0 5px 20px rgba(0,0,0,.04);
              "
            >
              <div style="font-size:32px;">🚀</div>

              <h3>
                Complete System
              </h3>

              <p style="
                color:#64748b;
                line-height:1.5;
              ">
                Website, dashboard, database,
                authentication and business logic.
              </p>
            </button>

            <button
              onclick="window.BuildPilot.startProject('website')"
              style="
                text-align:left;
                border:1px solid #e2e8f0;
                background:white;
                padding:25px;
                border-radius:16px;
                cursor:pointer;
                box-shadow:0 5px 20px rgba(0,0,0,.04);
              "
            >
              <div style="font-size:32px;">🌐</div>

              <h3>
                Website
              </h3>

              <p style="
                color:#64748b;
                line-height:1.5;
              ">
                Responsive HTML, CSS and JavaScript
                website.
              </p>
            </button>

          </div>

          <section style="
            margin-top:45px;
          ">

            <div style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              margin-bottom:15px;
            ">

              <h2>
                My Projects
              </h2>

              <button
                onclick="window.BuildPilot.loadProjects()"
                style="
                  padding:9px 13px;
                  border:1px solid #cbd5e1;
                  background:white;
                  border-radius:8px;
                  cursor:pointer;
                "
              >
                Refresh
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

  /*
   * ============================================================
   * PROJECT CREATION
   * ============================================================
   */

  async function startProject(projectType) {
    currentView = "builder";

    appRoot().innerHTML = `
      <div style="
        min-height:100vh;
        background:#f8fafc;
        font-family:Arial,sans-serif;
        padding:30px 20px;
        box-sizing:border-box;
      ">

        <div style="
          max-width:850px;
          margin:auto;
        ">

          <button
            onclick="window.BuildPilot.home()"
            style="
              border:0;
              background:none;
              cursor:pointer;
              margin-bottom:20px;
            "
          >
            ← Back
          </button>

          <div style="
            background:white;
            padding:30px;
            border-radius:18px;
            box-shadow:0 10px 35px rgba(0,0,0,.08);
          ">

            <h1>
              Build your project
            </h1>

            <p style="color:#64748b;">
              ${projectType === "website"
                ? "Website"
                : "Complete System"}
            </p>

            <label>
              Project Name
            </label>

            <input
              id="newProjectName"
              type="text"
              placeholder="My Business Website"
              style="
                width:100%;
                box-sizing:border-box;
                padding:14px;
                margin:8px 0 20px;
                border:1px solid #cbd5e1;
                border-radius:10px;
              "
            />

            <label>
              Describe your project
            </label>

            <textarea
              id="newProjectPrompt"
              rows="8"
              placeholder="Example: Create a modern coaching website with Home, Courses, Teachers, About and Contact pages."
              style="
                width:100%;
                box-sizing:border-box;
                padding:14px;
                margin:8px 0 20px;
                border:1px solid #cbd5e1;
                border-radius:10px;
                resize:vertical;
              "
            ></textarea>

            <div style="
              display:grid;
              grid-template-columns:
                repeat(auto-fit,minmax(220px,1fr));
              gap:15px;
            ">

              <div>
                <label>Frontend</label>

                <select
                  id="frontend"
                  style="
                    width:100%;
                    padding:12px;
                    margin-top:7px;
                    border:1px solid #cbd5e1;
                    border-radius:10px;
                  "
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

              <div>
                <label>Backend</label>

                <select
                  id="backend"
                  style="
                    width:100%;
                    padding:12px;
                    margin-top:7px;
                    border:1px solid #cbd5e1;
                    border-radius:10px;
                  "
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
              onclick="window.BuildPilot.createProject('${projectType}')"
              style="
                margin-top:25px;
                width:100%;
                padding:15px;
                border:0;
                border-radius:10px;
                background:#111827;
                color:white;
                cursor:pointer;
                font-size:16px;
              "
            >
              Build Project
            </button>

          </div>

        </div>

      </div>
    `;
  }

  function starterHTML(name) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(name)}</title>
</head>
<body>

  <main class="container">
    <h1>${escapeHtml(name)}</h1>

    <p>
      Your BuildPilot AI project is ready.
    </p>

    <button id="helloButton">
      Get Started
    </button>
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
  background: #f8fafc;
  color: #111827;
}

.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 80px 20px;
  text-align: center;
}

button {
  padding: 12px 18px;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  background: #111827;
  color: white;
}`;
  }

  function starterJS() {
    return `document.addEventListener("DOMContentLoaded", function () {
  const button =
    document.getElementById("helloButton");

  if (button) {
    button.addEventListener("click", function () {
      alert("BuildPilot AI project is working!");
    });
  }
});`;
  }

  async function ensureStarterFiles(
    projectId,
    projectName
  ) {
    if (!projectId) {
      throw new Error(
        "Project ID missing"
      );
    }

    const { data: existing, error } =
      await sb
        .from("project_files")
        .select(
          "id,file_path,file_content,language"
        )
        .eq("project_id", projectId);

    if (error) {
      throw new Error(
        "Could not load project files: " +
          error.message
      );
    }

    const files = existing || [];

    const existingPaths = new Set(
      files.map((file) =>
        String(
          file.file_path
        ).toLowerCase()
      )
    );

    const starterFiles = [];

    if (!existingPaths.has("index.html")) {
      starterFiles.push({
        project_id: projectId,
        file_path: "index.html",
        file_content:
          starterHTML(projectName),
        language: "html",
        generated_by: "system",
      });
    }

    if (!existingPaths.has("style.css")) {
      starterFiles.push({
        project_id: projectId,
        file_path: "style.css",
        file_content: starterCSS(),
        language: "css",
        generated_by: "system",
      });
    }

    if (!existingPaths.has("script.js")) {
      starterFiles.push({
        project_id: projectId,
        file_path: "script.js",
        file_content: starterJS(),
        language: "javascript",
        generated_by: "system",
      });
    }

    if (!starterFiles.length) {
      return;
    }

    const { error: insertError } =
      await sb
        .from("project_files")
        .insert(starterFiles);

    if (insertError) {
      throw new Error(
        "Could not create starter files: " +
          insertError.message
      );
    }
  }

  async function createProject(
    projectType
  ) {
    if (!(await requireSession())) {
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
      showMessage(
        "Project name required",
        "error"
      );

      return;
    }

    if (!prompt) {
      showMessage(
        "Project description required",
        "error"
      );

      return;
    }

    setLoading(
      button,
      true,
      "Creating project..."
    );

    try {
      const { data: typeData } =
        await sb
          .from("project_types")
          .select("id,name,code")
          .eq("code", projectType)
          .maybeSingle();

      const projectPayload = {
        user_id: activeUser.id,
        name,
        description: prompt,
        frontend,
        backend,
        status: "draft",
        project_type_id:
          typeData?.id || null,
      };

      const {
        data: project,
        error,
      } = await sb
        .from("projects")
        .insert(projectPayload)
        .select(
          "id,name,description,frontend,backend,project_plan,public_id,public_enabled,published_at"
        )
        .single();

      if (error) {
        throw error;
      }

      await ensureStarterFiles(
        project.id,
        name
      );

      activeProject = project;

      showMessage(
        "Project created",
        "success"
      );

      await loadProjectFiles();

      /*
       * AI generation is attempted only after
       * starter files are safely created.
       */
      await callGenerateFunction(
        project.id,
        prompt,
        name,
        frontend,
        backend
      );

      await loadProjectFiles();

      openWorkspace(project.id);
    } catch (error) {
      console.error(error);

      showMessage(
        error.message ||
          "Project creation failed",
        "error"
      );
    } finally {
      setLoading(button, false);
    }
  }

  /*
   * ============================================================
   * AI GENERATION
   * ============================================================
   */

  async function callGenerateFunction(
    projectId,
    prompt,
    name,
    frontend,
    backend
  ) {
    if (!activeSession) {
      await getSession();
    }

    if (!activeSession) {
      throw new Error(
        "Please login again."
      );
    }

    const {
      data,
      error,
    } = await sb.functions.invoke(
      GENERATE_FUNCTION,
      {
        headers: {
          Authorization:
            "Bearer " +
            activeSession.access_token,
        },

        body: {
          projectId,
          instruction: prompt,

          /*
           * Compatibility fields for
           * older BuildPilot functions.
           */
          prompt,
          projectName: name,
          frontend,
          backend,
        },
      }
    );

    if (error) {
      console.error(
        "Generate function error:",
        error
      );

      throw new Error(
        error.message ||
          "AI generation failed"
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

    return data;
  }

  /*
   * ============================================================
   * PROJECT LIST
   * ============================================================
   */

  async function loadProjects() {
    if (!activeUser) {
      await getSession();
    }

    const container =
      document.getElementById(
        "projectsList"
      );

    if (!container) return;

    container.innerHTML =
      "Loading projects...";

    const {
      data,
      error,
    } = await sb
      .from("projects")
      .select(
        "id,name,description,status,frontend,backend,public_id,public_enabled,published_at,created_at"
      )
      .eq("user_id", activeUser.id)
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

    if (error) {
      container.innerHTML = `
        <div style="
          color:#dc2626;
        ">
          ${escapeHtml(
            error.message
          )}
        </div>
      `;

      return;
    }

    if (!data?.length) {
      container.innerHTML = `
        <div style="
          background:white;
          border:1px dashed #cbd5e1;
          padding:30px;
          border-radius:15px;
          text-align:center;
          color:#64748b;
        ">
          No projects yet.
        </div>
      `;

      return;
    }

    container.innerHTML =
      data
        .map(
          (project) => `
          <div style="
            background:white;
            border:1px solid #e2e8f0;
            border-radius:15px;
            padding:20px;
            margin-bottom:12px;
          ">

            <div style="
              display:flex;
              justify-content:space-between;
              gap:20px;
              flex-wrap:wrap;
            ">

              <div>

                <h3 style="
                  margin:0 0 7px;
                ">
                  ${escapeHtml(
                    project.name
                  )}
                </h3>

                <p style="
                  margin:0;
                  color:#64748b;
                ">
                  ${escapeHtml(
                    project.description ||
                      ""
                  )}
                </p>

                <div style="
                  margin-top:10px;
                  font-size:13px;
                  color:#64748b;
                ">
                  Status:
                  ${escapeHtml(
                    project.status ||
                      "draft"
                  )}
                </div>

              </div>

              <div style="
                display:flex;
                gap:8px;
                flex-wrap:wrap;
                align-items:center;
              ">

                <button
                  onclick="window.BuildPilot.openProject('${project.id}')"
                  style="
                    padding:9px 13px;
                    border:0;
                    border-radius:8px;
                    background:#111827;
                    color:white;
                    cursor:pointer;
                  "
                >
                  Open
                </button>

                ${
                  project.public_enabled
                    ? `
                    <button
                      onclick="window.BuildPilot.copyPublicLink('${project.public_id}')"
                      style="
                        padding:9px 13px;
                        border:1px solid #cbd5e1;
                        background:white;
                        border-radius:8px;
                        cursor:pointer;
                      "
                    >
                      Copy Public Link
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

  /*
   * ============================================================
   * OPEN PROJECT
   * ============================================================
   */

  async function openProject(projectId) {
    if (!(await requireSession())) {
      return;
    }

    try {
      const {
        data: project,
        error,
      } = await sb
        .from("projects")
        .select(
          "id,name,description,frontend,backend,project_plan,public_id,public_enabled,published_at,status"
        )
        .eq("id", projectId)
        .eq(
          "user_id",
          activeUser.id
        )
        .single();

      if (error) {
        throw error;
      }

      activeProject = project;

      await ensureStarterFiles(
        project.id,
        project.name
      );

      await loadProjectFiles();

      openWorkspace(project.id);
    } catch (error) {
      showMessage(
        error.message ||
          "Project could not be opened",
        "error"
      );
    }
  }

  async function loadProjectFiles() {
    if (!activeProject) {
      return [];
    }

    const {
      data,
      error,
    } = await sb
      .from("project_files")
      .select(
        "id,file_path,file_content,language,generated_by"
      )
      .eq(
        "project_id",
        activeProject.id
      )
      .order("file_path");

    if (error) {
      throw error;
    }

    activeFiles = data || [];

    return activeFiles;
  }

  /*
   * ============================================================
   * WORKSPACE
   * ============================================================
   */

  function openWorkspace(projectId) {
    currentView = "workspace";

    appRoot().innerHTML = `
      <div style="
        min-height:100vh;
        background:#f1f5f9;
        font-family:Arial,sans-serif;
      ">

        <header style="
          height:64px;
          background:#111827;
          color:white;
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding:0 18px;
          box-sizing:border-box;
        ">

          <div style="
            display:flex;
            gap:12px;
            align-items:center;
          ">

            <button
              onclick="window.BuildPilot.home()"
              style="
                border:1px solid #475569;
                background:transparent;
                color:white;
                padding:8px 12px;
                border-radius:8px;
                cursor:pointer;
              "
            >
              ← Projects
            </button>

            <strong>
              ${escapeHtml(
                activeProject?.name ||
                  "Project"
              )}
            </strong>

          </div>

          <div style="
            display:flex;
            gap:8px;
            flex-wrap:wrap;
          ">

            <button
              onclick="window.BuildPilot.refreshFiles()"
              style="
                border:1px solid #475569;
                background:transparent;
                color:white;
                padding:8px 12px;
                border-radius:8px;
                cursor:pointer;
              "
            >
              Refresh Files
            </button>

            <button
              id="publishButton"
              onclick="window.BuildPilot.togglePublish()"
              style="
                border:0;
                background:#22c55e;
                color:white;
                padding:8px 12px;
                border-radius:8px;
                cursor:pointer;
              "
            >
              ${
                activeProject?.public_enabled
                  ? "Public Link"
                  : "Publish"
              }
            </button>

          </div>

        </header>

        <main style="
          display:grid;
          grid-template-columns:
            250px minmax(0,1fr);
          min-height:calc(100vh - 64px);
        ">

          <aside style="
            background:white;
            border-right:1px solid #e2e8f0;
            padding:15px;
            overflow:auto;
          ">

            <h3>
              Project Files
            </h3>

            <div id="filesList">
              Loading...
            </div>

          </aside>

          <section style="
            padding:15px;
            min-width:0;
          ">

            <div style="
              display:grid;
              grid-template-columns:
                minmax(0,1fr)
                minmax(0,1fr);
              gap:15px;
            ">

              <div style="
                background:white;
                border-radius:14px;
                border:1px solid #e2e8f0;
                overflow:hidden;
              ">

                <div style="
                  padding:12px 15px;
                  border-bottom:1px solid #e2e8f0;
                  font-weight:bold;
                ">
                  Live Preview
                </div>

                <div
                  id="previewContent"
                  style="
                    min-height:600px;
                    background:white;
                  "
                >
                  Loading preview...
                </div>

              </div>

              <div style="
                background:white;
                border-radius:14px;
                border:1px solid #e2e8f0;
                overflow:hidden;
                display:flex;
                flex-direction:column;
              ">

                <div style="
                  padding:12px 15px;
                  border-bottom:1px solid #e2e8f0;
                  font-weight:bold;
                ">
                  AI Builder
                </div>

                <div
                  id="chatMessages"
                  style="
                    flex:1;
                    min-height:420px;
                    max-height:520px;
                    overflow:auto;
                    padding:15px;
                  "
                >
                  <div style="
                    background:#f8fafc;
                    padding:12px;
                    border-radius:10px;
                    color:#475569;
                  ">
                    Tell me what you want to change.
                    <br><br>
                    Example:
                    <br>
                    "Header का color blue कर दो"
                    <br>
                    "Contact section add करो"
                    <br>
                    "WhatsApp button लगा दो"
                  </div>
                </div>

                <form
                  id="aiChatForm"
                  style="
                    padding:12px;
                    border-top:1px solid #e2e8f0;
                  "
                >

                  <textarea
                    id="aiInstruction"
                    rows="4"
                    placeholder="Describe the change..."
                    style="
                      width:100%;
                      box-sizing:border-box;
                      padding:12px;
                      border:1px solid #cbd5e1;
                      border-radius:10px;
                      resize:vertical;
                    "
                  ></textarea>

                  <button
                    type="submit"
                    id="aiSendButton"
                    style="
                      width:100%;
                      margin-top:8px;
                      padding:12px;
                      border:0;
                      border-radius:10px;
                      background:#111827;
                      color:white;
                      cursor:pointer;
                    "
                  >
                    Build / Modify Project
                  </button>

                </form>

              </div>

            </div>

          </section>

        </main>

      </div>
    `;

    document
      .getElementById(
        "aiChatForm"
      )
      .addEventListener(
        "submit",
        submitAIInstruction
      );

    renderFilesList();

    updatePreview();
  }

  /*
   * ============================================================
   * FILE LIST
   * ============================================================
   */

  function renderFilesList() {
    const list =
      document.getElementById(
        "filesList"
      );

    if (!list) return;

    if (!activeFiles.length) {
      list.innerHTML = `
        <p style="color:#64748b;">
          No files found.
        </p>
      `;

      return;
    }

    list.innerHTML =
      activeFiles
        .map(
          (file) => `
          <button
            onclick="window.BuildPilot.editFile('${file.id}')"
            style="
              display:block;
              width:100%;
              text-align:left;
              padding:10px;
              margin-bottom:5px;
              border:1px solid #e2e8f0;
              background:#f8fafc;
              border-radius:8px;
              cursor:pointer;
            "
          >
            ${escapeHtml(
              file.file_path
            )}
          </button>
        `
        )
        .join("");
  }

  /*
   * ============================================================
   * PREVIEW
   * ============================================================
   */

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
            .endsWith(".html")
      );

    if (!htmlFile) {
      return null;
    }

    let html =
      htmlFile.file_content || "";

    const css = activeFiles
      .filter((file) =>
        file.file_path
          .toLowerCase()
          .endsWith(".css")
      )
      .map(
        (file) =>
          file.file_content || ""
      )
      .join("\n\n");

    const js = activeFiles
      .filter((file) =>
        file.file_path
          .toLowerCase()
          .endsWith(".js")
      )
      .map(
        (file) =>
          file.file_content || ""
      )
      .join("\n\n");

    if (css.trim()) {
      const styleTag = `
<style data-buildpilot-preview="css">
${css}
</style>
`;

      if (
        /<\/head>/i.test(html)
      ) {
        html = html.replace(
          /<\/head>/i,
          styleTag + "</head>"
        );
      } else {
        html =
          styleTag + html;
      }
    }

    if (js.trim()) {
      const scriptTag = `
<script data-buildpilot-preview="js">
${js}
</script>
`;

      if (
        /<\/body>/i.test(html)
      ) {
        html = html.replace(
          /<\/body>/i,
          scriptTag + "</body>"
        );
      } else {
        html += scriptTag;
      }
    }

    return html;
  }

  function updatePreview() {
    const container =
      document.getElementById(
        "previewContent"
      );

    if (!container) return;

    const html =
      buildPreviewHTML();

    if (!html) {
      container.innerHTML = `
        <div style="
          padding:30px;
          text-align:center;
          color:#64748b;
        ">

          <h3>
            Project Preview
          </h3>

          <p>
            index.html अभी available नहीं है।
          </p>

          <button
            onclick="window.BuildPilot.refreshFiles()"
            style="
              padding:10px 15px;
              border:0;
              border-radius:8px;
              background:#111827;
              color:white;
              cursor:pointer;
            "
          >
            Refresh Files
          </button>

        </div>
      `;

      return;
    }

    const iframe =
      document.createElement(
        "iframe"
      );

    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-forms allow-modals allow-popups"
    );

    iframe.style.width = "100%";
    iframe.style.height = "650px";
    iframe.style.border = "0";
    iframe.srcdoc = html;

    container.innerHTML = "";

    container.appendChild(
      iframe
    );
  }

  async function refreshFiles() {
    try {
      if (!activeProject) {
        showMessage(
          "No active project",
          "error"
        );

        return;
      }

      showMessage(
        "Refreshing project files..."
      );

      await ensureStarterFiles(
        activeProject.id,
        activeProject.name
      );

      await loadProjectFiles();

      renderFilesList();

      updatePreview();

      showMessage(
        "Files refreshed",
        "success"
      );
    } catch (error) {
      console.error(error);

      showMessage(
        error.message ||
          "Refresh failed",
        "error"
      );
    }
  }

  /*
   * ============================================================
   * AI EDIT
   * ============================================================
   */

  async function submitAIInstruction(
    event
  ) {
    event.preventDefault();

    if (!activeProject) {
      showMessage(
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

    setLoading(
      button,
      true,
      "AI is building..."
    );

    try {
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

      showMessage(
        "Project updated successfully",
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

      showMessage(
        error.message ||
          "AI update failed",
        "error"
      );
    } finally {
      setLoading(button, false);
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

    if (!box) return;

    const item =
      document.createElement(
        "div"
      );

    item.style.marginBottom =
      "12px";

    item.style.padding =
      "11px";

    item.style.borderRadius =
      "10px";

    item.style.background =
      type === "user"
        ? "#e0f2fe"
        : type === "error"
        ? "#fee2e2"
        : "#f1f5f9";

    item.innerHTML = `
      <strong>
        ${escapeHtml(sender)}
      </strong>

      <div style="
        margin-top:5px;
        white-space:pre-wrap;
      ">
        ${escapeHtml(message)}
      </div>
    `;

    box.appendChild(item);

    box.scrollTop =
      box.scrollHeight;
  }

  /*
   * ============================================================
   * EDIT FILE
   * ============================================================
   */

  function editFile(fileId) {
    const file =
      activeFiles.find(
        (item) =>
          item.id === fileId
      );

    if (!file) return;

    const root = appRoot();

    root.innerHTML = `
      <div style="
        min-height:100vh;
        background:#f1f5f9;
        padding:20px;
        box-sizing:border-box;
        font-family:Arial,sans-serif;
      ">

        <div style="
          max-width:1200px;
          margin:auto;
        ">

          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            margin-bottom:15px;
          ">

            <h2>
              ${escapeHtml(
                file.file_path
              )}
            </h2>

            <button
              onclick="window.BuildPilot.backWorkspace()"
              style="
                padding:10px 14px;
                border:0;
                border-radius:8px;
                cursor:pointer;
              "
            >
              ← Back
            </button>

          </div>

          <textarea
            id="fileEditor"
            style="
              width:100%;
              min-height:650px;
              box-sizing:border-box;
              padding:15px;
              font-family:monospace;
              font-size:14px;
              border:1px solid #cbd5e1;
              border-radius:12px;
              resize:vertical;
            "
          >${escapeHtml(
            file.file_content
          )}</textarea>

          <button
            id="saveFileButton"
            onclick="window.BuildPilot.saveFile('${file.id}')"
            style="
              margin-top:12px;
              padding:12px 18px;
              border:0;
              border-radius:9px;
              background:#111827;
              color:white;
              cursor:pointer;
            "
          >
            Save File
          </button>

        </div>

      </div>
    `;
  }

  async function saveFile(fileId) {
    const file =
      activeFiles.find(
        (item) =>
          item.id === fileId
      );

    if (!file) return;

    const button =
      document.getElementById(
        "saveFileButton"
      );

    const editor =
      document.getElementById(
        "fileEditor"
      );

    if (!editor) return;

    setLoading(
      button,
      true,
      "Saving..."
    );

    try {
      const {
        error,
      } = await sb
        .from("project_files")
        .update({
          file_content:
            editor.value,
          generated_by:
            "user",
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

      showMessage(
        "File saved",
        "success"
      );

      openWorkspace(
        activeProject.id
      );
    } catch (error) {
      showMessage(
        error.message ||
          "Save failed",
        "error"
      );
    } finally {
      setLoading(
        button,
        false
      );
    }
  }

  /*
   * ============================================================
   * PUBLIC PUBLISH
   * ============================================================
   */

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
       * Make sure project has a public_id.
       */
      let publicId =
        activeProject.public_id;

      if (!publicId) {
        publicId =
          crypto.randomUUID();
      }

      const updatePayload = {
        public_id: publicId,
        public_enabled:
          newState,
        published_at:
          newState
            ? new Date().toISOString()
            : null,
      };

      const {
        data,
        error,
      } = await sb
        .from("projects")
        .update(
          updatePayload
        )
        .eq(
          "id",
          activeProject.id
        )
        .eq(
          "user_id",
          activeUser.id
        )
        .select(
          "id,name,description,frontend,backend,project_plan,public_id,public_enabled,published_at,status"
        )
        .single();

      if (error) {
        throw error;
      }

      activeProject = data;

      if (newState) {
        const link =
          createPublicLink(
            data.public_id
          );

        await copyText(link);

        showPublicLinkDialog(
          link
        );
      } else {
        showMessage(
          "Public link disabled",
          "success"
        );

        openWorkspace(
          activeProject.id
        );
      }
    } catch (error) {
      console.error(error);

      showMessage(
        error.message ||
          "Publish failed",
        "error"
      );
    }
  }

  function createPublicLink(
    publicId
  ) {
    return (
      PUBLIC_BASE_URL +
      "?public=" +
      encodeURIComponent(
        publicId
      )
    );
  }

  async function copyPublicLink(
    publicId
  ) {
    const link =
      createPublicLink(
        publicId
      );

    await copyText(link);

    showPublicLinkDialog(
      link
    );
  }

  async function copyText(
    text
  ) {
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

      textarea.style.left =
        "-9999px";

      document.body.appendChild(
        textarea
      );

      textarea.select();

      document.execCommand(
        "copy"
      );

      textarea.remove();

      return true;
    } catch {
      return false;
    }
  }

  function showPublicLinkDialog(
    link
  ) {
    const old =
      document.getElementById(
        "publicLinkModal"
      );

    if (old) {
      old.remove();
    }

    const modal =
      document.createElement(
        "div"
      );

    modal.id =
      "publicLinkModal";

    modal.style.position =
      "fixed";

    modal.style.inset = "0";

    modal.style.background =
      "rgba(15,23,42,.65)";

    modal.style.zIndex =
      "99998";

    modal.style.display =
      "flex";

    modal.style.alignItems =
      "center";

    modal.style.justifyContent =
      "center";

    modal.innerHTML = `
      <div style="
        width:min(600px,90%);
        background:white;
        border-radius:18px;
        padding:25px;
        box-shadow:0 20px 70px rgba(0,0,0,.3);
        font-family:Arial,sans-serif;
      ">

        <h2>
          🎉 Public Project Link
        </h2>

        <p style="
          color:#64748b;
        ">
          अब कोई भी इस link को खोल सकता है।
        </p>

        <input
          id="publicLinkInput"
          readonly
          value="${escapeHtml(link)}"
          style="
            width:100%;
            box-sizing:border-box;
            padding:13px;
            border:1px solid #cbd5e1;
            border-radius:10px;
          "
        />

        <div style="
          display:flex;
          gap:8px;
          margin-top:15px;
          flex-wrap:wrap;
        ">

          <button
            onclick="window.BuildPilot.copyCurrentPublicLink()"
            style="
              padding:11px 15px;
              border:0;
              border-radius:8px;
              background:#111827;
              color:white;
              cursor:pointer;
            "
          >
            Copy Link
          </button>

          <button
            onclick="window.open('${escapeHtml(
              link
            )}', '_blank')"
            style="
              padding:11px 15px;
              border:1px solid #cbd5e1;
              background:white;
              border-radius:8px;
              cursor:pointer;
            "
          >
            Open Public Page
          </button>

          <button
            onclick="document.getElementById('publicLinkModal').remove()"
            style="
              padding:11px 15px;
              border:1px solid #cbd5e1;
              background:white;
              border-radius:8px;
              cursor:pointer;
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

    window._buildpilotPublicLink =
      link;
  }

  async function copyCurrentPublicLink() {
    const link =
      window._buildpilotPublicLink;

    if (!link) return;

    await copyText(link);

    showMessage(
      "Public link copied",
      "success"
    );
  }

  /*
   * ============================================================
   * NAVIGATION
   * ============================================================
   */

  function backWorkspace() {
    if (!activeProject) {
      renderHome();

      return;
    }

    openWorkspace(
      activeProject.id
    );
  }

  /*
   * ============================================================
   * AUTH STATE
   * ============================================================
   */

  sb.auth.onAuthStateChange(
    async (_event, session) => {
      activeSession =
        session || null;

      activeUser =
        session?.user || null;
    }
  );

  /*
   * ============================================================
   * PUBLIC API
   * ============================================================
   */

  window.BuildPilot = {
    login: loginUser,
    signup: signupUser,
    logout: logoutUser,

    showLoginForm,
    showSignupForm,

    home: renderHome,

    startProject,

    createProject,

    loadProjects,

    openProject,

    refreshFiles,

    editFile,

    saveFile,

    backWorkspace,

    togglePublish,

    copyPublicLink,

    copyCurrentPublicLink,
  };

  /*
   * ============================================================
   * START APPLICATION
   * ============================================================
   */

  (async function boot() {
    const publicId =
      getPublicIdFromUrl();

    /*
     * PUBLIC PROJECT
     *
     * Important:
     * This is checked before authentication.
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

      renderHome();
    } else {
      renderLogin();
    }
  })();
})();
