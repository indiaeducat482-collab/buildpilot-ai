(() => {
  "use strict";

  const CONFIG = window.BUILDPILOT_CONFIG || {};
  const app = document.getElementById("app");

  if (!app) {
    console.error("BuildPilot: #app not found");
    return;
  }

  if (!window.supabase) {
    app.innerHTML = `
      <div style="
        min-height:100vh;
        display:grid;
        place-items:center;
        background:#070b12;
        color:white;
        font-family:Arial,sans-serif;
        padding:20px;
      ">
        <div style="
          max-width:500px;
          padding:30px;
          border:1px solid #26364b;
          border-radius:18px;
          background:#0d141f;
        ">
          <h2>BuildPilot AI</h2>
          <p>Supabase library load nahi hui.</p>
          <button onclick="location.reload()">Reload</button>
        </div>
      </div>
    `;
    return;
  }

  const client = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_PUBLISHABLE_KEY
  );

  const FUNCTION_NAME = CONFIG.FUNCTION_NAME || "super-function";

  const state = {
    session: null,
    project: null,
    projects: [],
    files: [],
    activeFile: null,
    building: false
  };

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };

      return map[char];
    });
  }

  async function getSession() {
    const result = await client.auth.getSession();

    state.session = result.data.session || null;

    return state.session;
  }

  function header() {
    return `
      <header class="topbar">

        <div
          class="brandmark"
          id="brandHome"
        >
          BuildPilot <span>AI</span>
        </div>

        <div class="top-actions">

          ${
            state.session
              ? `
                <span class="user-chip">
                  ${escapeHTML(state.session.user.email)}
                </span>

                <button
                  class="btn"
                  id="projectsButton"
                >
                  Projects
                </button>

                <button
                  class="btn"
                  id="logoutButton"
                >
                  Logout
                </button>
              `
              : `
                <button
                  class="btn"
                  id="loginButton"
                >
                  Login
                </button>

                <button
                  class="btn primary"
                  id="signupButton"
                >
                  Sign up
                </button>
              `
          }

        </div>

      </header>
    `;
  }

  function bindHeader() {
    const home = document.getElementById("brandHome");

    if (home) {
      home.onclick = function () {
        location.hash = "";
      };
    }

    const login = document.getElementById("loginButton");

    if (login) {
      login.onclick = function () {
        location.hash = "#login";
      };
    }

    const signup = document.getElementById("signupButton");

    if (signup) {
      signup.onclick = function () {
        location.hash = "#signup";
      };
    }

    const projects = document.getElementById("projectsButton");

    if (projects) {
      projects.onclick = function () {
        location.hash = "#projects";
      };
    }

    const logout = document.getElementById("logoutButton");

    if (logout) {
      logout.onclick = async function () {
        await client.auth.signOut();

        state.session = null;
        state.project = null;
        state.files = [];

        location.hash = "";
      };
    }
  }

  function homePage() {
    app.innerHTML = `
      <div class="site">

        ${header()}

        <main class="landing">

          <section class="hero2">

            <div class="eyebrow">
              AI SOFTWARE BUILDER
            </div>

            <h1>
              Describe it.
              <span>Build it.</span>
            </h1>

            <p>
              BuildPilot AI turns your idea into a real website
              and lets you modify it using normal language.
            </p>

          </section>


          <section class="builder-card">

            <div class="builder-head">

              <div>

                <div class="tiny-label">
                  NEW PROJECT
                </div>

                <h2>
                  What do you want to build?
                </h2>

              </div>

              <div class="status-dot">
                ● AI Ready
              </div>

            </div>


            <div class="type-grid">

              <button
                class="type-card selected"
                data-type="complete_system"
              >

                <div class="type-icon">
                  ⚡
                </div>

                <div>

                  <strong>
                    Complete System
                  </strong>

                  <p>
                    Website + application structure
                    + backend-ready project.
                  </p>

                  <small>
                    Recommended
                  </small>

                </div>

              </button>


              <button
                class="type-card"
                data-type="website"
              >

                <div class="type-icon">
                  ◈
                </div>

                <div>

                  <strong>
                    Website Only
                  </strong>

                  <p>
                    Responsive HTML, CSS and
                    JavaScript website.
                  </p>

                  <small>
                    Simple & fast
                  </small>

                </div>

              </button>

            </div>


            <div class="builder-fields">

              <label>

                Project name

                <input
                  id="projectName"
                  class="input"
                  placeholder="Kartar Classes"
                >

              </label>


              <label>

                Frontend

                <select
                  id="frontend"
                  class="input"
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

              </label>


              <label>

                Backend

                <select
                  id="backend"
                  class="input"
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

              </label>


              <label>

                Brand / Contact

                <input
                  id="brandInfo"
                  class="input"
                  placeholder="Logo, phone, WhatsApp..."
                >

              </label>

            </div>


            <label
              class="req-label"
              style="margin-top:18px"
            >

              Describe your project

            </label>


            <textarea
              id="projectPrompt"
              class="textarea promptbox"
              placeholder="Example: Coaching institute website banao. Header blue ho, logo left me, Home, Courses, Teachers, Contact pages ho aur WhatsApp button ho."
            ></textarea>


            <div class="quick-row">

              <button
                class="quick"
                data-text="Coaching institute website with courses, teachers, admission enquiry and WhatsApp button"
              >
                Coaching Website
              </button>

              <button
                class="quick"
                data-text="Business website with services, gallery, contact form and WhatsApp"
              >
                Business Website
              </button>

              <button
                class="quick"
                data-text="Modern portfolio website with projects, skills and contact section"
              >
                Portfolio
              </button>

              <button
                class="quick"
                data-text="Login and dashboard system with Supabase authentication"
              >
                Login + Dashboard
              </button>

            </div>


            <div class="builder-bottom">

              <div class="selected-stack">

                <span class="pill">
                  AI Code
                </span>

                <span class="pill">
                  Live Preview
                </span>

                <span class="pill">
                  AI Editing
                </span>

              </div>


              <button
                id="buildButton"
                class="btn primary big"
              >
                ✦ Build with AI
              </button>

            </div>


            <div
              id="homeMessage"
              class="hidden"
            ></div>

          </section>


          <section class="support-grid">

            <div class="mini-card">

              <b>
                💬 Natural Language Editing
              </b>

              <span>
                Header ka color blue karo,
                WhatsApp button add karo,
                AI actual files modify karega.
              </span>

            </div>


            <div class="mini-card">

              <b>
                👁 Live Preview
              </b>

              <span>
                Generated HTML project ka preview
                workspace me dikhega.
              </span>

            </div>


            <div class="mini-card">

              <b>
                📁 Project Files
              </b>

              <span>
                Project files Supabase database
                me save hongi.
              </span>

            </div>

          </section>

        </main>

      </div>
    `;

    bindHeader();

    document.querySelectorAll(".type-card").forEach(function (button) {
      button.onclick = function () {

        document
          .querySelectorAll(".type-card")
          .forEach(function (item) {
            item.classList.remove("selected");
          });

        button.classList.add("selected");
      };
    });

    document.querySelectorAll(".quick").forEach(function (button) {
      button.onclick = function () {
        document.getElementById("projectPrompt").value =
          button.dataset.text;
      };
    });

    document.getElementById("buildButton").onclick =
      buildProject;
  }


  function showMessage(text, type) {

    const box = document.getElementById("homeMessage");

    if (!box) {
      return;
    }

    box.className =
      "notice " +
      (type === "error"
        ? "error"
        : type === "success"
        ? "success-note"
        : "");

    box.textContent = text;
  }


  async function buildProject() {

    if (state.building) {
      return;
    }

    if (!state.session) {
      location.hash = "#login";
      return;
    }

    const name =
      document
        .getElementById("projectName")
        .value
        .trim() ||
      "BuildPilot Project";

    const prompt =
      document
        .getElementById("projectPrompt")
        .value
        .trim();

    const frontend =
      document.getElementById("frontend").value;

    const backend =
      document.getElementById("backend").value;

    const brand =
      document
        .getElementById("brandInfo")
        .value
        .trim();

    if (!prompt) {
      showMessage(
        "Project description likhiye.",
        "error"
      );

      return;
    }

    state.building = true;

    const button =
      document.getElementById("buildButton");

    button.disabled = true;

    button.textContent =
      "AI is building...";


    try {

      const typeResult =
        await client
          .from("project_types")
          .select("id,code")
          .eq("code", "complete_system")
          .maybeSingle();


      const description =
        prompt +
        (brand
          ? "\nBrand details: " + brand
          : "");


      const projectResult =
        await client
          .from("projects")
          .insert({
            user_id: state.session.user.id,
            name: name,
            description: description,
            frontend: frontend,
            backend: backend,
            project_type_id:
              typeResult.data
                ? typeResult.data.id
                : null,
            status: "building"
          })
          .select("*")
          .single();


      if (projectResult.error) {
        throw projectResult.error;
      }


      state.project =
        projectResult.data;


      const aiResult =
        await callFunction(
          state.project.id,
          description
        );


      if (!aiResult.success) {
        throw new Error(
          aiResult.error ||
          "AI build failed"
        );
      }


      await client
        .from("projects")
        .update({
          status: "completed"
        })
        .eq(
          "id",
          state.project.id
        );


      await loadFiles(
        state.project.id
      );


      location.hash =
        "#workspace";

    } catch (error) {

      console.error(
        "BuildPilot error:",
        error
      );

      showMessage(
        error.message ||
          "Project build failed.",
        "error"
      );

      if (state.project) {

        await client
          .from("projects")
          .update({
            status: "failed"
          })
          .eq(
            "id",
            state.project.id
          );

      }

    } finally {

      state.building = false;

      button.disabled = false;

      button.textContent =
        "✦ Build with AI";
    }
  }


  async function callFunction(
    projectId,
    instruction
  ) {

    const result =
      await client.functions.invoke(
        FUNCTION_NAME,
        {
          headers: {
            Authorization:
              "Bearer " +
              state.session.access_token
          },

          body: {
            projectId: projectId,
            instruction: instruction
          }
        }
      );


    if (result.error) {

      return {
        success: false,
        error:
          result.error.message ||
          "Edge Function error"
      };

    }


    return (
      result.data || {
        success: false,
        error: "Empty response"
      }
    );
  }


  async function loadFiles(projectId) {

    const result =
      await client
        .from("project_files")
        .select("*")
        .eq(
          "project_id",
          projectId
        )
        .order(
          "file_path",
          {
            ascending: true
          }
        );


    if (result.error) {
      throw result.error;
    }


    state.files =
      result.data || [];

    state.activeFile =
      state.files[0] || null;
  }


  async function projectsPage() {

    if (!state.session) {
      location.hash = "#login";
      return;
    }

    const result =
      await client
        .from("projects")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (result.error) {
      console.error(result.error);
    }


    state.projects =
      result.data || [];


    app.innerHTML = `
      <div class="site">

        ${header()}

        <main class="container">

          <div class="page-head">

            <div>

              <div class="tiny-label">
                WORKSPACE
              </div>

              <h1>
                My Projects
              </h1>

              <p class="muted">
                Apne projects open karke AI se
                changes karein.
              </p>

            </div>

            <button
              id="newProjectButton"
              class="btn primary"
            >
              + New Project
            </button>

          </div>


          <div class="project-list">

            ${
              state.projects.length
                ? state.projects
                    .map(function (project) {

                      return `
                        <div class="project-item">

                          <div>

                            <b>
                              ${escapeHTML(
                                project.name
                              )}
                            </b>

                            <p>
                              ${escapeHTML(
                                project.description ||
                                  ""
                              )}

                              ·

                              ${escapeHTML(
                                project.status ||
                                  "draft"
                              )}
                            </p>

                          </div>


                          <button
                            class="btn"
                            data-project-id="${project.id}"
                          >
                            Open
                          </button>

                        </div>
                      `;

                    })
                    .join("")
                : `
                    <div class="empty-card">
                      Abhi koi project nahi hai.
                    </div>
                  `
            }

          </div>

        </main>

      </div>
    `;


    bindHeader();


    document
      .getElementById("newProjectButton")
      .onclick = function () {
        location.hash = "";
      };


    document
      .querySelectorAll("[data-project-id]")
      .forEach(function (button) {

        button.onclick =
          function () {

            openProject(
              button.dataset.projectId
            );

          };

      });
  }


  async function openProject(id) {

    const result =
      await client
        .from("projects")
        .select("*")
        .eq("id", id)
        .eq(
          "user_id",
          state.session.user.id
        )
        .single();


    if (result.error) {

      alert(
        result.error.message
      );

      return;
    }


    state.project =
      result.data;


    await loadFiles(id);

    location.hash =
      "#workspace";
  }


  function workspacePage() {

    if (!state.project) {
      location.hash =
        "#projects";

      return;
    }


    app.innerHTML = `
      <div class="workspace">

        <div class="workspace-top">

          <button
            class="btn"
            id="backButton"
          >
            ←
          </button>


          <div class="workspace-name">

            ${escapeHTML(
              state.project.name
            )}

            <span class="live-badge">
              ● AI WORKSPACE
            </span>

          </div>


          <button
            class="btn"
            id="refreshButton"
          >
            Refresh
          </button>


          <button
            class="btn"
            id="chatButton"
          >
            AI Chat
          </button>

        </div>


        <div
          class="workspace-grid"
          id="workspaceGrid"
        >

          <aside
            class="panel files-panel"
          >

            <div class="panel-title">
              PROJECT FILES
            </div>


            <div
              class="file-list"
              id="fileList"
            >
              ${fileListHTML()}
            </div>


            <div class="panel-footer">

              <button
                class="btn full"
                id="reloadFiles"
              >
                Reload Files
              </button>

            </div>

          </aside>


          <section class="preview-panel">

            <div class="preview-tabs">
              <b>PREVIEW</b>
              <span>CODE</span>
              <span>APP</span>
            </div>


            <div class="preview-frame">

              <div class="browser-bar">

                <span></span>
                <span></span>
                <span></span>

                <div>
                  buildpilot.local
                </div>

              </div>


              <div
                class="preview-content"
                id="previewContent"
              >

                <iframe
                  id="previewFrame"
                  sandbox="allow-scripts allow-forms"
                ></iframe>

              </div>

            </div>

          </section>


          <aside class="panel ai-panel">

            <div class="panel-title">
              BUILD WITH AI
            </div>


            <div
              class="builder-messages"
              id="messages"
            >

              <div class="ai-bubble">

                Project ready.

                <br><br>

                Aap mujhe direct changes bol sakte hain:

                <br><br>

                • Header ka color blue karo

                <br>

                • Home page me section add karo

                <br>

                • Contact number change karo

                <br>

                • WhatsApp button add karo

                <br>

                • Login page banao

              </div>

            </div>


            <div class="ai-compose">

              <textarea
                id="editPrompt"
                placeholder="Describe a change..."
              ></textarea>


              <button
                class="btn primary"
                id="sendButton"
              >
                ✦ Apply Change
              </button>

            </div>

          </aside>

        </div>


        <div class="workspace-footer">

          <span>
            ${escapeHTML(
              state.project.frontend ||
                "html"
            )}
          </span>

          <span>
            ${state.files.length}
            files
          </span>

        </div>

      </div>
    `;


    bindWorkspace();

    updatePreview();
  }


  function fileListHTML() {

    if (!state.files.length) {

      return `
        <div class="empty">
          No files yet.
        </div>
      `;
    }


    return state.files
      .map(function (file) {

        return `
          <button
            class="file-row ${
              state.activeFile &&
              state.activeFile.id === file.id
                ? "active"
                : ""
            }"
            data-file-id="${file.id}"
          >

            <span>
              ${fileIcon(file.file_path)}
            </span>

            <span>
              ${escapeHTML(
                file.file_path
              )}
            </span>

          </button>
        `;

      })
      .join("");
  }


  function fileIcon(path) {

    if (/\.html?$/i.test(path)) {
      return "◇";
    }

    if (/\.css$/i.test(path)) {
      return "◈";
    }

    if (/\.js$/i.test(path)) {
      return "JS";
    }

    return "•";
  }


  function bindWorkspace() {

    document.getElementById("backButton").onclick =
      function () {
        location.hash =
          "#projects";
      };


    document.getElementById("chatButton").onclick =
      function () {

        document
          .getElementById("workspaceGrid")
          .classList.toggle(
            "show-ai"
          );

      };


    document.getElementById("refreshButton").onclick =
      updatePreview;


    document.getElementById("reloadFiles").onclick =
      async function () {

        await loadFiles(
          state.project.id
        );

        workspacePage();
      };


    document
      .querySelectorAll("[data-file-id]")
      .forEach(function (button) {

        button.onclick =
          function () {

            const file =
              state.files.find(
                function (item) {
                  return (
                    item.id ===
                    button.dataset.fileId
                  );
                }
              );

            state.activeFile =
              file || null;

            openEditor();
          };

      });


    document.getElementById("sendButton").onclick =
      sendAI;


    document
      .getElementById("editPrompt")
      .addEventListener(
        "keydown",
        function (event) {

          if (
            event.key === "Enter" &&
            (event.ctrlKey ||
              event.metaKey)
          ) {
            sendAI();
          }

        }
      );
  }


  function openEditor() {

    if (!state.activeFile) {
      return;
    }


    const file =
      state.activeFile;


    const content =
      document.getElementById(
        "previewContent"
      );


    content.innerHTML = `
      <div class="editor-wrap">

        <div class="editor-head">

          <span class="editor-path">
            ${escapeHTML(
              file.file_path
            )}
          </span>

          <div class="editor-actions">

            <button
              class="btn"
              id="closeEditor"
            >
              Close
            </button>

            <button
              class="btn primary"
              id="saveEditor"
            >
              Save
            </button>

          </div>

        </div>


        <textarea
          id="codeEditor"
          class="code-editor"
        ></textarea>

      </div>
    `;


    document.getElementById(
      "codeEditor"
    ).value =
      file.file_content || "";


    document.getElementById(
      "closeEditor"
    ).onclick =
      function () {

        workspacePage();

      };


    document.getElementById(
      "saveEditor"
    ).onclick =
      async function () {

        const value =
          document.getElementById(
            "codeEditor"
          ).value;


        const result =
          await client
            .from("project_files")
            .update({
              file_content: value,
              updated_at:
                new Date().toISOString()
            })
            .eq(
              "id",
              file.id
            );


        if (result.error) {

          alert(
            result.error.message
          );

          return;
        }


        file.file_content =
          value;


        workspacePage();
      };
  }


  function buildPreview() {

    const html =
      state.files.find(
        function (file) {

          return /(^|\/)index\.html?$/i.test(
            file.file_path
          );

        }
      ) ||
      state.files.find(
        function (file) {

          return /\.html?$/i.test(
            file.file_path
          );

        }
      );


    if (!html) {

      return `
        <html>
          <body
            style="
              font-family:Arial;
              padding:40px;
            "
          >

            <h2>
              BuildPilot Preview
            </h2>

            <p>
              index.html abhi available nahi hai.
            </p>

          </body>
        </html>
      `;
    }


    let documentHTML =
      html.file_content || "";


    const css =
      state.files.find(
        function (file) {
          return /\.css$/i.test(
            file.file_path
          );
        }
      );


    if (
      css &&
      !/<style[\s\S]*?>/i.test(
        documentHTML
      )
    ) {

      documentHTML =
        documentHTML.replace(
          /<\/head>/i,
          "<style>" +
            css.file_content +
            "</style></head>"
        );
    }


    return documentHTML;
  }


  function updatePreview() {

    const frame =
      document.getElementById(
        "previewFrame"
      );


    if (!frame) {
      return;
    }


    frame.srcdoc =
      buildPreview();
  }


  async function sendAI() {

    const input =
      document.getElementById(
        "editPrompt"
      );


    const prompt =
      input.value.trim();


    if (!prompt) {
      return;
    }


    const messages =
      document.getElementById(
        "messages"
      );


    messages.insertAdjacentHTML(
      "beforeend",
      `
        <div class="user-bubble">
          ${escapeHTML(prompt)}
        </div>

        <div
          class="ai-bubble"
          id="aiWorking"
        >
          AI project edit kar raha hai...
        </div>
      `
    );


    input.value = "";


    try {

      await getSession();


      const result =
        await callFunction(
          state.project.id,
          prompt
        );


      const working =
        document.getElementById(
          "aiWorking"
        );


      if (working) {
        working.remove();
      }


      if (!result.success) {
        throw new Error(
          result.error ||
          "AI update failed"
        );
      }


      await loadFiles(
        state.project.id
      );


      messages.insertAdjacentHTML(
        "beforeend",
        `
          <div class="ai-bubble">
            ✓ ${
              escapeHTML(
                result.message ||
                "Project updated."
              )
            }
          </div>
        `
      );


      updateWorkspaceWithoutReload();

    } catch (error) {

      const working =
        document.getElementById(
          "aiWorking"
        );


      if (working) {
        working.remove();
      }


      messages.insertAdjacentHTML(
        "beforeend",
        `
          <div class="ai-bubble">
            ❌ ${
              escapeHTML(
                error.message ||
                "AI error"
              )
            }
          </div>
        `
      );
    }
  }


  function updateWorkspaceWithoutReload() {

    const list =
      document.getElementById(
        "fileList"
      );


    if (list) {
      list.innerHTML =
        fileListHTML();
    }


    document
      .querySelectorAll(
        "[data-file-id]"
      )
      .forEach(function (button) {

        button.onclick =
          function () {

            state.activeFile =
              state.files.find(
                function (file) {
                  return (
                    file.id ===
                    button.dataset.fileId
                  );
                }
              ) || null;

            openEditor();
          };

      });


    updatePreview();
  }


  function loginPage(signup) {

    app.innerHTML = `
      <div class="site">

        ${header()}

        <div class="auth-wrap">

          <div class="auth-card">

            <div class="eyebrow">
              ${
                signup
                  ? "CREATE ACCOUNT"
                  : "WELCOME BACK"
              }
            </div>

            <h2>
              ${
                signup
                  ? "Create your account"
                  : "Login to BuildPilot"
              }
            </h2>

            <p class="muted">
              ${
                signup
                  ? "Start building with AI."
                  : "Continue your projects."
              }
            </p>


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
                id="authButton"
                class="btn primary"
              >
                ${
                  signup
                    ? "Create Account"
                    : "Login"
                }
              </button>


              <div
                id="authMessage"
                class="hidden"
              ></div>


              <button
                id="backButton"
                class="btn"
              >
                Back
              </button>

            </div>

          </div>

        </div>

      </div>
    `;


    bindHeader();


    document.getElementById(
      "backButton"
    ).onclick =
      function () {
        location.hash = "";
      };


    document.getElementById(
      "authButton"
    ).onclick =
      async function () {

        const email =
          document.getElementById(
            "email"
          ).value.trim();


        const password =
          document.getElementById(
            "password"
          ).value;


        let result;


        if (signup) {

          result =
            await client.auth.signUp({
              email: email,
              password: password
            });

        } else {

          result =
            await client.auth.signInWithPassword({
              email: email,
              password: password
            });

        }


        const message =
          document.getElementById(
            "authMessage"
          );


        if (result.error) {

          message.className =
            "notice error";

          message.textContent =
            result.error.message;

          return;
        }


        if (
          signup &&
          !result.data.session
        ) {

          message.className =
            "notice success-note";

          message.textContent =
            "Account created. Email confirm karke login karein.";

          return;
        }


        await getSession();

        location.hash = "";
      };
  }


  async function router() {

    await getSession();


    const hash =
      location.hash;


    if (hash === "#login") {
      loginPage(false);
      return;
    }


    if (hash === "#signup") {
      loginPage(true);
      return;
    }


    if (hash === "#projects") {
      await projectsPage();
      return;
    }


    if (hash === "#workspace") {

      workspacePage();
      return;
    }


    homePage();
  }


  client.auth.onAuthStateChange(
    function (_event, session) {
      state.session =
        session || null;
    }
  );


  window.addEventListener(
    "hashchange",
    router
  );


  router();

})();
