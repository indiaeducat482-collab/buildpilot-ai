import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// =====================================================
// CORS
// =====================================================

const corsHeaders = {
  "Access-Control-Allow-Origin":
    "https://indiaeducat482-collab.github.io",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS",

  "Content-Type":
    "application/json",

  "Vary":
    "Origin",
};

// =====================================================
// RESPONSE HELPER
// =====================================================

function json(
  data: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: corsHeaders,
    }
  );
}

// =====================================================
// SUPABASE KEY HELPERS
// =====================================================

function getKeyObject(
  name: string
) {
  const raw =
    Deno.env.get(name);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getDefaultPublishableKey() {
  const keys =
    getKeyObject(
      "SUPABASE_PUBLISHABLE_KEYS"
    );

  return (
    keys?.default ||
    Deno.env.get(
      "SUPABASE_ANON_KEY"
    ) ||
    Deno.env.get(
      "SUPABASE_PUBLISHABLE_KEY"
    ) ||
    ""
  );
}

function getDefaultSecretKey() {
  const keys =
    getKeyObject(
      "SUPABASE_SECRET_KEYS"
    );

  return (
    keys?.default ||
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    ) ||
    Deno.env.get(
      "SUPABASE_SECRET_KEY"
    ) ||
    ""
  );
}

// =====================================================
// AUTHENTICATION
// =====================================================

async function authenticate(
  req: Request
) {
  const authHeader =
    req.headers.get(
      "Authorization"
    ) || "";

  if (
    !authHeader.startsWith(
      "Bearer "
    )
  ) {
    return {
      user: null,
      error:
        "Missing Authorization bearer token.",
    };
  }

  const token =
    authHeader
      .slice(7)
      .trim();

  if (!token) {
    return {
      user: null,
      error:
        "Missing access token.",
    };
  }

  const supabaseUrl =
    Deno.env.get(
      "SUPABASE_URL"
    ) || "";

  const publishableKey =
    getDefaultPublishableKey();

  if (
    !supabaseUrl ||
    !publishableKey
  ) {
    return {
      user: null,
      error:
        "Supabase publishable key configuration is missing.",
    };
  }

  const client =
    createClient(
      supabaseUrl,
      publishableKey,
      {
        auth: {
          persistSession:
            false,

          autoRefreshToken:
            false,

          detectSessionInUrl:
            false,
        },

        global: {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        },
      }
    );

  const {
    data,
    error,
  } =
    await client.auth.getUser(
      token
    );

  if (
    error ||
    !data.user
  ) {
    return {
      user: null,
      error:
        error?.message ||
        "Invalid or expired access token.",
    };
  }

  return {
    user:
      data.user,

    error:
      null,
  };
}

// =====================================================
// WAIT / RETRY HELPERS
// =====================================================

function sleep(
  milliseconds: number
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}

function getRetryDelay(
  attempt: number,
  retryAfterHeader: string | null
) {
  if (
    retryAfterHeader
  ) {
    const seconds =
      Number(
        retryAfterHeader
      );

    if (
      Number.isFinite(
        seconds
      ) &&
      seconds >= 0
    ) {
      return Math.min(
        seconds * 1000,
        60000
      );
    }

    const date =
      Date.parse(
        retryAfterHeader
      );

    if (
      !Number.isNaN(
        date
      )
    ) {
      const delay =
        date -
        Date.now();

      if (
        delay > 0
      ) {
        return Math.min(
          delay,
          60000
        );
      }
    }
  }

  const base =
    2000 *
    Math.pow(
      2,
      attempt
    );

  const jitter =
    Math.floor(
      Math.random() *
        1000
    );

  return Math.min(
    base + jitter,
    60000
  );
}

