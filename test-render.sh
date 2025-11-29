#!/bin/bash
API_KEY='im8JgABClWybH5jJ1lU19Hq25LDmvzt/E1JGHjVRRdU='
curl -v "https://claude-agent-rg.onrender.com/chat" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"message":"What is 2+2?"}'
