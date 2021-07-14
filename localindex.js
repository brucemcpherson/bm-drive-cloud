/**
 * call cli like this
 * bm-drive-cloud -s safile.json -w workfile.json
 */
const worker = require("./src/worker");

const argv = require("yargs/yargs")(process.argv.slice(2))
  .usage("Usage: $0 [options]")
  .example("-s safile.json -w workfile.json")
  .nargs("sa", 1)
  .nargs("work", 1)
  .alias("s", "sa")
  .alias("w", "work")
  .demandOption(["work", "sa"])
  .describe("sa", "consolidated service accounts json filename")
  .describe("work", "work json filename")
  .help("h")
  .alias("h", "help")
  .epilog("(c) Bruce Mcpherson 2021").argv;

(async () => {
  // get what needs done and check it's valid
  const {workContent, saContent} = await worker.getContent(argv)
  const pack = await worker.validateContent ({ work: workContent, sa: saContent})
  const result = await worker.execute(pack);
  console.log(result)

})(argv);
