const express = require('express');
const cors    = require('cors');
const path    = require('path');



const authRoutes       = require('./routes/auth');
const videoRoutes      = require('./routes/videos');
const adminRoutes      = require('./routes/admin');
const productRoutes    = require('./routes/products');
const complianceRoutes = require('./routes/compliance');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://172.16.80.46:5173/"
  ],
  credentials: true
}));
app.options("*", cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static crop images served from metadata dir
app.use('/crops', express.static(path.join(__dirname, 'data/crops')));

app.use('/auth',       authRoutes);
app.use('/videos',     videoRoutes);
app.use('/admin',      adminRoutes);
app.use('/products',   productRoutes);
app.use('/compliance', complianceRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', version: '3.0.0', ts: Date.now() }));

app.listen(PORT, () => {
  console.log(`\n  KERV v3 Backend → http://localhost:${PORT}`);
  console.log(`  Routes: /auth  /videos  /admin  /products  /compliance\n`);
});

// app.listen(PORT, '0.0.0.0', () => {
//   console.log(`KERV v3 Backend → http://localhost:${PORT}`);
// });


