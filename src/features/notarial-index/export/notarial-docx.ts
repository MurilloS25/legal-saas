import "server-only";

import {
  AlignmentType,
  BorderStyle,
  Document,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { NotarialIndexRow } from "../model/notarial-index-row";
import type { FortnightSelection } from "../model/fortnight";
import {
  centimetersToTwip,
  DOCX_DEFAULT_FORMATTING,
  LEGAL_PAGE_SIZE_TWIPS,
  type DocumentFormattingPreferences,
} from "@/lib/documents/docx/formatting";
import {
  formatIndexDate,
  formatIndexTime,
  formatNotarialGenerationDate,
  notarialFortnightLabel,
  notarialMonthName,
} from "../model/formatters";

const HEADERS = [
  "Tomo",
  "Folio Inicial",
  "Folio Final",
  "Número",
  "Fecha",
  "Hora",
  "Acto o Contrato",
  "Partes",
] as const;
const COLUMN_WIDTHS = [700, 950, 950, 750, 1250, 900, 3400, 6300] as const;
// `docx` swaps the supplied dimensions when landscape is selected. Supplying
// portrait Legal dims here (papel Legal fijo para todo DOCX generado)
// produces the intended landscape OOXML page.
const PAGE_WIDTH_INPUT = LEGAL_PAGE_SIZE_TWIPS.width;
const PAGE_HEIGHT_INPUT = LEGAL_PAGE_SIZE_TWIPS.height;
const CELL_MARGIN = { top: 70, bottom: 70, left: 80, right: 80 };
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const BORDERS = {
  top: BORDER,
  bottom: BORDER,
  left: BORDER,
  right: BORDER,
  insideHorizontal: BORDER,
  insideVertical: BORDER,
};

// El interlineado fijo (24pt exacto) y la alineación justificada del cuerpo
// documental (`FIXED_BODY_LINE_SPACING`/`FIXED_BODY_ALIGNMENT`,
// `formatting.ts`) no se aplican aquí a propósito: este documento no tiene
// párrafos de cuerpo con texto que fluye — es un título, una tabla y un pie,
// todos de una sola línea y explícitamente centrados. Justificar una sola
// línea no tiene efecto visible, y esa centrado es la estructura correcta
// para este documento, no una excepción a romper.

type Input = {
  rows: readonly NotarialIndexRow[];
  selection: FortnightSelection;
  notaryName: string;
  generatedAt?: Date;
  /**
   * Preferencias de formato del dueño (ver `formatting.ts`); defaults si se
   * omite. Solo la familia de fuente y los márgenes se heredan aquí: los
   * tamaños de texto (16/18/20 medios puntos) son deliberadamente fijos por
   * elemento — la tabla y sus anchos de columna están ajustados a esos
   * tamaños específicos, y el tamaño de fuente configurado en Configuración
   * está pensado para el cuerpo de una Escritura, no para una tabla
   * horizontal densa.
   */
  formatting?: DocumentFormattingPreferences;
};

function cell(
  text: string,
  width: number,
  fontFamily: string,
  bold = false,
): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: CELL_MARGIN,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text, bold, size: 16, font: fontFamily })],
      }),
    ],
  });
}

function rowCells(row: NotarialIndexRow): string[] {
  return [
    row.protocol_book ?? "",
    row.initial_folio ?? "",
    row.final_folio ?? "",
    row.instrument_number ? String(row.instrument_number) : "",
    formatIndexDate(row.authorized_at),
    formatIndexTime(row.authorized_at),
    row.act_name?.toLocaleUpperCase("es-CR") ?? "",
    row.parties?.toLocaleUpperCase("es-CR") ?? "",
  ];
}

export async function generateNotarialIndexDocx({
  rows,
  selection,
  notaryName,
  generatedAt = new Date(),
  formatting = DOCX_DEFAULT_FORMATTING,
}: Input): Promise<Buffer> {
  const fontFamily = formatting.fontFamily;
  const safeName = notaryName.trim();
  const title =
    `Índice de instrumentos autorizados por el Notario ${safeName} ` +
    `de la ${notarialFortnightLabel(selection.half)} del mes de ` +
    `${notarialMonthName(selection.month)} del ${selection.year}.`;
  const tableRows = [
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: HEADERS.map((header, index) =>
        cell(header, COLUMN_WIDTHS[index], fontFamily, true),
      ),
    }),
    ...rows.map(
      (row) =>
        new TableRow({
          cantSplit: true,
          children: rowCells(row).map((value, index) =>
            cell(value, COLUMN_WIDTHS[index], fontFamily),
          ),
        }),
    ),
  ];

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({ text: title, bold: true, size: 20, font: fontFamily }),
      ],
    }),
    new Table({
      width: { size: COLUMN_WIDTHS.reduce((sum, value) => sum + value, 0), type: WidthType.DXA },
      columnWidths: [...COLUMN_WIDTHS],
      layout: TableLayoutType.FIXED,
      borders: BORDERS,
      rows: tableRows,
    }),
    ...(rows.length === 0
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 180 },
            children: [
              new TextRun({
                text: "No hay instrumentos registrados para esta quincena.",
                italics: true,
                size: 18,
                font: fontFamily,
              }),
            ],
          }),
        ]
      : []),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 360, after: 120 },
      children: [
        new TextRun({
          text: formatNotarialGenerationDate(generatedAt),
          size: 20,
          font: fontFamily,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `LIC. ${safeName.toLocaleUpperCase("es-CR")}`,
          bold: true,
          size: 20,
          font: fontFamily,
        }),
      ],
    }),
  ];

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: PAGE_WIDTH_INPUT,
              height: PAGE_HEIGHT_INPUT,
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: centimetersToTwip(formatting.marginsCm.front.top),
              right: centimetersToTwip(formatting.marginsCm.front.right),
              bottom: centimetersToTwip(formatting.marginsCm.front.bottom),
              left: centimetersToTwip(formatting.marginsCm.front.left),
            },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(document);
}
