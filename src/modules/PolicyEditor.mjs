import { ACTION_TYPE, NAMESPACE, PREF_KEY } from './conf.mjs';
import { FolderUtils } from './FolderUtils.mjs';
import _ from './getmessage.mjs';
import { StorageUtils } from './StorageUtils.mjs';

export class PolicyEditor {
	#policy;
	#tagTemplate;
	#modified = false;

	constructor() {
		this.#tagTemplate = document.getElementById('tplPolTagItem');

		const selPolAction = this.#actionSelect;
		selPolAction.addEventListener('change', () => this.reset(selPolAction.value));
		this.reset(selPolAction.value);

		const selPolTagsMode = this.#tagModeSelect;
		selPolTagsMode.addEventListener('change', () => this.updateTags(selPolTagsMode.value));

		this.#generalFieldset.closest('form').querySelectorAll('input, select').forEach(elm => {
			elm.addEventListener('change', () => {
				this.#modified = true;
			}, { once: true });
		});
		this.#resetButton.addEventListener('click', async () => await this.#resetDefaultPolicy());
	}

	get modified() {
		return this.#modified;
	}

	async load(folderOrId) {
		this.#resetButton.classList.toggle('d-none', !!folderOrId);

		this.#policy = await FolderUtils.getEffectiveFolderPolicy(folderOrId);
		console.log("PolicyEditor.load", folderOrId, this.#policy);
		this.#actionSelect.value = this.#policy.action;
		this.reset(this.#policy.action);
		this.#afterNumber.value = this.#policy.after.value;
		this.#unitsSelect.value = this.#policy.after.unit;

		const messageFilter = this.#policy.messageFilter || {};
		const filters = this.#filterStateSelects;
		filters.forEach(elm => {
			elm.value = JSON.stringify(elm.name in messageFilter ? messageFilter[elm.name] : null);
		});

		const tags = messageFilter.tags && messageFilter.tags.tags ? messageFilter.tags.tags : {};
		await this.#loadTags(tags);

		const tagsMode = this.#tagModeSelect.value = (messageFilter.tags ? messageFilter.tags.mode : 'null');
		this.updateTags(tagsMode);
		const tagsMatchers = this.#tagsMatchingSelects;
		tagsMatchers.forEach(elm => {
			const key = elm.name.substring(3);
			elm.value = ('null' == tagsMode || 'none' == tagsMode || !(key in tags))
				? 'null' : JSON.stringify(tags[key]);
		});
	}

	async store(folderOrId) {
		if (!this.#policy || !this.#modified) {
			return;
		}
		const result = structuredClone(this.#policy);
		result.action = this.#actionSelect.value;
		if (!result.after) {
			result.after = {};
		}
		result.after.unit = this.#unitsSelect.value;
		result.after.value = this.#afterNumber.value;

		const filters = this.#filterStateSelects;
		if (!result.messageFilter) {
			result.messageFilter = {};
		}
		filters.forEach((elm) => {
			result.messageFilter[elm.name] = JSON.parse(elm.value);
			if (null == result.messageFilter[elm.name]) {
				delete result.messageFilter[elm.name];
			}
		});

		const tagsMode = this.#tagModeSelect.value;
		if ('null' == tagsMode) {
			delete result.messageFilter.tags;
		} else {
			const tags = result.messageFilter.tags = {};
			tags.mode = tagsMode;
			if ('none' != tagsMode) {
				tags.tags = {};
				let hasTags = false;
				const tagsMatchers = this.#tagsMatchingSelects;
				tagsMatchers.forEach(elm => {
					if (!elm.classList.contains('text-decoration-line-through')) {
						const val = JSON.parse(elm.value);
						if (null != val) {
							tags.tags[elm.name.substring(3)] = val;
							hasTags = true;
						}
					}
				});
				if (!hasTags) {
					console.warn(`[${NAMESPACE}.PolicyEditor] missing tags for filter mode ${tagsMode}, removing filter`);
					delete result.messageFilter.tags;
				}
			}
		}

		console.log("PolicyEditor.store", folderOrId, result);
		if (folderOrId) {
			await StorageUtils.setFolderPolicy(folderOrId, result);
		} else {
			await StorageUtils.setPref(PREF_KEY.DEFAULT_POLICY, result);
		}
		return result;
	}

	enable(enable) {
		this.#generalFieldset.disabled = !enable;
		this.#msgFilterFieldset.disabled = !enable;
	}

	reset(action) {
		this.#msgFilterFieldset.classList.toggle('d-none', ACTION_TYPE.IGNORE == action);
		this.#unitsLabel.classList.toggle('d-none', ACTION_TYPE.IGNORE == action);
		this.#afterGroup.classList.toggle('d-none', ACTION_TYPE.IGNORE == action);
	}

	updateTags(mode) {
		this.#tagsFieldset.disabled = 'null' == mode || 'none' == mode;
	}

	async #loadTags(preset) {
		const tags = browser.messages.tags && browser.messages.tags.list ? await browser.messages.tags.list() : await browser.messages.listTags();

		const parent = this.#tagsFieldset.querySelector('ul');
		parent.replaceChildren();

		const updateMsgs = (select) => {
			for (const option of select.options) {
				if (option.textContent.startsWith('__MSG_')) {
					option.textContent = _(option.textContent.substring('__MSG_'.length, option.textContent.length - 2));
				}
			}
		};

		const addTag = (tag, missing = false) => {
			const clone = document.importNode(this.#tagTemplate.content, true);

			const item = clone.querySelector('li');
			const sel = item.querySelector('select');
			sel.id = `polSelTag-${tag.key}`;
			sel.name = `tag${tag.key}`;
			updateMsgs(sel);

			const lbl = item.querySelector('label');
			lbl.setAttribute('for', sel.id);
			if (missing) {
				lbl.classList.add('text-decoration-line-through');
				lbl.title = _("titleMissingTag");
			}
			if (tag.color) {
				lbl.style.color = tag.color;
			}
			lbl.textContent = tag.tag;

			parent.appendChild(clone);
		};
		const existing = [];
		for (const tag of tags) {
			existing.push(tag.key);
			addTag(tag);
		}
		for (const key in preset) {
			if (existing.includes(key)) {
				continue;
			}
			addTag({
				tag: key,
				key: key
			}, true);
		}
	}

	async #resetDefaultPolicy() {
		await StorageUtils.removePref(PREF_KEY.DEFAULT_POLICY);
		await this.load();
	}

	get #actionSelect() {
		return document.getElementById('selPolAction');
	}
	get #generalFieldset() {
		return document.getElementById('setPolGeneral');
	}
	get #msgFilterFieldset() {
		return document.getElementById('setPolMsgFilter');
	}
	get #afterGroup() {
		return document.getElementById('grpPolAfter');
	}
	get #afterNumber() {
		return document.getElementById('noPolAfter');
	}
	get #unitsLabel() {
		return document.getElementById('lblPolUnits');
	}
	get #unitsSelect() {
		return document.getElementById('selPolUnits');
	}
	get #filterStateSelects() {
		return this.#msgFilterFieldset.querySelectorAll('#blkPolMsgState select');
	}
	get #tagsFieldset() {
		return document.getElementById('setPolTags');
	}
	get #tagModeSelect() {
		return document.getElementById('selPolTagsMode');
	}
	get #tagsMatchingSelects() {
		return this.#tagsFieldset.querySelectorAll('select');
	}
	get #resetButton() {
		return document.getElementById('btnPolReset');
	}
}