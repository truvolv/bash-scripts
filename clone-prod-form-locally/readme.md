# Clone Prod Form Locally

## Purpose
The purpose of this script is to clone forms and integrations between Local, Production, and QA TruSpeed environments for testing purposes. We often need to do this for CRM work, and this is a huge timesaver.

## Setup/Use
### Initial
Run `npm i`

At the root directory of this repo in your .env.local file, add the variables for whichever environments you plan to use as a source or destination:

`PROD_PL_TOKEN` - you can get this in your production TruSpeed account. Enable your API key and make sure to **save** your change in TruSpeed. Then bring the key into your env file.

`LOCAL_PL_TOKEN` - this is your local payload token. You will get it from your local TruSpeed in the same manner as the production one.

`QA_PL_TOKEN` - this is your QA payload token, retrieved from your QA TruSpeed account the same way.

`LOCAL_TRUSPEED_URL` - (optional) base URL for your local TruSpeed instance. Defaults to `http://localhost:4000`.

Production's base URL is fixed to `https://truspeed.io`. QA has no fixed base URL — you'll be prompted for it (and for the org slug) each time you select QA as a source or destination.

### Repeated Use
1. In the root directory of `bash-scripts/`, run `node clone-prod-form-locally/`
2. It will prompt you to select which environment to clone **from** (Local, Production, or QA) and which to clone **to**. If either side is QA, it will also prompt for that environment's base URL
3. It will fetch the list of organizations from each selected environment and let you pick the source and destination org from a list (falling back to typing the slug manually if the list can't be fetched, or via the "Other" option). Note that your PL token's user only sees orgs it has admin access to, unless it's a super admin.
4. It will prompt you for the form ID
5. It will create the form in the destination for you. NOTE that it will strip out fields like Email so members aren't notified with your testing
6. If the source form has an integration, it will ask if you want to clone that as well