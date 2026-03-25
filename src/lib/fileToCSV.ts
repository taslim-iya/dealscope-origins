import * as XLSX from "xlsx";

/**
 * Converts an uploaded file (CSV or Excel) to a CSV string.
 */
export async function fileToCSV(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".csv")) {
    return await file.text();
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_csv(firstSheet);
  }

  throw new Error("Unsupported file type. Please upload a CSV or Excel file.");
}
