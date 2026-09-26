# Sana Engineering College — Student Registration System

A student registration website that uses **Google Sheets as the database** and
**Google Apps Script as the backend/API**. There is no MySQL, Flask, PHP, or
Node.js server anywhere in this project.

```
Frontend:  HTML + CSS + JavaScript   (index.html, style.css, app.js)
Backend:   Google Apps Script         (Code.gs)
Database:  Google Sheets
```

## Project files

| File | Purpose |
|---|---|
| `index.html` | The single-page site: registration form, success screen, admin login, admin dashboard |
| `style.css` | All styling |
| `app.js` | Form validation, admin dashboard logic, and all calls to the Apps Script API |
| `Code.gs` | The complete Google Apps Script backend — paste this into your Apps Script project |
| `README.md` | This file |

---

## How it works

```
Student opens website
   → Registration Form
   → Submit
   → Google Apps Script (doPost)
   → Google Sheet (new row appended)
   → Unique SANA Registration ID generated
   → ID returned to the website
   → "Registration Successful" screen shown

Admin
   → Admin button
   → Admin Login (checked by Apps Script)
   → Admin Dashboard
   → Google Apps Script reads all rows from Google Sheets
   → Totals, latest ID, and full student table displayed
```

---

## Setup instructions

### Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet.
2. Name it something like **"Sana Engineering College — Registrations"**.
3. You do **not** need to type any column headers yourself — the Apps Script
   automatically creates a sheet named `Registrations` with all 17 columns
   the first time it runs. (If you'd rather create it yourself, add a sheet
   named exactly `Registrations` with this header row in row 1:
   `S.No | Registration ID | Student Name | Date of Birth | Gender | Guardian Name | Mobile | Email | Address | City | State | PIN Code | Course | Branch | Academic Year | Registration Date | Status`)

### Step 2 — Open Apps Script

1. In your spreadsheet, click **Extensions → Apps Script**.
2. A new tab opens with a default `Code.gs` file containing an empty `myFunction()`.
3. Delete everything in that editor.

### Step 3 — Paste the backend code

1. Open `Code.gs` from this project.
2. Copy its entire contents and paste it into the Apps Script editor.
3. Click the **Save** icon (or press Ctrl/Cmd+S). Name the project, e.g. "Sana Registration API".

### Step 4 — Set the admin username and password

By default the admin login is `admin` / `Sana@123`. **Change this before going live:**

1. In the Apps Script editor, click the gear icon **Project Settings** on the left.
2. Scroll to **Script Properties** → **Add script property**.
3. Add:
   - `ADMIN_USERNAME` → your chosen username
   - `ADMIN_PASSWORD` → your chosen password
4. Save. `Code.gs` will automatically use these instead of the defaults.

### Step 5 — Deploy as a Web App

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in:
   - **Description:** e.g. "Sana Registration v1"
   - **Execute as:** **Me** (your account)
   - **Who has access:** **Anyone** (this is required so students can submit the form without logging into Google)
4. Click **Deploy**.
5. Google will ask you to **authorize** the script — click **Authorize access**, choose your Google account, and click **Advanced → Go to (project name) → Allow**. This is expected the first time.

### Step 6 — Get the Web App URL

1. After deployment, a dialog shows a **Web app URL** that looks like:
   `https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxxxx/exec`
2. Copy this URL.

> **If you ever edit `Code.gs` again**, you must create a **new deployment**
> (or use **Manage deployments → Edit → New version**) for the changes to go
> live — saving alone does not update an existing Web App URL's behavior.

### Step 7 — Connect the URL to the website

1. Open `app.js` in a text editor.
2. Find this line near the top:
   ```js
   const APPS_SCRIPT_URL = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
   ```
3. Replace the placeholder with the URL you copied in Step 6, for example:
   ```js
   const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxxxxxx/exec';
   ```
4. Save the file.

### Step 8 — Host the website

Any static hosting works, since it's plain HTML/CSS/JS:

- Open `index.html` directly in a browser to test locally, **or**
- Upload the `index.html`, `style.css`, and `app.js` files to any static host
  (GitHub Pages, Netlify, Google Sites embed, your college's existing web
  server, etc.).

### Step 9 — Test a registration

1. Open the website.
2. Fill in the registration form with test data and click **Submit registration**.
3. Confirm the **Registration Successful** screen appears with a Registration ID such as `SANA20260001`.
4. Open your Google Sheet — a new row should appear in the `Registrations` sheet with all the submitted details, a `Registration Date`, and `Status = Confirmed`.

### Step 10 — Test the admin dashboard

1. Click **Admin** in the top navigation.
2. Log in with the username/password you set in Step 4.
3. Confirm the dashboard shows **Total Registered Students**, **Today's Registrations**, **Latest Registration ID**, and the full student table.
4. Try the search boxes (Registration ID, name, mobile), the Course/Branch filters, and the date sort to confirm they work.
5. Submit a second test registration and click **Refresh** on the dashboard — confirm the new row appears and the Registration ID incremented correctly (e.g. `SANA20260002`), with no duplicates.

---

## How the unique Registration ID is generated

Format: `SANA` + current year + a 4-digit sequence number, e.g. `SANA20260001`, `SANA20260002`, …

In `Code.gs`, `generateNextRegistrationId()`:
1. Reads the year, e.g. `2026`.
2. Scans the existing `Registration ID` column for IDs starting with `SANA2026`.
3. Takes the highest sequence number found and adds 1.

To make this safe when multiple students submit at the same moment, the
registration handler wraps the whole read-generate-write operation in a
**`LockService` script lock**. Apps Script guarantees only one execution can
hold that lock at a time, so two simultaneous submissions are processed one
after another — never in parallel — which makes duplicate IDs impossible.

## Security notes

- The admin dashboard is protected by a username/password check on the
  server (`Code.gs`), not just in the browser.
- On successful login, the server issues a short-lived session token stored
  in `CacheService` (expires after 1 hour) and echoed back by the browser on
  every dashboard request. Without a valid token, `getStudents` refuses to
  return any data.
- Change the default admin credentials (Step 4) before real use.
- Because the Web App is deployed with "Anyone" access, treat the Web App
  URL as semi-public — it is what lets the public registration form work
  without a Google login, but keep the admin password private.

## Troubleshooting

| Problem | Likely cause |
|---|---|
| "The Apps Script Web App URL has not been set yet" | You haven't completed Step 7 in `app.js` |
| Form submits but nothing appears in the Sheet | The Web App wasn't deployed with **Execute as: Me** and **Who has access: Anyone**, or you edited `Code.gs` without creating a new deployment |
| "Invalid username or password" on admin login | Check the Script Properties from Step 4, or that you're using the defaults `admin` / `Sana@123` if you skipped that step |
| Admin dashboard says "Session expired" | The 1-hour token expired — just log in again |
| Browser console shows a CORS error | Make sure `app.js` still sends requests with `Content-Type: text/plain` as shipped — don't change it to `application/json`, which triggers a CORS preflight that Apps Script Web Apps don't support |
