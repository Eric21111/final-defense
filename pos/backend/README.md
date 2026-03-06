# POS System Backend

Backend API for the POS (Point of Sale) System built with Node.js, Express, and MongoDB.

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   - Copy `.env.example` to `.env`
   - Update MongoDB URI if needed (default: `mongodb://localhost:27017/pos_system`)

3. **Start MongoDB**
   Make sure MongoDB is running on `localhost:27017`
   
   📦 **For Offline Setup**: See [MONGODB_PORTABLE_SETUP.md](./MONGODB_PORTABLE_SETUP.md) for MongoDB Portable installation guide

4. **Run the Server**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Test the Connection**
   Navigate to `http://localhost:5000` to see if the server is running

6. **Thermal Printer Setup**
   - Complete steps in [PRINTER_SETUP.md](./PRINTER_SETUP.md) to enable the JK-5802H USB printer.

## 🌐 Network Access

- 🌍 **For Network Access**: See [OFFLINE_NETWORK_SETUP.md](./OFFLINE_NETWORK_SETUP.md) to allow multiple clients on your network to access the POS system

## Project Structure

```
backend/
├── config/
│   └── database.js       # MongoDB connection configuration
├── models/               # Mongoose schemas/models
├── routes/               # API route definitions
├── controllers/          # Business logic controllers
├── middleware/           # Custom middleware functions
├── server.js            # Main application entry point
├── package.json         # Dependencies and scripts
└── .env                 # Environment variables
```

## Database Connection

The application connects to MongoDB at `localhost:27017` with database name `pos_system`.

Connection configuration is located in `config/database.js`.

## API Endpoints

(To be documented as routes are created)

## Technologies Used

- **Express.js** - Web framework
- **Mongoose** - MongoDB ODM
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management
- **body-parser** - Request body parsing

