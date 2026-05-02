import * as Dialog from './dialog.mjs';
import * as i18n from "./i18n.mjs";

export class _BaseDialog {
	constructor() {
		window.addEventListener('DOMContentLoaded', async () => {
			await this.onDOMReady();
		});
		this._embed = "?embed=1" == window.location.search;
		document.addEventListener('keyup', async (evt) => {
			if (!evt.shiftKey) {
				if ('Enter' == evt.key || 13 == evt.keyCode) {
					this._acceptButton.click();
					evt.stopPropagation();
					evt.preventDefault();
				} else if ('Escape' == evt.key || 27 == evt.keyCode) {
					this._cancelButton.click();
					evt.stopPropagation();
					evt.preventDefault();
				}
			}
		});
	}

	async onDOMReady() {
		this._initUI();
		await this._evalParams(this._embed ? Object.fromEntries(new URLSearchParams(window.location.search)) : await Dialog.getParams());
		i18n.localizeDocument();
		if (!this._embed) {
			await Dialog.notifyReady();
		}
	}

	async _evalParams(params) {
		if (!this._embed && 'production' == params.mode) {
			window.addEventListener('blur', async () => {
				if (params.modal) {
					browser.windows.update(params.windowId, { focused: true });
					window.focus();
				} else {
					await Dialog.cancel();
					// window.close();
				}
			});
		}
	}

	async _onOk() { }

	async _onCancel() { }

	_initUI() {
		const forms = this._forms;
		forms.forEach((form) => {
			form.onsubmit = () => false;
			form.reset();
		});

		const btnAccept = this._acceptButton;

		if (this._embed) {
			btnAccept.addEventListener('click', async () => {
				await this._onOk();
				window.close();
			});
			this._cancelButton.addEventListener('click', async () => {
				await this._onCancel();
				window.close();
			});
		} else {
			Dialog.initAcceptButton(btnAccept, this._onOk.bind(this));
			Dialog.initCancelButton(this._cancelButton);
		}

		btnAccept.focus();
	}

	get _forms() {
		return document.querySelectorAll('form');
	}
	get _acceptButton() {
		return document.getElementById('btnAccept');
	}
	get _cancelButton() {
		return document.getElementById('btnCancel');
	}
}