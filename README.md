# ProtAIomics PCDP (MSCA Doctoral Network)

Personal Career Development Plan web application for **ProtAIomics**, Grant Agreement **101227009**.

This is an independent copy of the EvoMG-DN PCDP v4 tool. The ten steps, question structure, Word/JSON package, six-month review calculator and optional email reminders are retained. Branding and project identifiers have been changed for ProtAIomics.

## ProtAIomics colors

The site uses the official ProtAIomics logo palette: purple, green, light lavender and mint. The **only** appearance file changed in this revision is `public/styles.css`. All PCDP questions, exports and reminder logic remain unchanged. If you already uploaded the previous version to GitHub, you only need to replace `public/styles.css` and commit the change. Cloudflare Pages should then deploy the new stylesheet automatically.

## 1. What to upload to GitHub

In your new **PCDP-ProtAIomics** repository, upload the **contents** of this folder, not the ZIP file itself. The root of the GitHub repository should contain:

```text
PCDP-ProtAIomics/
  public/
    index.html
    app.js
    styles.css
    reminders.js
    reminders-config.js
    review-calendar.js
    researchcomp.js
    portal-reporting.js
    assets/
      protaiomics-base.png
      protaiomics-positivo.png
      protaiomics-negativo.png
    templates/
      PCDP_ProtAIomics_web_template.docx
    vendor/
      jszip.min.js
  functions/
    api/
      reminders.js
  apps-script/
    Code.gs
  README.md
  .gitignore
```

**Do not** upload secrets, tokens, Script Properties, `.env` files, backup spreadsheets or personal data. This repository deliberately does not contain the Cloudflare production variables or Google Apps Script secrets.

## 2. Publish in Cloudflare Pages

Use a **new, separate Cloudflare Pages project**, connected to this GitHub repository. Do not change the EvoMG project.

- Framework preset: **None**.
- Build command: **leave empty**.
- Build output directory: **`public`**.
- Root directory: **repository root**.
- Production branch: your repository default branch (normally `main`).

Both `public/` and `functions/` must remain at repository root. Cloudflare Pages publishes `public/` and deploys the `functions/api/reminders.js` server function. The web will load without setting up reminders; those require the separate backend below.

After deployment, use the **permanent Production URL**, generally `https://<project-name>.pages.dev`, only after checking it shows the correct ProtAIomics PCDP (not an individual hash-prefixed deployment URL).

## 3. Set up independent email reminders (optional, not included in GitHub deployment)

Create a new Google Sheet for ProtAIomics, preferably using an approved project-managed Google account. Open **Extensions > Apps Script** and paste the content of `apps-script/Code.gs` into the Apps Script editor. This is BACKEND CODE, not a web page to publish through GitHub.

Under **Apps Script > Project Settings > Script Properties**, set:

| Property | Value |
| --- | --- |
| `SITE_URL` | The confirmed permanent HTTPS Cloudflare Pages Production URL for ProtAIomics, with no trailing slash. |
| `BRIDGE_SECRET` | A new long, random, private key created **for ProtAIomics only**. |
| `SENDER_EMAIL` | Email of the Google account executing this script, or an explicitly authorised Gmail send-as alias. |
| `REPLY_TO_EMAIL` | Project inbox to receive replies, if different from sender. |

Do not enter EvoMG's secret or email account. The `setup()` function will generate its own `LINK_SECRET`, store the Google Sheet ID and create the daily trigger. If an organisation's security policy does not permit public Apps Script web apps, obtain approval or use an authorised equivalent service before enabling reminders.

Run `setup()` **once** from the Apps Script editor and authorise the requested permissions. Optionally run `sendTestEmail()` to test the permitted sender. Deploy as a **Web app**, execute as **Me**, with access **Anyone** if permitted. Copy the resulting URL ending in `/exec`. This is not the Cloudflare `SITE_URL`.

Then, under **Cloudflare Pages > your ProtAIomics project > Settings > Variables and Secrets**, for the relevant environment (Production), set:

| Cloudflare variable | Value | Type |
| --- | --- | --- |
| `APPS_SCRIPT_WEB_APP_URL` | The new **ProtAIomics** Google Apps Script `/exec` URL. | Text or Secret |
| `REMINDER_BRIDGE_SECRET` | Exactly the **same value** as Apps Script `BRIDGE_SECRET`. | **Secret** |

Save and deploy the updated configuration to Production. Production and Preview settings can differ. Do not reuse the EvoMG deployment URL, Google Sheet, Apps Script web app or keys.

## 4. Test before inviting doctoral candidates

1. Open the confirmed stable ProtAIomics Production URL. Check that the header has the ProtAIomics logo and project name.
2. Verify that all ten steps load, and complete a test PCDP (Initial mode). Download the package. Check that the ZIP contains a DOCX and JSON with ProtAIomics naming and that the Word footer says Grant Agreement **101227009**.
3. Test the Update mode with the new JSON backup and ensure that earlier plans from a different network are rejected.
4. Open the separate Apps Script `/exec` address. It should respond: `ProtAIomics reminders backend. Use the PCDP website.` This only checks the GET route, not authentication.
5. Enter **only your test email** and a valid future review date, give explicit consent and request reminders. Confirm that the verification email arrives and its link points to the stable ProtAIomics site. Confirm the reminder, inspect the active record in the **new** Google Sheet, then test stopping reminders.
6. After the test, review access/privacy requirements with the relevant institutional teams before broad use.

## How the app handles data

PCDP text and form answers are processed in the student's browser to create downloadable Word/JSON files. They are not sent to the reminder backend. If the student opts in, only their email address, network identifier, next review date, frequency and consent data are sent to the separate reminder service.

## Important

- The original EvoMG site/repository/backend must remain untouched.
- The logo comes from the official ProtAIomics PDF provided by the project.
- The local review calculator still uses the **Barcelona** weekend/public-holiday assumptions, exactly as the EvoMG source. Because ProtAIomics has international host institutions, the UI already advises checking other local calendars.
- The app's SharePoint confirmation text has been updated to ProtAIomics, assuming the project will use the same document process.
- `BRIDGE_SECRET` and `REMINDER_BRIDGE_SECRET` are **values**, not code. Never send them in chat or commit them to GitHub.
