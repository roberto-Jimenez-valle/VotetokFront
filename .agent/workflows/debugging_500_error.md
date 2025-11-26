---
description: Debugging and fixing the 500 Internal Server Error and Black Screen issue
---

# Debugging 500 Error & Black Screen

## Issue Description
The user reported a "500 Internal Server Error" causing a black screen on the main view (`PollMaximizedView`).
The error log indicated an issue with `GET /` returning 500.
Further investigation revealed syntax errors in `src/lib/components/PollMaximizedView.svelte` which caused the Server-Side Rendering (SSR) to fail, leading to the 500 error on the root path.

## Steps Taken

1.  **Analyzed User Feedback**:
    *   User reported 500 error on `GET /`.
    *   User provided specific syntax error messages from the Svelte compiler:
        *   `</div> attempted to close an element that was not open`
        *   `Did you forget to add a lang attribute to your style tag?` (related to escaped characters in class directives)

2.  **Fixed Syntax Errors in `PollMaximizedView.svelte`**:
    *   **Missing Opening Tag**: Restored a missing `<div ...>` tag that was accidentally removed in a previous edit.
    *   **Escaped Characters in Class Directives**: Replaced `class:bg-white\/10={...}` style directives with standard `class="..."` attribute interpolation to avoid parser errors with escaped slashes.

3.  **Investigated Backend Endpoint (`votes-by-country`)**:
    *   Reviewed `src/routes/api/polls/[id]/votes-by-country/+server.ts`.
    *   Added validation for `pollId` to return 400 if invalid (NaN).
    *   Verified the Prisma query logic for correctness.
    *   Considered optimization (using `groupBy` or raw SQL) but decided to stick with the current logic for now as it is functionally correct and the primary issue was the frontend syntax error.

4.  **Verified Related Files**:
    *   Checked `src/lib/server/prisma.ts` (correct singleton pattern).
    *   Checked `src/lib/api/client.ts` (correct API client implementation).
    *   Checked `src/lib/services/PollDataService.ts` (correct error handling).

## Conclusion
The "500 Internal Server Error" on the main page was caused by a syntax error in the Svelte component `PollMaximizedView.svelte`, which prevented the application from rendering on the server side. Fixing the syntax errors should resolve the black screen and the 500 error. The backend endpoint `votes-by-country` was also reviewed and hardened with input validation.
