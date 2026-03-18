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
  //enable this changes while running on local system
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:5173",
      "http://172.16.60.57:5173",
      "http://172.16.80.46:5173"
    ];

    // allow requests with no origin (like Postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("CORS not allowed"), false);
    }
  },
  credentials: true

  //Enable this changes to run on office Network
  // origin: ["http://172.16.80.46:5173"],
  // credentials: true,
  // methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  // allowedHeaders: ["Content-Type", "Authorization"]

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
//   console.log(`\nKERV v3 Backend running:`);
//   console.log(`→ Local:   http://localhost:${PORT}`);
//   console.log(`→ Network: http://172.16.80.46:${PORT}\n`);
// });

// app.listen(PORT, '0.0.0.0', () => {
//   console.log(`KERV v3 Backend → http://localhost:${PORT}`);
// });


