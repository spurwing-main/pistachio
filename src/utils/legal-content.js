// Finsweet TOC 1.2.16 (Attributes 2.7.1) wraps each heading and subsequent
// content in a div and moves the heading's ID to it. Its destroy() leaves
// those wrappers in place. Only unwrap divs identified by actual TOC links.
export function cloneLegalBody(body, root) {
  const copy = body.cloneNode(true);
  // Runtime table controls must not enter revision/TOC content snapshots.
  for (const wrapper of copy.querySelectorAll(".legal-table-scroll")) {
    const table = wrapper.querySelector("table");
    if (table) {
      wrapper.replaceWith(table);
    }
  }
  const ids = new Set();
  for (const link of root.querySelectorAll('.page-contents a[href^="#"]')) {
    try { ids.add(decodeURIComponent(link.hash.slice(1))); } catch { /* Invalid anchor. */ }
  }
  for (const wrapper of [...copy.querySelectorAll("div[id]")].reverse()) {
    const heading = wrapper.firstElementChild;
    if (!ids.has(wrapper.id) || !heading?.matches("h2,h3,h4,h5,h6")) continue;
    heading.id ||= wrapper.id;
    wrapper.replaceWith(...wrapper.childNodes);
  }
  // CMS imports can wrap headings in anonymous divs. Finsweet only scans
  // direct children; unwrap these neutral containers, preserving styled ones.
  for (const wrapper of [...copy.querySelectorAll("div")].reverse()) {
    if (!wrapper.attributes.length && wrapper.querySelector("h2,h3,h4,h5,h6")) {
      wrapper.replaceWith(...wrapper.childNodes);
    }
  }
  return copy;
}
