This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Tests

```bash
npm test
```

This builds the app, starts a throwaway Postgres (downloaded by the `embedded-postgres` package, so Docker isn't needed), applies the Prisma migrations, and runs the real app with Shopify, Razorpay, Twilio and MSG91 faked by [nock](https://github.com/nock/nock). No real secrets or network access are used. A full run takes under a minute.

- `npm test -- pricing` runs only test files whose name contains `pricing`.
- `TEST_SKIP_BUILD=1 npm test` reuses the last test build, for when only tests changed.
- `TEST_VERBOSE=1 npm test` also shows the app's own logs.

The tests are in `tests/`:

| File | Covers |
| --- | --- |
| `security-sessions.test.mjs` | Checkout session tokens, merchant login cookies, the Shopify login flow |
| `security-isolation.test.mjs` | One store's login can't change another store's settings or orders |
| `security-otp.test.mjs` | OTP sending limits, Twilio/MSG91, code checking, webhook signatures |
| `pricing.test.mjs` | Own codes, slabs, tags, collections, free gifts, limits, Shopify codes, Partial COD, shipping rules, quote tokens |
| `orders.test.mjs` | COD, prepaid and Partial COD orders, retries, offers counted once, the OTP Verify plan |
| `widget.test.mjs` | `public/widget.js` in jsdom: OTP autofill, safe offer text, the gift row, the OTP + COD journey, and that it matches `build_v3.js` output |

The fake Shopify in `tests/helpers/fake-services.mjs` works out draft order totals from its own catalogue, so new pricing tests only need to set prices and discounts.

GitHub runs `npm test` on every pull request (`.github/workflows/test.yml`), and the result shows as a check on the PR.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
