#!/bin/bash

echo "========================================"
echo "HostelHaven Test Users Setup"
echo "========================================"
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "Node.js version: $(node --version)"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found"
    echo "Please create .env file with your Supabase credentials"
    echo "Example:"
    echo "SUPABASE_URL=your_supabase_url"
    echo "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key"
    exit 1
fi

echo "Installing dependencies..."
npm install @supabase/supabase-js dotenv

echo
echo "Setting up test user credentials..."
echo "This will create authentication users in Supabase Auth"
echo

node scripts/setup-test-credentials.js

echo
echo "Setup complete! Check the output above for any errors."
echo
