import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://indiaeducat482-collab.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required." }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Login required." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (!supabaseUrl || !supabaseAnonKey) return json({ error: "Supabase environment is not configured." }, 500);
  if (!openaiKey) return json({ error: "OPENAI_API_KEY is not configured in Edge Function Secrets." }, 500);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ error: "Invalid or expired login session." }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  const prompt = String(body.prompt ?? "").trim();
  const projectName = String(body.projectName ?? "").trim();
  const frontend = String(body.frontend ?? "html");
  const backend = String(body.backend ?? "supabase");

  if (!prompt) return json({ error: "Project description is required." }, 400);
  if (prompt.length > 12000) return json({ error: "Project description is too long." }, 400);
  if (!["html", "react", "nextjs"].includes(frontend)) return json({ error: "Invalid frontend." }, 400);
  if (!["supabase", "firebase", "github"].includes(backend)) return json({ error: "Invalid backend." }, 400);

  // Ensure a profile exists for users created before the profile flow was added.
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, status, plan, project_limit, github_file_limit")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    const { data: createdProfile, error: createProfileError } = await supabase
      .from("profiles")
      .insert({ id: user.id, full_name: user.email?.split("@")[0] ?? "User" })
      .select("id, status, plan, project_limit, github_file_limit")
      .single();
    if (createProfileError || !createdProfile) {
      return json({ error: "User profile is not ready. Please login again." }, 403);
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, status, plan, project_limit, github_file_limit")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) return json({ error: "User profile not found." }, 403);
  if (profile.status !== "active") return json({ error: "Your account is blocked." }, 403);

  const projectLimit = Number(profile.project_limit ?? 5);
  const githubFileLimit = Number(profile.github_file_limit ?? 2);

  const { count: projectCount, error: projectCountError } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (projectCountError) return json({ error: projectCountError.message }, 500);

  if ((projectCount ?? 0) >= projectLimit) {
    return json({
      upgradeRequired: true,
      code: "PROJECT_LIMIT",
      message: `Your project limit (${projectLimit}) has been reached.`,
    }, 402);
  }

  const { count: generatedFileCount, error: fileCountError } = await supabase
    .from("project_files")
    .select("id", { count: "exact", head: true })
    .eq("generated_by", user.id);
  if (fileCountError) return json({ error: fileCountError.message }, 500);

  if ((generatedFileCount ?? 0) >= githubFileLimit) {
    return json({
      upgradeRequired: true,
      code: "GITHUB_FILE_LIMIT",
      message: `Your generated-file limit (${githubFileLimit}) has been reached.`,
    }, 402);
  }

  const model = Deno.env.get("OPENAI_MODEL") || "gpt-5.6-luna";

  const { data: generation, error: generationError } = await supabase
    .from("generations")
    .insert({
      user_id: user.id,
      prompt,
      model,
      provider: "openai",
      status: "processing",
    })
    .select()
    .single();

  if (generationError || !generation) return json({ error: generationError?.message ?? "Could not create generation." }, 500);

  try {
    const systemPrompt = `You are BuildPilot AI, a software architect and project generator.
Return ONLY valid JSON. Do not use Markdown or code fences.

Return exactly this structure:
{
  "projectName":"string",
  "summary":"string",
  "stack":{"frontend":"string","backend":"string"},
  "features":["string"],
  "pages":[{"path":"string","purpose":"string"}],
  "database":[{"table":"string","columns":["string"]}],
  "auth":["string"],
  "files":[{"path":"string","purpose":"string","content":"string"}],
  "setupSteps":["string"],
  "deploymentSteps":["string"],
  "securityNotes":["string"]
}

Selected frontend: ${frontend}
Selected backend: ${backend}
User request: ${prompt}`;

    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: systemPrompt,
      }),
    });

    const ai = await aiResponse.json();
    if (!aiResponse.ok) {
      const detail = ai?.error?.message || `OpenAI returned HTTP ${aiResponse.status}.`;
      throw new Error(detail);
    }

    const output = String(
      ai?.output_text ??
      ai?.output?.flatMap((item: any) => item?.content ?? [])
        ?.map((part: any) => part?.text ?? "")
        ?.join("") ?? ""
    ).trim();

    if (!output) throw new Error("OpenAI returned an empty response.");

    let plan: any;
    try {
      plan = JSON.parse(output);
    } catch {
      throw new Error("OpenAI returned invalid JSON. Please try again.");
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: projectName || plan.projectName || "BuildPilot Project",
        description: plan.summary || null,
        frontend,
        backend,
        status: "completed",
        project_plan: plan,
      })
      .select()
      .single();

    if (projectError || !project) throw new Error(projectError?.message ?? "Could not save project.");

    const generatedFiles = Array.isArray(plan.files) ? plan.files : [];
    const remainingFileSlots = Math.max(0, githubFileLimit - Number(generatedFileCount ?? 0));
    const filesToSave = generatedFiles
      .filter((f: any) => f?.path && typeof f?.content === "string")
      .slice(0, Math.min(remainingFileSlots, 2))
      .map((f: any) => ({
        project_id: project.id,
        file_path: String(f.path).slice(0, 500),
        file_content: String(f.content).slice(0, 100000),
        language: String(f.path).split(".").pop() || null,
        generated_by: user.id,
      }));

    if (filesToSave.length) {
      const { error: filesError } = await supabase.from("project_files").insert(filesToSave);
      if (filesError) throw new Error(filesError.message);
    }

    await supabase.from("generations").update({
      project_id: project.id,
      status: "completed",
      result: plan,
      completed_at: new Date().toISOString(),
    }).eq("id", generation.id);

    return json({
      success: true,
      project,
      generationId: generation.id,
      plan,
      savedFileCount: filesToSave.length,
      limits: { projectLimit, githubFileLimit },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    await supabase.from("generations").update({ status: "failed", error_message: message }).eq("id", generation.id);
    return json({ error: message, generationId: generation.id }, 500);
  }
});
