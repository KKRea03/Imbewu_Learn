// js/supabase.js
//
// Single Supabase client shared across the whole app.
//
// SECURITY: only the public "anon" key belongs here. It is safe to ship
// in frontend code because every table is protected by Row Level
// Security policies (see supabase/setup.sql) — the anon key alone can
// never read or write anything the RLS policies don't allow.
// The service-role key must NEVER appear in this file or anywhere in
// the browser; it only lives in the Edge Functions' environment.

const SUPABASE_URL = "https://jswsdmqmmzhsewnqvsst.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impzd3NkbXFtbXpoc2V3bnF2c3N0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDE4OTgsImV4cCI6MjEwMjM3Nzg5OH0.iA_X8wgfEpWxmvbAM6mCuB9aFNbHmp18JKeXWCFD9yw";



// Loaded via the Supabase JS CDN script tag included on every page:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Base URL for calling Edge Functions from client code.
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

/**
 * Returns the application base path for both local hosting and GitHub Pages.
 * Examples:
 *   http://localhost:5500/              -> /
 *   https://user.github.io/imbewu-learn/ -> /imbewu-learn/
 */
function getAppBasePath() {
  const path = window.location.pathname || "/";
  const markers = ["/learner/", "/educator/", "/knowledge-keeper/"];
  for (const marker of markers) {
    const index = path.indexOf(marker);
    if (index >= 0) return path.slice(0, index + 1);
  }
  if (path.endsWith("/")) return path;
  const lastSlash = path.lastIndexOf("/");
  return lastSlash >= 0 ? path.slice(0, lastSlash + 1) : "/";
}

function appUrl(path) {
  return `${getAppBasePath()}${String(path).replace(/^\/+/, "")}`;
}


/**
 * Calls a Supabase Edge Function with the current user's access token,
 * so the function can verify identity and role server-side.
 */
async function callEdgeFunction(functionName, payload) {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    throw new Error("You must be signed in to do that.");
  }

  const response = await fetch(`${FUNCTIONS_URL}/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || "Something went wrong. Please try again.");
  }

  return result;
}
