export async function previewReady(base: string) {
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(base + '/api/healthz')).ok) return;
    } catch {
      /* Preview may still be applying migrations. */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Preview API did not become ready.');
}
