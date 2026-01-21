import crypto from 'crypto';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable('users', (table) => {
    table.text('id').primary();
    table.text('email').notNullable().unique();
    table.text('password').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable();
  });

  await knex.schema.createTable('profiles', (table) => {
    table.text('id').primary();
    table.text('user_id').notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
    table.text('full_name');
    table.timestamp('created_at', { useTz: true }).notNullable();
  });

  await knex.schema.createTable('user_roles', (table) => {
    table.text('id').primary();
    table.text('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('role').notNullable().checkIn(['admin', 'gestor', 'operador', 'visualizador']);
    table.timestamp('created_at', { useTz: true }).notNullable();
    table.unique(['user_id', 'role']);
  });

  await knex.schema.createTable('pessoas', (table) => {
    table.text('id').primary();
    table.text('nome').notNullable();
    table.text('rg').notNullable();
    table.text('cpf');
    table.text('data_nascimento');
    table.text('nome_mae');
    table.text('nome_pai');
    table.text('observacao');
    table.text('foto_url');
    table.text('residencial');
    table.timestamp('created_at', { useTz: true }).notNullable();
    table.timestamp('updated_at', { useTz: true }).notNullable();
  });

  await knex.schema.createTable('artigos', (table) => {
    table.text('id').primary();
    table.text('numero').notNullable().unique();
    table.text('nome').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable();
    table.timestamp('updated_at', { useTz: true }).notNullable();
  });

  await knex.schema.createTable('condominios', (table) => {
    table.text('id').primary();
    table.text('nome').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable();
  });

  await knex.schema.createTable('pessoas_artigos', (table) => {
    table.text('id').primary();
    table.text('pessoa_id').notNullable().references('id').inTable('pessoas').onDelete('CASCADE');
    table.text('artigo_id').notNullable().references('id').inTable('artigos').onDelete('CASCADE');
    table.timestamp('created_at', { useTz: true }).notNullable();
  });

  await knex.schema.createTable('pessoas_condominios', (table) => {
    table.text('id').primary();
    table.text('pessoa_id').notNullable().references('id').inTable('pessoas').onDelete('CASCADE');
    table.text('condominio_id').notNullable().references('id').inTable('condominios').onDelete('CASCADE');
    table.timestamp('data_vinculo', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable();
    table.timestamp('updated_at', { useTz: true }).notNullable();
  });

  await knex.schema.createTable('group_permissions', (table) => {
    table.text('id').primary();
    table.text('group_role').notNullable().checkIn(['admin', 'gestor', 'operador', 'visualizador']);
    table.text('resource').notNullable();
    table.integer('can_create').defaultTo(0);
    table.integer('can_read').defaultTo(0);
    table.integer('can_update').defaultTo(0);
    table.integer('can_delete').defaultTo(0);
    table.timestamp('created_at', { useTz: true }).notNullable();
    table.timestamp('updated_at', { useTz: true }).notNullable();
    table.unique(['group_role', 'resource']);
  });

  // Initialize default permissions
  const resources = ['pessoas', 'artigos', 'condominios', 'usuarios'];
  const roles = ['admin', 'gestor', 'operador', 'visualizador'];
  const permissions = [];

  for (const role of roles) {
    for (const resource of resources) {
      permissions.push({
        id: crypto.randomUUID(),
        group_role: role,
        resource: resource,
        can_create: (role === 'admin' || role === 'gestor') ? 1 : 0,
        can_read: 1,
        can_update: (role === 'admin' || role === 'gestor' || role === 'operador') ? 1 : 0,
        can_delete: (role === 'admin') ? 1 : 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }
  await knex('group_permissions').insert(permissions);
  console.log('✓ Default permissions initialized via migration');
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  // Drop tables in reverse order of creation
  await knex.schema.dropTableIfExists('group_permissions');
  await knex.schema.dropTableIfExists('pessoas_condominios');
  await knex.schema.dropTableIfExists('pessoas_artigos');
  await knex.schema.dropTableIfExists('condominios');
  await knex.schema.dropTableIfExists('artigos');
  await knex.schema.dropTableIfExists('pessoas');
  await knex.schema.dropTableIfExists('user_roles');
  await knex.schema.dropTableIfExists('profiles');
  await knex.schema.dropTableIfExists('users');
}