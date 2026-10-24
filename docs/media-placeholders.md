# Development media

All bundled artwork in `apps/web/public/placeholders` is original programmatic illustration. It is temporary artwork, not location photography, a supplier promise, a real traveler portrait, or a testimonial. Assisted artwork is marked `is_ai_generated` in the media library. The old branded sample photos are retained privately in `.data/legacy-media` and are no longer public assets.

| Brief slot            | Development asset                                                                    |
| --------------------- | ------------------------------------------------------------------------------------ |
| VID-01 / VID-02, home | `hero.mp4` / `hero-mobile.mp4`, plus WebM and first-frame posters                    |
| VID-03, circuit       | `monza.mp4`, plus mobile/WebM/posters                                                |
| VID-04, luxury        | `como.mp4`, plus mobile/WebM/posters; used on the luxury collection and Como journey |
| IMG-OT / IMG-EC       | `manchester` / `madrid` illustrations                                                |
| IMG-RG / IMG-RG-2     | `paris` / `paris-life` illustrations                                                 |
| IMG-WB / IMG-WB-2     | `grass` / `london-life` illustrations                                                |
| IMG-F1 / IMG-BM       | `como` / `berlin` illustrations                                                      |
| IMG-LUX-1 / IMG-PPL-1 | `alps` / `family` illustrations                                                      |
| TEX-01                | Original low-contrast tileable `paper.svg`                                           |

Images ship with AVIF/WebP variants at 480, 960, 1600 and 2560 pixels and a tiny blur preview. Landscape, portrait and family compositions cover the brief's media placements; focal-point crop previews support 16:9, 4:5 and 9:16. Video loops are silent H.264 MP4 and WebM, 1920×1080 / 1080×1920, 8–10 seconds, with cyclic camera movement and first-frame posters. They load after first paint, fade over 800 ms, provide pause/play, and stop for reduced motion or Save-Data.

Regenerate images with `pnpm exec tsx scripts/create-placeholder-media.ts`, then videos with `pnpm exec tsx scripts/create-placeholder-videos.ts` (requires ffmpeg). Development seeding registers the media and accurate file metadata. Production seeding keeps the catalog as drafts and does not install illustrative content as approved photography.

Replace these through Admin → Media library before approving final brand photography. Supply bilingual alt text, review the three crops, and choose media/poster records through the searchable editor. Real photography, final video direction, supplier properties and usage rights remain a content approval task.
