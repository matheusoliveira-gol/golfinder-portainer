/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // Altera a coluna 'rg' para permitir valores nulos
  await knex.schema.alterTable('pessoas', (table) => {
    table.text('rg').nullable().alter();
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  // Reverte a coluna 'rg' para não permitir valores nulos
  // ATENÇÃO: Isso falhará se houver registros com 'rg' nulo no banco.
  await knex.schema.alterTable('pessoas', (table) => {
    table.text('rg').notNullable().alter();
  });
}