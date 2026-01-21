import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const { Pool } = pg;

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const db = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

console.log('Attempting to connect to PostgreSQL...');

// CRITICAL: Encryption key MUST be set in environment
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be exactly 32 characters and set in .env file. Generate one with: openssl rand -hex 16');
}

// CRITICAL: JWT secret MUST be set in environment
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in .env file. Generate one with: openssl rand -hex 32');
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const SENSITIVE_FIELDS = ['nome', 'cpf', 'nome_mae', 'nome_pai', 'observacao'];

// Whitelists de colunas permitidas por tabela (proteção contra SQL injection)
const COLUMN_WHITELISTS = {
  users: ['id', 'email', 'password', 'created_at'],
  profiles: ['id', 'user_id', 'full_name', 'created_at'],
  user_roles: ['id', 'user_id', 'role', 'created_at'],
  pessoas: ['id', 'nome', 'rg', 'cpf', 'data_nascimento', 'nome_mae', 'nome_pai', 'observacao', 'foto_url', 'residencial', 'created_at', 'updated_at'],
  artigos: ['id', 'numero', 'nome', 'created_at', 'updated_at'],
  condominios: ['id', 'nome', 'created_at'],
  pessoas_artigos: ['id', 'pessoa_id', 'artigo_id', 'created_at'],
  pessoas_condominios: ['id', 'pessoa_id', 'condominio_id', 'data_vinculo', 'created_at', 'updated_at'],
  group_permissions: ['id', 'group_role', 'resource', 'can_create', 'can_read', 'can_update', 'can_delete', 'created_at', 'updated_at'],
};

// Criptografia AES-256-GCM
function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!text) return null;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    return null;
  }
}

// Validar colunas contra whitelist
function validateColumns(table, columns) {
  const whitelist = COLUMN_WHITELISTS[table];
  if (!whitelist) {
    throw new Error('Invalid table');
  }
  
  for (const col of columns) {
    if (!whitelist.includes(col)) {
      throw new Error(`Invalid column: ${col}`);
    }
  }
  return true;
}

// Middleware de autenticação JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// ============= ENDPOINTS PÚBLICOS (SEM AUTENTICAÇÃO) =============

// Endpoint de login (público)
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const userRes = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userRes.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Gerar JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Buscar perfil e role
    const profileRes = await db.query('SELECT * FROM profiles WHERE user_id = $1', [user.id]);
    const profile = profileRes.rows[0];
    const userRoleRes = await db.query('SELECT role FROM user_roles WHERE user_id = $1', [user.id]);
    const userRole = userRoleRes.rows[0];

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name || null,
        role: userRole?.role || null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint para verificar se sistema precisa de inicialização
app.get('/api/auth/needs-setup', (req, res) => {
  db.query('SELECT COUNT(*) as count FROM users')
    .then(result => res.json({ needsSetup: result.rows[0].count === '0' }))
    .catch(err => res.status(500).json({ error: 'Database error' }));
});

