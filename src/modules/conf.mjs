export const NAMESPACE = 'thubiarc';

export const LAST_COMPAT_VERSION = '0.1.4';

export const PREF_KEY = {
	DEFAULT_POLICY: 'defaultPolicy',
	CHECK_INTERVAL: 'checkInterval',
	ARCHIVE_SPECIAL: 'archiveSpecial',
	VERSION: 'version'
};
export const GLOBAL_PREF_KEY = {
	ARCHIVE_ENABLED: 'mail.identity.default.archive_enabled'
};

export const DEFAULT_BGCHECK_INTERVAL = $_BGHCHECK_;
export const DEFAULT_ARCHIVE_SPECIAL = ['sent', 'junk'];

export const ACTION_TYPE = {
	ARCHIVE: 'archive',
	DELETE: 'delete',
	IGNORE: 'ignore'
};
export const INTERVAL_UNIT = {
	DAYS: 'days',
	MONTHS: 'months',
	YEARS: 'years'
};
export const DEFAULT_ARCHIVE_POLICY = {
	messageFilter: {
		flagged: false,
		read: true,
		junk: false,
		tags: {
			mode: 'all',
			tags: {
				'reminder': false
			}
		}
	},
	action: ACTION_TYPE.ARCHIVE,
	after: {
		unit: INTERVAL_UNIT.DAYS,
		value: 60
	}
};
