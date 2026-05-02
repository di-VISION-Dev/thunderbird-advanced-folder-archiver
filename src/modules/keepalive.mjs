import { NAMESPACE } from "./conf.mjs";

const KEY_KEEP_ALIVE = `${NAMESPACE}-wake`;

const RESET_IDLE_TIME_MS = 10000;

browser.storage.session.onChanged.addListener(data => {
	// This storage onChanged listener is only used to keep
	// the event page alive while running tasks that will be
	// potentially last longer than the idle timeout.
});

export default async function keepAlive(promise) {
	const forceResetIdleTimer = () => browser.storage.session.set({ [KEY_KEEP_ALIVE]: true });
	const clearSessionStore = () => browser.storage.session.remove([KEY_KEEP_ALIVE]);
	forceResetIdleTimer();
	const interval = setInterval(forceResetIdleTimer, RESET_IDLE_TIME_MS);
	try {
		return await promise;
	} finally {
		clearInterval(interval);
		clearSessionStore();
	}
}