import { StorageUtils } from "./StorageUtils.mjs";
/*#if _MANIFEST_V3_
import keepAlive from '../modules/keepalive.mjs';
//#endif */

const STORAGE_KEY_QUEUE = 'queue';

async function runQueue(runners) {
	if (0 == runners.length) {
		return;
	}
	const queue = await WorkQueue.getItems();
	WorkQueue.clearItems();
	const running = [];
	while (queue.length) {
		const item = queue[0];
		queue.splice(0, 1);
		for (const r of runners) {
			running.push(r(item));
		}
	}
	/*#if _MANIFEST_V3_
	await keepAlive(Promise.all(running));
	//#else */
	await Promise.all(running);
	//#endif
}

export const WorkQueue = {
	_running: Promise.resolve(false),
	_modifying: Promise.resolve(false),
	async initialize() {
		await this.clearItems();
	},
	async getItems() {
		return await StorageUtils.getSession(STORAGE_KEY_QUEUE, []);
	},
	async storeItems(items) {
		await this._modifying;
		this._modifying = StorageUtils.setSession(STORAGE_KEY_QUEUE, items);
		await this._modifying;
	},
	async clearItems() {
		await this._modifying;
		this._modifying = StorageUtils.removeSession(STORAGE_KEY_QUEUE);
		await this._modifying;
	},
	async enqueue(workItem, runner) {
		const queue = await this.getItems();
		queue.push(workItem);
		await this.storeItems(queue);
		if (runner) {
			this.start([runner]);
		}
	},
	start(runners) {
		this._running.then(() => {
			this._running = runQueue(runners);
		});
	}
};