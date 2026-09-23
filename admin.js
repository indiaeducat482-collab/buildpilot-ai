(() => {
  "use strict";
  const cfg = window.BUILDPILOT_CONFIG || {};
  const url = cfg.SUPABASE_URL || "";
  const key = cfg.SUPABASE_PUBLISHABLE_KEY || "";
  if (!url || !key || !window.supabase) return;
  const client = window.supabase.createClient(url, key);
  const loginView = document.getElementById("loginView");
  const adminView = document.getElementById("adminView");
  const msg = document.getElementById("msg");
  const loginBtn = document.getElementById("loginBtn");

  const error = (m) => {
    if (msg) { msg.textContent = m; msg.style.display = "block"; }
  };

  async function verifyAdmin(user) {
    if (!user) throw new Error("Please login with your admin account.");
    const { data, error: e } = await client.from("profiles")
      .select("id,full_name,role,status").eq("id", user.id).maybeSingle();
    if (e) throw e;
    if (!data) throw new Error("Admin profile not found.");
    if (data.role !== "admin") throw new Error("This account is not an admin account.");
    if (data.status !== "active") throw new Error("Admin account is blocked.");
    return data;
  }

  async function loadDashboard(user) {
    const profile = await verifyAdmin(user);
    if (loginView) loginView.style.display = "none";
    if (adminView) adminView.style.display = "block";
    const email = document.getElementById("adminEmail");
    if (email) email.textContent = user.email || profile.full_name || "Admin";

    const [u, p] = await Promise.all([
      client.from("profiles").select("id,status"),
      client.from("projects").select("id")
    ]);
    if (u.error) throw u.error;
    if (p.error) throw p.error;
    const users = u.data || [];
    const projects = p.data || [];
    document.getElementById("users").textContent = users.length;
    document.getElementById("active").textContent = users.filter(x => x.status === "active").length;
    document.getElementById("blocked").textContent = users.filter(x => x.status === "blocked").length;
    document.getElementById("projects").textContent = projects.length;
  }

  document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (msg) msg.style.display = "none";
    if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = "Checking..."; }
    try {
      const email = document.getElementById("email")?.value.trim() || "";
      const password = document.getElementById("password")?.value || "";
      const { data, error: e } = await client.auth.signInWithPassword({ email, password });
      if (e) throw e;
      await loadDashboard(data.user);
    } catch (e) {
      await client.auth.signOut();
      error(e?.message || "Admin login failed.");
    } finally {
      if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = "Admin Login"; }
    }
  });

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await client.auth.signOut();
    location.reload();
  });

  (async () => {
    try {
      const { data } = await client.auth.getSession();
      if (data?.session?.user) await loadDashboard(data.session.user);
    } catch (e) {
      await client.auth.signOut();
    }
  })();
})();