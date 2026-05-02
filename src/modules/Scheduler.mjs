import { DEFAULT_BGCHECK_INTERVAL, NAMESPACE, PREF_KEY } from "./conf.mjs";
import { StorageUtils } from "./StorageUtils.mjs";

export const Scheduler = {
	async initialize(clean = false) {
		let existing = null;
		if (clean) {
			await browser.alarms.clearAll();
		} else {
			existing = await this.getAlarm();
		}
		const interval = await StorageUtils.getPref(PREF_KEY.CHECK_INTERVAL, DEFAULT_BGCHECK_INTERVAL);
		if ((0 >= interval && existing) || (0 < interval && existing && existing.periodInMinutes != interval)) {
			await browser.alarms.clear(NAMESPACE);
			existing = null;
		}
		if (0 < interval && !existing) {
			await browser.alarms.create(NAMESPACE, {
				periodInMinutes: interval
			});
		}
		console.log("Scheduler.initialize", await this.getAlarm());
	},
	makeListener(listener) {
		return (async (alarm) => {
			if (alarm.name === NAMESPACE) {
				await listener();
			}
		});
	},
	async getAlarm() {
		try {
			return await browser.alarms.get(NAMESPACE);
		} catch { }
		return null;
	},
	async getScheduledTime() {
		const alarm = await this.getAlarm();
		if (alarm) {
			return alarm.scheduledTime;
		}
		return null;
	},
	async getPeriod() {
		const alarm = await this.getAlarm();
		if (alarm) {
			return alarm.periodInMinutes;
		}
		return null;
	},
	async markExecution() {
		await StorageUtils.setLocal('lastRun', Date.now());
	},
	async missedExecution() {
		const scheduled = await this.getAlarm();
		if (!scheduled) {
			return false;
		}
		const lastRun = await StorageUtils.getLocal('lastRun', 0);
		return scheduled.scheduledTime - lastRun > scheduled.periodInMinutes * 60 * 1000 / 2;
	}
};