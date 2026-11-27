/** Id del contenedor de impresión que se monta en `<body>` solo mientras se imprime. */
export const PRINT_ROOT_ID = 'vc-print-root';

/**
 * Hoja de estilos de la vista de impresión. Todo cuelga de `#vc-print-root` y usa colores fijos (fondo blanco, texto
 * oscuro) para que el PDF salga igual con el tema claro, oscuro o negro de la aplicación. Sigue la línea de diseño de la
 * app (paleta salmverse: vino #850E35, rosa #FFD8E0 y #FBF7F7; DM Sans y Geist Mono) en tonos que contrastan sobre
 * papel. En pantalla el contenedor está oculto; al imprimir se oculta el resto de la aplicación.
 */
export const PRINT_CSS = `
@page { size: auto; margin: 16mm; @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 500 8pt "Geist Mono", ui-monospace, monospace; color: #4a4a4a; } }

#${PRINT_ROOT_ID} { display: none; }

@media print {
  html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; color: #1f1a1c !important; }
  body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
  #${PRINT_ROOT_ID} { display: block !important; }
}

#${PRINT_ROOT_ID}, #${PRINT_ROOT_ID} * {
  box-sizing: border-box;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

#${PRINT_ROOT_ID} {
  color-scheme: light;
  background: #fff;
  color: #1f1a1c;
  font: 10pt/1.45 "DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
}

#${PRINT_ROOT_ID} .vcp-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 2.5px solid #850e35; }
#${PRINT_ROOT_ID} .vcp-brandline { display: flex; align-items: center; gap: 10px; min-width: 0; }
#${PRINT_ROOT_ID} .vcp-logo-app { display: block; width: 13mm; height: 13mm; object-fit: contain; flex: none; }
#${PRINT_ROOT_ID} .vcp-logo-ahome { display: block; height: 11mm; width: auto; object-fit: contain; flex: none; }
#${PRINT_ROOT_ID} .vcp-brand { margin: 0; font-size: 13pt; font-weight: 700; letter-spacing: .04em; color: #850e35; line-height: 1.15; }
#${PRINT_ROOT_ID} .vcp-inst { margin: 1px 0 0; font-size: 8.5pt; color: #4a4a4a; }

#${PRINT_ROOT_ID} .vcp-titles { margin: 0 0 10px; }
#${PRINT_ROOT_ID} .vcp-title { margin: 0; font-size: 19pt; font-weight: 700; line-height: 1.2; color: #850e35; letter-spacing: -.01em; }
#${PRINT_ROOT_ID} .vcp-sub { margin: 3px 0 0; font-size: 10.5pt; color: #3d3d3d; }

#${PRINT_ROOT_ID} .vcp-meta { display: flex; flex-wrap: wrap; gap: 5px 6px; margin: 0 0 12px; padding: 0; }
#${PRINT_ROOT_ID} .vcp-meta div { display: inline-flex; gap: 5px; min-width: 0; padding: 2px 10px; border: 1px solid #ffd8e0; border-radius: 999px; background: #fbf7f7; font-size: 8.5pt; }
#${PRINT_ROOT_ID} .vcp-meta dt { margin: 0; font-weight: 700; color: #5c0a25; white-space: nowrap; }
#${PRINT_ROOT_ID} .vcp-meta dd { margin: 0; min-width: 0; overflow-wrap: anywhere; color: #1f1a1c; }

#${PRINT_ROOT_ID} .vcp-kpis { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 14px; padding: 0; }
#${PRINT_ROOT_ID} .vcp-kpi { flex: 1 1 30mm; min-width: 30mm; margin: 0; padding: 8px 12px; border: 1px solid #ffd8e0; border-radius: 12px; background: #fbf7f7; break-inside: avoid; }
#${PRINT_ROOT_ID} .vcp-kpi dt { margin: 0; font-size: 8pt; font-weight: 500; color: #4a4a4a; }
#${PRINT_ROOT_ID} .vcp-kpi dd { margin: 1px 0 0; font: 600 16pt/1.2 "Geist Mono", ui-monospace, monospace; color: #850e35; }
#${PRINT_ROOT_ID} .vcp-kpi p { margin: 2px 0 0; font-size: 7.5pt; color: #4a4a4a; }

#${PRINT_ROOT_ID} .vcp-charts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0 0 14px; }
#${PRINT_ROOT_ID} .vcp-chart { margin: 0; padding: 9px 12px 10px; border: 1px solid #ffd8e0; border-radius: 12px; background: #fff; break-inside: avoid; page-break-inside: avoid; }
#${PRINT_ROOT_ID} .vcp-chart--full { grid-column: 1 / -1; }
#${PRINT_ROOT_ID} .vcp-chart figcaption { margin: 0 0 5px; font-size: 9.5pt; font-weight: 700; color: #5c0a25; }
#${PRINT_ROOT_ID} .vcp-chart svg { display: block; width: 100%; height: auto; max-height: 70mm; overflow: visible; background: #fff; }
#${PRINT_ROOT_ID} .vcp-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 5px 0 0; padding: 0; list-style: none; font-size: 8pt; color: #333; }
#${PRINT_ROOT_ID} .vcp-legend li { display: inline-flex; align-items: center; gap: 4px; }
#${PRINT_ROOT_ID} .vcp-swatch { display: inline-block; width: 8px; height: 8px; border-radius: 2px; }
#${PRINT_ROOT_ID} .vcp-bars { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; font-size: 8.5pt; }
#${PRINT_ROOT_ID} .vcp-bars li { display: grid; grid-template-columns: minmax(18mm, 38%) minmax(0, 1fr) auto; align-items: center; gap: 6px; }
#${PRINT_ROOT_ID} .vcp-bars__label { overflow-wrap: anywhere; color: #333; }
#${PRINT_ROOT_ID} .vcp-bars__track { display: block; height: 8px; border-radius: 4px; background: #ffd8e0; overflow: hidden; }
#${PRINT_ROOT_ID} .vcp-bars__fill { display: block; height: 100%; border-radius: 4px; background: #850e35; }
#${PRINT_ROOT_ID} .vcp-bars__value { font: 600 8.5pt "Geist Mono", ui-monospace, monospace; text-align: right; }

#${PRINT_ROOT_ID} .vcp-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 9pt; }
#${PRINT_ROOT_ID} .vcp-table caption { caption-side: top; padding: 0 0 5px; text-align: left; font-size: 9.5pt; font-weight: 700; color: #5c0a25; }
#${PRINT_ROOT_ID} .vcp-table thead { display: table-header-group; }
#${PRINT_ROOT_ID} .vcp-table tfoot { display: table-footer-group; }
#${PRINT_ROOT_ID} .vcp-table th { padding: 6px 9px; border-bottom: 2px solid #850e35; background: #ffd8e0; text-align: left; font-weight: 700; color: #4a0a1f; }
#${PRINT_ROOT_ID} .vcp-table th:first-child { border-top-left-radius: 8px; }
#${PRINT_ROOT_ID} .vcp-table th:last-child { border-top-right-radius: 8px; }
#${PRINT_ROOT_ID} .vcp-table td { padding: 5px 9px; border-bottom: 1px solid #f0e2e5; vertical-align: top; overflow-wrap: anywhere; }
#${PRINT_ROOT_ID} .vcp-table tr { break-inside: avoid; page-break-inside: avoid; }
#${PRINT_ROOT_ID} .vcp-table tbody tr:nth-child(even) td { background: #fbf7f7; }
#${PRINT_ROOT_ID} .vcp-table tr.vcp-total td { font-weight: 700; background: #ffd8e0; border-top: 1.5px solid #850e35; color: #4a0a1f; }
#${PRINT_ROOT_ID} .vcp-table .vcp-num { text-align: right; white-space: nowrap; font-family: "Geist Mono", ui-monospace, monospace; font-size: 8.5pt; }
#${PRINT_ROOT_ID} .vcp-table th.vcp-num { font-family: inherit; font-size: inherit; }
#${PRINT_ROOT_ID} .vcp-table .vcp-mono { font-family: "Geist Mono", ui-monospace, monospace; font-size: 8pt; }

#${PRINT_ROOT_ID} .vcp-footer { position: fixed; left: 0; right: 30mm; bottom: -12.5mm; display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; padding-top: 3px; border-top: 1px solid #ffd8e0; font-size: 7.5pt; color: #4a4a4a; background: #fff; }
#${PRINT_ROOT_ID} .vcp-footer__brand { display: flex; align-items: center; gap: 5px; min-width: 0; }
#${PRINT_ROOT_ID} .vcp-footer__mark { display: block; width: 5mm; height: 5mm; object-fit: contain; flex: none; }
#${PRINT_ROOT_ID} .vcp-footer__text { display: grid; line-height: 1.3; }
#${PRINT_ROOT_ID} .vcp-footer__text strong { font-weight: 700; color: #850e35; }
#${PRINT_ROOT_ID} .vcp-footer__when { font-family: "Geist Mono", ui-monospace, monospace; text-align: right; white-space: nowrap; }
`;
