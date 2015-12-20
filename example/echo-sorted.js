script({
	name: 'echo-sorted',
	dependencies: {
		'lodash': '*'
	}
});

var _ = require('lodash');
var args = process.argv.slice(1);
var sorted = _.sortBy(args, function(arg) { return arg.toLowerCase(); });
console.log(sorted.join(' '));