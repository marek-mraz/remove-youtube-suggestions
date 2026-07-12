// RYS content script for Facebook and Instagram.
//
// Provides distraction-free redirects away from the algorithmic feeds and
// Reels, and runs the auto-revert executor so protected settings restore on
// schedule even when no YouTube tab is open.
//
// Loaded after /shared/main.js, which provides the `browser` shim,
// DEFAULT_SETTINGS, and processPendingReverts().

const FB_FRIENDS_FEED_URL = 'https://www.facebook.com/?filter=friends&sk=h_chr';
const IG_FOLLOWING_FEED_URL = 'https://www.instagram.com/?variant=following';

// Matches /reel, /reel/<id>, /reel/?s=tab, /reels, /reels/<id>, ...
const REELS_PATH_REGEX = /^\/reels?(\/|$)/i;

// True when hostname is `domain` itself or a subdomain of it — a plain
// endsWith() would also match e.g. "fakefacebook.com".
function isSocialHost(hostname, domain) {
  return hostname === domain || hostname.endsWith('.' + domain);
}

// Decide where (if anywhere) the given URL should be redirected, based on the
// current settings. Pure function so it can be unit tested. Returns the
// target URL string, or null for no redirect. The query-param checks guard
// against redirect loops: the targets themselves live on pathname "/".
function getSocialRedirect(href, settings) {
  let url;
  try { url = new URL(href); } catch (error) { return null; }
  const { hostname, pathname, searchParams } = url;

  if (isSocialHost(hostname, 'facebook.com')) {
    const alreadyThere = searchParams.get('sk') === 'h_chr';
    const onFeed = pathname === '/' && !alreadyThere;
    const onReels = REELS_PATH_REGEX.test(pathname);
    if (onFeed && settings['fb_redirect_friends'] === true) return FB_FRIENDS_FEED_URL;
    if (onReels && settings['fb_redirect_reels'] === true) return FB_FRIENDS_FEED_URL;
  }

  if (isSocialHost(hostname, 'instagram.com')) {
    const alreadyThere = searchParams.get('variant') === 'following';
    const onFeed = pathname === '/' && !alreadyThere;
    const onReels = REELS_PATH_REGEX.test(pathname);
    if (onFeed && settings['ig_redirect_following'] === true) return IG_FOLLOWING_FEED_URL;
    if (onReels && settings['ig_redirect_reels'] === true) return IG_FOLLOWING_FEED_URL;
  }

  return null;
}

// --- Runtime wiring (skipped in unit tests, which have no document) ---
if (typeof document !== 'undefined' && typeof location !== 'undefined') {

  const POLL_MS = 500;                     // SPA navigation poll
  const REVERT_INTERVAL_MS = 5_000;        // pending_reverts check
  const REDIRECT_COOLDOWN_MS = 5_000;      // guards against reload loops
  const COOLDOWN_KEY = 'rys_social_redirect_ts';

  const socialCache = {};
  let lastRevertCheck = 0;

  function applySetting(id, value) {
    socialCache[id] = value;
    browser.storage.local.set({ [id]: value });
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    Object.entries(changes).forEach(([id, { newValue }]) => {
      socialCache[id] = newValue;
    });
  });

  function checkRedirect() {
    if (socialCache['global_enable'] !== true) return;

    const target = getSocialRedirect(location.href, socialCache);
    if (!target) return;

    // Cooldown across navigations (sessionStorage survives location.replace):
    // if the site canonicalizes its URL back to "/" after our redirect lands,
    // we must not bounce it again immediately.
    const now = Date.now();
    let lastRedirect = 0;
    try { lastRedirect = Number(sessionStorage.getItem(COOLDOWN_KEY)) || 0; } catch (error) {}
    if (now - lastRedirect < REDIRECT_COOLDOWN_MS) return;
    try { sessionStorage.setItem(COOLDOWN_KEY, String(now)); } catch (error) {}

    location.replace(target);
  }

  // Execute due auto-reverts (features manually turned off > 1 minute ago).
  // Runs regardless of global_enable so a manual global off comes back too.
  function checkPendingReverts() {
    const now = Date.now();
    if (now - lastRevertCheck < REVERT_INTERVAL_MS) return;
    lastRevertCheck = now;
    browser.storage.local.get('pending_reverts', ({ pending_reverts }) => {
      const { due, remaining } = processPendingReverts(pending_reverts, applySetting);
      if (due.length) browser.storage.local.set({ pending_reverts: remaining });
    });
  }

  function tick() {
    if (document.hidden) return;
    try {
      checkPendingReverts();
      checkRedirect();
    } catch (error) {
      console.log(error);
    }
  }

  browser.storage.local.get(settings => {
    Object.assign(socialCache, DEFAULT_SETTINGS, settings || {});
    tick();
    setInterval(tick, POLL_MS);
  });
}
