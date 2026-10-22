import fs from "fs";
import path from "path";
import { EXPANDED_TAXONOMY } from "../src/lib/context-detector/expanded-taxonomy";

const outPath = path.resolve("./backend/data/expanded_taxonomy.json");
fs.writeFileSync(outPath, JSON.stringify(EXPANDED_TAXONOMY, null, 2), "utf-8");
console.log(`Successfully exported ${EXPANDED_TAXONOMY.length} taxonomy entries to ${outPath}`);
