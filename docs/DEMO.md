# Guided demo and transcript

[Watch the demo](https://quang-Ivan.github.io/brightspace-grade-assistant/#demo) · [Download the MP4](../assets/demo/quick-demo.mp4) · [Example CSV](../assets/demo/reviewed-example.csv)

One reviewed CSV supplies the right score and individual feedback for each student. The **37.20-second** video shows the v1.0.5 helper importing the CSV, matching the current student, filling both native fields, then moving through different students. The teacher determines the scores and feedback; the helper handles the repeated entry.

## What you will see

| Time | On-screen instruction | Visible action or result |
| --- | --- | --- |
| 0:00–0:04.36 | Import the reviewed CSV | Load the 20-row fictional CSV. Import alone leaves the grading fields empty. |
| 0:04.36–0:07.00 | Match the current student | Compare the CSV row, native student name and helper preview. |
| 0:07.00–0:13.00 | One click fills both fields | Alice receives 9/10 and her individual feedback. |
| 0:13.00–0:19.00 | Next student. Different score and feedback. | Move to Jordan and fill 7/10 with a different comment. |
| 0:19.00–0:23.00 | Next, then fill — from the keyboard. | Use Alt+Right and Alt+F; Sam receives 10/10 and another comment. |
| 0:23.00–0:34.10 | Same CSV · Selected students shown | Show students 4, 8, 14 and 20 from the same recording. |
| 0:34.10–0:37.20 | 20 entries filled. Review before saving. | End with the explicit status: Nothing saved or published. |

| Student | Score / 10 | Individual feedback |
| --- | ---: | --- |
| Alice Example | 9 | Clear reasoning. Add units to the final answer. |
| Jordan Example | 7 | Good setup. Show the intermediate calculation. |
| Sam Example | 10 | Complete reasoning and correctly labelled results. |
| Taylor Example | 8 | Clear diagram. State the assumption about flow. |
| Parker Example | 10 | Complete solution with well-supported conclusions. |
| Charlie Example | 9 | Strong work. Summarize the result in one sentence. |

The complete fictional data is in the [20-row example CSV](../assets/demo/reviewed-example.csv). The recording processes all 20 entries and the edit clearly labels the selected students. Retained clips use their captured speed; **the movie duration is not a whole-class speed benchmark**. Counts describe local field fills, not saved evaluations.

## Recording and privacy

The helper runs on an offline copy exported from the actual Brightspace evaluation page. Native layout, components, Shadow DOM, styles, grade control and feedback editor are retained. Identifiers, names, course labels, submissions, scores and comments are replaced or removed at source before recording. Every visible student and grading entry is fictional. No large masks, blur blocks or imitation LMS are used.

The production userscript performs CSV parsing, student matching and entry into both fields. The local adapter provides fictional navigation and bridges the exported native controls. The recording uses an isolated loopback browser; it does not access a live LMS, save drafts or publish evaluations. Private source exports, replacement maps, browser output and local recording files are not part of this public repository. The reproducible source package is retained separately by the maintainer.

## Media and verification

The MP4 is **1920×1080, 30 fps, H.264/yuv420p**, with English instructions and result captions burned into the pixels and **zero audio streams**. An optional WebVTT transcript is provided for the player; it is off by default to avoid duplicating the burned captions.

The full page remains visible for 91.9% of the video. One three-second wider detail lets the viewer read the first result. Five numbered steps and visible mouse, click and keyboard cues follow the purpose, action, result and next step. The workflow takes inspiration from [Guidde's editing approach](https://help.guidde.com/en/articles/9790578-editing-guidde-videos) and [captured clips](https://help.guidde.com/en/articles/9571994-insert-captured-clip); the Guidde service was not used.

All 20 local score/feedback readbacks passed. The final file passed full decoding, privacy and caption checks, adjacent-frame inspection at student transitions, and complete playback in the actual 960×540 webpage player with optional captions off. The final MP4 also received a separate ChatGPT Pro media review after the cut and subtitle corrections; that review verified the file hash, decoded all 1,116 frames and found no required fixes. No video bytes changed after that review. The review used decoding and frame inspection, not an independent first-time human viewing test; that comprehension test remains unperformed.

Final MP4 SHA-256: `11b1381541649b78d41de6c2477f263c5212882e93dbd101229048bd23b90773`.

Software regression results and the separate real draft-save acceptance boundary are documented in [Testing & Current Scope](LOCAL_VALIDATION.md).
