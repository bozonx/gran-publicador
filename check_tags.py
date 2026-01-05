import os
import re
from html.parser import HTMLParser

class TagChecker(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.errors = []

    def handle_starttag(self, tag, attrs):
        # List of self-closing tags in HTML
        self_closing = {
            'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
            'link', 'meta', 'param', 'source', 'track', 'wbr'
        }
        if tag not in self_closing:
            # Check if it was explicitly self-closed in the source (for Vue/JSX)
            # HTMLParser doesn't easily tell us if it was <tag /> vs <tag>
            # but for Vue we care about components too.
            self.tags.append((tag, self.getpos()))

    def handle_startendtag(self, tag, attrs):
        # This is called for <tag />
        pass

    def handle_endtag(self, tag):
        if not self.tags:
            self.errors.append(f"Unexpected closing tag </{tag}> at line {self.getpos()[0]}")
            return
        
        last_tag, pos = self.tags.pop()
        if last_tag != tag:
            # Sometimes tags can be mismatched like <div><span></div></span>
            # but we'll reporting it as a mismatch
            self.errors.append(f"Mismatched tag: expected </{last_tag}> (from line {pos[0]}), found </{tag}> at line {self.getpos()[0]}")
            # Try to find the matching tag in the stack to recover
            for i in range(len(self.tags) - 1, -1, -1):
                if self.tags[i][0] == tag:
                    # Found it, assume the intermediate tags were unclosed
                    self.tags = self.tags[:i]
                    break

def check_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract <template>...</template>
    template_match = re.search(r'<template>(.*)</template>', content, re.DOTALL)
    if not template_match:
        return []

    template_content = template_match.group(1)
    parser = TagChecker()
    try:
        parser.feed(template_content)
    except Exception as e:
        return [f"Parser error: {str(e)}"]
    
    errors = parser.errors
    for tag, pos in parser.tags:
        errors.append(f"Unclosed tag <{tag}> at line {pos[0]}")
    
    return errors

ui_app_dir = '/mnt/disk2/workspace/gran-publicador/ui/app'
all_errors = {}

for root, dirs, files in os.walk(ui_app_dir):
    for file in files:
        if file.endswith('.vue'):
            path = os.path.join(root, file)
            errors = check_file(path)
            if errors:
                all_errors[path] = errors

if not all_errors:
    print("No unclosed tags found in .vue files.")
else:
    for path, errors in all_errors.items():
        print(f"File: {path}")
        for err in errors:
            print(f"  - {err}")
