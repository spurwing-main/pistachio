export async function bootModules(modules, root = document) {
  await Promise.all(
    modules.map(async (module) => {
      try {
        await module.init(root);
      } catch (error) {
        console.error(`[site] ${module.name} did not start.`, error);
      }
    }),
  );

  root.documentElement?.setAttribute("data-modules-ready", "");
}
