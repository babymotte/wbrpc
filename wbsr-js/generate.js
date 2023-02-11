var fs = require("fs");
var path = require("path");
var exec = require("child_process").exec;

const schemasDir = "../schemas";

fs.readdir(schemasDir, function (err, files) {
  if (err) {
    console.error("Could not list the directory.", err);
    process.exit(1);
  }

  files.forEach(function (file) {
    // Make one pass and make the file complete
    const schemaPath = path.join(schemasDir, file);
    const dir = path.join("src", file.replace(".json", ""));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    exec(
      `jtd-codegen --typescript-out ${dir} ${schemaPath}`,
      function callback(error, stdout, stderr) {
        if (error) {
          console.error(error);
        }
        if (stderr) {
          console.error(stderr);
        }
        if (stdout) {
          console.log(stdout);
        }
      }
    );
  });
});
