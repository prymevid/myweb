import os

commit_message = input("Commit message: ")

# 1. ensure you're on main branch
os.system("git checkout main")

# 2. stage everything (new + deleted files too)
os.system("git add -A")

# 3. commit
os.system(f'git commit -m "{commit_message}"')

# 4. push safely
os.system("git push origin main")