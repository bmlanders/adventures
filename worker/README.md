# Google sign-in setup

One-time setup so Brendan and Jen sign in with Google instead of pasting a
GitHub token. About 30 minutes. Free.

How it works: the site shows a "Sign in with Google" button. A small Cloudflare
Worker (`worker.js`, in this folder) checks the email against an allow-list and
makes the GitHub changes with a key that lives only inside the Worker.

Until step 4 is done, the site keeps using the old pasted-token method.

## 1. Google: get a Client ID

1. Go to <https://console.cloud.google.com> and sign in with your Gmail.
2. Top bar project picker > New project. Name it `Landers On Tour`. Create, then select it.
3. Search the top bar for "Google Auth Platform" (older screens call it "OAuth consent screen") and click Get started.
   - App name: `Landers On Tour`. Support email: yours.
   - Audience: External.
   - Contact email: yours. Agree and Create.
4. Left menu > Audience > Publish app. (Only basic name/email is requested, so there's no Google review.)
5. Left menu > Clients > Create client.
   - Application type: Web application. Name: `Landers On Tour site`.
   - Authorized JavaScript origins, add all three:
     - `https://bmlanders.github.io`
     - `http://localhost:4000`
     - `http://localhost`
   - Leave redirect URIs empty. Create.
6. Copy the Client ID (ends in `.apps.googleusercontent.com`). It isn't secret.

## 2. GitHub: one last token

This token goes into the Worker, never into a browser.

1. github.com > profile picture > Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token.
2. Name `lot-auth worker`. Expiration: the longest it allows (put a reminder on your calendar to renew it).
3. Repository access: Only select repositories > `adventures`.
4. Permissions > Repository permissions > Contents: Read and write.
5. Generate and copy it.

## 3. Cloudflare: the Worker

1. Sign up free at <https://dash.cloudflare.com/sign-up>.
2. Left menu > Workers & Pages (under Compute) > Create > Start with Hello World. Name it `lot-auth`. Deploy.
3. Click Edit code. Select everything in the editor, delete it, paste in all of `worker.js`. Click Deploy.
4. Back on the Worker > Settings > Variables and Secrets > Add. Add these:

| Type | Name | Value |
|---|---|---|
| Text | `GOOGLE_CLIENT_ID` | the Client ID from step 1 |
| Text | `ALLOWED_EMAILS` | both Gmail addresses, comma-separated |
| Text | `REPO` | `bmlanders/adventures` |
| Text | `ALLOWED_ORIGINS` | `https://bmlanders.github.io,http://localhost:4000` |
| Secret | `GITHUB_TOKEN` | the token from step 2 |
| Secret | `SESSION_SECRET` | 40+ random characters (mash the keyboard) |

   Click Deploy/Save when it asks.
5. Copy the Worker's URL from its overview page, like `https://lot-auth.yourname.workers.dev`.
   Opening it in a browser should show `{"ok":true,"service":"landers-on-tour sign-in"}`.

## 4. Turn it on

Put the Worker URL and the Client ID into `CONFIG` at the top of
`assets/js/lot-auth.js`, commit, push. Then on each phone or computer: open any
editing page, tap Sign in with Google. Good for about 90 days.

## Later

- Add or remove someone: edit `ALLOWED_EMAILS` in the Worker settings. Removal takes effect immediately.
- Sign-in suddenly fails with GitHub errors: the Worker's `GITHUB_TOKEN` expired. Make a new one (step 2) and replace the secret.
- Updating the Worker code: Edit code, paste the new `worker.js`, Deploy. Settings stay.