// Endpoint para criar primeiro usuário admin (apenas se não existir nenhum usuário)
app.post('/api/auth/setup', async (req, res) => {
  try {
    const { rows: [{ count: userCount }] } = await db.query('SELECT COUNT(*) as count FROM users');
    
    if (Number(userCount.count) > 0) {
      return res.status(400).json({ error: 'Setup already completed' });
    }

    const { email, password, fullName } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const userId = crypto.randomUUID();
    const profileId = crypto.randomUUID();
    const roleId = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO users (id, email, password, created_at) VALUES ($1, $2, $3, $4)', [
        userId,
        email,
        hashedPassword,
        now
      ]);
      await client.query('INSERT INTO profiles (id, user_id, full_name, created_at) VALUES ($1, $2, $3, $4)', [
        profileId,
        userId,
        fullName || 'Administrador',
        now
      ]);
      await client.query('INSERT INTO user_roles (id, user_id, role, created_at) VALUES ($1, $2, $3, $4)', [
        roleId,
        userId,
        'admin',
        now
      ]);
      await client.query('COMMIT');
      res.json({ message: 'First admin user created successfully' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint para criar novos usuários (requer autenticação de admin)
app.post('/api/auth/create-user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { rows: [userRole] } = await db.query('SELECT role FROM user_roles WHERE user_id = $1', [userId]);
    
    if (!userRole || userRole.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create users' });
    }

    const { email, password, fullName, role } = req.body;
    
    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, password and role are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const validRoles = ['admin', 'gestor', 'operador', 'visualizador'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Verificar se email já existe
    const { rows: [existingUser] } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const newUserId = crypto.randomUUID();
    const profileId = crypto.randomUUID();
    const roleId = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO users (id, email, password, created_at) VALUES ($1, $2, $3, $4)', [
        newUserId,
        email,
        hashedPassword,
        now
      ]);
      await client.query('INSERT INTO profiles (id, user_id, full_name, created_at) VALUES ($1, $2, $3, $4)', [
        profileId,
        newUserId,
        fullName || null,
        now
      ]);
      await client.query('INSERT INTO user_roles (id, user_id, role, created_at) VALUES ($1, $2, $3, $4)', [
        roleId,
        newUserId,
        role,
        now
      ]);
      await client.query('COMMIT');
      res.json({ id: newUserId, message: 'User created successfully' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============= ENDPOINTS PROTEGIDOS (COM AUTENTICAÇÃO) =============

// Mapear tabela para recurso de permissão
function getResourceForTable(table) {
  const mapping = {
    'users': 'usuarios',
    'profiles': 'usuarios',
    'user_roles': 'usuarios',
    'pessoas': 'pessoas',
    'pessoas_artigos': 'pessoas',
    'pessoas_condominios': 'pessoas',
    'artigos': 'artigos',
    'condominios': 'condominios',
    'group_permissions': 'usuarios',
  };
  return mapping[table] || table;
}

// Verificar permissão do usuário
async function checkUserPermission(userId, resource, operation) {
  try {
    const userRoleRes = await db.query('SELECT role FROM user_roles WHERE user_id = $1', [userId]);
    const userRole = userRoleRes.rows[0];
    
    if (!userRole) {
      return { allowed: false, error: 'User has no assigned role' };
    }
  
    const permissionRes = await db.query(
      `SELECT can_${operation} as has_permission FROM group_permissions WHERE group_role = $1 AND resource = $2`,
      [userRole.role, resource]);
    const permission = permissionRes.rows[0];
  
    if (!permission || !permission.has_permission) {
      return { allowed: false, error: 'Permission denied' };
    }
  
    return { allowed: true, role: userRole.role };
  } catch (err) {
    return { allowed: false, error: 'Database error during permission check' };
  }
}

// Generic GET all - requer permissão de leitura
app.get('/api/:table', authenticateToken, async (req, res) => {
  try {
    const { table } = req.params;
    const resource = getResourceForTable(table);
    const permCheck = await checkUserPermission(req.user.id, resource, 'read');
    
    if (!permCheck.allowed) {
      return res.status(403).json({ error: permCheck.error });
    }

    let { rows } = await db.query(`SELECT * FROM ${table}`);
    
    // Descriptografar campos sensíveis para pessoas
    if (table === 'pessoas') {
      rows = rows.map(row => {
        SENSITIVE_FIELDS.forEach(field => {
          if (row[field]) {
            row[field] = decrypt(row[field]);
          }
        });
        return row;
      });
    }
    
    res.json(rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Operation failed' });
  }
});

// Generic GET by ID - requer permissão de leitura
app.get('/api/:table/:id', authenticateToken, async (req, res) => {
  try {
    const { table, id } = req.params;
    const resource = getResourceForTable(table);
    const permCheck = await checkUserPermission(req.user.id, resource, 'read');
    
    if (!permCheck.allowed) {
      return res.status(403).json({ error: permCheck.error });
    }

    const result = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    let row = result.rows[0];
    
    if (!row) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    // Descriptografar campos sensíveis para pessoas
    if (table === 'pessoas') {
      SENSITIVE_FIELDS.forEach(field => {
        if (row[field]) {
          row[field] = decrypt(row[field]);
        }
      });
    }
    
    res.json(row);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Operation failed' });
  }
});

// Generic POST - requer permissão de criação
app.post('/api/:table', authenticateToken, async (req, res) => {
  try {
    const { table } = req.params;
    const data = req.body;
    const resource = getResourceForTable(table);
    const permCheck = await checkUserPermission(req.user.id, resource, 'create');
    
    if (!permCheck.allowed) {
      return res.status(403).json({ error: permCheck.error });
    }

    // Validar colunas contra whitelist
    const keys = Object.keys(data);
    validateColumns(table, keys);
    
    // Gerar ID se não fornecido
    if (!data.id) {
      data.id = crypto.randomUUID();
    }
    
    // Hash password para users
    if (table === 'users' && data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    
    // Criptografar campos sensíveis para pessoas
    if (table === 'pessoas') {
      SENSITIVE_FIELDS.forEach(field => {
        if (data[field]) {
          data[field] = encrypt(data[field]);
        }
      });
    }
    
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    
    await db.query(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`, values);
    
    res.json({ id: data.id, message: 'Created successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Operation failed' });
  }
});

// Generic PUT - requer permissão de atualização
app.put('/api/:table/:id', authenticateToken, async (req, res) => {
  try {
    const { table, id } = req.params;
    const data = req.body;
    const resource = getResourceForTable(table);
    const permCheck = await checkUserPermission(req.user.id, resource, 'update');
    
    if (!permCheck.allowed) {
      return res.status(403).json({ error: permCheck.error });
    }

    // Validar colunas contra whitelist
    const keys = Object.keys(data).filter(k => k !== 'id');
    validateColumns(table, keys);
    
    // Hash password para users
    if (table === 'users' && data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    
    // Criptografar campos sensíveis para pessoas
    if (table === 'pessoas') {
      SENSITIVE_FIELDS.forEach(field => {
        if (data[field]) {
          data[field] = encrypt(data[field]);
        }
      });
    }
    
    const updates = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const values = keys.map(key => data[key]);
    
    await db.query(`UPDATE ${table} SET ${updates} WHERE id = $${keys.length + 1}`, [...values, id]);
    
    res.json({ message: 'Updated successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Operation failed' });
  }
});

// Specific DELETE for condominios with check for linked pessoas
app.delete('/api/condominios/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const resource = 'condominios';
    const permCheck = await checkUserPermission(req.user.id, resource, 'delete');
    
    if (!permCheck.allowed) {
      return res.status(403).json({ error: permCheck.error });
    }

    // Check for linked pessoas
    const { rows: [linkedPessoas] } = await db.query('SELECT COUNT(*) as count FROM pessoas_condominios WHERE condominio_id = $1', [id]);
    if (linkedPessoas && linkedPessoas.count > 0) {
      return res.status(400).json({ error: `Não é possível excluir, pois ${linkedPessoas.count} pessoa(s) estão vinculadas a este condomínio.` });
    }

    await db.query('DELETE FROM condominios WHERE id = $1', [id]);
    
    res.json({ message: 'Condomínio excluído com sucesso.' });
  } catch (error) {
    console.error('Error deleting condominio:', error);
    res.status(500).json({ error: 'Falha ao excluir condomínio.' });
  }
});

// Specific DELETE for artigos with check for linked pessoas
app.delete('/api/artigos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const resource = 'artigos';
    const permCheck = await checkUserPermission(req.user.id, resource, 'delete');
    
    if (!permCheck.allowed) {
      return res.status(403).json({ error: permCheck.error });
    }

    // Check for linked pessoas
    const { rows: [linkedPessoas] } = await db.query('SELECT COUNT(*) as count FROM pessoas_artigos WHERE artigo_id = $1', [id]);
    if (linkedPessoas && linkedPessoas.count > 0) {
      return res.status(400).json({ error: `Não é possível excluir, pois ${linkedPessoas.count} pessoa(s) estão vinculadas a este código.` });
    }

    await db.query('DELETE FROM artigos WHERE id = $1', [id]);
    
    res.json({ message: 'Código excluído com sucesso.' });
  } catch (error) {
    console.error('Error deleting artigo:', error);
    res.status(500).json({ error: 'Falha ao excluir código.' });
  }
});

// Generic DELETE - requer permissão de exclusão
app.delete('/api/:table/:id', authenticateToken, async (req, res) => {
  try {
    const { table, id } = req.params;
    const resource = getResourceForTable(table);
    const permCheck = await checkUserPermission(req.user.id, resource, 'delete');
    
    if (!permCheck.allowed) {
      return res.status(403).json({ error: permCheck.error });
    }
    await db.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Operation failed' });
  }
});

// Endpoint para importar condomínios via CSV
app.post('/api/condominios/import', authenticateToken, async (req, res) => {
  try {
    const resource = 'condominios';
    const permCheck = await checkUserPermission(req.user.id, resource, 'create');
    
    if (!permCheck.allowed) {
      return res.status(403).json({ error: permCheck.error });
    }

    let { csvContent } = req.body;
    if (!csvContent) {
      return res.status(400).json({ error: 'Conteúdo do CSV é obrigatório.' });
    }

    // Remove Byte Order Mark (BOM) if present
    if (csvContent.charCodeAt(0) === 0xFEFF) {
      csvContent = csvContent.substring(1);
    }

    const lines = csvContent.split(/\r\n?|\n/).map(line => line.trim()).filter(line => line);
    
    if (lines.length === 0) {
      return res.status(400).json({ error: 'O arquivo CSV está vazio ou não contém dados.' });
    }

    const header = lines.shift()?.toLowerCase()?.replace(/"/g, '').trim();
    if (header !== 'nome') {
        return res.status(400).json({ error: `Formato de CSV inválido. A coluna do cabeçalho deve ser "nome", mas foi encontrado: "${header}".` });
    }

    if (lines.length === 0) {
        return res.status(400).json({ error: 'O arquivo CSV não contém dados para importar (apenas cabeçalho).' });
    }

    const client = await db.connect();
    let importedCount = 0;
    let skipped = [];
    try {
      await client.query('BEGIN');
      for (const line of lines) {
        const nomeLimpo = line.replace(/^"|"$/g, '').trim();
        if (nomeLimpo) {
          const { rows: [exists] } = await client.query('SELECT id FROM condominios WHERE nome = $1', [nomeLimpo]);
          if (!exists) {
            await client.query('INSERT INTO condominios (id, nome, created_at) VALUES ($1, $2, $3)', [crypto.randomUUID(), nomeLimpo, new Date().toISOString()]);
            importedCount++;
          } else {
            skipped.push(nomeLimpo);
          }
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ message: `${importedCount} condomínios importados com sucesso. ${skipped.length} ignorados por já existirem.` });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Falha na operação de importação.' });
  }
});

// Endpoint para importar artigos via CSV
app.post('/api/artigos/import', authenticateToken, async (req, res) => {
  try {
    const resource = 'artigos';
    const permCheck = await checkUserPermission(req.user.id, resource, 'create');
    
    if (!permCheck.allowed) {
      return res.status(403).json({ error: permCheck.error });
    }

    let { csvContent } = req.body;
    if (!csvContent) {
      return res.status(400).json({ error: 'Conteúdo do CSV é obrigatório.' });
    }

    // Remove Byte Order Mark (BOM) if present
    if (csvContent.charCodeAt(0) === 0xFEFF) {
      csvContent = csvContent.substring(1);
    }

    const lines = csvContent.split(/\r\n?|\n/).map(line => line.trim()).filter(line => line);
    
    if (lines.length === 0) {
      return res.status(400).json({ error: 'O arquivo CSV está vazio ou não contém dados.' });
    }

    const headerLine = lines.shift()?.toLowerCase()?.replace(/"/g, '').trim();
    const headers = headerLine.split(',').map(h => h.trim());

    if (headers.length < 2 || headers[0] !== 'numero' || headers[1] !== 'nome') {
        return res.status(400).json({ error: `Formato de CSV inválido. O cabeçalho deve ser "numero,nome", mas foi encontrado: "${headerLine}".` });
    }

    if (lines.length === 0) {
        return res.status(400).json({ error: 'O arquivo CSV não contém dados para importar (apenas cabeçalho).' });
    }

    const client = await db.connect();
    let importedCount = 0;
    let skipped = [];
    try {
      await client.query('BEGIN');
      for (const line of lines) {
        const firstCommaIndex = line.indexOf(',');
        if (firstCommaIndex === -1) continue;
        const numero = line.substring(0, firstCommaIndex).replace(/^"|"$/g, '').trim();
        const nome = line.substring(firstCommaIndex + 1).replace(/^"|"$/g, '').trim();
        if (numero && nome) {
          const { rows: [exists] } = await client.query('SELECT id FROM artigos WHERE numero = $1', [numero]);
          if (!exists) {
            const now = new Date().toISOString();
            await client.query('INSERT INTO artigos (id, numero, nome, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)', [crypto.randomUUID(), numero, nome, now, now]);
            importedCount++;
          } else {
            skipped.push(numero);
          }
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.json({ message: `${importedCount} códigos importados com sucesso. ${skipped.length} ignorados por já existirem (número duplicado).` });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Falha na operação de importação.' });
  }
});

// Endpoint para importar pessoas via CSV
app.post('/api/pessoas/import', authenticateToken, async (req, res) => {
  const resource = 'pessoas';
  const permCheck = await checkUserPermission(req.user.id, resource, 'create');
  if (!permCheck.allowed) {
    return res.status(403).json({ error: permCheck.error });
  }

  let { csvContent } = req.body;
  if (!csvContent) {
    return res.status(400).json({ error: 'Conteúdo do CSV é obrigatório.' });
  }

  if (csvContent.charCodeAt(0) === 0xFEFF) {
    csvContent = csvContent.substring(1);
  }

  const lines = csvContent.split(/\r\n?|\n/).map(line => line.trim()).filter(line => line);
  if (lines.length < 2) {
    return res.status(400).json({ error: 'O arquivo CSV precisa ter um cabeçalho e pelo menos uma linha de dados.' });
  }

  const headerLine = lines.shift().toLowerCase().trim();
  const headers = headerLine.split(',').map(h => h.replace(/"/g, '').trim());
  const expectedHeaders = ['nome']; // RG não é mais obrigatório
  const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
  if (missingHeaders.length > 0) {
    return res.status(400).json({ error: `Cabeçalho do CSV inválido. Colunas obrigatórias faltando: ${missingHeaders.join(', ')}.` });
  }

  const client = await db.connect();
  let importedCount = 0;
  let skipped = [];
  let errors = [];

  try {
    await client.query('BEGIN');
    for (const [index, row] of lines.entries()) {
      const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      if (values.length < headers.length) {
        errors.push(`Linha ${index + 2}: Número incorreto de colunas. Esperado ${headers.length}, encontrado ${values.length}.`);
        continue;
      }

      const rowData = headers.reduce((obj, header, i) => {
        obj[header] = (values[i] || '').replace(/^"|"$/g, '').trim();
        return obj;
      }, {});

      const { nome, rg, cpf, data_nascimento, nome_mae, nome_pai, observacao, residencial, condominio_nome, data_vinculo_condominio, artigos_numeros } = rowData;

      if (!nome) {
        errors.push(`Linha ${index + 2}: A coluna 'nome' é obrigatória.`);
        continue;
      }

      // Verifica duplicidade apenas se o RG for fornecido
      if (rg && rg.trim() !== '') {
        const { rows: [existingPessoa] } = await client.query('SELECT id FROM pessoas WHERE rg = $1', [rg]);
        if (existingPessoa) {
          skipped.push(`${nome} (RG: ${rg})`);
          continue;
        }
      }

      const { rows: [condominio] } = condominio_nome ? await client.query('SELECT id FROM condominios WHERE nome = $1', [condominio_nome]) : { rows: [] };
      if (condominio_nome && !condominio) {
        errors.push(`Linha ${index + 2}: Condomínio '${condominio_nome}' não encontrado.`);
        continue;
      }

      const artigoIds = [];

      if (artigos_numeros) {
        const numeros = artigos_numeros.split(/[,;]/).map(n => n.trim()).filter(Boolean);
        let allArtigosFound = true;
        for (const num of numeros) { 
          const { rows: [artigo] } = await client.query('SELECT id FROM artigos WHERE numero = $1', [num]);
          if (artigo) {
            artigoIds.push(artigo.id);
          } else {
            errors.push(`Linha ${index + 2}: Artigo número '${num}' não encontrado.`);
            allArtigosFound = false;
            break;
          }
        }
        if (!allArtigosFound) continue;
      }

      const pessoaId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      await client.query('INSERT INTO pessoas (id, nome, rg, cpf, data_nascimento, nome_mae, nome_pai, observacao, residencial, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [pessoaId, encrypt(nome), rg || null, cpf ? encrypt(cpf) : null, data_nascimento || null, nome_mae ? encrypt(nome_mae) : null, nome_pai ? encrypt(nome_pai) : null, observacao ? encrypt(observacao) : null, residencial || null, now, now]);

      if (condominio) {
        await client.query('INSERT INTO pessoas_condominios (id, pessoa_id, condominio_id, data_vinculo, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)', [crypto.randomUUID(), pessoaId, condominio.id, data_vinculo_condominio || now, now, now]);
      }
      for (const artigoId of artigoIds) {
        await client.query('INSERT INTO pessoas_artigos (id, pessoa_id, artigo_id, created_at) VALUES ($1, $2, $3, $4)', [crypto.randomUUID(), pessoaId, artigoId, now]);
      }
      importedCount++;
    }
    await client.query('COMMIT');
    let message = `${importedCount} pessoas importadas com sucesso.`;
    if (skipped.length > 0) message += ` ${skipped.length} ignoradas por já existirem (RG duplicado).`;
    if (errors.length > 0) message += ` ${errors.length} linhas com erros.`;
    res.status(errors.length > 0 && importedCount === 0 ? 400 : 200).json({ message, errors });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import error:', error);
    res.status(500).json({ error: 'Falha na operação de importação.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  db.connect(err => {
    if (err) console.error('Failed to connect to PostgreSQL', err.stack);
    else console.log('✓ Successfully connected to PostgreSQL');
  });
  console.log('==============================================');
  console.log(`🔒 GolFind Secure Server running on port ${PORT}`);
  console.log('==============================================');
});
