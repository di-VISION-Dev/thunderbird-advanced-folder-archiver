import { StorageUtils } from './StorageUtils.mjs';
import { PolicyEditor } from './PolicyEditor.mjs';
import { _BaseDialog } from './_BaseDialog.mjs';
import _ from './getmessage.mjs';

export class FolderPolicyDialog extends _BaseDialog {
	#folder;
	#baseTitle = document.title;
	#policyEditor;

	async onDOMReady() {
		this.#policyEditor = new PolicyEditor();
		await super.onDOMReady();
	}

	_initUI() {
		const chkInherit = this.#inheritCheck;
		chkInherit.addEventListener('change', () => this.#policyEditor.enable(!chkInherit.checked));
		super._initUI();
	}

	async _evalParams(params) {
		await super._evalParams(params);
		this.folder = params.folderId ? await browser.folders.get(params.folderId) : null;
	}

	async _onOk() {
		if (this.#folder) {
			await this.#policyEditor.store(this.#folder);
		}
	}

	set folder(folder) {
		this.#folder = folder;
		document.title = this.#folder ? `${this.#folder.name} - ${this.#baseTitle}` : this.#baseTitle;
		document.querySelector('.folder-info .path').textContent = this.#folder ? this.#folder.path : _("uiErrorPlaceholder");
		this.#updatePolicy();
	}

	get folder() {
		return this.#folder;
	}

	async #updatePolicy() {
		await this.#policyEditor.load(this.#folder);
		const chkInherit = this.#inheritCheck;
		chkInherit.checked = !(await StorageUtils.isFolderPolicyDefined(this.#folder));
		this.#policyEditor.enable(!chkInherit.checked);
	}

	get #inheritCheck() {
		return document.getElementById('chkInherit');
	}
}