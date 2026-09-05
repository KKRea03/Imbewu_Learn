// js/role.js
//
// Central place for "who is this, and what are they allowed to see".
// The role is ALWAYS re-fetched from Supabase (never trusted from
// localStorage/sessionStorage), so a tampered client value can't grant
// access to anything.

const DASHBOARD_BY_ROLE = {
  learner: `${appUrl("learner/dashboard.html")}`,
  educator: `${appUrl("educator/dashboard.html")}`,
  knowledge_keeper: `${appUrl("knowledge-keeper/dashboard.html")}`,
};

/**
 * Guards a page: requires a signed-in user, and optionally a specific
 * role. Redirects appropriately otherwise. Returns { user, profile }
 * on success so the calling page can render real data immediately.
 */
async function requireAuth({ role: requiredRole = null } = {}) {
  const user = await getCurrentUser();

  if (!user) {
    window.location.href = appUrl("login.html");
    return null;
  }

  const profile = await getOrCreateProfile(user);

  if (!profile) {
    showFatalError(
      "We couldn't load your profile. Please try signing in again, or contact support if this keeps happening."
    );
    return null;
  }

  if (requiredRole && profile.role !== requiredRole) {
    // Don't redirect-loop: send them to where they actually belong.
    const target = DASHBOARD_BY_ROLE[profile.role] || appUrl("index.html");
    window.location.href = target;
    return null;
  }

  return { user, profile };
}

function redirectToOwnDashboard(role) {
  window.location.href = DASHBOARD_BY_ROLE[role] || appUrl("index.html");
}

function showFatalError(message) {
  const container = document.createElement("div");
  container.className = "admin-denied";
  container.innerHTML = `<h1>Something went wrong</h1><p>${escapeHtml(message)}</p>`;
  document.body.innerHTML = "";
  document.body.appendChild(container);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Renders the role-appropriate nav links into any element with
 * data-role-nav, and wires up the logout button (data-logout-btn).
 * Call after requireAuth() resolves so profile.role is known.
 */
function renderRoleNav(profile) {
  const navLinksByRole = {
    learner: [
      { href: `${appUrl("learner/dashboard.html")}`, label: "Home" },
      { href: appUrl("learner/lessons.html"), label: "Lessons" },
      { href: appUrl("learner/quiz.html"), label: "Quizzes" },
      { href: appUrl("learner/progress.html"), label: "Progress" },
      { href: appUrl("educator/share.html"), label: "Share Knowledge" },
      { href: appUrl("profile.html"), label: "Profile" },
    ],
    educator: [
      { href: `${appUrl("educator/dashboard.html")}`, label: "Home" },
      { href: appUrl("educator/contributions.html"), label: "My Contributions" },
      { href: appUrl("educator/share.html"), label: "Share Knowledge" },
      { href: appUrl("educator/record.html"), label: "My Recordings" },
      { href: `${appUrl("learner/dashboard.html")}`, label: "Learning" },
      { href: appUrl("profile.html"), label: "Profile" },
    ],
    knowledge_keeper: [
      { href: `${appUrl("knowledge-keeper/dashboard.html")}`, label: "Dashboard" },
      { href: appUrl("knowledge-keeper/review.html"), label: "Pending Reviews" },
      { href: appUrl("knowledge-keeper/approved.html"), label: "Approved Knowledge" },
      { href: appUrl("knowledge-keeper/rejected.html"), label: "Rejected Knowledge" },
      { href: appUrl("profile.html"), label: "Profile" },
    ],
  };

  const links = navLinksByRole[profile.role] || [];
  const currentPath = window.location.pathname;

  document.querySelectorAll("[data-role-nav]").forEach((nav) => {
    nav.innerHTML = links
      .map(
        (link) =>
          `<li><a href="${link.href}" class="${currentPath === link.href ? "active" : ""}">${link.label}</a></li>`
      )
      .join("");
  });

  document.querySelectorAll("[data-logout-btn]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      signOut();
    });
  });

  document.querySelectorAll("[data-user-name]").forEach((el) => {
    el.textContent = profile.full_name || profile.email;
  });

  document.querySelectorAll("[data-user-avatar]").forEach((el) => {
    if (profile.avatar_url) el.src = profile.avatar_url;
  });
}
