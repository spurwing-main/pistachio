// Keep registration order explicit. bootModules starts the modules concurrently.
import aboutTeam from "./about-team.js";
import marquee from "./marquee.js";
import nav from "./nav.js";
import rotate from "./rotate.js";
import video from "./video.js";
import reveal from "./reveal.js";
import accordions from "./accordions.js";
import externalGraphic from "./external-graphic.js";
import statProgress from "./stat-progress.js";
import sectionNav from "./section-nav.js";
import articleContents from "./article-contents.js";
import riskStack from "./risk-stack.js";
import legalRevisions from "./legal-revisions.js";
import legalToc from "./legal-toc.js";
import legalTables from "./legal-tables.js";

export const modules = [
  nav,
  marquee,
  aboutTeam,
  rotate,
  video,
  reveal,
  accordions,
  externalGraphic,
  statProgress,
  riskStack,
  sectionNav,
  articleContents,
  legalRevisions,
  legalToc,
  legalTables,
];
