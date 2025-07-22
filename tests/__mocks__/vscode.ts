// Mock for VSCode API
export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64
}

export class Uri {
  static file(path: string) {
    return {
      fsPath: path,
      path: path,
      scheme: 'file'
    };
  }
  
  static parse(value: string) {
    return {
      fsPath: value,
      path: value,
      scheme: value.split(':')[0]
    };
  }
}

export const window = {
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showInputBox: jest.fn(),
  showQuickPick: jest.fn(),
  showTextDocument: jest.fn(),
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    append: jest.fn(),
    clear: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn()
  })),
  terminals: []
};

export const workspace = {
  fs: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    stat: jest.fn(),
    readDirectory: jest.fn(),
    createDirectory: jest.fn(),
    delete: jest.fn()
  },
  workspaceFolders: [{
    uri: Uri.file('/mock/workspace'),
    name: 'mock-workspace',
    index: 0
  }],
  openTextDocument: jest.fn(),
  createFileSystemWatcher: jest.fn(),
  textDocuments: []
};

export class RelativePattern {
  constructor(public folder: any, public pattern: string) {}
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9
}

// Export other commonly used APIs
export const commands = {
  registerCommand: jest.fn(),
  executeCommand: jest.fn()
};

export const extensions = {
  getExtension: jest.fn()
};