import os
import re

def clean_template(template):
    # Remove strings to avoid matching > inside them
    # Handle single quotes and double quotes
    template = re.sub(r'"[^"]*"', '""', template)
    template = re.sub(r"'[^']*'", "''", template)
    # Remove comments
    template = re.sub(r'<!--.*?-->', '', template, flags=re.DOTALL)
    return template

def check_file_tags(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    template_match = re.search(r'<template>(.*)</template>', content, re.DOTALL)
    if not template_match:
        return []

    template = template_match.group(1)
    cleaned = clean_template(template)
    
    # Now find tags in cleaned template
    # Attributes are now mostly empty strings
    tags = re.findall(r'<(/?[a-zA-Z0-9-]+)(?:\s+[^>]*?)?(/?)\s*>', cleaned)
    
    stack = []
    errors = []
    
    html5_self_closing = {
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr'
    }

    for tag_name, self_closing in tags:
        if self_closing == '/':
            continue
        
        if tag_name.startswith('/'):
            actual_name = tag_name[1:]
            if not stack:
                errors.append(f"Unexpected closing tag </{actual_name}>")
            else:
                last_tag = stack.pop()
                if last_tag != actual_name:
                    errors.append(f"Mismatched tag: expected </{last_tag}>, found </{actual_name}>")
        else:
            if tag_name.lower() not in html5_self_closing:
                stack.append(tag_name)
    
    for tag in stack:
        errors.append(f"Unclosed tag <{tag}>")
        
    return errors

ui_app_dir = '/mnt/disk2/workspace/gran-publicador/ui/app'
all_errors = {}

for root, dirs, files in os.walk(ui_app_dir):
    for file in files:
        if file.endswith('.vue'):
            path = os.path.join(root, file)
            errors = check_file_tags(path)
            if errors:
                all_errors[path] = errors

if not all_errors:
    print("No unclosed tags found.")
else:
    for path, errors in all_errors.items():
        print(f"File: {path}")
        for err in errors:
            print(f"  - {err}")
