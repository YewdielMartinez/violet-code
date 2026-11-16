using VioletCode.Modules.Catalogs.Domain;

namespace VioletCode.Modules.Catalogs.Infrastructure;

/// <summary>
/// DATOS SINTÉTICOS. Nombres, teléfonos y direcciones son ficticios. Las coordenadas son aproximadas
/// en Los Mochis solo para que el mapa se vea en la demo.
/// Sustituir por el directorio oficial que entregue SEMUJERES.
/// </summary>
internal static class SyntheticSeed
{
    public static IEnumerable<DirectoryEntry> Entries() =>
    [
        DirectoryEntry.Create(EntryKind.Institution, "Emergencias 911", "Línea nacional de emergencias.", "911", null, "24 h", null, null, isEmergency: true),
        DirectoryEntry.Create(EntryKind.Institution, "Atención a la Mujer (sintético)", "Orientación jurídica, psicológica y de trabajo social.", "668-000-0001", "Calle Ficticia 100, Centro", "Lun a Vie 8:00 a 15:00", 25.7905, -108.9860, false),
        DirectoryEntry.Create(EntryKind.Institution, "Asesoría Jurídica (sintético)", "Acompañamiento legal.", "668-000-0002", "Av. Ejemplo 200", "Lun a Vie 9:00 a 14:00", 25.7930, -108.9921, false),
        DirectoryEntry.Create(EntryKind.Institution, "Centro de Salud (sintético)", "Atención médica.", "668-000-0003", "Blvd. Demo 300", "24 h", 25.7869, -108.9805, false),
        DirectoryEntry.Create(EntryKind.VioletPoint, "Punto Violeta · Farmacia Demo", "Espacio seguro para pedir ayuda.", "668-000-0101", "Calle Prueba 12", "Diario 7:00 a 23:00", 25.7951, -108.9902, false),
        DirectoryEntry.Create(EntryKind.VioletPoint, "Punto Violeta · Tienda Demo", "Espacio seguro para pedir ayuda.", "668-000-0102", "Av. Simulada 45", "24 h", 25.7884, -108.9947, false),
        DirectoryEntry.Create(EntryKind.VioletPoint, "Punto Violeta · Biblioteca Demo", "Espacio seguro para pedir ayuda.", null, "Calle Muestra 8", "Lun a Sáb 9:00 a 19:00", 25.7998, -108.9851, false),
    ];
}
