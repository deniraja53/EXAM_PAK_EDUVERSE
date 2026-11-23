declare module 'mammoth/mammoth.browser' {
  interface MammothInput {
    arrayBuffer: ArrayBuffer;
  }

  interface MammothResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  const mammothBrowser: {
    extractRawText(input: MammothInput): Promise<MammothResult>;
    convertToHtml(input: MammothInput): Promise<MammothResult>;
  };

  export = mammothBrowser;
}

declare module 'pdfjs-dist/build/pdf.worker.min.mjs?url' {
  const workerUrl: string;
  export default workerUrl;
}
