(() => {
  const C = window.BUILDPILOT_CONFIG || {};

  if (!window.supabase) {
    document.body.innerHTML =
      "<h2 style='font-family:Arial;padding:30px'>Supabase library not loaded.</h2>";
    return;
  }

  const client = window.supabase.createClient(
    C.SUPABASE_URL,
    C.SUPABASE_PUBLISHABLE_KEY
  );

  const app = document.getElementById("app");

  const state = {
    session: null,
    profile: null,
    loading: false
  };

  // Your deployed Supabase Edge Function
  const FUNCTION_NAME = "super-function";

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };

      return map[char];
    });
  }

  async function ensureProfile(user) {
    if (!user) return null;

    const result = await client
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (result.error) {
      console.error("Profile error:", result.error);
      return null;
    }

    if (result.data) {
      return result.data;
    }

    const created = await client
      .from("profiles")
      .insert({
        id: user.id,
        full_name: user.email
          ? user.email.split("@")[0]
          : "User"
      })
      .select("*")
      .single();

    if (created.error) {
      console.error(
        "Profile create error:",
        created.error
      );

      return null;
    }

    return created.data;
  }

  async function refreshAuth() {
    try {
      const result =
        await client.auth.getSession();

      if (result.error) {
        throw result.error;
      }

      state.session =
        result.data.session || null;

      if (state.session?.user) {
        state.profile =
          await ensureProfile(
            state.session.user
          );
      } else {
        state.profile = null;
      }

      return state.session;

    } catch (error) {
      console.error(
        "Auth error:",
        error
      );

      state.session = null;
      state.profile = null;

      return null;
    }
  }

  function nav() {
    let actions = "";

    if (state.session) {
      actions = `
        <span class="pill">
          ${esc(state.session.user.email)}
        </span>

        <button
          class="btn"
          id="logout"
        >
          Logout
        </button>
      `;
    } else {
      actions = `
        <button
          class="btn"
          id="loginBtn"
        >
          Login
        </button>

        <button
          class="btn primary"
          id="signupBtn"
        >
          Sign up
        </button>
      `;
    }

    return `
      <div class="nav">

        <div class="brand">
          BuildPilot <span>AI</span>
        </div>

        <div class="nav-actions">
          ${actions}
        </div>

      </div>
    `;
  }

  function bindNav() {
    const logout =
      document.getElementById("logout");

    if (logout) {
      logout.onclick = async function () {
        await client.auth.signOut();

        state.session = null;
        state.profile = null;

        location.hash = "";
      };
    }

    const login =
      document.getElementById("loginBtn");

    if (login) {
      login.onclick = function () {
        location.hash = "#login";
      };
    }

    const signup =
      document.getElementById("signupBtn");

    if (signup) {
      signup.onclick = function () {
        location.hash = "#signup";
      };
    }
  }

  function renderHome() {
    app.innerHTML = `
      <div class="shell">

        ${nav()}

        <main class="container">

          <section class="hero">

            <h1>
              Describe it.
              <span>Build it.</span>
            </h1>

            <p>
              BuildPilot AI
              turns your idea into software.
            </p>

          </section>

          <section class="chat card">

            <div class="row">

              <span class="pill">
                Frontend: HTML / React / Next.js
              </span>

              <span class="pill">
                Backend: Supabase / Firebase / GitHub
              </span>

            </div>

            <div
              id="messages"
              class="messages"
            >

              <div class="msg ai">

                Hi! Tell me what you want to build.

                <br><br>

                Examples:

                <br>
                Header ka color blue karo

                <br>
                Home page me section add karo

                <br>
                Login page banao

                <br>
                Contact number change karo

              </div>

            </div>

            <div class="grid">

              <div>

                <label class="label">
                  Project name
                </label>

                <input
                  id="projectName"
                  class="input"
                  placeholder="Coaching Management App"
                >

              </div>

              <div>

                <label class="label">
                  Frontend
                </label>

                <select
                  id="frontend"
                  class="select"
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

              </div>

            </div>

            <br>

            <div class="grid">

              <div>

                <label class="label">
                  Backend
                </label>

                <select
                  id="backend"
                  class="select"
                >

                  <option value="supabase">
                    Supabase
                  </option>

                  <option value="firebase">
                    Firebase
                  </option>

                  <option value="github">
                    GitHub Only
                  </option>

                </select>

              </div>

              <div>

                <label class="label">
                  Request
                </label>

                <input
                  id="prompt"
                  class="input"
                  placeholder="Build a coaching website..."
                >

              </div>

            </div>

            <br>

            <button
              id="generate"
              class="btn primary"
            >
              Build with AI
            </button>

            <div
              id="homeNotice"
              class="notice hidden"
              style="margin-top:14px"
            ></div>

          </section>

          <section
            class="grid"
            style="margin-top:18px"
          >

            <div class="card">

              <h3>
                Free limits
              </h3>

              <p class="muted">
                5 projects and 2 generated-file actions.
              </p>

            </div>

            <div class="card">

              <h3>
                Admin
              </h3>

              <p class="muted">
                Open Admin Login.
              </p>

              <button
                class="btn"
                id="adminOpen"
              >
                Admin Login
              </button>

            </div>

          </section>

        </main>

      </div>
    `;

    bindNav();

    const admin =
      document.getElementById(
        "adminOpen"
      );

    if (admin) {
      admin.onclick = function () {
        location.hash = "#admin-login";
      };
    }

    const generateButton =
      document.getElementById(
        "generate"
      );

    if (generateButton) {
      generateButton.onclick =
        generate;
    }

    const prompt =
      document.getElementById(
        "prompt"
      );

    if (prompt) {
      prompt.addEventListener(
        "keydown",
        function (event) {

          if (event.key !== "Enter") {
            return;
          }

          event.preventDefault();

          generate();

        }
      );
    }
  }

  async function generate() {

    if (state.loading) {
      return;
    }

    const promptElement =
      document.getElementById(
        "prompt"
      );

    const nameElement =
      document.getElementById(
        "projectName"
      );

    const frontendElement =
      document.getElementById(
        "frontend"
      );

    const backendElement =
      document.getElementById(
        "backend"
      );

    const messages =
      document.getElementById(
        "messages"
      );

    const notice =
      document.getElementById(
        "homeNotice"
      );

    if (!promptElement) {
      return;
    }

    const instruction =
      promptElement.value.trim();

    const projectName =
      nameElement
        ? nameElement.value.trim()
        : "BuildPilot Project";

    const frontend =
      frontendElement
        ? frontendElement.value
        : "html";

    const backend =
      backendElement
        ? backendElement.value
        : "supabase";

    if (!instruction) {

      notice.className =
        "notice error";

      notice.textContent =
        "Please enter your request.";

      return;
    }

    if (
      instruction.toLowerCase() ===
      "admin login"
    ) {

      location.hash =
        "#admin-login";

      return;
    }

    const session =
      await refreshAuth();

    if (!session?.access_token) {

      notice.className =
        "notice error";

      notice.textContent =
        "Please login first.";

      location.hash =
        "#login";

      return;
    }

    state.loading = true;

    const button =
      document.getElementById(
        "generate"
      );

    if (button) {
      button.disabled = true;
      button.textContent =
        "AI is working...";
    }

    messages.insertAdjacentHTML(
      "beforeend",
      `
        <div class="msg user">
          ${esc(instruction)}
        </div>

        <div
          class="msg ai"
          id="workingMessage"
        >
          BuildPilot AI is working...
        </div>
      `
    );

    messages.scrollTop =
      messages.scrollHeight;

    try {

      const result =
        await client.functions.invoke(
          FUNCTION_NAME,
          {
            headers: {
              Authorization:
                "Bearer " +
                session.access_token
            },

            body: {

              projectId: null,

              instruction:
                instruction,

              prompt:
                instruction,

              projectName:
                projectName,

              frontend:
                frontend,

              backend:
                backend
            }
          }
        );

      const working =
        document.getElementById(
          "workingMessage"
        );

      if (working) {
        working.remove();
      }

      if (result.error) {

        console.error(
          "Function error:",
          result.error
        );

        const message =
          result.error.message ||
          "Edge Function request failed.";

        notice.className =
          "notice error";

        notice.textContent =
          message;

        messages.insertAdjacentHTML(
          "beforeend",
          `
            <div class="msg ai">
              ❌ ${esc(message)}
            </div>
          `
        );

        return;
      }

      const data =
        result.data || {};

      if (data.success) {

        notice.className =
          "notice success-note";

        notice.textContent =
          data.message ||
          "AI request completed.";

        let filesText =
          "No changed files.";

        if (
          Array.isArray(
            data.changes
          ) &&
          data.changes.length
        ) {

          filesText =
            data.changes
              .map(function (file) {
                return (
                  "<li>" +
                  esc(file.path) +
                  "</li>"
                );
              })
              .join("");
        }

        messages.insertAdjacentHTML(
          "beforeend",
          `
            <div class="msg ai">

              <b>
                ${esc(
                  data.message ||
                  "Project updated successfully."
                )}
              </b>

              <br><br>

              Changed files:

              <ul>
                ${filesText}
              </ul>

            </div>
          `
        );

      } else {

        const message =
          data.error ||
          data.message ||
          "AI request failed.";

        notice.className =
          "notice error";

        notice.textContent =
          message;

        messages.insertAdjacentHTML(
          "beforeend",
          `
            <div class="msg ai">
              ❌ ${esc(message)}
            </div>
          `
        );
      }

      messages.scrollTop =
        messages.scrollHeight;

    } catch (error) {

      console.error(
        "BuildPilot error:",
        error
      );

      const working =
        document.getElementById(
          "workingMessage"
        );

      if (working) {
        working.remove();
      }

      notice.className =
        "notice error";

      notice.textContent =
        error.message ||
        "Something went wrong.";

    } finally {

      state.loading = false;

      if (button) {
        button.disabled = false;
        button.textContent =
          "Build with AI";
      }

    }
  }

  function authPage(mode) {

    const signup =
      mode === "signup";

    app.innerHTML = `
      <div class="shell">

        ${nav()}

        <main class="container">

          <div class="center card">

            <h2>
              ${
                signup
                  ? "Create account"
                  : "Login"
              }
            </h2>

            <div class="stack">

              <input
                id="email"
                class="input"
                type="email"
                placeholder="Email"
              >

              <input
                id="password"
                class="input"
                type="password"
                placeholder="Password"
              >

              <button
                id="auth"
                class="btn primary"
              >
                ${
                  signup
                    ? "Create account"
                    : "Login"
                }
              </button>

              <div
                id="authMsg"
                class="notice hidden"
              ></div>

              <button
                id="back"
                class="btn"
              >
                Back
              </button>

            </div>

          </div>

        </main>

      </div>
    `;

    bindNav();

    document.getElementById(
      "back"
    ).onclick = function () {
      location.hash = "";
    };

    document.getElementById(
      "auth"
    ).onclick = async function () {

      const email =
        document.getElementById(
          "email"
        ).value.trim();

      const password =
        document.getElementById(
          "password"
        ).value;

      const message =
        document.getElementById(
          "authMsg"
        );

      if (
        !email ||
        password.length < 6
      ) {

        message.className =
          "notice error";

        message.textContent =
          "Enter valid email and password.";

        return;
      }

      const result =
        signup
          ? await client.auth.signUp({
              email,
              password
            })
          : await client.auth.signInWithPassword({
              email,
              password
            });

      if (result.error) {

        message.className =
          "notice error";

        message.textContent =
          result.error.message;

        return;
      }

      if (signup) {

        message.className =
          "notice success-note";

        message.textContent =
          result.data.session
            ? "Account created successfully."
            : "Account created. Please confirm your email.";

        if (result.data.user) {
          await ensureProfile(
            result.data.user
          );
        }

      } else {

        state.session =
          result.data.session;

        if (state.session?.user) {
          state.profile =
            await ensureProfile(
              state.session.user
            );
        }

        location.hash = "";
      }
    };
  }

  function adminLogin() {

    app.innerHTML = `
      <div class="shell">

        ${nav()}

        <main class="container">

          <div class="center card">

            <h2>
              Admin Login
            </h2>

            <div class="stack">

              <input
                id="adminEmail"
                class="input"
                type="email"
                placeholder="Admin Email"
              >

              <input
                id="adminPassword"
                class="input"
                type="password"
                placeholder="Password"
              >

              <button
                id="adminLoginButton"
                class="btn primary"
              >
                Admin Login
              </button>

              <div
                id="adminMessage"
                class="notice hidden"
              ></div>

              <button
                id="adminBack"
                class="btn"
              >
                Back
              </button>

            </div>

          </div>

        </main>

      </div>
    `;

    bindNav();

    document.getElementById(
      "adminBack"
    ).onclick = function () {
      location.hash = "";
    };

    document.getElementById(
      "adminLoginButton"
    ).onclick = async function () {

      const email =
        document.getElementById(
          "adminEmail"
        ).value.trim();

      const password =
        document.getElementById(
          "adminPassword"
        ).value;

      const message =
        document.getElementById(
          "adminMessage"
        );

      const result =
        await client.auth.signInWithPassword({
          email,
          password
        });

      if (result.error) {

        message.className =
          "notice error";

        message.textContent =
          result.error.message;

        return;
      }

      await refreshAuth();

      if (
        state.profile?.role !==
        "admin"
      ) {

        await client.auth.signOut();

        state.session = null;
        state.profile = null;

        message.className =
          "notice error";

        message.textContent =
          "This account is not an Admin.";

        return;
      }

      location.hash =
        "#admin";
    };
  }

  function adminPage() {

    app.innerHTML = `
      <div class="shell">

        ${nav()}

        <main class="container">

          <div class="card">

            <h2>
              Admin Dashboard
            </h2>

            <p class="muted">
              BuildPilot AI Admin
            </p>

            <button
              class="btn"
              id="adminHome"
            >
              User App
            </button>

          </div>

        </main>

      </div>
    `;

    bindNav();

    document.getElementById(
      "adminHome"
    ).onclick = function () {
      location.hash = "";
    };
  }

  function router() {

    const hash =
      location.hash;

    if (hash === "#login") {

      authPage("login");

    } else if (
      hash === "#signup"
    ) {

      authPage("signup");

    } else if (
      hash === "#admin-login"
    ) {

      adminLogin();

    } else if (
      hash === "#admin"
    ) {

      adminPage();

    } else {

      renderHome();

    }
  }

  window.addEventListener(
    "hashchange",
    router
  );

  client.auth.onAuthStateChange(
    function (_event, session) {

      state.session =
        session || null;

      if (!session) {
        state.profile = null;
      }

      router();
    }
  );

  refreshAuth().then(function () {
    router();
  });

})();
