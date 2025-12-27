#!/bin/bash

echo "🎓 Absen Digital - Setup Script"
echo "================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Download: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✅ npm found: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"
echo ""

# Create .env file if not exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env .env.example 2>/dev/null || cat > .env << EOL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=absen_digital

JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

PORT=3000
NODE_ENV=development
EOL
    echo "✅ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Please update .env file with your MySQL credentials:"
    echo "   - DB_USER (default: root)"
    echo "   - DB_PASSWORD (your MySQL password)"
    echo "   - DB_NAME (database name, default: absen_digital)"
    echo ""
fi

# Check if MySQL is installed
if command -v mysql &> /dev/null; then
    echo "✅ MySQL found"

    echo ""
    echo "📋 Setup MySQL database:"
    echo "   1. Make sure MySQL service is running"
    echo "   2. Create database: CREATE DATABASE absen_digital;"
    echo "   3. Run seeder: npm run seed"
    echo ""
else
    echo "⚠️  MySQL not found in PATH"
    echo ""
    echo "Please install MySQL:"
    echo "   - Windows: Download from https://dev.mysql.com/downloads/installer/"
    echo "   - macOS: brew install mysql"
    echo "   - Linux: sudo apt install mysql-server"
    echo ""
    echo "After installing MySQL:"
    echo "   1. Create database: CREATE DATABASE absen_digital;"
    echo "   2. Update .env file with your MySQL credentials"
    echo "   3. Run seeder: npm run seed"
    echo "   4. Start server: npm run dev"
    echo ""
fi

echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "   1. Update .env with your MySQL credentials"
echo "   2. Create MySQL database: absen_digital"
echo "   3. Run: npm run seed"
echo "   4. Run: npm run dev"
echo "   5. Open: http://localhost:3000"
echo ""
echo "📚 See README.md for detailed instructions"