function isRetryableStatus(
  status: number
) {
  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

// =====================================================
// GEMINI ERROR MESSAGE
// =====================================================

function getGeminiErrorMessage(
  data: any,
  rawText: string,
  status: number
) {
  return (
    data?.error?.message ||
    data?.error?.details?.[0]?.message ||
    rawText ||
    `Gemini request failed with HTTP ${status}.`
  );
}

// =====================================================
// GEMINI API
// =====================================================

async function callGemini(
  prompt: string,
  schema: Record<
    string,
    unknown
  >
) {
  const apiKey =
    Deno.env.get(
      "GEMINI_API_KEY"
    ) ||
    Deno.env.get(
      "GOOGLE_API_KEY"
    );

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing. Add GEMINI_API_KEY in Supabase Edge Function Secrets."
    );
  }

  const configuredModel =
    Deno.env.get(
      "GEMINI_MODEL"
    )?.trim();

  const modelRaw =
    configuredModel &&
    configuredModel !==
      "gemini-2.5-flash"
      ? configuredModel
      : "gemini-3.6-flash";

  const model =
    modelRaw.replace(
      /^models\//,
      ""
    );

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  // IMPORTANT:
  // For generateContent, use responseMimeType + responseSchema.
  // Do NOT use responseFormat.text.mimeType here.
  const requestBody = {
    contents: [
      {
        role:
          "user",

        parts: [
          {
            text:
              prompt,
          },
        ],
      },
    ],

    generationConfig: {
      temperature:
        0.2,

      responseMimeType:
        "application/json",

      responseSchema:
        schema,
    },
  };

  const MAX_RETRIES =
    4;

  let lastError:
    Error | null =
    null;

  for (
    let attempt = 0;
    attempt <=
      MAX_RETRIES;
    attempt++
  ) {
    try {
      console.log(
        `GEMINI REQUEST attempt=${attempt + 1}/${MAX_RETRIES + 1} model=${model}`
      );

      const response =
        await fetch(
          url,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              "x-goog-api-key":
                apiKey,
            },

            body:
              JSON.stringify(
                requestBody
              ),
          }
        );

      const rawText =
        await response.text();

      let data:
        any = null;

      try {
        data =
          JSON.parse(
            rawText
          );
      } catch {
        data =
          null;
      }

      if (
        response.ok
      ) {
        const candidates =
          Array.isArray(
            data?.candidates
          )
            ? data.candidates
            : [];

        const candidate =
          candidates[0];

        const parts =
          Array.isArray(
            candidate?.content?.parts
          )
            ? candidate.content.parts
            : [];

        const text =
          parts
            .map(
              (
                part: any
              ) =>
                String(
                  part?.text ||
                    ""
                )
            )
            .join("")
            .trim();

        if (!text) {
          const finishReason =
            candidate?.finishReason ||
            candidate?.finish_reason ||
            "";

          const blockReason =
            data
              ?.promptFeedback
              ?.blockReason ||
            "";

          console.error(
            "GEMINI EMPTY RESPONSE:",
            JSON.stringify({
              finishReason,
              blockReason,
              model,
            })
          );

          throw new Error(
            blockReason
              ? `Gemini blocked the request: ${blockReason}`
              : finishReason
              ? `Gemini returned no content. Finish reason: ${finishReason}`
              : "Gemini returned an empty response."
          );
        }

        try {
          return JSON.parse(
            text
          );
        } catch {
          console.error(
            "GEMINI INVALID JSON:",
            text.slice(
              0,
              3000
            )
          );

          throw new Error(
            "Gemini returned invalid JSON."
          );
        }
      }

      const errorMessage =
        getGeminiErrorMessage(
          data,
          rawText,
          response.status
        );

      const retryable =
        isRetryableStatus(
          response.status
        );

      console.error(
        "GEMINI HTTP ERROR:",
        JSON.stringify({
          status:
            response.status,

          model,

          attempt:
            attempt + 1,

          retryable,

          message:
            errorMessage,
        })
      );

      if (
        !retryable
      ) {
        if (
          response.status ===
          400
        ) {
          throw new Error(
            `Gemini request is invalid (400): ${errorMessage}`
          );
        }

        if (
          response.status ===
          401
        ) {
          throw new Error(
            `Gemini API authentication failed (401): ${errorMessage}`
          );
        }

        if (
          response.status ===
          403
        ) {
          throw new Error(
            `Gemini API access denied (403): ${errorMessage}`
          );
        }

        if (
          response.status ===
          404
        ) {
          throw new Error(
            `Gemini model/API endpoint not found (404): ${errorMessage}`
          );
        }

        if (
          response.status ===
          402
        ) {
          throw new Error(
            `Gemini billing/credits error (402): ${errorMessage}`
          );
        }

        throw new Error(
          `Gemini HTTP ${response.status}: ${errorMessage}`
        );
      }

      if (
        attempt >=
        MAX_RETRIES
      ) {
        throw new Error(
          `Gemini service is temporarily unavailable after ${MAX_RETRIES + 1} attempts (HTTP ${response.status}). Please try again shortly.`
        );
      }

      const retryAfter =
        response.headers.get(
          "Retry-After"
        );

      const delay =
        getRetryDelay(
          attempt,
          retryAfter
        );

      console.log(
        `GEMINI RETRY: HTTP ${response.status}; waiting ${delay}ms before retry ${attempt + 2}/${MAX_RETRIES + 1}`
      );

      await sleep(
        delay
      );
    } catch (
      error
    ) {
      lastError =
        error instanceof
        Error
          ? error
          : new Error(
              String(
                error
              )
            );

      const message =
        lastError.message;

      const permanent =
        message.includes(
          "invalid JSON"
        ) ||
        message.includes(
          "blocked the request"
        ) ||
        message.includes(
          "authentication failed"
        ) ||
        message.includes(
          "access denied"
        ) ||
        message.includes(
          "model/API endpoint not found"
        ) ||
        message.includes(
          "request is invalid"
        ) ||
        message.includes(
          "billing/credits error"
        );

      if (
        permanent
      ) {
        throw lastError;
      }

      if (
        attempt >=
        MAX_RETRIES
      ) {
        throw lastError;
      }

      const delay =
        getRetryDelay(
          attempt,
          null
        );

      console.error(
        `GEMINI NETWORK/TRANSIENT ERROR. Retrying in ${delay}ms:`,
        message
      );

      await sleep(
        delay
      );
    }
  }

  throw (
    lastError ||
    new Error(
      "Gemini request failed."
    )
  );
}

