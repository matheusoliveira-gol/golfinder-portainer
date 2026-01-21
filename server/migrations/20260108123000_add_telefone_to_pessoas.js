/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable('pessoas', (table) => {
    table.string('telefone'); // Adiciona a nova coluna 'telefone' do tipo string
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('pessoas', (table) => {
    table.dropColumn('telefone'); // Remove a coluna 'telefone' em caso de rollback
  });
}