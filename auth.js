// js/auth.js
//
// Handles the ONLY sign-in path in this app: "Continue with Google"
// through Supabase Auth. There is no email/password signup — see the
// project spec, section 2.

/**
 * Kicks off Google OAuth. Supabase redirects the browser to Google,
 * then back to `${redirectTo}` with a session already established.
 */
async function signInWithGoogle(redirectTo = appUrl("index.html")) {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error) {
    throw new Error(mapAuthError(error));
  }
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error("Sign out failed:", error);
  }
  window.location.href = appUrl("index.html");
}

/**
 * Returns the current session's user, or null if signed out.
 * Also handles the "session expired" case gracefully by clearing any
 * stale state instead of throwing.
 */
async function getCurrentUser() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.warn("Session lookup failed:", error.message);
      return null;
    }
    return data?.session?.user ?? null;
  } catch (err) {
    console.error("Unexpected auth error:", err);
    return null;
  }
}

/**
 * Fetches (or lazily creates) the caller's profile row. The row is
 * normally created automatically by the `handle_new_user` database
 * trigger the moment the Google account first signs in, but this is a
 * defensive fallback in case that hasn't landed yet (e.g. a slow
 * trigger on a brand-new project, or a user created before the
 * trigger existed).
 */
async function getOrCreateProfile(user) {
  if (!user) return null;

  const { data: existing, error: fetchError } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (fetchError) {
    console.error("Could not load profile:", fetchError.message);
    return null;
  }

  if (existing) return existing;

  // Fallback creation — role is forced to "learner" by RLS regardless
  // of anything sent here (see profiles_insert_self policy).
  const { data: created, error: insertError } = await supabaseClient
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      avatar_url: user.user_metadata?.avatar_url || null,
      role: "learner",
    })
    .select()
    .single();

  if (insertError) {
    console.error("Could not create profile:", insertError.message);
    return null;
  }

  return created;
}

function mapAuthError(error) {
  const msg = (error?.message || "").toLowerCase();

  if (msg.includes("popup") || msg.includes("cancel")) {
    return "Sign-in was cancelled. Please try again when you're ready.";
  }
  if (msg.includes("network")) {
    return "We couldn't reach the authentication service. Check your connection and try again.";
  }
  if (msg.includes("provider") && msg.includes("not enabled")) {
    return "Google sign-in isn't configured yet for this project.";
  }
  return "We couldn't sign you in right now. Please try again.";
}

// Listen globally for auth changes so any open tab reacts (e.g. to a
// session expiring) without a manual refresh.
supabaseClient.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT" || event === "TOKEN_REFRESH_FAILED") {
    // Only redirect if we're on a page that requires auth; role.js's
    // requireAuth() guards handle the actual redirect, this just logs.
    console.info("Auth state changed:", event);
  }
});
