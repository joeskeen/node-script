declare function script(metadata: NodeScriptMetadata);

interface NodeScriptMetadata {
	name?: string;
	version?: string;
	dependencies?: {
		[packageName: string]: string;
	};
}