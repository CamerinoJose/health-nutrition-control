# Guía de Migración PostgreSQL

> Guía histórica: no refleja la migración de agenda en desarrollo ni el estado
> actual de producción. **No ejecutar los comandos destructivos de este
> documento** sin un plan y autorización explícita. Consulta
> `../TAREAS_PENDIENTES.md` antes de cualquier migración o limpieza de datos.

## Estado Actual
- ✅ Tablas creadas en PostgreSQL
- ✅ Algunos datos importados (users, recipes, health_profiles, nutritionist_availability, deleted_messages)
- 🔄 Pendiente: importar resto de datos con integridad referencial

## Problemas Identificados

### 1. Columna Faltante
- `appointments.nutritionist_id` no estaba en el schema original
- **Solución:** Agregada en `fix_postgres_migration.sql`

### 2. Datos con Referencias Inválidas
- Algunos registros referencian IDs que no existen
- **Solución:** Script de verificación incluido en `fix_postgres_migration.sql`

### 3. Valores NULL o Vacíos
- Algunos campos tienen valores vacíos (`""`) en lugar de NULL
- **Solución:** Updates para normalizar en `fix_postgres_migration.sql`

## Pasos para Completar la Migración

### Opción A: Migración Completa (Recomendado)

```bash
# 1. Conectar a PostgreSQL
psql -U tu_usuario -d bienestarapp

# 2. (Opcional) Limpiar y recrear si es necesario
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

# 3. Crear tablas
\i create_tables_postgres.sql

# 4. Corregir estructura (agregar columnas faltantes)
\i fix_postgres_migration.sql

# 5. Importar datos
\i import_data_postgres.sql

# 6. Verificar integridad
SELECT table_name, COUNT(*) 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
GROUP BY table_name;
```

### Opción B: Continuar desde donde está

```bash
# 1. Conectar a PostgreSQL
psql -U tu_usuario -d bienestarapp

# 2. Solo agregar lo que falta
\i fix_postgres_migration.sql

# 3. Importar datos faltantes (editar rutas en import_data_postgres.sql primero)
\i import_data_postgres.sql
```

## Verificación de Datos

### Contar registros por tabla
```sql
SELECT 'users' as tabla, COUNT(*) as registros FROM users
UNION ALL
SELECT 'appointments', COUNT(*) FROM appointments
UNION ALL
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'meal_plans', COUNT(*) FROM meal_plans
UNION ALL
SELECT 'recipes', COUNT(*) FROM recipes
UNION ALL
SELECT 'food_logs', COUNT(*) FROM food_logs
UNION ALL
SELECT 'health_profiles', COUNT(*) FROM health_profiles;
```

### Verificar integridad referencial
```sql
-- Buscar registros huérfanos
SELECT 'appointments sin user_id' as problema, COUNT(*) as cantidad
FROM appointments 
WHERE user_id NOT IN (SELECT id FROM users)
UNION ALL
SELECT 'messages sin sender', COUNT(*)
FROM messages 
WHERE sender_id NOT IN (SELECT id FROM users)
UNION ALL
SELECT 'notifications sin user', COUNT(*)
FROM notifications 
WHERE user_id NOT IN (SELECT id FROM users);
```

## Configuración Backend para PostgreSQL

En tu archivo `.env` o `.env.local`:

```bash
DATABASE_URL=postgresql://usuario:password@localhost:5432/bienestarapp
# O para producción (Render):
# DATABASE_URL=postgresql://usuario:password@host-externo/database
```

## Troubleshooting

### Error: "column does not exist"
- Ejecutar `fix_postgres_migration.sql` primero

### Error: "violates foreign key constraint"
- Verificar que los datos padres existan (users, appointments, etc.)
- Usar queries de verificación arriba

### Error: "invalid input syntax for type"
- Revisar encoding del CSV (debe ser UTF-8)
- Usar `fix_encoding.sql` si es necesario

### Error: "extra data after last expected column"
- El CSV tiene más columnas que la tabla
- Verificar que el header del CSV coincida con las columnas de la tabla

## Archivos Relacionados

- `create_tables_postgres.sql` - Creación de tablas
- `fix_postgres_migration.sql` - Correcciones de estructura y limpieza
- `import_data_postgres.sql` - Scripts de importación
- `fix_encoding.sql` - Conversión de encoding (si se necesita)
- `*.csv` - Datos exportados de SQLite

## Notas Importantes

1. **Backups:** Siempre hacer backup antes de ejecutar scripts de migración
2. **Rutas:** Ajustar rutas de archivos CSV según tu sistema operativo
3. **Permisos:** Asegurar que PostgreSQL tenga permisos de lectura en los CSV
4. **Encoding:** Todos los CSV deben estar en UTF-8
5. **IDs:** Los IDs se mantienen para preservar relaciones entre tablas
