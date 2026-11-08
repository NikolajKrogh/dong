import { parse, stringify } from "yaml";
import { projectId } from "./e2e-workspace.mjs";

export async function configureGateway(run) {
  const container = `supabase_kong_${projectId}`;
  const path = "/home/kong/kong.yml";
  const config = parse(await run("docker", ["exec", container, "cat", path], { capture: true, name: "gateway" }));
  const transformer = config.services?.find(service => service.name === "functions-v1")?.plugins?.find(plugin => plugin.name === "request-transformer");
  if (!transformer?.config) throw new Error("Expected local Kong Edge request transformer was not found");
  // Emulate Cloudflare's trusted caller header; browser-supplied values are always discarded.
  for (const operation of ["remove", "add"]) {
    transformer.config[operation] ??= {};
    transformer.config[operation].headers = (transformer.config[operation].headers ?? []).filter(header => !header.toLowerCase().startsWith("cf-connecting-ip"));
  }
  transformer.config.remove.headers.push("cf-connecting-ip");
  transformer.config.add.headers.push("cf-connecting-ip:127.0.0.1");
  await run("docker", ["exec", "--user", "root", "-i", container, "sh", "-c", `cat > ${path}`], { input: stringify(config), name: "gateway" });
  await run("docker", ["exec", container, "kong", "reload"], { name: "gateway" });
}
