# Expression atlases

Generated with the built-in ImageGen tool from each character's original poster. Exact prompts: `docs/expression-prompts.json`.

Each PNG is **1254 × 1254 RGBA**, arranged in **3 columns × 2 rows**. Cells are 418 × 627. Read left to right, top to bottom:

| Index | Yuri | Haruka | Hana |
| --- | --- | --- | --- |
| 0 | normal | normal | normal |
| 1 | loving | loving | loving |
| 2 | angry | angry | angry |
| 3 | shy | shy | shy |
| 4 | sad | sad | sad |
| 5 | delighted | thoughtful | smug |

Runtime order is defined in `public/lib/content.mjs`. The browser draws cropped cells to two canvases and crossfades them over 420 ms. A 24-pixel horizontal and 8-pixel vertical inset removes neighboring edge fragments. Source posters remain unchanged.
