import { NAMESPACE } from "./conf.mjs";

export default function _(messageName) {
	const result = browser.i18n.getMessage.apply(browser.i18n, arguments);
	/*#if _DEBUG
	if (!result) {
		console.warn(`[${NAMESPACE}] localized message '${messageName}' not found`);
	}
	//#endif */
	return result ? result : `!${messageName}!`;

}