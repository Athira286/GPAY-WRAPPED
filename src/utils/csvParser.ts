import { parseTakeoutZip, ParsedTakeout, ParsedTransaction } from "./zipParser";

function normalize(row: any): ParsedTransaction {
  return {
    Time: row.Time || row.time || row.Date || "",
    "Transaction ID": row["Transaction ID"] || row["transaction id"] || "",
    Description: row.Description || row.description || row.Product || "",
    Product: row.Product || "",
    "Payment method": row["Payment method"] || row["payment method"] || "",
    Status: row.Status || row.status || "",
    Amount: row.Amount || row.amount || "",
    ...row,
  };
}

export async function loadTakeoutFile(file: Blob | File): Promise<ParsedTakeout> {
  const parsed = await parseTakeoutZip(file);

  parsed.transactions = parsed.transactions.map(normalize);
  parsed.moneySends = parsed.moneySends.map(normalize);

  return parsed;
}
