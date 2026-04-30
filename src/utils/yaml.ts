import fs from "fs-extra";
import YAML from "yaml";

export async function readYamlFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf8");
  return YAML.parse(content) as T;
}

export async function writeYamlFile(filePath: string, data: unknown): Promise<void> {
  await fs.outputFile(filePath, YAML.stringify(data), "utf8");
}
