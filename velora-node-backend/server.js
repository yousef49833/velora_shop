import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import knex from 'knex';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import getPort from 'get-port';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const isProduction = process.env.NODE_ENV === 'production';

const db = knex({
  client: 'sqlite3',
  connection: { filename: './velora.sqlite' },
  useNullAsDefault: true,
});

await Promise.all([
  db.schema.hasTable('users').then((exists) => {
    if (!exists) {
      return db.schema.createTable('users', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.string('email').notNullable().unique();
        table.string('password').notNullable();
        table.string('role').defaultTo('user');
        table.timestamps(true, true);
      });
    }
  }),

  db.schema.hasTable('categories').then((exists) => {
    if (!exists) {
      return db.schema.createTable('categories', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable().unique();
        table.integer('parent_id').nullable().references('id').inTable('categories');
        table.timestamps(true, true);
      });
    }
  }),

  db.schema.hasTable('products').then((exists) => {
    if (!exists) {
      return db.schema.createTable('products', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.text('description').nullable();
        table.decimal('price', 10, 2).notNullable();
        table.integer('stock').defaultTo(0);
        table.integer('category_id').nullable().references('id').inTable('categories');
        table.text('images').nullable();
        table.timestamps(true, true);
      });
    }
  }),

  db.schema.hasTable('cart_items').then((exists) => {
    if (!exists) {
      return db.schema.createTable('cart_items', (table) => {
        table.increments('id').primary();
        table.integer('user_id').notNullable().references('id').inTable('users');
        table.integer('product_id').notNullable().references('id').inTable('products');
        table.integer('quantity').defaultTo(1);
        table.timestamps(true, true);
      });
    }
  }),

  db.schema.hasTable('orders').then((exists) => {
    if (!exists) {
      return db.schema.createTable('orders', (table) => {
        table.increments('id').primary();
        table.integer('user_id').notNullable().references('id').inTable('users');
        table.string('status').defaultTo('pending');
        table.decimal('total', 12, 2).notNullable();
        table.string('payment_method');
        table.text('shipping_address');
        table.timestamps(true, true);
      });
    }
  }),

  db.schema.hasTable('order_items').then((exists) => {
    if (!exists) {
      return db.schema.createTable('order_items', (table) => {
        table.increments('id').primary();
        table.integer('order_id').notNullable().references('id').inTable('orders');
        table.integer('product_id').notNullable().references('id').inTable('products');
        table.integer('quantity').notNullable();
        table.decimal('price', 12, 2).notNullable();
        table.timestamps(true, true);
      });
    }
  }),
]).catch((e) => {
  console.error('DB init error', e);
  process.exit(1);
});

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

const authMiddleware = async (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = header.substring(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await db('users').where({ id: payload.sub }).first();
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(422).json({ message: 'All fields are required' });

  const existing = await db('users').where({ email }).first();
  if (existing) return res.status(422).json({ message: 'Email already exists' });

  const hashed = await bcrypt.hash(password, 10);
  const [id] = await db('users').insert({ name, email, password: hashed, role: 'user' });
  const token = jwt.sign({ sub: id }, JWT_SECRET, { expiresIn: '7d' });

  return res.json({ id, name, email, token });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await db('users').where({ email }).first();
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '7d' });
  return res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
});

app.post('/api/logout', authMiddleware, async (req, res) => {
  return res.json({ message: 'Logged out' });
});

app.get('/api/products', async (req, res) => {
  const products = await db('products');
  res.json(products);
});

app.get('/api/products/:id', async (req, res) => {
  const product = await db('products').where({ id: req.params.id }).first();
  if (!product) return res.status(404).json({ message: 'Not found' });
  res.json(product);
});

app.post('/api/admin/products', authMiddleware, async (req, res) => {
  const user = req.user;
  if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

  const { name, price, stock, category_id } = req.body;
  const [id] = await db('products').insert({ name, price, stock, category_id, description: req.body.description || '', images: JSON.stringify(req.body.images || []) });
  const product = await db('products').where({ id }).first();
  res.status(201).json(product);
});

app.put('/api/admin/products/:id', authMiddleware, async (req, res) => {
  const user = req.user;
  if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  await db('products').where({ id: req.params.id }).update(req.body);
  const product = await db('products').where({ id: req.params.id }).first();
  res.json(product);
});

app.delete('/api/admin/products/:id', authMiddleware, async (req, res) => {
  const user = req.user;
  if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  await db('products').where({ id: req.params.id }).del();
  res.json({ message: 'Deleted' });
});

app.get('/api/admin/dashboard', authMiddleware, async (req, res) => {
  const user = req.user;
  if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const usersCount = await db('users').count('id as count').first();
  const productsCount = await db('products').count('id as count').first();
  const ordersCount = await db('orders').count('id as count').first();
  const revenue = await db('orders').sum('total as revenue').first();

  res.json({ users: usersCount.count, products: productsCount.count, orders: ordersCount.count, revenue: revenue.revenue });
});

app.post('/api/cart', authMiddleware, async (req, res) => {
  const user = req.user;
  const { product_id, quantity } = req.body;
  const present = await db('cart_items').where({ user_id: user.id, product_id }).first();
  if (present) {
    await db('cart_items').where({ id: present.id }).update({ quantity: quantity || present.quantity + 1 });
  } else {
    await db('cart_items').insert({ user_id: user.id, product_id, quantity: quantity || 1 });
  }

  const cart = await db('cart_items').where({ user_id: user.id });
  res.json(cart);
});

app.get('/api/cart', authMiddleware, async (req, res) => {
  const user = req.user;
  const cart = await db('cart_items').where({ user_id: user.id }).select('*');
  res.json(cart);
});

app.post('/api/orders', authMiddleware, async (req, res) => {
  const user = req.user;
  const { items, payment_method, shipping_address } = req.body;
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const [orderId] = await db('orders').insert({
    user_id: user.id,
    total,
    payment_method,
    shipping_address: JSON.stringify(shipping_address),
  });

  for (const item of items) {
    await db('order_items').insert({
      order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.price,
    });
  }

  res.status(201).json({ orderId, total });
});

app.get('/api/orders', authMiddleware, async (req, res) => {
  const user = req.user;
  const orders = await db('orders').where({ user_id: user.id });
  res.json(orders);
});

// Production static serving
if (isProduction) {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ message: 'Velora Node Backend API is running. Use /api/* endpoints.' });
  });
}

app.get('/api', (req, res) => {
  res.json({ status: 'ok', message: 'Velora API', endpoints: ['/api/products', '/api/auth', '/api/cart', '/api/orders'] });
});

// Start server with dynamic port
const startServer = async () => {
  const port = await getPort({ port: parseInt(process.env.PORT) || 5000 });
  const wsPort = await getPort({ port: 24679 });

  const server = app.listen(port, () => {
    console.log(`Node backend running on http://localhost:${port}`);
    console.log(`WebSocket server running on ws://localhost:${wsPort}`);
  });

  // WebSocket server
  const wss = new WebSocketServer({ port: wsPort });

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to Velora WS' }));

    ws.on('message', (message) => {
      console.log('Received:', message.toString());
      // Handle messages, e.g., broadcast notifications
      wss.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
          client.send(JSON.stringify({ type: 'notification', message: 'New update!' }));
        }
      });
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  process.on('SIGINT', () => {
    console.log('Shutting down...');
    wss.close();
    server.close(() => process.exit(0));
  });
};

startServer().catch(console.error);