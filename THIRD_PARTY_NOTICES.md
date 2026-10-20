# Third-party code and dependencies

## Trace — adapted gesture geometry

Source: https://github.com/saintade/trace
Reviewed commit: 512d55c492123fa1c51f5835359082b0742fe06b
Original: src/lib/canvas-actions.ts, buildGesturePoints
Adaptation: src/gestures.ts (rectangle targeting, normalized page coordinates,
persistent Konva rendering). The upstream tldraw dependency is NOT included.
Teaching-beat structure was also informed by the upstream visual-composition workflow;
the playback, cancellation, model protocol and interface here are new implementations.

MIT License

Copyright (c) 2026 Samuel Adesuyi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Installed libraries

- PDF.js / pdfjs-dist: Apache-2.0, https://github.com/mozilla/pdf.js
- Konva: MIT, https://github.com/konvajs/konva
- Lucide icons: ISC, https://github.com/lucide-icons/lucide
- Vite: MIT, https://github.com/vitejs/vite
- TypeScript: Apache-2.0, https://github.com/microsoft/TypeScript
- Playwright (development/testing only): Apache-2.0, https://github.com/microsoft/playwright

Exact versions and integrity hashes are recorded in package-lock.json.
Original library notices remain in the installed npm packages. The release build
copies the full licenses of shipped libraries to dist/licenses/.

## Investigated, not copied into this prototype

- OpenMAIC: MIT. Its integrated classroom runtime adds substantial infrastructure;
  the first milestone instead isolates slide annotation and playback. No upstream
  OpenMAIC source is represented as incorporated code.
- PPTist: AGPL-3.0. Not incorporated.
- tldraw: separate SDK license. Not incorporated.
# perfect-freehand

Smooth freehand stroke outlines use [perfect-freehand](https://github.com/steveruizok/perfect-freehand), licensed under MIT. The installed package's full license is included in production builds at `licenses/perfect-freehand.txt`.


## Rough.js — hand-drawn classroom annotations

Source: https://github.com/rough-stuff/rough
Version: 4.6.6; MIT License, Copyright (c) 2019 Preet Shihn.
The installed generator produces seeded ellipse, line and highlighter paths rendered by Konva.
No Rough Notation or OpenMAIC source is incorporated.
Full licenses for Rough.js and its shipped geometry dependencies (hachure-fill, path-data-parser, points-on-curve, points-on-path) are copied into dist/licenses/.

MIT License

Copyright (c) 2019 Preet Shihn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
