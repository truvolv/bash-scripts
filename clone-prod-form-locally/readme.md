# Clone Prod Form Locally

## Purpose
The purpose of this script is to clone down production forms and integrations locally for testing purposes. We often need to do this for CRM work, and this is a huge timesaver.

## Setup/Use
### Initial
Run `npm i`

At the root directory of this repo in your .env.local file, add the variables:  
`PROD_PL_TOKEN` - you can get this in your production TruSpeed account. Enable your API key and make sure to **save** your change in TruSpeed. Then bring the key into your env file. This is so that the script can read from TruSpeed.  

`LOCAL_PL_TOKEN` - this is your local payload token. You will get it from your local TruSpeed in the same manner as the production one.

### Repeated Use
1. In the root directory of `bash-scripts/`, run `node clone-prod-form-locally/`
2. It will prompt you for the production organization slug and form ID
3. It will create a local form for you. NOTE that it will strip out production fields like Email so members aren't notified with your testing
4. If the production form has an integration, it will ask if you want to clone that as well