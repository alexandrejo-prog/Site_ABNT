declare module "mammoth/mammoth.browser" {
  export interface MammothMessage {
    type?: string;
    message?: string;
  }

  export interface MammothRawTextResult {
    value: string;
    messages: MammothMessage[];
  }

  export function extractRawText(input: {
    arrayBuffer: ArrayBuffer;
  }): Promise<MammothRawTextResult>;
}