// =====================================================
// MODIFY PROJECT SCHEMA
// =====================================================

const modifySchema = {
  type:
    "object",

  properties: {
    message: {
      type:
        "string",
    },

    files: {
      type:
        "array",

      items: {
        type:
          "object",

        properties: {
          path: {
            type:
              "string",
          },

          action: {
            type:
              "string",

            enum: [
              "upsert",
              "delete",
            ],
          },

          content: {
            type:
              "string",
          },
        },

        required: [
          "path",
          "action",
          "content",
        ],
      },
    },
  },

  required: [
    "message",
    "files",
  ],
};

// =====================================================
// NEW PROJECT SCHEMA
// =====================================================

const projectSchema = {
  type:
    "object",

  properties: {
    projectName: {
      type:
        "string",
    },

    summary: {
      type:
        "string",
    },

    files: {
      type:
        "array",

      items: {
        type:
          "object",

        properties: {
          path: {
            type:
              "string",
          },

          purpose: {
            type:
              "string",
          },

          content: {
            type:
              "string",
          },
        },

        required: [
          "path",
          "purpose",
          "content",
        ],
      },
    },
  },

  required: [
    "projectName",
    "summary",
    "files",
  ],
};

// =====================================================
// PATH HELPER
// =====================================================

function cleanPath(
  value: string
) {
  const normalized =
    value
      .replace(
        /\\/g,
        "/"
      )
      .replace(
        /^\/+/,
        ""
      )
      .trim();

  const parts =
    normalized
      .split("/")
      .filter(
        (
          part
        ) =>
          part &&
          part !== "." &&
          part !== ".."
      );

  return parts
    .join("/")
    .slice(
      0,
      500
    );
}

// =====================================================
// LANGUAGE HELPER
// =====================================================

function getLanguage(
  path: string
) {
  const lower =
    path.toLowerCase();

  if (
    lower.endsWith(
      ".html"
    )
  ) {
    return "html";
  }

  if (
    lower.endsWith(
      ".css"
    )
  ) {
    return "css";
  }

  if (
    lower.endsWith(
      ".js"
    )
  ) {
    return "javascript";
  }

  if (
    lower.endsWith(
      ".ts"
    )
  ) {
    return "typescript";
  }

  if (
    lower.endsWith(
      ".tsx"
    )
  ) {
    return "typescript";
  }

  if (
    lower.endsWith(
      ".jsx"
    )
  ) {
    return "javascript";
  }

  if (
    lower.endsWith(
      ".json"
    )
  ) {
    return "json";
  }

  if (
    lower.endsWith(
      ".md"
    )
  ) {
    return "markdown";
  }

  if (
    lower.endsWith(
      ".sql"
    )
  ) {
    return "sql";
  }

  if (
    lower.endsWith(
      ".py"
    )
  ) {
    return "python";
  }

  return (
    path
      .split(".")
      .pop() ||
    null
  );
}

