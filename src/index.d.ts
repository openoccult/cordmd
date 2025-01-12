declare module "cordmd" {
    export function validateMarkdown(input: string): string;
    export function renderMarkdown(input: string): Promise<Buffer>;
}