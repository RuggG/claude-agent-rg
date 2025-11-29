#!/bin/bash
API_KEY='im8JgABClWybH5jJ1lU19Hq25LDmvzt/E1JGHjVRRdU='
curl -s -N "https://claude-agent-rg.onrender.com/chat" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"message":"Visit https://platform.claude.com/docs/en/agent-sdk/python and summarize the main content in 2-3 sentences"}'
