import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@1.7.0";

const cors = {
  headers: {
    "Access-Control-Allow-Origin":
      "https://indiaeducat482-collab.github.io",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  },
};

const planSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    projectName: { type: "string" },
    summary: { type: "string" },

    stack: {
      type: "object",
      additionalProperties: false,
      properties: {
        frontend: { type: "string" },
        backend: { type: "string" },
      },
      required: ["frontend", "backend"],
    },

    features: {
      type: "array",
      items: { type: "string" },
    },

    pages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string" },
          purpose: { type: "string" },
        },
        required: ["path", "purpose"],
      },
    },

    database: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          table: { type: "string" },
          columns: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["table", "columns"],
      },
    },

    auth: {
      type: "array",
      items: { type: "string" },
    },

    files: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string" },
          purpose: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "purpose", "content"],
      },
    },

    setupSteps: {
      type: "array",
      items: { type: "string" },
    },

    deploymentSteps: {
      type: "array",
      items: { type: "string" },
    },

    securityNotes: {
      type: "array",
      items: { type: "string" },
    },
  },

  required: [
    "projectName",
    "summary",
    "stack",
    "features",
    "pages",
    "database",
    "auth",
    "files",
    "setupSteps",
    "deploymentSteps",
    "securityNotes",
  ],
};

function response(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: cors.headers,
  });
}

function cleanPath(path: string) {
  return path
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .slice(0, 500);
}

