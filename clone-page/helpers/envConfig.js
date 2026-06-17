import * as dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const ENV_DEFINITIONS = {
  local: {
    getBaseUrl: () => process.env.LOCAL_TRUSPEED_URL || 'http://localhost:4000',
    getToken: () => process.env.LOCAL_PL_TOKEN,
    getOrgSlug: (orgSlug) => process.env.LOCAL_TRUSPEED_ORG || 'localhost',
    label: 'Local',
  },
  qa: {
    getBaseUrl: () => process.env.QA_TRUSPEED_URL || 'https://qa.truspeed.io',
    getToken: () => process.env.QA_PL_TOKEN,
    getOrgSlug: (orgSlug) => orgSlug,
    label: 'QA',
  },
  prod: {
    getBaseUrl: () => process.env.PROD_TRUSPEED_URL || 'https://truspeed.io',
    getToken: () => process.env.PROD_PL_TOKEN,
    getOrgSlug: (orgSlug) => orgSlug,
    label: 'Prod',
  },
}

export const ENV_CHOICES = Object.keys(ENV_DEFINITIONS)

export function getEnvConfig(env, orgSlug) {
  const def = ENV_DEFINITIONS[env]
  if (!def) throw new Error(`Unknown environment "${env}". Valid options: ${ENV_CHOICES.join(', ')}`)

  const token = def.getToken()
  if (!token) throw new Error(`Missing token for ${env} environment. Set ${env.toUpperCase()}_PL_TOKEN in .env.local`)

  return {
    env,
    label: def.label,
    baseUrl: def.getBaseUrl(),
    token,
    orgSlug: def.getOrgSlug(orgSlug),
  }
}
