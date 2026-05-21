import { NextResponse } from 'next/server';
import { DEFAULT_STATIONS } from '@/lib/stations';

export const runtime = 'nodejs';

export async function GET() {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Optimizador de Vuelos';
  workbook.created = new Date();

  const BRAND = 'E65100';
  const BRAND_LIGHT = 'FFF3E0';
  const HEADER_FILL: import('exceljs').Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + BRAND } };
  const HEADER_FONT: Partial<import('exceljs').Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
  const NOTE_FILL: import('exceljs').Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9E6' } };
  const NOTE_FONT: Partial<import('exceljs').Font> = { italic: true, color: { argb: 'FF8B7000' }, size: 10, name: 'Calibri' };
  const CELL_BORDER: Partial<import('exceljs').Borders> = {
    top: { style: 'thin', color: { argb: 'FFD0D5DD' } },
    bottom: { style: 'thin', color: { argb: 'FFD0D5DD' } },
    left: { style: 'thin', color: { argb: 'FFD0D5DD' } },
    right: { style: 'thin', color: { argb: 'FFD0D5DD' } },
  };
  const ALT_ROW: import('exceljs').Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + BRAND_LIGHT } };
  const PAX_FILL: import('exceljs').Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
  const CARGO_FILL: import('exceljs').Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };

  const wsConfig = workbook.addWorksheet('Configuracion', { properties: { tabColor: { argb: 'FF' + BRAND } } });
  wsConfig.columns = [
    { header: 'Clave', key: 'Clave', width: 30 },
    { header: 'Valor', key: 'Valor', width: 20 },
    { header: 'Descripción', key: 'Descripcion', width: 55 },
  ];
  const cfgHeader = wsConfig.getRow(1);
  cfgHeader.eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT; c.border = CELL_BORDER; c.alignment = { vertical: 'middle' }; });
  cfgHeader.height = 28;

  [
    { Clave: 'helicopterCapacity', Valor: 4, Descripcion: 'Asientos disponibles en el helicóptero (sin contar tripulación)' },
    { Clave: 'helicopterMaxWeight', Valor: 500, Descripcion: 'Peso máximo de carga útil en kilogramos' },
    { Clave: 'refuelEnabled', Valor: 'FALSE', Descripcion: 'Activar sistema de reabastecimiento de combustible (TRUE / FALSE)' },
    { Clave: 'refuelMaxFlightDistance', Valor: 80, Descripcion: 'Autonomía máxima en km antes de regresar a base para reabastecerse' },
  ].forEach((row, i) => {
    const rowItem = wsConfig.addRow(row);
    rowItem.eachCell(c => { c.border = CELL_BORDER; c.alignment = { vertical: 'middle', wrapText: true }; });
    if (i % 2 === 1) rowItem.eachCell(c => { c.fill = ALT_ROW; });
  });

  const cfgNote = wsConfig.addRow({ Clave: '', Valor: '', Descripcion: '' });
  wsConfig.mergeCells(`A${cfgNote.number}:C${cfgNote.number}`);
  const cfgNoteCell = wsConfig.getCell(`A${cfgNote.number}`);
  cfgNoteCell.value = '⚠ No cambiar los valores de la columna "Clave". Solo modificar la columna "Valor".';
  cfgNoteCell.fill = NOTE_FILL;
  cfgNoteCell.font = NOTE_FONT;
  cfgNoteCell.border = CELL_BORDER;

  wsConfig.addRow({});
  const stTitle = wsConfig.addRow({ Clave: 'REFERENCIA DE ESTACIONES' });
  wsConfig.mergeCells(`A${stTitle.number}:C${stTitle.number}`);
  stTitle.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF' + BRAND } };

  // Station table header: Nombre | ID (Slug) | X (km) | Y (km) | Base?
  const stHeader = wsConfig.addRow({ Clave: 'Nombre de Estación', Valor: 'ID (Slug)', Descripcion: 'Coordenadas' });
  stHeader.eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT; c.border = CELL_BORDER; });

  DEFAULT_STATIONS.forEach((station, index) => {
    const desc = station.isBase
      ? `BASE — Origen 0,0 km · Usar en origen o destino como "${station.name}"`
      : `X: ${station.x > 0 ? '+' : ''}${station.x} km · Y: ${station.y > 0 ? '+' : ''}${station.y} km · Dist. base ≈ ${Math.round(Math.sqrt(station.x * station.x + station.y * station.y))} km`;
    const rowItem = wsConfig.addRow({ Clave: station.name, Valor: station.id, Descripcion: desc });
    rowItem.eachCell(c => { c.border = CELL_BORDER; c.alignment = { vertical: 'middle' }; });
    if (index % 2 === 1) rowItem.eachCell(c => { c.fill = ALT_ROW; });
    if (station.isBase) rowItem.getCell(1).font = { bold: true, color: { argb: 'FF' + BRAND } };
  });

  const wsItems = workbook.addWorksheet('Items', { properties: { tabColor: { argb: 'FF2E7D32' } } });
  wsItems.columns = [
    { header: 'area', key: 'area', width: 20 },
    { header: 'tipo', key: 'tipo', width: 10 },
    { header: 'turno', key: 'turno', width: 10 },
    { header: 'prioridad', key: 'prioridad', width: 12 },
    { header: 'cantidad', key: 'cantidad', width: 12 },
    { header: 'origen', key: 'origen', width: 22 },
    { header: 'destino', key: 'destino', width: 22 },
    { header: 'peso', key: 'peso', width: 12 },
    { header: 'descripcion', key: 'descripcion', width: 36 },
  ];

  const itmHeader = wsItems.getRow(1);
  itmHeader.eachCell(c => { c.fill = HEADER_FILL; c.font = HEADER_FONT; c.border = CELL_BORDER; c.alignment = { vertical: 'middle' }; });
  itmHeader.height = 28;

  const base = DEFAULT_STATIONS.find(s => s.isBase)!;
  const nonBase = DEFAULT_STATIONS.filter(s => !s.isBase);

  [
    { area: 'Perforación', tipo: 'PAX', turno: 'M', prioridad: 'ALTA', cantidad: 3, origen: base.name, destino: nonBase[1].name, peso: '', descripcion: '' },
    { area: 'Geología', tipo: 'PAX', turno: 'M', prioridad: 'MEDIA', cantidad: 2, origen: base.name, destino: nonBase[3].name, peso: '', descripcion: '' },
    { area: 'Logística', tipo: 'CARGO', turno: 'M', prioridad: 'ALTA', cantidad: 1, origen: base.name, destino: nonBase[2].name, peso: 120, descripcion: 'Tubería HDD 6"' },
    { area: 'Mantenimiento', tipo: 'PAX', turno: 'T', prioridad: 'MEDIA', cantidad: 1, origen: nonBase[2].name, destino: base.name, peso: '', descripcion: '' },
    { area: 'Medio Ambiente', tipo: 'PAX', turno: 'M', prioridad: 'BAJA', cantidad: 2, origen: base.name, destino: nonBase[6].name, peso: '', descripcion: '' },
    { area: 'Obras Civiles', tipo: 'CARGO', turno: 'T', prioridad: 'MEDIA', cantidad: 1, origen: base.name, destino: nonBase[5].name, peso: 200, descripcion: 'Cemento y herramientas' },
    { area: 'Seguridad', tipo: 'PAX', turno: 'T', prioridad: 'ALTA', cantidad: 4, origen: nonBase[1].name, destino: base.name, peso: '', descripcion: '' },
    { area: 'Campamento', tipo: 'CARGO', turno: 'M', prioridad: 'BAJA', cantidad: 1, origen: base.name, destino: nonBase[4].name, peso: 85, descripcion: 'Víveres y agua' },
  ].forEach(row => {
    const rowItem = wsItems.addRow(row);
    const fill = row.tipo === 'PAX' ? PAX_FILL : CARGO_FILL;
    rowItem.eachCell({ includeEmpty: true }, c => { c.border = CELL_BORDER; c.alignment = { vertical: 'middle' }; c.fill = fill; });
  });

  wsItems.addRow({});
  [
    '📋 INSTRUCCIONES:',
    '• "area": Nombre del área o departamento solicitante.',
    '• "tipo": Escribir PAX (pasajeros) o CARGO (carga). No se mezclan en un mismo vuelo.',
    '• "turno": M = Mañana, T = Tarde. Los turnos no se mezclan.',
    '• "prioridad": ALTA (Máxima urgencia), MEDIA (Estándar), BAJA (Baja prioridad).',
    '• "cantidad": Solo para PAX, indicar número de personas.',
    '• "origen" / "destino": Nombre completo de la estación (ej: "BO Nuevo Mundo"). Ver tabla en hoja Configuracion.',
    '• "peso": Solo para CARGO, peso en kg. PAX usa peso estándar configurado.',
    '• "descripcion": Opcional. Detalle de la carga.',
    '',
    '💡 También se puede escribir el ID (slug) de la estación (ej: "bo-nuevo-mundo") en origen/destino.',
    '💡 Las filas de ejemplo arriba pueden ser eliminadas o reemplazadas con datos reales.',
  ].forEach(text => {
    const rowItem = wsItems.addRow({ area: text });
    wsItems.mergeCells(`A${rowItem.number}:I${rowItem.number}`);
    rowItem.getCell(1).font = text.startsWith('📋') || text.startsWith('💡') ? { bold: true, size: 10 } : { italic: true, size: 10, color: { argb: 'FF555555' } };
    rowItem.getCell(1).fill = NOTE_FILL;
  });

  const wsItemsAny = wsItems as any;
  wsItemsAny.dataValidations.add('B2:B200', {
    type: 'list', allowBlank: false, formulae: ['"PAX,CARGO"'],
    showErrorMessage: true, errorTitle: 'Tipo inválido', error: 'Solo PAX o CARGO.',
  });
  wsItemsAny.dataValidations.add('C2:C200', {
    type: 'list', allowBlank: false, formulae: ['"M,T"'],
    showErrorMessage: true, errorTitle: 'Turno inválido', error: 'Solo M (Mañana) o T (Tarde).',
  });
  wsItemsAny.dataValidations.add('D2:D200', {
    type: 'list', allowBlank: false, formulae: ['"ALTA,MEDIA,BAJA"'],
    showErrorMessage: true, errorTitle: 'Prioridad inválida', error: 'Solo ALTA, MEDIA o BAJA.',
  });

  wsItems.views = [{ state: 'frozen', ySplit: 1 }];
  wsConfig.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla_vuelos.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}