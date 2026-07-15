#!/bin/bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}=============================${NC}"
echo -e "${BLUE}   Chatbot Setup Script      ${NC}"
echo -e "${BLUE}=============================${NC}"
echo ""

# Check .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${YELLOW}⚠  .env created from .env.example${NC}"
  echo -e "${YELLOW}   Please fill in your API keys in .env before running docker-compose!${NC}"
else
  echo -e "${GREEN}✓ .env exists${NC}"
fi

echo ""
echo -e "${BLUE}[1/3] Installing backend dependencies...${NC}"
cd backend && npm install && echo -e "${GREEN}✓ Backend deps installed${NC}" && cd ..

echo ""
echo -e "${BLUE}[2/3] Installing frontend dependencies...${NC}"
cd frontend && npm install && echo -e "${GREEN}✓ Frontend deps installed${NC}" && cd ..

echo ""
echo -e "${BLUE}[3/3] Generating Prisma client...${NC}"
cd backend && npx prisma generate && echo -e "${GREEN}✓ Prisma client generated${NC}" && cd ..

echo ""
echo -e "${GREEN}=============================${NC}"
echo -e "${GREEN}   Setup complete!           ${NC}"
echo -e "${GREEN}=============================${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit .env  →  add GROQ_API_KEY, BREVO_* keys, JWT_SECRET"
echo "  2. Run:  docker-compose up --build"
echo "  3. App runs at:  http://localhost:5173"
echo "  4. Create agent:"
echo '     curl -X POST http://localhost:4000/api/auth/register \'
echo '       -H "Content-Type: application/json" \'
echo '       -d '"'"'{"email":"agent@company.com","name":"Your Name","password":"pass123"}'"'"
echo ""
