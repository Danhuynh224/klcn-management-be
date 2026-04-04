export interface SheetRepository {
  getAllRows<T>(sheetName: string): Promise<T[]>;
  findOne<T>(
    sheetName: string,
    predicate: (row: T) => boolean,
  ): Promise<T | null>;
  insertRow<T>(sheetName: string, row: T): Promise<T>;
  updateRow<T>(sheetName: string, id: string, partial: Partial<T>): Promise<T>;
  deleteRow(sheetName: string, id: string): Promise<void>;
  ensureSheet(sheetName: string, headers: string[]): Promise<void>;
}
