#!/bin/bash

# Script to replace inline card styles with app-card utility class

# Find all .vue files and replace the pattern
find /mnt/disk2/workspace/gran-publicador/ui/app -name "*.vue" -type f -exec sed -i \
  's/class="\([^"]*\)bg-white dark:bg-gray-800 rounded-lg shadow\([^"]*\)"/class="\1app-card\2"/g' {} +

echo "Replaced all instances of 'bg-white dark:bg-gray-800 rounded-lg shadow' with 'app-card'"
