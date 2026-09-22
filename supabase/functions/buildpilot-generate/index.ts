import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createSupabaseContext } from "npm:@supabase/server@^1";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-5.6-luna";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 500, code = "EDGE_FUNCTION_ERROR", details?: unknown) {
  return json({
    success: false,
    error: message,
    code,
    ...(details !== undefined ? { details } : {}),
  }, status);
}

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function validFrontend(value: string) {
  return ["html", "react", "nextjs"].includes(value);
}

function validBackend(value: string) {
  return ["supabase", "firebase", "github"].includes(value);
}

function normalizeProjectType(value: unknown) {
  const v = cleanString(value, "website").toLowerCase();
  if (["complete_system", "complete-system", "complete system"].includes(v)) {
    return "complete_system";
  }
  return "website";
}

const projectPlanSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    project_name: { type: "string" },
    project_type: { type: "string", enum: ["website", "complete_system"] },
    summary: { type: "string" },
    frontend: { type: "string" },
    backend: { type: "string" },
    pages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          path: { type: "string" },
          purpose: { type: "string" }
        },
        required: ["name", "path", "purpose"]
      }
    },
    modules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          description: { type: "string" }
        },
        required: ["name", "description"]
      }
    },
    database_tables: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          table_name: { type: "string" },
          purpose: { type: "string" },
          columns: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                type: { type: "string" },
                required: { type: "boolean" },
                description: { type: "string" }
              },
              required: ["name", "type", "required", "description"]
            }
          }
        },
        required: ["table_name", "purpose", "columns"]
      }
    },
    security: { type: "array", items: { type: "string" } },
    next_steps: { type: "array", items: { type: "string" } }
  },
  required: [
    "project_name", "project_type", "summary", "frontend", "backend",
    "pages", "modules", "database_tables", "security", "next_steps"
  ]
};

async function callOpenAI(apiKey: string, args: {
  projectName: string;
  prompt: string;
  frontend: string;
  backend: string;
  projectType: string;
}) {
  const systemPrompt = `
You are BuildPilot AI, an AI software architect.
Analyze the user's requirement and return a practical production-ready project plan.

Project types:
- website: website-only project. Prefer HTML/CSS/JavaScript unless React/Next.js is selected.
- complete_system: full application with authentication, database, roles, CRUD and security only when required.

Follow the user's requirement. Do not invent unnecessary features.
For Supabase, design PostgreSQL tables and security/RLS needs.
For Firebase, describe Firebase auth/data needs.
For GitHub, treat GitHub mainly as repository infrastructure.
For website projects, database_tables can be empty.
Return only the JSON required by the schema.
`;

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Project name: ${args.projectName}
Project type: ${args.projectType}
Frontend: ${args.frontend}
Backend: ${args.backend}

User requirement:
${args.prompt}`
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "buildpilot_project_plan",
          strict: true,
          schema: projectPlanSchema
        }
      }
    })
  });

  const raw = await response.text();
  let data: any;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`OpenAI returned invalid JSON. HTTP ${response.status}: ${raw.slice(0, 1000)}`);
  }

  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenAI API request failed with HTTP ${response.status}`);
  }

  return data;
}

function extractOutputText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;
  if (!Array.isArray(data?.output)) return "";

  let result = "";
  for (const item of data.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const content of item.content) {
      if (typeof content?.text === "string") result += content.text;
    }
  }
  return result;
}

