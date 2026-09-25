(() => {
  "use strict";

  const cfg = window.BUILDPILOT_CONFIG || {};

  const SUPABASE_URL =
    cfg.SUPABASE_URL || "";

  const SUPABASE_PUBLISHABLE_KEY =
    cfg.SUPABASE_PUBLISHABLE_KEY || "";

  if (
    !SUPABASE_URL ||
    !SUPABASE_PUBLISHABLE_KEY ||
    !window.supabase
  ) {
    console.error(
      "Admin: Supabase configuration is missing."
    );
    return;
  }

  const client =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    );

  const $ = (id) =>
    document.getElementById(id);

  const loginView =
    $("loginView");

  const adminView =
    $("adminView");

  const msg =
    $("msg");

  const loginBtn =
    $("loginBtn");

  let currentUser = null;

  let users = [];
  let projects = [];
  let requests = [];
  let generations = [];

  let editingUserId = null;
  let reviewingRequestId = null;

  /* =========================================================
     HELPERS
  ========================================================= */

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(value) {
    if (!value) {
      return "-";
    }

    const d =
      new Date(value);

    if (
      Number.isNaN(
        d.getTime()
      )
    ) {
      return String(value);
    }

    return d.toLocaleString();
  }

  function badge(
    text,
    type
  ) {
    return (
      '<span class="badge badge-' +
      escapeHtml(type) +
      '">' +
      escapeHtml(text) +
      "</span>"
    );
  }

  function showError(
    message
  ) {
    if (!msg) return;

    msg.textContent =
      String(
        message ||
        "Something went wrong."
      );

    msg.style.display =
      "block";
  }

  function clearError() {
    if (!msg) return;

    msg.textContent = "";
    msg.style.display =
      "none";
  }

  function userName(
    userId
  ) {
    const user =
      users.find(
        (item) =>
          item.id ===
          userId
      );

    return (
      user?.full_name ||
      userId ||
      "-"
    );
  }

  function projectName(
    projectId
  ) {
    const project =
      projects.find(
        (item) =>
          item.id ===
          projectId
      );

    return (
      project?.name ||
      project?.project_name ||
      projectId ||
      "-"
    );
  }

  function getNumber(
    value,
    fallback = 0
  ) {
    const n =
      Number(value);

    return Number.isFinite(n)
      ? n
      : fallback;
  }

  /* =========================================================
     ADMIN VERIFICATION
  ========================================================= */

  async function verifyAdmin(
    user
  ) {
    if (!user) {
      throw new Error(
        "Please login with your admin account."
      );
    }

    const {
      data,
      error
    } =
      await client
        .from("profiles")
        .select(
          "id,full_name,role,status,plan,project_limit,github_file_limit"
        )
        .eq(
          "id",
          user.id
        )
        .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        "Admin profile not found."
      );
    }

    if (
      data.role !==
      "admin"
    ) {
      throw new Error(
        "This account is not an admin account."
      );
    }

    if (
      data.status !==
      "active"
    ) {
      throw new Error(
        "Admin account is blocked."
      );
    }

    return data;
  }

  /* =========================================================
     LOAD ALL DATA
  ========================================================= */

  async function loadAllData() {
    const [
      usersResult,
      projectsResult,
      requestsResult,
      generationsResult
    ] =
      await Promise.all([
        client
          .from("profiles")
          .select(
            "id,full_name,role,status,plan,project_limit,github_file_limit,created_at,updated_at"
          ),

        client
          .from("projects")
          .select("*"),

        client
          .from(
            "upgrade_requests"
          )
          .select("*")
          .order(
            "created_at",
            {
              ascending: false
            }
          ),

        client
          .from("generations")
          .select("*")
          .order(
            "created_at",
            {
              ascending: false
            }
          )
      ]);

    if (usersResult.error) {
      throw new Error(
        "Users: " +
        usersResult.error.message
      );
    }

    if (
      projectsResult.error
    ) {
      throw new Error(
        "Projects: " +
        projectsResult.error.message
      );
    }

    if (
      requestsResult.error
    ) {
      throw new Error(
        "Upgrade Requests: " +
        requestsResult.error.message
      );
    }

    if (
      generationsResult.error
    ) {
      throw new Error(
        "Generations: " +
        generationsResult.error.message
      );
    }

    users =
      usersResult.data ||
      [];

    projects =
      projectsResult.data ||
      [];

    requests =
      requestsResult.data ||
      [];

    generations =
      generationsResult.data ||
      [];

    renderStats();
    renderUsers();
    renderRequests();
    renderProjects();
    renderGenerations();
  }

  /* =========================================================
     STATS
  ========================================================= */

  function renderStats() {
    const activeUsers =
      users.filter(
        (u) =>
          u.status ===
          "active"
      ).length;

    const blockedUsers =
      users.filter(
        (u) =>
          u.status ===
          "blocked"
      ).length;

    const pendingRequests =
      requests.filter(
        (r) =>
          r.status ===
          "pending"
      ).length;

    if ($("users")) {
      $("users").textContent =
        users.length;
    }

    if ($("active")) {
      $("active").textContent =
        activeUsers;
    }

    if ($("blocked")) {
      $("blocked").textContent =
        blockedUsers;
    }

    if ($("projects")) {
      $("projects").textContent =
        projects.length;
    }

    if ($("pendingRequests")) {
      $("pendingRequests").textContent =
        pendingRequests;
    }
  }

  /* =========================================================
     USERS
  ========================================================= */

  function renderUsers() {
    const body =
      $("usersTableBody");

    if (!body) return;

    const search =
      (
        $("userSearch")
          ?.value || ""
      )
        .trim()
        .toLowerCase();

    const filteredUsers =
      users.filter(
        (user) => {
          const text = [
            user.full_name,
            user.id,
            user.role,
            user.status,
            user.plan
          ]
            .join(" ")
            .toLowerCase();

          return (
            !search ||
            text.includes(
              search
            )
          );
        }
      );

    if (
      !filteredUsers.length
    ) {
      body.innerHTML =
        '<tr>' +
        '<td colspan="7" class="empty">' +
        "No users found." +
        "</td>" +
        "</tr>";

      return;
    }

    body.innerHTML =
      filteredUsers
        .map(
          (user) => {
            const roleBadge =
              user.role ===
              "admin"
                ? badge(
                    "admin",
                    "admin"
                  )
                : badge(
                    "user",
                    "user"
                  );

            const statusBadge =
              user.status ===
              "active"
                ? badge(
                    "active",
                    "active"
                  )
                : badge(
                    "blocked",
                    "blocked"
                  );

            let actions = "";

            if (
              user.id ===
              currentUser?.id
            ) {
              actions =
                '<span style="color:#64748b;font-size:12px;">' +
                "Current admin" +
                "</span>";
            } else {
              actions =
                '<div class="row-actions">' +

                '<button class="small-btn" ' +
                'data-action="edit-user" ' +
                'data-id="' +
                escapeHtml(
                  user.id
                ) +
                '">' +
                "Edit" +
                "</button>" +

                (
                  user.status ===
                  "blocked"
                    ? '<button class="small-btn" ' +
                      'data-action="activate-user" ' +
                      'data-id="' +
                      escapeHtml(
                        user.id
                      ) +
                      '">' +
                      "Reactivate" +
                      "</button>"
                    : '<button class="small-btn" ' +
                      'data-action="block-user" ' +
                      'data-id="' +
                      escapeHtml(
                        user.id
                      ) +
                      '">' +
                      "Block" +
                      "</button>"
                ) +

                "</div>";
            }

            return (
              "<tr>" +

              "<td>" +
              escapeHtml(
                user.full_name ||
                  "Unnamed user"
              ) +
              "<br>" +
              '<small style="color:#64748b">' +
              escapeHtml(
                user.id
              ) +
              "</small>" +
              "</td>" +

              "<td>" +
              roleBadge +
              "</td>" +

              "<td>" +
              statusBadge +
              "</td>" +

              "<td>" +
              escapeHtml(
                user.plan ||
                  "free"
              ) +
              "</td>" +

              "<td>" +
              escapeHtml(
                user.project_limit ??
                  "-"
              ) +
              "</td>" +

              "<td>" +
              escapeHtml(
                user.github_file_limit ??
                  "-"
              ) +
              "</td>" +

              "<td>" +
              actions +
              "</td>" +

              "</tr>"
            );
          }
        )
        .join("");
  }

  /* =========================================================
     EDIT USER
  ========================================================= */

  function openEditUser(
    userId
  ) {
    const user =
      users.find(
        (item) =>
          item.id ===
          userId
      );

    if (!user) return;

    editingUserId =
      userId;

    if ($("editUserId")) {
      $("editUserId").value =
        userId;
    }

    if ($("editPlan")) {
      $("editPlan").value =
        user.plan ||
        "free";
    }

    if ($("editStatus")) {
      $("editStatus").value =
        user.status ||
        "active";
    }

    if (
      $("editProjectLimit")
    ) {
      $("editProjectLimit").value =
        user.project_limit ??
        5;
    }

    if (
      $("editGithubFileLimit")
    ) {
      $("editGithubFileLimit").value =
        user.github_file_limit ??
        2;
    }

    if (
      $("editUserModal")
    ) {
      $("editUserModal").style.display =
        "flex";
    }
  }

  function closeEditUser() {
    editingUserId =
      null;

    if (
      $("editUserModal")
    ) {
      $("editUserModal").style.display =
        "none";
    }
  }

  async function saveUser() {
    if (!editingUserId) {
      return;
    }

    const plan =
      $("editPlan")
        ?.value ||
      "free";

    const status =
      $("editStatus")
        ?.value ||
      "active";

    const projectLimit =
      Math.max(
        1,
        getNumber(
          $("editProjectLimit")
            ?.value,
          5
        )
      );

    const githubFileLimit =
      Math.max(
        1,
        getNumber(
          $("editGithubFileLimit")
            ?.value,
          2
        )
      );

    const {
      error
    } =
      await client
        .from("profiles")
        .update({
          plan,
          status,
          project_limit:
            projectLimit,
          github_file_limit:
            githubFileLimit,
          updated_at:
            new Date().toISOString()
        })
        .eq(
          "id",
          editingUserId
        );

    if (error) {
      throw error;
    }

    closeEditUser();

    await loadAllData();
  }

  /* =========================================================
     BLOCK / REACTIVATE
  ========================================================= */

  async function setUserStatus(
    userId,
    status
  ) {
    if (!userId) return;

    if (
      userId ===
      currentUser?.id
    ) {
      alert(
        "You cannot block your current admin account."
      );
      return;
    }

    const action =
      status ===
      "blocked"
        ? "block"
        : "reactivate";

    if (
      !confirm(
        "Are you sure you want to " +
        action +
        " this user?"
      )
    ) {
      return;
    }

    const {
      error
    } =
      await client
        .from("profiles")
        .update({
          status,
          updated_at:
            new Date().toISOString()
        })
        .eq(
          "id",
          userId
        );

    if (error) {
      throw error;
    }

    await loadAllData();
  }

  /* =========================================================
     UPGRADE REQUESTS
  ========================================================= */

  function renderRequests() {
    const body =
      $("requestsTableBody");

    if (!body) return;

    if (!requests.length) {
      body.innerHTML =
        '<tr>' +
        '<td colspan="7" class="empty">' +
        "No upgrade requests." +
        "</td>" +
        "</tr>";

      return;
    }

    body.innerHTML =
      requests
        .map(
          (request) => {
            const status =
              request.status ||
              "pending";

            let statusType =
              "user";

            if (
              status ===
              "approved"
            ) {
              statusType =
                "active";
            }

            if (
              status ===
              "rejected"
            ) {
              statusType =
                "blocked";
            }

            const requestedLimit =
              request.requested_limit ??
              request.approved_limit ??
              "-";

            const action =
              status ===
              "pending"
                ? '<button class="small-btn" ' +
                  'data-action="review-request" ' +
                  'data-id="' +
                  escapeHtml(
                    request.id
                  ) +
                  '">' +
                  "Review" +
                  "</button>"
                : '<span style="color:#64748b;font-size:12px;">' +
                  "Reviewed" +
                  "</span>";

            return (
              "<tr>" +

              "<td>" +
              escapeHtml(
                userName(
                  request.user_id
                )
              ) +
              "</td>" +

              "<td>" +
              escapeHtml(
                request.request_type ||
                  "Project Limit"
              ) +
              "</td>" +

              "<td>" +
              escapeHtml(
                requestedLimit
              ) +
              "</td>" +

              "<td style=\"white-space:normal;max-width:320px\">" +
              escapeHtml(
                request.message ||
                  "-"
              ) +
              "</td>" +

              "<td>" +
              badge(
                status,
                statusType
              ) +
              "</td>" +

              "<td>" +
              escapeHtml(
                formatDate(
                  request.created_at
                )
              ) +
              "</td>" +

              "<td>" +
              action +
              "</td>" +

              "</tr>"
            );
          }
        )
        .join("");
  }

  /* =========================================================
     CREATE APPROVED LIMIT FIELD IF HTML DOES NOT HAVE ONE
  ========================================================= */

  function ensureApprovedLimitField() {
    const existing =
      $(
        "approvedProjectLimit"
      ) ||
      $("approvedLimit") ||
      $("requestApprovedLimit");

    if (existing) {
      return existing;
    }

    const note =
      $("adminNote");

    if (!note) {
      return null;
    }

    const parent =
      note.parentElement;

    if (!parent) {
      return null;
    }

    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.id =
      "approvedLimitDynamicWrapper";

    wrapper.style.marginBottom =
      "12px";

    wrapper.innerHTML =
      '<label style="display:block;margin-bottom:6px;font-weight:600;">' +
      "Approved Project Limit" +
      "</label>" +

      '<input ' +
      'id="approvedProjectLimit" ' +
      'type="number" ' +
      'min="1" ' +
      'step="1" ' +
      'placeholder="Example: 10" ' +
      'style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;"' +
      " />";

    parent.insertBefore(
      wrapper,
      note
    );

    return $(
      "approvedProjectLimit"
    );
  }

  function getRequestCurrentLimit(
    request
  ) {
    const user =
      users.find(
        (item) =>
          item.id ===
          request.user_id
      );

    return getNumber(
      user?.project_limit,
      2
    );
  }

  function getRequestRequestedLimit(
    request
  ) {
    const requested =
      request.requested_limit ??
      request.approved_limit ??
      request.project_limit;

    const n =
      Number(requested);

    return Number.isFinite(n) &&
      n > 0
      ? n
      : getRequestCurrentLimit(
          request
        );
  }

  function openRequest(
    requestId
  ) {
    const request =
      requests.find(
        (item) =>
          item.id ===
          requestId
      );

    if (!request) {
      return;
    }

    reviewingRequestId =
      requestId;

    if ($("requestId")) {
      $("requestId").value =
        requestId;
    }

    const limitInput =
      ensureApprovedLimitField();

    const requestedLimit =
      getRequestRequestedLimit(
        request
      );

    if (limitInput) {
      limitInput.value =
        requestedLimit;
    }

    if ($("adminNote")) {
      $("adminNote").value =
        request.admin_note ||
        "";
    }

    if (
      $("requestModal")
    ) {
      $("requestModal").style.display =
        "flex";
    }
  }

  function closeRequest() {
    reviewingRequestId =
      null;

    if (
      $("requestModal")
    ) {
      $("requestModal").style.display =
        "none";
    }
  }

  /* =========================================================
     GET APPROVED LIMIT
  ========================================================= */

  function getApprovedLimit(
    request
  ) {
    const input =
      $("approvedProjectLimit") ||
      $("approvedLimit") ||
      $("requestApprovedLimit");

    if (input) {
      const value =
        Number(
          input.value
        );

      if (
        Number.isFinite(value) &&
        value >= 1
      ) {
        return Math.floor(
          value
        );
      }
    }

    const fallback =
      Number(
        request.approved_limit ??
        request.requested_limit ??
        request.project_limit
      );

    if (
      Number.isFinite(
        fallback
      ) &&
      fallback >= 1
    ) {
      return Math.floor(
        fallback
      );
    }

    return 2;
  }

  /* =========================================================
     UPDATE UPGRADE REQUEST
  ========================================================= */

  async function updateRequest(
    status
  ) {
    if (
      !reviewingRequestId
    ) {
      return;
    }

    const request =
      requests.find(
        (item) =>
          item.id ===
          reviewingRequestId
      );

    if (!request) {
      throw new Error(
        "Upgrade request not found."
      );
    }

    const adminNote =
      (
        $("adminNote")
          ?.value || ""
      ).trim();

    /* =====================================================
       REJECT
    ===================================================== */

    if (
      status ===
      "rejected"
    ) {
      const {
        error
      } =
        await client
          .from(
            "upgrade_requests"
          )
          .update({
            status:
              "rejected",
            admin_note:
              adminNote,
            updated_at:
              new Date().toISOString()
          })
          .eq(
            "id",
            reviewingRequestId
          );

      if (error) {
        throw error;
      }

      closeRequest();

      await loadAllData();

      alert(
        "Upgrade request rejected."
      );

      return;
    }

    /* =====================================================
       APPROVE
    ===================================================== */

    if (
      status !==
      "approved"
    ) {
      throw new Error(
        "Invalid request status."
      );
    }

    const userId =
      request.user_id;

    if (!userId) {
      throw new Error(
        "This upgrade request has no user ID."
      );
    }

    const approvedLimit =
      getApprovedLimit(
        request
      );

    if (
      !Number.isFinite(
        approvedLimit
      ) ||
      approvedLimit < 1
    ) {
      throw new Error(
        "Please enter a valid approved project limit."
      );
    }

    const currentLimit =
      getRequestCurrentLimit(
        request
      );

    if (
      approvedLimit <= 0
    ) {
      throw new Error(
        "Approved limit must be greater than 0."
      );
    }

    /* =====================================================
       STEP 1
       UPDATE CLIENT PROFILE LIMIT
    ===================================================== */

    const {
      data:
        updatedProfile,
      error:
        profileError
    } =
      await client
        .from("profiles")
        .update({
          project_limit:
            approvedLimit,
          updated_at:
            new Date().toISOString()
        })
        .eq(
          "id",
          userId
        )
        .select(
          "id,project_limit"
        )
        .maybeSingle();

    if (profileError) {
      throw new Error(
        "Unable to update client project limit: " +
        profileError.message
      );
    }

    /*
      If no row comes back, Supabase RLS may be
      blocking the update or the user profile
      does not exist.
    */

    if (
      !updatedProfile
    ) {
      throw new Error(
        "Client project limit was not updated. Check the profiles UPDATE and SELECT RLS policies."
      );
    }

    const savedLimit =
      Number(
        updatedProfile.project_limit
      );

    if (
      savedLimit !==
      approvedLimit
    ) {
      throw new Error(
        "Project limit verification failed. Expected " +
        approvedLimit +
        " but database returned " +
        savedLimit +
        "."
      );
    }

    /* =====================================================
       STEP 2
       MARK REQUEST APPROVED
    ===================================================== */

    const {
      error:
        requestError
    } =
      await client
        .from(
          "upgrade_requests"
        )
        .update({
          status:
            "approved",

          approved_limit:
            approvedLimit,

          admin_note:
            adminNote,

          updated_at:
            new Date().toISOString()
        })
        .eq(
          "id",
          reviewingRequestId
        );

    if (requestError) {
      throw new Error(
        "Limit was updated to " +
        approvedLimit +
        ", but the upgrade request could not be marked approved: " +
        requestError.message
      );
    }

    /* =====================================================
       STEP 3
       VERIFY REQUEST
    ===================================================== */

    const {
      data:
        verifiedRequest,
      error:
        verifyRequestError
    } =
      await client
        .from(
          "upgrade_requests"
        )
        .select(
          "id,status,approved_limit,user_id"
        )
        .eq(
          "id",
          reviewingRequestId
        )
        .maybeSingle();

    if (verifyRequestError) {
      console.warn(
        "Could not verify upgrade request:",
        verifyRequestError
      );
    }

    /* =====================================================
       STEP 4
       REFRESH ADMIN DATA
    ===================================================== */

    closeRequest();

    await loadAllData();

    /*
      Update success message.
    */

    alert(
      "Upgrade approved successfully!\n\n" +
      "Previous limit: " +
      currentLimit +
      "\n" +
      "New project limit: " +
      approvedLimit +
      "\n\n" +
      "Client profile has been updated."
    );

    console.log(
      "BuildPilot upgrade approved:",
      {
        userId,
        previousLimit:
          currentLimit,
        approvedLimit,
        verifiedProfile:
          updatedProfile,
        verifiedRequest
      }
    );
  }

  /* =========================================================
     PROJECTS
  ========================================================= */

  function renderProjects() {
    const body =
      $("projectsTableBody");

    if (!body) return;

    const search =
      (
        $("projectSearch")
          ?.value || ""
      )
        .trim()
        .toLowerCase();

    const filtered =
      projects.filter(
        (project) => {
          const text = [
            project.name,
            project.project_name,
            project.id,
            project.user_id,
            project.frontend,
            project.backend
          ]
            .join(" ")
            .toLowerCase();

          return (
            !search ||
            text.includes(
              search
            )
          );
        }
      );

    if (!filtered.length) {
      body.innerHTML =
        '<tr>' +
        '<td colspan="6" class="empty">' +
        "No projects found." +
        "</td>" +
        "</tr>";

      return;
    }

    body.innerHTML =
      filtered
        .map(
          (project) =>
            "<tr>" +

            "<td>" +
            escapeHtml(
              project.name ||
                project.project_name ||
                "Untitled"
            ) +
            "</td>" +

            "<td>" +
            escapeHtml(
              userName(
                project.user_id
              )
            ) +
            "</td>" +

            "<td>" +
            escapeHtml(
              project.frontend ||
                "-"
            ) +
            "</td>" +

            "<td>" +
            escapeHtml(
              project.backend ||
                "-"
            ) +
            "</td>" +

            "<td>" +
            escapeHtml(
              formatDate(
                project.created_at
              )
            ) +
            "</td>" +

            "<td>" +
            escapeHtml(
              formatDate(
                project.updated_at
              )
            ) +
            "</td>" +

            "</tr>"
        )
        .join("");
  }

  /* =========================================================
     AI GENERATIONS
  ========================================================= */

  function renderGenerations() {
    const body =
      $("generationsTableBody");

    if (!body) return;

    if (
      !generations.length
    ) {
      body.innerHTML =
        '<tr>' +
        '<td colspan="5" class="empty">' +
        "No AI generations found." +
        "</td>" +
        "</tr>";

      return;
    }

    body.innerHTML =
      generations
        .map(
          (generation) =>
            "<tr>" +

            "<td>" +
            escapeHtml(
              userName(
                generation.user_id
              )
            ) +
            "</td>" +

            "<td>" +
            escapeHtml(
              projectName(
                generation.project_id
              )
            ) +
            "</td>" +

            "<td>" +
            escapeHtml(
              generation.type ||
                generation.action ||
                generation.generation_type ||
                "-"
            ) +
            "</td>" +

            "<td>" +
            escapeHtml(
              generation.status ||
                "-"
            ) +
            "</td>" +

            "<td>" +
            escapeHtml(
              formatDate(
                generation.created_at
              )
            ) +
            "</td>" +

            "</tr>"
        )
        .join("");
  }

  /* =========================================================
     TABS
  ========================================================= */

  function setupTabs() {
    document
      .querySelectorAll(
        ".tab-btn"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              const target =
                button.dataset
                  .tab;

              document
                .querySelectorAll(
                  ".tab-btn"
                )
                .forEach(
                  (item) => {
                    item.classList.toggle(
                      "active",
                      item ===
                        button
                    );
                  }
                );

              document
                .querySelectorAll(
                  ".dashboard-panel"
                )
                .forEach(
                  (panel) => {
                    panel.style.display =
                      panel.id ===
                      target
                        ? "block"
                        : "none";
                  }
                );
            }
          );
        }
      );
  }

  /* =========================================================
     EVENTS
  ========================================================= */

  function setupEvents() {
    $("userSearch")?.addEventListener(
      "input",
      renderUsers
    );

    $("projectSearch")?.addEventListener(
      "input",
      renderProjects
    );

    /* =========================
       USERS TABLE
    ========================= */

    $("usersTableBody")
      ?.addEventListener(
        "click",
        async (event) => {
          const button =
            event.target.closest(
              "button[data-action]"
            );

          if (!button) {
            return;
          }

          try {
            const action =
              button.dataset
                .action;

            const id =
              button.dataset
                .id;

            if (
              action ===
              "edit-user"
            ) {
              openEditUser(id);
            }

            else if (
              action ===
              "block-user"
            ) {
              await setUserStatus(
                id,
                "blocked"
              );
            }

            else if (
              action ===
              "activate-user"
            ) {
              await setUserStatus(
                id,
                "active"
              );
            }
          } catch (
            err
          ) {
            alert(
              err?.message ||
              "Action failed."
            );
          }
        }
      );

    /* =========================
       UPGRADE REQUEST TABLE
    ========================= */

    $("requestsTableBody")
      ?.addEventListener(
        "click",
        (event) => {
          const button =
            event.target.closest(
              "button[data-action='review-request']"
            );

          if (button) {
            openRequest(
              button.dataset.id
            );
          }
        }
      );

    /* =========================
       SAVE USER
    ========================= */

    $("saveEditUser")
      ?.addEventListener(
        "click",
        async () => {
          try {
            await saveUser();
          } catch (
            err
          ) {
            alert(
              err?.message ||
              "Unable to save user."
            );
          }
        }
      );

    $("cancelEditUser")
      ?.addEventListener(
        "click",
        closeEditUser
      );

    $("closeEditUser")
      ?.addEventListener(
        "click",
        closeEditUser
      );

    /* =========================
       APPROVE
    ========================= */

    $("approveRequest")
      ?.addEventListener(
        "click",
        async () => {
          try {
            if (
              !reviewingRequestId
            ) {
              throw new Error(
                "No upgrade request selected."
              );
            }

            const request =
              requests.find(
                (item) =>
                  item.id ===
                  reviewingRequestId
              );

            if (!request) {
              throw new Error(
                "Upgrade request not found."
              );
            }

            const approvedLimit =
              getApprovedLimit(
                request
              );

            if (
              !Number.isFinite(
                approvedLimit
              ) ||
              approvedLimit <
                1
            ) {
              alert(
                "Please enter a valid project limit."
              );
              return;
            }

            const confirmed =
              confirm(
                "Approve this upgrade?\n\n" +
                "Client: " +
                userName(
                  request.user_id
                ) +
                "\n" +
                "New project limit: " +
                approvedLimit
              );

            if (!confirmed) {
              return;
            }

            const button =
              $("approveRequest");

            if (button) {
              button.disabled =
                true;

              button.dataset
                .originalText =
                button.textContent;

              button.textContent =
                "Approving...";
            }

            await updateRequest(
              "approved"
            );

          } catch (
            err
          ) {
            console.error(
              "Approve request failed:",
              err
            );

            alert(
              err?.message ||
              "Unable to approve request."
            );

          } finally {
            const button =
              $("approveRequest");

            if (button) {
              button.disabled =
                false;

              button.textContent =
                button.dataset
                  .originalText ||
                "Approve";
            }
          }
        }
      );

    /* =========================
       REJECT
    ========================= */

    $("rejectRequest")
      ?.addEventListener(
        "click",
        async () => {
          try {
            const confirmed =
              confirm(
                "Reject this upgrade request?"
              );

            if (!confirmed) {
              return;
            }

            await updateRequest(
              "rejected"
            );

          } catch (
            err
          ) {
            alert(
              err?.message ||
              "Unable to reject request."
            );
          }
        }
      );

    $("closeRequestModal")
      ?.addEventListener(
        "click",
        closeRequest
      );

    /* =========================
       MODAL CLOSE
    ========================= */

    $("editUserModal")
      ?.addEventListener(
        "click",
        (event) => {
          if (
            event.target ===
            $("editUserModal")
          ) {
            closeEditUser();
          }
        }
      );

    $("requestModal")
      ?.addEventListener(
        "click",
        (event) => {
          if (
            event.target ===
            $("requestModal")
          ) {
            closeRequest();
          }
        }
      );

    /* =========================
       LOGOUT
    ========================= */

    $("logoutBtn")
      ?.addEventListener(
        "click",
        async () => {
          await client.auth.signOut();

          window.location.reload();
        }
      );
  }

  /* =========================================================
     DASHBOARD
  ========================================================= */

  async function loadDashboard(
    user
  ) {
    const profile =
      await verifyAdmin(
        user
      );

    currentUser =
      user;

    if (loginView) {
      loginView.style.display =
        "none";
    }

    if (adminView) {
      adminView.style.display =
        "block";
    }

    if ($("adminEmail")) {
      $("adminEmail").textContent =
        user.email ||
        profile.full_name ||
        "Admin";
    }

    await loadAllData();
  }

  /* =========================================================
     LOGIN
  ========================================================= */

  $("loginForm")
    ?.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        clearError();

        if (loginBtn) {
          loginBtn.disabled =
            true;

          loginBtn.textContent =
            "Checking...";
        }

        try {
          const email =
            $("email")
              ?.value
              .trim() ||
            "";

          const password =
            $("password")
              ?.value ||
            "";

          if (
            !email ||
            !password
          ) {
            throw new Error(
              "Please enter email and password."
            );
          }

          const {
            data,
            error
          } =
            await client.auth.signInWithPassword(
              {
                email,
                password
              }
            );

          if (error) {
            throw error;
          }

          await loadDashboard(
            data.user
          );

        } catch (
          err
        ) {
          await client.auth.signOut();

          showError(
            err?.message ||
            "Admin login failed."
          );

        } finally {
          if (loginBtn) {
            loginBtn.disabled =
              false;

            loginBtn.textContent =
              "Admin Login";
          }
        }
      }
    );

  /* =========================================================
     START
  ========================================================= */

  setupTabs();
  setupEvents();

  (async () => {
    try {
      const {
        data
      } =
        await client.auth.getSession();

      if (
        data?.session?.user
      ) {
        await loadDashboard(
          data.session.user
        );
      }

    } catch (
      err
    ) {
      console.error(
        "Admin session check failed:",
        err
      );

      await client.auth.signOut();
    }
  })();

})();
