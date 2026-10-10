import { realpathSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backend = realpathSync(join(dirname(fileURLToPath(import.meta.url)), "../backendServer"));
const target = join(backend, "dist");
if (existsSync(target)) {
  if (realpathSync(target) !== target) throw new Error("Refusing to clean a redirected build directory");
  rmSync(target, { recursive: true, force: true });
}
