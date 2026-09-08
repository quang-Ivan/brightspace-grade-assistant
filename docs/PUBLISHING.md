# Publication & Search Setup

This is the launch setup for **Brightspace (D2L) CSV Grade & Feedback Auto-Filler**. It is built primarily for teaching assistants; instructors are welcome too. The current public status is recorded below; the remaining sections explain how to maintain each channel.

## Launch status — 2026-09-08

| Channel | Verified status | Remaining work |
| --- | --- | --- |
| [GitHub](https://github.com/quang-Ivan/brightspace-grade-assistant) | Public repository on `main`; About description, homepage, and ten relevant topics configured. CI passed all 34 tests. | Normal maintenance. |
| [GitHub Pages](https://quang-ivan.github.io/brightspace-grade-assistant/) | Published from `main` / repository root. The public page and script were fetched successfully; the script matched the local source. The 28-second demo played in Chrome with English captions. | Add the assigned Greasy Fork installation URL. |
| Greasy Fork | Script, listing copy, and public demo links are ready. | The owner uploads the listing; then replace the three pending URL sections below. |
| Google Search Console | Project-scoped ownership verified with Google's HTML tag. The homepage indexing request was accepted into the priority crawl queue. | Google has not yet indexed the homepage. The submitted sitemap still reports `Couldn't fetch`, although Google's live inspection of that exact sitemap reports crawl allowed and page fetch successful; one resubmission followed that check. Sitemap processing remains unconfirmed. |

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
- The installation button leads to the actual Greasy Fork listing once it exists.
- The page works on a narrow screen, and keyboard users can reach the video, links, and FAQ.

The homepage has a descriptive title, description, canonical URL, Open Graph/X text, SoftwareApplication data, visible task-specific FAQs, and a one-page sitemap. It does not invent ratings, download counts, endorsements, or speed claims. The demo shows the real helper on an anonymized local copy of Brightspace's evaluation-page HTML with fictional data; it is not a live LMS save test.

## 3. Greasy Fork: install and update

Upload `brightspace_auto_feedback_injector.user.js` and paste [GREASY_FORK.md](GREASY_FORK.md) as the English listing description. The source metadata already supplies the product name and short description. Keep the existing namespace; keep only one installed copy if migrating from a manually installed older name.

Publish GitHub and Pages first so the listing's screenshot and demonstration links resolve. The description uses the actual demo screenshot, not invented interface artwork. Greasy Fork remains the installation channel; the linked site and repository provide the demo, help, and source transparency. Follow [Greasy Fork's code rules](https://greasyfork.org/en/help/code-rules).

After Greasy Fork assigns a listing URL:

1. Replace the three `GREASY_FORK_URL` pending sections in the [README](../README.md), [user guide](USER_GUIDE.md), and [homepage](../index.html).
2. Change the homepage's primary **Get the Script** button to **Install from Greasy Fork**, with that actual listing URL as its destination. Remove the nearby “listing coming soon” sentence. Secondary `#install` links may keep opening the installation instructions.
3. Check the listing's **Install this script** button, installed name/version, and the site-to-listing and listing-to-site links.

Do not guess the numeric script ID from the GitHub repository name. An existing placeholder is not a working installation link.

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
