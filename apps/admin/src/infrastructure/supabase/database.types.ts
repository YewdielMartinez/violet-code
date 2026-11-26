// ARCHIVO PROVISIONAL: se sobrescribe al generar los tipos. No editar a mano.
//
// Con Docker Desktop abierto, desde la raíz del repo:
//   npx supabase start
//   npx supabase db reset
//   npm run gen:types -w @violet-code/admin
//
// Mientras tanto, este esqueleto permite compilar `client.ts` (tablas sin tipar).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
