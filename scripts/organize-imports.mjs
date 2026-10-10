import fs from "node:fs";
import path from "node:path";
import ts from "../frontend/node_modules/typescript/lib/typescript.js";

for (const app of ["frontend", "backendServer"]) {
  const configFile = path.resolve(app, "tsconfig.json");
  const config = ts.readConfigFile(configFile, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configFile));
  const host = {
    ...ts.sys,
    getCompilationSettings: () => parsed.options,
    getScriptFileNames: () => parsed.fileNames,
    getScriptVersion: () => "0",
    getScriptSnapshot: file => fs.existsSync(file) ? ts.ScriptSnapshot.fromString(fs.readFileSync(file, "utf8")) : undefined,
    getCurrentDirectory: () => path.resolve(app),
    getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
  };
  const service = ts.createLanguageService(host);
  const changes = [];
  for (const file of parsed.fileNames) {
    if (file.includes("/generated/") || file.includes("/.next/") || file.endsWith(".d.ts")) continue;
    changes.push(...service.organizeImports({ type: "file", fileName: file }, {}, {}));
  }
  service.dispose();
  for (const change of changes) {
    let text = fs.readFileSync(change.fileName, "utf8");
    for (const edit of [...change.textChanges].sort((a, b) => b.span.start - a.span.start)) {
      text = text.slice(0, edit.span.start) + edit.newText + text.slice(edit.span.start + edit.span.length);
    }
    fs.writeFileSync(change.fileName, text);
  }
  console.log(`${app}: organized imports in ${changes.length} files`);
}
