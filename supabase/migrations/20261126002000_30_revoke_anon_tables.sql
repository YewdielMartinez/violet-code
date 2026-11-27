-- =====================================================================
-- 30_revoke_anon_tables.sql (Hardening LGPDPPSO / Defensa en profundidad)
-- Revoca explícitamente los privilegios por defecto del rol `anon` sobre
-- todas las tablas, vistas y secuencias de `public`, y configura
-- DEFAULT PRIVILEGES para objetos futuros. Ningún endpoint anónimo puede
-- consultar o mutar tablas operativas o catálogos sin autenticación.
-- =====================================================================

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
