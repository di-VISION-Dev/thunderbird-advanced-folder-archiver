import { ACTION_TYPE, DEFAULT_ARCHIVE_SPECIAL, INTERVAL_UNIT, NAMESPACE, PREF_KEY } from '../modules/conf.mjs';
import { FolderUtils } from '../modules/FolderUtils.mjs';
import { Scheduler } from '../modules/Scheduler.mjs';
import { StorageUtils } from '../modules/StorageUtils.mjs';
import _ from '../modules/getmessage.mjs';
import { BadgeUtils } from '../modules/BadgeUtils.mjs';

function groupMessagesByYear(accu, msg) {
	const d = msg.date.getFullYear();
	if (!accu[d]) {
		accu[d] = [];
	}
	accu[d].push(msg.id);
	accu.length++;
	return accu;
}

function groupMessagesByYearWithFolder(accu, msg) {
	const d = msg.date.getFullYear();
	if (!accu[d]) {
		accu[d] = {};
	}
	if (!accu[d][msg.folder.id]) {
		accu[d][msg.folder.id] = {
			folder: msg.folder,
			messages: []
		};
	}
	accu[d][msg.folder.id].messages.push(msg.id);
	accu.length++;
	return accu;
}

async function showNotification(messageCount, sourceFolders) {
	await browser.notifications.create({
		title: _("extensionName"),
		message: _("notifyTaskResults", [messageCount, sourceFolders.reduce((accu, val) => {
			if (accu.length) {
				accu += ", ";
			}
			accu += val.path;
			return accu;
		}, "")]),
		type: 'basic'
	});
}

