# 🔥 FLAMES ❤️ — Love Story & Destiny Calculator

<div align="center">

### ✨ Discover your relationship destiny with an enchanting, full-stack love calculator ✨

[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB_Atlas-Database-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

</div>

---

## 📖 About The Application

**FLAMES (Friends, Lovers, Affection, Marriage, Enemies, Siblings)** is the beloved nostalgic relationship game, reimagined as a state-of-the-art web application with a romantic dark fantasy aesthetic.

Enter two names, watch the letters eliminate step-by-step in real time, see your compatibility percentage, and celebrate special outcomes with bursts of confetti!

### 🌟 Key Highlights

- 💘 **Staggered FLAMES Elimination**: Watch each letter strike through dynamically following the authentic FLAMES counting algorithm.
- 📊 **Dynamic Compatibility Meter**: Unique hash-based compatibility percentage with gradient animations.
- 🎊 **Romantic Confetti Show**: Bursting particle confetti whenever destiny lands on *Lovers* or *Marriage*.
- 🔐 **"Reveal Our Calculation"**: A step-by-step arithmetic modal breaking down common letters and count totals.
- 🔁 **Atomic Attempt Counter**: Keeps track of how many times a relationship pair has been calculated with symmetric order-independent normalization.
- 📋 **One-Click Share & Copy**: Effortlessly copy or share your love story result via the native Web Share API or clipboard.
- 📱 **Fluid Responsiveness**: Designed with modern CSS glassmorphism, responsive clamps, and touch optimization for mobile and desktop screens.

---

## 🎨 Design & Aesthetic

- **Romantic Dark Theme**: High-resolution dark fantasy aesthetics with enchanted crimson rose petals and ambient cosmic lighting.
- **Modern Typography**: Elegant cursive calligraphy (*Allura*, *Great Vibes*) paired with clean sans-serif typography for inputs and results.
- **Glassmorphic Interface**: Translucent layered cards, blurred backdrops, and animated gradient glows.

---

## 🔒 Privacy & Data Transparency

We believe in complete privacy and honesty:

### 🛡️ What We NEVER Collect:
- ❌ **No Passwords or Account Credentials**
- ❌ **No Email Addresses or Phone Numbers**
- ❌ **No IP Addresses or Geolocation Data**
- ❌ **No Device Fingerprinting or Tracking Cookies**

### 📊 What We Store For Your Stats:
To power the persistent attempt counter and love calculation history, we store:
- The two first names entered (sanitized and trimmed)
- FLAMES category result and compatibility percentage score
- Total calculation attempts for that pair (order-insensitive, e.g. *Alex + Jordan* = *Jordan + Alex*)
- Date, day, month, and timestamp of the calculation

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Glassmorphism, CSS Variables, Clamp Typography), Vanilla JavaScript (ES6+).
- **Backend API**: Node.js, Express.js.
- **Database**: MongoDB Atlas with Mongoose ODM.
- **Security & Utilities**: Helmet, CORS origin control, Express-Rate-Limit (100 req / 15 min), JSON body validation (64KB max).
- **Testing**: Built-in Node.js Test Runner (`node:test`, `node:assert`) — 26 unit and HTTP integration tests.
- **Deployment**: Vercel (Frontend & Serverless API) + Render (Backend Web Service).

---

## 🚀 How to Run Locally

Follow these quick steps to get the application running on your local machine:

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/dullamanojreddy/flames.git
cd flames
```

### 2️⃣ Install Dependencies
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 3️⃣ Configure Environment Variables
Create a `.env` file in the `backend/` directory:
```bash
cp backend/.env.example backend/.env
```

Add your MongoDB connection string in `backend/.env`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/flames_db?retryWrites=true&w=majority
FRONTEND_URL=http://localhost:5500
CLIENT_ORIGIN=http://localhost:5500,http://localhost:3000,http://127.0.0.1:5500
TIMEZONE=UTC
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

### 4️⃣ Start the Backend Server
```bash
npm run dev
```
> The API server will start on `http://localhost:5000`.

### 5️⃣ Launch the Frontend
Open `frontend/index.html` (or `index.html`) using **VS Code Live Server** or directly in your browser.

---

## 🧪 Running Automated Tests

Run the full suite of 26 tests (algorithm tests, symmetric normalization, rate limiting, and HTTP health):

```bash
npm test
```


---

## 👨‍💻 Author & Creator

Created with ❤️ by **[D Manoj Reddy](https://github.com/dullamanojreddy)**

- **GitHub**: [@dullamanojreddy](https://github.com/dullamanojreddy)
- **Project Repository**: [flames](https://github.com/dullamanojreddy/flames)

---

## ⭐ Support & Feedback

If you find this project fun, entertaining, or useful for learning full-stack web development:

1. ⭐ **Star this repository** on GitHub!
2. 🍴 **Fork it** and create your own themed version.
3. 📢 **Share it** with your friends and discover your destiny!

