import { TableCell as TiptapTableCell } from "@tiptap/extension-table";

export const TableCell = TiptapTableCell.extend({
  name: "tableCell",
  content: "paragraph+",
});
