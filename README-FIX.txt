BUILDPILOT UPDATE FIX

1. Replace your GitHub Pages app.js with app.js from this package.
2. Replace Supabase Edge Function buildpilot-generate/index.ts with the supplied index.ts and DEPLOY the function.
3. The important fix is that AI edits now use action=modify_project and update the CURRENT project files instead of creating a new project and leaving the starter preview visible.
4. After deploying GitHub Pages, press Ctrl+F5 once to clear the old app.js cache.
5. Public preview remains inside an iframe; it does not need to show the internal BuildPilot editor UI.
