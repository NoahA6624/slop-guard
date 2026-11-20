// Parse source text with our pinned compiler, without loading project configs.
const ts = require("typescript");
let source = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (source += chunk));
process.stdin.on("end", () => {
  const file = ts.createSourceFile(
    process.argv[2],
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  console.log(
    JSON.stringify(
      file.parseDiagnostics.map((d) => ({
        line: file.getLineAndCharacterOfPosition(d.start || 0).line + 1,
        code: d.code,
        message: ts.flattenDiagnosticMessageText(d.messageText, " "),
      })),
    ),
  );
});
