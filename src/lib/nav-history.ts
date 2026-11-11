/**
 * Whether this tab has moved between Pote pages since it was loaded, so a
 * "back" button can simply go back (keeping the list's filters and scroll)
 * instead of opening a fresh page. Client-side navigations don't update
 * document.referrer, hence this counter; a full reload starts it again.
 */
let firstPath: string | null = null;
let moved = false;

export function notePath(path: string) {
  if (firstPath === null) firstPath = path;
  else if (path !== firstPath) moved = true;
}

export function hasInAppHistory() {
  if (moved) return true;
  try {
    return !!document.referrer && new URL(document.referrer).origin === window.location.origin && window.history.length > 1;
  } catch {
    return false;
  }
}
