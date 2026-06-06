declare module "@earendil-works/pi-coding-agent" {
  export interface ExtensionAPI {
    registerTool(opts: { name: string; label?: string; description: string; promptSnippet?:string; parameters: any; execute: (toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) => Promise<any> }): void;
    on(event: string, handler: () => Promise<void>): void;
  }
}

declare module "@earendil-works/pi-ai" {
  export function StringEnum(values: readonly string[], opts?: any): any;
}
