import os

kb_dir = '/home/steelsmith/code/resume/knowledge-base'

def strip_md_frontmatter(content):
    """Strip --- delimited YAML frontmatter from markdown files."""
    if not content.startswith('---\n'):
        return content
    end = content.find('\n---\n', 4)
    if end == -1:
        return content
    # Skip past the closing --- and any trailing blank lines
    rest = content[end + 5:].lstrip('\n')
    return rest

def strip_code_frontmatter(content):
    """Strip # --- delimited frontmatter from code files."""
    if not content.startswith('# ---\n'):
        return content
    lines = content.split('\n')
    # Find the closing # ---
    for i in range(1, len(lines)):
        if lines[i] == '# ---':
            rest = '\n'.join(lines[i + 1:]).lstrip('\n')
            return rest
    return content

count = 0
for root, dirs, files in os.walk(kb_dir):
    for f in files:
        path = os.path.join(root, f)
        with open(path, 'r') as fh:
            content = fh.read()

        original = content
        if f.endswith('.md'):
            content = strip_md_frontmatter(content)
        elif f.endswith(('.py', '.ts', '.tf')):
            content = strip_code_frontmatter(content)

        if content != original:
            with open(path, 'w') as fh:
                fh.write(content)
            count += 1
            print(f'Stripped: {os.path.relpath(path, kb_dir)}')

print(f'\nTotal: {count} files updated')
