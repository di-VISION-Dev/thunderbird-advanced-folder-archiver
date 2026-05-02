import { DEFAULT_ARCHIVE_SPECIAL, DEFAULT_BGCHECK_INTERVAL, GLOBAL_PREF_KEY, PREF_KEY } from "./conf.mjs";
import { Scheduler } from "./Scheduler.mjs";
import { StorageUtils } from "./StorageUtils.mjs";

export class GeneralPrefsEditor {
	#modified = false;
	constructor() {
		this.#backgourndServiceFieldset.closest('form').querySelectorAll('input, select').forEach(elm => {
			elm.addEventListener('change', () => {
				this.#modified = true;
			}, { once: true });
		});
		this.#resetIntegrationButton.addEventListener('click', async () => await this.#resetIntegration());
		this.#resetBgServiceButton.addEventListener('click', async () => await this.#resetBgService());
		this.#resetSpecialFoldersButton.addEventListener('click', async () => await this.#resetSpecialFolders());
	}

	get modified() {
		return this.#modified;
	}

	async load() {
		await this.#loadIntegration();
		await this.#loadBgService();
		await this.#loadSpecialFolders();
	}

	async store() {
		if (!this.#modified) {
			return;
		}

		await browser.thubiarc.setPref(GLOBAL_PREF_KEY.ARCHIVE_ENABLED, !this.#disableNativeCheckbox.checked);

		let interval = Number(this.#checkIntervalNumber.value);
		if (isNaN(interval) || 0 > interval) {
			interval = 0;
		} else {
			interval *= Number(this.#checkIntervalUnitSelect.value);
		}
		await StorageUtils.setPref(PREF_KEY.CHECK_INTERVAL, interval);
		await Scheduler.initialize();

		const specialFolders = [];
		this.#specialFoldersCheckboxes.forEach(elm => {
			if (elm.checked) {
				specialFolders.push(elm.name);
			}
		});
		await StorageUtils.setPref(PREF_KEY.ARCHIVE_SPECIAL, specialFolders);

		this.#modified = false;
	}

	async #loadIntegration() {
		const nativeArchive = await browser.thubiarc.getPref(GLOBAL_PREF_KEY.ARCHIVE_ENABLED, false);
		this.#disableNativeCheckbox.checked = !nativeArchive;
	}

	async #loadBgService() {
		const interval = await StorageUtils.getPref(PREF_KEY.CHECK_INTERVAL, DEFAULT_BGCHECK_INTERVAL);
		if (0 > interval) {
			interval = 0;
		}
		const isMin = interval % 60;
		this.#checkIntervalUnitSelect.value = isMin ? "1" : "60";
		this.#checkIntervalNumber.value = isMin ? interval : interval / 60;
	}

	async #loadSpecialFolders() {
		const specialFolders = await StorageUtils.getPref(PREF_KEY.ARCHIVE_SPECIAL, DEFAULT_ARCHIVE_SPECIAL);
		this.#specialFoldersCheckboxes.forEach(elm => {
			elm.checked = specialFolders.includes(elm.name);
		});
	}

	async #resetBgService() {
		await StorageUtils.removePref(PREF_KEY.CHECK_INTERVAL);
		await this.#loadBgService();

		if (!await StorageUtils.prefExists(PREF_KEY.ARCHIVE_SPECIAL)) {
			this.#modified = false;
		}
	}

	async #resetSpecialFolders() {
		await StorageUtils.removePref(PREF_KEY.ARCHIVE_SPECIAL);
		await this.#loadSpecialFolders();

		if (!await StorageUtils.prefExists(PREF_KEY.CHECK_INTERVAL)) {
			this.#modified = false;
		}
	}

	async #resetIntegration() {
		browser.thubiarc.resetPref(GLOBAL_PREF_KEY.ARCHIVE_ENABLED);
		await this.#loadIntegration();
	}

	get #disableNativeCheckbox() {
		return document.getElementById('chkPrefDisableNative');
	}
	get #backgourndServiceFieldset() {
		return document.getElementById('setBgService');
	}
	get #checkIntervalNumber() {
		return document.getElementById('noPrefCheckInterval');
	}
	get #checkIntervalUnitSelect() {
		return document.getElementById('selPrefItervalUnit');
	}
	get #specialFoldersFieldset() {
		return document.getElementById('setSpecialFolders');
	}
	get #specialFoldersCheckboxes() {
		return this.#specialFoldersFieldset.querySelectorAll('input[type="checkbox"]');
	}
	get #resetIntegrationButton() {
		return document.getElementById('btnResetIntegration');
	}
	get #resetBgServiceButton() {
		return document.getElementById('btnResetBgService');
	}
	get #resetSpecialFoldersButton() {
		return document.getElementById('btnResetSpecialFolders');
	}
}