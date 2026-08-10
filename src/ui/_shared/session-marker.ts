/**
 * The one string that means "your page is older than this server".
 *
 * ITS OWN FILE BECAUSE BOTH SIDES MUST IMPORT IT. The server decides to send it and the browser
 * decides to reload on it, so a typo in either place turns the recovery off silently - the page goes
 * back to retrying a request that can never succeed, which is the whole failure this marker exists
 * to end. It lived as two `const`s with a comment claiming they were shared; they were not, and only
 * the server's copy was pinned by a test.
 *
 * Nothing else belongs here. A module with one string is the point: it can be imported by browser
 * code without dragging a server module into the bundle, and by server code without dragging the DOM.
 */
export const STALE_SESSION = "stale session";
