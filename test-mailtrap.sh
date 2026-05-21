#!/bin/bash

# Wait for server to start
sleep 3

# Test OTP email delivery
echo "Testing OTP email delivery..."
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@1234"
  }' 2>/dev/null | jq .

echo "---"
echo "Check server logs for detailed Mailtrap API responses"
