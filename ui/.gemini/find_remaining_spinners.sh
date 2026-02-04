#!/bin/bash

# Скрипт для поиска всех оставшихся inline спиннеров в проекте
# Использование: bash find_remaining_spinners.sh

echo "=== Поиск оставшихся inline спиннеров ==="
echo ""

# Поиск всех файлов с inline спиннерами (исключая сам компонент LoadingSpinner)
echo "Файлы с inline спиннерами:"
echo "----------------------------"

grep -rn "i-heroicons-arrow-path.*animate-spin" ui/app \
  --include="*.vue" \
  --exclude="LoadingSpinner.vue" \
  | grep -v "\.gemini" \
  | while IFS=: read -r file line content; do
    echo "📄 $file:$line"
    echo "   $content"
    echo ""
done

echo "----------------------------"
echo ""
echo "Для замены используйте паттерн:"
echo ""
echo "Было:"
echo '  <UIcon name="i-heroicons-arrow-path" class="w-X h-X text-gray-400 animate-spin" />'
echo ""
echo "Стало:"
echo '  <UiLoadingSpinner size="sm|md|lg|xl" />'
echo ""
echo "Размеры:"
echo "  xs = w-4 h-4"
echo "  sm = w-5 h-5"
echo "  md = w-6 h-6 (по умолчанию)"
echo "  lg = w-10 h-10"
echo "  xl = w-12 h-12"
