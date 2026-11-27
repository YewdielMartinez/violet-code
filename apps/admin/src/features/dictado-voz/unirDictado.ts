/**
 * Anexa una transcripción revisada al texto que ya tiene el campo, separada por una línea en blanco.
 * Nunca reemplaza lo escrito a mano. Devuelve también si hubo que recortar para respetar `maxLength`.
 */
export function unirDictado(
  texto: string,
  dictado: string,
  maxLength = Number.POSITIVE_INFINITY,
): { texto: string; recortado: boolean } {
  const unido = [texto.trimEnd(), dictado.trim()].filter(Boolean).join('\n\n');
  if (unido.length <= maxLength) return { texto: unido, recortado: false };
  return { texto: unido.slice(0, maxLength), recortado: true };
}
