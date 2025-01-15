// Required Dependencies
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Schema } = mongoose;

// Initialize Express App
const app = express();
const PORT = 5001;

// // Middleware
app.use(bodyParser.json());

app.use(cors({
  origin: 'http://localhost:5173', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'], 
  credentials: true 
}));

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/restaurant', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Connection error:'));
db.once('open', () => console.log('Connected to MongoDB'));

// Models
const UserSchema = new Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
});
const MenuSchema = new Schema({
  name: { type: String, required: true },
  category: { type: String },
  price: { type: Number, required: true },
  availability: { type: Boolean, default: true },
});
const OrderSchema = new Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  items: [
    {
      menuItem: { type: mongoose.Types.ObjectId, ref: 'Menu', required: true },
      quantity: { type: Number, required: true },
    },
  ],
  totalAmount: { type: Number, required: true },
  status: { type: String, default: 'Pending' },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', UserSchema);
const Menu = mongoose.model('Menu', MenuSchema);
const Order = mongoose.model('Order', OrderSchema);

// // Authentication Middleware
// const authenticate = (req, res, next) => {
//   const token = req.headers['authorization'];
//   if (!token) return res.status(401).json({ message: 'No token provided' });

//   jwt.verify(token, 'secret_key', (err, decoded) => {
//     if (err) return res.status(403).json({ message: 'Failed to authenticate token' });
//     req.userId = decoded.id;
//     next();
//   });
// };

const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1]; // Extract token after 'Bearer'
  if (!token) return res.status(401).json({ message: 'Malformed token' });

  jwt.verify(token, 'secret_key', (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Failed to authenticate token' });
    req.userId = decoded.id;
    next();
  });
};

// API 
// Authentication
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Missing fields' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashedPassword });

  try {
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user', error });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Missing fields' });

  try 
    
  {
    const user = await User.findOne({ username: username  });
    console.log(user);
    
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
    console.log("1");
    const token = jwt.sign({ id: user._id }, 'secret_key', { expiresIn: '1h' });
    console.log("2");
    res.status(200).json({ 
    
      status:"200",
      token : token,
      name:user.name
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in' });
  }
});

// Menu 
app.get('/menu', async (req, res) => {
  try {
    const menu = await Menu.find();
    res.json(menu);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching menu' });
  }
});

app.post('/menu', async (req, res) => {
  const { name, category, price, availability } = req.body;
  if (!name || price == null) return res.status(400).json({ message: 'Missing fields' });

  const menuItem = new Menu({ name, category, price, availability });

  try {
    await menuItem.save();
    res.status(201).json({ message: 'Menu item added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error adding menu item' });
  }
});

app.put('/menu/:id', async (req, res) => {
  try {
    const updatedMenu = await Menu.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedMenu);
  } catch (error) {
    res.status(500).json({ message: 'Error updating menu item' });
  }
});

app.delete('/menu/:id', async (req, res) => {
  try {
    await Menu.findByIdAndDelete(req.params.id);
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting menu item' });
  }
});

// Order Management
app.post('/order',authenticate, async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Invalid order details' });
  }

  try {
    let totalAmount = 0;

    for (const item of items) {
      // console("item....",item);
      const menuItem = await Menu.findById(item.menuItem);
      if (!menuItem) return res.status(404).json({ message: 'Menu item not found' });
      totalAmount += menuItem.price * item.quantity;
    }

    const order = new Order({
      userId: req.userId,
      items,
      totalAmount,
      status: 'Pending',
    });

    await order.save();
    res.status(200).json(order);
  } catch (error) {
    res.status(404).json({ message: 'Error placing order' });
  }
});

app.get('/orders', authenticate, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId }).populate('items.menuItem');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders' });
  }
});


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
