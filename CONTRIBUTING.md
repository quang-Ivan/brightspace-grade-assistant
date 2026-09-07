# Contributing to Brightspace Feedback & Grade Assistant

Thank you for your interest in improving Brightspace Feedback & Grade Assistant! We welcome contributions, bug reports, and pull requests from instructors, teaching assistants, and developers.

---

## 🔒 Strict FERPA & Privacy Rule

**CRITICAL REQUIREMENT**:
Under the Family Educational Rights and Privacy Act (FERPA) and institutional data privacy regulations, **never submit code, test cases, issues, screenshots, or sample data containing real student names, emails, Student IDs, or academic grades**.
- Always sanitize examples using fictional names (e.g., `Alice Smith`, `Bob Jones`).
- Any pull request containing real student Personally Identifiable Information (PII) will be immediately closed and scrubbed from git history.

---

## 🛠️ Development & Testing

1. **Prerequisites**:
   - A modern web browser (Google Chrome, Firefox, Edge, Safari, or Brave).
   - A userscript manager extension: [Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/).
   - Node.js (v18+) for running syntax and lint checks.

2. **Making Changes**:
   - The userscript is written in vanilla modern JavaScript without build step dependencies to ensure maximum transparency, inspectability, and ease of auditing for security-conscious university environments.
   - Maintain the standard UserScript metadata header block (`// ==UserScript==`).
   - Do NOT introduce external CDN dependencies or remote scripts.

3. **Verifying Syntax**:
   Run:
   ```bash
   node -c brightspace_auto_feedback_injector.user.js
   ```

---

## 📝 Pull Request Guidelines

1. Fork the repository and create your feature branch:
   ```bash
   git checkout -b feature/awesome-improvement
   ```
2. Commit your changes with clear, descriptive commit messages.
3. Verify that:
   - Syntax validation passes (`node -c`).
   - Zero hardcoded student data exists.
   - Code runs smoothly on Brightspace Consistent Evaluation pages.
4. Push to your fork and submit a Pull Request.

---

## 💬 Questions & Support
Feel free to open an Issue on GitHub for feature requests, bug reports, or discussion on LMS integrations.
