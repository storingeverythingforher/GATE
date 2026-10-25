# her. — GATE DA practice

A responsive React app for GATE 2027 Data Science & Artificial Intelligence preparation. Select your paper, subject, syllabus topic, question format and difficulty. Gemini creates a question; submit an answer to see the result and a step-by-step explanation. MongoDB saves generated questions and first attempts, including mistakes and unanswered questions.

## Run locally

Requires Node.js 22 or newer.

```sh
npm install
cp .env.example .env # Skip this if .env is already configured.
npm run dev
```

The local `.env` has been populated from the supplied credentials. It is excluded from Git along with `gemini-request.sh`. Configure Vercel server environment variables explicitly; local `.env` files are not deployed through Git. The local Vite middleware runs the same API handler as Vercel.

## Deploy to Vercel

1. Import the repository in Vercel and use the repository root (`.`) as **Root Directory**. If importing the larger workspace instead, set Root Directory to `her`.
2. Keep the Vite preset, `npm run build` build command and `dist` output directory.
3. Add `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-3.5-flash-lite`), `MONGODB_URI` and `MONGODB_DB` (default `her_gate`) as server environment variables. Copy values from your ignored `.env` using Vercel's environment variable interface.
4. Ensure the Atlas database user can read/write the database and its Network Access configuration permits connections from the deployment. Prefer a deployment with controlled egress when available.
5. Deploy. The `api/index.js` Vercel function provides the API. No separate server deployment is needed. A purely browser-only app cannot keep the supplied MongoDB and Gemini credentials private.

The frontend never receives database credentials, the Gemini API key, or unsubmitted solutions. `VITE_` environment variables are intentionally not used for credentials. Server errors are sanitized.

## Google Drive diagrams (optional)

Without Drive credentials, Gemini is instructed to produce self-contained text questions; there are no placeholder images or pretend uploads. All questions still work.

For optional generated SVG bar charts:

1. Create an OAuth web client in your Google Cloud project and enable the Google Drive API.
2. Authorize the Google user that can upload to the target folder and obtain a refresh token using offline access. A folder URL alone does not grant upload authorization. Use an OAuth scope with access to that existing folder, such as `https://www.googleapis.com/auth/drive`; `drive.file` requires the target folder to have been explicitly granted to this app (for example, via Picker). Keep tokens server-side.
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, and `GOOGLE_DRIVE_FOLDER_ID=1EayeTjOFadwr6ywyZPzMiGIZMJ4HEmhc` in `.env` and Vercel.
4. Restart/redeploy. Gemini may now include a chart when relevant. The server builds an escaped SVG, uploads it to the specified Drive folder, and saves its file ID, name and Drive URL in the question document. The authenticated image endpoint serves the private file to its student. No public sharing permission is created.

Uploads fail explicitly if Drive permissions are invalid; questions with a required diagram are not silently saved with broken assets. Essential diagram data is also included in question text. Diagrams are optional bar charts, not arbitrary AI-generated artwork.

## Data and profiles

- `students`: name, random profile ID, SHA-256 hash of the bearer token, creation time and a hashed IP for registration throttling.
- `questions`: student ID, topic, difficulty, question format, prompt, answer, explanation, optional Drive file metadata, creation time.
- `attempts`: submitted answer, correctness, question and student IDs, creation time. A unique index preserves the first submission.

The browser keeps the profile token in localStorage. A name is a display name, not an authentication credential. Different browsers with the same name are separate profiles. Clearing browser storage loses access to that profile; records remain in MongoDB. Production accounts and recovery are outside this initial version. Do not share a browser profile between students.

History shows the latest 200 generated questions and associated first attempts. Incorrect answers have their own filter; unanswered questions can be resumed. Opening a completed question shows the preserved answer and explanation. Start another question on the same topic to practise again.

Progressive mode starts at the chosen Low/Medium/High level, increases one level after a correct response, and decreases one after an incorrect response. It remains within levels 1–3. Manual selection always sets the next question's level. MCQ and MSQ are graded by exact answer set, and NAT uses the generated numeric acceptance range. This is formative practice, not a timed mock exam or official marking simulator.

Gemini output is schema-validated, but AI-generated questions and solutions can still contain reasoning mistakes. The interface identifies them as generated practice, not official past questions.

## Checks

```sh
npm test
npm run build
```

Tests cover exact-set grading, NAT ranges, progressive bounds, solution redaction, question structure and SVG escaping.

Syllabus source: https://gate2027.iitm.ac.in/static/doc/GATE2027_Syllabus/DA_GATE2027_Syllabus.pdf
