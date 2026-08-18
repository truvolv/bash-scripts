import { input, select } from "@inquirer/prompts";

const ENVIRONMENTS = {
  local: {
    label: "Local",
    baseUrl: process.env.LOCAL_TRUSPEED_URL || "http://localhost:4000",
    envVars: { plToken: "LOCAL_PL_TOKEN" },
  },
  production: {
    label: "Production",
    baseUrl: "https://truspeed.io",
    envVars: { plToken: "PROD_PL_TOKEN" },
  },
  qa: {
    label: "QA",
    baseUrl: null,
    envVars: { plToken: "QA_PL_TOKEN" },
  },
};

/**
 * Prompts the user to pick an environment (e.g. local/qa/production) from a config map,
 * then resolves that environment's base URL (prompting if not preconfigured) and env vars.
 *
 * @param {string} message - Prompt message shown to the user.
 * @param {string[]} omitEnvironments - Optional list of environment slugs to omit from the prompt.
 * @returns {Promise<{ slug: string, label: string, baseUrl: string, envVars: Record<string, { name: string, value: string|undefined }> }>}
 */
export async function promptForEnvironment({ message = "Which environment?", omitEnvironments = [] } = {}) {
  const choices = Object.entries(ENVIRONMENTS)
    .filter(([slug]) => !omitEnvironments.includes(slug))
    .map(([slug, { label }]) => ({
      name: label,
      value: slug,
    }));

  const slug = await select({ message, choices });
  const { label, baseUrl: configuredBaseUrl, envVars = {} } = ENVIRONMENTS[slug];

  const baseUrl =
    configuredBaseUrl || (await input({ message: `${label} base URL (no trailing slash):` }));

  const resolvedEnvVars = Object.fromEntries(
    Object.entries(envVars).map(([key, name]) => [key, { name, value: process.env[name] }]),
  );
 
  return { slug, label, baseUrl, envVars: resolvedEnvVars };
}
