# Credit Card Application & Approval System

A full-stack portfolio project with an Angular frontend and an Express backend.
The project provides applicant submission and tracking, eligibility evaluation,
approver decisions, card dispatch, administrator reporting, audit history, and
role-based authentication.

## Requirements

- Node.js 22.12 or newer in the Node 22 line (the scaffold was generated with
  Node.js 22.20.0)
- npm 11 or a compatible recent npm release

The Angular application was generated with Angular CLI 21.2.28 and uses the
compatible Angular Material 21.2 release.

## Repository structure

```text
frontend/
  src/app/core/       typed API services, auth, guards, interceptors
  src/app/features/   auth, applications, approvals, dispatch, admin screens
  src/app/shared/     reusable loading, error, empty, status, dialog UI
backend/
  src/config/         environment configuration
  src/controllers/    HTTP request handlers
  src/middleware/     auth, roles, CORS, security, errors, logging
  src/models/         Mongoose schemas and indexes
  src/routes/         REST route definitions
  src/services/       business logic and database workflows
  test/               Vitest API, model, and workflow tests
```

## First-time setup

Run these commands from the repository root in PowerShell:

```powershell
Set-Location frontend
npm.cmd install
Set-Location ..\backend
npm.cmd install
Create `backend/.env` with the required local values listed below.
```

The local environment file contains development values and must never be
committed. Never commit `.env` files or real credentials. The backend connects to
the MongoDB URI on startup when configured and closes the connection during
graceful shutdown. Start a local MongoDB instance or set `MONGODB_URI` to a
reachable development database before starting the API. Set `JWT_SECRET` to a
random value of at least 32 characters; the API refuses to start with the
template placeholder. Generate a local value with
`node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`
and put it only in `backend/.env`. `ALLOWED_ORIGINS` is a comma-separated allowlist for
browser origins. The frontend development API URL is configured in
`frontend/src/environments/environment.development.ts`; production uses
`frontend/src/environments/environment.ts`. Neither file contains secrets.
Update the URL for a deployed backend through the appropriate build
configuration.

Required backend variables:

| Variable | Local value/purpose |
|---|---|
| `PORT` | Express port, normally `3000` |
| `NODE_ENV` | `development` locally |
| `ALLOWED_ORIGINS` | `http://localhost:4200` |
| `MONGODB_URI` | Local MongoDB or Atlas development URI; local default is `mongodb://127.0.0.1:27017/CreditCard` |
| `JWT_SECRET` | At least 32 random characters |
| `CREDIT_LIMIT_300K_TO_500K` | Configurable unusual income-bracket limit |
| `CREDIT_LIMIT_300K_TO_500K_REQUIRES_CONFIRMATION` | `true` or `false` |

## Start the applications

Open two PowerShell terminals at the repository root.

Terminal 1, start Angular:

```powershell
Set-Location frontend
npm.cmd run start
```

The frontend is served at `http://localhost:4200`.

Terminal 2, start Express:

```powershell
Set-Location backend
npm.cmd run dev
```

The backend listens at `http://localhost:3000`; its health endpoint is
`http://localhost:3000/api/health`.

For a local MongoDB server, install MongoDB Community Edition and start it
with the default port `27017`, or use a MongoDB Atlas development database.
The application uses transactions for submission and workflow writes, so Atlas
or a local replica set is required for full transaction testing.

## API workflow

| Method | Endpoint | Access |
|---|---|---|
| `GET` | `/api/health` | Public |
| `POST` | `/api/auth/register` | Public applicant registration |
| `POST` | `/api/auth/login` | Public |
| `POST` | `/api/applications` | Applicant |
| `GET` | `/api/applications/me` | Applicant |
| `GET` | `/api/applications/:applicationNumber/status` | Owning applicant |
| `GET` | `/api/approvals` | Approver/admin |
| `POST` | `/api/approvals/:applicationNumber/decision` | Approver/admin |
| `GET` | `/api/card-dispatch` | Dispatch officer/admin |
| `PATCH` | `/api/card-dispatch` | Dispatch officer/admin |
| `GET` | `/api/reports/application-counts` | Administrator |
| `GET` | `/api/reports/applications` | Administrator |
| `GET` | `/api/reports/audit-logs` | Administrator |

Use fictional applicant details and PAN last-four test values only. The mock
credit-score provider is deterministic for tests; no real bureau data is
requested.

## Local end-to-end smoke test

1. Start MongoDB, then start the backend and frontend using the commands above.
2. Register a fictional applicant through `/register`, then sign in.
3. Submit an application with a fictional PAN last-four value.
4. Provision a trusted `APPROVER`, `ADMIN`, or `DISPATCH_OFFICER` account in the
   local database; public registration cannot assign staff roles.
5. Approve an eligible application, create its dispatch record, and advance
   it through `pending`, `in_transit`, and `delivered`.
6. Verify the applicant timeline, administrator counts, and read-only audit
   history.

Example fictional test data:

```text
Name: Aarav Sharma
Email: aarav.test@example.com
Password: LocalTest!12345
DOB: 1995-04-11
PAN last four: AB12
Annual income: 250000
```

Do not use this sample password or personal data outside local development.

## Troubleshooting

- `JWT_SECRET must be set`: add a random value of at least 32 characters to
  `backend/.env`.
- MongoDB connection or transaction errors: verify MongoDB is running and is a
  replica set/Atlas deployment for transaction workflows.
