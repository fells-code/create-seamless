import fs from "fs";
import path from "path";

export function writeFile(root: string, relativePath: string, content: string) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

export function readFile(root: string, relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf-8");
}
