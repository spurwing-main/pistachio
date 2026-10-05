/**
 * Shared DOM utilities used across modules.
 */

/** querySelectorAll as an array. */
export function qsa(root, selector) {
  return Array.from(root.querySelectorAll(selector));
}

/**
 * The closest ancestor of `target` matching `selector`, only if it stays within `root`.
 * Lets a delegated listener on a root find the control that was actually activated.
 */
export function closestWithin(root, target, selector) {
  if (!(target instanceof Element)) return null;
  const element = target.closest(selector);
  return element && root.contains(element) ? element : null;
}