export const Archiver = {
	async isArchivableFolder(folder, recurse = true) {
		if (!folder || folder.isVirtual || folder.isTag) {
			return false;
		}
		const archiveSpecial = await StorageUtils.getPref(PREF_KEY.ARCHIVE_SPECIAL, DEFAULT_ARCHIVE_SPECIAL);
		if (folder.specialUse.filter(value => !archiveSpecial.includes(value)).length) {
			return false;
		}
		if (recurse) {
			const path = await browser.folders.getParentFolders(folder.id);
			for (const f of path) {
				if (f.isVirtual || f.isTag || f.specialUse.filter(value => !archiveSpecial.includes(value)).length) {
					return false;
				}
			}
		}
		return true;
	},
	async areArchivableMessages(messageList) {
		let page = await messageList;
		const hasAny = !!(page.messages && page.messages.length);
		while (page && page.messages && page.messages.length) {
			for (const msg of page.messages) {
				if (!(await this.isArchivableFolder(msg.folder))) {
					return false;
				}
			}
			page = page.id ? await messenger.messages.continueList(page.id) : null;
		}
		return hasAny;
	},
	async processFolder(folder, context = { startDate: new Date() }) {
		if (!(await this.isArchivableFolder(folder, !context.policy))) {
			return 0;
		}
		console.info(`[${NAMESPACE}] processing folder`, folder.id);

		let result = 0;
		const policy = context.policy ? await StorageUtils.getFolderPolicy(folder, context.policy) : await FolderUtils.getEffectiveFolderPolicy(folder);

		if (!folder.isRoot && ACTION_TYPE.IGNORE != policy.action) {
			if (!context.checkpoint || policy.after.unit != context.policy.after.uint || policy.after.value != context.policy.after.value) {
				const cp = context.checkpoint = new Date(context.startDate);
				switch (policy.after.unit) {
					case INTERVAL_UNIT.DAYS:
						cp.setDate(cp.getDate() - policy.after.value);
						break;
					case INTERVAL_UNIT.MONTHS:
						cp.setMonth(cp.getMonth() - policy.after.value);
						break;
					case INTERVAL_UNIT.MONTHS:
						cp.setFullYear(cp.getFullYear() - policy.after.value);
						break;
					default:
						throw new Error(`Invalid interval unit '${policy.after.unit}' in policy for ${folder.id}, expected one of ${Object.values(INTERVAL_UNIT)}`);
				}
				cp.setHours(23, 59, 59, 999);
			}
			console.log("processFolder.context", context);

			let queryPage = await browser.messages.query(Object.assign({
				folderId: folder.id,
				toDate: context.checkpoint,
				includeSubFolders: false
			}, policy.messageFilter));

			let tgtMessages = queryPage.messages.reduce(groupMessagesByYear, { length: 0 });
			while (queryPage.id) {
				try {
					queryPage = await browser.messages.continueList(queryPage.id);
					tgtMessages = queryPage.messages.reduce(groupMessagesByYear, tgtMessages);
				} catch (e) {
					console.error(`[${NAMESPACE}] error querying messages`, e);
					break;
				}
			}
			// console.log(tgtMessages);
			if (tgtMessages.length) {
				for (const k in tgtMessages) {
					if ('length' == k) {
						continue;
					}
					try {
						switch (policy.action) {
							case ACTION_TYPE.ARCHIVE: {
								const targetFolder = await FolderUtils.getOrCreateArchivePath(folder, k);
								await browser.messages.move(tgtMessages[k], targetFolder.id);
							}
								break;
							case ACTION_TYPE.DELETE:
								await browser.messages.delete(tgtMessages[k]);
								break;
							default:
								throw new Error(`Invalid action '${policy.action}' in policy for ${folder.id}, expected one of ${Object.values(ACTION_TYPE)}`);
						}
						result += tgtMessages[k].length;
					} catch (e) {
						console.error(`[${NAMESPACE}] error applying ${policy.action} on ${k} messages`, e);
					}
				}
			}
		}
		context.policy = policy;
		const subFolders = await messenger.folders.getSubFolders(folder.id, false);
		for (const f of subFolders) {
			result += await this.processFolder(f, context);
		}
		return result;
	},
	async processFolders(folders) {
		await BadgeUtils.setBusyState();

		let result = 0;
		const start = new Date();
		for (const folder of folders) {
			result += await this.processFolder(folder, { startDate: start });
		}
		if (0 < result) {
			await showNotification(result, folders);
		}

		await BadgeUtils.setBusyState(false);
		return result;
	},
	async processMessages(messages) {
		const result = 0;
		const tgtMessages = messages.reduce(groupMessagesByYearWithFolder, { length: 0 });
		if (tgtMessages.length) {
			const folders = [];
			for (const y in tgtMessages) {
				if ('length' == y) {
					continue;
				}
				for (const f in tgtMessages[y]) {
					try {
						const group = tgtMessages[y][f];
						if (await this.isArchivableFolder(group.folder)) {
							folders.push(group.folder);
							const targetFolder = await FolderUtils.getOrCreateArchivePath(group.folder, y);
							await browser.messages.move(group.messages, targetFolder.id);
							result += group.message.length;
						}
					} catch (e) {
						console.error(`[${NAMESPACE}] error applying ${ACTION_TYPE.ARCHIVE} on ${k} messages`, e);
					}
				}
			}
			if (3 < result) {
				await showNotification(result, folders);
			}
		}
		return result;
	},
	async processTask(workItem) {
		console.info(`[${NAMESPACE}] processing task`, workItem);
		if (workItem.folders && workItem.folders.length) {
			if (workItem.scheduled) {
				await Scheduler.markExecution();
			}
			await this.processFolders(await FolderUtils.asFolders(workItem.folders));
		} else if (workItem.messages && workItem.messages.length) {
			await this.processMessages(await Promise.all(workItem.messages.map(item => item.id ? item : messenger.messages.get(item))));
		}
		return true;
	},
	async createFolderTask(folders, options) {
		const ff = await folders;
		const ids = [];
		for (const folder of ff) {
			if (await this.isArchivableFolder(folder, false)) {
				ids.push(folder.id);
			}
		}
		return { type: 'folder', folders: ids, ...options };
	},
	async createMessageTask(messageList) {
		let page = await messageList;
		const messages = page.messages.map(item => item.id);
		while (page.id && page.messages && page.messages.length) {
			messages.push(...page.messages.map(item => item.id));
			page = await messenger.messages.continueList(page.id);
		}
		return { type: 'message', messages: messages };
	}
};