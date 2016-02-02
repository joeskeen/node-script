declare module "interpret" {
    export interface ModuleInfo {
        module: string;
        register: (module: any) => void;
    }
    
    export interface Extensions {
        [extension: string]: string | string[] | ModuleInfo;
    }
    
    export var extensions: Extensions;
    export var jsVariants: Extensions;
}