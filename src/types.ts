export type IntroData = {
  prettyName?: string;
  name?: string;
  url?: string;
  byLine?: string;
};
export type ArgOpt = {
  value: string;
  label: string;
  files: string[];
};
export interface ArgTemplateGeneric {
  name: string;
  type:
    | "folder"
    | "string"
    | "boolean"
    | "select"
    | "multiselect"
    | "confirm"
    | "text";
  message: string;
  initialValue?: string | boolean;
  required: boolean;
  validator?:
    | ((input: string) => void | string)
    | ((input: string[]) => void | string);
  describe: string;
  options?: ArgOpt[];
  alias?: string;
}

export interface ArgTemplateBoolean extends ArgTemplateGeneric {
  type: "boolean";
  initialValue: boolean;
}
export interface ArgTemplateString extends ArgTemplateGeneric {
  type: "string" | "folder";
  initialValue: string;
  validator?: (input: string) => void | string;
}
export interface ArgTemplateSelect extends ArgTemplateGeneric {
  type: "select" | "multiselect";
  validator?: (input: string[]) => void | string;
  // initialValue: undefined;
  options: ArgOpt[];
}

export type ArgTemplateTypes =
  | ArgTemplateBoolean
  | ArgTemplateString
  | ArgTemplateSelect;

export type BaseInfo = {
  module: string;
  createDirName: string;
  globalIncludes: string[];
  globalExcludes: string[];
  fileRenames?: [string, string][];
};
export type BoltInitData = {
  intro: IntroData;
  base: BaseInfo;
  argsTemplate: ArgTemplateTypes[];
};
export type ResArgs = {
  [key: string]: string | boolean | string[];
};
