/**
 * The one version constant the CLI banner, the server, and the update check all read. A test pins
 * it to package.json's version so the two can never drift (the release workflow refuses a tag that
 * disagrees with package.json, so tag = package.json = this).
 */
export const APP_VERSION = "0.1.1";