- CORS errors: ensure `ALLOWED_ORIGINS` contains the exact browser origin,
  normally `http://localhost:4200`.
- API requests after a page refresh require login again because access tokens
  are intentionally kept in Angular memory only.
- If Angular cannot resolve the API, verify the environment file and restart
  `ng serve`.

## Build, lint, and test

Run frontend commands from `frontend/`:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
```

API errors use this JSON shape:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource was not found.",
    "requestId": "generated-request-id"
  }
}
```

Request logs are structured JSON and include request metadata only; request
bodies, headers, and query values are not logged.

Run backend commands from `backend/`:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
```

## Authentication foundation

- `POST /api/auth/register` accepts `name`, `email`, and `password`; public
  registration always creates an `APPLICANT`. Supplied role fields are rejected.
- `POST /api/auth/login` returns an access token and safe user profile.
- `GET /api/auth/me` verifies the bearer token and returns the current account.
- `POST /api/applications` accepts a validated applicant profile and creates a
  server-owned application in `submitted` status.
- `GET /api/applications/me?page=1&limit=10` returns only the authenticated
  applicant's applications with pagination metadata.
- Passwords are hashed with bcrypt; the database model rejects non-bcrypt
  password values.
- Backend authorization middleware reads the account and role from MongoDB on
  every request, so changing a role or deactivating an account takes effect
  immediately. Use both `authenticate()` and `authorizeRoles(...)` on protected
  API routes. Browser route guards only improve navigation UX; they do not
  enforce security. Staff roles must be provisioned by a trusted operator;
  public registration cannot assign them.
- Tokens are signed JWT access tokens with a 15-minute expiry. The Angular app
  keeps the token in memory only and never writes it to localStorage,
  sessionStorage, or cookies. This reduces persistence and exposure after the
  browser closes, but a page reload or expiry requires the user to sign in
  again. Logout clears this tab's token; because tokens are stateless, an
  already copied token remains usable until its 15-minute expiry. No refresh
  token or server-side revocation list is implemented. Use HTTPS for deployed
  environments.

## Applicant application workflow

The application form accepts fictional applicant data, including date of birth,
contact/address details, annual income, employment type, and a PAN last-four
placeholder. The backend rejects unsupported fields and prevents clients from
setting ownership, application status, credit-score results, or credit limits.
The authenticated applicant identity determines ownership.

Submission creates or updates that applicant's profile, creates a unique
application number, and writes the initial status-history record in one
MongoDB transaction. Transactions require a MongoDB deployment that supports
them, such as MongoDB Atlas or a replica set. The initial workflow intentionally
does not calculate credit scores, approve applications, or set credit limits.

## Eligibility and credit-decision foundation

Submission now runs a deterministic mock score provider behind a provider
interface. Applicants must be strictly older than 18. An approved or rejected
application for the same applicant in the previous six months blocks a new
submission. The applicant update is written first inside the same MongoDB
transaction, which serializes concurrent submissions for that applicant and
prevents both requests from bypassing the restriction.

Scores must be greater than 800 to qualify for approval consideration; a score
of 800 or below creates a rejected eligibility outcome. This does not set an
approval decision. For income up to INR 200,000 the configured limit is INR
50,000; above INR 200,000 through INR 300,000 it is INR 75,000; above INR
300,000 through INR 500,000 it uses `CREDIT_LIMIT_300K_TO_500K` (default INR
1,000,000) and records a confirmation flag because that amount is unusually
high; income above INR 500,000 is routed to manual credit-limit review.
## Approval workflow

Approvers and administrators can review the queue with
`GET /api/approvals?page=1&limit=10&status=manual_review&search=APP-` and
retrieve safe details with `GET /api/approvals/:applicationNumber`. Decisions
are submitted with
`POST /api/approvals/:applicationNumber/decision` and a body such as
`{ "decision": "approved", "reason": "Eligibility reviewed." }`.

The server enforces the role, reviewable status, and score greater than 800.
Applications requiring manual credit-limit review cannot be approved by this
endpoint until that review is completed. Every decision atomically updates the
application and records status history plus safe audit metadata. The
application's conditional status update prevents duplicate concurrent
decisions.

## Status tracking and card dispatch

Authenticated applicants can view a privacy-safe status timeline for their own
application with `GET /api/applications/:applicationNumber/status`. Ownership
is checked on the server, and the response excludes applicant profile, income,
PAN, score, and other sensitive fields.

Dispatch officers and administrators can list dispatch records with
`GET /api/card-dispatch?page=1&limit=10&status=pending` and create or update a
dispatch with `PATCH /api/card-dispatch`. The body contains
`applicationNumber`, `dispatchStatus`, and an optional `dispatchReference`.
Only approved applications can create a dispatch. Allowed transitions are
`pending` to `in_transit` or `failed`, `in_transit` to `delivered` or `failed`,
and `failed` back to `pending`. Duplicate actions are rejected. Dispatch
creation and updates record status history and safe audit metadata.

## Administrator reporting

Administrators can retrieve status counts from
`GET /api/reports/application-counts`, filtered and paginated application
reports from `GET /api/reports/applications`, and a read-only audit view from
`GET /api/reports/audit-logs`. Report filters support status, application
number prefix, submission date range, audit action, and target resource.
Reporting queries use indexed date/status/search fields and pagination; status
counts use a MongoDB aggregation pipeline. Audit metadata is validated to
reject passwords, tokens, and PAN fields.
