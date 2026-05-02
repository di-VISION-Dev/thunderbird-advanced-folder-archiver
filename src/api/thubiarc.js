const { ExtensionCommon } = ChromeUtils.importESModule("resource://gre/modules/ExtensionCommon.sys.mjs");

var thubiarc = class extends ExtensionCommon.ExtensionAPI {
	getAPI(context) {
		return {
			thubiarc: {
				async getPref(name, fallback, userPrefOnly) {
					let prefType = Services.prefs.getPrefType(name);
					if (prefType == Services.prefs.PREF_INVALID) {
						return fallback;
					}

					let value = fallback;
					if (!userPrefOnly || Services.prefs.prefHasUserValue(name)) {
						switch (prefType) {
							case Services.prefs.PREF_STRING:
								value = Services.prefs.getStringPref(name, fallback);
								break;

							case Services.prefs.PREF_INT:
								value = Services.prefs.getIntPref(name, fallback);
								break;

							case Services.prefs.PREF_BOOL:
								value = Services.prefs.getBoolPref(name, fallback);
								break;

							default:
								console.error(
									`Legacy preference <${name}> has an unknown type of <${prefType}>.`
								);
						}
					}
					return value;
				},
				async setPref(name, value) {
					let prefType = Services.prefs.getPrefType(name);
					if (prefType == Services.prefs.PREF_INVALID) {
						console.error(
							`Unknown legacy preference <${name}>, forgot to declare a default?.`
						);
						return false;
					}

					switch (prefType) {
						case Services.prefs.PREF_STRING:
							Services.prefs.setStringPref(name, value);
							return true;

						case Services.prefs.PREF_INT:
							Services.prefs.setIntPref(name, value);
							return true;

						case Services.prefs.PREF_BOOL:
							Services.prefs.setBoolPref(name, value);
							return true;

						default:
							console.error(
								`Legacy preference <${name}> has an unknown type of <${prefType}>.`
							);
					}
					return false;
				},
				resetPref(name) {
					Services.prefs.clearUserPref(name);
				},
				async getNativeFolder(folder) {
					return context.extension.folderManager.get(
						folder.accountId,
						folder.path
					);
				},
				async getFolderFlag(folder, flag) {
					const nativeFolder = await this.getNativeFolder(folder);
					return nativeFolder ? nativeFolder.getFlag(flag) : false;
				},
				async setFolderFlag(folder, flag) {
					const nativeFolder = await this.getNativeFolder(folder);
					if (nativeFolder) {
						nativeFolder.setFlag(flag);
					}
				},
				async clearFolderFlag(folder, flag) {
					const nativeFolder = await this.getNativeFolder(folder);
					if (nativeFolder) {
						nativeFolder.clearFlag(flag);
					}
				}
			}
		};
	}
};
