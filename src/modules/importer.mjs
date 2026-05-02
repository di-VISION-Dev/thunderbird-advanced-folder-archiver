export async function importFragment(id, page = undefined) {
	const loader = document.createElement('iframe');
	const result = new Promise((resolve, reject) => {
		loader.addEventListener('load', async () => {
			try {
				if ('interactive' == loader.contentDocument.readyState || 'complete' == loader.contentDocument.readyState) {
					resolve();
				} else {
					loader.contentWindow.addEventListener('DOMContentLoaded', () => resolve());
				}
			} catch (e) {
				reject(e);
			}
		});
		loader.addEventListener('error', (e) => {
			reject(e);
		});
	});
	document.body.appendChild(loader);
	loader.src = `${page || id}-fragment.html`;

	await result;
	const template = loader.contentDocument.getElementById(`tpl-${id}`);
	const fragment = document.importNode(template.content, true);

	loader.remove();

	return document.getElementById(`ph-${id}`).replaceWith(fragment);
}