export default {
  fetch: withSupabase(
    {
      auth: "user",
      cors,
    },

    async (req, ctx) => {
      if (req.method === "OPTIONS") {
        return new Response("ok", {
          headers: cors.headers,
        });
      }

      if (req.method !== "POST") {
        return response(
          {
            error: "METHOD_NOT_ALLOWED",
            message: "POST required.",
          },
          405
        );
      }

      const userId = ctx.userClaims?.sub;

      if (!userId) {
        return response(
          {
            error: "LOGIN_REQUIRED",
            message: "Please login first.",
          },
          401
        );
      }

      const openaiKey = Deno.env.get("OPENAI_API_KEY");

      if (!openaiKey) {
        return response(
          {
            error: "OPENAI_KEY_MISSING",
            message:
              "OPENAI_API_KEY is missing in Edge Function Secrets.",
          },
          500
        );
      }

      let body: Record<string, unknown>;

      try {
        body = await req.json();
      } catch {
        return response(
          {
            error: "INVALID_JSON",
            message: "Invalid JSON request.",
          },
          400
        );
      }

      const prompt = String(body.prompt ?? "").trim();
      const projectName = String(body.projectName ?? "").trim();
      const frontend = String(body.frontend ?? "html");
      const backend = String(body.backend ?? "supabase");

      if (!prompt) {
        return response(
          {
            error: "PROMPT_REQUIRED",
            message: "Project description is required.",
          },
          400
        );
      }

      if (prompt.length > 12000) {
        return response(
          {
            error: "PROMPT_TOO_LONG",
            message: "Project description is too long.",
          },
          400
        );
      }

      if (!["html", "react", "nextjs"].includes(frontend)) {
        return response(
          {
            error: "INVALID_FRONTEND",
            message: "Invalid frontend.",
          },
          400
        );
      }

      if (!["supabase", "firebase", "github"].includes(backend)) {
        return response(
          {
            error: "INVALID_BACKEND",
            message: "Invalid backend.",
          },
          400
        );
      }

      // -----------------------------------------
      // PROFILE
      // -----------------------------------------

      const { data: profile, error: profileError } =
        await ctx.supabase
          .from("profiles")
          .select(
            "id, role, status, plan, project_limit, github_file_limit"
          )
          .eq("id", userId)
          .maybeSingle();

      if (profileError) {
        return response(
          {
            error: "PROFILE_SCHEMA_NOT_READY",
            message:
              "Please run the supplied SQL in Supabase SQL Editor.",
            details: profileError.message,
          },
          500
        );
      }

      if (!profile) {
        const { error: createError } =
          await ctx.supabase.from("profiles").insert({
            id: userId,
            full_name: String(
              ctx.userClaims?.email ?? "User"
            ).split("@")[0],
          });

        if (createError) {
          return response(
            {
              error: "PROFILE_CREATE_FAILED",
              message: "Could not create your profile.",
              details: createError.message,
            },
            500
          );
        }
      }

      const { data: current, error: currentError } =
        await ctx.supabase
          .from("profiles")
          .select(
            "id, role, status, plan, project_limit, github_file_limit"
          )
          .eq("id", userId)
          .single();

      if (currentError || !current) {
        return response(
          {
            error: "PROFILE_NOT_READY",
            message: "User profile is not ready.",
            details: currentError?.message,
          },
          500
        );
      }

      // -----------------------------------------
      // BLOCKED ACCOUNT CHECK
      // -----------------------------------------

      if (current.status !== "active") {
        return response(
          {
            error: "ACCOUNT_BLOCKED",
            message:
              "Your account is blocked. Please contact Admin.",
          },
          403
        );
      }

      const projectLimit = Math.max(
        1,
        Number(current.project_limit ?? 5)
      );

      const fileLimit = Math.max(
        1,
        Number(current.github_file_limit ?? 2)
      );

      // -----------------------------------------
      // PROJECT LIMIT
      // -----------------------------------------

      const {
        count: projectCount,
        error: projectCountError,
      } = await ctx.supabase
        .from("projects")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("user_id", userId);

      if (projectCountError) {
        return response(
          {
            error: "PROJECT_COUNT_FAILED",
            message: projectCountError.message,
          },
          500
        );
      }

      if ((projectCount ?? 0) >= projectLimit) {
        return response(
          {
            upgradeRequired: true,
            code: "PROJECT_LIMIT",
            message:
              `Project limit (${projectLimit}) reached. ` +
              "Please request an upgrade from Admin.",
          },
          402
        );
      }

      // -----------------------------------------
      // GENERATED FILE LIMIT
      // -----------------------------------------

      const {
        count: fileCount,
        error: fileCountError,
      } = await ctx.supabase
        .from("project_files")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("generated_by", userId);

      if (fileCountError) {
        return response(
          {
            error: "FILE_COUNT_FAILED",
            message: fileCountError.message,
          },
          500
        );
      }

      if ((fileCount ?? 0) >= fileLimit) {
        return response(
          {
            upgradeRequired: true,
            code: "GITHUB_FILE_LIMIT",
            message:
              `Generated-file limit (${fileLimit}) reached. ` +
              "Please request an upgrade from Admin.",
          },
          402
        );
      }

      // -----------------------------------------
      // GENERATION RECORD
      // -----------------------------------------

      const model =
        Deno.env.get("OPENAI_MODEL") ||
        "gpt-5.6-luna";

      const {
        data: generation,
        error: generationError,
      } = await ctx.supabase
        .from("generations")
        .insert({
          user_id: userId,
          prompt,
          model,
          provider: "openai",
          status: "processing",
        })
        .select("id")
        .single();

      if (generationError || !generation) {
        return response(
          {
            error: "GENERATION_CREATE_FAILED",
            message:
              generationError?.message ||
              "Could not create generation record.",
          },
          500
        );
      }

      try {
        // -----------------------------------------
        // AI PROMPT
        // -----------------------------------------

        const instructions = `
You are BuildPilot AI, an expert software architect
and code generator.

Create a practical project blueprint and starter files
for the user's request.

Selected frontend: ${frontend}
Selected backend: ${backend}

Keep the project practical and beginner-friendly.

Do not generate unnecessary files.

The user has a limited generated-file allowance.

User request:
${prompt}
`;

        // -----------------------------------------
        // OPENAI RESPONSES API
        // -----------------------------------------

        const aiResponse = await fetch(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",

            headers: {
              Authorization: `Bearer ${openaiKey}`,
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              model,
              input: instructions,
              store: false,

              text: {
                format: {
                  type: "json_schema",
                  name: "buildpilot_plan",
                  strict: true,
                  schema: planSchema,
                },
              },
            }),
          }
        );

        const ai = await aiResponse.json();

        if (!aiResponse.ok) {
          const detail =
            ai?.error?.message ||
            `OpenAI returned HTTP ${aiResponse.status}.`;

          throw new Error(`OpenAI: ${detail}`);
        }

        const output =
          String(ai?.output_text || "").trim();

        if (!output) {
          throw new Error(
            "OpenAI returned an empty response."
          );
        }

        // -----------------------------------------
        // PARSE AI JSON
        // -----------------------------------------

        let plan: any;

        try {
          plan = JSON.parse(output);
        } catch {
          throw new Error(
            "OpenAI returned invalid structured JSON."
          );
        }

        const requestedFiles =
          Array.isArray(plan.files)
            ? plan.files
            : [];

        const remaining = Math.max(
          0,
          fileLimit - Number(fileCount ?? 0)
        );

        // -----------------------------------------
        // FILE LIMIT CHECK
        // -----------------------------------------

        if (requestedFiles.length > remaining) {
          await ctx.supabase
            .from("generations")
            .update({
              status: "failed",
              error_message:
                "Generated-file limit reached.",
            })
            .eq("id", generation.id);

          return response(
            {
              upgradeRequired: true,
              code: "GITHUB_FILE_LIMIT",
              message:
                `This project needs ${requestedFiles.length} ` +
                `generated files, but only ${remaining} ` +
                `file allowance remains. ` +
                "Please request an upgrade from Admin.",
            },
            402
          );
        }

        // -----------------------------------------
        // SAVE PROJECT
        // -----------------------------------------

        const {
          data: project,
          error: projectError,
        } = await ctx.supabase
          .from("projects")
          .insert({
            user_id: userId,
            name:
              projectName ||
              plan.projectName ||
              "BuildPilot Project",

            description:
              plan.summary || null,

            frontend,
            backend,

            status: "completed",

            project_plan: plan,
          })
          .select()
          .single();

        if (projectError || !project) {
          throw new Error(
            projectError?.message ||
              "Could not save project."
          );
        }

        // -----------------------------------------
        // SAVE FILES
        // -----------------------------------------

        const files = requestedFiles.map(
          (file: any) => ({
            project_id: project.id,

            file_path: cleanPath(
              String(
                file.path ||
                  "generated.txt"
              )
            ),

            file_content: String(
              file.content || ""
            ).slice(0, 100000),

            language:
              String(file.path || "")
                .split(".")
                .pop() || null,

            generated_by: userId,
          })
        );

        if (files.length > 0) {
          const { error: filesError } =
            await ctx.supabase
              .from("project_files")
              .insert(files);

          if (filesError) {
            throw new Error(
              `File save failed: ${filesError.message}`
            );
          }
        }

        // -----------------------------------------
        // GENERATION COMPLETE
        // -----------------------------------------

        await ctx.supabase
          .from("generations")
          .update({
            project_id: project.id,
            status: "completed",
            result: plan,
            completed_at:
              new Date().toISOString(),
          })
          .eq("id", generation.id);

        return response({
          success: true,

          project,

          generationId:
            generation.id,

          plan,

          savedFileCount:
            files.length,

          limits: {
            projectLimit,

            projectsUsed:
              Number(projectCount ?? 0) + 1,

            githubFileLimit:
              fileLimit,

            githubFilesUsed:
              Number(fileCount ?? 0) +
              files.length,
          },
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Generation failed.";

        await ctx.supabase
          .from("generations")
          .update({
            status: "failed",
            error_message: message,
          })
          .eq("id", generation.id);

        return response(
          {
            error: "GENERATION_FAILED",
            message,
            generationId:
              generation.id,
          },
          500
        );
      }
    }
  ),
};