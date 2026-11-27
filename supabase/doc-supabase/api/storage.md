# Storage: bucket `documentos`

[← Índice](./README.md) · Errores: [errores.md](./errores.md)

Archivos del expediente (INE, comprobantes, oficios de órdenes de protección). Cada archivo tiene dos partes: el objeto en Storage y su fila en la tabla `documento`.

| Dato | Valor |
|---|---|
| Bucket | `documentos`, **privado** (no hay URL pública) |
| Tamaño máximo | 10 MB |
| Tipos permitidos | `image/jpeg`, `image/png`, `application/pdf` |
| Ruta | `<ficha_id>/<uuid>-<nombre-sanitizado>` (`construirRutaStorage` en `domain/models/DocumentoAdjunto.ts`) |
| Migraciones | `_04_ficha` (bucket), `_07_rls` (select, insert, update), `_16_storage_y_bitacora` (delete), `_63_bloqueo_archivado_hijos` (`ficha_editable`) |

**Quién puede qué**

| Operación | Regla | Roles |
|---|---|---|
| Ver / descargar (`createSignedUrl`) | `expediente.ver` | Tit, Sub, TS, Psi, Jur |
| Subir (`upload`) | `expediente.ver` **y** `ficha_editable` (no archivada) | Tit, Sub, TS, Psi, Jur |
| Reemplazar (`update`) | `expediente.ver` | Tit, Sub, TS, Psi, Jur |
| Borrar (`remove`) | `expediente.ver` **y** ser quien lo subió (`owner_id = auth.uid()`) | Solo quien lo subió |
| Cualquier cosa | — | Rec, UMECA, app: nada |

---

## Subir un documento

El flujo es en dos pasos y no es atómico: si el segundo falla, hay que borrar el archivo del primero.

```ts
const ruta = construirRutaStorage(fichaId, file.name, crypto.randomUUID());

// 1. Subir el archivo
const { error: uploadError } = await supabase.storage
  .from('documentos')
  .upload(ruta, file, { contentType: file.type, upsert: false });
if (uploadError) throw traducirErrorDocumento(uploadError, 'No se pudo subir el archivo.');

// 2. Registrar la fila en documento
const { data, error } = await supabase
  .from('documento')
  .insert({
    ficha_id: fichaId,
    tipo_documento_id: tipoDocumentoId,
    orden_proteccion_id: ordenProteccionId ?? null,
    descripcion: descripcion?.trim() || null,
    ruta_storage: ruta,
    nombre_archivo: file.name,
  })
  .select('id, ficha_id, tipo_documento_id, orden_proteccion_id, descripcion, ruta_storage, nombre_archivo, activo, creado_en, cat_tipo_documento(id, clave, nombre)')
  .single();

// 3. Si falla el insert, limpiar el archivo huérfano
if (error) {
  await supabase.storage.from('documentos').remove([ruta]).catch(() => {});
  throw traducirErrorDocumento(error, 'No se pudo registrar el documento en el expediente.');
}
```

- Valida tipo y tamaño en el navegador antes de subir (`validarArchivo`). Si no, Storage rechaza con 400 (`mime type not supported` o `Payload too large`).
- `upsert: false` evita pisar un archivo con la misma ruta; con el `uuid` en la ruta no debería pasar.
- El paso 3 funciona porque quien sube es dueña del objeto. Así está implementado hoy en `SupabaseDocumentoStorageRepository.subir`.

## Ver o descargar

```ts
const { data, error } = await supabase.storage
  .from('documentos')
  .createSignedUrl(rutaStorage, 60, { download: false });   // 60 segundos
window.open(data.signedUrl, '_blank', 'noopener');
```

- Genera la URL justo al hacer clic, no al cargar la lista: caduca en 60 segundos.
- Para descargar con el nombre original, usa `{ download: nombreArchivo }`.
- Si el documento es sensible, llama además `registrar_consulta('documento', documentoId)` (ver [expedientes.md](./expedientes.md#registrar_consulta)).

## Quitar un documento del expediente

No se borra el archivo: se archiva la fila.

```ts
await supabase.from('documento').update({ activo: false }).eq('id', id).eq('activo', true);
```

- El archivo queda en Storage para trazabilidad, y la fila sale de las listas (`.eq('activo', true)`).
- El `remove` de Storage solo es para limpiar huérfanos del flujo de subida.

## Errores comunes

| Situación | Qué llega | Mensaje UI |
|---|---|---|
| Rol sin `expediente.ver` | Storage 403 / `new row violates row-level security policy` | Fijo de permiso |
| Archivo de más de 10 MB | Storage 413 | "El archivo supera 10 MB." |
| Tipo no permitido | Storage 400 | "Solo se aceptan PDF, JPG o PNG." |
| `remove` de un archivo que subió otra persona | No borra nada (lista vacía, sin error) | No mostrar nada; no es un caso de la UI normal |
| `tipo_documento_id` inexistente | `23503` en el insert | "Selecciona un tipo de documento válido." |
