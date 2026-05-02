
import { GeneralPrefsEditor } from './GeneralPrefsEditor.mjs';
import { PolicyEditor } from './PolicyEditor.mjs';
import { _BaseDialog } from './_BaseDialog.mjs';

export class OptionsDialog extends _BaseDialog {
	#policyEditor;
	#prefsEditor;

	async onDOMReady() {
		this.#prefsEditor = new GeneralPrefsEditor();
		this.#policyEditor = new PolicyEditor();

		await super.onDOMReady();
	}

	async _onOk() {
		const ops = [
			this.#prefsEditor.store(),
			this.#policyEditor.store()
		];
		await Promise.all(ops);
	}

	async _evalParams(params) {
		await super._evalParams(params);
		const ops = [
			this.#prefsEditor.load(),
			this.#policyEditor.load()
		];
		await Promise.all(ops);
		this.#policyEditor.enable(true);
	}
}