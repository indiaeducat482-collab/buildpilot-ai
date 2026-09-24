// BuildPilot AI public client configuration.
// NEVER put OpenAI API keys, Supabase secret/service-role keys,
// Firebase private keys, or GitHub tokens in this file.

window.BUILDPILOT_CONFIG = {
  SUPABASE_URL: "https://rvgwanamwwleunsltwcw.supabase.co",

  SUPABASE_PUBLISHABLE_KEY:
    "sb_publishable_eoG5JGessjOqztgy_2h_ig_Eqxoyl9z",

  // AI generation and project update Edge Function
  FUNCTION_NAME: "buildpilot-generate",

  // Public website reader Edge Function
  PUBLIC_FUNCTION_NAME: "public-project"
};
