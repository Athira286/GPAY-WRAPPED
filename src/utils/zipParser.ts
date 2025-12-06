import JSZip from "jszip";
import Papa from "papaparse";

export type ParsedTransaction = {
  Time: string;
  "Transaction ID"?: string;
  Description?: string;
  Product?: string;
  "Payment method"?: string;
  Status?: string;
  Amount?: string;
  [k: string]: any;
};

export type ParsedTakeout = {
  transactions: ParsedTransaction[];
  moneySends: ParsedTransaction[];
  cashbackRewards: any[];
  voucherRewards: any[];
  groupExpenses: any[];
  rawFiles: string[];
};

function stripBOM(s: string) {
  return s.replace(/^\uFEFF/, "");
}

function parseCSV<T>(csv: string): T[] {
  const cleaned = stripBOM(csv).trim();
  const result = Papa.parse<T>(cleaned, {
    header: true,
    skipEmptyLines: true,
  });
  // @ts-ignore
  return result.data || [];
}

function findFiles(zip: JSZip, prefix: string, pattern: RegExp) {
  const out: { path: string; file: JSZip.JSZipObject }[] = [];
  for (const path in zip.files) {
    if (!path.toLowerCase().startsWith(prefix.toLowerCase())) continue;
    const name = path.slice(prefix.length);
    if (pattern.test(name.toLowerCase())) out.push({ path, file: zip.files[path] });
  }
  return out;
}

export async function parseTakeoutZip(file: Blob | File): Promise<ParsedTakeout> {
  const zip = await JSZip.loadAsync(file);
  const paths = Object.keys(zip.files);

  let googlePayPrefix = "";
  for (const p of paths) {
    if (p.toLowerCase().includes("google pay")) {
      const parts = p.split("/").filter(Boolean);
      const idx = parts.findIndex((x) => x.toLowerCase() === "google pay");
      googlePayPrefix = parts.slice(0, idx + 1).join("/") + "/";
      break;
    }
  }

  if (!googlePayPrefix) googlePayPrefix = "";

  const rawFiles: string[] = [];

  const transactions: ParsedTransaction[] = [];
  const moneySends: ParsedTransaction[] = [];
  const cashbackRewards: any[] = [];
  const voucherRewards: any[] = [];
  const groupExpenses: any[] = [];

  // 1️⃣ Transactions CSV — supports names like transactions_43267.csv
  const txnFiles = findFiles(zip, googlePayPrefix, /transactions.*\.csv$/);
  for (const f of txnFiles) {
    const text = await f.file.async("string");
    transactions.push(...parseCSV(text));
    rawFiles.push(f.path);
  }

  // 2️⃣ Money sends & requests
  const moneyFiles = findFiles(zip, googlePayPrefix, /money sends.*\.csv$/);
  for (const f of moneyFiles) {
    const text = await f.file.async("string");
    moneySends.push(...parseCSV(text));
    rawFiles.push(f.path);
  }

  // 3️⃣ Cashback Rewards
  const cashbackFiles = findFiles(zip, googlePayPrefix, /cashback.*\.csv$/);
  for (const f of cashbackFiles) {
    const text = await f.file.async("string");
    cashbackRewards.push(...parseCSV(text));
    rawFiles.push(f.path);
  }

  // 4️⃣ Voucher Rewards JSON
  const voucherFiles = findFiles(zip, googlePayPrefix, /voucher.*\.json$/);
  for (const f of voucherFiles) {
    const text = await f.file.async("string");
    try {
      const json = JSON.parse(stripBOM(text));
      if (Array.isArray(json)) voucherRewards.push(...json);
      else voucherRewards.push(json);
    } catch {}
    rawFiles.push(f.path);