// =====================================================
// LIMITS
// =====================================================

const MAX_PROMPT =
  12000;

const MAX_FILE =
  100000;

const MAX_FILES =
  20;

// =====================================================
// EDGE FUNCTION
// =====================================================

Deno.serve(
  async (
    req: Request
  ) => {
    if (
      req.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          status:
            200,

          headers:
            corsHeaders,
        }
      );
    }

    if (
      req.method !==
      "POST"
    ) {
      return json(
        {
          error:
            "POST_REQUIRED",

          message:
            "Only POST requests are allowed.",
        },
        405
      );
    }

    const auth =
      await authenticate(
        req
      );

    if (!auth.user) {
      console.error(
        "AUTH ERROR:",
        auth.error
      );

      return json(
        {
          error:
            "UNAUTHORIZED",

          message:
            auth.error ||
            "User authentication failed.",
        },
        401
      );
    }

    const user =
      auth.user;

    const userId =
      user.id;

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL"
      ) || "";

    const secretKey =
      getDefaultSecretKey();

    if (
      !supabaseUrl ||
      !secretKey
    ) {
      console.error(
        "SUPABASE ADMIN CONFIG ERROR"
      );

      return json(
        {
          error:
            "SERVER_CONFIG_ERROR",

          message:
            "Supabase secret key configuration is missing.",
        },
        500
      );
    }

    const admin =
      createClient(
        supabaseUrl,
        secretKey,
        {
          auth: {
            persistSession:
              false,

            autoRefreshToken:
              false,

            detectSessionInUrl:
              false,
          },
        }
      );

    let body:
      any;

    try {
      body =
        await req.json();
    } catch {
      return json(
        {
          error:
            "INVALID_JSON",

          message:
            "Request body must be valid JSON.",
        },
        400
      );
    }

    const action =
      String(
        body?.action ||
          ""
      ).trim();

    const projectId =
      String(
        body?.projectId ||
          ""
      ).trim();

    const instruction =
      String(
        body?.instruction ||
          body?.prompt ||
          ""
      ).trim();

    const projectName =
      String(
        body?.projectName ||
          ""
      ).trim();

    const frontend =
      String(
        body?.frontend ||
          "html"
      ).trim();

    const backend =
      String(
        body?.backend ||
          "supabase"
      ).trim();

    if (
      instruction.length >
      MAX_PROMPT
    ) {
      return json(
        {
          error:
            "PROMPT_TOO_LONG",

          message:
            `Prompt cannot exceed ${MAX_PROMPT} characters.`,
        },
        400
      );
    }

    let {
      data: profile,
      error:
        profileError,
    } =
      await admin
        .from(
          "profiles"
        )
        .select(
          "id,full_name,role,status,plan,project_limit,github_file_limit"
        )
        .eq(
          "id",
          userId
        )
        .maybeSingle();

    if (
      profileError
    ) {
      return json(
        {
          error:
            "PROFILE_ERROR",

          message:
            profileError.message,
        },
        500
      );
    }

    if (!profile) {
      const {
        error,
      } =
        await admin
          .from(
            "profiles"
          )
          .insert({
            id:
              userId,

            full_name:
              String(
                user.email ||
                  "User"
              ).split(
                "@"
              )[0],

            role:
              "user",

            status:
              "active",

            plan:
              "free",

            project_limit:
              5,

            github_file_limit:
              2,
          });

      if (
        error &&
        !String(
          error.message ||
            ""
        )
          .toLowerCase()
          .includes(
            "duplicate"
          )
      ) {
        return json(
          {
            error:
              "PROFILE_CREATE_FAILED",

            message:
              error.message,
          },
          500
        );
      }

      const result =
        await admin
          .from(
            "profiles"
          )
          .select(
            "id,full_name,role,status,plan,project_limit,github_file_limit"
          )
          .eq(
            "id",
            userId
          )
          .single();

      if (
        result.error ||
        !result.data
      ) {
        return json(
          {
            error:
              "PROFILE_LOAD_FAILED",

            message:
              result.error?.message ||
              "Unable to load user profile.",
          },
          500
        );
      }

      profile =
        result.data;
    }

    if (
      profile &&
      profile.status !==
        "active"
    ) {
      return json(
        {
          error:
            "ACCOUNT_BLOCKED",

          message:
            "Your account is blocked. Please contact Admin.",
        },
        403
      );
    }

    const isModify =
      action ===
        "modify_project" ||
      (
        Boolean(
          projectId
        ) &&
        Boolean(
          instruction
        )
      );

    if (
      isModify
    ) {
      if (
        !projectId
      ) {
        return json(
          {
            error:
              "PROJECT_ID_REQUIRED",

            message:
              "Project ID is required.",
          },
          400
        );
      }

      if (
        !instruction
      ) {
        return json(
          {
            error:
              "INSTRUCTION_REQUIRED",

            message:
              "AI instruction is required.",
          },
          400
        );
      }

      const {
        data: project,
        error:
          projectError,
      } =
        await admin
          .from(
            "projects"
          )
          .select("*")
          .eq(
            "id",
            projectId
          )
          .eq(
            "user_id",
            userId
          )
          .single();

      if (
        projectError ||
        !project
      ) {
        return json(
          {
            error:
              "PROJECT_NOT_FOUND",

            message:
              "Project not found or you do not have access to it.",
          },
          404
        );
      }

      const {
        data:
          currentFiles,
        error:
          filesError,
      } =
        await admin
          .from(
            "project_files"
          )
          .select(
            "id,file_path,file_content,language"
          )
          .eq(
            "project_id",
            projectId
          )
          .order(
            "file_path",
            {
              ascending:
                true,
            }
          );

      if (
        filesError
      ) {
        return json(
          {
            error:
              "FILES_LOAD_FAILED",

            message:
              filesError.message,
          },
          500
        );
      }

      const fileContext =
        (
          currentFiles ||
          []
        )
          .map(
            (
              file: any
            ) =>
              `===== ${file.file_path} =====
${String(
  file.file_content ||
    ""
).slice(
  0,
  MAX_FILE
)}
===== END ${file.file_path} =====`
          )
          .join(
            "\n\n"
          );

      const prompt =
        `You are an expert senior software developer.

Modify the existing project according to the user's request.

USER REQUEST:
${instruction}

PROJECT:
${project.name}

FRONTEND:
${project.frontend || frontend}

BACKEND:
${project.backend || backend}

CURRENT FILES:
${fileContext || "No files found."}

IMPORTANT RULES:

1. Preserve all existing working features.
2. Only make changes required by the user's request.
3. Do not unnecessarily rewrite unrelated files.
4. Return complete content for every file you change.
5. Use "upsert" for changed or new files.
6. Use "delete" only when the user explicitly requests deletion.
7. Never delete index.html unless explicitly requested.
8. Never return markdown code fences inside file content.
9. Keep HTML, CSS and JavaScript valid.
10. Keep the website responsive.
11. Preserve existing design unless the user requests a design change.
12. Do not add BuildPilot branding to public website pages.
13. Do not add ChatGPT branding.
14. Do not add OpenAI promotional text.
15. Do not add advertisements.
16. Do not expose API keys, passwords, tokens or secrets in frontend files.
17. Return only files that actually need to change.
18. For each changed file, return its COMPLETE final content.
19. Keep paths relative to the project root.
20. Do not create duplicate files when an existing file can be updated.

Return JSON matching the requested schema.`;

      try {
        const result =
          await callGemini(
            prompt,
            modifySchema
          );

        const changes =
          Array.isArray(
            result?.files
          )
            ? result.files
            : [];

        if (
          changes.length >
          MAX_FILES
        ) {
          throw new Error(
            `Gemini returned too many files. Maximum allowed is ${MAX_FILES}.`
          );
        }

        const changeMap =
          new Map<
            string,
            any
          >();

        for (
          const file of changes
        ) {
          const path =
            cleanPath(
              String(
                file?.path ||
                  ""
              )
            );

          if (!path) {
            continue;
          }

          changeMap.set(
            path,
            file
          );
        }

        const uniqueChanges =
          Array.from(
            changeMap.values()
          ).slice(
            0,
            MAX_FILES
          );

        const applied:
          any[] = [];

        for (
          const file of uniqueChanges
        ) {
          const path =
            cleanPath(
              String(
                file?.path ||
                  ""
              )
            );

          if (!path) {
            continue;
          }

          const fileAction =
            String(
              file?.action ||
                "upsert"
            ).toLowerCase();

          if (
            fileAction ===
            "delete"
          ) {
            if (
              path ===
              "index.html"
            ) {
              continue;
            }

            const {
              error,
            } =
              await admin
                .from(
                  "project_files"
                )
                .delete()
                .eq(
                  "project_id",
                  projectId
                )
                .eq(
                  "file_path",
                  path
                );

            if (error) {
              throw new Error(
                error.message
              );
            }

            applied.push({
              path,

              action:
                "delete",
            });

            continue;
          }

          const content =
            String(
              file?.content ||
                ""
            ).slice(
              0,
              MAX_FILE
            );

          const language =
            getLanguage(
              path
            );

          const {
            data:
              existing,
            error:
              existingError,
          } =
            await admin
              .from(
                "project_files"
              )
              .select(
                "id"
              )
              .eq(
                "project_id",
                projectId
              )
              .eq(
                "file_path",
                path
              )
              .maybeSingle();

          if (
            existingError
          ) {
            throw new Error(
              existingError.message
            );
          }

          if (
            existing
          ) {
            const {
              error,
            } =
              await admin
                .from(
                  "project_files"
                )
                .update({
                  file_content:
                    content,

                  language:
                    language,
                })
                .eq(
                  "id",
                  existing.id
                );

            if (error) {
              throw new Error(
                error.message
              );
            }
          } else {
            const {
              error,
            } =
              await admin
                .from(
                  "project_files"
                )
                .insert({
                  project_id:
                    projectId,

                  file_path:
                    path,

                  file_content:
                    content,

                  language:
                    language,

                  generated_by:
                    userId,
                });

            if (error) {
              throw new Error(
                error.message
              );
            }
          }

          applied.push({
            path,

            action:
              "upsert",
          });
        }

        const {
          error:
            updateError,
        } =
          await admin
            .from(
              "projects"
            )
            .update({
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              projectId
            )
            .eq(
              "user_id",
              userId
            );

        if (
          updateError
        ) {
          console.error(
            "PROJECT TIMESTAMP ERROR:",
            updateError.message
          );
        }

        return json({
          success:
            true,

          action:
            "modify_project",

          projectId:
            projectId,

          message:
            result?.message ||
            "Project updated successfully.",

          files:
            applied,

          fileCount:
            applied.length,
        });
      } catch (
        error
      ) {
        console.error(
          "GEMINI MODIFY ERROR",
          error
        );

        return json(
          {
            error:
              "GENERATION_FAILED",

            message:
              error instanceof
              Error
                ? error.message
                : "Gemini generation failed.",
          },
          500
        );
      }
    }

    if (
      !instruction
    ) {
      return json(
        {
          error:
            "PROMPT_REQUIRED",

          message:
            "Project description is required.",
        },
        400
      );
    }

    const projectLimit =
      Math.max(
        1,
        Number(
          profile?.project_limit ??
            5
        )
      );

    const {
      count:
        projectCount,
      error:
        projectCountError,
    } =
      await admin
        .from(
          "projects"
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true,
          }
        )
        .eq(
          "user_id",
          userId
        );

    if (
      projectCountError
    ) {
      return json(
        {
          error:
            "PROJECT_COUNT_FAILED",

          message:
            projectCountError.message,
        },
        500
      );
    }

    if (
      (
        projectCount ||
        0
      ) >=
      projectLimit
    ) {
      return json(
        {
          upgradeRequired:
            true,

          code:
            "PROJECT_LIMIT",

          message:
            `Project limit (${projectLimit}) reached.`,
        },
        402
      );
    }

    const prompt =
      `You are an expert senior software developer.

Create a complete, practical and working web project.

USER REQUEST:
${instruction}

PROJECT NAME:
${projectName || "New Project"}

FRONTEND:
${frontend}

BACKEND:
${backend}

IMPORTANT RULES:

1. Create a complete working project.
2. Generate complete file contents.
3. The project must be responsive.
4. Make the UI clean and professional.
5. Keep HTML, CSS and JavaScript valid.
6. Use relative file paths.
7. The main public page should normally be index.html.
8. Do not use markdown code fences inside file contents.
9. Do not add BuildPilot branding to public pages.
10. Do not add ChatGPT branding.
11. Do not add OpenAI promotional text.
12. Do not add advertisements.
13. Never expose API keys or secrets in frontend files.
14. Do not create unnecessary files.
15. Generate no more than ${MAX_FILES} files.
16. Every generated file must contain its complete final content.
17. If JavaScript is required, make sure it works with the generated HTML.
18. If CSS is required, make sure it is linked correctly.
19. The generated website should work as a standalone public website whenever possible.
20. Return JSON matching the requested schema.`;

    try {
      const result =
        await callGemini(
          prompt,
          projectSchema
        );

      const generatedFiles =
        Array.isArray(
          result?.files
        )
          ? result.files
          : [];

      if (
        generatedFiles.length ===
        0
      ) {
        throw new Error(
          "Gemini did not generate any files."
        );
      }

      const {
        data: project,
        error:
          projectError,
      } =
        await admin
          .from(
            "projects"
          )
          .insert({
            user_id:
              userId,

            name:
              projectName ||
              result?.projectName ||
              "New Project",

            description:
              result?.summary ||
              "",

            frontend:
              frontend,

            backend:
              backend,

            status:
              "completed",
          })
          .select()
          .single();

      if (
        projectError ||
        !project
      ) {
        throw new Error(
          projectError?.message ||
            "Project creation failed."
        );
      }

      const seenPaths =
        new Set<string>();

      const files =
        generatedFiles
          .slice(
            0,
            MAX_FILES
          )
          .map(
            (
              file: any
            ) => {
              const path =
                cleanPath(
                  String(
                    file?.path ||
                      ""
                  )
                );

              return {
                project_id:
                  project.id,

                file_path:
                  path,

                file_content:
                  String(
                    file?.content ||
                      ""
                  ).slice(
                    0,
                    MAX_FILE
                  ),

                language:
                  getLanguage(
                    path
                  ),

                generated_by:
                  userId,
              };
            }
          )
          .filter(
            (
              file: any
            ) => {
              if (
                !file.file_path
              ) {
                return false;
              }

              if (
                seenPaths.has(
                  file.file_path
                )
              ) {
                return false;
              }

              seenPaths.add(
                file.file_path
              );

              return true;
            }
          );

      if (
        !files.some(
          (
            file: any
          ) =>
            file.file_path ===
            "index.html"
        )
      ) {
        const fallbackIndex =
          files.find(
            (
              file: any
            ) =>
              file.file_path
                .toLowerCase()
                .endsWith(
                  ".html"
                )
          );

        if (
          fallbackIndex
        ) {
          fallbackIndex.file_path =
            "index.html";

          fallbackIndex.language =
            "html";
        }
      }

      if (
        files.length
      ) {
        const {
          error:
            fileError,
        } =
          await admin
            .from(
              "project_files"
            )
            .insert(
              files
            );

        if (
          fileError
        ) {
          await admin
            .from(
              "projects"
            )
            .delete()
            .eq(
              "id",
              project.id
            )
            .eq(
              "user_id",
              userId
            );

          throw new Error(
            fileError.message
          );
        }
      }

      return json({
        success:
          true,

        action:
          "create_project",

        project:
          project,

        plan:
          result,

        savedFileCount:
          files.length,

        message:
          "Project created successfully.",
      });
    } catch (
      error
    ) {
      console.error(
        "GEMINI CREATE ERROR",
        error
      );

      return json(
        {
          error:
            "GENERATION_FAILED",

          message:
            error instanceof
            Error
              ? error.message
              : "Gemini generation failed.",
        },
        500
      );
    }
  }
);
