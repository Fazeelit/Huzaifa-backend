import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "node:dns/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

dotenv.config();

const execFileAsync = promisify(execFile);
let listenersAttached = false;

function isSrvLookupError(error) {
  return error?.code === "ECONNREFUSED" && error?.syscall === "querySrv";
}

function isTxtLookupError(error) {
  return error?.code === "ECONNREFUSED" && error?.syscall === "queryTxt";
}

function parseMongoSrvUri(uri) {
  const parsed = new URL(uri);

  if (parsed.protocol !== "mongodb+srv:") {
    throw new Error("Only mongodb+srv URIs can be converted to a direct Atlas URI.");
  }

  return {
    username: parsed.username,
    password: parsed.password,
    hostname: parsed.hostname,
    databaseName: parsed.pathname.replace(/^\//, ""),
    searchParams: new URLSearchParams(parsed.search),
  };
}

function ensureSafeHostname(hostname) {
  if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) {
    throw new Error("MongoDB hostname contains unsupported characters.");
  }

  return hostname;
}

async function resolveSrvViaPowerShell(hostname) {
  const safeHostname = ensureSafeHostname(hostname);
  const command = [
    "$records = Resolve-DnsName -Type SRV",
    `'` + `_mongodb._tcp.${safeHostname}` + `'`,
    "-ErrorAction Stop;",
    "$records | Select-Object NameTarget,Port,Priority,Weight | ConvertTo-Json -Compress",
  ].join(" ");
  const { stdout } = await execFileAsync("powershell", [
    "-NoProfile",
    "-Command",
    command,
  ]);
  const parsed = JSON.parse(stdout);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function resolveTxtViaPowerShell(hostname) {
  const safeHostname = ensureSafeHostname(hostname);
  const command = [
    "$records = Resolve-DnsName -Type TXT",
    `'` + safeHostname + `'`,
    "-ErrorAction SilentlyContinue;",
    "$strings = @();",
    "foreach ($record in $records) { $strings += $record.Strings }",
    "$strings | ConvertTo-Json -Compress",
  ].join(" ");
  const { stdout } = await execFileAsync("powershell", [
    "-NoProfile",
    "-Command",
    command,
  ]);

  if (!stdout.trim()) {
    return [];
  }

  const parsed = JSON.parse(stdout);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function resolveSrvRecords(hostname) {
  const srvName = `_mongodb._tcp.${hostname}`;

  try {
    return await dns.resolveSrv(srvName);
  } catch (error) {
    if (process.platform === "win32" && isSrvLookupError(error)) {
      return resolveSrvViaPowerShell(hostname);
    }

    throw error;
  }
}

async function resolveTxtRecords(hostname) {
  try {
    return await dns.resolveTxt(hostname);
  } catch (error) {
    if (error?.code === "ENODATA" || error?.code === "ENOTFOUND") {
      return [];
    }

    if (process.platform === "win32" && (isSrvLookupError(error) || isTxtLookupError(error))) {
      return resolveTxtViaPowerShell(hostname);
    }

    throw error;
  }
}

function buildDirectMongoUri(srvUri, srvRecords, txtRecords) {
  const { username, password, databaseName, searchParams } = parseMongoSrvUri(srvUri);
  const credentials =
    username || password
      ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
      : "";
  const hosts = srvRecords
    .map((record) => {
      const host = String(record.name ?? record.NameTarget).replace(/\.$/, "");
      const port = record.port ?? record.Port;
      return `${host}:${port}`;
    })
    .join(",");
  const mergedParams = new URLSearchParams(searchParams);

  for (const txtRecord of txtRecords.flat()) {
    for (const part of String(txtRecord).split("&")) {
      if (!part) {
        continue;
      }

      const [key, value = ""] = part.split("=");
      if (!mergedParams.has(key)) {
        mergedParams.set(key, value);
      }
    }
  }

  if (!mergedParams.has("tls") && !mergedParams.has("ssl")) {
    mergedParams.set("tls", "true");
  }

  const query = mergedParams.toString();
  return `mongodb://${credentials}${hosts}/${databaseName}${query ? `?${query}` : ""}`;
}

async function connectWithAtlasFallback(uri) {
  try {
    await mongoose.connect(uri);
    return true;
  } catch (error) {
    if (
      !uri.startsWith("mongodb+srv://") ||
      (!isSrvLookupError(error) && !isTxtLookupError(error))
    ) {
      throw error;
    }

    const { hostname } = parseMongoSrvUri(uri);
    const srvRecords = await resolveSrvRecords(hostname);
    const txtRecords = await resolveTxtRecords(hostname);
    const directUri = buildDirectMongoUri(uri, srvRecords, txtRecords);

    await mongoose.connect(directUri);
    return true;
  }
}

function attachConnectionListeners() {
  if (listenersAttached) {
    return;
  }

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected");
  });

  listenersAttached = true;
}

const dbConnect = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not defined in .env");
    process.exit(1);
  }

  try {
    await connectWithAtlasFallback(process.env.MONGO_URI);
    attachConnectionListeners();
    console.log("MongoDB connected successfully");
    return true;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

export default dbConnect;
