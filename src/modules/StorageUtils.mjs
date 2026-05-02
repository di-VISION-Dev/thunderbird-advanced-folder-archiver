import { DEFAULT_ARCHIVE_POLICY, NAMESPACE, PREF_KEY } from "./conf.mjs";

const STORAGE_KEY_PREFS = `${NAMESPACE}-prefs`;

function makeFolderKey(folderOrId) {
	return `${NAMESPACE}-policy-${(folderOrId.id || folderOrId)}`;
}
function makeFQKey(key) {
	return `${NAMESPACE}-${key}`;
}
async function setHelper(storageType, key, value) {
	await browser.storage[storageType].set({
		[makeFQKey(key)]: value
	});
}
async function getHelper(storageType, key, defaultVal = undefined) {
	const fqk = makeFQKey(key);
	const obj = await browser.storage[storageType].get(fqk);
	return obj && fqk in obj ? obj[fqk] : defaultVal;
}
async function removeHelper(storageType, key) {
	await browser.storage[storageType].remove(makeFQKey(key));
}

export const StorageUtils = {
	async setSession(key, value) {
		await setHelper('session', key, value);
	},
	async getSession(key, defaultVal = undefined) {
		return await getHelper('session', key, defaultVal);
	},
	async removeSession(key) {
		await removeHelper('session', key);
	},
	async setLocal(key, value) {
		await setHelper('local', key, value);
	},
	async getLocal(key, defaultVal = undefined) {
		return await getHelper('local', key, defaultVal);
	},
	async removeLocal(key) {
		await removeHelper('local', key);
	},
	async syncKeyExists(key) {
		return key in (await browser.storage.sync.get(key));
	},
	async prefExists(key, refresh = false) {
		if (refresh || !this._prefs) {
			this._prefs = (await browser.storage.sync.get(STORAGE_KEY_PREFS))[STORAGE_KEY_PREFS] || {};
		}
		return key in this._prefs;
	},
	async getPref(key, defaultVal = undefined, refresh = false) {
		if (refresh || !this._prefs) {
			this._prefs = (await browser.storage.sync.get(STORAGE_KEY_PREFS))[STORAGE_KEY_PREFS] || {};
		}
		return this._prefs[key] || defaultVal;
	},
	async setPref(key, value) {
		if (!this._prefs) {
			this._prefs = {};
		}
		this._prefs[key] = value;
		await browser.storage.sync.set({
			[STORAGE_KEY_PREFS]: this._prefs
		});
	},
	async removePref(key) {
		if (!this._prefs) {
			this._prefs = (await browser.storage.sync.get(STORAGE_KEY_PREFS))[STORAGE_KEY_PREFS] || {};
		}
		delete this._prefs[key];
		await browser.storage.sync.set({
			[STORAGE_KEY_PREFS]: this._prefs
		});
	},
	async isFolderPolicyDefined(folderOrId) {
		return await this.syncKeyExists(makeFolderKey(folderOrId));
	},
	async getFolderPolicy(folderOrId, defaultPol = null) {
		const key = makeFolderKey(folderOrId);
		return (await browser.storage.sync.get({
			[key]: defaultPol || await this.getPref(PREF_KEY.DEFAULT_POLICY, DEFAULT_ARCHIVE_POLICY)
		}))[key];
	},
	async setFolderPolicy(folderOrId, policy) {
		const defaultPol = await this.getPref(PREF_KEY.DEFAULT_POLICY, DEFAULT_ARCHIVE_POLICY);
		if (!policy.action) {
			policy.action = defaultPol.action;
		}
		if (!policy.after) {
			policy.after = defaultPol.after;
		}
		if (!policy.after.unit) {
			policy.after.unit = defaultPol.after.unit;
		}
		if (!policy.after.value) {
			policy.after.value = defaultPol.after.value;
		}
		await browser.storage.sync.set({
			[makeFolderKey(folderOrId)]: policy
		});
	},
	async removeFolderPolicy(folderOrId) {
		await browser.storage.sync.remove(makeFolderKey(folderOrId));
	},
	async updateFolderId(oldId, newId) {
		const policy = await this.getFolderPolicy(oldId);
		if (policy) {
			this.removeFolderPolicy(oldId);
			if (newId) {
				this.setFolderPolicy(newId, policy);
			}
		}
	}
};