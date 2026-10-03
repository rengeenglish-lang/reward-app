# BrightSteps

BrightSteps is a single-tutor classroom dashboard built with Next.js, TypeScript, and Neon PostgreSQL. The app keeps database access in server actions; students have no login surface.

## Local setup

1. Create a Neon project and database branch. Use the pooled connection URL for `DATABASE_URL`; use the direct URL for `DATABASE_URL_UNPOOLED` when available.
2. Copy `.env.example` to `.env.local` and add the two database URLs.
3. Install packages with `npm install`.
4. Apply the initial schema and starter prizes with `npm run db:migrate`.
5. Provision the single tutor once. Set `TUTOR_EMAIL`, `TUTOR_INITIAL_PASSWORD` (12+ characters), and optionally `TUTOR_DISPLAY_NAME` in the shell, then run `npm run tutor:setup`. The script hashes the password with Argon2id and refuses to create a second tutor. Remove the initial password from the shell/deployment environment after setup.
6. Run `npm run dev` and sign in at `/login`.

The migration is an initial, one-time migration and is not run by the app at request time. Back up the database before making manual schema changes. Use separate Neon branches and credentials for preview and production.

## Vercel deployment

Set `DATABASE_URL` and `DATABASE_URL_UNPOOLED` as server-only environment variables in Vercel. Run `npm run db:migrate` from a trusted local environment or CI job using the target environment's direct Neon URL. For login-page password renewal, also set `RESEND_API_KEY`, a verified `PASSWORD_RESET_FROM` sender, and `APP_URL` to the production origin. Reset links expire after 30 minutes and can only be used once. Provision the tutor once against the production database with `TUTOR_EMAIL`, `TUTOR_INITIAL_PASSWORD`, and optional `TUTOR_DISPLAY_NAME`; do not leave the initial password configured as a standing Vercel secret. After deployment, rotate the tutor password through a secure operational process.

`/api/health` is a liveness endpoint and returns only `{ "status": "ok" }`; it does not query the database or reveal application data.

## Included server-side flows

- Opaque, random, HTTP-only, same-site tutor sessions; only the token hash is stored. Password verification uses Argon2id. Login errors are generic and repeated failures are temporarily throttled by email.
- Classroom, group, student, behavior record, prize, report, and reward draw database actions validate IDs and input on the server.
- Daily criteria are stored as the six canonical booleans. The report period uses the tutor timezone and local calendar dates.
- Reward selection and draw insertion happen in one SQL statement. Random ordering uses PostgreSQL `gen_random_bytes`; a unique idempotency key returns the prior draw after a retry. Prize names are snapshotted for history.
- Archived entities remain in the database. Current listing and draw actions use active entities.

## Current scope and limitations

The current interface wires sign-in, daily checklist persistence, adding students/groups/classrooms/prizes, reward drawing, reports, and sign-out to Neon. Some interface sections are still presentation-level: editing/archiving entities, tutor password/timezone settings, correcting past dates, selecting a specific student for a draw, and complete history/profile views need follow-up before the MVP acceptance criteria are fully met. Login throttling is keyed by email and should be complemented by platform-level request limits for internet-facing deployments.

Never enter real student data until the production database, backups, deployment secrets, and operational access have been configured and reviewed.
