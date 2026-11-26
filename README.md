# RWE Delivery Survey

Call centre form for the Meesho and doorstep delivery survey, in the RWE call form design.

- `index.html` is the page for callers. It lists all RWEs and villages, and saves each call.
- `admin.html` is the page for team leads. They sign in with Google to see the call tracker, survey results and the CSV download.
- `rwe-data.json` holds the RWE list (19,248 RWEs, 11 districts) and the 827 villages. `logo.png` is the Frontier Markets logo.

## Set up (about 15 minutes)

### 1. Firebase
Open the Firebase console for the project in `config.js` (currently `rwe-stocksurvey`).

1. Build > Authentication > Sign-in method: turn on **Anonymous** and **Google**.
2. Authentication > Settings > Authorized domains: add `YOUR-GITHUB-USERNAME.github.io`.
3. Build > Firestore Database > Rules: add the blocks from `firestore.rules` inside your existing
   `match /databases/{database}/documents { ... }`. Put the team leads' Google emails in `isLead()`. Press **Publish**.

To use a new Firebase project instead, create a web app in it, then paste its config into `config.js`.

### 2. GitHub
1. Create a repository and upload every file in this folder, including `.nojekyll`.
2. Settings > Pages > Build and deployment: Source **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. After a minute the site is at `https://YOUR-GITHUB-USERNAME.github.io/REPO-NAME/`.
   Callers use that address. Team leads use `.../admin.html`.

## Notes
- Firestore collections used: `dds_calls` (one document per call) and `dds_status` (small status documents that drive the call list).
- Callers cannot read the call log. Only the listed team lead emails can.
- Deleting a wrong call: delete it in the Firebase console. The call list counts stay as they were.
- Anything on GitHub Pages is public to anyone with the address. That includes `rwe-data.json` (RWE IDs, first names and villages; no phone numbers).
