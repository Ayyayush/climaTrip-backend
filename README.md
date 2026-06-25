# ☀️ ClimaTrip Backend

Backend service for **ClimaTrip**, an AI-Powered Travel Planning & Safety Platform.

The backend is responsible for:

* User Authentication
* AI Travel Itinerary Generation
* Beach Safety Analysis
* Destination Data Processing
* MongoDB Data Management
* API Communication with Frontend
* Groq AI Integration

---

# 🚀 Overview

ClimaTrip Backend provides REST APIs that enable users to:

* Register and Login
* Generate AI-powered travel itineraries
* Retrieve destination safety information
* Analyze weather and beach conditions
* Access travel recommendations

The backend follows a modular architecture using:

* Express.js
* MongoDB
* Mongoose
* Groq AI
* JWT Authentication
* REST APIs

---

# 🏗️ System Architecture

```text
Frontend (React + Vite)
            │
            ▼
      Express Server
            │
 ┌──────────┼──────────┐
 │          │          │
 ▼          ▼          ▼
MongoDB   Groq AI   External APIs
```

---

# 🛠️ Tech Stack

## Runtime

* Node.js

## Framework

* Express.js

## Database

* MongoDB
* Mongoose ODM

## Authentication

* JWT (JSON Web Token)
* bcryptjs

## AI Integration

* Groq API

## Environment Management

* dotenv

## Development Tools

* Nodemon

---

# 📂 Project Structure

```bash
src/
│
├── controllers/
│   ├── authControllers.js
│   ├── travelController.js
│   └── beachController.js
│
├── models/
│   └── User.js
│
├── routes/
│   ├── authRoutes.js
│   ├── travelRoutes.js
│   └── beachRoutes.js
│
├── services/
│   ├── groqService.js
│   └── beachService.js
│
├── middleware/
│   ├── authMiddleware.js
│   └── errorMiddleware.js
│
├── config/
│   └── database.js
│
├── server.js
│
└── .env
```

---

# 🔐 Authentication Module

## Register User

Endpoint

```http
POST /register
```

Request

```json
{
  "name": "Ayush",
  "email": "ayush@gmail.com",
  "password": "123456"
}
```

Process

1. Validate request
2. Check existing user
3. Hash password using bcrypt
4. Store user in MongoDB
5. Return success response

---

## Login User

Endpoint

```http
POST /login
```

Request

```json
{
  "email": "ayush@gmail.com",
  "password": "123456"
}
```

Process

1. Find user
2. Compare hashed password
3. Generate JWT token
4. Return token and user details

---

# 🔒 Password Security

Passwords are never stored in plain text.

Implementation:

```javascript
const hashedPassword = await bcrypt.hash(password, 10);
```

Benefits:

* One-way encryption
* Salted hashing
* Industry-standard security

---

# 🤖 AI Travel Planner

One of the core features of ClimaTrip.

Users provide:

* Source Location
* Destination
* Start Date
* End Date

Example:

```json
{
  "source": "Delhi",
  "destination": "Mumbai",
  "startDate": "2026-06-06",
  "endDate": "2026-06-10"
}
```

---

## Generate Travel Plan

Endpoint

```http
POST /api/generate
```

Flow

1. Receive user input
2. Build AI prompt
3. Send prompt to Groq
4. Receive itinerary
5. Parse AI response
6. Return structured JSON

---

## AI Output Includes

* Transportation Options
* Budget Estimation
* Tourist Attractions
* Nature Spots
* Local Transportation
* Day-wise Itinerary
* Return Plan

Example:

```json
{
  "transport_options": {},
  "day_wise_itinerary": [],
  "budget_breakdown": {},
  "return_plan": {}
}
```

---

# 🧠 Groq Integration

The backend uses Groq LLMs to generate travel plans dynamically.

Example Flow

```text
User Request
      │
      ▼
Travel Controller
      │
      ▼
Groq Service
      │
      ▼
Groq API
      │
      ▼
Generated Itinerary
      │
      ▼
Frontend
```

---

## Groq Service Responsibilities

* Prompt Creation
* API Communication
* JSON Formatting
* Response Cleaning
* Error Handling

---

# 🌊 Beach Safety Module

Provides destination safety insights.

Includes:

* Wave Height
* Wind Speed
* Water Temperature
* Weather Conditions
* Activity Safety Scores

Activities Supported

* Swimming
* Surfing
* Fishing
* Boating

---

## Beach Search Endpoint

```http
GET /search/analyzeData/:location
```

Example

```http
GET /search/analyzeData/goa
```

Response

```json
{
  "latitude": 15.2993,
  "longitude": 74.1240,
  "current": {
    "waveHeight": 1.2,
    "windSpeed": 12,
    "weatherType": "Sunny"
  },
  "activity": {
    "swimming": 85,
    "surfing": 72
  }
}
```

---

# 🗄️ Database Design

## User Schema

```javascript
{
  name: String,
  email: String,
  password: String
}
```

---

## MongoDB Responsibilities

Stores:

* User Accounts
* Authentication Data
* Future Travel History
* Future Saved Plans

---

# ⚙️ Environment Variables

Create a `.env` file.

Example:

```env
PORT=3001

MONGODB_URI=your_mongodb_connection

JWT_SECRET=your_secret_key

GROQ_API_KEY=your_groq_api_key
```

---

# 🚀 Installation

Clone Repository

```bash
git clone <repository-url>
```

Move into backend directory

```bash
cd ClimaTrip-Backend
```

Install dependencies

```bash
npm install
```

Start development server

```bash
npm run dev
```

Production

```bash
npm start
```

---

# 📡 API Endpoints

## Authentication

```http
POST /register
POST /login
```

---

## Travel Planning

```http
POST /api/generate
```

---

## Beach Safety

```http
GET /search/analyzeData/:location
```

---

# ⚠️ Error Handling

Backend handles:

* Invalid Requests
* Missing Fields
* Duplicate Users
* Database Errors
* Groq API Failures
* Invalid JSON Responses
* Authentication Errors

Example

```json
{
  "success": false,
  "message": "Failed to Generate Travel Plan"
}
```

---

# 📈 Future Enhancements

* Refresh Tokens
* Role Based Authentication
* Travel History Storage
* Saved Itineraries
* Hotel Recommendation Engine
* Real-Time Weather APIs
* Redis Caching
* Booking Integration
* Payment Gateway Support
* Multi-Language Support

---

# 🧪 Testing

Recommended tools:

* Postman
* Thunder Client
* Insomnia

Used for:

* Authentication Testing
* API Validation
* Error Response Testing
* AI Response Verification

---

# 🔒 Security Features

Implemented:

* Password Hashing
* JWT Authentication
* Environment Variables
* Protected Routes
* Input Validation

Future:

* Rate Limiting
* Refresh Tokens
* CSRF Protection
* Request Sanitization

---

# 📜 License

This project is intended for educational, portfolio, and research purposes.

---

# 👨‍💻 Developed By

☀️ ClimaTrip

AI-Powered Travel Planning & Safety Platform

Backend built using:

* Node.js
* Express.js
* MongoDB
* Mongoose
* JWT
* bcryptjs
* Groq AI
