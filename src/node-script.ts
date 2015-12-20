/// <reference path="../typings/tsd.d.ts" />
/// <reference path="../node-script.d.ts" />

import yargs = require('yargs');
import path = require('path');
import childProcess = require('child_process');
const scriptFile = setupOptions(yargs).argv._[0];
const scriptFileArgIndex = process.argv.indexOf(scriptFile);
const nodeScriptArgs = process.argv.slice(0, scriptFileArgIndex);
const scriptArgs = process.argv.slice(scriptFileArgIndex);
const args = setupOptions(yargs(nodeScriptArgs)).argv;

global['script'] = (config?: NodeScriptMetadata) => {
	log('script with config: ', config);
	if (config && config.dependencies) {
		const dependencies = config.dependencies;
		//TODO: Only 'NPM install' if needed for each package (use 'semver' module to check)
		//TODO: run script from temp location so installed node modules don't pollute the CWD
		const packages = Object.keys(dependencies).map(packageName => `${packageName}@${dependencies[packageName]}`);
		childProcess.execSync(`npm install ${packages.join(' ')}`, {
			stdio: args.verbose ? [0,1,2] : undefined
		});
		log(packages);
	}
};
log('process.argv', process.argv);
log('nodeScriptArgs', nodeScriptArgs);
log('scriptArgs', scriptArgs);
process.argv.length = 0;
scriptArgs.forEach(arg => process.argv.push(arg));
const scriptPath = path.resolve(process.cwd(), scriptFile);
log(`running script ${scriptPath}...`);
//TODO: use 'interpret' module to determine which JS variant loaders we need to register (.ts, .coffee, etc.)
require(scriptPath);

function setupOptions(yargs: yargs.Argv): yargs.Argv {
	return yargs.usage('$0 script_path [script_args]')
		.demand(1)
		.option('verbose', {
			alias: 'v',
			boolean: true,
			description: 'enable verbose logging'
		});
}

function log(...logArgs: any[]) {
	if (args.verbose) {
		console.log.apply(this, logArgs);
	}
}