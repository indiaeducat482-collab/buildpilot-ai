async function generate() {
  const prompt = document.getElementById("prompt")?.value?.trim() || "";
  const projectName =
    document.getElementById("projectName")?.value?.trim() ||
    "BuildPilot Project";
  const frontend =
    document.getElementById("frontend")?.value || "html";
  const backend =
    document.getElementById("backend")?.value || "supabase";
  const projectType =
    document.getElementById("projectType")?.value || "website";

  if (!prompt) {
    alert("Please enter your project requirement.");
    document.getElementById("prompt")?.focus();
    return;
  }

  if (!window.BUILDPILOT_CONFIG?.SUPABASE_URL ||
      !window.BUILDPILOT_CONFIG?.SUPABASE_PUBLISHABLE_KEY) {
    alert("Supabase configuration is missing. Check config.js.");
    console.error("BUILDPILOT_CONFIG:", window.BUILDPILOT_CONFIG);
    return;
  }

  if (typeof client === "undefined" || !client?.auth) {
    alert("Supabase client is not initialized.");
    return;
  }

  const baseUrl =
    window.BUILDPILOT_CONFIG.SUPABASE_URL.replace(/\/$/, "");
  const functionUrl =
    `${baseUrl}/functions/v1/buildpilot-generate`;

  const publishableKey =
    window.BUILDPILOT_CONFIG.SUPABASE_PUBLISHABLE_KEY;

  const button =
    document.getElementById("generateBtn") ||
    document.querySelector('[data-action="generate"]');

  const oldText = button?.textContent || "Generate";

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Building...";
    }

    let { data, error } =
      await client.auth.getSession();

    if (error) {
      console.error("getSession error:", error);
      throw new Error("Unable to read your login session.");
    }

    let session = data?.session || null;

    if (!session?.access_token) {
      const refresh =
        await client.auth.refreshSession();

      if (
        refresh.error ||
        !refresh.data?.session?.access_token
      ) {
        await client.auth.signOut();
        location.hash = "#login";
        throw new Error(
          "Your login session has expired. Please login again."
        );
      }

      session = refresh.data.session;
    }

    const accessToken = session.access_token;

    console.log("BuildPilot user:", session.user?.id);
    console.log("JWT available:", !!accessToken);

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "apikey": publishableKey
      },
      body: JSON.stringify({
        prompt,
        projectName,
        frontend,
        backend,
        projectType
      })
    });

    const raw = await response.text();

    let result;
    try {
      result = raw ? JSON.parse(raw) : {};
    } catch {
      result = { error: raw };
    }

    console.log("BuildPilot HTTP status:", response.status);
    console.log("BuildPilot response:", result);

    if (response.status === 401) {
      const refresh =
        await client.auth.refreshSession();

      if (
        !refresh.error &&
        refresh.data?.session?.access_token
      ) {
        throw new Error(
          "Session refreshed. Please click Generate again."
        );
      }

      await client.auth.signOut();
      location.hash = "#login";
      throw new Error(
        "Authentication failed. Please login again."
      );
    }

    if (!response.ok) {
      throw new Error(
        result?.error ||
        result?.message ||
        `Edge Function returned HTTP ${response.status}`
      );
    }

    if (result?.success === false) {
      throw new Error(
        result.error ||
        "Project generation failed."
      );
    }

    if (typeof showProjectResult === "function") {
      showProjectResult(result);
    } else if (typeof renderProjectResult === "function") {
      renderProjectResult(result);
    } else if (typeof showBuildResult === "function") {
      showBuildResult(result);
    } else {
      console.log("BuildPilot result:", result);
      alert("Project generated successfully!");
    }

    return result;
  } catch (error) {
    console.error("BuildPilot generate() error:", error);

    alert(
      `BuildPilot Error:\n\n${
        error?.message || error
      }`
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = oldText;
    }
  }
}
