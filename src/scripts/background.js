import * as Dialog from '../modules/dialog.mjs';
import { GLOBAL_PREF_KEY, LAST_COMPAT_VERSION, NAMESPACE, PREF_KEY } from '../modules/conf.mjs';
import { Scheduler } from '../modules/Scheduler.mjs';
import { StorageUtils } from '../modules/StorageUtils.mjs';
import { WorkQueue } from '../modules/WorkQueue.mjs';
import _ from '../modules/getmessage.mjs';
import { Archiver } from '../modules/Archiver.mjs';

async function enqueueAllFolders(scheduled = false) {
	await WorkQueue.enqueue(await Archiver.createFolderTask(browser.folders.query({
		isRoot: false,
		isVirtual: false,
		isTag: false,
		hasMessages: true
	}), { scheduled: scheduled }), Archiver.processTask.bind(Archiver));
}

async function folderMoveListener(originalFolder, movedFolder) {
	await StorageUtils.updateFolderId(originalFolder.id, movedFolder ? movedFolder.id : null);
}

async function hasCompatVersion() {
	const installed = await StorageUtils.getPref(PREF_KEY.VERSION, '');
	return installed && 0 >= LAST_COMPAT_VERSION.localeCompare(installed, undefined, { numeric: true, sensitivity: 'base' })
}
async function storeVersion() {
	await StorageUtils.setPref(PREF_KEY.VERSION, "$_VERSION_");
}

const MenuManager = {
	async createMenu(detail) {
		if (!detail.title && 'separator' != detail.type) {
			detail.title = _(`${detail.id}Command`);
		}
		detail.id = `${NAMESPACE}-${detail.id}`;
		if (detail.parentId) {
			detail.parentId = `${NAMESPACE}-${detail.parentId}`;
		}
		await messenger.menus.create(detail);
	},
	async removeMenu(name) {
		await messenger.menus.remove(`${NAMESPACE}-${name}`);
	},
	async enableMenu(name, enable = true) {
		await messenger.menus.update(`${NAMESPACE}-${name}`, { enabled: enable });
	},
	async createBadgeMenus() {
		await messenger.menus.removeAll();
		await this.createMenu({
			id: `runall`,
			contexts: ['action_menu']
		});
		await this.createMenu({
			id: 'sep-options',
			type: 'separator',
			contexts: ['action_menu']
		});
		await this.createMenu({
			id: `options`,
			contexts: ['action_menu']
		});
	},
	async createContextMenus() {
		await this.createMenu({
			id: `main`,
			enabled: false,
			contexts: ["folder_pane"]
		});
		await this.createMenu({
			id: `run`,
			parentId: `main`,
			contexts: ["folder_pane"]
		});
		await this.createMenu({
			id: 'sep-policy',
			type: 'separator',
			parentId: `main`,
			contexts: ['folder_pane']
		});
		await this.createMenu({
			id: `policy`,
			parentId: `main`,
			contexts: ["folder_pane"]
		});
	},
	async createMenus() {
		await this.createBadgeMenus();
		await this.createContextMenus();
	},
	async update(info, tab) {
		if (info.contexts.includes('folder_pane')) {
			let enabled = info.selectedFolders && info.selectedFolders.length;
			if (enabled) {
				for (const f of info.selectedFolders) {
					enabled = enabled && (await Archiver.isArchivableFolder(f));
					if (!enabled) {
						break;
					}
				}
			}
			await this.enableMenu('main', enabled);
			await this.enableMenu('policy', enabled && 1 == info.selectedFolders.length);
			await messenger.menus.refresh();

		} else if (info.contexts.includes('message_list')) {
			const mnu = 'archiveSelection';
			if (await browser.thubiarc.getPref(GLOBAL_PREF_KEY.ARCHIVE_ENABLED, false)) {
				await this.removeMenu(mnu);
			} else {
				const enabled = await Archiver.areArchivableMessages(info.selectedMessages);
				if (info.menuIds.includes(`${NAMESPACE}-${mnu}`)) {
					await this.enableMenu(mnu, enabled);
				} else {
					await this.createMenu({
						id: mnu,
						contexts: ['message_list'],
						enabled: enabled
					});
				}
			}
			await messenger.menus.refresh();
		}
	},
	// actions
	async exec(info, tab) {
		try {
			const action = this[`${info.menuItemId.replace(`${NAMESPACE}-`, '')}Action`];
			if ('function' != typeof (action)) {
				console.warn(`[${NAMESPACE}] action for menu ${info.menuItemId} not found`);
			}
			return await action(info, tab);

		} catch (e) {
			console.error(`[${NAMESPACE}] error executing ${info.menuItemId} in ${tab.id} (${tab.title})`, e);
		}
	},
	async runallAction() {
		await enqueueAllFolders();
	},
	async optionsAction() {
		// Dialog.setLogger(console.log);
		const accepted = await Dialog.open({
			url: "options.html",
			width: 660,
			height: 545,
			modal: false
		}, {
			mode: "$_MODE_"
		});
	},
	async runAction(info) {
		if (!info.selectedFolder && !info.selectedAccount && (!info.selectedFolders || !info.selectedFolders.length)) {
			console.warn(`[${NAMESPACE}] nothing to archive`);
			return;
		}
		await WorkQueue.enqueue(await Archiver.createFolderTask(
			info.selectedFolders && info.selectedFolders.length
				? info.selectedFolders
				: [info.selectedFolder || info.selectedAccount.rootFolder]
		), Archiver.processTask.bind(Archiver));
	},
	async policyAction(info) {
		if (info.selectedFolders && 1 == info.selectedFolders.length) {
			// Dialog.setLogger(console.log);
			const accepted = await Dialog.open({
				url: "folder-policy.html",
				width: 640,
				height: 585,
				modal: false
			}, {
				folderId: info.selectedFolders[0].id,
				mode: "$_MODE_"
			});
		}
	},
	async archiveSelectionAction(info) {
		if (info.selectedMessages) {
			await WorkQueue.enqueue(await Archiver.createMessageTask(info.selectedMessages), Archiver.processTask.bind(Archiver));
		}
	}
};

messenger.menus.onShown.addListener(MenuManager.update.bind(MenuManager));
messenger.menus.onClicked.addListener(MenuManager.exec.bind(MenuManager));

messenger.folders.onMoved.addListener(folderMoveListener);
messenger.folders.onRenamed.addListener(folderMoveListener);
messenger.folders.onDeleted.addListener(folderMoveListener);

browser.alarms.onAlarm.addListener(Scheduler.makeListener(async () => enqueueAllFolders(true)));

browser.runtime.onInstalled.addListener(async () => {
	console.info(`[${NAMESPACE}] installing v$_VERSION_`);
	await Scheduler.initialize(true);
	await MenuManager.createMenus();
	WorkQueue.initialize();

	if (!hasCompatVersion()) {
		setTimeout(MenuManager.optionsAction, 500);
	}
	storeVersion();
});
browser.runtime.onStartup.addListener(async () => {
	console.log("runtime.onStartup");
	await Scheduler.initialize();
	await MenuManager.createMenus();
	WorkQueue.initialize();

	if (await Scheduler.missedExecution()) {
		await processAllFolders(true);
	}
});

