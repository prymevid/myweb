import subprocess

def reset_repo():
    try:
        result = subprocess.run(
            ["git", "reset", "--hard", "origin/main"],
            check=True,
            text=True,
            capture_output=True
        )
        print("Reset done successfully")
        print(result.stdout)
    except subprocess.CalledProcessError as e:
        print("Something went wrong")
        print(e.stderr)

if __name__ == "__main__":
    reset_repo()