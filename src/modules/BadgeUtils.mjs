export const BadgeUtils = {
	async setBusyState(busy = true, indColor = "blue") {
		const setter = async () => {
			const icon = `../images/${busy ? "icon-busy" : "icon"}.svg`;
			await browser.action.setIcon({
				path: {
					"32": icon,
					"64": icon
				}
			});
			await browser.action.setBadgeText({
				text: busy ? "‣" : ""
			});
			if (busy) {
				await browser.action.setBadgeBackgroundColor({
					color: indColor
				});
			}
		};
		if (busy) {
			await setter();
		} else {
			setTimeout(setter, 3000);
		}
	}
};