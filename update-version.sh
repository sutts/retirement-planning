#!/bin/bash

# Get current date and time
# Format: YYYY-MM-DD HH:MM
NOW=$(date +"%Y-%m-%d %H:%M")

# Detect OS to handle sed differences (macOS vs Linux)
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS sed needs an empty string for the -i flag
  sed -i '' "s/Last updated: [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}.*/Last updated: $NOW (Local Update)/" index.html
else
  # Linux sed
  sed -i "s/Last updated: [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}.*/Last updated: $NOW (Local Update)/" index.html
fi

# Optional: Try to get short commit hash if in a git repo
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  COMMIT=$(git rev-parse --short HEAD 2>/dev/null)
  if [ -n "$COMMIT" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s/(Local Update)/(Commit: $COMMIT)/" index.html
    else
      sed -i "s/(Local Update)/(Commit: $COMMIT)/" index.html
    fi
  fi
fi

echo "Version updated to: $NOW"
