# Rebuild Sites Before Date

## Purpose
Grabs all the projects from our Vercel organization and outputs a list of sites on Node version 20 as well as a count of how many sites are on each node version.

## Setup/Use
### Initial
At the root directory of this repo in your .env.local file, add the variables `VERCEL_API_TOKEN` and `VERCEL_TEAM_ID`. You can create your own Vercel API Token in your Vercel account and the Team Id can be found under "Site Builder" -> "Settings" -> "General" -> "Team ID"

### Running the script
In the root of the project, run
`node project-node-versions/index.js`