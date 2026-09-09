# Publication & Search Setup

This is the launch setup for **Brightspace (D2L) CSV Grade & Feedback Auto-Filler**. It is built primarily for teaching assistants; instructors are welcome too. The current public status is recorded below; the remaining sections explain how to maintain each channel.

## Launch status — 2026-09-09

| Channel | Verified status | Remaining work |
| --- | --- | --- |
| [GitHub](https://github.com/quang-Ivan/brightspace-grade-assistant) | Public repository on `main`; About description, homepage, and ten relevant topics configured. CI runs the automated regression suite on each push. | Normal maintenance. |
| [GitHub Pages](https://quang-ivan.github.io/brightspace-grade-assistant/) | Published from `main` / repository root. The public page and script were fetched successfully; the script matched the local source. The 28-second demo played in Chrome with English captions. Installation links now point to the published Greasy Fork listing. | Normal maintenance. |
| [Greasy Fork](https://greasyfork.org/en/scripts/595051-brightspace-d2l-csv-grade-feedback-auto-filler) | Public v1.0.4 listing. A signed GitHub push updated both code and Markdown description with no reported failures; the public code matched the repository apart from generated update metadata. Admin confirmed **Webhook** mode and both source URLs. | Normal maintenance; check delivery results after releases. |
| Google Search Console | As last checked on 2026-09-08: project-scoped ownership verified with Google's HTML tag. The homepage indexing request was accepted into the priority crawl queue. | At that check, Google had not indexed the homepage. The submitted sitemap reported `Couldn't fetch`, although Google's live inspection of that exact sitemap reported crawl allowed and page fetch successful; one resubmission followed that check. Sitemap processing remains unconfirmed and was not rechecked for this link update. |

An accepted indexing request is not an indexed search result. Do not repeatedly submit the homepage to move it up the queue. The public demo demonstrates field entry with fictional data; publication of this project does not close the separate [live draft-save acceptance boundary](LOCAL_VALIDATION.md#remaining-acceptance-boundary).

## 1. GitHub: source, documentation, and feedback

Publish only this repository directory, not its parent coursework directory. Include the fictional demo assets, `.nojekyll`, and `sitemap.xml`. Do not upload dependencies, local browser output, student records, or private CSV files.

The links in this project use `quang-Ivan/brightspace-grade-assistant` on the `main` branch. If the owner, repository, or branch changes, update project links before publishing.

**Repository About description** — configured:

> A free, open-source CSV grade and personalized-feedback auto-filler for Brightspace (D2L). Built for TAs; instructors welcome. No third-party uploads.

**Website** — live:

<https://quang-Ivan.github.io/brightspace-grade-assistant/>

**Topics** — configured in the repository's About settings:

```text
brightspace d2l userscript tampermonkey violentmonkey teaching-assistants grading feedback csv lms
```

These describe the tool's actual use; they are not claims about measured keyword search volume. [GitHub's Topics documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics) explains how topics help people find related repositories.

## 2. GitHub Pages: demo and installation front door

The active setting is **Settings → Pages → Deploy from a branch → main → /(root)**. This is a static HTML/CSS site; `.nojekyll` keeps the files served directly, and no framework build is needed. See [GitHub's publishing-source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

Check the actual published page, not just the deployment status:

- The title and first paragraph describe a TA-focused CSV grade and feedback helper.
- The video poster, MP4 playback, and English captions load under the repository subpath.
- The sample CSV and user-guide links work.
- The installation button leads to the published Greasy Fork listing.
- The page works on a narrow screen, and keyboard users can reach the video, links, and FAQ.

The homepage has a descriptive title, description, canonical URL, Open Graph/X text, SoftwareApplication data, visible task-specific FAQs, and a one-page sitemap. It does not invent ratings, download counts, endorsements, or speed claims. The demo shows the real helper on an anonymized local copy of Brightspace's evaluation-page HTML with fictional data; it is not a live LMS save test.

## 3. Greasy Fork: install and update

Maintain the [existing listing, script 595051](https://greasyfork.org/en/scripts/595051-brightspace-d2l-csv-grade-feedback-auto-filler), rather than creating a new listing for each release. The source metadata supplies the product name and short description. Keep the existing namespace; keep only one installed copy if migrating from a manually installed older name.

Publish GitHub and Pages first so the listing's screenshot and demonstration links resolve. The description uses the actual demo screenshot, not invented interface artwork. Greasy Fork remains the installation channel; the linked site and repository provide the demo, help, and source transparency. Follow [Greasy Fork's code rules](https://greasyfork.org/en/help/code-rules).

The README, user guide, and homepage link directly to that listing. The homepage's primary **Install from Greasy Fork** button opens it; the secondary `#install` link opens the installation instructions.

### Configured source syncing

In the listing's **Admin → Source Syncing**:

- **Mode:** Webhook — updates are triggered by GitHub pushes, not periodic polling. The repository webhook is active, subscribes only to **push**, sends **application/json**, uses a signing secret, and keeps SSL verification enabled.
- **Script source:** [main/brightspace_auto_feedback_injector.user.js](https://raw.githubusercontent.com/quang-Ivan/brightspace-grade-assistant/main/brightspace_auto_feedback_injector.user.js).
- **Default additional info:** [main/docs/GREASY_FORK.md](https://raw.githubusercontent.com/quang-Ivan/brightspace-grade-assistant/main/docs/GREASY_FORK.md), formatted as **Markdown**. Other repository documents are not copied into the listing.

Test script changes locally before pushing to `main`, and increase `@version` for a new script release. Changes to these two source files can subsequently reach the public listing without another manual upload. After a release, compare the public installation file with the intended source; configuration alone is not proof that a new release has synchronized.

The first real push, [ebb2afe](https://github.com/quang-Ivan/brightspace-grade-assistant/commit/ebb2afe8532109938399358a1824ef0df09bf43c), changed one non-executable script comment and one user-guide sentence in the listing copy. GitHub delivery returned HTTP 200, Greasy Fork reported both updates with an empty `updated_failed` list, and the public installation file contained the new comment. The grading logic and version remained unchanged at 1.0.4. Reopening Admin confirmed **Webhook** selected and both original source URLs retained.

To check or recover a delayed update, inspect the [GitHub webhook's Recent Deliveries](https://github.com/quang-Ivan/brightspace-grade-assistant/settings/hooks/676669253) and the response body, not only its HTTP status. After resolving an error, redeliver the affected push or use **Update and sync now** in Greasy Fork Admin. Deactivate the GitHub webhook to pause notifications; use **Turn off syncing for this script** in Greasy Fork to remove the script's syncing configuration.

Keep the signing secret in Greasy Fork and the GitHub webhook settings, never in the repository. If it is regenerated, update the GitHub webhook's Secret before testing delivery again. No local scheduler is needed. See [Greasy Fork's webhook documentation](https://greasyfork.org/en/help/api).

## 4. Google: verify and request indexing after launch

1. Sign in to [Google Search Console](https://search.google.com/search-console/about).
2. Add a **URL-prefix** property for `https://quang-Ivan.github.io/brightspace-grade-assistant/`.
3. Complete the offered ownership verification. For HTML-tag verification, add the exact tag Google supplies to the homepage head and publish that change. Do not insert a made-up verification token.
4. Inspect the live homepage URL and request indexing.
5. Submit `https://quang-Ivan.github.io/brightspace-grade-assistant/sitemap.xml` in **Sitemaps**. This tiny site does not require a sitemap for discovery, but one is included for a clear submission path.
6. Once data appears, use actual search queries and clicks to refine the introduction and FAQ. Do not promise a ranking, traffic volume, or indexing deadline.

The property is scoped to the project path. A `robots.txt` inside that path would not control Google's crawling of the hostname, so none is added as a pretend indexing fix. Keep the page public and avoid a `noindex` directive when you want it indexed.

References: [Search Console common tasks](https://support.google.com/webmasters/answer/10351509?hl=en), [ownership verification](https://support.google.com/webmasters/answer/9008080?hl=en), and [Google's SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide). Google does not use the `meta keywords` tag; the page instead answers real CSV/feedback questions in readable text.

Installing or updating the tool is not authorization to publish grades. Keep student-data handling and Brightspace publication separate from publishing this open-source project.
