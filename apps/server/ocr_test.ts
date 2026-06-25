import * as fs from "fs";
import * as path from "path";
import { scanDmxManual } from "./services/ocr";

async function run() {
  const images = [
    "channel beam 3.jpeg",
    "image channel beam 150 w2.jpeg",
    "image chnnael beam 1.jpeg"
  ];
  for (const img of images) {
    const imgPath = path.resolve(__dirname, "../../", img);
    if (fs.existsSync(imgPath)) {
      console.log(`\n=== Scanning ${img} ===`);
      const buffer = fs.readFileSync(imgPath);
      try {
        const result = await scanDmxManual(buffer);
        console.log("CONFIDENCE:", result.confidence);
        console.log("TEXT:");
        console.log(result.rawText);
      } catch (err) {
        console.error("Error scanning", img, err);
      }
    } else {
      console.log(`File ${img} not found at ${imgPath}`);
    }
  }
}

run();
