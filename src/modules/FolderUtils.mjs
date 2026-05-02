import { DEFAULT_ARCHIVE_POLICY, NAMESPACE } from "./conf.mjs";
import _ from "./getmessage.mjs";
import { StorageUtils } from "./StorageUtils.mjs";

export const FolderUtils = {
	async asFolders(foldersOdIds) {
		const result = [];
		for (const f of foldersOdIds) {
			try {
				result.push(f.id ? f : (await browser.folders.get(f, false)));
			} catch (e) {
				console.warn(`[${NAMESPACE}] failed to get folder`, e);
			}
		}
		return result;
	},
	async getLocalFolders(accounts) {
		if (!accounts) {
			accounts = await browser.accounts.list();
		}
		return accounts.find(
			(account) =>
				account.type === "none" ||
				account.type === "local" ||
				account.name.toLowerCase().includes("local")
		);
	},
	async getOrCreateArchivesFolder(localFolders) {
		if (!localFolders) {
			localFolders = await this.getLocalFolders();
		}
		const queryResult = await browser.folders.query({
			accountId: localFolders.id,
			specialUse: ['archives']
		});
		if (queryResult.length && queryResult[0]) {
			return queryResult[0];
		}
		const result = await browser.folders.create(localFolders.id, _("archiveFolder"));
		await browser.thubiarc.setFolderFlag(result, 0x00004000);
		return result;
	},
	async getOrCreateArchivePath(sourceFolder, topFolderName, accounts) {
		if (!accounts) {
			accounts = await browser.accounts.list();
		}
		const localFolders = await this.getLocalFolders(accounts);
		const ensureNext = async (parent, folderName) => {
			let existing = await browser.folders.query({
				accountId: localFolders.id,
				path: `${parent.path}/${folderName}`
			});
			return existing && existing.length ? existing[0] : await browser.folders.create(parent.id, folderName);
		};
		let result = await ensureNext(await this.getOrCreateArchivesFolder(localFolders), "" + topFolderName);
		const sourcePath = sourceFolder.path.split('/');
		for (const p of sourcePath) {
			if (0 == p.length) {
				continue;
			}
			result = await ensureNext(result, p);
		}
		return result;
	},
	async getEffectiveFolderPolicy(folderOrId) {
		if (folderOrId) {
			if (await StorageUtils.isFolderPolicyDefined(folderOrId)) {
				return await StorageUtils.getFolderPolicy(folderOrId);
			}
			const path = await browser.folders.getParentFolders(folderOrId.id || folderOrId);
			for (const f of path) {
				if (!f.isRoot && await StorageUtils.isFolderPolicyDefined(f.id)) {
					return await StorageUtils.getFolderPolicy(f.id);
				}
			}
		}
		return DEFAULT_ARCHIVE_POLICY;
	}
};