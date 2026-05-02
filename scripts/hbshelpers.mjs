export default {
	concat: function () {
		let result = '';
		for (const val of arguments) {
			if ('object' != typeof val) {
				result += val;
			}
		}
		return result;
	}
}