function parsePlan(data: any) {
  const outputText = extractOutputText(data);
  if (!outputText) throw new Error("OpenAI returned an empty project plan.");

  try {
    return JSON.parse(outputText);
  } catch {
    throw new Error(`AI project plan was not valid JSON: ${outputText.slice(0, 1500)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Only POST requests are allowed.", 405, "METHOD_NOT_ALLOWED");
  }

  let generationId: string | null = null;

  try {
    const { data: ctx, error: authError } = await createSupabaseContext(req, {
      auth: "user"
    });

    if (authError || !ctx?.userClaims?.sub) {
      return errorResponse(
        "Authentication required. Please login again.",
        401,
        "AUTHENTICATION_REQUIRED",
        authError ? { message: authError.message } : undefined
      );
    }

    const userId = ctx.userClaims.sub;
    const supabase = ctx.supabase;
    const openAIKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAIKey) {
      return errorResponse(
        "OPENAI_API_KEY is not configured in Supabase Edge Function secrets.",
        500,
        "OPENAI_KEY_MISSING"
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Request body must contain valid JSON.", 400, "INVALID_JSON");
    }

    const prompt = cleanString(body?.prompt);
    const projectName = cleanString(body?.projectName, "BuildPilot Project");
    const frontend = cleanString(body?.frontend, "html").toLowerCase();
    const backend = cleanString(body?.backend, "supabase").toLowerCase();
    const projectType = normalizeProjectType(body?.projectType ?? body?.type);

    if (!prompt || prompt.length < 5) {
      return errorResponse("Please enter a project requirement.", 400, "INVALID_PROMPT");
    }

    if (prompt.length > 12000) {
      return errorResponse("Project requirement is too long.", 400, "PROMPT_TOO_LONG");
    }

    if (!validFrontend(frontend)) {
      return errorResponse("Invalid frontend selection.", 400, "INVALID_FRONTEND");
    }

    if (!validBackend(backend)) {
      return errorResponse("Invalid backend selection.", 400, "INVALID_BACKEND");
    }

    const { data: profileData, error: profileReadError } = await supabase
      .from("profiles")
      .select("id, full_name, role, status, plan, project_limit")
      .eq("id", userId)
      .maybeSingle();

    if (profileReadError) {
      return errorResponse(
        "Could not load your profile.",
        500,
        "PROFILE_READ_FAILED",
        profileReadError.message
      );
    }

    let profile: any = profileData;

    if (!profile) {
      const created = await supabase
        .from("profiles")
        .insert({
          id: userId,
          status: "active",
          plan: "free",
          project_limit: 5,
          github_file_limit: 2
        })
        .select("id, full_name, role, status, plan, project_limit")
        .single();

      if (created.error) {
        return errorResponse(
          "Could not create your profile.",
          500,
          "PROFILE_CREATE_FAILED",
          created.error.message
        );
      }

      profile = created.data;
    }

    if (profile.status === "blocked") {
      return errorResponse("Your account is blocked. Please contact support.", 403, "ACCOUNT_BLOCKED");
    }

    const { count: projectCount, error: countError } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) {
      return errorResponse(
        "Could not check your project limit.",
        500,
        "PROJECT_LIMIT_CHECK_FAILED",
        countError.message
      );
    }

    const limit = Number(profile.project_limit ?? 5);

    if (profile.role !== "admin" && Number(projectCount ?? 0) >= limit) {
      return errorResponse(
        `Project limit reached. Your current limit is ${limit} projects.`,
        402,
        "PROJECT_LIMIT_REACHED",
        { current: Number(projectCount ?? 0), limit, plan: profile.plan ?? "free" }
      );
    }

    const { data: projectTypeRow, error: projectTypeError } = await supabase
      .from("project_types")
      .select("id, name, code, description")
      .eq("code", projectType)
      .maybeSingle();

    if (projectTypeError) {
      return errorResponse(
        "Could not load project type.",
        500,
        "PROJECT_TYPE_READ_FAILED",
        projectTypeError.message
      );
    }

    const projectTypeId = projectTypeRow?.id ?? null;

    const generation = await supabase
      .from("generations")
      .insert({
        user_id: userId,
        prompt,
        model: OPENAI_MODEL,
        provider: "openai",
        status: "processing"
      })
      .select("id")
      .single();

    if (generation.error) {
      return errorResponse(
        "Could not create generation record.",
        500,
        "GENERATION_CREATE_FAILED",
        generation.error.message
      );
    }

    generationId = generation.data.id;

    try {
      const aiResponse = await callOpenAI(openAIKey, {
        projectName,
        prompt,
        frontend,
        backend,
        projectType
      });

      const plan = parsePlan(aiResponse);

      const projectInsert = await supabase
        .from("projects")
        .insert({
          user_id: userId,
          name: projectName,
          description: prompt,
          frontend,
          backend,
          status: "completed",
          project_type_id: projectTypeId,
          project_plan: plan
        })
        .select("id, name, description, frontend, backend, status, project_type_id, project_plan, created_at")
        .single();

      if (projectInsert.error) {
        throw new Error(`Project creation failed: ${projectInsert.error.message}`);
      }

      const project = projectInsert.data;

      const modules = Array.isArray(plan.modules) ? plan.modules : [];
      if (modules.length) {
        const result = await supabase.from("project_modules").insert(
          modules.map((m: any) => ({
            project_id: project.id,
            name: cleanString(m?.name, "Module"),
            description: cleanString(m?.description)
          }))
        );

        if (result.error) {
          throw new Error(`Module creation failed: ${result.error.message}`);
        }
      }

      const tables = Array.isArray(plan.database_tables) ? plan.database_tables : [];
      if (tables.length) {
        const result = await supabase.from("project_database_schema").insert(
          tables.map((t: any) => ({
            project_id: project.id,
            table_name: cleanString(t?.table_name, "table"),
            purpose: cleanString(t?.purpose),
            columns: Array.isArray(t?.columns) ? t.columns : []
          }))
        );

        if (result.error) {
          throw new Error(`Database schema creation failed: ${result.error.message}`);
        }
      }

      const generationUpdate = await supabase
        .from("generations")
        .update({
          status: "completed",
          result: {
            project_id: project.id,
            project_plan: plan,
            model: OPENAI_MODEL
          },
          completed_at: new Date().toISOString()
        })
        .eq("id", generationId)
        .eq("user_id", userId);

      if (generationUpdate.error) {
        throw new Error(`Generation update failed: ${generationUpdate.error.message}`);
      }

      return json({
        success: true,
        message: "Project generated successfully.",
        project,
        projectPlan: plan,
        generationId
      });
    } catch (generationError) {
      const message = generationError instanceof Error
        ? generationError.message
        : String(generationError);

      await supabase
        .from("generations")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString()
        })
        .eq("id", generationId)
        .eq("user_id", userId);

      return errorResponse(message, 500, "PROJECT_GENERATION_FAILED");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(message, 500, "UNHANDLED_EDGE_FUNCTION_ERROR");
  }
});
