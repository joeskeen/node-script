#node-script

`node-script` is a command-line utility for running self-contained Node.JS scripts

##Installation

```bash
npm install -g node-script
```

##Usage

```bash
node-script [options] script [script options]
```

The `script` argument is the path to the `node-script` script you want to run.

A `node-script` script is very similar to a normal Node.JS script, except `node-script`
exposes the `script` global that allows you to embed metadata about your script right
in the script file, including what NPM modules it depends on.  `node-script` will
automatically ensure that all dependencies are installed before running your script,
which means you can share and run single-file scripts without requiring a `package.json`
file or first running the `npm install` command.

###Example

```js
//echo-sorted.js
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
```

```bash
> node-script echo-sorted.js This is only a test
a is only test This
```

##API

###`script(metadata)` function
`script` is a global when running `node-script`, and allows you to pass a `metadata`
object containing information about your script.  You can include anything you would
put in a `package.json` file (name, author, license, version, etc.), but the only thing
`node-script` currently cares about is the `dependencies` value.  See
https://docs.npmjs.com/files/package.json#dependencies for documentation on how to use
the `dependencies` option.

##License
MIT